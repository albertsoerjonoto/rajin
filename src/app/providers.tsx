'use client';

import { LocaleProvider } from '@/lib/i18n';
import { TourProvider } from '@/components/tour/TourProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <TourProvider>{children}</TourProvider>
    </LocaleProvider>
  );
}
