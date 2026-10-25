import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { api, setTokenProvider, ApiError } from '../api/client';
import type { TokenResponse, User } from '../api/types';
import { registerForPush } from '../notifications';
import { readToken, writeToken } from './tokenStorage';

type AuthState = {
  ready: boolean;
  user: User | null;
  token: string | null;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setTokenProvider(() => tokenRef.current);
  }, []);

  const applySession = useCallback((nextToken: string | null, nextUser: User | null) => {
    tokenRef.current = nextToken;
    setToken(nextToken);
    setUserState(nextUser);
  }, []);

  // Restore a stored session on launch, but only trust it after the server confirms it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readToken();
      if (stored) {
        tokenRef.current = stored;
        try {
          const me = await api<User>('/api/me');
          if (!cancelled) applySession(stored, me);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await writeToken(null);
            tokenRef.current = null;
          }
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const signIn = useCallback(
    async (nextToken: string, nextUser: User) => {
      await writeToken(nextToken);
      applySession(nextToken, nextUser);
      queryClient.clear();
      registerForPush().catch(() => undefined);
    },
    [applySession, queryClient],
  );

  const signOut = useCallback(async () => {
    await writeToken(null);
    applySession(null, null);
    queryClient.clear();
  }, [applySession, queryClient]);

  const refreshUser = useCallback(async () => {
    const me = await api<User>('/api/me');
    setUserState(me);
  }, []);

  const setUser = useCallback((next: User) => setUserState(next), []);

  const value = useMemo<AuthState>(
    () => ({ ready, user, token, signIn, signOut, refreshUser, setUser }),
    [ready, user, token, signIn, signOut, refreshUser, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export type { TokenResponse };
