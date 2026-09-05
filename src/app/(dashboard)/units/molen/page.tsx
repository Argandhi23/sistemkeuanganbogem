import React from 'react';
import UnitCashLedger from '@/components/units/UnitCashLedger';
import { Hammer } from 'lucide-react';

export default function MolenUnitPage() {
  return (
    <UnitCashLedger
      unit="RENTAL_MOLEN"
      title="Unit Usaha Sewa Mesin Molen"
      subtitle="Buku kas persewaan mesin molen cor: penerimaan uang sewa alat, biaya solar mesin, oli, dan servis pemeliharaan"
      category="Alat Konstruksi"
      icon={<Hammer className="w-5 h-5 text-orange-600" />}
      badgeColor="bg-orange-50 text-orange-800 border-orange-200"
    />
  );
}
