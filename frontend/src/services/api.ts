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

// File upload types
export interface FileUploadResponse {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface MultipleFileUploadResponse {
  files: FileUploadResponse[];
}

/**
 * Upload a single file to the backend
 */
export async function uploadFile(file: File): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post<FileUploadResponse>('/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return data;
}

/**
 * Upload multiple files to the backend
 */
export async function uploadMultipleFiles(files: File[]): Promise<FileUploadResponse[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const { data } = await api.post<MultipleFileUploadResponse>('/files/upload-multiple', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return data.files;
}

/**
 * Get file metadata
 */
export async function getFileMetadata(fileId: string): Promise<FileUploadResponse> {
  const { data } = await api.get<FileUploadResponse>(`/files/${fileId}`);
  return data;
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: string): Promise<void> {
  await api.delete(`/files/${fileId}`);
}

// Project types
export interface Project {
  id: string;
  name: string;
  description: string | null;
  conversation_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectsResponse {
  projects: Project[];
}

/**
 * Get all projects for the current user
 */
export async function getProjects(): Promise<Project[]> {
  const { data } = await api.get<ProjectsResponse>('/projects');
  return data.projects;
}

/**
 * Create a new project
 */
export async function createProject(name: string, description?: string): Promise<Project> {
  const { data } = await api.post<Project>('/projects', { name, description });
  return data;
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: { name?: string; description?: string }
): Promise<void> {
  await api.patch(`/projects/${projectId}`, updates);
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<void> {
  await api.delete(`/projects/${projectId}`);
}

/**
 * Get conversations in a project
 */
export async function getProjectConversations(projectId: string): Promise<any[]> {
  const { data } = await api.get(`/projects/${projectId}/conversations`);
  return data.conversations;
}

/**
 * Move a conversation to a project (or remove from project if projectId is null)
 */
export async function moveConversationToProject(
  conversationId: string,
  projectId: string | null
): Promise<void> {
  await api.patch(`/conversations/${conversationId}`, { projectId });
}


