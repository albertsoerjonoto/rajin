'use client';

import React, { useMemo } from 'react';

/* ────────────────────────────────────────────────────────
   Lightweight markdown renderer for Gemini AI responses.
   Supports: **bold**, * / - bullets, 1. numbered lists,
   ## headings, and plain paragraphs.
   ──────────────────────────────────────────────────────── */

interface Props {
  content: string;
}

// Inline: convert **bold** spans
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-text-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

interface Block {
  type: 'heading' | 'ul' | 'ol' | 'paragraph';
  items?: string[];   // list items
  text?: string;       // heading / paragraph
  level?: number;      // heading level (2 or 3)
}

function parseBlocks(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Heading: ## or ###
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', text: headingMatch[2], level: headingMatch[1].length });
      i++;
      continue;
    }

    // Unordered list item: * or -
    if (/^\s*[*\-]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[*\-]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[*\-]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list item: 1.
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Bold-only line used as section header (e.g. "**Today's Food Log:**")
    const sectionMatch = line.match(/^\*\*(.+?):?\*\*:?\s*$/);
    if (sectionMatch) {
      blocks.push({ type: 'heading', text: sectionMatch[1], level: 3 });
      i++;
      continue;
    }

    // Regular paragraph
    blocks.push({ type: 'paragraph', text: line });
    i++;
  }

  return blocks;
}

export default function MarkdownContent({ content }: Props) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return block.level === 1 || block.level === 2 ? (
              <h3 key={i} className="text-[0.9rem] font-bold text-text-primary mt-3 first:mt-0">
                {renderInline(block.text!)}
              </h3>
            ) : (
              <h4 key={i} className="text-sm font-semibold text-text-primary mt-2.5 first:mt-0">
                {renderInline(block.text!)}
              </h4>
            );

          case 'ul':
            return (
              <ul key={i} className="space-y-1 pl-1">
                {block.items!.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="text-positive shrink-0 mt-0.5">•</span>
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol key={i} className="space-y-1.5 pl-1">
                {block.items!.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="text-positive font-semibold shrink-0 min-w-[1.25rem] text-right">
                      {j + 1}.
                    </span>
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            );

          case 'paragraph':
          default:
            return (
              <p key={i}>{renderInline(block.text!)}</p>
            );
        }
      })}
    </div>
  );
}
