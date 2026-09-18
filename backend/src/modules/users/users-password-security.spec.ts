import * as bcrypt from 'bcryptjs';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuditAction, Role } from '../../common/enums';

describe('UsersService admin password updates', () => {
  async function setup() {
    const currentHash = await bcrypt.hash('existing-password', 4);
    const user = {
      _id: { toString: () => 'user-1' },
      name: 'User',
      email: 'user@example.com',
      role: Role.ENGINEER,
      isActive: true,
      password: currentHash,
    };
    const updateQuery = {
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue({ ...user, authVersion: 1 }),
    };
    const userModel = {
      findById: jest.fn().mockResolvedValue(user),
      findOne: jest.fn().mockResolvedValue(null),
      findByIdAndUpdate: jest.fn().mockReturnValue(updateQuery),
    };
    const auditLogsService = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new UsersService(userModel as any, auditLogsService as any);
    return { service, userModel, auditLogsService };
  }

  it('sanitizes the audit and revokes sessions on an admin password reset', async () => {
    const { service, userModel, auditLogsService } = await setup();
    const dto = { password: 'different-password', name: 'Updated User' };

    await service.update('user-1', dto, { userId: 'admin-1', name: 'Admin' });

    expect(dto.password).toBe('different-password');
    const operation = userModel.findByIdAndUpdate.mock.calls[0][1];
    expect(operation.$set.password).not.toBe(dto.password);
    expect(operation.$set.refreshToken).toBeNull();
    expect(operation.$inc).toEqual({ authVersion: 1 });
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.PASSWORD_RESET_BY_ADMIN,
        changes: { name: 'Updated User', passwordChanged: true },
      }),
    );
    expect(JSON.stringify(auditLogsService.create.mock.calls[0][0])).not.toContain(
      operation.$set.password,
    );
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
