import React from 'react';
import UnitCashLedger from '@/components/units/UnitCashLedger';
import { Sprout } from 'lucide-react';

export default function SapiUnitPage() {
  return (
    <UnitCashLedger
      unit="KETAHANAN_PANGAN"
      title="Peternakan Sapi"
      subtitle="Pencatatan kas masuk dan kas keluar program Ketahanan Pangan"
      category="Ketahanan Pangan"
      icon={<Sprout className="w-5 h-5 text-emerald-800" />}
      badgeColor="bg-green-50 text-green-900 border-green-200"
    />
  );
}
