import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';

@Injectable()
export class BusinessesService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, dto: CreateBusinessDto) {
    return this.prisma.business.create({
      data: {
        ...dto,
        members: { create: { userId, role: 'OWNER' } },
      },
      include: { members: { select: { userId: true, role: true } } },
    });
  }
}
