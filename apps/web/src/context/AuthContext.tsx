import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { api } from '@gamebuddy/api-client';
import { ThemeToast } from '../components/ThemeToast';

export type VisibilityStatus = 'online' | 'invisible';

export type NicknameCooldown = {
  canChange: boolean;
  nextChangeAt: string | null;
  remainingMs: number;
};

export type User = {
  id: string;
  email: string;
  nickname: string;
  role?: 'user' | 'admin' | 'superAdmin';
  avatarUrl?: string | null;
  bio?: string | null;
  visibilityStatus?: VisibilityStatus;
  nicknameCooldown?: NicknameCooldown;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  visibilityStatus: VisibilityStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    nickname: string;
    code: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setVisibilityStatus: (status: VisibilityStatus) => Promise<void>;
  warnInvisible: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [invisibleToast, setInvisibleToast] = useState(false);

  const visibilityStatus: VisibilityStatus =
    user?.visibilityStatus === 'invisible' ? 'invisible' : 'online';

  const refreshUser = async () => {
    try {
      const me = (await api.getMe()) as User;
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    await api.login({ email, password });
    await refreshUser();
  };

  const register = async (data: {
    email: string;
    password: string;
    nickname: string;
    code: string;
  }) => {
    await api.register(data);
    await refreshUser();
  };

  const logout = () => {
    void api.logout().catch(() => {});
    setUser(null);
  };

  const setVisibilityStatus = async (status: VisibilityStatus) => {
    await api.setVisibility(status);
    await refreshUser();
  };

  const warnInvisible = useCallback(() => {
    setInvisibleToast(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        visibilityStatus,
        login,
        register,
        logout,
        refreshUser,
        setVisibilityStatus,
        warnInvisible,
      }}
    >
      {children}
      <ThemeToast
        message="请先切换为在线状态"
        show={invisibleToast}
        onClose={() => setInvisibleToast(false)}
        variant="warn"
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside Provider');
  return ctx;
}
