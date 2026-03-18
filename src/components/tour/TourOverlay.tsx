'use client';

import { useEffect, useState, useRef } from 'react';
import { useTour } from './useTour';
import { TourBubble } from './TourBubble';

interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsEqual(a: SpotlightRect | null, b: SpotlightRect | null): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

function findElement(selector: string, padding: number): SpotlightRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();

  // getBoundingClientRect() returns coordinates relative to the visual viewport,
  // but the fixed overlay is positioned relative to the layout viewport.
  // When the mobile keyboard is open, these diverge — the visual viewport scrolls
  // within the layout viewport. We must offset to convert to layout viewport coords.
  const offsetX = window.visualViewport?.offsetLeft ?? 0;
  const offsetY = window.visualViewport?.offsetTop ?? 0;

  return {
    x: rect.left + offsetX - padding,
    y: rect.top + offsetY - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

export function TourOverlay() {
  const { isActive, currentStep } = useTour();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [visible, setVisible] = useState(false);
  const [bubbleReady, setBubbleReady] = useState(false);
  const rafRef = useRef<number>(0);
  const spotlightRef = useRef<SpotlightRect | null>(null);

  // Update spotlight only when position actually changed (avoids re-renders mid-tap)
  const updateSpotlight = (rect: SpotlightRect | null) => {
    if (!rectsEqual(rect, spotlightRef.current)) {
      spotlightRef.current = rect;
      setSpotlight(rect);
    }
  };

  // Poll for the target element when step changes using rAF instead of setInterval
  useEffect(() => {
    if (!isActive || !currentStep) return;
    setBubbleReady(false);
    setSpotlight(null);
    spotlightRef.current = null;

    if (!currentStep.targetSelector) {
      // Center mode — no target
      setBubbleReady(true);
      return;
    }

    const padding = currentStep.highlightPadding ?? 8;
    let attempts = 0;
    let lastCheck = 0;

    const check = (timestamp: number) => {
      // Throttle to ~150ms between checks
      if (timestamp - lastCheck < 150) {
        rafRef.current = requestAnimationFrame(check);
        return;
      }
      lastCheck = timestamp;

      const result = findElement(currentStep.targetSelector, padding);
      if (result) {
        updateSpotlight(result);
        setBubbleReady(true);
        return; // stop polling — element found
      }
      if (attempts++ > 20) {
        // Give up — show centered
        updateSpotlight(null);
        setBubbleReady(true);
        return;
      }
      rafRef.current = requestAnimationFrame(check);
    };

    // Initial delay for navigation to settle
    const timer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(check);
    }, 150);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, currentStep]);

  // Recalculate spotlight position on scroll/resize/visualViewport changes (deduplicated)
  useEffect(() => {
    if (!isActive || !currentStep?.targetSelector) return;
    const padding = currentStep.highlightPadding ?? 8;

    const handler = () => {
      const result = findElement(currentStep.targetSelector, padding);
      if (result) updateSpotlight(result);
    };

    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);

    // Listen to visualViewport changes (keyboard open/close on mobile)
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handler);
      vv.addEventListener('scroll', handler);
    }

    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
      if (vv) {
        vv.removeEventListener('resize', handler);
        vv.removeEventListener('scroll', handler);
      }
    };
  }, [isActive, currentStep]);

  // Fade in/out
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isActive]);

  if (!isActive || !currentStep) return null;

  const isCenter = currentStep.position === 'center' || !currentStep.targetSelector;

  // Build clip-path for spotlight cutout
  const clipPath = spotlight
    ? `polygon(
        0% 0%, 0% 100%,
        ${spotlight.x}px 100%,
        ${spotlight.x}px ${spotlight.y}px,
        ${spotlight.x + spotlight.width}px ${spotlight.y}px,
        ${spotlight.x + spotlight.width}px ${spotlight.y + spotlight.height}px,
        ${spotlight.x}px ${spotlight.y + spotlight.height}px,
        ${spotlight.x}px 100%,
        100% 100%, 100% 0%
      )`
    : undefined;

  return (
    <div className="fixed inset-0 z-[100]" style={{ pointerEvents: 'none' }}>
      {/* Dimmed overlay with spotlight cutout.
          The clip-path punches a hole where the spotlight is,
          so pointer events pass through the hole to the page below,
          while clicks on the dimmed area are blocked. */}
      <div
        className="absolute inset-0 motion-safe:transition-[opacity] motion-safe:duration-300"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          opacity: visible ? 1 : 0,
          clipPath: spotlight && !isCenter ? clipPath : undefined,
          pointerEvents: visible ? 'auto' : 'none',
        }}
      />

      {/* Tour bubble */}
      {bubbleReady && (
        <TourBubble spotlight={spotlight} />
      )}
    </div>
  );
}
