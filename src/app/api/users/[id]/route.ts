import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { userUpdateSchema } from '@/lib/validators';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/activityLog';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Akses khusus Administrator' }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = userUpdateSchema.safeParse(body);

    if (!parsed.success) {
      const errorMessage = parsed.error.issues[0]?.message || 'Data tidak valid';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { name, email, password, role, isActive } = parsed.data;

    if (session.user.id === params.id && isActive === false) {
      return NextResponse.json(
        { error: 'Anda tidak dapat menonaktifkan akun Anda sendiri' },
        { status: 400 }
      );
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();
    if (role) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: 'UPDATE_USER',
      targetType: 'User',
      targetId: updatedUser.id,
      detail: `Perbarui data akun user: ${updatedUser.name} (${updatedUser.email})`,
    });

    return NextResponse.json({
      message: 'Data pengguna berhasil diperbarui',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui data pengguna' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Akses khusus Administrator' }, { status: 403 });
    }

    if (session.user.id === params.id) {
      return NextResponse.json(
        { error: 'Anda tidak dapat menghapus akun Anda sendiri' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { transactions: true, orders: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    // Jika user sudah punya transaksi / pesanan, nonaktifkan saja untuk menjaga integritas data & audit trail
    if (existing._count.transactions > 0 || existing._count.orders > 0) {
      await prisma.user.update({
        where: { id: params.id },
        data: { isActive: false },
      });

      await logActivity({
        userId: session.user.id,
        action: 'UPDATE_USER',
        targetType: 'User',
        targetId: existing.id,
        detail: `Menonaktifkan akun user ${existing.name} (karena memiliki riwayat transaksi/pesanan)`,
      });

      return NextResponse.json({
        message: 'Pengguna dinonaktifkan (karena memiliki riwayat pembukuan/pesanan tersimpan)',
      });
    }

    await prisma.user.delete({
      where: { id: params.id },
    });

    await logActivity({
      userId: session.user.id,
      action: 'DELETE_USER',
      targetType: 'User',
      targetId: existing.id,
      detail: `Hapus akun pengguna ${existing.name} (${existing.email})`,
    });

    return NextResponse.json({
      message: 'Pengguna berhasil dihapus',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus pengguna' },
      { status: 500 }
    );
  }
}
