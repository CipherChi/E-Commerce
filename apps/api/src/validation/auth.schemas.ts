import { BusinessType } from '@prisma/client';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12),
  name: z.string().min(1).max(200),
  primaryType: z.nativeEnum(BusinessType),
}).strict();

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8),
}).strict();
