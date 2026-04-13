import { initDatabases } from '@/lib/database';

/**
 * Initialize databases on app startup
 * This ensures PostgreSQL-backed application storage is ready before the app starts
 */

let initialized = false;

export async function initializeApp() {
  if (initialized) return;

  try {
    await initDatabases();
    initialized = true;
    console.log('[App] Databases initialized successfully');
  } catch (error) {
    console.error('[App] Failed to initialize databases:', error);
    // In development, continue without databases
    // In production, you might want to exit the process
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}