import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { normalizeDepartmentIds } from '../../../common/utils/access-scope.util';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = (await this.userModel
      .findById(payload.sub)
      .select('_id email name role isActive deletedAt departmentIds +departmentId')
      .lean()) as {
      _id: unknown;
      email: string;
      name: string;
      role: string;
      isActive: boolean;
      deletedAt?: Date | null;
      departmentIds?: unknown[];
      departmentId?: unknown;
    } | null;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isActive !== true) {
      throw new UnauthorizedException('User account is deactivated');
    }

    if (user.deletedAt != null) {
      throw new UnauthorizedException('User account is deleted');
    }

    const currentDepartmentIds = normalizeDepartmentIds(user.departmentIds);
    const departmentIds =
      currentDepartmentIds.length > 0
        ? currentDepartmentIds
        : normalizeDepartmentIds(
            user.departmentId === null || user.departmentId === undefined
              ? []
              : [user.departmentId],
          );

    return {
      userId: String(user._id),
      email: user.email,
      role: user.role,
      name: user.name,
      departmentIds,
    };
  }
}





