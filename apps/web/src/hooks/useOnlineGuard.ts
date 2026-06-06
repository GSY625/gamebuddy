import { useAuth } from '../context/AuthContext';

export function useOnlineGuard() {
  const { visibilityStatus, warnInvisible } = useAuth();
  const isOnline = visibilityStatus === 'online';

  const guard = (action: () => void | Promise<void>) => {
    if (!isOnline) {
      warnInvisible();
      return;
    }
    void action();
  };

  return { guard, isOnline, warnInvisible };
}
