import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import {
  ONBOARDING_STEPS,
  VALORANT_SLUG,
  type OnboardingStepId,
} from '../onboarding/constants';
import {
  clearPersistedOnboarding,
  readPersistedOnboarding,
  writePersistedOnboarding,
} from '../onboarding/storage';
import { destroyOnboardingDriver } from '../onboarding/driver';

type OnboardingCtx = {
  active: boolean;
  step: OnboardingStepId | null;
  valorantGameId: string | null;
  startTour: () => Promise<void>;
  nextStep: () => void;
  skipTour: () => void;
};

const OnboardingContext = createContext<OnboardingCtx | null>(null);

function getNextStep(current: OnboardingStepId): OnboardingStepId | null {
  const index = ONBOARDING_STEPS.indexOf(current);
  if (index < 0 || index >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[index + 1] ?? null;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<OnboardingStepId | null>(null);
  const [valorantGameId, setValorantGameId] = useState<string | null>(null);

  const persist = useCallback(
    (
      nextActive: boolean,
      nextStep: OnboardingStepId | null,
      nextValorantId: string | null,
    ) => {
      writePersistedOnboarding({
        active: nextActive,
        step: nextStep,
        valorantGameId: nextValorantId,
      });
    },
    [],
  );

  const finishTour = useCallback(() => {
    destroyOnboardingDriver();
    setActive(false);
    setStep(null);
    clearPersistedOnboarding();
  }, []);

  const resolveValorantId = useCallback(async () => {
    if (valorantGameId) return valorantGameId;
    const games = (await api.getGames()) as { id: string; slug: string }[];
    const valorant = games.find((g) => g.slug === VALORANT_SLUG);
    if (!valorant) {
      throw new Error('未找到无畏契约游戏分区');
    }
    setValorantGameId(valorant.id);
    return valorant.id;
  }, [valorantGameId]);

  const startTour = useCallback(async () => {
    try {
      destroyOnboardingDriver();
      const gameId = await resolveValorantId();
      setActive(true);
      setStep('games-select');
      persist(true, 'games-select', gameId);
      navigate('/games');
    } catch (err) {
      alert(err instanceof Error ? err.message : '无法启动指引');
    }
  }, [navigate, persist, resolveValorantId]);

  const skipTour = useCallback(() => {
    finishTour();
  }, [finishTour]);

  const nextStep = useCallback(() => {
    if (!step) return;

    const upcoming = getNextStep(step);
    if (!upcoming) {
      finishTour();
      return;
    }

    setStep(upcoming);
    persist(true, upcoming, valorantGameId);

    if (upcoming === 'games-select') {
      navigate('/games');
      return;
    }

    if (
      upcoming === 'valorant-create' ||
      upcoming === 'valorant-saved' ||
      upcoming === 'valorant-browse-search' ||
      upcoming === 'valorant-browse-invite'
    ) {
      if (!valorantGameId) {
        void resolveValorantId().then((id) => {
          navigate(`/games/${id}`);
        });
        return;
      }
      navigate(`/games/${valorantGameId}`);
    }
  }, [
    finishTour,
    navigate,
    persist,
    resolveValorantId,
    step,
    valorantGameId,
  ]);

  useEffect(() => {
    const saved = readPersistedOnboarding();
    if (!saved?.active || !saved.step) return;
    setActive(true);
    setStep(saved.step);
    if (saved.valorantGameId) {
      setValorantGameId(saved.valorantGameId);
    }
    if (saved.step === 'games-select') {
      navigate('/games');
      return;
    }
    if (saved.valorantGameId) {
      navigate(`/games/${saved.valorantGameId}`);
    }
  }, [navigate]);

  const value = useMemo(
    () => ({
      active,
      step,
      valorantGameId,
      startTour,
      nextStep,
      skipTour,
    }),
    [active, step, valorantGameId, startTour, nextStep, skipTour],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return ctx;
}
