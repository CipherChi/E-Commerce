import { BusinessType } from '@prisma/client';
import validator = require('validator');
import { z } from 'zod';

const email = z.string().refine(validator.isEmail, 'must be an email');

export const registerSchema = z.object({
  email,
  password: z.string().min(12),
  name: z.string().min(1),
  primaryType: z.nativeEnum(BusinessType),
}).strict();

export const loginSchema = z.object({
  email,
  password: z.string().min(8),
}).strict();
