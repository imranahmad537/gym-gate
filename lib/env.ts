import 'server-only';
import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  APP_URL: z.url().optional(),
  APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
});

type Env = z.infer<typeof schema>;
let cached: Env | null = null;

/** Validated server environment. Throws a readable error on first use if misconfigured. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_URL: process.env.APP_URL || undefined,
    APP_SECRET: process.env.APP_SECRET,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`GymGate is missing configuration. Check your .env file:\n${issues}`);
  }
  if (process.env.NODE_ENV === 'production' && !parsed.data.APP_URL) {
    throw new Error('APP_URL is required in production (e.g. https://gymgate.pk).');
  }
  cached = parsed.data;
  return cached;
}
