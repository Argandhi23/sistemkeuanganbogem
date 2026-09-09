import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

import {
  getIncomeStatement,
  getCashFlowSummary,
  getBalanceSheet,
  getGeneralLedger,
} from '../src/lib/accounting';
import { AccountCategory, BusinessUnit, TransactionType } from '@prisma/client';

async function main() {
  const txCount = await prisma.transaction.count();
  const accounts = await prisma.account.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, category: true, businessUnit: true, isActive: true },
  });
  console.log(`=== BUMDES BOGEM ACCOUNTS (${accounts.length}) ===`);
  console.log(`Total Transaksi: ${txCount}`);
}

main().finally(() => prisma.$disconnect());

