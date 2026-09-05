import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { wifiCustomerSchema, wifiPlanSchema } from '@/lib/validators';
import { logActivity } from '@/lib/activityLog';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const now = new Date();
    const currentMonth = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
    const currentYear = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);

    const where: Prisma.WifiCustomerWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { customerNumber: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { rtRw: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [plans, customers, billsThisMonth] = await Promise.all([
      prisma.wifiPlan.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' },
      }),
      prisma.wifiCustomer.findMany({
        where,
        orderBy: { customerNumber: 'asc' },
        include: {
          plan: true,
          bills: {
            where: { month: currentMonth, year: currentYear },
            take: 1,
          },
        },
      }),
      prisma.wifiBill.findMany({
        where: { month: currentMonth, year: currentYear },
        select: { status: true, amount: true },
      }),
    ]);

    let totalBilled = 0;
    let totalCollected = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    for (const b of billsThisMonth) {
      const amt = Number(b.amount);
      totalBilled += amt;
      if (b.status === 'LUNAS') {
        totalCollected += amt;
        paidCount++;
      } else {
        unpaidCount++;
      }
    }

    return NextResponse.json({
      plans,
      customers,
      period: { month: currentMonth, year: currentYear },
      stats: {
        totalCustomers: customers.length,
        activeCustomers: customers.filter((c) => c.isActive).length,
        totalBilled,
        totalCollected,
        paidCount,
        unpaidCount,
      },
    });
  } catch (error) {
    console.error('Error fetching wifi data:', error);
    return NextResponse.json({ error: 'Gagal memuat data WiFi balai desa' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action || 'create_customer';

    if (action === 'create_plan') {
      const parsed = wifiPlanSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Data paket WiFi tidak valid' },
          { status: 400 }
        );
      }
      const plan = await prisma.wifiPlan.create({ data: parsed.data });
      return NextResponse.json({ message: 'Paket WiFi berhasil dibuat', data: plan }, { status: 201 });
    }

    if (action === 'generate_bills') {
      const now = new Date();
      const month = body.month ? parseInt(body.month, 10) : now.getMonth() + 1;
      const year = body.year ? parseInt(body.year, 10) : now.getFullYear();

      // Ambil seluruh pelanggan aktif
      const activeCustomers = await prisma.wifiCustomer.findMany({
        where: { isActive: true },
        include: { plan: true },
      });

      let createdCount = 0;
      for (const cust of activeCustomers) {
        // Cek apakah tagihan bulan ini sudah ada
        const existing = await prisma.wifiBill.findUnique({
          where: {
            customerId_month_year: {
              customerId: cust.id,
              month,
              year,
            },
          },
        });

        if (!existing) {
          const billNo = `INV-WF-${year}${String(month).padStart(2, '0')}-${cust.customerNumber}`;
          const dueDate = new Date(year, month - 1, 20); // Jatuh tempo tanggal 20 setiap bulan

          await prisma.wifiBill.create({
            data: {
              billNumber: billNo,
              customerId: cust.id,
              month,
              year,
              amount: cust.plan.price,
              dueDate,
              status: 'BELUM_BAYAR',
            },
          });
          createdCount++;
        }
      }

      void logActivity({
        userId: session.user.id,
        action: 'GENERATE_TAGIHAN_WIFI',
        targetType: 'WifiBill',
        targetId: `${month}-${year}`,
        detail: `Generate ${createdCount} tagihan WiFi periode ${month}/${year}`,
      });

      return NextResponse.json({
        message: `Berhasil menerbitkan ${createdCount} tagihan WiFi untuk periode ${month}/${year}`,
        count: createdCount,
      });
    }

    // Default: create_customer
    const parsed = wifiCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data pelanggan WiFi tidak valid' },
        { status: 400 }
      );
    }

    const { customerNumber, name, phone, address, rtRw, planId, isActive, installationDate } =
      parsed.data;

    // Cek duplikasi nomor pelanggan
    const duplicate = await prisma.wifiCustomer.findUnique({
      where: { customerNumber },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `Nomor pelanggan ${customerNumber} sudah digunakan` },
        { status: 400 }
      );
    }

    const customer = await prisma.wifiCustomer.create({
      data: {
        customerNumber,
        name,
        phone,
        address,
        rtRw: rtRw || null,
        planId,
        isActive,
        installationDate: installationDate ? new Date(installationDate) : new Date(),
      },
      include: { plan: true },
    });

    // Otomatis terbitkan tagihan bulan berjalan untuk pelanggan baru
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const billNumber = `INV-WF-${currentYear}${String(currentMonth).padStart(2, '0')}-${customer.customerNumber}`;

    await prisma.wifiBill.create({
      data: {
        billNumber,
        customerId: customer.id,
        month: currentMonth,
        year: currentYear,
        amount: customer.plan.price,
        dueDate: new Date(currentYear, currentMonth - 1, 20),
        status: 'BELUM_BAYAR',
      },
    });

    void logActivity({
      userId: session.user.id,
      action: 'TAMBAH_PELANGGAN_WIFI',
      targetType: 'WifiCustomer',
      targetId: customer.id,
      detail: `Pelanggan baru: ${customer.customerNumber} - ${customer.name} (Paket ${customer.plan.name})`,
    });

    return NextResponse.json(
      { message: 'Pelanggan WiFi berhasil didaftarkan', data: customer },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating wifi customer:', error);
    return NextResponse.json({ error: 'Gagal memproses data pelanggan WiFi' }, { status: 500 });
  }
}
