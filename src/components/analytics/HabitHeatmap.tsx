'use client';

import { useState, useMemo } from 'react';
import { useLocale } from '@/lib/i18n';
import { getWeekNumber } from '@/lib/utils';
import type { DayData, AnalyticsPeriod } from './types';

const COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

function getColor(completed: number, total: number): string {
  if (total === 0 || completed === 0) return COLORS[0];
  const pct = (completed / total) * 100;
  if (pct <= 25) return COLORS[1];
  if (pct <= 50) return COLORS[2];
  if (pct <= 75) return COLORS[3];
  return COLORS[4];
}

interface HabitHeatmapProps {
  dayDataMap: Map<string, DayData>;
  dates: string[];
  period: AnalyticsPeriod;
}

export default function HabitHeatmap({ dayDataMap, dates, period }: HabitHeatmapProps) {
  const { t } = useLocale();
  const [tooltip, setTooltip] = useState<{ date: string; completed: number; total: number; x: number; y: number } | null>(null);

  const cells = useMemo(() => {
    return dates.map((date) => {
      const day = dayDataMap.get(date);
      return {
        date,
        completed: day?.habitsCompleted ?? 0,
        total: day?.habitsTotal ?? 0,
      };
    });
  }, [dayDataMap, dates]);

  const handleCellClick = (cell: typeof cells[0], e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const parentRect = (e.currentTarget as HTMLElement).closest('.heatmap-container')?.getBoundingClientRect();
    if (!parentRect) return;
    setTooltip({
      date: cell.date,
      completed: cell.completed,
      total: cell.total,
      x: rect.left - parentRect.left + rect.width / 2,
      y: rect.top - parentRect.top - 4,
    });
    setTimeout(() => setTooltip(null), 2000);
  };

  if (period === 'year') {
    // GitHub-style 52x7 grid
    const weeks = new Map<number, typeof cells>();
    for (const cell of cells) {
      const wn = getWeekNumber(cell.date);
      if (!weeks.has(wn)) weeks.set(wn, []);
      weeks.get(wn)!.push(cell);
    }
    const weekNums = [...weeks.keys()].sort((a, b) => a - b);

    return (
      <div className="bg-surface rounded-xl p-4 shadow-sm animate-fade-in">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">{t('analytics.habitCompletion')}</h3>
        <div className="heatmap-container relative overflow-x-auto pb-2">
          <div className="flex gap-[2px]" style={{ minWidth: weekNums.length * 16 }}>
            {weekNums.map((wn) => (
              <div key={wn} className="flex flex-col gap-[2px]">
                {(weeks.get(wn) || []).map((cell) => (
                  <div
                    key={cell.date}
                    className="rounded-[2px] cursor-pointer"
                    style={{ width: 13, height: 13, backgroundColor: getColor(cell.completed, cell.total) }}
                    onClick={(e) => handleCellClick(cell, e)}
                  />
                ))}
              </div>
            ))}
          </div>
          {tooltip && (
            <div
              className="absolute z-10 bg-text-primary text-bg text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none"
              style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
            >
              {tooltip.date}: {tooltip.completed}/{tooltip.total} {t('analytics.habitsCompleted')}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 mt-2 text-[10px] text-text-tertiary justify-end">
          <span>{t('analytics.less')}</span>
          {COLORS.map((c, i) => (
            <div key={i} className="rounded-[2px]" style={{ width: 10, height: 10, backgroundColor: c }} />
          ))}
          <span>{t('analytics.more')}</span>
        </div>
      </div>
    );
  }

  // Week/Month: simple grid
  const gridCols = period === 'week' ? 7 : 7;
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // For month, pad to align with day of week
  const paddedCells = [...cells];
  if (period === 'month' && cells.length > 0) {
    const firstDate = new Date(cells[0].date + 'T12:00:00Z');
    const dow = firstDate.getUTCDay();
    const padding = dow === 0 ? 6 : dow - 1; // Mon=0 offset
    for (let i = 0; i < padding; i++) {
      paddedCells.unshift({ date: '', completed: 0, total: 0 });
    }
  }

  return (
    <div className="bg-surface rounded-xl p-4 shadow-sm animate-fade-in">
      <h3 className="text-sm font-semibold text-text-secondary mb-3">{t('analytics.habitCompletion')}</h3>
      <div className="heatmap-container relative">
        <div className="grid grid-cols-7 gap-[2px] mb-1">
          {dayLabels.map((d, i) => (
            <div key={i} className="text-[10px] text-text-tertiary text-center">{d}</div>
          ))}
        </div>
        <div className={`grid gap-[2px]`} style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
          {paddedCells.map((cell, i) => (
            cell.date ? (
              <div
                key={cell.date}
                className="rounded-[3px] cursor-pointer aspect-square"
                style={{ backgroundColor: getColor(cell.completed, cell.total), minHeight: 14 }}
                onClick={(e) => handleCellClick(cell, e)}
              />
            ) : (
              <div key={`pad-${i}`} className="aspect-square" />
            )
          ))}
        </div>
        {tooltip && (
          <div
            className="absolute z-10 bg-text-primary text-bg text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
          >
            {tooltip.date}: {tooltip.completed}/{tooltip.total} {t('analytics.habitsCompleted')}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 mt-2 text-[10px] text-text-tertiary justify-end">
        <span>{t('analytics.less')}</span>
        {COLORS.map((c, i) => (
          <div key={i} className="rounded-[2px]" style={{ width: 10, height: 10, backgroundColor: c }} />
        ))}
        <span>{t('analytics.more')}</span>
      </div>
    </div>
  );
}
