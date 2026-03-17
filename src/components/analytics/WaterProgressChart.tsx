'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { useLocale } from '@/lib/i18n';
import type { DayData, AnalyticsPeriod } from './types';

interface WaterProgressChartProps {
  dayDataMap: Map<string, DayData>;
  dates: string[];
  period: AnalyticsPeriod;
  waterGoalMl: number;
}

export default function WaterProgressChart({ dayDataMap, dates, period, waterGoalMl }: WaterProgressChartProps) {
  const { t, locale } = useLocale();

  const data = useMemo(() => {
    if (period === 'year') {
      const monthMap = new Map<number, number[]>();
      for (const date of dates) {
        const month = new Date(date + 'T12:00:00Z').getUTCMonth();
        if (!monthMap.has(month)) monthMap.set(month, []);
        const day = dayDataMap.get(date);
        if (day) monthMap.get(month)!.push(day.totalWaterMl);
      }
      return Array.from(monthMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([month, values]) => ({
          label: t(`month.${month + 1}`).slice(0, 3),
          water: Math.round(values.reduce((s, v) => s + v, 0) / (values.length || 1)),
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
      return { label, water: day?.totalWaterMl ?? 0 };
    });
  }, [dayDataMap, dates, period, t, locale]);

  const avgWater = data.length > 0
    ? Math.round(data.reduce((s, d) => s + d.water, 0) / data.length)
    : 0;
  const daysGoalMet = data.filter((d) => d.water >= waterGoalMl).length;

  return (
    <div className="bg-surface rounded-xl p-4 shadow-sm animate-fade-in">
      <h3 className="text-sm font-semibold text-text-secondary mb-1">{t('analytics.waterIntake')}</h3>
      <p className="text-xs text-text-tertiary mb-3">
        {t('analytics.avg')}: {avgWater}ml/{t('analytics.day')} · {daysGoalMet}/{data.length} {t('analytics.daysGoalMet')}
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
            formatter={(value: number) => [`${value}ml`, t('drink.water')]}
          />
          {waterGoalMl > 0 && (
            <ReferenceLine
              y={waterGoalMl}
              stroke="var(--c-text-tertiary)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          <Bar dataKey="water" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
