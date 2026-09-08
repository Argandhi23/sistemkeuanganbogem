import React from 'react';
import UnitCashLedger from '@/components/units/UnitCashLedger';
import { Wifi } from 'lucide-react';

export default function WifiUnitPage() {
  return (
    <UnitCashLedger
      unit="WIFI_DESA"
      title="WiFi Balai Desa"
      subtitle="Pencatatan kas masuk dan kas keluar unit WiFi Balai Desa"
      category="Layanan Internet"
      icon={<Wifi className="w-5 h-5 text-blue-600" />}
      badgeColor="bg-blue-50 text-blue-800 border-blue-200"
    />
  );
}
