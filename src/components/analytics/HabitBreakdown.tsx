'use client';

import { useMemo } from 'react';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Habit, HabitLog } from '@/lib/types';

interface HabitBreakdownProps {
  habits: Habit[];
  habitLogs: HabitLog[];
  totalDays: number;
}

export default function HabitBreakdown({ habits, habitLogs, totalDays }: HabitBreakdownProps) {
  const { t } = useLocale();

  const perHabit = useMemo(() => {
    return habits.map((habit) => {
      const logs = habitLogs.filter((hl) => hl.habit_id === habit.id && hl.completed);
      const completedDays = new Set(logs.map((l) => l.date)).size;
      const pct = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
      return { ...habit, completedDays, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [habits, habitLogs, totalDays]);

  if (perHabit.length === 0) return null;

  return (
    <div className="bg-surface rounded-xl p-4 shadow-sm animate-fade-in">
      <h3 className="text-sm font-semibold text-text-secondary mb-3">{t('analytics.perHabit')}</h3>
      <div className="space-y-3">
        {perHabit.map((habit) => (
          <div key={habit.id}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm shrink-0">{habit.emoji}</span>
                <span className="text-xs font-medium text-text-primary truncate">{habit.name}</span>
              </div>
              <span className="text-xs text-text-tertiary shrink-0 ml-2">
                {habit.completedDays}/{totalDays} {t('analytics.days')} ({habit.pct}%)
              </span>
            </div>
            <div className="w-full h-2 bg-surface-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  habit.pct >= 80 ? 'bg-positive-bar' :
                  habit.pct >= 50 ? 'bg-accent' :
                  habit.pct >= 25 ? 'bg-warning-bar' : 'bg-macro-fat'
                )}
                style={{ width: `${habit.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
