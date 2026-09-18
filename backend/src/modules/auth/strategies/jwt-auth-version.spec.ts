import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';

describe('JWT authVersion validation', () => {
  const configService = {
    get: jest.fn((key: string) =>
      key === 'JWT_REFRESH_SECRET' ? 'refresh-secret' : 'access-secret',
    ),
  };

  function accessModel(user: Record<string, unknown> | null) {
    return {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(user),
        }),
      }),
    };
  }

  function refreshModel(user: Record<string, unknown> | null) {
    return {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(user),
        }),
      }),
    };
  }

  it('rejects an access token issued before a password change', async () => {
    const strategy = new JwtStrategy(
      configService as any,
      accessModel({
        _id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        role: 'engineer',
        isActive: true,
        deletedAt: null,
        authVersion: 3,
        departmentIds: [],
      }) as any,
    );

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        name: 'User',
        role: 'engineer',
        authVersion: 2,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('keeps legacy version-zero access tokens compatible', async () => {
    const strategy = new JwtStrategy(
      configService as any,
      accessModel({
        _id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        role: 'engineer',
        isActive: true,
        deletedAt: null,
        departmentIds: [],
      }) as any,
    );

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        name: 'User',
        role: 'engineer',
      }),
    ).resolves.toEqual(expect.objectContaining({ userId: 'user-1' }));
  });

  it('rejects a refresh token whose authVersion is stale', async () => {
    const strategy = new JwtRefreshStrategy(
      configService as any,
      refreshModel({
        _id: 'user-1',
        email: 'user@example.com',
        authVersion: 5,
        refreshToken: 'stored-token',
      }) as any,
    );

    await expect(
      strategy.validate(
        { body: { refreshToken: 'stored-token' } } as any,
        { sub: 'user-1', email: 'user@example.com', authVersion: 4 },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
