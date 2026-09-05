import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logActivity } from '@/lib/activityLog';

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

    const customer = await prisma.wifiCustomer.update({
      where: { id },
      data: {
        name: body.name,
        phone: body.phone,
        address: body.address,
        rtRw: body.rtRw,
        planId: body.planId,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
      },
      include: { plan: true },
    });

    void logActivity({
      userId: session.user.id,
      action: 'UPDATE_PELANGGAN_WIFI',
      targetType: 'WifiCustomer',
      targetId: id,
      detail: `Perbarui pelanggan ${customer.customerNumber} - ${customer.name}`,
    });

    return NextResponse.json({ message: 'Data pelanggan berhasil diperbarui', data: customer });
  } catch (error) {
    console.error('Error updating wifi customer:', error);
    return NextResponse.json({ error: 'Gagal memperbarui data pelanggan WiFi' }, { status: 500 });
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
    const existing = await prisma.wifiCustomer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    await prisma.wifiCustomer.delete({ where: { id } });

    void logActivity({
      userId: session.user.id,
      action: 'HAPUS_PELANGGAN_WIFI',
      targetType: 'WifiCustomer',
      targetId: id,
      detail: `Menghapus pelanggan WiFi ${existing.customerNumber} - ${existing.name}`,
    });

    return NextResponse.json({ message: 'Data pelanggan berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting wifi customer:', error);
    return NextResponse.json({ error: 'Gagal menghapus pelanggan WiFi' }, { status: 500 });
  }
}
