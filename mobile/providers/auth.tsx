import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';

import { setAuthToken, setUnauthorizedHandler } from '@/services/api';
import { getMe, login, register, type User } from '@/services/auth';
import { readSession, writeSession } from '@/services/session-storage';

interface AuthContextValue {
  user: User | null;
  /** True until the saved session has been checked on startup. */
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: { name: string; email: string; password: string; inviteCode: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const startSession = useCallback(async (token: string, sessionUser: User) => {
    setAuthToken(token);
    await writeSession({ token, user: sessionUser });
    setUser(sessionUser);
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    await writeSession(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());

    let active = true;
    (async () => {
      const saved = await readSession();
      if (!saved) {
        if (active) setLoading(false);
        return;
      }

      // Open right away with the saved session (works offline), then
      // refresh the user in the background: role changes, removed member.
      setAuthToken(saved.token);
      if (active) {
        setUser(saved.user);
        setLoading(false);
      }

      try {
        const me = await getMe();
        if (active) {
          setUser(me);
          await writeSession({ token: saved.token, user: me });
        }
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 401) {
          await signOut();
        }
      }
    })();

    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      signIn: async (email, password) => {
        const session = await login(email.trim(), password);
        await startSession(session.token, session.user);
      },
      signUp: async (payload) => {
        const session = await register({
          ...payload,
          name: payload.name.trim(),
          email: payload.email.trim(),
          inviteCode: payload.inviteCode.trim(),
        });
        await startSession(session.token, session.user);
      },
      signOut,
    }),
    [user, loading, signOut, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
