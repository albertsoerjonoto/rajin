'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
import { useLocale } from '@/lib/i18n';
import type { DayData, AnalyticsPeriod } from './types';

interface CalorieBarChartProps {
  dayDataMap: Map<string, DayData>;
  dates: string[];
  period: AnalyticsPeriod;
  calorieTarget: number;
}

export default function CalorieBarChart({ dayDataMap, dates, period, calorieTarget }: CalorieBarChartProps) {
  const { t, locale } = useLocale();

  const data = useMemo(() => {
    if (period === 'year') {
      // Aggregate by month
      const monthMap = new Map<number, { food: number[]; drink: number[] }>();
      for (const date of dates) {
        const month = new Date(date + 'T12:00:00Z').getUTCMonth();
        if (!monthMap.has(month)) monthMap.set(month, { food: [], drink: [] });
        const day = dayDataMap.get(date);
        if (day) {
          const foodCal = day.foodLogs.reduce((s, f) => s + f.calories, 0);
          const drinkCal = day.drinkLogs.reduce((s, d) => s + d.calories, 0);
          monthMap.get(month)!.food.push(foodCal);
          monthMap.get(month)!.drink.push(drinkCal);
        }
      }
      return Array.from(monthMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([month, v]) => {
          const daysCount = v.food.length || 1;
          return {
            label: t(`month.${month + 1}`).slice(0, 3),
            food: Math.round(v.food.reduce((s, c) => s + c, 0) / daysCount),
            drink: Math.round(v.drink.reduce((s, c) => s + c, 0) / daysCount),
          };
        });
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
      const foodCal = day?.foodLogs.reduce((s, f) => s + f.calories, 0) ?? 0;
      const drinkCal = day?.drinkLogs.reduce((s, dl) => s + dl.calories, 0) ?? 0;
      return { label, food: foodCal, drink: drinkCal };
    });
  }, [dayDataMap, dates, period, t, locale]);

  const avgCalories = data.length > 0
    ? Math.round(data.reduce((s, d) => s + d.food + d.drink, 0) / data.length)
    : 0;
  const daysOnTarget = data.filter((d) => {
    const total = d.food + d.drink;
    return total >= calorieTarget * 0.9 && total <= calorieTarget * 1.1;
  }).length;

  return (
    <div className="bg-surface rounded-xl p-4 shadow-sm animate-fade-in">
      <h3 className="text-sm font-semibold text-text-secondary mb-1">{t('analytics.calorieIntake')}</h3>
      <p className="text-xs text-text-tertiary mb-3">
        {t('analytics.avg')}: {avgCalories.toLocaleString()} {t('common.cal')}/{t('analytics.day')} · {daysOnTarget} {t('analytics.daysOnTarget')}
      </p>
      <ResponsiveContainer width="100%" height={200}>
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
            formatter={(value: number, name: string) => [
              `${value} ${t('common.cal')}`,
              name === 'food' ? t('dashboard.food') : t('dashboard.drinks'),
            ]}
          />
          {calorieTarget > 0 && (
            <ReferenceLine
              y={calorieTarget}
              stroke="var(--c-text-tertiary)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          <Bar dataKey="food" stackId="cal" fill="#10b981" radius={[0, 0, 0, 0]} />
          <Bar dataKey="drink" stackId="cal" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
