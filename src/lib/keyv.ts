import { query } from './postgres';

class PostgresKeyValueStore {
  private ready: Promise<void> | null = null;

  private async ensureTable(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await query(`
          CREATE TABLE IF NOT EXISTS app_kv (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `);
      })();
    }

    await this.ready;
  }

  private async removeExpired(key: string): Promise<void> {
    await query(
      `DELETE FROM app_kv
       WHERE key = $1 AND expires_at IS NOT NULL AND expires_at <= NOW()`,
      [key]
    );
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.ensureTable();

    const expiresAt = ttl ? new Date(Date.now() + ttl) : null;
    await query(
      `INSERT INTO app_kv (key, value, expires_at, created_at, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW(), NOW())
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`,
      [key, JSON.stringify(value), expiresAt]
    );
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.ensureTable();
    await this.removeExpired(key);

    const result = await query(
      `SELECT value
       FROM app_kv
       WHERE key = $1
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [key]
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    return result.rows[0].value as T;
  }

  async delete(key: string): Promise<void> {
    await this.ensureTable();
    await query(`DELETE FROM app_kv WHERE key = $1`, [key]);
  }

  async clear(): Promise<void> {
    await this.ensureTable();
    await query(`DELETE FROM app_kv`);
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }
}

let keyvInstance: PostgresKeyValueStore | undefined;
let keyvInstancePromise: Promise<PostgresKeyValueStore> | undefined;

export async function initKeyv(): Promise<PostgresKeyValueStore> {
  if (!keyvInstance) {
    keyvInstance = new PostgresKeyValueStore();
  }

  return keyvInstance;
}

export function getKeyvInstance(): Promise<PostgresKeyValueStore> {
  if (!keyvInstancePromise) {
    keyvInstancePromise = initKeyv();
  }

  return keyvInstancePromise;
}

export async function setKey<T>(key: string, value: T, ttl?: number): Promise<void> {
  const instance = await getKeyvInstance();
  await instance.set(key, value, ttl);
}

export async function getKey<T>(key: string): Promise<T | undefined> {
  const instance = await getKeyvInstance();
  return await instance.get<T>(key);
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
  return await instance.has(key);
}

export async function incrementKey(key: string, amount: number = 1): Promise<number> {
  const instance = await getKeyvInstance();
  const currentValue = (await instance.get<number>(key)) || 0;
  const newValue = currentValue + amount;
  await instance.set(key, newValue);
  return newValue;
}

export async function checkAndSet<T>(key: string, value: T, ttl?: number): Promise<boolean> {
  if (await hasKey(key)) {
    return false;
  }

  await setKey(key, value, ttl);
  return true;
}

export async function isFirstUser(): Promise<boolean> {
  const adminInitialized = await hasKey('system:admin:initialized');
  return !adminInitialized;
}

export async function markAdminInitialized(): Promise<void> {
  await setKey('system:admin:initialized', true, 365 * 24 * 60 * 60 * 1000);
}

export default getKeyvInstance;
