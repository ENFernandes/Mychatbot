// Supported MIME types by provider
export const SUPPORTED_MIME_TYPES = {
  // OpenAI supported types
  openai: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/csv',
    'text/html',
    'application/json',
  ],
  // Anthropic (Claude) supported types
  claude: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'text/csv',
    'text/plain',
    'text/html',
    'application/vnd.oasis.opendocument.text', // ODT
    'application/rtf',
    'application/epub+zip',
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
  ],
  // Gemini supported types
  gemini: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/csv',
    'text/html',
    'application/json',
    'video/mp4',
    'video/mpeg',
    'video/webm',
    'audio/mp3',
    'audio/wav',
    'audio/mpeg',
  ],
};

// All supported types (union of all providers)
export const ALL_SUPPORTED_MIME_TYPES = Array.from(
  new Set([
    ...SUPPORTED_MIME_TYPES.openai,
    ...SUPPORTED_MIME_TYPES.claude,
    ...SUPPORTED_MIME_TYPES.gemini,
  ])
);

// File size limits (in bytes)
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_FILES_PER_MESSAGE = 10;

// Extension to MIME type mapping
export const EXTENSION_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.json': 'application/json',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.rtf': 'application/rtf',
  '.epub': 'application/epub+zip',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.mp4': 'video/mp4',
  '.mpeg': 'video/mpeg',
  '.webm': 'video/webm',
  '.mp3': 'audio/mp3',
  '.wav': 'audio/wav',
};

export interface UploadedFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  uploadedAt: Date;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate file type based on MIME type
 */
export function validateFileType(mimeType: string, provider?: 'openai' | 'gemini' | 'claude'): FileValidationResult {
  if (provider) {
    const supportedTypes = SUPPORTED_MIME_TYPES[provider];
    if (!supportedTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `File type ${mimeType} is not supported by ${provider}. Supported types: ${supportedTypes.join(', ')}`,
      };
    }
  } else {
    if (!ALL_SUPPORTED_MIME_TYPES.includes(mimeType)) {
      return {
        valid: false,
        error: `File type ${mimeType} is not supported. Supported types: ${ALL_SUPPORTED_MIME_TYPES.join(', ')}`,
      };
    }
  }
  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(size: number): FileValidationResult {
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size ${(size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }
  return { valid: true };
}

/**
 * Validate number of files
 */
export function validateFileCount(count: number): FileValidationResult {
  if (count > MAX_FILES_PER_MESSAGE) {
    return {
      valid: false,
      error: `Too many files (${count}). Maximum allowed is ${MAX_FILES_PER_MESSAGE} files per message`,
    };
  }
  return { valid: true };
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(filename: string): string | null {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (ext && EXTENSION_TO_MIME[ext]) {
    return EXTENSION_TO_MIME[ext];
  }
  return null;
}

/**
 * Check if file type is an image
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Check if file type is a document (PDF, DOCX, etc.)
 */
export function isDocumentFile(mimeType: string): boolean {
  const documentTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'application/epub+zip',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  return documentTypes.includes(mimeType);
}

/**
 * Check if file type is supported by a specific provider
 */
export function isFileSupportedByProvider(mimeType: string, provider: 'openai' | 'gemini' | 'claude'): boolean {
  return SUPPORTED_MIME_TYPES[provider].includes(mimeType);
}

// In-memory file store (for temporary storage before sending to providers)
const fileStore = new Map<string, UploadedFile>();

/**
 * Store a file temporarily
 */
export function storeFile(file: UploadedFile): void {
  fileStore.set(file.id, file);
}

/**
 * Retrieve a stored file
 */
export function getStoredFile(fileId: string): UploadedFile | undefined {
  return fileStore.get(fileId);
}

/**
 * Remove a stored file
 */
export function removeStoredFile(fileId: string): boolean {
  return fileStore.delete(fileId);
}

/**
 * Clean up old files (older than specified minutes)
 */
export function cleanupOldFiles(maxAgeMinutes: number = 30): number {
  const now = new Date();
  let cleaned = 0;
  
  for (const [id, file] of fileStore.entries()) {
    const ageMinutes = (now.getTime() - file.uploadedAt.getTime()) / 1000 / 60;
    if (ageMinutes > maxAgeMinutes) {
      fileStore.delete(id);
      cleaned++;
    }
  }
  
  return cleaned;
}

// Run cleanup every 10 minutes
setInterval(() => {
  const cleaned = cleanupOldFiles(30);
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} old temporary files`);
  }
}, 10 * 60 * 1000);



