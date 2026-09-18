import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { passwordResetOtpTemplate } from './templates/password-reset-otp.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST')?.trim();
    const user = this.configService.get<string>('SMTP_USER')?.trim();
    const password = this.configService.get<string>('SMTP_PASSWORD');
    this.fromEmail =
      this.configService.get<string>('SMTP_FROM_EMAIL')?.trim() || user || '';
    this.fromName = this.configService.get<string>(
      'SMTP_FROM_NAME',
      'نظام إدارة طلبات الصيانة',
    );

    if (!host || !this.fromEmail) {
      this.transporter = null;
      this.logger.warn('SMTP is not configured; password recovery email is unavailable.');
      return;
    }

    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure =
      this.configService.get<string>('SMTP_SECURE', 'false').toLowerCase() ===
      'true';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && password ? { user, pass: password } : undefined,
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 12_000,
    });
  }

  async sendPasswordResetOtp(input: {
    to: string;
    name?: string;
    otp: string;
    expiresInMinutes: number;
  }): Promise<void> {
    if (!this.transporter) {
      throw new ServiceUnavailableException('Email service is unavailable.');
    }

    try {
      await this.transporter.sendMail({
        from: { name: this.fromName, address: this.fromEmail },
        to: input.to,
        subject: 'رمز إعادة تعيين كلمة المرور - نظام إدارة طلبات الصيانة',
        html: passwordResetOtpTemplate(input),
      });
    } catch {
      this.logger.warn('Password reset email dispatch failed.');
      throw new ServiceUnavailableException('Email service is unavailable.');
    }
  }
}
