import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';

@Injectable()
export class GuestsService {
  constructor(private prisma: PrismaService) {}

  list(query?: string) {
    const search = query?.trim();
    return this.prisma.guest.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateGuestDto) {
    return this.prisma.guest.create({ data: dto });
  }

  async update(id: string, dto: UpdateGuestDto) {
    await this.assertExists(id);
    return this.prisma.guest.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.assertExists(id);
    return this.prisma.guest.delete({ where: { id } });
  }

  private async assertExists(id: string) {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest) throw new NotFoundException('Guest not found');
  }
}
