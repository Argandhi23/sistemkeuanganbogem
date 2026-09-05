import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logActivity } from '@/lib/activityLog';
import { invalidateDashboardStatsCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();

    const existing = await prisma.cateringOrder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.cateringOrder.update({
        where: { id },
        data: {
          customerName: body.customerName ?? existing.customerName,
          customerPhone: body.customerPhone !== undefined ? body.customerPhone : existing.customerPhone,
          eventDate: body.eventDate ? new Date(body.eventDate) : existing.eventDate,
          menuDetail: body.menuDetail ?? existing.menuDetail,
          portion: body.portion !== undefined ? Number(body.portion) : existing.portion,
          totalPrice: body.totalPrice !== undefined ? Number(body.totalPrice) : existing.totalPrice,
          downPayment: body.downPayment !== undefined ? Number(body.downPayment) : existing.downPayment,
          paymentStatus: body.paymentStatus ?? existing.paymentStatus,
          status: body.status ?? existing.status,
          notes: body.notes !== undefined ? body.notes : existing.notes,
        },
      });

      // Jika terjadi pelunasan baru yang disinkronkan ke kas
      if (
        body.syncSettlement &&
        existing.paymentStatus !== 'LUNAS' &&
        body.paymentStatus === 'LUNAS'
      ) {
        const settlementAmount = Number(order.totalPrice) - Number(order.downPayment);
        if (settlementAmount > 0) {
          const cateringAccount = await tx.account.findFirst({
            where: { code: '4001' },
          });

          await tx.transaction.create({
            data: {
              type: 'PEMASUKAN',
              category: 'Pendapatan Catering',
              businessUnit: 'CATERING',
              paymentMethod: 'TUNAI',
              accountId: cateringAccount?.id || null,
              description: `Pelunasan Pesanan Catering: ${order.customerName}`,
              amount: settlementAmount,
              date: new Date(),
              createdById: session.user.id,
            },
          });
        }
      }

      return order;
    });

    invalidateDashboardStatsCache();

    logActivity({
      userId: session.user.id,
      action: 'UPDATE_PESANAN_CATERING',
      targetType: 'CateringOrder',
      targetId: id,
      detail: `Perbarui pesanan ${updated.customerName} (Status: ${updated.status})`,
    }).catch(() => {});

    return NextResponse.json({ message: 'Pesanan berhasil diperbarui', data: updated });
  } catch (error) {
    console.error('Error updating catering order:', error);
    return NextResponse.json({ error: 'Gagal memperbarui pesanan' }, { status: 500 });
  }
}

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
    const existing = await prisma.cateringOrder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    await prisma.cateringOrder.delete({ where: { id } });

    await logActivity({
      userId: session.user.id,
      action: 'HAPUS_PESANAN_CATERING',
      targetType: 'CateringOrder',
      targetId: id,
      detail: `Menghapus pesanan catering ${existing.customerName}`,
    });

    return NextResponse.json({ message: 'Pesanan berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting catering order:', error);
    return NextResponse.json({ error: 'Gagal menghapus pesanan' }, { status: 500 });
  }
}
