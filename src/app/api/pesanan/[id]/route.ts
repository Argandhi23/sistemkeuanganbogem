import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { cateringOrderSchema } from '@/lib/validators';
import { updateOrderRow, clearOrderRow } from '@/lib/googleSheets';
import { logActivity } from '@/lib/activityLog';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const order = await prisma.cateringOrder.findUnique({
      where: { id: params.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ data: order });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memuat data pesanan' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const existing = await prisma.cateringOrder.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Data pesanan tidak ditemukan' }, { status: 404 });
    }

    // RBAC: User hanya boleh mengedit pesanan miliknya sendiri
    if (session.user.role !== 'ADMIN' && existing.createdById !== session.user.id) {
      return NextResponse.json(
        { error: 'Anda hanya diperbolehkan mengedit pesanan yang Anda input sendiri' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = cateringOrderSchema.safeParse(body);

    if (!parsed.success) {
      const errorMessage = parsed.error.issues[0]?.message || 'Data tidak valid';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { customerName, customerPhone, eventDate, menuDetail, portion, totalPrice, status, notes } =
      parsed.data;

    // 1. Update Database
    const updated = await prisma.cateringOrder.update({
      where: { id: params.id },
      data: {
        customerName,
        customerPhone: customerPhone || null,
        eventDate: new Date(eventDate),
        menuDetail,
        portion,
        totalPrice,
        status,
        notes: notes || null,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    // 2. Audit Trail (non-blocking)
    logActivity({
      userId: session.user.id,
      action: 'UPDATE_ORDER',
      targetType: 'CateringOrder',
      targetId: updated.id,
      detail: `Ubah pesanan: ${customerName} (Status: ${status}, Total: Rp ${Number(totalPrice).toLocaleString('id-ID')})`,
    }).catch((err) => console.warn('Activity log error:', err));

    // 3. Update di Google Sheets di latar belakang
    if (updated.sheetRowId) {
      (async () => {
        try {
          await updateOrderRow(
            updated.sheetRowId,
            {
              id: updated.id,
              customerName: updated.customerName,
              customerPhone: updated.customerPhone,
              eventDate: updated.eventDate,
              menuDetail: updated.menuDetail,
              portion: updated.portion,
              totalPrice: Number(updated.totalPrice),
              status: updated.status,
              createdAt: updated.createdAt,
            },
            session.user.name || 'Petugas'
          );
        } catch (syncError) {
          console.warn('Gagal sinkronisasi update pesanan ke Google Sheets:', syncError);
        }
      })();
    }

    return NextResponse.json({
      message: 'Pesanan catering berhasil diperbarui',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui pesanan' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    // RBAC: Hanya ADMIN yang boleh menghapus data
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Hanya Administrator yang memiliki akses untuk menghapus data' },
        { status: 403 }
      );
    }

    const existing = await prisma.cateringOrder.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Data pesanan tidak ditemukan' }, { status: 404 });
    }

    // 1. Hapus dari Database terlebih dahulu
    await prisma.cateringOrder.delete({
      where: { id: params.id },
    });

    // 2. Audit Trail (non-blocking)
    logActivity({
      userId: session.user.id,
      action: 'DELETE_ORDER',
      targetType: 'CateringOrder',
      targetId: existing.id,
      detail: `Hapus pesanan catering: ${existing.customerName} - Rp ${Number(existing.totalPrice).toLocaleString('id-ID')}`,
    }).catch((err) => console.warn('Activity log error:', err));

    // 3. Clear di Google Sheets di latar belakang
    if (existing.sheetRowId) {
      (async () => {
        try {
          await clearOrderRow(existing.sheetRowId, existing.id);
        } catch (sheetError) {
          console.warn('Gagal clear baris pesanan di Google Sheets:', sheetError);
        }
      })();
    }

    return NextResponse.json({
      message: 'Data pesanan catering berhasil dihapus',
    });
  } catch (error) {
    console.error('Error deleting catering order:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus pesanan catering' },
      { status: 500 }
    );
  }
}
