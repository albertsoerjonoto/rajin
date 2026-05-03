'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';

const EMOJI_CATEGORIES = [
  { nameKey: 'emoji.faces', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'] },
  { nameKey: 'emoji.hands', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '🫷', '🫸', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '👁️', '👀', '🫀', '🫁', '🧠', '🦷', '🦴'] },
  { nameKey: 'emoji.fitness', emojis: ['💪', '🏃', '🚴', '🏋️', '🧘', '🤸', '⛹️', '🏊', '🥊', '🎯', '🏄', '🧗', '🤾', '🏇', '⚽', '🏀', '🏈', '🎾', '🏐', '🏓', '🏸', '⛷️', '🛹', '🤿', '🚣', '⚾', '🥋', '🤼', '🏌️', '🎿', '🛷', '⛸️', '🥏', '🤺', '🏑', '🥅', '⛳', '🪃', '🛼', '🧗‍♀️', '🧗‍♂️', '🏊‍♀️', '🏊‍♂️', '🚶', '🚶‍♀️', '🧎', '🏇'] },
  { nameKey: 'emoji.health', emojis: ['💤', '💧', '🧠', '❤️', '🫁', '🦷', '💊', '🩺', '🌡️', '🧬', '🩸', '🫀', '🦴', '👁️', '👂', '🦶', '🤧', '😷', '🩹', '🧴', '🧼', '🪥', '🛁', '🚿', '😴', '🥱', '🩻', '💉', '🧪', '🩼', '🩺', '♿', '🏥', '🚑', '⚕️', '🧬', '🔬'] },
  { nameKey: 'emoji.food', emojis: ['🥗', '🍎', '🥦', '🍳', '🥤', '☕', '🍵', '🫖', '🥛', '🍌', '🍇', '🍊', '🍋', '🍉', '🍓', '🫐', '🍑', '🥭', '🍍', '🥥', '🥑', '🍆', '🥕', '🌽', '🥒', '🥬', '🫑', '🧄', '🧅', '🍄', '🥜', '🍞', '🥚', '🧀', '🥩', '🍗', '🍖', '🌮', '🍕', '🍜', '🍲', '🥘', '🍱', '🍙', '🍚', '🥮', '🧁', '🍰', '🍫', '🍿', '🍔', '🌯', '🥙', '🧆', '🥫', '🫕', '🍝', '🍛', '🍣', '🍤', '🥟', '🥠', '🍡', '🍧', '🍨', '🍦', '🎂', '🍮', '🍯', '🍬', '🍭', '🍩', '🍪', '🥧', '🧇', '🥞', '🧈', '🥐', '🥖', '🫓', '🥨', '🧃', '🥂', '🍷', '🍺', '🍸', '🍹', '🫗', '🥃', '🧋', '🧉'] },
  { nameKey: 'emoji.mind', emojis: ['📖', '✍️', '🎵', '🧩', '🎨', '📝', '🙏', '😌', '🌅', '🌙', '🎹', '🎸', '🎺', '🥁', '🎭', '🎬', '📷', '🎮', '♟️', '🧶', '🪡', '🖌️', '✏️', '📓', '🔮', '🕯️', '🧘‍♀️', '🧘‍♂️', '🪷', '☮️', '🫧', '💭', '💡', '🌈', '🎤', '🎧', '🎻', '🪘', '🪗', '🎷', '📚', '📰', '🖊️', '🖋️', '📔', '📕', '📗', '📘', '📙', '🔍', '🧿', '🪬', '🎲', '🧸', '🪆', '🎪', '🎠', '🎡', '🎢'] },
  { nameKey: 'emoji.productivity', emojis: ['⭐', '🚀', '💻', '📚', '🗂️', '⏰', '📧', '🔔', '✅', '🏆', '📊', '📈', '🗓️', '📋', '🎒', '💼', '🖥️', '⌨️', '🖱️', '📱', '⏳', '🔑', '🔒', '🛠️', '⚙️', '🧰', '📌', '🏅', '🥇', '🥈', '🎖️', '💎', '🔥', '⚡', '🗃️', '📎', '📐', '📏', '🗑️', '📤', '📥', '📬', '📭', '🗳️', '🔏', '🔐', '🔓', '🪪', '💳', '🧮', '📡', '🔋', '💾', '💿', '🖨️', '📠'] },
  { nameKey: 'emoji.social', emojis: ['👋', '🤝', '💬', '📞', '👨‍👩‍👧', '❤️‍🔥', '🎉', '🎂', '📸', '🌍', '🥳', '🎊', '🎁', '🎈', '💌', '💕', '👫', '👭', '👬', '🫂', '🤗', '😊', '😂', '🥰', '😎', '🤩', '👏', '🙌', '✌️', '🤟', '👍', '🫶', '💝', '🎆', '👨‍👩‍👦', '👨‍👩‍👧‍👦', '👪', '👶', '🧒', '👦', '👧', '👨', '👩', '🧑', '👴', '👵', '🧓', '💏', '💑', '👰', '🤵', '🎅', '🤶', '🧑‍🎄', '🦸', '🦹', '🧙', '🧚', '🧜', '🧝'] },
  { nameKey: 'emoji.nature', emojis: ['🌳', '🌿', '🌸', '☀️', '🌊', '🐕', '🐈', '🦅', '🌻', '🍃', '🌺', '🌹', '🌷', '💐', '🌾', '🍀', '🍁', '🍂', '🌴', '🎋', '🌵', '🐶', '🐱', '🐰', '🐻', '🦊', '🐼', '🐨', '🦁', '🐯', '🐸', '🦋', '🐝', '🐞', '🌎', '🏔️', '🏖️', '⛰️', '🌄', '🌠', '🌤️', '🌧️', '🐔', '🐧', '🐦', '🐤', '🦆', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐛', '🐌', '🐙', '🦑', '🐠', '🐟', '🐬', '🐳', '🦈', '🐊', '🐢', '🐍', '🦎', '🦕', '🦖', '🐘', '🦏', '🦛', '🐪', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐑', '🐐', '🦌', '🐿️', '🦔', '🐇', '🦝', '🦫', '🦨', '🦡', '🐁', '🐀', '🐓', '🦃', '🦚', '🦜', '🪿', '🐦‍⬛', '🕊️', '🦩', '🪺'] },
  { nameKey: 'emoji.symbols', emojis: ['❌', '🚫', '⭕', '❗', '❓', '❕', '❔', '‼️', '⁉️', '✖️', '➕', '➖', '➗', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '💠', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '♠️', '♥️', '♦️', '♣️', '🃏', '🀄', '🎴', '💯', '🔅', '🔆', '🔈', '🔇', '🔉', '🔊', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♻️', '⚜️', '🔰', '🔱', '⭐', '🌟', '💫', '✨', '⚡', '🔥', '💥', '☄️', '🎵', '🎶', '🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '⚠️', '🚸', '⛔', '🚳', '🚭', '🚯', '🚱', '🚷', '📵', '🔞', '☢️', '☣️', '🛑', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'] },
  { nameKey: 'emoji.objects', emojis: ['⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🪤', '💡', '🔦', '🕯️', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '🧲', '🪜', '🧱', '🪵', '🪨', '🛡️', '🗡️', '⚔️', '🔫', '🪃', '🏹', '🔧', '🪛', '🔩', '🪚', '🔨', '⛏️', '⚒️', '🛠️', '🧰', '🪝', '🧲', '🪣', '⚗️', '🧪', '🧫', '🧬', '🔬', '🔭', '📡', '💉', '🩸', '💊', '🩹', '🩼', '🩺', '🩻', '🚪', '🪞', '🪟', '🛏️', '🛋️', '🪑', '🚿', '🛁', '🪠', '🪒', '🧴', '🧷', '🧹', '🧺', '🧻', '🪣', '🧼', '🫧', '🪥', '🧽', '🧯', '🛒', '🚬', '⚰️', '🪦', '🗿', '🪬', '🧿', '🪩', '🎈', '🎏', '🎀', '🎁', '🎊', '🎉', '🪅', '🪆', '🧸'] },
  { nameKey: 'emoji.travel', emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍️', '🛺', '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '🚀', '🛩️', '✈️', '🛬', '🛫', '🪂', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🛳️', '⛴️', '🚢', '⛵', '🚤', '🛥️', '⚓', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🗼', '🗽', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋', '⛲', '⛺', '🏕️', '🌁', '🌃', '🌆', '🌇', '🌉', '🎠', '🎡', '🎢', '🗺️', '🧭', '🏝️'] },
  { nameKey: 'emoji.flags', emojis: ['🇮🇩', '🇺🇸', '🇬🇧', '🇯🇵', '🇰🇷', '🇨🇳', '🇫🇷', '🇩🇪', '🇮🇹', '🇪🇸', '🇧🇷', '🇮🇳', '🇷🇺', '🇨🇦', '🇦🇺', '🇲🇽', '🇹🇭', '🇻🇳', '🇵🇭', '🇲🇾', '🇸🇬', '🇳🇱', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇵🇹', '🇦🇷', '🇨🇱', '🇨🇴', '🇵🇪', '🇪🇬', '🇿🇦', '🇳🇬', '🇰🇪', '🇸🇦', '🇦🇪', '🇹🇷', '🇬🇷', '🇵🇱', '🇺🇦', '🇳🇿'] },
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

type SearchMatch = { emoji: string; rank: number };

export default function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [keywords, setKeywords] = useState<Record<string, string[]> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Lazy-load keywords on first open so the chunk is split out of the main bundle.
  useEffect(() => {
    if (!open || keywords) return;
    let cancelled = false;
    import('./emoji-keywords').then((mod) => {
      if (!cancelled) setKeywords(mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [open, keywords]);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 288;
    const dropdownHeight = 360;
    const pad = 8;

    let top = rect.bottom + 4;
    let left = rect.left;

    if (left + dropdownWidth > window.innerWidth - pad) {
      left = window.innerWidth - dropdownWidth - pad;
    }
    if (left < pad) left = pad;

    if (top + dropdownHeight > window.innerHeight - pad) {
      top = rect.top - dropdownHeight - 4;
    }

    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      updatePosition();
      inputRef.current?.focus();
    });
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  const trimmedQuery = query.trim().toLowerCase();

  const searchResults = useMemo<SearchMatch[] | null>(() => {
    if (!trimmedQuery) return null;
    const seen = new Set<string>();
    const matches: SearchMatch[] = [];
    const allEmojis: string[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const e of cat.emojis) {
        if (!seen.has(e)) {
          seen.add(e);
          allEmojis.push(e);
        }
      }
    }
    for (const emoji of allEmojis) {
      const kws = keywords?.[emoji];
      if (!kws || kws.length === 0) continue;
      let rank = Infinity;
      for (const kw of kws) {
        if (kw === trimmedQuery) {
          rank = Math.min(rank, 0);
        } else if (kw.startsWith(trimmedQuery)) {
          rank = Math.min(rank, 1);
        } else if (kw.includes(trimmedQuery)) {
          rank = Math.min(rank, 2);
        }
      }
      if (rank !== Infinity) {
        matches.push({ emoji, rank });
      }
    }
    matches.sort((a, b) => a.rank - b.rank);
    return matches;
  }, [trimmedQuery, keywords]);

  const handleEmojiClick = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        setQuery('');
      } else {
        setOpen(false);
      }
    }
  };

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
            className="fixed z-[9999] w-72 max-h-[360px] flex flex-col bg-surface rounded-2xl shadow-lg animate-fade-in"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="p-2 border-b border-border-strong">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('emoji.search')}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-surface-secondary border-0 focus:outline-none focus:ring-1 focus:ring-accent-border placeholder:text-text-tertiary"
              />
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {searchResults !== null ? (
                <div className="px-3 pt-2 pb-3">
                  {searchResults.length === 0 ? (
                    <p className="text-xs text-text-tertiary text-center py-6">
                      {t('emoji.noResults')}
                    </p>
                  ) : (
                    <div className="grid grid-cols-7 gap-0.5">
                      {searchResults.map(({ emoji }) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleEmojiClick(emoji)}
                          className={cn(
                            'w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-surface-hover transition-colors',
                            value === emoji && 'bg-accent-surface ring-1 ring-accent-border'
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                EMOJI_CATEGORIES.map((cat) => (
                  <div key={cat.nameKey} className="px-3 pt-3 pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
                      {t(cat.nameKey)}
                    </p>
                    <div className="grid grid-cols-7 gap-0.5">
                      {cat.emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleEmojiClick(emoji)}
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
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
