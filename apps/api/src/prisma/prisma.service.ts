import { PrismaClient } from '@prisma/client';

/** Prisma lifecycle is owned by server.ts, not a framework hook. */
export class PrismaService extends PrismaClient {}
