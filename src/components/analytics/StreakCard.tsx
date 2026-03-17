'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { DayData } from './types';

interface StreakCardProps {
  dayDataMap: Map<string, DayData>;
  allHabitLogs: { date: string; completed: number; total: number }[];
}

export default function StreakCard({ dayDataMap, allHabitLogs }: StreakCardProps) {
  const { t } = useLocale();
  const [animatedCount, setAnimatedCount] = useState(0);

  const { currentStreak, bestStreak, completionRate } = useMemo(() => {
    const sortedDays = [...allHabitLogs].sort((a, b) => b.date.localeCompare(a.date));
    let current = 0;
    for (const day of sortedDays) {
      if (day.total > 0 && day.completed >= day.total) {
        current++;
      } else {
        break;
      }
    }

    const chronological = [...allHabitLogs].sort((a, b) => a.date.localeCompare(b.date));
    let best = 0;
    let run = 0;
    for (const day of chronological) {
      if (day.total > 0 && day.completed >= day.total) {
        run++;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }

    const days = Array.from(dayDataMap.values());
    const daysWithHabits = days.filter((d) => d.habitsTotal > 0);
    const totalCompleted = daysWithHabits.reduce((s, d) => s + d.habitsCompleted, 0);
    const totalPossible = daysWithHabits.reduce((s, d) => s + d.habitsTotal, 0);
    const rate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

    return { currentStreak: current, bestStreak: best, completionRate: rate };
  }, [dayDataMap, allHabitLogs]);

  useEffect(() => {
    if (currentStreak === 0) { setAnimatedCount(0); return; }
    let frame: number;
    const duration = 600;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedCount(Math.round(eased * currentStreak));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [currentStreak]);

  const isActive = currentStreak > 0;

  return (
    <div className={cn(
      'rounded-xl p-5 animate-fade-in',
      isActive ? 'bg-accent text-accent-fg' : 'bg-surface'
    )}>
      <p className={cn('text-xs font-semibold uppercase tracking-wide mb-2', isActive ? 'text-accent-fg/60' : 'text-text-tertiary')}>
        {t('analytics.habitStreak')}
      </p>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{animatedCount}</span>
            <span className="text-lg">🔥</span>
          </div>
          <p className={cn('text-xs mt-1', isActive ? 'text-accent-fg/70' : 'text-text-tertiary')}>
            {t('analytics.habitStreakDesc')}
          </p>
        </div>
        <div className={cn('text-right text-xs space-y-1', isActive ? 'text-accent-fg/70' : 'text-text-tertiary')}>
          <p>{t('analytics.bestStreak')}: {bestStreak} {t('analytics.days')}</p>
          <p>{t('analytics.completionRate')}: {completionRate}%</p>
        </div>
      </div>
    </div>
  );
}
