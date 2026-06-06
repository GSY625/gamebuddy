import { useEffect, useRef } from 'react';
import { useOnboarding } from '../context/OnboardingContext';
import { ONBOARDING_COPY, type OnboardingStepId } from '../onboarding/constants';
import {
  destroyOnboardingDriver,
  showOnboardingHighlight,
  waitForElement,
} from '../onboarding/driver';

type Props = {
  stepId: OnboardingStepId;
  selector: string;
  isLast?: boolean;
  enabled?: boolean;
  onBeforeNext?: () => void | Promise<void>;
};

export function OnboardingSpotlight({
  stepId,
  selector,
  isLast,
  enabled = true,
  onBeforeNext,
}: Props) {
  const { active, step, nextStep, skipTour } = useOnboarding();
  const shownRef = useRef(false);
  const onBeforeNextRef = useRef(onBeforeNext);
  onBeforeNextRef.current = onBeforeNext;

  useEffect(() => {
    if (!enabled || !active || step !== stepId) {
      if (shownRef.current) {
        destroyOnboardingDriver();
        shownRef.current = false;
      }
      return;
    }

    let cancelled = false;

    const run = async () => {
      const element = await waitForElement(selector);
      if (cancelled || !element) return;
      if (shownRef.current) return;
      shownRef.current = true;

      const copy = ONBOARDING_COPY[stepId];
      showOnboardingHighlight({
        element,
        title: copy.title,
        description: copy.description,
        isLast,
        onNext: async () => {
          await onBeforeNextRef.current?.();
          nextStep();
        },
        onSkip: skipTour,
      });
    };

    void run();

    return () => {
      cancelled = true;
      if (shownRef.current) {
        destroyOnboardingDriver();
        shownRef.current = false;
      }
    };
  }, [active, step, stepId, selector, isLast, enabled, nextStep, skipTour]);

  return null;
}
