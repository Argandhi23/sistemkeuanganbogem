import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Akses khusus Administrator' }, { status: 403 });
    }

    const logs = await prisma.activityLog.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // 100 log aktivitas terbaru
    });

    return NextResponse.json({ data: logs });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memuat catatan aktivitas' },
      { status: 500 }
    );
  }
}
