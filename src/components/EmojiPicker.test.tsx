import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmojiPicker from './EmojiPicker';
import { LocaleProvider } from '@/lib/i18n/context';

// vitest 4's jsdom env doesn't expose a working localStorage; stub a minimal one.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  });
});

// Default locale is Indonesian; matchers below accept either language.
const SEARCH_PLACEHOLDER = /search emojis|cari emoji/i;
const NO_RESULTS = /no results|tidak ada hasil/i;
const FACES_LABEL = /^(faces|wajah)$/i;

function renderPicker(value: string, onChange: (e: string) => void) {
  return render(
    <LocaleProvider>
      <EmojiPicker value={value} onChange={onChange} />
    </LocaleProvider>
  );
}

describe('EmojiPicker search', () => {
  it('shows the categorized grid when query is empty', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPicker('😀', onChange);

    await user.click(screen.getByRole('button', { name: /😀/ }));

    expect(screen.getByText(FACES_LABEL)).toBeInTheDocument();
    // Focus is set inside a requestAnimationFrame, so wait for it to settle.
    await waitFor(() => {
      expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toHaveFocus();
    });
  });

  it('filters to matching emojis when typing a keyword', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPicker('😀', onChange);

    await user.click(screen.getByRole('button', { name: /😀/ }));
    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), 'pill');

    await waitFor(() => {
      const matches = screen.queryAllByRole('button', { name: '💊' });
      expect(matches.length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(FACES_LABEL)).not.toBeInTheDocument();
  });

  it('calls onChange with the selected emoji from search results', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPicker('😀', onChange);

    await user.click(screen.getByRole('button', { name: /😀/ }));
    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), 'fire');

    await waitFor(() => {
      const matches = screen.queryAllByRole('button', { name: '🔥' });
      expect(matches.length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByRole('button', { name: '🔥' })[0]);
    expect(onChange).toHaveBeenCalledWith('🔥');
  });

  it('finds newly-added superfood emojis (olive, ginger, beans)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPicker('😀', onChange);

    await user.click(screen.getByRole('button', { name: /😀/ }));
    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), 'olive');

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '🫒' }).length).toBeGreaterThan(0);
    });
  });

  it('shows a no-results message when nothing matches', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPicker('😀', onChange);

    await user.click(screen.getByRole('button', { name: /😀/ }));
    await user.type(
      screen.getByPlaceholderText(SEARCH_PLACEHOLDER),
      'qzzqxqxqzz'
    );

    await waitFor(() => {
      expect(screen.getByText(NO_RESULTS)).toBeInTheDocument();
    });
  });
});
