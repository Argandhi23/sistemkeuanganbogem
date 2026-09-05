import React from 'react';
import UnitCashLedger from '@/components/units/UnitCashLedger';
import { Sprout } from 'lucide-react';

export default function SapiUnitPage() {
  return (
    <UnitCashLedger
      unit="KETAHANAN_PANGAN"
      title="Unit Usaha Peternakan Sapi"
      subtitle="Buku kas program ketahanan pangan: penjualan ternak sapi, pembelian bibit bakalan, konsentrat pakan, vaksin, dan upah kandang"
      category="Ketahanan Pangan"
      icon={<Sprout className="w-5 h-5 text-emerald-800" />}
      badgeColor="bg-green-50 text-green-900 border-green-200"
    />
  );
}
