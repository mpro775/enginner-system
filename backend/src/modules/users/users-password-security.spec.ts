import * as bcrypt from 'bcryptjs';
import { BadRequestException } from '@nestjs/common';
import { AuditAction, Role } from '../../common/enums';
import { UsersService } from './users.service';

describe('UsersService security identity lifecycle', () => {
  async function setup(overrides: Record<string, unknown> = {}) {
    const currentHash = await bcrypt.hash('existing-password', 4);
    const user = {
      _id: { toString: () => 'user-1' },
      name: 'User',
      email: 'user@example.com',
      role: Role.ENGINEER,
      isActive: true,
      password: currentHash,
      authVersion: 7,
      refreshToken: 'stored-refresh-token',
      deletedAt: null,
      ...overrides,
    };
    const updateQuery = {
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue({ ...user, authVersion: 8 }),
    };
    const userModel = {
      findById: jest.fn().mockResolvedValue(user),
      findOne: jest.fn().mockResolvedValue(null),
      findByIdAndUpdate: jest.fn().mockReturnValue(updateQuery),
    };
    const auditLogsService = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new UsersService(userModel as any, auditLogsService as any);
    return { service, userModel, auditLogsService, user };
  }

  it('increments authVersion once for password, email, and status together', async () => {
    const { service, userModel, auditLogsService } = await setup();
    const dto = {
      password: 'different-password',
      email: ' NEW@Example.com ',
      isActive: false,
    };

    await service.update(
      'user-1',
      dto,
      { userId: 'admin-1', name: 'Admin' },
      { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
    );

    const operation = userModel.findByIdAndUpdate.mock.calls[0][1];
    expect(operation.$set.email).toBe('new@example.com');
    expect(operation.$set.password).not.toBe(dto.password);
    expect(operation.$set.refreshToken).toBeNull();
    expect(operation.$inc).toEqual({ authVersion: 1 });
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.PASSWORD_RESET_BY_ADMIN,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        changes: {
          email: ' NEW@Example.com ',
          isActive: false,
          passwordChanged: true,
        },
      }),
    );
    expect(JSON.stringify(auditLogsService.create.mock.calls[0][0])).not.toContain(
      operation.$set.password,
    );
  });

  it('revokes the session when email changes', async () => {
    const { service, userModel } = await setup();

    await service.update(
      'user-1',
      { email: 'other@example.com' },
      { userId: 'admin-1', name: 'Admin' },
    );

    expect(userModel.findByIdAndUpdate.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        $set: expect.objectContaining({ refreshToken: null }),
        $inc: { authVersion: 1 },
      }),
    );
  });

  it('revokes the session when status is toggled', async () => {
    const { service, userModel } = await setup();

    await service.toggleStatus('user-1', {
      userId: 'admin-1',
      name: 'Admin',
    });

    expect(userModel.findByIdAndUpdate.mock.calls[0][1]).toEqual({
      $set: { isActive: false, refreshToken: null },
      $inc: { authVersion: 1 },
    });
  });

  it('revokes the session on soft delete', async () => {
    const { service, userModel } = await setup();

    await service.softDelete('user-1', {
      userId: 'admin-1',
      name: 'Admin',
    });

    expect(userModel.findByIdAndUpdate.mock.calls[0][1]).toEqual({
      $set: expect.objectContaining({
        deletedBy: 'admin-1',
        refreshToken: null,
        deletedAt: expect.any(Date),
      }),
      $inc: { authVersion: 1 },
    });
  });

  it('revokes the session on restore', async () => {
    const { service, userModel } = await setup({ deletedAt: new Date() });

    await service.restore('user-1', {
      userId: 'admin-1',
      name: 'Admin',
    });

    expect(userModel.findByIdAndUpdate.mock.calls[0][1]).toEqual({
      $set: { refreshToken: null },
      $unset: { deletedAt: 1, deletedBy: 1 },
      $inc: { authVersion: 1 },
    });
  });

  it('keeps an admin password reset successful if audit storage fails', async () => {
    const { service, auditLogsService } = await setup();
    auditLogsService.create.mockRejectedValue(new Error('audit down'));

    await expect(
      service.update(
        'user-1',
        { password: 'different-password' },
        { userId: 'admin-1', name: 'Admin' },
      ),
    ).resolves.toBeDefined();
  });

  it('rejects resetting the password to the current value', async () => {
    const { service, userModel } = await setup();

    await expect(
      service.update(
        'user-1',
        { password: 'existing-password' },
        { userId: 'admin-1', name: 'Admin' },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
