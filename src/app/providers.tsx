'use client';

import { LocaleProvider } from '@/lib/i18n';
import { TourProvider } from '@/components/tour/TourProvider';
import { PerfTracker } from '@/components/PerfTracker';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <TourProvider>
        <PerfTracker />
        {children}
      </TourProvider>
    </LocaleProvider>
  );
}
