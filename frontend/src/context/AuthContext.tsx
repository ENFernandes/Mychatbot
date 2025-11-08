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
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [plan, setPlanState] = useState<Plan>(() => {
    const stored = localStorage.getItem('user_plan');
    return stored === 'pro' ? 'pro' : 'trial';
  });

  const applyUser = useCallback((userData: UserDetails | null) => {
    setUser(userData);
    const effectivePlan = userData?.plan === 'pro' ? 'pro' : 'trial';
    setPlanState(effectivePlan);
  }, []);

  useEffect(() => {
    setAccessToken(token);
    if (token) localStorage.setItem('access_token', token);
    else localStorage.removeItem('access_token');
  }, [token]);

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
    setToken(data.token);
    applyUser(data.user ?? null);
  }, [applyUser]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setPlanState('trial');
  }, []);

  const setPlan = useCallback((nextPlan: Plan) => {
    setPlanState(nextPlan);
    setUser((prev) => (prev ? { ...prev, plan: nextPlan } : prev));
  }, []);

  // Auto refresh simplistic timer (every 2.5h) if token exists
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      const newToken = await refreshToken(token);
      if (newToken) setToken(newToken);
      else logout();
    }, 2.5 * 60 * 60 * 1000);
    return () => clearInterval(interval);
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


