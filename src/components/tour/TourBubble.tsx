'use client';

import { useMemo } from 'react';
import { useTour } from './useTour';
import { useLocale } from '@/lib/i18n';

interface TourBubbleProps {
  spotlight: { x: number; y: number; width: number; height: number } | null;
}

type ArrowDirection = 'up' | 'down' | 'left' | 'right' | 'none';

export function TourBubble({ spotlight }: TourBubbleProps) {
  const { currentStep, nextStep, skipTour, completeTour, currentStepIndex, steps } = useTour();
  const { t } = useLocale();

  const isLastStep = currentStep?.id === 'complete';
  const isCenter = currentStep?.position === 'center' || !currentStep?.targetSelector;

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

    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 375;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 812;
    const bubbleWidth = Math.min(320, viewportW - 32);
    const position = currentStep?.position ?? 'bottom';

    let top = 0;
    let left = 0;
    let arrowDir: ArrowDirection = 'none';

    if (position === 'top') {
      top = spotlight.y - 12;
      left = spotlight.x + spotlight.width / 2 - bubbleWidth / 2;
      arrowDir = 'down';
    } else if (position === 'bottom') {
      top = spotlight.y + spotlight.height + 12;
      left = spotlight.x + spotlight.width / 2 - bubbleWidth / 2;
      arrowDir = 'up';
    } else if (position === 'left') {
      top = spotlight.y + spotlight.height / 2;
      left = spotlight.x - bubbleWidth - 12;
      arrowDir = 'right';
    } else {
      top = spotlight.y + spotlight.height / 2;
      left = spotlight.x + spotlight.width + 12;
      arrowDir = 'left';
    }

    // Clamp to viewport
    const clampedLeft = Math.max(16, Math.min(left, viewportW - bubbleWidth - 16));

    // Arrow points to the center of the spotlight element
    const spotlightCenterX = spotlight.x + spotlight.width / 2;
    const arrowLeftPx = Math.max(24, Math.min(spotlightCenterX - clampedLeft, bubbleWidth - 24));

    // If bubble would go below viewport, put it above
    if (position === 'bottom' && top + 150 > viewportH) {
      top = spotlight.y - 12;
      return {
        style: {
          left: `${clampedLeft}px`,
          bottom: `${viewportH - top}px`,
          maxWidth: `${bubbleWidth}px`,
        },
        arrow: 'down' as ArrowDirection,
        arrowLeft: arrowLeftPx,
      };
    }

    // If bubble would go above viewport, put it below
    if (position === 'top' && top < 60) {
      top = spotlight.y + spotlight.height + 12;
      arrowDir = 'up';
    }

    return {
      style: {
        left: `${clampedLeft}px`,
        top: `${top}px`,
        maxWidth: `${bubbleWidth}px`,
        transform: position === 'top' ? 'translateY(-100%)' : undefined,
      },
      arrow: arrowDir,
      arrowLeft: arrowLeftPx,
    };
  }, [spotlight, isCenter, currentStep?.position]);

  if (!currentStep) return null;

  const showNextButton =
    currentStep.action === 'none' ||
    currentStep.action === 'navigate' ||
    currentStep.id === 'complete';

  return (
    <div
      key={currentStepIndex}
      className="absolute z-[102] motion-safe:animate-fade-in"
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
                className="bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-95 min-h-[44px]"
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
