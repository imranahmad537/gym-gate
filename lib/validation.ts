import { z } from 'zod';
import { isDateString } from '@/lib/dates';
import { normalizePkMobile } from '@/lib/phone';
import { parseAmount } from '@/lib/money';
import { m } from '@/messages';
import { PAYMENT_METHODS } from '@/lib/types';

const name = z.string().trim().min(2, m.form.errors.name).max(80, m.form.errors.name);
const phone = z.string().transform((v, ctx) => {
  const n = normalizePkMobile(v);
  if (!n) {
    ctx.addIssue({ code: 'custom', message: m.form.errors.phone });
    return z.NEVER;
  }
  return n;
});
const date = z.string().refine(isDateString, m.form.errors.date);
const optionalAmount = z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((v, ctx) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseAmount(v);
  if (n === null || n < 0 || n > 10_000_000) {
    ctx.addIssue({ code: 'custom', message: m.form.errors.amount });
    return z.NEVER;
  }
  return n;
});
const note = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v) => v || null);

export const methodSchema = z.enum(PAYMENT_METHODS as [string, ...string[]]) as z.ZodType<(typeof PAYMENT_METHODS)[number]>;

export const memberCreateSchema = z.object({
  name,
  phone,
  planId: z.uuid(m.form.errors.plan),
  start: date,
  amount: optionalAmount,
  method: methodSchema.default('cash'),
  note,
});

export const memberUpdateSchema = z.object({
  name,
  phone,
  planId: z.uuid(m.form.errors.plan),
  note,
});

export const paymentSchema = z.object({
  memberId: z.uuid(),
  amount: optionalAmount.refine((v) => v !== null && v > 0, m.form.errors.amount),
  method: methodSchema,
  paidOn: date,
  extend: z.boolean(),
  planId: z.uuid().nullable().optional(),
  note,
});

export const planSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(40),
  durationDays: z.coerce.number().int().min(1).max(3660),
  price: z.coerce.number().int().min(0).max(10_000_000),
});

export const gymSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).optional().default(''),
});

export const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits');

export const kioskSettingsSchema = z.object({
  qrIntervalSecs: z.union([z.literal(15), z.literal(20), z.literal(30)]),
  resultSecs: z.number().int().min(2).max(10),
  keypadEnabled: z.boolean(),
});

export const securitySchema = z.object({
  requirePasskey: z.boolean(),
  oneDevicePerMember: z.boolean(),
});

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? m.common.somethingWrong;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
