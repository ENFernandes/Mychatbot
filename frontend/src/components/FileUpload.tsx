import React, { useRef } from 'react';
import './FileUpload.css';

export interface UploadedFile {
  id: string;
  file: File;
  filename: string;
  mimeType: string;
  size: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
}

interface FileUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  disabled?: boolean;
  provider?: 'openai' | 'gemini' | 'claude';
}

// Supported MIME types by provider
const SUPPORTED_MIME_TYPES: Record<string, string[]> = {
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
  claude: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'text/plain',
    'text/html',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'application/epub+zip',
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
  ],
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
const ALL_SUPPORTED_MIME_TYPES = Array.from(
  new Set([
    ...SUPPORTED_MIME_TYPES.openai,
    ...SUPPORTED_MIME_TYPES.claude,
    ...SUPPORTED_MIME_TYPES.gemini,
  ])
);

// Accept string for file input
const ACCEPT_STRING = ALL_SUPPORTED_MIME_TYPES.join(',');

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_MAX_FILES = 10;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return '📊';
  if (mimeType === 'application/json') return '📋';
  if (mimeType.startsWith('text/')) return '📃';
  return '📎';
}

function isFileSupportedByProvider(mimeType: string, provider?: string): boolean {
  if (!provider) {
    return ALL_SUPPORTED_MIME_TYPES.includes(mimeType);
  }
  const supportedTypes = SUPPORTED_MIME_TYPES[provider];
  return supportedTypes ? supportedTypes.includes(mimeType) : false;
}

const FileUpload: React.FC<FileUploadProps> = ({
  files,
  onFilesChange,
  maxFiles = DEFAULT_MAX_FILES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  disabled = false,
  provider,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = [];
    const errors: string[] = [];

    // Check total file count
    if (files.length + selectedFiles.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
    } else {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        // Validate file size
        if (file.size > maxFileSize) {
          errors.push(`${file.name}: File too large (max ${formatFileSize(maxFileSize)})`);
          continue;
        }

        // Validate file type
        if (!isFileSupportedByProvider(file.type, provider)) {
          errors.push(`${file.name}: File type not supported${provider ? ` by ${provider}` : ''}`);
          continue;
        }

        // Create temporary ID for the file
        const tempId = `temp-${Date.now()}-${i}`;

        newFiles.push({
          id: tempId,
          file,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          status: 'pending',
        });
      }
    }

    if (errors.length > 0) {
      // Show errors (could be improved with a toast notification)
      console.warn('File upload errors:', errors);
    }

    if (newFiles.length > 0) {
      onFilesChange([...files, ...newFiles]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileId: string) => {
    onFilesChange(files.filter((f) => f.id !== fileId));
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload-container">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_STRING}
        onChange={handleFileSelect}
        disabled={disabled || files.length >= maxFiles}
        className="file-input-hidden"
      />

      <button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled || files.length >= maxFiles}
        className="file-upload-button"
        title="Attach files"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
        </svg>
      </button>

      {files.length > 0 && (
        <div className="file-preview-list">
          {files.map((uploadedFile) => (
            <div
              key={uploadedFile.id}
              className={`file-preview-item ${uploadedFile.status}`}
            >
              <span className="file-icon">{getFileIcon(uploadedFile.mimeType)}</span>
              <div className="file-info">
                <span className="file-name" title={uploadedFile.filename}>
                  {uploadedFile.filename.length > 20
                    ? `${uploadedFile.filename.slice(0, 17)}...`
                    : uploadedFile.filename}
                </span>
                <span className="file-size">{formatFileSize(uploadedFile.size)}</span>
              </div>
              {uploadedFile.status === 'uploading' && (
                <span className="file-status uploading">⏳</span>
              )}
              {uploadedFile.status === 'uploaded' && (
                <span className="file-status uploaded">✓</span>
              )}
              {uploadedFile.status === 'error' && (
                <span className="file-status error" title={uploadedFile.error}>
                  ⚠️
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemoveFile(uploadedFile.id)}
                className="file-remove-button"
                disabled={disabled || uploadedFile.status === 'uploading'}
                title="Remove file"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;


