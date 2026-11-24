import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('HealthService', () => {
  const queryRaw = vi.fn();
  const service = new HealthService({
    $queryRaw: queryRaw,
  } as unknown as PrismaService);

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('reports ok when the database answers', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('throws 503 without leaking error details when the database is down', async () => {
    queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));

    const error = await service.check().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toEqual({
      status: 'error',
      database: 'down',
    });
  });
});
