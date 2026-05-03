'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { LocaleProvider } from '@/lib/i18n';

// TourProvider is mounted only inside (app)/layout.tsx — auth pages
// (login/signup/onboarding entry) have no tour and don't need to pay
// the JS cost. See .claude/rules/performance.md.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LocaleProvider>{children}</LocaleProvider>
    </AuthProvider>
  );
}
