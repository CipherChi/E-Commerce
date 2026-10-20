import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports liveness without requiring the database', () => {
    const prisma = { $queryRaw: jest.fn() };
    const controller = new HealthController(prisma as never);

    expect(controller.live()).toEqual({ status: 'ok' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('reports readiness only after the database responds', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as never);

    await expect(controller.ready()).resolves.toEqual({ status: 'ok', database: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('propagates a database failure instead of reporting ready', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('database unavailable')) };
    const controller = new HealthController(prisma as never);

    await expect(controller.ready()).rejects.toThrow('database unavailable');
  });

  it('preserves the legacy health route as a readiness alias', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as never);

    await expect(controller.check()).resolves.toEqual({ status: 'ok', database: 'ok' });
  });
});
