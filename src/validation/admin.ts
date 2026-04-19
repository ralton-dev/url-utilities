import { z } from 'zod';

export const aliasParam = z.object({
  alias: z.string().regex(/^[0-9A-Za-z]{10}$/),
});

const sortValues = [
  'createdAt',
  '-createdAt',
  'alias',
  '-alias',
  'count',
  '-count',
  'url',
  '-url',
] as const;

export type AdminSort = (typeof sortValues)[number];

export const adminListQuery = z.object({
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(sortValues).default('-createdAt'),
  minCount: z.coerce.number().int().min(0).optional(),
  maxCount: z.coerce.number().int().min(0).optional(),
});

export const adminUpdateBody = z.object({
  url: z.string().trim().url(),
});
