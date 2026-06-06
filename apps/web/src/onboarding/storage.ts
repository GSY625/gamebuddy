import {
  ONBOARDING_STORAGE_KEYS,
  ONBOARDING_VERSION,
  type OnboardingStepId,
} from './constants';

export type PersistedOnboarding = {
  active: boolean;
  step: OnboardingStepId | null;
  valorantGameId: string | null;
};

function readVersion(): number {
  const raw = localStorage.getItem(ONBOARDING_STORAGE_KEYS.version);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function readPersistedOnboarding(): PersistedOnboarding | null {
  if (readVersion() !== ONBOARDING_VERSION) {
    clearPersistedOnboarding();
    return null;
  }
  if (localStorage.getItem(ONBOARDING_STORAGE_KEYS.active) !== 'true') {
    return null;
  }
  const step = localStorage.getItem(
    ONBOARDING_STORAGE_KEYS.step,
  ) as OnboardingStepId | null;
  const valorantGameId = localStorage.getItem(
    ONBOARDING_STORAGE_KEYS.valorantGameId,
  );
  return {
    active: true,
    step,
    valorantGameId,
  };
}

export function writePersistedOnboarding(state: PersistedOnboarding) {
  localStorage.setItem(
    ONBOARDING_STORAGE_KEYS.version,
    String(ONBOARDING_VERSION),
  );
  if (!state.active) {
    clearPersistedOnboarding();
    return;
  }
  localStorage.setItem(ONBOARDING_STORAGE_KEYS.active, 'true');
  if (state.step) {
    localStorage.setItem(ONBOARDING_STORAGE_KEYS.step, state.step);
  } else {
    localStorage.removeItem(ONBOARDING_STORAGE_KEYS.step);
  }
  if (state.valorantGameId) {
    localStorage.setItem(
      ONBOARDING_STORAGE_KEYS.valorantGameId,
      state.valorantGameId,
    );
  } else {
    localStorage.removeItem(ONBOARDING_STORAGE_KEYS.valorantGameId);
  }
}

export function clearPersistedOnboarding() {
  localStorage.setItem(
    ONBOARDING_STORAGE_KEYS.version,
    String(ONBOARDING_VERSION),
  );
  localStorage.removeItem(ONBOARDING_STORAGE_KEYS.active);
  localStorage.removeItem(ONBOARDING_STORAGE_KEYS.step);
  localStorage.removeItem(ONBOARDING_STORAGE_KEYS.valorantGameId);
}
