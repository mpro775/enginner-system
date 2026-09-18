import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuditAction, Role } from '../../common/enums';
import * as bcrypt from 'bcryptjs';

describe('AuthService password security', () => {
  const baseUser = {
    _id: { toString: () => 'user-1' },
    name: 'Test User',
    email: 'user@example.com',
    role: Role.ADMIN,
    password: 'stored-hash',
    isActive: true,
    deletedAt: null,
    authVersion: 4,
    departmentIds: [],
  };

  function setup() {
    const userModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    const jwtService = { signAsync: jest.fn() };
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, string> = {
          JWT_SECRET: 'access-secret',
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        return values[key] ?? fallback;
      }),
    };
    const auditLogsService = { create: jest.fn().mockResolvedValue(undefined) };
    const passwordSecurityService = {
      compare: jest.fn(),
      assertDifferent: jest.fn().mockResolvedValue(undefined),
      hash: jest.fn().mockResolvedValue('new-hash'),
    };
    const service = new AuthService(
      userModel as any,
      jwtService as any,
      configService as any,
      auditLogsService as any,
      { findPendingByEngineer: jest.fn() } as any,
      { notifyPendingTasks: jest.fn() } as any,
      passwordSecurityService as any,
    );
    return {
      service,
      userModel,
      jwtService,
      auditLogsService,
      passwordSecurityService,
    };
  }

  it('rejects a soft-deleted user during login with a generic response', async () => {
    const { service, userModel } = setup();
    const query = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ ...baseUser, deletedAt: new Date() }),
    };
    userModel.findOne.mockReturnValue(query);

    await expect(
      service.login({ email: baseUser.email, password: 'password' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
  });

  it('includes authVersion in both newly issued tokens', async () => {
    const { service, userModel, jwtService, passwordSecurityService } = setup();
    const query = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        ...baseUser,
        password: await bcrypt.hash('password', 4),
      }),
    };
    userModel.findOne.mockReturnValue(query);
    userModel.findByIdAndUpdate.mockResolvedValue(baseUser);
    passwordSecurityService.compare.mockResolvedValue(true);
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    await service.login({ email: baseUser.email, password: 'password' });

    expect(jwtService.signAsync.mock.calls[0][0]).toEqual(
      expect.objectContaining({ authVersion: 4 }),
    );
    expect(jwtService.signAsync.mock.calls[1][0]).toEqual(
      expect.objectContaining({ authVersion: 4 }),
    );
  });

  it('changes the password atomically and audits no secret values', async () => {
    const {
      service,
      userModel,
      auditLogsService,
      passwordSecurityService,
    } = setup();
    userModel.findOne.mockResolvedValue(baseUser);
    userModel.findOneAndUpdate.mockResolvedValue({ ...baseUser, authVersion: 5 });
    passwordSecurityService.compare.mockResolvedValue(true);

    await service.changePassword(
      'user-1',
      'old-password',
      'new-password',
      '127.0.0.1',
      'test-agent',
    );

    expect(userModel.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $set: { password: 'new-hash', refreshToken: null },
      $inc: { authVersion: 1 },
    });
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.PASSWORD_CHANGE,
        changes: { passwordChanged: true },
      }),
    );
    expect(JSON.stringify(auditLogsService.create.mock.calls[0][0])).not.toContain(
      'new-password',
    );
  });

  it('does not update when the current password is wrong', async () => {
    const { service, userModel, passwordSecurityService } = setup();
    userModel.findOne.mockResolvedValue(baseUser);
    passwordSecurityService.compare.mockResolvedValue(false);

    await expect(
      service.changePassword('user-1', 'wrong', 'new-password'),
    ).rejects.toThrow(BadRequestException);
    expect(userModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps a successful password change successful when audit storage fails', async () => {
    const {
      service,
      userModel,
      auditLogsService,
      passwordSecurityService,
    } = setup();
    userModel.findOne.mockResolvedValue(baseUser);
    userModel.findOneAndUpdate.mockResolvedValue({ ...baseUser, authVersion: 5 });
    passwordSecurityService.compare.mockResolvedValue(true);
    auditLogsService.create.mockRejectedValue(new Error('audit down'));

    await expect(
      service.changePassword('user-1', 'old-password', 'new-password'),
    ).resolves.toBeUndefined();
  });

  it('rejects reusing the current password', async () => {
    const { service, userModel, passwordSecurityService } = setup();
    userModel.findOne.mockResolvedValue(baseUser);
    passwordSecurityService.compare.mockResolvedValue(true);
    passwordSecurityService.assertDifferent.mockRejectedValue(
      new BadRequestException('same password'),
    );

    await expect(
      service.changePassword('user-1', 'old-password', 'old-password'),
    ).rejects.toThrow(BadRequestException);
    expect(userModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
