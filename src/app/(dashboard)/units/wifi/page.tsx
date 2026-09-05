import React from 'react';
import UnitCashLedger from '@/components/units/UnitCashLedger';
import { Wifi } from 'lucide-react';

export default function WifiUnitPage() {
  return (
    <UnitCashLedger
      unit="WIFI_DESA"
      title="Unit Usaha WiFi Balai Desa"
      subtitle="Buku kas layanan internet desa: penerimaan iuran bulanan warga, langganan bandwidth ISP, dan pemeliharaan kabel jaringan"
      category="Layanan Internet"
      icon={<Wifi className="w-5 h-5 text-blue-600" />}
      badgeColor="bg-blue-50 text-blue-800 border-blue-200"
    />
  );
}
