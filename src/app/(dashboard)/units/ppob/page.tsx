import React from 'react';
import UnitCashLedger from '@/components/units/UnitCashLedger';
import { Smartphone } from 'lucide-react';

export default function PpobUnitPage() {
  return (
    <UnitCashLedger
      unit="PPOB"
      title="Unit Usaha PPOB Loket Desa"
      subtitle="Buku kas loket pembayaran online desa: penerimaan fee admin tagihan listrik PLN, pulsa, BPJS, PDAM, dan operasional loket"
      category="Pembayaran Online"
      icon={<Smartphone className="w-5 h-5 text-emerald-600" />}
      badgeColor="bg-emerald-50 text-emerald-800 border-emerald-200"
    />
  );
}
