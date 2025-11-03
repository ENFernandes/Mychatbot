import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

api.interceptors.request.use((config) => {
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


