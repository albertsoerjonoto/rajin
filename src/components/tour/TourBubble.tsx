'use client';

import { useMemo } from 'react';
import { useTour } from './useTour';
import { useLocale } from '@/lib/i18n';

interface TourBubbleProps {
  spotlight: { x: number; y: number; width: number; height: number } | null;
}

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

  // Calculate bubble position
  const style = useMemo(() => {
    if (isCenter || !spotlight) {
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 'min(360px, calc(100vw - 32px))',
      };
    }

    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 375;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 812;
    const bubbleWidth = Math.min(320, viewportW - 32);
    const position = currentStep?.position ?? 'bottom';

    let top = 0;
    let left = 0;

    if (position === 'top') {
      top = spotlight.y - 16;
      left = spotlight.x + spotlight.width / 2 - bubbleWidth / 2;
    } else if (position === 'bottom') {
      top = spotlight.y + spotlight.height + 16;
      left = spotlight.x + spotlight.width / 2 - bubbleWidth / 2;
    } else if (position === 'left') {
      top = spotlight.y + spotlight.height / 2;
      left = spotlight.x - bubbleWidth - 16;
    } else {
      top = spotlight.y + spotlight.height / 2;
      left = spotlight.x + spotlight.width + 16;
    }

    // Clamp to viewport
    left = Math.max(16, Math.min(left, viewportW - bubbleWidth - 16));

    // If bubble would go below viewport, put it above
    if (position === 'bottom' && top + 150 > viewportH) {
      top = spotlight.y - 16;
      return {
        left: `${left}px`,
        bottom: `${viewportH - top}px`,
        maxWidth: `${bubbleWidth}px`,
      };
    }

    // If bubble would go above viewport, put it below
    if (position === 'top' && top < 60) {
      top = spotlight.y + spotlight.height + 16;
    }

    return {
      left: `${left}px`,
      top: `${top}px`,
      maxWidth: `${bubbleWidth}px`,
      transform: position === 'top' ? 'translateY(-100%)' : undefined,
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
      <div className="bg-gray-900 text-white rounded-2xl px-5 py-4 shadow-2xl">
        <h3 className="text-base font-bold mb-1">
          {t(currentStep.titleKey)}
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
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
                    ? 'w-4 bg-emerald-400'
                    : i < currentStepIndex
                    ? 'w-1.5 bg-emerald-400/50'
                    : 'w-1.5 bg-gray-600'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isLastStep && (
              <button
                type="button"
                onClick={skipTour}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors min-h-[44px] px-2"
              >
                {t('tour.skipTour')}
              </button>
            )}
            {showNextButton && (
              <button
                type="button"
                onClick={handleAction}
                className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-95 min-h-[44px]"
              >
                {t(currentStep.skipLabelKey ?? 'tour.next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
