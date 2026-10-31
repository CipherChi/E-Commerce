import { BusinessType } from '@prisma/client';
import validator = require('validator');
import { z } from 'zod';

const email = z.string().max(254).refine(validator.isEmail, 'must be an email');

export const registerSchema = z.object({
  email,
  password: z.string().min(12).max(128),
  name: z.string().min(1).max(200),
  primaryType: z.nativeEnum(BusinessType),
}).strict();

export const loginSchema = z.object({
  email,
  password: z.string().min(8).max(128),
}).strict();
