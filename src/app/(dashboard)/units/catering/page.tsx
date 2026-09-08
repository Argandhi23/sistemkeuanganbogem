import React from 'react';
import UnitCashLedger from '@/components/units/UnitCashLedger';
import { UtensilsCrossed } from 'lucide-react';

export default function CateringUnitPage() {
  return (
    <UnitCashLedger
      unit="CATERING"
      title="Catering Desa"
      subtitle="Pencatatan kas masuk dan kas keluar unit Catering Desa"
      category="Konsumsi & Nasi Box"
      icon={<UtensilsCrossed className="w-5 h-5 text-amber-600" />}
      badgeColor="bg-amber-50 text-amber-800 border-amber-200"
    />
  );
}
