import { pool, query, getClient } from './postgres';
import { getKeyvInstance, setKey, getKey, deleteKey, hasKey } from './keyv';

/**
 * Combined database service for Zentith LLM
 *
 * Strategy:
 * - Redis: Short-term storage (sessions, cache, temporary data)
 * - PostgreSQL: Long-term storage (users, conversations, messages)
 */

export interface User {
  id: string;
  email: string;
  displayName?: string;
  profilePicture?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isAdmin: boolean;
}

export interface AdminUserData extends User {
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaBackupCodes: any[];
  passkeys: any[];
  conversationCount: number;
  messageCount: number;
  sessionCount: number;
}

export interface AppSettings {
  isPrivate: boolean;
  allowedEmails: string[];
  updatedAt: Date;
  updatedBy?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  metadata?: any;
}

export interface UserSecurity {
  userId: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaBackupCodes?: any[];
  passkeys: any[];
}

export class UserSecurityService {
  private static async ensureTable(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS user_security (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        mfa_enabled BOOLEAN DEFAULT FALSE,
        mfa_secret TEXT,
        mfa_backup_codes JSONB DEFAULT '[]'::jsonb,
        passkeys JSONB DEFAULT '[]'::jsonb
      )
    `);
  }

  static async getSecurity(userId: string): Promise<UserSecurity | null> {
    await this.ensureTable();
    const result = await query(
      `SELECT user_id, mfa_enabled, mfa_secret, mfa_backup_codes, passkeys FROM user_security WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      userId: row.user_id,
      mfaEnabled: row.mfa_enabled,
      mfaSecret: row.mfa_secret,
      mfaBackupCodes: row.mfa_backup_codes ? (typeof row.mfa_backup_codes === 'string' ? JSON.parse(row.mfa_backup_codes) : row.mfa_backup_codes) : [],
      passkeys: row.passkeys ? (typeof row.passkeys === 'string' ? JSON.parse(row.passkeys) : row.passkeys) : [],
    };
  }

  static async updateSecurity(userId: string, updates: Partial<Pick<UserSecurity, 'mfaEnabled' | 'mfaSecret' | 'mfaBackupCodes' | 'passkeys'>>): Promise<void> {
    await this.ensureTable();
    // Check if exists
    const existing = await query(`SELECT user_id FROM user_security WHERE user_id = $1`, [userId]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO user_security (user_id, mfa_enabled, mfa_secret, mfa_backup_codes, passkeys) VALUES ($1, $2, $3, $4, $5)`,
        [
          userId, 
          updates.mfaEnabled || false, 
          updates.mfaSecret || null, 
          updates.mfaBackupCodes ? JSON.stringify(updates.mfaBackupCodes) : '[]', 
          updates.passkeys ? JSON.stringify(updates.passkeys) : '[]'
        ]
      );
      return;
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.mfaEnabled !== undefined) {
      fields.push(`mfa_enabled = $${paramIndex++}`);
      values.push(updates.mfaEnabled);
    }
    if (updates.mfaSecret !== undefined) {
      fields.push(`mfa_secret = $${paramIndex++}`);
      values.push(updates.mfaSecret);
    }
    if (updates.mfaBackupCodes !== undefined) {
      fields.push(`mfa_backup_codes = $${paramIndex++}`);
      values.push(JSON.stringify(updates.mfaBackupCodes));
    }
    if (updates.passkeys !== undefined) {
      fields.push(`passkeys = $${paramIndex++}`);
      values.push(JSON.stringify(updates.passkeys));
    }

    if (fields.length === 0) return;

    values.push(userId);
    await query(
      `UPDATE user_security SET ${fields.join(', ')} WHERE user_id = $${paramIndex}`,
      values
    );
  }
}

// User operations (PostgreSQL - long-term)
export class UserService {
  static async createUser(email: string, displayName?: string, profilePicture?: string, isAdmin: boolean = false): Promise<User> {
    const result = await query(
      `INSERT INTO users (email, display_name, profile_picture, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, profile_picture, created_at, updated_at, last_login, is_admin`,
      [email, displayName, profilePicture, isAdmin]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      profilePicture: row.profile_picture,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined,
      isAdmin: row.is_admin,
    };
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    const result = await query(
      `SELECT id, email, display_name, profile_picture, created_at, updated_at, last_login, is_admin
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      profilePicture: row.profile_picture,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined,
      isAdmin: row.is_admin,
    };
  }

  static async getUserById(id: string): Promise<User | null> {
    const result = await query(
      `SELECT id, email, display_name, profile_picture, created_at, updated_at, last_login, is_admin
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      profilePicture: row.profile_picture,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined,
      isAdmin: row.is_admin,
    };
  }

  static async listUsers(limit: number = 200): Promise<User[]> {
    const result = await query(
      `SELECT id, email, display_name, profile_picture, created_at, updated_at, last_login, is_admin
       FROM users
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      profilePicture: row.profile_picture,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined,
      isAdmin: row.is_admin,
    }));
  }

  static async listUsersDetailed(limit: number = 200): Promise<AdminUserData[]> {
    await query(`
      CREATE TABLE IF NOT EXISTS user_security (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        mfa_enabled BOOLEAN DEFAULT FALSE,
        mfa_secret TEXT,
        mfa_backup_codes JSONB DEFAULT '[]'::jsonb,
        passkeys JSONB DEFAULT '[]'::jsonb
      )
    `);

    const result = await query(
      `SELECT
         u.id,
         u.email,
         u.display_name,
         u.profile_picture,
         u.created_at,
         u.updated_at,
         u.last_login,
         u.is_admin,
         COALESCE(us.mfa_enabled, FALSE) AS mfa_enabled,
         us.mfa_secret,
         COALESCE(us.mfa_backup_codes, '[]'::jsonb) AS mfa_backup_codes,
         COALESCE(us.passkeys, '[]'::jsonb) AS passkeys,
         COALESCE(conv.conversation_count, 0) AS conversation_count,
         COALESCE(msg.message_count, 0) AS message_count,
         COALESCE(sess.session_count, 0) AS session_count
       FROM users u
       LEFT JOIN user_security us ON us.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS conversation_count
         FROM conversations c
         WHERE c.user_id = u.id
       ) conv ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS message_count
         FROM messages m
         WHERE m.user_id = u.id
       ) msg ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS session_count
         FROM user_sessions s
         WHERE s.user_id = u.id
       ) sess ON TRUE
       ORDER BY u.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      profilePicture: row.profile_picture,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined,
      isAdmin: row.is_admin,
      mfaEnabled: row.mfa_enabled,
      mfaSecret: row.mfa_secret,
      mfaBackupCodes: row.mfa_backup_codes
        ? (typeof row.mfa_backup_codes === 'string' ? JSON.parse(row.mfa_backup_codes) : row.mfa_backup_codes)
        : [],
      passkeys: row.passkeys
        ? (typeof row.passkeys === 'string' ? JSON.parse(row.passkeys) : row.passkeys)
        : [],
      conversationCount: Number(row.conversation_count || 0),
      messageCount: Number(row.message_count || 0),
      sessionCount: Number(row.session_count || 0),
    }));
  }

  static async updateUser(id: string, updates: Partial<Pick<User, 'displayName' | 'profilePicture' | 'lastLogin' | 'isAdmin'>>): Promise<void> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.displayName !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(updates.displayName);
    }

    if (updates.profilePicture !== undefined) {
      fields.push(`profile_picture = $${paramIndex++}`);
      values.push(updates.profilePicture);
    }

    if (updates.lastLogin !== undefined) {
      fields.push(`last_login = $${paramIndex++}`);
      values.push(updates.lastLogin);
    }

    if (updates.isAdmin !== undefined) {
      fields.push(`is_admin = $${paramIndex++}`);
      values.push(updates.isAdmin);
    }

    if (fields.length === 0) return;

    values.push(id);
    await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }

  static async isFirstUser(): Promise<boolean> {
    const result = await query('SELECT COUNT(*) as count FROM users');
    return parseInt(result.rows[0].count) === 0;
  }

  /**
   * Bootstrap safety: if there is exactly one user and zero admins,
   * promote that single user to admin.
   */
  static async ensureSingleUserBootstrapAdmin(userId: string): Promise<boolean> {
    const result = await query(
      `WITH stats AS (
         SELECT
           COUNT(*)::int AS total_users,
           COUNT(*) FILTER (WHERE is_admin = TRUE)::int AS total_admins
         FROM users
       )
       UPDATE users
       SET is_admin = TRUE
       WHERE id = $1
         AND (SELECT total_users FROM stats) = 1
         AND (SELECT total_admins FROM stats) = 0
       RETURNING id`,
      [userId]
    );

    return result.rows.length > 0;
  }
}

export class AppSettingsService {
  private static async ensureTable(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
        is_private BOOLEAN NOT NULL DEFAULT FALSE,
        allowed_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await query(`INSERT INTO app_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING`);
  }

  private static normalizeAllowedEmails(allowedEmails: string[]): string[] {
    const normalized = allowedEmails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => !!e);

    return Array.from(new Set(normalized));
  }

  static async getSettings(): Promise<AppSettings> {
    await this.ensureTable();

    const result = await query(
      `SELECT is_private, allowed_emails, updated_at, updated_by
       FROM app_settings
       WHERE id = TRUE`
    );

    const row = result.rows[0];
    const allowedEmailsRaw = row?.allowed_emails
      ? (typeof row.allowed_emails === 'string' ? JSON.parse(row.allowed_emails) : row.allowed_emails)
      : [];

    return {
      isPrivate: !!row?.is_private,
      allowedEmails: this.normalizeAllowedEmails(Array.isArray(allowedEmailsRaw) ? allowedEmailsRaw : []),
      updatedAt: row?.updated_at ? new Date(row.updated_at) : new Date(),
      updatedBy: row?.updated_by || undefined,
    };
  }

  static async updateSettings(
    updates: Partial<Pick<AppSettings, 'isPrivate' | 'allowedEmails'>>,
    updatedBy?: string
  ): Promise<void> {
    await this.ensureTable();

    const fields: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.isPrivate !== undefined) {
      fields.push(`is_private = $${paramIndex++}`);
      values.push(updates.isPrivate);
    }

    if (updates.allowedEmails !== undefined) {
      const normalized = this.normalizeAllowedEmails(updates.allowedEmails);
      fields.push(`allowed_emails = $${paramIndex++}`);
      values.push(JSON.stringify(normalized));
    }

    if (updatedBy) {
      fields.push(`updated_by = $${paramIndex++}`);
      values.push(updatedBy);
    }

    await query(
      `UPDATE app_settings
       SET ${fields.join(', ')}
       WHERE id = TRUE`,
      values
    );
  }

  static async canAccessByEmail(email: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    const settings = await this.getSettings();

    if (!settings.isPrivate) {
      return true;
    }

    if (settings.allowedEmails.includes(normalizedEmail)) {
      return true;
    }

    const adminMatch = await query(
      `SELECT is_admin FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [normalizedEmail]
    );

    if (adminMatch.rows[0]?.is_admin === true) {
      return true;
    }

    const countResult = await query(`SELECT COUNT(*)::int AS count FROM users`);
    return Number(countResult.rows[0]?.count || 0) === 0;
  }
}

// Conversation operations (PostgreSQL - long-term)
export class ConversationService {
  static async createConversation(userId: string, title?: string): Promise<Conversation> {
    const result = await query(
      `INSERT INTO conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING id, user_id, title, created_at, updated_at, is_active`,
      [userId, title]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isActive: row.is_active,
    };
  }

  static async getConversationsByUser(userId: string, limit: number = 50): Promise<Conversation[]> {
    const result = await query(
      `SELECT id, user_id, title, created_at, updated_at, is_active
       FROM conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isActive: row.is_active,
    }));
  }

  static async getConversation(id: string): Promise<Conversation | null> {
    const result = await query(
      `SELECT id, user_id, title, created_at, updated_at, is_active
       FROM conversations WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isActive: row.is_active,
    };
  }

  static async updateConversation(id: string, updates: Partial<Pick<Conversation, 'title' | 'isActive'>>): Promise<void> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }

    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (fields.length === 0) return;

    values.push(id);
    await query(
      `UPDATE conversations SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }
}

// Message operations (PostgreSQL - long-term)
export class MessageService {
  static async createMessage(conversationId: string, userId: string, role: 'user' | 'assistant' | 'system', content: string, metadata?: any): Promise<Message> {
    const result = await query(
      `INSERT INTO messages (conversation_id, user_id, role, content, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, conversation_id, user_id, role, content, created_at, metadata`,
      [conversationId, userId, role, content, metadata ? JSON.stringify(metadata) : null]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      conversationId: row.conversation_id,
      userId: row.user_id,
      role: row.role,
      content: row.content,
      createdAt: new Date(row.created_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  static async getMessagesByConversation(conversationId: string, limit: number = 100): Promise<Message[]> {
    const result = await query(
      `SELECT id, conversation_id, user_id, role, content, created_at, metadata
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [conversationId, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      userId: row.user_id,
      role: row.role,
      content: row.content,
      createdAt: new Date(row.created_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }
}

// Session operations (Redis - short-term)
export class SessionService {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

  static async createSession(userId: string, userData: any): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;

    await setKey(sessionKey, {
      ...userData,
      userId,
      sessionId,
      createdAt: new Date().toISOString(),
    }, this.SESSION_TTL);

    return sessionId;
  }

  static async getSession(sessionId: string): Promise<any | null> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    return await getKey(sessionKey);
  }

  static async deleteSession(sessionId: string): Promise<void> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    await deleteKey(sessionKey);
  }

  static async extendSession(sessionId: string): Promise<void> {
    const sessionData = await this.getSession(sessionId);
    if (sessionData) {
      const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
      await setKey(sessionKey, sessionData, this.SESSION_TTL);
    }
  }
}

// Cache operations (Redis - short-term)
export class CacheService {
  private static readonly CACHE_PREFIX = 'cache:';

  static async set(key: string, value: any, ttl?: number): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${key}`;
    await setKey(cacheKey, value, ttl);
  }

  static async get<T>(key: string): Promise<T | null> {
    const cacheKey = `${this.CACHE_PREFIX}${key}`;
    return (await getKey(cacheKey)) || null;
  }

  static async delete(key: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${key}`;
    await deleteKey(cacheKey);
  }

  static async has(key: string): Promise<boolean> {
    const cacheKey = `${this.CACHE_PREFIX}${key}`;
    return await hasKey(cacheKey);
  }
}

// Initialize both databases
export async function initDatabases() {
  try {
    // Test PostgreSQL connection
    await query('SELECT 1');
    console.log('[Database] PostgreSQL connected successfully');

    // Initialize Redis
    await getKeyvInstance();
    console.log('[Database] Redis initialized successfully');

    console.log('[Database] Both databases initialized successfully');
  } catch (error) {
    console.error('[Database] Failed to initialize databases:', error);
    throw error;
  }
}

export { pool, query, getClient };