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

    const existing = await prisma.cattle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Data sapi tidak ditemukan' }, { status: 404 });
    }

    const updated = await prisma.cattle.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name : existing.name,
        breed: body.breed !== undefined ? body.breed : existing.breed,
        gender: body.gender !== undefined ? body.gender : existing.gender,
        status: body.status !== undefined ? body.status : existing.status,
        currentWeight: body.currentWeight !== undefined ? Number(body.currentWeight) : existing.currentWeight,
        lastWeighedAt: body.lastWeighedAt ? new Date(body.lastWeighedAt) : existing.lastWeighedAt,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
    });

    void logActivity({
      userId: session.user.id,
      action: 'UPDATE_TERNAK_SAPI',
      targetType: 'Cattle',
      targetId: id,
      detail: `Perbarui data sapi ${existing.tagNumber} (Bobot: ${updated.currentWeight}kg, Status: ${updated.status})`,
    });

    return NextResponse.json({ message: 'Data sapi berhasil diperbarui', data: updated });
  } catch (error) {
    console.error('Error updating cattle:', error);
    return NextResponse.json({ error: 'Gagal memperbarui data sapi' }, { status: 500 });
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
    const existing = await prisma.cattle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Data sapi tidak ditemukan' }, { status: 404 });
    }

    await prisma.cattle.delete({ where: { id } });

    void logActivity({
      userId: session.user.id,
      action: 'HAPUS_TERNAK_SAPI',
      targetType: 'Cattle',
      targetId: id,
      detail: `Menghapus sapi ${existing.tagNumber}`,
    });

    return NextResponse.json({ message: 'Data sapi berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting cattle:', error);
    return NextResponse.json({ error: 'Gagal menghapus data sapi' }, { status: 500 });
  }
}
