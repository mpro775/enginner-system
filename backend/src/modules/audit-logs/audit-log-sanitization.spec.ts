import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService sensitive data sanitization', () => {
  it('removes sensitive fields recursively while preserving safe markers', () => {
    const service = new AuditLogsService({} as any);
    const sanitized = (service as any).sanitizeAuditValue({
      password: 'secret',
      passwordChanged: true,
      nested: {
        current_password: 'old-secret',
        resetTokenDigest: 'digest',
        role: 'engineer',
      },
      smtp_password: 'smtp-secret',
      redis_url: 'rediss://secret',
    });

    expect(sanitized).toEqual({
      passwordChanged: true,
      nested: { role: 'engineer' },
    });
  });
});
