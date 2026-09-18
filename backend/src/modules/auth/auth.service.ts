import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcryptjs";
import { User, UserDocument } from "../users/schemas/user.schema";
import { LoginDto } from "./dto/login.dto";
import { JwtPayload } from "./strategies/jwt.strategy";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { AuditAction, Role } from "../../common/enums";
import { Inject, forwardRef } from "@nestjs/common";
import { ScheduledTasksService } from "../scheduled-tasks/scheduled-tasks.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { PasswordSecurityService } from "./password-security.service";

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
    departmentIds?: { id: string; name?: string }[];
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
    private passwordSecurityService: PasswordSecurityService,
  ) {}

  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResponse> {
    const user = await this.userModel
      .findOne({ email: loginDto.email.toLowerCase() })
      .populate("departmentIds", "name")
      .exec();

    if (!user || user.isActive !== true || user.deletedAt != null) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
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
      entity: "User",
      entityId: user._id.toString(),
      ipAddress,
      userAgent,
    });

    // Notify about pending tasks for engineers
    if (user.role === Role.ENGINEER) {
      this.notifyPendingTasks(
        user._id.toString(),
        ((user.departmentIds as unknown[]) || []).map((department) =>
          String((department as any)?._id ?? department),
        ),
      );
    }

    const departmentIds = (user.departmentIds as { _id?: unknown; name?: string }[] | null | undefined) ?? [];
    const departmentIdsFormatted = Array.isArray(departmentIds)
      ? departmentIds
          .filter(Boolean)
          .map((d) => ({
            id: String((d as any)._id ?? d),
            name: (d as any).name,
          }))
      : [];
    return {
      ...tokens,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        departmentIds: departmentIdsFormatted.length > 0 ? departmentIdsFormatted : undefined,
      },
    };
  }

  async refreshTokens(
    userId: string,
    refreshToken: string,
    tokenAuthVersion?: number,
  ): Promise<TokensResponse> {
    const user = await this.userModel.findById(userId);

    if (!user || !user.refreshToken || user.deletedAt != null) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (user.refreshToken !== refreshToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (user.isActive !== true) {
      throw new UnauthorizedException("Your account has been deactivated");
    }

    if ((tokenAuthVersion ?? 0) !== (user.authVersion ?? 0)) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const tokens = await this.generateTokens(user);

    await this.userModel.findByIdAndUpdate(user._id, {
      refreshToken: tokens.refreshToken,
    });

    return tokens;
  }

  async logout(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
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
        entity: "User",
        entityId: user._id.toString(),
        ipAddress,
        userAgent,
      });
    }
  }

  async getMe(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select("-password -refreshToken")
      .populate("departmentIds", "name");

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.userModel.findOne({
      _id: userId,
      isActive: true,
      deletedAt: null,
    });

    if (!user) throw new UnauthorizedException('User account is unavailable');

    if (!(await this.passwordSecurityService.compare(currentPassword, user.password))) {
      throw new BadRequestException('كلمة المرور الحالية غير صحيحة.');
    }

    await this.passwordSecurityService.assertDifferent(newPassword, user.password);
    const password = await this.passwordSecurityService.hash(newPassword);
    const currentAuthVersion = user.authVersion ?? 0;
    const updated = await this.userModel.findOneAndUpdate(
      {
        _id: user._id,
        isActive: true,
        deletedAt: null,
        $or: [
          { authVersion: currentAuthVersion },
          ...(currentAuthVersion === 0
            ? [{ authVersion: { $exists: false } }]
            : []),
        ],
      },
      {
        $set: { password, refreshToken: null },
        $inc: { authVersion: 1 },
      },
      { new: true },
    );

    if (!updated) {
      throw new UnauthorizedException('تعذر تغيير كلمة المرور. يرجى تسجيل الدخول مجدداً.');
    }

    await this.auditLogsService.create({
      userId: user._id.toString(),
      userName: user.name,
      action: AuditAction.PASSWORD_CHANGE,
      entity: 'User',
      entityId: user._id.toString(),
      changes: { passwordChanged: true },
      ipAddress,
      userAgent,
    });
  }

  private async generateTokens(user: UserDocument): Promise<TokensResponse> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      authVersion: user.authVersion ?? 0,
    };

    const jwtExpiresIn = this.configService.get<string>(
      "JWT_EXPIRES_IN",
      "15m"
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("JWT_SECRET"),
        expiresIn: jwtExpiresIn,
      }),
      this.jwtService.signAsync(
        {
          sub: user._id.toString(),
          email: user.email,
          authVersion: user.authVersion ?? 0,
        },
        {
          secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
          expiresIn: this.configService.get<string>(
            "JWT_REFRESH_EXPIRES_IN",
            "7d"
          ),
        }
      ),
    ]);

    // حساب expiresIn بالثواني ديناميكياً
    const expiresInSeconds = this.parseExpiresIn(jwtExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
    };
  }

  // دالة مساعدة لتحويل مدة الصلاحية إلى ثواني
  private parseExpiresIn(expiresIn: string): number {
    const units: { [key: string]: number } = {
      s: 1, // seconds
      m: 60, // minutes
      h: 3600, // hours
      d: 86400, // days
    };

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900; // Default to 15 minutes if parsing fails
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    return value * (units[unit] || 60);
  }

  private async notifyPendingTasks(
    engineerId: string,
    departmentIds: string[],
  ): Promise<void> {
    try {
      const tasks =
        await this.scheduledTasksService.findPendingByEngineer({
          userId: engineerId,
          role: Role.ENGINEER,
          departmentIds,
        });

      if (tasks.length > 0) {
        const overdueTasks = tasks.filter((task) => task.status === "overdue");
        const pendingTasks = tasks.filter((task) => task.status === "pending");

        if (overdueTasks.length > 0) {
          await this.notificationsGateway.notifyPendingTasks(engineerId, {
            overdue: overdueTasks.length,
            pending: pendingTasks.length,
            total: tasks.length,
          });
        } else if (pendingTasks.length > 0) {
          await this.notificationsGateway.notifyPendingTasks(engineerId, {
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
