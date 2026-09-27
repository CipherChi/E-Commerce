import { NotFoundException } from '@nestjs/common';
import { GuestsService } from './guests.service';

describe('GuestsService', () => {
  const prisma: any = {
    guest: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new GuestsService(prisma);
  beforeEach(() => jest.clearAllMocks());
  it('searches guest names and phone numbers', async () => {
    prisma.guest.findMany.mockResolvedValue([]);
    await service.list('Ada');
    expect(prisma.guest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { fullName: { contains: 'Ada', mode: 'insensitive' } },
            { phone: { contains: 'Ada' } },
          ],
        },
      }),
    );
  });
  it('creates and updates guest details', async () => {
    prisma.guest.create.mockResolvedValue({ id: 'guest-1', fullName: 'Ada Guest' });
    prisma.guest.findUnique.mockResolvedValue({ id: 'guest-1' });
    prisma.guest.update.mockResolvedValue({ id: 'guest-1', phone: '+2348000000000' });
    await service.create({ fullName: 'Ada Guest', phone: '+2348000000000' });
    await service.update('guest-1', { phone: '+2348000000000' });
    expect(prisma.guest.create).toHaveBeenCalledWith({
      data: { fullName: 'Ada Guest', phone: '+2348000000000' },
    });
    expect(prisma.guest.update).toHaveBeenCalled();
  });
  it('returns not found when updating an absent guest', async () => {
    prisma.guest.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { notes: 'new note' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.guest.update).not.toHaveBeenCalled();
  });
});
