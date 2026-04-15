import { Pool } from 'pg';

/**
 * PostgreSQL connection pool for long-term data storage
 *
 * PostgreSQL is used for:
 * - User profiles and authentication data
 * - Chat conversations and messages
 * - Persistent application data
 * - Data that needs complex queries and relationships
 */

declare global {
  var _pgPool: Pool | undefined;
}

const poolConfig = process.env.USE_ONLINE_DB && process.env.POSTGRES_URL
  ? {
      connectionString: process.env.POSTGRES_URL,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'zentith',
      user: process.env.POSTGRES_USER || 'zentith_user',
      password: process.env.POSTGRES_PASSWORD || 'zentith_password',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
  }
  const pool = global._pgPool || new Pool(poolConfig);

if (process.env.NODE_ENV !== 'production') {
  global._pgPool = pool;
}

// Handle pool errors
pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client:', err);
  // Note: Not using process.exit in Edge Runtime
});

// Test connection
pool.on('connect', () => {
  console.log('[PostgreSQL] Connected to database');
});

export { pool };

// Helper function to execute queries
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('[PostgreSQL] Query executed in', duration, 'ms:', text);
    return res;
  } catch (err) {
    console.error('[PostgreSQL] Query error:', err);
    throw err;
  }
}

// Helper function to get a client from pool (for transactions)
export async function getClient() {
  const client = await pool.connect();
  return client;
}

export default pool;