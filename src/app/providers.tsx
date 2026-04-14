'use client';

import { LocaleProvider } from '@/lib/i18n';
import { TourProvider } from '@/components/tour/TourProvider';
import CapacitorBoot from '@/components/CapacitorBoot';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <TourProvider>
        <CapacitorBoot />
        {children}
      </TourProvider>
    </LocaleProvider>
  );
}
