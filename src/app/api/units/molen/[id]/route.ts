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
    const action = body.action || 'update_rental';

    if (action === 'update_unit') {
      const updatedUnit = await prisma.molenUnit.update({
        where: { id },
        data: {
          name: body.name,
          dailyRate: body.dailyRate !== undefined ? Number(body.dailyRate) : undefined,
          status: body.status,
          condition: body.condition,
          notes: body.notes,
        },
      });
      return NextResponse.json({ message: 'Data unit berhasil diperbarui', data: updatedUnit });
    }

    // Default: update rental (e.g. return unit / finish rental)
    const existing = await prisma.molenRental.findUnique({
      where: { id },
      include: { unit: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Data sewa tidak ditemukan' }, { status: 404 });
    }

    const newRentalStatus = body.rentalStatus || existing.rentalStatus;
    const newPaymentStatus = body.paymentStatus || existing.paymentStatus;

    const updatedRental = await prisma.$transaction(async (tx) => {
      const rental = await tx.molenRental.update({
        where: { id },
        data: {
          rentalStatus: newRentalStatus,
          paymentStatus: newPaymentStatus,
          notes: body.notes !== undefined ? body.notes : existing.notes,
        },
        include: { unit: true },
      });

      // Jika sewa selesai atau dibatalkan, kembalikan status mesin ke TERSEDIA
      if (newRentalStatus === 'SELESAI' || newRentalStatus === 'DIBATALKAN') {
        await tx.molenUnit.update({
          where: { id: existing.unitId },
          data: { status: 'TERSEDIA' },
        });
      }

      // Jika ada pelunasan sisa tagihan sewa
      if (
        body.syncSettlement &&
        existing.paymentStatus !== 'LUNAS' &&
        newPaymentStatus === 'LUNAS'
      ) {
        const remainingAmount = Number(existing.totalPrice) - Number(existing.deposit);
        if (remainingAmount > 0) {
          const molenAccount = await tx.account.findFirst({
            where: { code: '4010' },
          });

          await tx.transaction.create({
            data: {
              type: 'PEMASUKAN',
              category: 'Pendapatan Sewa Mesin Molen',
              businessUnit: 'RENTAL_MOLEN',
              paymentMethod: 'TUNAI',
              accountId: molenAccount?.id || null,
              description: `Pelunasan Sewa Molen ${existing.unit.code} - ${existing.renterName}`,
              amount: remainingAmount,
              date: new Date(),
              createdById: session.user.id,
            },
          });
        }
      }

      return rental;
    });

    invalidateDashboardStatsCache();

    logActivity({
      userId: session.user.id,
      action: 'UPDATE_SEWA_MOLEN',
      targetType: 'MolenRental',
      targetId: id,
      detail: `Update sewa ${existing.rentalNumber} (Status Sewa: ${newRentalStatus}, Status Bayar: ${newPaymentStatus})`,
    }).catch(() => {});

    return NextResponse.json({ message: 'Status sewa berhasil diperbarui', data: updatedRental });
  } catch (error) {
    console.error('Error updating molen rental:', error);
    return NextResponse.json({ error: 'Gagal memperbarui data sewa molen' }, { status: 500 });
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
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'rental'; // 'rental' | 'unit'

    if (type === 'unit') {
      await prisma.molenUnit.delete({ where: { id } });
      return NextResponse.json({ message: 'Unit molen berhasil dihapus' });
    }

    const existing = await prisma.molenRental.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Data sewa tidak ditemukan' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.molenRental.delete({ where: { id } }),
      // Jika sewa aktif dihapus, kembalikan unit jadi TERSEDIA
      prisma.molenUnit.update({
        where: { id: existing.unitId },
        data: { status: 'TERSEDIA' },
      }),
    ]);

    await logActivity({
      userId: session.user.id,
      action: 'HAPUS_SEWA_MOLEN',
      targetType: 'MolenRental',
      targetId: id,
      detail: `Hapus sewa ${existing.rentalNumber}`,
    });

    return NextResponse.json({ message: 'Data sewa berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting molen record:', error);
    return NextResponse.json({ error: 'Gagal menghapus data molen' }, { status: 500 });
  }
}
