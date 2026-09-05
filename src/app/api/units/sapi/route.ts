import { NextRequest, NextResponse } from 'next/server';
import { Prisma, CattleStatus } from '@prisma/client';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { cattleExpenseSchema, cattleSaleSchema, cattleSchema } from '@/lib/validators';
import { logActivity } from '@/lib/activityLog';
import { invalidateDashboardStatsCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();

    const where: Prisma.CattleWhereInput = {};
    if (status && status !== 'ALL') where.status = status as CattleStatus;
    if (search) {
      where.OR = [
        { tagNumber: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { breed: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [cattleList, expenses, totalStats, expenseStats] = await Promise.all([
      prisma.cattle.findMany({
        where,
        orderBy: { purchaseDate: 'desc' },
        include: {
          expenses: {
            take: 5,
            orderBy: { date: 'desc' },
          },
        },
      }),
      prisma.cattleExpense.findMany({
        take: 30,
        orderBy: { date: 'desc' },
        include: {
          cattle: { select: { tagNumber: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.cattle.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { purchasePrice: true, salePrice: true },
      }),
      prisma.cattleExpense.aggregate({
        _sum: { amount: true },
      }),
    ]);

    let activeCount = 0;
    let fatteningCount = 0;
    let readyToSellCount = 0;
    let soldCount = 0;
    let totalInvested = 0;
    let totalSold = 0;

    for (const st of totalStats) {
      const count = st._count.id;
      const purchaseSum = Number(st._sum.purchasePrice || 0);
      const saleSum = Number(st._sum.salePrice || 0);

      if (st.status === 'PENGGEMUKAN') fatteningCount += count;
      if (st.status === 'SIAP_JUAL') readyToSellCount += count;
      if (st.status === 'TERJUAL') {
        soldCount += count;
        totalSold += saleSum;
      }
      if (st.status !== 'TERJUAL' && st.status !== 'MATI') {
        activeCount += count;
        totalInvested += purchaseSum;
      }
    }

    return NextResponse.json({
      cattle: cattleList,
      expenses,
      stats: {
        totalPopulation: activeCount,
        fatteningCount,
        readyToSellCount,
        soldCount,
        totalInvested,
        totalSold,
        totalExpenses: Number(expenseStats._sum.amount || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching cattle data:', error);
    return NextResponse.json({ error: 'Gagal memuat data peternakan sapi' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action || 'create_cattle';

    // 1. Tambah Sapi Baru
    if (action === 'create_cattle') {
      const parsed = cattleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data sapi tidak valid' },
          { status: 400 }
        );
      }

      const {
        tagNumber,
        name,
        breed,
        gender,
        status,
        purchaseDate,
        purchasePrice,
        initialWeight,
        currentWeight,
        notes,
        syncToTransaction,
      } = parsed.data;

      const duplicate = await prisma.cattle.findUnique({ where: { tagNumber } });
      if (duplicate) {
        return NextResponse.json({ error: `Nomor Eartag ${tagNumber} sudah terdaftar` }, { status: 400 });
      }

      const pDate = new Date(purchaseDate);

      const cattle = await prisma.cattle.create({
        data: {
          tagNumber,
          name: name || null,
          breed,
          gender,
          status,
          purchaseDate: pDate,
          purchasePrice,
          initialWeight,
          currentWeight,
          lastWeighedAt: pDate,
          notes: notes || null,
        },
      });

      // Jika syncToTransaction & purchasePrice > 0, catat pengeluaran kas modal sapi
      if (syncToTransaction && purchasePrice > 0) {
        const modalAccount = await prisma.account.findFirst({
          where: { code: '1203' }, // Aset Biologis Ternak Sapi
        });

        await prisma.transaction.create({
          data: {
            type: 'PENGELUARAN',
            category: 'Pembelian Bibit Sapi',
            businessUnit: 'KETAHANAN_PANGAN',
            paymentMethod: 'TUNAI',
            accountId: modalAccount?.id || null,
            description: `Beli bibit sapi ${tagNumber} (${breed} ${gender}) bobot ${initialWeight}kg`,
            amount: purchasePrice,
            date: pDate,
            createdById: session.user.id,
          },
        });
        invalidateDashboardStatsCache();
      }

      void logActivity({
        userId: session.user.id,
        action: 'TAMBAH_TERNAK_SAPI',
        targetType: 'Cattle',
        targetId: cattle.id,
        detail: `Tambah ternak sapi ${tagNumber} (${breed}) senilai Rp ${purchasePrice.toLocaleString('id-ID')}`,
      });

      return NextResponse.json(
        { message: 'Data sapi berhasil ditambahkan', data: cattle },
        { status: 201 }
      );
    }

    // 2. Tambah Biaya Operasional (Pakan / Obat / Kandang)
    if (action === 'add_expense') {
      const parsed = cattleExpenseSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data biaya tidak valid' },
          { status: 400 }
        );
      }

      const { cattleId, type, description, amount, date, syncToTransaction } = parsed.data;
      const expenseDate = new Date(date);

      const expense = await prisma.cattleExpense.create({
        data: {
          cattleId: cattleId || null,
          type,
          description,
          amount,
          date: expenseDate,
          createdById: session.user.id,
        },
        include: {
          cattle: { select: { tagNumber: true, name: true } },
        },
      });

      if (syncToTransaction) {
        // Map kode akun sesuai tipe biaya
        let code = '5041'; // default Pakan
        if (type === 'VAKSIN_OBAT') code = '5042';
        if (type === 'PERAWATAN_KANDANG' || type === 'UPAH_PEKERJA') code = '5043';

        const acc = await prisma.account.findFirst({ where: { code } });

        const targetDesc = expense.cattle ? ` (Sapi ${expense.cattle.tagNumber})` : ' (Kandang Umum)';
        await prisma.transaction.create({
          data: {
            type: 'PENGELUARAN',
            category: `Beban ${type.replace(/_/g, ' ')}`,
            businessUnit: 'KETAHANAN_PANGAN',
            paymentMethod: 'TUNAI',
            accountId: acc?.id || null,
            description: `${description}${targetDesc}`,
            amount,
            date: expenseDate,
            createdById: session.user.id,
          },
        });
        invalidateDashboardStatsCache();
      }

      void logActivity({
        userId: session.user.id,
        action: 'BIAYA_TERNAK_SAPI',
        targetType: 'CattleExpense',
        targetId: expense.id,
        detail: `Biaya ${type}: ${description} - Rp ${amount.toLocaleString('id-ID')}`,
      });

      return NextResponse.json(
        { message: 'Biaya operasional sapi berhasil dicatat', data: expense },
        { status: 201 }
      );
    }

    // 3. Jual Sapi
    if (action === 'sell_cattle') {
      const parsed = cattleSaleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data penjualan tidak valid' },
          { status: 400 }
        );
      }

      const { cattleId } = body;
      if (!cattleId) {
        return NextResponse.json({ error: 'Pilih sapi yang akan dijual' }, { status: 400 });
      }

      const cattle = await prisma.cattle.findUnique({ where: { id: cattleId } });
      if (!cattle) {
        return NextResponse.json({ error: 'Data sapi tidak ditemukan' }, { status: 404 });
      }

      const { saleDate, salePrice, buyerName, notes, syncToTransaction } = parsed.data;
      const sDate = new Date(saleDate);

      const [updatedCattle] = await prisma.$transaction(async (tx) => {
        const updated = await tx.cattle.update({
          where: { id: cattleId },
          data: {
            status: 'TERJUAL',
            saleDate: sDate,
            salePrice,
            buyerName,
            notes: notes ? `${cattle.notes ? cattle.notes + ' | ' : ''}${notes}` : cattle.notes,
          },
        });

        if (syncToTransaction) {
          const saleAccount = await tx.account.findFirst({
            where: { code: '4040' },
          });

          await tx.transaction.create({
            data: {
              type: 'PEMASUKAN',
              category: 'Pendapatan Penjualan Ternak Sapi',
              businessUnit: 'KETAHANAN_PANGAN',
              paymentMethod: 'TUNAI',
              accountId: saleAccount?.id || null,
              description: `Penjualan Sapi ${cattle.tagNumber} (${cattle.breed}) kepada ${buyerName}`,
              amount: salePrice,
              date: sDate,
              createdById: session.user.id,
            },
          });
        }

        return [updated];
      });

      if (syncToTransaction) {
        invalidateDashboardStatsCache();
      }

      void logActivity({
        userId: session.user.id,
        action: 'JUAL_TERNAK_SAPI',
        targetType: 'Cattle',
        targetId: cattle.id,
        detail: `Penjualan sapi ${cattle.tagNumber} seharga Rp ${salePrice.toLocaleString('id-ID')} kepada ${buyerName}`,
      });

      return NextResponse.json({
        message: 'Penjualan sapi berhasil dicatat',
        data: updatedCattle,
      });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (error) {
    console.error('Error in cattle operation:', error);
    return NextResponse.json({ error: 'Gagal memproses data ternak sapi' }, { status: 500 });
  }
}
