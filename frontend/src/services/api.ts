import axios from 'axios';

// Determine API base URL
// Priority: 1. Environment variable, 2. Development mode with direct URL, 3. Relative path (proxy/nginx)
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

  // In production, use relative path (nginx will proxy to backend:3001)
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


