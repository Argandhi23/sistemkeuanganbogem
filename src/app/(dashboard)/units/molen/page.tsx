import React from 'react';
import UnitCashLedger from '@/components/units/UnitCashLedger';
import { Hammer } from 'lucide-react';

export default function MolenUnitPage() {
  return (
    <UnitCashLedger
      unit="RENTAL_MOLEN"
      title="Sewa Molen"
      subtitle="Pencatatan kas masuk dan kas keluar unit Sewa Molen"
      category="Alat Konstruksi"
      icon={<Hammer className="w-5 h-5 text-orange-600" />}
      badgeColor="bg-orange-50 text-orange-800 border-orange-200"
    />
  );
}
