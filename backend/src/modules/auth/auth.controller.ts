import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  ResendPasswordOtpDto,
  ResetPasswordDto,
  VerifyPasswordOtpDto,
} from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators';
import { PasswordRecoveryService } from './password-recovery.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return {
      data: await this.authService.login(loginDto, ipAddress, userAgent),
      message: 'Login successful',
    };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto, @Req() req: Request) {
    const user = req.user as {
      userId: string;
      refreshToken: string;
      authVersion: number;
    };
    return {
      data: await this.authService.refreshTokens(
        user.userId,
        user.refreshToken,
        user.authVersion,
      ),
      message: 'Tokens refreshed successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    await this.authService.logout(user.userId, ipAddress, userAgent);
    return {
      data: null,
      message: 'Logged out successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserData) {
    return {
      data: await this.authService.getMe(user.userId),
      message: 'User data retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    await this.authService.changePassword(
      user.userId,
      dto.currentPassword,
      dto.newPassword,
      req.ip || req.socket.remoteAddress,
      req.headers['user-agent'],
    );
    return { data: null, message: 'تم تغيير كلمة المرور بنجاح.' };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return {
      data: await this.passwordRecoveryService.request(dto.email),
      message: this.passwordRecoveryService.requestMessage,
    };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/verify-otp')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async verifyPasswordOtp(@Body() dto: VerifyPasswordOtpDto) {
    return {
      data: await this.passwordRecoveryService.verify(dto.challengeId, dto.otp),
      message: 'تم التحقق من رمز التحقق بنجاح.',
    };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/resend-otp')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async resendPasswordOtp(@Body() dto: ResendPasswordOtpDto) {
    return {
      data: await this.passwordRecoveryService.resend(dto.challengeId),
      message: 'تم إرسال رمز تحقق جديد.',
    };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    await this.passwordRecoveryService.reset(
      dto.resetToken,
      dto.newPassword,
      req.ip || req.socket.remoteAddress,
      req.headers['user-agent'],
    );
    return { data: null, message: 'تم تعيين كلمة المرور الجديدة بنجاح.' };
  }
}






