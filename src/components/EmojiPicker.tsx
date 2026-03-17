'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';

const EMOJI_CATEGORIES = [
  { nameKey: 'emoji.fitness', emojis: ['💪', '🏃', '🚴', '🏋️', '🧘', '🤸', '⛹️', '🏊', '🥊', '🎯'] },
  { nameKey: 'emoji.health', emojis: ['💤', '💧', '🧠', '❤️', '🫁', '🦷', '💊', '🩺', '🌡️', '🧬'] },
  { nameKey: 'emoji.food', emojis: ['🥗', '🍎', '🥦', '🍳', '🥤', '☕', '🍵', '🫖', '🥛', '🍌'] },
  { nameKey: 'emoji.mind', emojis: ['📖', '✍️', '🎵', '🧩', '🎨', '📝', '🙏', '😌', '🌅', '🌙'] },
  { nameKey: 'emoji.productivity', emojis: ['⭐', '🚀', '💻', '📚', '🗂️', '⏰', '📧', '🔔', '✅', '🏆'] },
  { nameKey: 'emoji.social', emojis: ['👋', '🤝', '💬', '📞', '👨‍👩‍👧', '❤️‍🔥', '🎉', '🎂', '📸', '🌍'] },
  { nameKey: 'emoji.nature', emojis: ['🌳', '🌿', '🌸', '☀️', '🌊', '🐕', '🐈', '🦅', '🌻', '🍃'] },
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export default function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 288; // w-72 = 18rem = 288px
    const dropdownHeight = 320;
    const pad = 8;

    let top = rect.bottom + 4;
    let left = rect.left;

    // Keep within viewport horizontally
    if (left + dropdownWidth > window.innerWidth - pad) {
      left = window.innerWidth - dropdownWidth - pad;
    }
    if (left < pad) left = pad;

    // If not enough room below, show above
    if (top + dropdownHeight > window.innerHeight - pad) {
      top = rect.top - dropdownHeight - 4;
    }

    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(updatePosition);
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-12 h-12 flex items-center justify-center text-2xl rounded-xl bg-surface hover:bg-surface-hover transition-colors"
      >
        {value}
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] w-72 max-h-80 overflow-y-auto bg-surface rounded-2xl shadow-lg animate-fade-in scrollbar-hide"
            style={{ top: pos.top, left: pos.left }}
          >
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.nameKey} className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
                  {t(cat.nameKey)}
                </p>
                <div className="grid grid-cols-7 gap-0.5">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onChange(emoji);
                        setOpen(false);
                      }}
                      className={cn(
                        'w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-surface-hover transition-colors',
                        value === emoji && 'bg-accent-surface ring-1 ring-accent-border'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
