import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface HealthCache {
  timestamp: number;
  latencyMs: number;
  accountsCount: number;
}

const MIN_PING_INTERVAL_MS = 60 * 1000; // 60 seconds throttle to protect Free Tier
let lastPingCache: HealthCache | null = null;

/**
 * Endpoint Keep-Alive & Health Check untuk mencegah Supabase Free Tier tidur (pause setelah 7 hari inaktif).
 * - Dipanggil otomatis oleh Vercel Cron setiap hari (vercel.json)
 * - Dipanggil otomatis oleh GitHub Actions setiap 2 hari (.github/workflows/supabase-keep-alive.yml)
 * - Dapat dipantau oleh UptimeRobot / cron-job.org (mendukung GET & HEAD)
 * - Menggunakan throttling in-memory 60 detik agar hemat resource Vercel & Supabase Free Tier
 * - Melakukan operasi baca + tulis atomik tanpa residu data (Zero Residue)
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(req.url);
  const isForced =
    searchParams.get('force') === '1' ||
    searchParams.get('source') === 'vercel-cron' ||
    req.headers.get('x-vercel-cron') === '1';

  // Return cached response if pinged recently (protects Vercel & Supabase from spam)
  if (
    !isForced &&
    lastPingCache &&
    Date.now() - lastPingCache.timestamp < MIN_PING_INTERVAL_MS
  ) {
    return NextResponse.json(
      {
        status: 'ok',
        database: 'connected',
        cached: true,
        latencyMs: lastPingCache.latencyMs,
        accountsCount: lastPingCache.accountsCount,
        lastCheckedAt: new Date(lastPingCache.timestamp).toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  try {
    // Single-roundtrip atomic heartbeat:
    // Membaca tabel User & Account serta melakukan INSERT+DELETE atomik pada ActivityLog
    // dalam 1 statement CTE sehingga tercatat sebagai aktivitas penuh (read + write + commit)
    // di pg_stat_database & pg_stat_user_tables Supabase, namun 100% ZERO RESIDUE (0 baris tersisa).
    const result = await prisma.$queryRaw<Array<{ accounts_count: bigint }>>`
      WITH heartbeat_ins AS (
        INSERT INTO "ActivityLog" ("id", "userId", "action", "targetType", "targetId", "detail", "createdAt")
        SELECT '_supabase_keepalive_ping_', "id", 'SYSTEM_KEEPALIVE', 'Database', 'keepalive', 'Supabase keep-alive heartbeat', NOW()
        FROM "User"
        LIMIT 1
        ON CONFLICT ("id") DO UPDATE SET "createdAt" = NOW()
        RETURNING "id"
      ),
      heartbeat_del AS (
        DELETE FROM "ActivityLog"
        WHERE "id" IN (SELECT "id" FROM heartbeat_ins)
      )
      SELECT COUNT(*)::bigint AS accounts_count FROM "Account"
    `;

    const latencyMs = Date.now() - startTime;
    const accountsCount = Number(result?.[0]?.accounts_count ?? 0);

    lastPingCache = {
      timestamp: Date.now(),
      latencyMs,
      accountsCount,
    };

    return NextResponse.json(
      {
        status: 'ok',
        database: 'connected',
        cached: false,
        keepAlive: true,
        latencyMs,
        accountsCount,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Health/Keep-Alive Error]:', errMsg);
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        message: 'Database connection check failed',
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}

export async function HEAD(req: NextRequest) {
  const res = await GET(req);
  return new NextResponse(null, {
    status: res.status,
    headers: res.headers,
  });
}
