import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { enforceActiveSubscription } from '../middleware/subscription';
import {
  validateFileType,
  validateFileSize,
  validateFileCount,
  storeFile,
  getStoredFile,
  removeStoredFile,
  ALL_SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILES_PER_MESSAGE,
  UploadedFile,
} from '../services/fileService';

const router = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_MESSAGE,
  },
  fileFilter: (req, file, cb) => {
    const validation = validateFileType(file.mimetype);
    if (!validation.valid) {
      cb(new Error(validation.error || 'Invalid file type'));
      return;
    }
    cb(null, true);
  },
});

// Apply authentication middleware
router.use(requireAuth);
router.use(enforceActiveSubscription);

/**
 * POST /api/files/upload
 * Upload a single file
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const file = req.file;

    // Validate file size
    const sizeValidation = validateFileSize(file.size);
    if (!sizeValidation.valid) {
      return res.status(400).json({ error: sizeValidation.error });
    }

    // Generate unique ID for the file
    const fileId = uuidv4();

    // Store the file temporarily
    const uploadedFile: UploadedFile = {
      id: fileId,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      buffer: file.buffer,
      uploadedAt: new Date(),
    };

    storeFile(uploadedFile);

    return res.status(200).json({
      id: fileId,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: uploadedFile.uploadedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
});

/**
 * POST /api/files/upload-multiple
 * Upload multiple files at once
 */
router.post('/upload-multiple', upload.array('files', MAX_FILES_PER_MESSAGE), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Validate file count
    const countValidation = validateFileCount(files.length);
    if (!countValidation.valid) {
      return res.status(400).json({ error: countValidation.error });
    }

    const uploadedFiles: Array<{
      id: string;
      filename: string;
      mimeType: string;
      size: number;
      uploadedAt: string;
    }> = [];

    for (const file of files) {
      // Validate file size
      const sizeValidation = validateFileSize(file.size);
      if (!sizeValidation.valid) {
        return res.status(400).json({
          error: `File "${file.originalname}": ${sizeValidation.error}`,
        });
      }

      // Generate unique ID for the file
      const fileId = uuidv4();

      // Store the file temporarily
      const uploadedFile: UploadedFile = {
        id: fileId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer,
        uploadedAt: new Date(),
      };

      storeFile(uploadedFile);

      uploadedFiles.push({
        id: fileId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: uploadedFile.uploadedAt.toISOString(),
      });
    }

    return res.status(200).json({ files: uploadedFiles });
  } catch (error: any) {
    console.error('Error uploading files:', error);
    return res.status(500).json({ error: error.message || 'Failed to upload files' });
  }
});

/**
 * GET /api/files/:fileId
 * Get file metadata (not the actual file content)
 */
router.get('/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const file = getStoredFile(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.status(200).json({
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt: file.uploadedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Error getting file:', error);
    return res.status(500).json({ error: error.message || 'Failed to get file' });
  }
});

/**
 * DELETE /api/files/:fileId
 * Delete a stored file
 */
router.delete('/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const deleted = removeStoredFile(fileId);

    if (!deleted) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.status(200).json({ success: true, message: 'File deleted' });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete file' });
  }
});

/**
 * GET /api/files/supported-types
 * Get list of supported file types
 */
router.get('/supported-types', async (req: Request, res: Response) => {
  return res.status(200).json({
    mimeTypes: ALL_SUPPORTED_MIME_TYPES,
    maxFileSize: MAX_FILE_SIZE,
    maxFilesPerMessage: MAX_FILES_PER_MESSAGE,
  });
});

// Error handler for multer errors
router.use((error: any, req: Request, res: Response, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: `Too many files. Maximum is ${MAX_FILES_PER_MESSAGE} files`,
      });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  next();
});

export default router;

