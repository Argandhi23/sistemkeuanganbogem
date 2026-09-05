import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { wifiPaymentSchema } from '@/lib/validators';
import { logActivity } from '@/lib/activityLog';
import { invalidateDashboardStatsCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = wifiPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data pembayaran tidak valid' },
        { status: 400 }
      );
    }

    const { billId, paidDate, paymentMethod, syncToTransaction } = parsed.data;

    const bill = await prisma.wifiBill.findUnique({
      where: { id: billId },
      include: { customer: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Tagihan tidak ditemukan' }, { status: 404 });
    }

    if (bill.status === 'LUNAS') {
      return NextResponse.json({ error: 'Tagihan ini sudah lunas sebelumnya' }, { status: 400 });
    }

    const paymentDateTime = paidDate ? new Date(paidDate) : new Date();

    const [updatedBill] = await prisma.$transaction(async (tx) => {
      const updated = await tx.wifiBill.update({
        where: { id: billId },
        data: {
          status: 'LUNAS',
          paidDate: paymentDateTime,
        },
      });

      if (syncToTransaction) {
        const wifiAccount = await tx.account.findFirst({
          where: { code: '4020' },
        });

        await tx.transaction.create({
          data: {
            type: 'PEMASUKAN',
            category: 'Pendapatan Iuran WiFi Balai Desa',
            businessUnit: 'WIFI_DESA',
            paymentMethod,
            accountId: wifiAccount?.id || null,
            description: `Iuran WiFi ${bill.customer.customerNumber} - ${bill.customer.name} (Bulan ${bill.month}/${bill.year})`,
            amount: bill.amount,
            date: paymentDateTime,
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
      action: 'BAYAR_TAGIHAN_WIFI',
      targetType: 'WifiBill',
      targetId: bill.id,
      detail: `Pembayaran iuran WiFi ${bill.customer.name} periode ${bill.month}/${bill.year} sebesar Rp ${Number(bill.amount).toLocaleString('id-ID')}`,
    });

    return NextResponse.json({
      message: 'Pembayaran iuran WiFi berhasil dicatat',
      data: updatedBill,
    });
  } catch (error) {
    console.error('Error paying wifi bill:', error);
    return NextResponse.json({ error: 'Gagal mencatat pembayaran tagihan WiFi' }, { status: 500 });
  }
}
