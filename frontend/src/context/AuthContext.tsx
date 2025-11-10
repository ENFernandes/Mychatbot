import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken, refreshToken } from '../services/api';

type Plan = 'trial' | 'pro';
type UserDetails = {
  id: string;
  email: string;
  name?: string;
  plan?: Plan;
  subscriptionStatus?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
};
type User = UserDetails | null;

type AuthContextType = {
  user: User;
  token: string | null;
  plan: Plan;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  setPlan: (plan: Plan) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<string>;
  logout: () => void;
};

type JwtPayload = {
  exp?: number;
  [key: string]: unknown;
};

function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.length % 4 === 0 ? base64 : base64 + '='.repeat(4 - (base64.length % 4));
    const decoded = atob(padded);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string, bufferMs = 0): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now() + bufferMs;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem('access_token');
    if (stored && isTokenExpired(stored)) {
      localStorage.removeItem('access_token');
      return null;
    }
    return stored;
  });
  const [plan, setPlanState] = useState<Plan>(() => {
    const stored = localStorage.getItem('user_plan');
    return stored === 'pro' ? 'pro' : 'trial';
  });

  const applyUser = useCallback((userData: UserDetails | null) => {
    setUser(userData);
    const effectivePlan = userData?.plan === 'pro' ? 'pro' : 'trial';
    setPlanState(effectivePlan);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setPlanState('trial');
  }, []);

  useEffect(() => {
    if (!token) {
      setAccessToken(null);
      localStorage.removeItem('access_token');
      return;
    }
    if (isTokenExpired(token)) {
      setAccessToken(null);
      localStorage.removeItem('access_token');
      logout();
      return;
    }
    setAccessToken(token);
    localStorage.setItem('access_token', token);
  }, [token, logout]);

  useEffect(() => {
    localStorage.setItem('user_plan', plan);
  }, [plan]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setToken(data.token);
    applyUser(data.user ?? null);
  }, [applyUser]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    if (data?.token) {
      setToken(data.token);
      applyUser(data.user ?? null);
    }
    return data?.message || 'Verification email sent. Please confirm to activate your account.';
  }, [applyUser]);

  const setPlan = useCallback((nextPlan: Plan) => {
    setPlanState(nextPlan);
    setUser((prev) => (prev ? { ...prev, plan: nextPlan } : prev));
  }, []);

  useEffect(() => {
    if (!token) return;
    const payload = decodeJwt(token);
    const exp = payload?.exp ? payload.exp * 1000 : null;
    if (exp && exp <= Date.now()) {
      logout();
      return;
    }
    const refreshDelay = exp
      ? Math.max(exp - Date.now() - 60 * 1000, 60 * 1000)
      : 2.5 * 60 * 60 * 1000;

    const timeout = setTimeout(async () => {
      try {
        const newToken = await refreshToken(token);
        if (newToken && !isTokenExpired(newToken, 5 * 1000)) {
          setToken(newToken);
        } else {
          logout();
        }
      } catch {
        logout();
      }
    }, refreshDelay);

    return () => clearTimeout(timeout);
  }, [token, logout]);

  const subscriptionStatus = user?.subscriptionStatus ?? null;
  const trialEndsAt = user?.trialEndsAt ?? null;
  const currentPeriodEnd = user?.currentPeriodEnd ?? null;

  const value = useMemo(
    () => ({ user, token, plan, subscriptionStatus, trialEndsAt, currentPeriodEnd, setPlan, login, register, logout }),
    [user, token, plan, subscriptionStatus, trialEndsAt, currentPeriodEnd, login, register, logout, setPlan]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


