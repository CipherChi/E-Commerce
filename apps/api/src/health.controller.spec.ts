import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports healthy only after the database responds', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as never);

    await expect(controller.check()).resolves.toEqual({ status: 'ok', database: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('propagates a database failure instead of reporting healthy', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('database unavailable')) };
    const controller = new HealthController(prisma as never);

    await expect(controller.check()).rejects.toThrow('database unavailable');
  });
});
