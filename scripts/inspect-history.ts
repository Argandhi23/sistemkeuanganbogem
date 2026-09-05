import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, category: true, businessUnit: true },
  });
  console.log(`=== ACCOUNTS (${accounts.length}) ===`);
  accounts.forEach((a) => {
    console.log(`${a.code} | ${a.name} | ${a.category} | ${a.businessUnit}`);
  });

  const txByUnit = await prisma.transaction.groupBy({
    by: ['businessUnit'],
    _count: { id: true },
    _sum: { amount: true },
  });
  console.log('\n=== TRANSACTIONS BY UNIT ===');
  console.log(txByUnit);

  const sampleTx = await prisma.transaction.findMany({
    take: 10,
    orderBy: { date: 'asc' },
    select: {
      id: true,
      date: true,
      type: true,
      category: true,
      description: true,
      amount: true,
      businessUnit: true,
      account: { select: { code: true, name: true } },
    },
  });
  console.log('\n=== SAMPLE TRANSACTIONS (Earliest 10) ===');
  sampleTx.forEach((tx) => {
    const d = tx.date.toISOString().split('T')[0];
    console.log(
      `${d} | ${tx.type} | ${tx.businessUnit} | Rp ${Number(tx.amount).toLocaleString('id-ID')} | Akun: ${tx.account?.code || '-'} ${tx.account?.name || '-'} | Ket: ${tx.description}`
    );
  });

  const byAcc = await prisma.transaction.groupBy({
    by: ['accountId'],
    where: { businessUnit: 'UMUM' },
    _count: { id: true },
    _sum: { amount: true },
  });
  const allAccs = await prisma.account.findMany();
  const accMap = new Map(allAccs.map((a) => [a.id, a]));
  console.log('\n=== RINCIAN 249 TRANSAKSI UMUM BERDASARKAN AKUN ===');
  for (const b of byAcc) {
    const acc = b.accountId ? accMap.get(b.accountId) : null;
    const code = acc?.code || 'NO_ACC';
    const name = acc?.name || 'Tanpa Akun';
    const unit = acc?.businessUnit || 'NONE';
    const count = b._count.id;
    const sum = Number(b._sum.amount).toLocaleString('id-ID');
    console.log(`${code} | ${name} (Unit Akun: ${unit}) : ${count} transaksi, Total: Rp ${sum}`);
  }
}

main().finally(() => prisma.$disconnect());
