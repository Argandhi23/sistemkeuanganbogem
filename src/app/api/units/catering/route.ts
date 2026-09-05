import { NextRequest, NextResponse } from 'next/server';
import { Prisma, OrderStatus, PaymentStatus } from '@prisma/client';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { cateringOrderSchema } from '@/lib/validators';
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
    const paymentStatus = searchParams.get('paymentStatus');
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.CateringOrderWhereInput = {};
    if (status && status !== 'ALL') where.status = status as OrderStatus;
    if (paymentStatus && paymentStatus !== 'ALL') where.paymentStatus = paymentStatus as PaymentStatus;
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { menuDetail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, totalCount, statsSummary] = await Promise.all([
      prisma.cateringOrder.findMany({
        where,
        orderBy: { eventDate: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.cateringOrder.count({ where }),
      prisma.cateringOrder.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { totalPrice: true },
      }),
    ]);

    return NextResponse.json({
      data: orders,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: statsSummary,
    });
  } catch (error) {
    console.error('Error fetching catering orders:', error);
    return NextResponse.json({ error: 'Gagal memuat data pesanan catering' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = cateringOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data tidak valid' },
        { status: 400 }
      );
    }

    const {
      customerName,
      customerPhone,
      eventDate,
      menuDetail,
      portion,
      totalPrice,
      downPayment,
      paymentStatus,
      status,
      notes,
      syncToTransaction,
    } = parsed.data;

    // 1. Simpan Pesanan Catering
    const order = await prisma.cateringOrder.create({
      data: {
        customerName,
        customerPhone: customerPhone || null,
        eventDate: new Date(eventDate),
        menuDetail,
        portion,
        totalPrice,
        downPayment,
        paymentStatus,
        status,
        notes: notes || null,
        createdById: session.user.id,
      },
    });

    // 2. Jika ada uang masuk (DP atau Pelunasan) & syncToTransaction dicentang, buat transaksi di Buku Kas
    const cashInAmount = paymentStatus === 'LUNAS' ? totalPrice : downPayment;
    if (syncToTransaction && cashInAmount > 0) {
      const cateringAccount = await prisma.account.findFirst({
        where: { code: '4001' },
      });

      await prisma.transaction.create({
        data: {
          type: 'PEMASUKAN',
          category: 'Pendapatan Catering',
          businessUnit: 'CATERING',
          paymentMethod: 'TUNAI',
          accountId: cateringAccount?.id || null,
          description: `Penerimaan ${paymentStatus === 'LUNAS' ? 'Pelunasan' : 'Uang Muka (DP)'} Catering: ${customerName} (${portion} porsi)`,
          amount: cashInAmount,
          date: new Date(),
          createdById: session.user.id,
        },
      });
      invalidateDashboardStatsCache();
    }

    await logActivity({
      userId: session.user.id,
      action: 'TAMBAH_PESANAN_CATERING',
      targetType: 'CateringOrder',
      targetId: order.id,
      detail: `Pesanan catering ${customerName} senilai Rp ${totalPrice.toLocaleString('id-ID')}`,
    });

    return NextResponse.json(
      { message: 'Pesanan catering berhasil disimpan', data: order },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating catering order:', error);
    return NextResponse.json({ error: 'Gagal menyimpan pesanan catering' }, { status: 500 });
  }
}
