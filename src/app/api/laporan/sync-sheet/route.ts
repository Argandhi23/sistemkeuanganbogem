import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: 'Sistem menggunakan database terpadu. Silakan gunakan fitur Export Excel (.xlsx) untuk mengunduh laporan resmi.',
    });
  } catch (error) {
    console.error('Error in sync-sheet API:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}

