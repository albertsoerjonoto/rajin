'use client';

import { useState, useRef, useEffect } from 'react';
import {
  formatDisplayDate,
  formatWeekLabel,
  formatMonthLabel,
  formatYearLabel,
  navigateByPeriod,
  getToday,
} from '@/lib/utils';
import type { Period } from '@/lib/utils';

interface DateNavProps {
  date: string;
  onDateChange: (date: string) => void;
  period?: Period;
  onPeriodChange?: (period: Period) => void;
  showPeriodPicker?: boolean;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

function getLabel(date: string, period: Period): string {
  switch (period) {
    case 'day': return formatDisplayDate(date);
    case 'week': return formatWeekLabel(date);
    case 'month': return formatMonthLabel(date);
    case 'year': return formatYearLabel(date);
  }
}

export default function DateNav({
  date,
  onDateChange,
  period = 'day',
  onPeriodChange,
  showPeriodPicker = false,
}: DateNavProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const label = getLabel(date, period);

  return (
    <div className="flex items-center gap-0.5" ref={ref}>
      <button
        onClick={() => onDateChange(navigateByPeriod(date, period, -1))}
        className="p-1.5 rounded-lg hover:bg-surface-hover transition-all active:scale-[0.95]"
        aria-label={`Previous ${period}`}
      >
        <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      <div className="relative">
        <button
          onClick={() => showPeriodPicker && setOpen(!open)}
          className={`text-sm font-medium text-text-primary px-1.5 py-0.5 rounded-lg transition-all ${
            showPeriodPicker ? 'hover:bg-surface-hover active:scale-[0.97]' : ''
          }`}
        >
          {label}
        </button>

        {open && (
          <div className="absolute top-full right-0 mt-1 bg-surface border border-border rounded-xl shadow-lg py-1 z-50 min-w-[100px]">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  onPeriodChange?.(p.value);
                  onDateChange(getToday());
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-all ${
                  period === p.value
                    ? 'text-accent font-medium bg-accent/10'
                    : 'text-text-primary hover:bg-surface-hover'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => onDateChange(navigateByPeriod(date, period, 1))}
        className="p-1.5 rounded-lg hover:bg-surface-hover transition-all active:scale-[0.95]"
        aria-label={`Next ${period}`}
      >
        <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  );
}
