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
  isBillingLocked: boolean;
  setPlan: (plan: Plan) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<string>;
  logout: () => void;
  refreshUser: () => Promise<void>;
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
  const [isBillingLocked, setIsBillingLocked] = useState<boolean>(false);

  const computeBillingLocked = useCallback((userData: UserDetails | null) => {
    if (!userData) return false;
    const effectivePlan: Plan = userData.plan === 'pro' ? 'pro' : 'trial';
    const subscriptionStatus = userData.subscriptionStatus ?? null;
    const trialEndsAtMs = userData.trialEndsAt ? new Date(userData.trialEndsAt).getTime() : null;
    const now = Date.now();

    if (effectivePlan === 'trial') {
      if (!trialEndsAtMs) return false;
      return trialEndsAtMs <= now;
    }

    if (!subscriptionStatus) return true;

    const allowedStatuses = new Set(['active', 'trialing']);
    if (allowedStatuses.has(subscriptionStatus)) {
      return false;
    }

    const blockedStatuses = new Set(['past_due', 'incomplete', 'incomplete_expired', 'canceled', 'unpaid']);
    if (blockedStatuses.has(subscriptionStatus)) {
      return true;
    }

    return true;
  }, []);

  const applyUser = useCallback((userData: UserDetails | null) => {
    setUser(userData);
    const effectivePlan = userData?.plan === 'pro' ? 'pro' : 'trial';
    setPlanState(effectivePlan);
    setIsBillingLocked(computeBillingLocked(userData));
  }, [computeBillingLocked]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setPlanState('trial');
    setIsBillingLocked(false);
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

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get('/auth/me');
      applyUser(data.user ?? null);
    } catch (error) {
      console.error('Error refreshing user', error);
    }
  }, [token, applyUser]);

  useEffect(() => {
    if (!token) return;
    refreshUser();
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
  }, [token, logout, refreshUser]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      setIsBillingLocked((prev) => {
        const next = computeBillingLocked(user);
        return prev === next ? prev : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [user, computeBillingLocked]);

  const subscriptionStatus = user?.subscriptionStatus ?? null;
  const trialEndsAt = user?.trialEndsAt ?? null;
  const currentPeriodEnd = user?.currentPeriodEnd ?? null;

  const value = useMemo(
    () => ({
      user,
      token,
      plan,
      subscriptionStatus,
      trialEndsAt,
      currentPeriodEnd,
      isBillingLocked,
      setPlan,
      login,
      register,
      logout,
      refreshUser,
    }),
    [
      user,
      token,
      plan,
      subscriptionStatus,
      trialEndsAt,
      currentPeriodEnd,
      isBillingLocked,
      login,
      register,
      logout,
      setPlan,
      refreshUser,
    ]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


