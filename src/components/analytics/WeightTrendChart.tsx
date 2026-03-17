'use client';

// TODO: Implement when measurement_logs weight tracking is confirmed on main.
// This component will show a line chart with raw data points + 7-day moving average,
// Y-axis: weight in kg (auto-scaled), optional goal reference line.

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useLocale } from '@/lib/i18n';
import type { MeasurementLog } from '@/lib/types';
import type { AnalyticsPeriod } from './types';

interface WeightTrendChartProps {
  measurements: MeasurementLog[];
  period: AnalyticsPeriod;
  targetWeight?: number;
}

export default function WeightTrendChart({ measurements, period, targetWeight }: WeightTrendChartProps) {
  const { t, locale } = useLocale();

  const data = useMemo(() => {
    const sorted = measurements
      .filter((m) => m.weight_kg != null)
      .sort((a, b) => a.date.localeCompare(b.date));

    return sorted.map((m, i) => {
      const d = new Date(m.date + 'T12:00:00Z');
      let label: string;
      if (period === 'week') {
        const dayNames = locale === 'id'
          ? ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        label = dayNames[d.getUTCDay()];
      } else if (period === 'year') {
        label = t(`month.${d.getUTCMonth() + 1}`).slice(0, 3);
      } else {
        label = String(d.getUTCDate());
      }

      // 7-day moving average
      const window = sorted.slice(Math.max(0, i - 6), i + 1);
      const avg = window.reduce((s, w) => s + (w.weight_kg ?? 0), 0) / window.length;

      return {
        label,
        weight: m.weight_kg,
        avg: Math.round(avg * 10) / 10,
      };
    });
  }, [measurements, period, t, locale]);

  if (data.length === 0) return null;

  const weights = data.map((d) => d.weight!).filter(Boolean);
  const minW = Math.floor(Math.min(...weights) - 2);
  const maxW = Math.ceil(Math.max(...weights) + 2);

  return (
    <div className="bg-surface rounded-xl p-4 shadow-sm animate-fade-in">
      <h3 className="text-sm font-semibold text-text-secondary mb-3">{t('analytics.weightTrend')}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--c-text-tertiary)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minW, maxW]}
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
              `${value} kg`,
              name === 'weight' ? t('profile.weight') : t('analytics.avg'),
            ]}
          />
          {targetWeight && (
            <ReferenceLine
              y={targetWeight}
              stroke="var(--c-text-tertiary)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          <Line
            type="monotone"
            dataKey="avg"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#10b981"
            strokeWidth={0}
            dot={{ fill: '#10b981', r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
