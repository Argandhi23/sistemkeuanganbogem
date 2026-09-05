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
      message: 'Sistem menggunakan database terpadu. Laporan dapat diunduh via fitur Export Excel.',
    });
  } catch (error) {
    console.error('Error during sync endpoint call:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Terjadi kesalahan sistem',
      },
      { status: 500 }
    );
  }
}
