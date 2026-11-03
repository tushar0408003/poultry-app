import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAuthToken, setUnauthorizedHandler } from '../api/client';
import { authApi } from '../api/endpoints';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_username';

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Keeps the JWT in the device's secure storage (Android Keystore / iOS Keychain). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [username, setUsername] = useState<string | null>(null);

  const logout = useCallback(async () => {
    setAuthToken(null);
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
    queryClient.clear();
    setUsername(null);
    setStatus('signedOut');
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => void logout());
    (async () => {
      const [token, savedUser] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      if (token) {
        setAuthToken(token);
        setUsername(savedUser);
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(async (user: string, password: string) => {
    const res = await authApi.login(user, password);
    setAuthToken(res.accessToken);
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, res.accessToken),
      SecureStore.setItemAsync(USER_KEY, res.user.username),
    ]);
    setUsername(res.user.username);
    setStatus('signedIn');
  }, []);

  const value = useMemo(() => ({ status, username, login, logout }), [status, username, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
