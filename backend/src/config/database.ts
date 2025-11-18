import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

let isConnected = false;

export async function connectDatabase() {
  if (isConnected) {
    return;
  }

  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await prisma.$connect();
      isConnected = true;
      console.log('[database] Successfully connected to database');
      return;
    } catch (error: any) {
      retries++;
      console.error(`[database] Connection attempt ${retries}/${maxRetries} failed:`, error.message);
      
      if (retries >= maxRetries) {
        console.error('[database] Failed to connect after all retries');
        throw error;
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
}

export async function disconnectDatabase() {
  if (!isConnected) {
    return;
  }

  try {
    await prisma.$disconnect();
    isConnected = false;
    console.log('[database] Disconnected from database');
  } catch (error: any) {
    console.error('[database] Error disconnecting:', error.message);
  }
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error: any) {
    console.error('[database] Connection check failed:', error.message);
    isConnected = false;
    
    // Try to reconnect
    try {
      await connectDatabase();
      return true;
    } catch (reconnectError: any) {
      console.error('[database] Reconnection failed:', reconnectError.message);
      return false;
    }
  }
}

// Helper function to execute queries with automatic reconnection
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a connection error
      const isConnectionError = 
        error.message?.includes('Closed') ||
        error.message?.includes('connection') ||
        error.code === 'P1001' || // Prisma connection error
        error.code === 'P1008';  // Prisma operations timed out
      
      if (isConnectionError && attempt < maxRetries) {
        console.warn(`[database] Connection error on attempt ${attempt}/${maxRetries}, reconnecting...`);
        isConnected = false;
        await connectDatabase();
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}
