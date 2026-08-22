import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-28 md:pb-12 overflow-y-auto max-w-full">
          {children}
        </main>
      </div>

      <BottomNav />
      <OnboardingModal />
    </div>
  );
}
