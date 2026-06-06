import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';

type HighlightOptions = {
  element: Element;
  title?: string;
  description: string;
  isLast?: boolean;
  onNext: () => void | Promise<void>;
  onSkip: () => void;
};

let activeDriver: Driver | null = null;

function forceCleanupDriverDom() {
  document.body.classList.remove('driver-active', 'driver-fade', 'driver-simple');
  document.querySelectorAll('.driver-active-element').forEach((el) => {
    el.classList.remove('driver-active-element');
  });
  document.getElementById('driver-dummy-element')?.remove();
  document.querySelector('.driver-overlay')?.remove();
}

export function destroyOnboardingDriver() {
  if (activeDriver?.isActive()) {
    activeDriver.destroy();
  }
  activeDriver = null;
  forceCleanupDriverDom();
}

function attachSkipButton(
  driverInstance: Driver,
  popover: { footerButtons: HTMLElement },
  onSkip: () => void,
) {
  if (popover.footerButtons.querySelector('.gb-onboarding-skip')) return;
  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'gb-onboarding-skip';
  skipBtn.textContent = '跳过指引';
  skipBtn.addEventListener('click', () => {
    destroyOnboardingDriver();
    onSkip();
  });
  popover.footerButtons.insertBefore(
    skipBtn,
    popover.footerButtons.firstChild,
  );
}

export function showOnboardingHighlight({
  element,
  title,
  description,
  isLast,
  onNext,
  onSkip,
}: HighlightOptions) {
  destroyOnboardingDriver();

  const driverInstance = driver({
    animate: true,
    allowClose: false,
    overlayOpacity: 0.72,
    stagePadding: 10,
    stageRadius: 12,
    popoverClass: 'gb-onboarding-popover',
    disableActiveInteraction: true,
    onPopoverRender: (popover) => {
      attachSkipButton(driverInstance, popover, onSkip);
    },
  });

  activeDriver = driverInstance;

  element.scrollIntoView({ block: 'center', behavior: 'smooth' });

  driverInstance.highlight({
    element,
    popover: {
      title,
      description,
      side: 'bottom',
      align: 'center',
      showButtons: ['next'],
      nextBtnText: isLast ? '完成' : '下一步',
      onNextClick: () => {
        destroyOnboardingDriver();
        void Promise.resolve(onNext());
      },
    },
  });
}

export function waitForElement(
  selector: string,
  timeoutMs = 8000,
): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const el = document.querySelector(selector);
      if (el || Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        resolve(el);
      }
    }, 120);
  });
}
