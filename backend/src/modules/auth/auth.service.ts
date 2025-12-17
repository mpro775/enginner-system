import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, Role } from '../../common/enums';
import { Inject, forwardRef } from '@nestjs/common';
import { ScheduledTasksService } from '../scheduled-tasks/scheduled-tasks.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

export interface TokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse extends TokensResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditLogsService: AuditLogsService,
    @Inject(forwardRef(() => ScheduledTasksService))
    private scheduledTasksService: ScheduledTasksService,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
  ) {}

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    const user = await this.userModel.findOne({ email: loginDto.email.toLowerCase() });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user);

    // Update refresh token and last login
    await this.userModel.findByIdAndUpdate(user._id, {
      refreshToken: tokens.refreshToken,
      lastLoginAt: new Date(),
    });

    // Log the login action
    await this.auditLogsService.create({
      userId: user._id.toString(),
      userName: user.name,
      action: AuditAction.LOGIN,
      entity: 'User',
      entityId: user._id.toString(),
      ipAddress,
      userAgent,
    });

    // Notify about pending tasks for engineers
    if (user.role === Role.ENGINEER) {
      this.notifyPendingTasks(user._id.toString());
    }

    return {
      ...tokens,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<TokensResponse> {
    const user = await this.userModel.findById(userId);

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    const tokens = await this.generateTokens(user);

    await this.userModel.findByIdAndUpdate(user._id, {
      refreshToken: tokens.refreshToken,
    });

    return tokens;
  }

  async logout(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await this.userModel.findById(userId);

    if (user) {
      await this.userModel.findByIdAndUpdate(userId, {
        refreshToken: null,
      });

      // Log the logout action
      await this.auditLogsService.create({
        userId: user._id.toString(),
        userName: user.name,
        action: AuditAction.LOGOUT,
        entity: 'User',
        entityId: user._id.toString(),
        ipAddress,
        userAgent,
      });
    }
  }

  async getMe(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password -refreshToken')
      .populate('departmentId', 'name');

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async generateTokens(user: UserDocument): Promise<TokensResponse> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(
        { sub: user._id.toString(), email: user.email },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private async notifyPendingTasks(engineerId: string): Promise<void> {
    try {
      const tasks = await this.scheduledTasksService.findPendingByEngineer(
        engineerId
      );

      if (tasks.length > 0) {
        const overdueTasks = tasks.filter(
          (task) => task.status === "overdue"
        );
        const pendingTasks = tasks.filter(
          (task) => task.status === "pending"
        );

        if (overdueTasks.length > 0) {
          this.notificationsGateway.notifyPendingTasks(engineerId, {
            overdue: overdueTasks.length,
            pending: pendingTasks.length,
            total: tasks.length,
          });
        } else if (pendingTasks.length > 0) {
          this.notificationsGateway.notifyPendingTasks(engineerId, {
            overdue: 0,
            pending: pendingTasks.length,
            total: tasks.length,
          });
        }
      }
    } catch (error) {
      // Silently fail - don't block login if notification fails
      console.error("Error notifying about pending tasks:", error);
    }
  }
}






