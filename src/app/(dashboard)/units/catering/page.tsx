import React from 'react';
import UnitCashLedger from '@/components/units/UnitCashLedger';
import { UtensilsCrossed } from 'lucide-react';

export default function CateringUnitPage() {
  return (
    <UnitCashLedger
      unit="CATERING"
      title="Unit Usaha Catering Desa"
      subtitle="Buku kas operasional katering: penerimaan pesanan nasi box, prasmanan acara, belanja bahan masak, dan operasional dapur"
      category="Konsumsi & Nasi Box"
      icon={<UtensilsCrossed className="w-5 h-5 text-amber-600" />}
      badgeColor="bg-amber-50 text-amber-800 border-amber-200"
    />
  );
}
