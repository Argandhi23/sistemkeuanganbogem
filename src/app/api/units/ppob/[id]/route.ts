import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logActivity } from '@/lib/activityLog';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const { id } = params;
    const existing = await prisma.ppobTransaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Transaksi PPOB tidak ditemukan' }, { status: 404 });
    }

    await prisma.ppobTransaction.delete({ where: { id } });

    void logActivity({
      userId: session.user.id,
      action: 'HAPUS_TRANSAKSI_PPOB',
      targetType: 'PpobTransaction',
      targetId: id,
      detail: `Hapus transaksi ${existing.transactionNo}`,
    });

    return NextResponse.json({ message: 'Transaksi PPOB berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting ppob transaction:', error);
    return NextResponse.json({ error: 'Gagal menghapus transaksi PPOB' }, { status: 500 });
  }
}
