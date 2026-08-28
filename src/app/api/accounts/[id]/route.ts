import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import { invalidateAccountsCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const accountUpdateSchema = z.object({
  code: z.string().min(3, 'Kode akun minimal 3 digit').max(10, 'Kode akun maksimal 10 digit').optional(),
  name: z.string().min(3, 'Nama akun minimal 3 karakter').optional(),
  category: z
    .enum([
      'PENDAPATAN',
      'BEBAN_OPERASIONAL',
      'BEBAN_NON_OPERASIONAL',
      'ASET',
      'KEWAJIBAN',
      'MODAL',
    ])
    .optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Akses khusus Administrator' }, { status: 403 });
    }

    const existing = await prisma.account.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Akun keuangan tidak ditemukan' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = accountUpdateSchema.safeParse(body);

    if (!parsed.success) {
      const errorMessage = parsed.error.issues[0]?.message || 'Data tidak valid';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { code, name, category, isActive } = parsed.data;

    if (code && code !== existing.code) {
      const codeTaken = await prisma.account.findUnique({
        where: { code },
      });
      if (codeTaken) {
        return NextResponse.json(
          { error: `Kode akun ${code} sudah digunakan oleh pos lain (${codeTaken.name})` },
          { status: 400 }
        );
      }
    }

    const updateData: Prisma.AccountUpdateInput = {};
    if (code) updateData.code = code;
    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const updated = await prisma.account.update({
      where: { id: params.id },
      data: updateData,
    });

    // Invalidate cache
    invalidateAccountsCache();

    await logActivity({
      userId: session.user.id,
      action: 'UPDATE_ACCOUNT',
      targetType: 'Account',
      targetId: updated.id,
      detail: `Perbarui kode akun [${updated.code}] ${updated.name} (${updated.category})`,
    });

    return NextResponse.json({
      message: 'Kode akun keuangan berhasil diperbarui',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui akun keuangan' },
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

    const existing = await prisma.account.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Akun keuangan tidak ditemukan' }, { status: 404 });
    }

    // Jika sudah ada transaksi terkait, nonaktifkan (isActive = false) demi integritas data laporan & audit trail
    if (existing._count.transactions > 0) {
      await prisma.account.update({
        where: { id: params.id },
        data: { isActive: false },
      });

      await logActivity({
        userId: session.user.id,
        action: 'UPDATE_ACCOUNT',
        targetType: 'Account',
        targetId: existing.id,
        detail: `Menonaktifkan kode akun [${existing.code}] ${existing.name} (karena memiliki ${existing._count.transactions} riwayat transaksi)`,
      });

      invalidateAccountsCache();

      return NextResponse.json({
        message: `Akun dinonaktifkan karena memiliki ${existing._count.transactions} riwayat transaksi terkait`,
      });
    }

    await prisma.account.delete({
      where: { id: params.id },
    });

    await logActivity({
      userId: session.user.id,
      action: 'DELETE_ACCOUNT',
      targetType: 'Account',
      targetId: existing.id,
      detail: `Hapus kode akun [${existing.code}] ${existing.name}`,
    });

    invalidateAccountsCache();

    return NextResponse.json({
      message: 'Kode akun keuangan berhasil dihapus',
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus akun keuangan' },
      { status: 500 }
    );
  }
}
