import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken, refreshToken } from '../services/api';

type Plan = 'trial' | 'pro';
type User = { id: string; email: string; name?: string; plan?: Plan } | null;

type AuthContextType = {
  user: User;
  token: string | null;
  plan: Plan;
  setPlan: (plan: Plan) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [plan, setPlan] = useState<Plan>(() => {
    const stored = localStorage.getItem('user_plan');
    return stored === 'pro' ? 'pro' : 'trial';
  });

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
    setUser(data.user);
    if (data.user?.plan) {
      setPlan(data.user.plan === 'pro' ? 'pro' : 'trial');
    } else {
      setPlan('trial');
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    setToken(data.token);
    setUser(data.user);
    if (data.user?.plan) {
      setPlan(data.user.plan === 'pro' ? 'pro' : 'trial');
    } else {
      setPlan('trial');
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setPlan('trial');
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

  const value = useMemo(
    () => ({ user, token, plan, setPlan, login, register, logout }),
    [user, token, plan, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


