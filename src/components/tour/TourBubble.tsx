'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTour } from './useTour';
import { useLocale } from '@/lib/i18n';

interface TourBubbleProps {
  spotlight: { x: number; y: number; width: number; height: number } | null;
}

type ArrowDirection = 'up' | 'down' | 'left' | 'right' | 'none';

export function TourBubble({ spotlight }: TourBubbleProps) {
  const { currentStep, nextStep, skipTour, completeTour, currentStepIndex, steps } = useTour();
  const { t } = useLocale();

  // Re-trigger fade-in animation when step changes without unmounting the component.
  // Double-rAF ensures the browser has flushed the "no animation" frame before re-applying.
  const [animating, setAnimating] = useState(true);
  const prevStepRef = useRef(currentStepIndex);

  useEffect(() => {
    if (prevStepRef.current !== currentStepIndex) {
      prevStepRef.current = currentStepIndex;
      setAnimating(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimating(true);
        });
      });
    }
  }, [currentStepIndex]);

  const isLastStep = currentStep?.id === 'complete';
  const isCenter = currentStep?.position === 'center' || !currentStep?.targetSelector;

  // Track the visible area (visual viewport) in layout viewport coordinates.
  // When the mobile keyboard opens, the visual viewport shrinks and may scroll
  // within the layout viewport. The bubble (inside a fixed overlay) uses layout
  // viewport coordinates, so we need to know the visible bounds to clamp correctly.
  const [visibleBounds, setVisibleBounds] = useState(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    return {
      top: vv?.offsetTop ?? 0,
      left: vv?.offsetLeft ?? 0,
      w: vv?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 375),
      h: vv?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 812),
    };
  });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      setVisibleBounds({
        top: vv.offsetTop,
        left: vv.offsetLeft,
        w: vv.width,
        h: vv.height,
      });
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  const handleAction = () => {
    if (isLastStep) {
      completeTour();
    } else {
      nextStep();
    }
  };

  // Calculate bubble position + arrow direction
  const { style, arrow, arrowLeft } = useMemo(() => {
    if (isCenter || !spotlight) {
      return {
        style: {
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: 'min(360px, calc(100vw - 32px))',
        },
        arrow: 'none' as ArrowDirection,
        arrowLeft: 0,
      };
    }

    // Visible area in layout viewport coordinates
    const visTop = visibleBounds.top;
    const visLeft = visibleBounds.left;
    const visW = visibleBounds.w;
    const visH = visibleBounds.h;

    const bubbleWidth = Math.min(320, visW - 32);
    const bubbleEstHeight = 160; // approximate height of the bubble
    const position = currentStep?.position ?? 'bottom';
    const gap = 12;

    let top = 0;
    let left = 0;
    let arrowDir: ArrowDirection = 'none';
    let useTranslateY = false;

    // Determine the best position, flipping if it would go off-screen
    if (position === 'top') {
      // Try above the spotlight
      const aboveTop = spotlight.y - gap - bubbleEstHeight;
      if (aboveTop >= visTop + 8) {
        // Fits above
        top = spotlight.y - gap;
        arrowDir = 'down';
        useTranslateY = true;
      } else {
        // Flip to below
        top = spotlight.y + spotlight.height + gap;
        arrowDir = 'up';
      }
      left = spotlight.x + spotlight.width / 2 - bubbleWidth / 2;
    } else if (position === 'bottom') {
      // Try below the spotlight
      const belowBottom = spotlight.y + spotlight.height + gap + bubbleEstHeight;
      if (belowBottom <= visTop + visH - 8) {
        // Fits below
        top = spotlight.y + spotlight.height + gap;
        arrowDir = 'up';
      } else {
        // Flip to above
        top = spotlight.y - gap;
        arrowDir = 'down';
        useTranslateY = true;
      }
      left = spotlight.x + spotlight.width / 2 - bubbleWidth / 2;
    } else if (position === 'left') {
      top = spotlight.y + spotlight.height / 2;
      left = spotlight.x - bubbleWidth - gap;
      arrowDir = 'right';
    } else {
      top = spotlight.y + spotlight.height / 2;
      left = spotlight.x + spotlight.width + gap;
      arrowDir = 'left';
    }

    // Clamp to visible area (visual viewport in layout viewport coords)
    const clampedLeft = Math.max(visLeft + 16, Math.min(left, visLeft + visW - bubbleWidth - 16));

    // Clamp top so bubble stays within visible area
    if (!useTranslateY) {
      top = Math.max(visTop + 8, Math.min(top, visTop + visH - bubbleEstHeight - 8));
    }

    // Arrow points to the center of the spotlight element
    const spotlightCenterX = spotlight.x + spotlight.width / 2;
    const arrowLeftPx = Math.max(24, Math.min(spotlightCenterX - clampedLeft, bubbleWidth - 24));

    return {
      style: {
        left: `${clampedLeft}px`,
        top: `${top}px`,
        maxWidth: `${bubbleWidth}px`,
        transform: useTranslateY ? 'translateY(-100%)' : undefined,
      },
      arrow: arrowDir,
      arrowLeft: arrowLeftPx,
    };
  }, [spotlight, isCenter, currentStep?.position, visibleBounds]);

  if (!currentStep) return null;

  const showNextButton =
    currentStep.action === 'none' ||
    currentStep.action === 'navigate' ||
    currentStep.id === 'complete';

  return (
    <div
      className={`absolute z-[102] ${animating ? 'motion-safe:animate-fade-in' : 'opacity-0'}`}
      style={{
        ...style,
        pointerEvents: 'auto',
      }}
    >
      {/* Arrow pointing UP (bubble is below spotlight) */}
      {arrow === 'up' && (
        <div
          className="absolute -top-[6px]"
          style={{ left: `${arrowLeft}px`, transform: 'translateX(-50%)' }}
        >
          <div className="w-3 h-3 bg-surface rotate-45 rounded-sm shadow-sm" />
        </div>
      )}

      <div className="bg-surface text-text-primary rounded-2xl px-5 py-4 shadow-lg border border-border relative">
        <h3 className="text-base font-bold mb-1">
          {t(currentStep.titleKey)}
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          {t(currentStep.descriptionKey)}
        </p>

        <div className="flex items-center justify-between gap-3">
          {/* Step indicator */}
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === currentStepIndex
                    ? 'w-4 bg-accent'
                    : i < currentStepIndex
                    ? 'w-1.5 bg-accent/50'
                    : 'w-1.5 bg-border'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isLastStep && (
              <button
                type="button"
                onClick={skipTour}
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors min-h-[44px] px-2"
              >
                {t('tour.skipTour')}
              </button>
            )}
            {showNextButton && (
              <button
                type="button"
                onClick={handleAction}
                className="bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold px-4 py-2 rounded-xl transition-colors active:scale-95 min-h-[44px]"
              >
                {isLastStep ? t('tour.letsGo') : t('tour.next')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Arrow pointing DOWN (bubble is above spotlight) */}
      {arrow === 'down' && (
        <div
          className="absolute -bottom-[6px]"
          style={{ left: `${arrowLeft}px`, transform: 'translateX(-50%)' }}
        >
          <div className="w-3 h-3 bg-surface rotate-45 rounded-sm border-r border-b border-border" />
        </div>
      )}

      {/* Arrow pointing LEFT (bubble is to the right of spotlight) */}
      {arrow === 'left' && (
        <div
          className="absolute top-1/2 -left-[6px]"
          style={{ transform: 'translateY(-50%)' }}
        >
          <div className="w-3 h-3 bg-surface rotate-45 rounded-sm border-l border-b border-border" />
        </div>
      )}

      {/* Arrow pointing RIGHT (bubble is to the left of spotlight) */}
      {arrow === 'right' && (
        <div
          className="absolute top-1/2 -right-[6px]"
          style={{ transform: 'translateY(-50%)' }}
        >
          <div className="w-3 h-3 bg-surface rotate-45 rounded-sm border-r border-t border-border" />
        </div>
      )}
    </div>
  );
}
