import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import { createClient } from 'redis';

/**
 * Initialize Keyv instance with Redis backend
 * 
 * Redis is the best choice for:
 * - Fast caching and sessions
 * - Real-time applications and chat systems
 * - Expiring data with TTL
 * - Distributed systems
 * 
 * Ensure Redis is running:
 * - Docker: docker run -d -p 6379:6379 redis:latest
 * - Local: brew install redis && redis-server
 * - Environment variable: REDIS_URL (defaults to redis://localhost:6379)
 */

let keyv: Keyv;
let redisClient: ReturnType<typeof createClient>;

export async function initKeyv() {
  if (!keyv) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    try {
      // Create Redis client
      redisClient = createClient({
        url: redisUrl,
      });

      // Connect to Redis
      redisClient.on('error', (err) => {
        console.error('[Redis] Connection error:', err.message);
      });

      redisClient.on('connect', () => {
        console.log('[Redis] Connected to:', redisUrl);
      });

      // Wait for connection
      await redisClient.connect();

      // Initialize Keyv with Redis adapter
      const redisStore = new KeyvRedis(redisClient);
      keyv = new Keyv({ store: redisStore, namespace: 'zentith' });

      keyv.on('error', (err) => {
        console.error('[Keyv] Error:', err.message);
      });

      console.log('[Keyv] Initialized with Redis backend');
    } catch (error) {
      console.error('[Keyv] Failed to initialize Redis:', error);
      throw error;
    }
  }
  return keyv;
}

// Initialize on module load
let keyvInstancePromise: Promise<Keyv>;

export function getKeyvInstance(): Promise<Keyv> {
  if (!keyvInstancePromise) {
    keyvInstancePromise = initKeyv();
  }
  return keyvInstancePromise;
}

// Lazy initialized instance
export let keyvInstance: Keyv;

/**
 * Helper functions for common operations
 */

export async function setKey<T>(key: string, value: T, ttl?: number): Promise<void> {
  const instance = await getKeyvInstance();
  await instance.set(key, value, ttl);
}

export async function getKey<T>(key: string): Promise<T | undefined> {
  const instance = await getKeyvInstance();
  return (await instance.get(key)) as T | undefined;
}

export async function deleteKey(key: string): Promise<void> {
  const instance = await getKeyvInstance();
  await instance.delete(key);
}

export async function clearAll(): Promise<void> {
  const instance = await getKeyvInstance();
  await instance.clear();
}

export async function hasKey(key: string): Promise<boolean> {
  const instance = await getKeyvInstance();
  const value = await instance.get(key);
  return value !== undefined;
}

/**
 * Increment a counter value
 */
export async function incrementKey(key: string, amount: number = 1): Promise<number> {
  const instance = await getKeyvInstance();
  const currentValue = (await instance.get(key)) || 0;
  const newValue = (currentValue as number) + amount;
  await instance.set(key, newValue);
  return newValue;
}

/**
 * Check and set - atomic operation for existence checks
 */
export async function checkAndSet<T>(key: string, value: T, ttl?: number): Promise<boolean> {
  if (await hasKey(key)) {
    return false;
  }
  await setKey(key, value, ttl);
  return true;
}

/**
 * Check if this is the first user being registered
 * Returns true if no admin has been assigned yet
 */
export async function isFirstUser(): Promise<boolean> {
  const adminInitialized = await hasKey('system:admin:initialized');
  return !adminInitialized;
}

/**
 * Mark that the first user (as admin) has been initialized
 */
export async function markAdminInitialized(): Promise<void> {
  await setKey('system:admin:initialized', true, 365 * 24 * 60 * 60 * 1000); // 1 year TTL
}

export default getKeyvInstance;
