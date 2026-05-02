'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { LocaleProvider } from '@/lib/i18n';
import { TourProvider } from '@/components/tour/TourProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LocaleProvider>
        <TourProvider>{children}</TourProvider>
      </LocaleProvider>
    </AuthProvider>
  );
}
