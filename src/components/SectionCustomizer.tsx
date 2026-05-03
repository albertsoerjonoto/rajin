'use client';

import { useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';
import { SECTION_TITLE_KEYS } from '@/lib/dashboard-sections';
import type { DashboardSection, DashboardSectionId } from '@/lib/types';

interface Props {
  sections: DashboardSection[];
  onChange: (next: DashboardSection[]) => void;
}

export default function SectionCustomizer({ sections, onChange }: Props) {
  const { t } = useLocale();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => sections.map((s) => s.id), [sections]);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(sections, oldIndex, newIndex));
  };

  const toggleVisibility = (id: DashboardSectionId) => {
    onChange(sections.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)));
  };

  return (
    <div>
      <p className="text-xs text-text-tertiary px-1 mb-2">{t('profile.dragToReorder')}</p>
      <div className="bg-surface rounded-2xl overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {sections.map((s, idx) => (
              <Row
                key={s.id}
                section={s}
                title={t(SECTION_TITLE_KEYS[s.id])}
                isLast={idx === sections.length - 1}
                onToggle={() => toggleVisibility(s.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

interface RowProps {
  section: DashboardSection;
  title: string;
  isLast: boolean;
  onToggle: () => void;
}

function Row({ section, title, isLast, onToggle }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 px-3 py-3 bg-surface select-none',
        !isLast && 'border-b border-border',
        isDragging && 'opacity-50 z-10'
      )}
    >
      <button
        type="button"
        className="touch-none p-1 -m-1 text-text-tertiary hover:text-text-secondary cursor-grab active:cursor-grabbing"
        aria-label="Reorder section"
        {...attributes}
        {...listeners}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="6" r="1.5" fill="currentColor" />
          <circle cx="15" cy="6" r="1.5" fill="currentColor" />
          <circle cx="9" cy="12" r="1.5" fill="currentColor" />
          <circle cx="15" cy="12" r="1.5" fill="currentColor" />
          <circle cx="9" cy="18" r="1.5" fill="currentColor" />
          <circle cx="15" cy="18" r="1.5" fill="currentColor" />
        </svg>
      </button>
      <span
        className={cn(
          'flex-1 text-sm',
          section.visible ? 'text-text-primary' : 'text-text-tertiary line-through'
        )}
      >
        {title}
      </span>
      <button
        type="button"
        onClick={onToggle}
        role="switch"
        aria-checked={section.visible}
        className={cn(
          'relative w-10 h-6 rounded-full transition-colors',
          section.visible ? 'bg-accent' : 'bg-surface-secondary'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform',
            section.visible && 'translate-x-4'
          )}
        />
      </button>
    </div>
  );
}
