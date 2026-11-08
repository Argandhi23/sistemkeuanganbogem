import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Optimizes DATABASE_URL for Vercel Serverless + Supabase Free Tier (Supavisor Pooler).
 * Prevents connection exhaustion while keeping parallel queries fast.
 */
function getOptimizedDatabaseUrl(): string | undefined {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);

    // Ensure pgbouncer=true when using Supabase transaction pooler port 6543
    if (url.port === '6543' && !url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true');
    }

    // Cap connections per serverless lambda on Vercel to prevent exhausting Supabase Free Tier
    if (!url.searchParams.has('connection_limit')) {
      const limit = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '3' : '5';
      url.searchParams.set('connection_limit', limit);
    }

    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '20');
    }

    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', '15');
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

const optimizedUrl = getOptimizedDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(optimizedUrl ? { datasources: { db: { url: optimizedUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Always cache in globalThis (including production warm containers on Vercel Serverless)
globalForPrisma.prisma = prisma;

export default prisma;

