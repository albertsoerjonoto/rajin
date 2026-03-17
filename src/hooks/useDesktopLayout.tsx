'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { DesktopLayout } from '@/lib/types';

interface DesktopLayoutContextValue {
  layout: DesktopLayout;
  setLayout: (layout: DesktopLayout) => void;
  isExpanded: boolean;
}

const DesktopLayoutContext = createContext<DesktopLayoutContextValue>({
  layout: 'expanded',
  setLayout: () => {},
  isExpanded: true,
});

export function DesktopLayoutProvider({
  children,
  initialLayout = 'expanded',
}: {
  children: React.ReactNode;
  initialLayout?: DesktopLayout;
}) {
  const [layout, setLayoutState] = useState<DesktopLayout>(initialLayout);

  const setLayout = useCallback((newLayout: DesktopLayout) => {
    setLayoutState(newLayout);
  }, []);

  return (
    <DesktopLayoutContext.Provider value={{ layout, setLayout, isExpanded: layout === 'expanded' }}>
      {children}
    </DesktopLayoutContext.Provider>
  );
}

export function useDesktopLayout() {
  return useContext(DesktopLayoutContext);
}
