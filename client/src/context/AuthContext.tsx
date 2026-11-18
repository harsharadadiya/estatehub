// Who is logged in? Shared with the whole app through React Context.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { setUnauthorizedHandler, tokenStore } from '@/lib/api';
import { authService, userService } from '@/services';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  login: (data: { email: string; password: string }) => Promise<User>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<User>;
  startSession: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  // While we check a saved token on first load, protected pages wait instead of redirecting
  const [initializing, setInitializing] = useState(() => Boolean(tokenStore.get()));

  const startSession = useCallback((token: string, nextUser: User) => {
    tokenStore.set(token);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    queryClient.removeQueries({ queryKey: ['dashboard'] });
    queryClient.removeQueries({ queryKey: ['appointments'] });
  }, [queryClient]);

  // Any 401 from the API with our token = the session ended (expired or password changed)
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (tokenStore.get()) toast.error('Your session has ended. Please log in again.');
      logout();
    });
  }, [logout]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    userService
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setInitializing(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      startSession,
      logout,
      setUser,
      login: async (data) => {
        const session = await authService.login(data);
        startSession(session.token, session.user);
        return session.user;
      },
      register: async (data) => {
        const session = await authService.register(data);
        startSession(session.token, session.user);
        return session.user;
      },
    }),
    [user, initializing, startSession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
