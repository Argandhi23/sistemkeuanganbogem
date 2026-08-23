import { NextRequest, NextResponse } from 'next/server';
import { Prisma, OrderStatus } from '@prisma/client';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { cateringOrderSchema } from '@/lib/validators';
import { appendOrderRow } from '@/lib/googleSheets';
import { logActivity } from '@/lib/activityLog';

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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const all = searchParams.get('all') === 'true';

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.CateringOrderWhereInput = {};

    if (status && ['PENDING', 'DIPROSES', 'SELESAI', 'DIBATALKAN'].includes(status)) {
      where.status = status as OrderStatus;
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { menuDetail: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      where.eventDate = {};
      if (startDate) {
        where.eventDate.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.eventDate.lte = end;
      }
    }

    const [orders, totalCount] = await Promise.all([
      prisma.cateringOrder.findMany({
        where,
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          eventDate: true,
          menuDetail: true,
          portion: true,
          totalPrice: true,
          status: true,
          notes: true,
          createdById: true,
          syncedToSheet: true,
          createdAt: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { eventDate: 'asc' },
        ...(all ? {} : { skip, take: limit }),
      }),
      prisma.cateringOrder.count({ where }),
    ]);

    const totalPages = all ? 1 : Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: orders,
      pagination: {
        total: totalCount,
        page: all ? 1 : page,
        limit: all ? totalCount : limit,
        totalPages,
        hasNext: all ? false : page < totalPages,
        hasPrev: all ? false : page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching catering orders:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memuat data pesanan catering' },
      { status: 500 }
    );
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
      const errorMessage = parsed.error.issues[0]?.message || 'Data tidak valid';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { customerName, customerPhone, eventDate, menuDetail, portion, totalPrice, status, notes } =
      parsed.data;

    // 1. Simpan ke Database
    const order = await prisma.cateringOrder.create({
      data: {
        customerName,
        customerPhone: customerPhone || null,
        eventDate: new Date(eventDate),
        menuDetail,
        portion,
        totalPrice,
        status,
        notes: notes || null,
        createdById: session.user.id,
        syncedToSheet: false,
      },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        eventDate: true,
        menuDetail: true,
        portion: true,
        totalPrice: true,
        status: true,
        notes: true,
        syncedToSheet: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    // 2. Audit Trail (non-blocking)
    logActivity({
      userId: session.user.id,
      action: 'CREATE_ORDER',
      targetType: 'CateringOrder',
      targetId: order.id,
      detail: `Catat pesanan catering: ${customerName} - ${portion} Porsi (Rp ${Number(totalPrice).toLocaleString('id-ID')})`,
    }).catch((err) => console.warn('Activity log error:', err));

    // 3. Background Sync ke Google Sheets (fire-and-forget, tidak memblokir respon ke user)
    (async () => {
      try {
        const sheetResult = await appendOrderRow(
          {
            id: order.id,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            eventDate: order.eventDate,
            menuDetail: order.menuDetail,
            portion: order.portion,
            totalPrice: Number(order.totalPrice),
            status: order.status,
            createdAt: new Date(),
          },
          session.user.name || 'Petugas'
        );

        if (sheetResult.success) {
          await prisma.cateringOrder.update({
            where: { id: order.id },
            data: {
              syncedToSheet: true,
              sheetRowId: sheetResult.sheetRowId || null,
            },
          });
        }
      } catch (syncError) {
        console.warn('Background sync catering order to Google Sheets failed:', syncError);
      }
    })();

    return NextResponse.json(
      {
        message: 'Data pesanan catering berhasil disimpan',
        data: order,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating catering order:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan pesanan catering' },
      { status: 500 }
    );
  }
}
