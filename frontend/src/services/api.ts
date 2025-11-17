import axios from 'axios';

// Determine API base URL
// Priority: 1. Environment variable, 2. Auto-detect from current domain, 3. Development mode, 4. Relative path
const getApiBaseUrl = (): string => {
  // Check for environment variable first
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) {
    return envUrl;
  }

  // In development, use direct URL to backend (port 3001)
  const isDev = (import.meta as any).env?.DEV || (import.meta as any).env?.MODE === 'development';
  if (isDev) {
    return 'http://localhost:3001/api';
  }

  // In production, auto-detect API URL from current domain
  // If on www.multiproviderai.me, use api.multiproviderai.me
  // If on multiproviderai-frontend-*.koyeb.app, use multiproviderai-*.koyeb.app
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production domain: www.multiproviderai.me -> api.multiproviderai.me
    if (hostname === 'www.multiproviderai.me' || hostname === 'multiproviderai.me') {
      return 'https://api.multiproviderai.me/api';
    }
    
    // Koyeb temporary domain: multiproviderai-frontend-*.koyeb.app -> multiproviderai-*.koyeb.app
    if (hostname.includes('multiproviderai-frontend') && hostname.includes('koyeb.app')) {
      const backendHostname = hostname.replace('multiproviderai-frontend', 'multiproviderai');
      return `https://${backendHostname}/api`;
    }
  }

  // Fallback to relative path (should not happen in production)
  return '/api';
};

export const api = axios.create({ baseURL: getApiBaseUrl() });

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  // Try to get token from localStorage if not set in memory
  if (!accessToken) {
    const stored = localStorage.getItem('access_token');
    if (stored) {
      accessToken = stored;
    }
  }
  
  if (accessToken) {
    config.headers = config.headers || {};
    (config.headers as any)['Authorization'] = `Bearer ${accessToken}`;
  }
  return config;
});

export async function refreshToken(currentToken: string) {
  try {
    const { data } = await api.post('/auth/refresh', { token: currentToken });
    return data.token as string;
  } catch (e) {
    return null;
  }
}


