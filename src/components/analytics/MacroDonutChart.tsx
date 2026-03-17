'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useLocale } from '@/lib/i18n';
import type { DayData } from './types';

const COLORS = { protein: '#2563eb', carbs: '#fbbf24', fat: '#fb7185' };

interface MacroDonutChartProps {
  dayDataMap: Map<string, DayData>;
}

export default function MacroDonutChart({ dayDataMap }: MacroDonutChartProps) {
  const { t } = useLocale();

  const { protein, carbs, fat, avgCalories } = useMemo(() => {
    const days = Array.from(dayDataMap.values());
    const count = days.length || 1;
    const p = Math.round(days.reduce((s, d) => s + d.totalProtein, 0) / count);
    const c = Math.round(days.reduce((s, d) => s + d.totalCarbs, 0) / count);
    const f = Math.round(days.reduce((s, d) => s + d.totalFat, 0) / count);
    const cal = Math.round(days.reduce((s, d) => s + d.totalCalories, 0) / count);
    return { protein: p, carbs: c, fat: f, avgCalories: cal };
  }, [dayDataMap]);

  const total = protein + carbs + fat;
  const pctProtein = total > 0 ? Math.round((protein / total) * 100) : 0;
  const pctCarbs = total > 0 ? Math.round((carbs / total) * 100) : 0;
  const pctFat = total > 0 ? 100 - pctProtein - pctCarbs : 0;

  const pieData = [
    { name: 'protein', value: protein, color: COLORS.protein },
    { name: 'carbs', value: carbs, color: COLORS.carbs },
    { name: 'fat', value: fat, color: COLORS.fat },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <div className="bg-surface rounded-xl p-4 shadow-sm animate-fade-in">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">{t('analytics.macroSplit')}</h3>
        <p className="text-xs text-text-tertiary text-center py-8">{t('analytics.noData')}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl p-4 shadow-sm animate-fade-in">
      <h3 className="text-sm font-semibold text-text-secondary mb-3">{t('analytics.macroSplit')}</h3>
      <div className="relative" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-text-primary">{avgCalories}</span>
          <span className="text-[10px] text-text-tertiary">{t('common.cal')}/{t('analytics.day')}</span>
        </div>
      </div>
      <div className="flex justify-center gap-4 mt-2">
        {[
          { label: t('nutrition.protein'), g: protein, pct: pctProtein, color: COLORS.protein },
          { label: t('nutrition.carbs'), g: carbs, pct: pctCarbs, color: COLORS.carbs },
          { label: t('nutrition.fat'), g: fat, pct: pctFat, color: COLORS.fat },
        ].map((m) => (
          <div key={m.label} className="text-center">
            <div className="flex items-center gap-1 justify-center">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="text-[11px] text-text-secondary font-medium">{m.label}</span>
            </div>
            <p className="text-xs text-text-tertiary">{m.g}g ({m.pct}%)</p>
          </div>
        ))}
      </div>
    </div>
  );
}
