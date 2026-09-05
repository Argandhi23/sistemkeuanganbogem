import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { molenRentalSchema, molenUnitSchema } from '@/lib/validators';
import { logActivity } from '@/lib/activityLog';
import { invalidateDashboardStatsCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const [units, rentals, statsSummary] = await Promise.all([
      prisma.molenUnit.findMany({
        orderBy: { code: 'asc' },
        include: {
          rentals: {
            where: { rentalStatus: 'AKTIF' },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.molenRental.findMany({
        take: 30,
        orderBy: { createdAt: 'desc' },
        include: {
          unit: { select: { code: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.molenRental.aggregate({
        where: { rentalStatus: 'AKTIF' },
        _count: { id: true },
        _sum: { totalPrice: true },
      }),
    ]);

    return NextResponse.json({
      units,
      rentals,
      stats: {
        activeRentalsCount: statsSummary._count.id || 0,
        activeRentalsValue: Number(statsSummary._sum.totalPrice || 0),
        totalUnitsCount: units.length,
        availableUnitsCount: units.filter((u) => u.status === 'TERSEDIA').length,
      },
    });
  } catch (error) {
    console.error('Error fetching molen data:', error);
    return NextResponse.json({ error: 'Gagal memuat data sewa molen' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action || 'create_rental';

    if (action === 'create_unit') {
      const parsed = molenUnitSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data unit molen tidak valid' },
          { status: 400 }
        );
      }

      const unit = await prisma.molenUnit.create({
        data: parsed.data,
      });

      void logActivity({
        userId: session.user.id,
        action: 'TAMBAH_UNIT_MOLEN',
        targetType: 'MolenUnit',
        targetId: unit.id,
        detail: `Unit molen baru: ${unit.code} - ${unit.name}`,
      });

      return NextResponse.json(
        { message: 'Unit molen baru berhasil ditambahkan', data: unit },
        { status: 201 }
      );
    }

    // Default action: create_rental
    const parsed = molenRentalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data sewa molen tidak valid' },
        { status: 400 }
      );
    }

    const {
      unitId,
      renterName,
      renterPhone,
      renterAddress,
      startDate,
      endDate,
      totalDays,
      dailyRate,
      totalPrice,
      deposit,
      paymentStatus,
      rentalStatus,
      notes,
      syncToTransaction,
    } = parsed.data;

    // Generate Nomor Sewa: RNT-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const rentalNumber = `RNT-${dateStr}-${randomSuffix}`;

    // Buat rental & update status unit ke 'DISEWA'
    const [rental] = await prisma.$transaction([
      prisma.molenRental.create({
        data: {
          rentalNumber,
          unitId,
          renterName,
          renterPhone,
          renterAddress: renterAddress || null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          totalDays,
          dailyRate,
          totalPrice,
          deposit,
          paymentStatus,
          rentalStatus,
          notes: notes || null,
          createdById: session.user.id,
        },
        include: {
          unit: true,
        },
      }),
      prisma.molenUnit.update({
        where: { id: unitId },
        data: { status: 'DISEWA' },
      }),
    ]);

    // Jika ada pembayaran uang masuk (DP atau Pelunasan) & sync dicentang
    const cashIn = paymentStatus === 'LUNAS' ? totalPrice : deposit;
    if (syncToTransaction && cashIn > 0) {
      const molenAccount = await prisma.account.findFirst({
        where: { code: '4010' },
      });

      await prisma.transaction.create({
        data: {
          type: 'PEMASUKAN',
          category: 'Pendapatan Sewa Mesin Molen',
          businessUnit: 'RENTAL_MOLEN',
          paymentMethod: 'TUNAI',
          accountId: molenAccount?.id || null,
          description: `Penerimaan Sewa Molen ${rental.unit.code} - ${renterName} (${totalDays} hari)`,
          amount: cashIn,
          date: new Date(),
          createdById: session.user.id,
        },
      });
      invalidateDashboardStatsCache();
    }

    // Log activity in background without blocking response
    void logActivity({
      userId: session.user.id,
      action: 'TAMBAH_SEWA_MOLEN',
      targetType: 'MolenRental',
      targetId: rental.id,
      detail: `Sewa unit ${rental.unit.code} oleh ${renterName} selama ${totalDays} hari`,
    });

    return NextResponse.json(
      { message: 'Penyewaan molen berhasil dicatat', data: rental },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating molen record:', error);
    return NextResponse.json({ error: 'Gagal memproses data sewa molen' }, { status: 500 });
  }
}
