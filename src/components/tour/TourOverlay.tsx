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

function findElement(selector: string, padding: number): SpotlightRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left - padding,
    y: rect.top - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

export function TourOverlay() {
  const { isActive, currentStep } = useTour();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [visible, setVisible] = useState(false);
  const [bubbleReady, setBubbleReady] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Poll for the target element when step changes
  useEffect(() => {
    if (!isActive || !currentStep) return;
    setBubbleReady(false);
    setSpotlight(null);

    if (!currentStep.targetSelector) {
      // Center mode — no target
      setBubbleReady(true);
      return;
    }

    const padding = currentStep.highlightPadding ?? 8;
    let attempts = 0;

    const check = () => {
      const result = findElement(currentStep.targetSelector, padding);
      if (result) {
        setSpotlight(result);
        setBubbleReady(true);
        clearInterval(intervalRef.current);
      } else if (attempts++ > 20) {
        // Give up — show centered
        setSpotlight(null);
        setBubbleReady(true);
        clearInterval(intervalRef.current);
      }
    };

    // Initial check after short delay for navigation
    const timer = setTimeout(() => {
      check();
      intervalRef.current = setInterval(check, 150);
    }, 150);

    return () => {
      clearTimeout(timer);
      clearInterval(intervalRef.current);
    };
  }, [isActive, currentStep]);

  // Recalculate spotlight position on scroll/resize
  useEffect(() => {
    if (!isActive || !currentStep?.targetSelector) return;
    const padding = currentStep.highlightPadding ?? 8;

    const handler = () => {
      const result = findElement(currentStep.targetSelector, padding);
      if (result) setSpotlight(result);
    };

    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
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
    <div
      className="fixed inset-0 z-[100]"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Dimmed overlay with spotlight cutout */}
      <div
        className="absolute inset-0 motion-safe:transition-all motion-safe:duration-300"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          opacity: visible ? 1 : 0,
          clipPath: spotlight && !isCenter ? clipPath : undefined,
        }}
      />

      {/* Transparent clickable area over the spotlight to allow interaction */}
      {spotlight && !isCenter && (
        <div
          className="absolute"
          style={{
            left: spotlight.x,
            top: spotlight.y,
            width: spotlight.width,
            height: spotlight.height,
            pointerEvents: 'none',
            zIndex: 101,
          }}
        />
      )}

      {/* Tour bubble */}
      {bubbleReady && (
        <TourBubble spotlight={spotlight} />
      )}
    </div>
  );
}
