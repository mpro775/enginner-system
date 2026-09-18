import nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

describe('MailService TLS configuration', () => {
  const createTransport = nodemailer.createTransport as jest.Mock;

  beforeEach(() => {
    createTransport.mockReset();
    createTransport.mockReturnValue({ sendMail: jest.fn() });
  });

  function config(values: Record<string, string>) {
    return {
      get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
    };
  }

  it('configures implicit TLS for port 465', () => {
    new MailService(
      config({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_REQUIRE_TLS: 'false',
        SMTP_FROM_EMAIL: 'no-reply@example.com',
        NODE_ENV: 'production',
      }) as any,
    );

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: '465', secure: true, requireTLS: false }),
    );
  });

  it('requires STARTTLS for port 587', () => {
    new MailService(
      config({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_REQUIRE_TLS: 'true',
        SMTP_FROM_EMAIL: 'no-reply@example.com',
        NODE_ENV: 'production',
      }) as any,
    );

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: '587', secure: false, requireTLS: true }),
    );
  });

  it('rejects a production SMTP transport without TLS', () => {
    expect(
      () =>
        new MailService(
          config({
            SMTP_HOST: 'smtp.example.com',
            SMTP_PORT: '587',
            SMTP_SECURE: 'false',
            SMTP_REQUIRE_TLS: 'false',
            SMTP_FROM_EMAIL: 'no-reply@example.com',
            NODE_ENV: 'production',
          }) as any,
        ),
    ).toThrow('SMTP TLS must be enabled in production');
  });
});
