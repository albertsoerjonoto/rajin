'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useLocale } from '@/lib/i18n';
import { DesktopLayoutProvider, useDesktopLayout } from '@/hooks/useDesktopLayout';
import { ServiceWorkerRegister } from './sw-register';
import { TourProvider } from '@/components/tour/TourProvider';
import { TourOverlay } from '@/components/tour/TourOverlay';
import { useTour } from '@/components/tour/useTour';
import type { Locale, DesktopLayout } from '@/lib/types';

const TAB_DEFS = [
  { href: '/dashboard', labelKey: 'nav.overview', icon: DashboardIcon },
  { href: '/log', labelKey: 'nav.log', icon: LogIcon },
  { href: '/chat', labelKey: 'nav.chat', icon: ChatIcon },
  { href: '/friends', labelKey: 'nav.friends', icon: FriendsIcon },
  { href: '/profile', labelKey: 'nav.profile', icon: ProfileIcon },
];

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const { isExpanded } = useDesktopLayout();
  const { isActive: tourActive } = useTour();
  const [pendingCount, setPendingCount] = useState(0);
  const { user } = useAuth();

  // Fetch pending friend request count
  const fetchPendingCount = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('addressee_id', user.id)
      .eq('status', 'pending');
    setPendingCount(count ?? 0);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) fetchPendingCount();
    });
    const handleFocus = () => fetchPendingCount();
    window.addEventListener('focus', handleFocus);
    return () => {
      controller.abort();
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, fetchPendingCount]);

  // Scroll to top on page navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return (
    <div className={cn('min-h-screen bg-bg', isExpanded ? 'sm:flex' : '')}>
      {/* Desktop sidebar — narrow (icon-only) at md, full at xl */}
      {isExpanded && (
        <aside className="hidden sm:flex sm:flex-col sm:fixed sm:inset-y-0 sm:left-0 sm:w-16 xl:w-60 sm:bg-surface sm:border-r sm:border-border sm:z-50">
          {/* Logo */}
          <div className="flex items-center justify-center xl:justify-start xl:px-6 h-16 border-b border-border">
            <span className="text-lg font-bold text-text-primary xl:hidden">R</span>
            <span className="text-lg font-bold text-text-primary hidden xl:inline">Rajin.AI</span>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-2 xl:px-3 py-4 space-y-1">
            {TAB_DEFS.map((tab) => {
              const isActive = pathname === tab.href;
              const showBadge = tab.href === '/friends' && pendingCount > 0;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  title={t(tab.labelKey)}
                  className={cn(
                    'flex items-center justify-center xl:justify-start gap-3 px-0 xl:px-3 py-2.5 rounded-xl transition-colors duration-200 relative',
                    isActive
                      ? 'bg-accent-surface text-nav-active font-semibold'
                      : 'text-nav-inactive hover:bg-surface-hover hover:text-nav-inactive-hover'
                  )}
                >
                  <div className="relative">
                    <tab.icon className="w-5 h-5" filled={isActive} />
                    {showBadge && (
                      <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full" />
                    )}
                  </div>
                  <span className="text-sm hidden xl:inline">{t(tab.labelKey)}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
      )}

      {/* Main content */}
      <main className={cn('flex-1 pb-20', isExpanded && 'sm:pb-0 sm:ml-16 xl:ml-60')}>
        <ServiceWorkerRegister />
        {children}
      </main>

      {/* Bottom tab nav — visible on mobile, hidden on md+ when expanded */}
      <nav className={cn(
        'fixed bottom-0 left-0 right-0 bg-nav-bg backdrop-blur-md safe-area-bottom z-50',
        isExpanded ? 'sm:hidden' : ''
      )}>
        <div className="max-w-lg mx-auto flex justify-around items-center h-12">
          {TAB_DEFS.map((tab) => {
            const isTabActive = pathname === tab.href;
            const showBadge = tab.href === '/friends' && pendingCount > 0;
            const dimmed = tourActive && !isTabActive;
            const label = t(tab.labelKey);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={label}
                title={label}
                data-tour={tab.href === '/log' ? 'nav-log' : tab.href === '/dashboard' ? 'nav-overview' : undefined}
                className={cn(
                  'flex items-center justify-center px-2 py-2 rounded-xl transition-colors duration-200 relative',
                  isTabActive ? 'text-nav-active' : 'text-nav-inactive hover:text-nav-inactive-hover',
                  dimmed && 'opacity-40'
                )}
              >
                <div className="relative">
                  <tab.icon className="w-6 h-6" filled={isTabActive} />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
      <TourOverlay />
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { setLocale } = useLocale();
  const { startTour } = useTour();
  const [desktopLayout, setDesktopLayout] = useState<DesktopLayout>('expanded');
  const checkedRef = useRef(false);
  const tourStartedRef = useRef(false);

  // Resolve locale + desktop layout + onboarding status in the background.
  // We render the shell immediately — locale/layout fall back to defaults and
  // the profile fetch updates them when it lands. Only `onboarding_completed
  // === false` triggers a redirect, so users who have onboarded never wait.
  useEffect(() => {
    if (authLoading || !user || checkedRef.current) return;
    checkedRef.current = true;

    const supabase = createClient();
    supabase
      .from('profiles')
      .select('locale, desktop_layout, onboarding_completed')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.locale) setLocale(data.locale as Locale);
        if (data?.desktop_layout) setDesktopLayout(data.desktop_layout as DesktopLayout);
        if (data && data.onboarding_completed === false) {
          router.replace('/onboarding');
        }
      });
  }, [user, authLoading, router, setLocale]);

  // Detect ?tour=start and trigger tour
  useEffect(() => {
    if (authLoading || tourStartedRef.current) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tour') === 'start') {
      tourStartedRef.current = true;
      startTour();
      router.replace(pathname);
    }
  }, [authLoading, startTour, router, pathname]);

  return (
    <DesktopLayoutProvider initialLayout={desktopLayout}>
      <AppLayoutInner>{children}</AppLayoutInner>
    </DesktopLayoutProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TourProvider>
      <AppShell>{children}</AppShell>
    </TourProvider>
  );
}

function DashboardIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function LogIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function ChatIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
}

function FriendsIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function ProfileIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}
