import React from 'react';
import UnitCashLedger from '@/components/units/UnitCashLedger';
import { Smartphone } from 'lucide-react';

export default function PpobUnitPage() {
  return (
    <UnitCashLedger
      unit="PPOB"
      title="PPOB"
      subtitle="Pencatatan kas masuk dan kas keluar unit PPOB"
      category="Pembayaran Online"
      icon={<Smartphone className="w-5 h-5 text-emerald-600" />}
      badgeColor="bg-emerald-50 text-emerald-800 border-emerald-200"
    />
  );
}
