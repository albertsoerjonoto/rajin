'use client';

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useLocale } from '@/lib/i18n';
import type { DayData, AnalyticsPeriod } from './types';

interface ExerciseChartProps {
  dayDataMap: Map<string, DayData>;
  dates: string[];
  period: AnalyticsPeriod;
}

export default function ExerciseChart({ dayDataMap, dates, period }: ExerciseChartProps) {
  const { t, locale } = useLocale();
  const [showCalories, setShowCalories] = useState(false);

  const data = useMemo(() => {
    if (period === 'year') {
      const monthMap = new Map<number, { minutes: number[]; calories: number[] }>();
      for (const date of dates) {
        const month = new Date(date + 'T12:00:00Z').getUTCMonth();
        if (!monthMap.has(month)) monthMap.set(month, { minutes: [], calories: [] });
        const day = dayDataMap.get(date);
        if (day) {
          const mins = day.exerciseLogs.reduce((s, e) => s + e.duration_minutes, 0);
          monthMap.get(month)!.minutes.push(mins);
          monthMap.get(month)!.calories.push(day.totalCaloriesBurned);
        }
      }
      return Array.from(monthMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([month, v]) => ({
          label: t(`month.${month + 1}`).slice(0, 3),
          minutes: v.minutes.reduce((s, c) => s + c, 0),
          calories: v.calories.reduce((s, c) => s + c, 0),
        }));
    }

    return dates.map((date) => {
      const day = dayDataMap.get(date);
      const d = new Date(date + 'T12:00:00Z');
      let label: string;
      if (period === 'week') {
        const dayNames = locale === 'id'
          ? ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        label = dayNames[d.getUTCDay()];
      } else {
        label = String(d.getUTCDate());
      }
      return {
        label,
        minutes: day?.exerciseLogs.reduce((s, e) => s + e.duration_minutes, 0) ?? 0,
        calories: day?.totalCaloriesBurned ?? 0,
      };
    });
  }, [dayDataMap, dates, period, t, locale]);

  const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);
  const totalCalBurned = data.reduce((s, d) => s + d.calories, 0);
  const daysActive = data.filter((d) => d.minutes > 0).length;

  const dataKey = showCalories ? 'calories' : 'minutes';

  return (
    <div className="bg-surface rounded-xl p-4 shadow-sm animate-fade-in">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-text-secondary">{t('dashboard.exercise')}</h3>
        <button
          onClick={() => setShowCalories(!showCalories)}
          className="text-[10px] text-accent-text font-medium px-2 py-0.5 rounded-full bg-accent/10"
        >
          {showCalories ? t('common.cal') : t('common.min')}
        </button>
      </div>
      <p className="text-xs text-text-tertiary mb-3">
        {totalMinutes} {t('common.min')} · {totalCalBurned.toLocaleString()} {t('common.cal')} · {daysActive}/{data.length} {t('analytics.daysActive')}
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--c-text-tertiary)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--c-text-tertiary)' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border-strong)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [
              showCalories ? `${value} ${t('common.cal')}` : `${value} ${t('common.min')}`,
              t('dashboard.exercise'),
            ]}
          />
          <Bar dataKey={dataKey} fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
