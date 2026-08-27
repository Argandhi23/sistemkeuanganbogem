import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { transactionSchema } from '@/lib/validators';
import { updateTransactionRow, clearTransactionRow } from '@/lib/googleSheets';
import { logActivity } from '@/lib/activityLog';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        account: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Data transaksi tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ data: transaction });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data transaksi' },
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

    const existing = await prisma.transaction.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Data transaksi tidak ditemukan' }, { status: 404 });
    }

    // RBAC: User hanya boleh mengedit transaksi buatannya sendiri
    if (session.user.role !== 'ADMIN' && existing.createdById !== session.user.id) {
      return NextResponse.json(
        { error: 'Anda hanya diperbolehkan mengedit transaksi yang Anda input sendiri' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = transactionSchema.safeParse(body);

    if (!parsed.success) {
      const errorMessage = parsed.error.issues[0]?.message || 'Data tidak valid';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { type, accountId, description, amount, date } = parsed.data;
    let { category } = parsed.data;

    if (accountId) {
      const acc = await prisma.account.findUnique({ where: { id: accountId } });
      if (acc) {
        category = acc.name;
      }
    }

    // 1. Update Database
    const updated = await prisma.transaction.update({
      where: { id: params.id },
      data: {
        type,
        category,
        accountId: accountId || null,
        description,
        amount,
        date: new Date(date),
      },
      include: {
        account: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    // 2. Audit Trail (non-blocking)
    logActivity({
      userId: session.user.id,
      action: 'UPDATE_TRANSACTION',
      targetType: 'Transaction',
      targetId: updated.id,
      detail: `Edit transaksi ${updated.type}: ${updated.category} - Rp ${Number(amount).toLocaleString('id-ID')}`,
    }).catch((err) => console.warn('Activity log error:', err));

    // 3. Update Google Sheets di latar belakang jika ada sheetRowId
    if (updated.sheetRowId) {
      (async () => {
        try {
          await updateTransactionRow(
            updated.sheetRowId,
            {
              id: updated.id,
              type: updated.type,
              category: updated.category,
              description: updated.description,
              amount: Number(updated.amount),
              date: updated.date,
            },
            session.user.name || 'Petugas'
          );
        } catch (syncError) {
          console.warn('Gagal sinkronisasi update ke Google Sheets:', syncError);
        }
      })();
    }

    return NextResponse.json({
      message: 'Transaksi berhasil diperbarui',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui transaksi' },
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

    const existing = await prisma.transaction.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Data transaksi tidak ditemukan' }, { status: 404 });
    }

    // RBAC: Admin dapat menghapus data apapun; Petugas hanya data buatannya sendiri
    if (session.user.role !== 'ADMIN' && existing.createdById !== session.user.id) {
      return NextResponse.json(
        { error: 'Anda hanya diperbolehkan menghapus transaksi yang Anda input sendiri atau hubungi Administrator' },
        { status: 403 }
      );
    }

    // 1. Hapus dari Database terlebih dahulu
    await prisma.transaction.delete({
      where: { id: params.id },
    });

    // 2. Audit Trail (non-blocking)
    logActivity({
      userId: session.user.id,
      action: 'DELETE_TRANSACTION',
      targetType: 'Transaction',
      targetId: existing.id,
      detail: `Hapus transaksi: ${existing.category} - Rp ${Number(existing.amount).toLocaleString('id-ID')} (${existing.description})`,
    }).catch((err) => console.warn('Activity log error:', err));

    // 3. Hapus baris secara fisik dari Google Sheets di latar belakang
    (async () => {
      try {
        await clearTransactionRow(existing.sheetRowId, existing.id);
      } catch (sheetError) {
        console.warn('Gagal menghapus baris di Google Sheets:', sheetError);
      }
    })();

    return NextResponse.json({
      message: 'Data transaksi berhasil dihapus',
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus data transaksi' },
      { status: 500 }
    );
  }
}
