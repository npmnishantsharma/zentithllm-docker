import { pool, query, getClient } from './postgres';
import { setKey, getKey, deleteKey, hasKey } from './keyv';

/**
 * Combined database service for Zentith LLM
 *
 * Strategy:
 * - PostgreSQL: Long-term storage for application data, sessions, cache, and temporary auth state
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

export interface ModelAccessSettings {
  accessMode: 'open' | 'allowlist';
  allowedEmails: string[];
  blockedEmails: string[];
  defaultRateLimit: number;
  defaultRateWindowMinutes: number;
  adminsBypassAccess: boolean;
  adminsBypassRateLimit: boolean;
  allowManualUpload: boolean;
  allowDirectHuggingFaceUrl: boolean;
  maxUploadSizeMb: number;
  updatedAt: Date;
  updatedBy?: string;
}

export interface ModelAccessOverride {
  userId: string;
  canAccessModels?: boolean;
  rateLimit?: number;
  rateWindowMinutes?: number;
  notes?: string;
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
  passwordHash?: string;
}

export class UserSecurityService {
  private static async ensureTable(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS user_security (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        mfa_enabled BOOLEAN DEFAULT FALSE,
        mfa_secret TEXT,
        mfa_backup_codes JSONB DEFAULT '[]'::jsonb,
        passkeys JSONB DEFAULT '[]'::jsonb,
        password_hash TEXT
      )
    `);

    // Keep compatibility with existing deployments that created user_security before password_hash existed.
    await query(`ALTER TABLE user_security ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  }

  static async getSecurity(userId: string): Promise<UserSecurity | null> {
    const cacheKey = `cache:security:${userId}`;
    const cached = await getKey<UserSecurity>(cacheKey);
    if (cached) return cached;

    await this.ensureTable();
    const result = await query(
      `SELECT user_id, mfa_enabled, mfa_secret, mfa_backup_codes, passkeys, password_hash FROM user_security WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    const security = {
      userId: row.user_id,
      mfaEnabled: row.mfa_enabled,
      mfaSecret: row.mfa_secret,
      mfaBackupCodes: row.mfa_backup_codes ? (typeof row.mfa_backup_codes === 'string' ? JSON.parse(row.mfa_backup_codes) : row.mfa_backup_codes) : [],
      passkeys: row.passkeys ? (typeof row.passkeys === 'string' ? JSON.parse(row.passkeys) : row.passkeys) : [],
      passwordHash: row.password_hash || undefined,
    };

    await setKey(cacheKey, security, 5 * 60 * 1000); // 5 mins cache
    return security;
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

    // Invalidate cache
    await deleteKey(`cache:security:${userId}`);
  }

  static async getPasswordHash(userId: string): Promise<string | null> {
    await this.ensureTable();
    const result = await query(
      `SELECT password_hash FROM user_security WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0].password_hash || null;
  }

  static async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.ensureTable();
    await query(
      `INSERT INTO user_security (user_id, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [userId, passwordHash]
    );

    await deleteKey(`cache:security:${userId}`);
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
    const cacheKey = `cache:user:email:${email}`;
    const cached = await getKey<User>(cacheKey);
    if (cached) return { ...cached, createdAt: new Date(cached.createdAt), updatedAt: new Date(cached.updatedAt), lastLogin: cached.lastLogin ? new Date(cached.lastLogin) : undefined };

    const result = await query(
      `SELECT id, email, display_name, profile_picture, created_at, updated_at, last_login, is_admin
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const user = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      profilePicture: row.profile_picture,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined,
      isAdmin: row.is_admin,
    };

    await setKey(cacheKey, user, 5 * 60 * 1000);
    return user;
  }

  static async getUserById(id: string): Promise<User | null> {
    const cacheKey = `cache:user:id:${id}`;
    const cached = await getKey<User>(cacheKey);
    if (cached) return { ...cached, createdAt: new Date(cached.createdAt), updatedAt: new Date(cached.updatedAt), lastLogin: cached.lastLogin ? new Date(cached.lastLogin) : undefined };

    const result = await query(
      `SELECT id, email, display_name, profile_picture, created_at, updated_at, last_login, is_admin
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const user = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      profilePicture: row.profile_picture,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined,
      isAdmin: row.is_admin,
    };

    await setKey(cacheKey, user, 5 * 60 * 1000);
    return user;
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

    // Invalidate caches
    await deleteKey(`cache:user:id:${id}`);
    const result = await query(`SELECT email FROM users WHERE id = $1`, [id]);
    if (result.rows.length > 0) {
      await deleteKey(`cache:user:email:${result.rows[0].email}`);
    }
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
    const cacheKey = 'cache:app_settings';
    const cached = await getKey<AppSettings>(cacheKey);
    if (cached) return { ...cached, updatedAt: new Date(cached.updatedAt) };

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

    const settings = {
      isPrivate: !!row?.is_private,
      allowedEmails: this.normalizeAllowedEmails(Array.isArray(allowedEmailsRaw) ? allowedEmailsRaw : []),
      updatedAt: row?.updated_at ? new Date(row.updated_at) : new Date(),
      updatedBy: row?.updated_by || undefined,
    };

    await setKey(cacheKey, settings, 60 * 60 * 1000); // 1 hour
    return settings;
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

    await deleteKey('cache:app_settings');
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

export class ModelAccessService {
  private static readonly initLockKey = 9431127;
  private static tablesReady = false;
  private static initPromise: Promise<void> | null = null;

  private static async ensureTables(): Promise<void> {
    if (this.tablesReady) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      const client = await getClient();
      try {
        // Serialize schema initialization across concurrent requests/processes.
        await client.query('SELECT pg_advisory_lock($1)', [this.initLockKey]);

        await client.query(`
          CREATE TABLE IF NOT EXISTS model_access_settings (
            id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
            access_mode TEXT NOT NULL DEFAULT 'open' CHECK (access_mode IN ('open', 'allowlist')),
            allowed_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
            blocked_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
            default_rate_limit INTEGER NOT NULL DEFAULT 0,
            default_rate_window_minutes INTEGER NOT NULL DEFAULT 60,
            admins_bypass_access BOOLEAN NOT NULL DEFAULT TRUE,
            admins_bypass_rate_limit BOOLEAN NOT NULL DEFAULT TRUE,
            allow_manual_upload BOOLEAN NOT NULL DEFAULT TRUE,
            allow_direct_hf_url BOOLEAN NOT NULL DEFAULT TRUE,
            max_upload_size_mb INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_by UUID REFERENCES users(id) ON DELETE SET NULL
          )
        `);

        await client.query(`ALTER TABLE model_access_settings ADD COLUMN IF NOT EXISTS admins_bypass_access BOOLEAN NOT NULL DEFAULT TRUE`);
        await client.query(`ALTER TABLE model_access_settings ADD COLUMN IF NOT EXISTS admins_bypass_rate_limit BOOLEAN NOT NULL DEFAULT TRUE`);
        await client.query(`ALTER TABLE model_access_settings ADD COLUMN IF NOT EXISTS allow_manual_upload BOOLEAN NOT NULL DEFAULT TRUE`);
        await client.query(`ALTER TABLE model_access_settings ADD COLUMN IF NOT EXISTS allow_direct_hf_url BOOLEAN NOT NULL DEFAULT TRUE`);
        await client.query(`ALTER TABLE model_access_settings ADD COLUMN IF NOT EXISTS max_upload_size_mb INTEGER NOT NULL DEFAULT 0`);

        await client.query(`INSERT INTO model_access_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING`);

        await client.query(`
          CREATE TABLE IF NOT EXISTS model_access_overrides (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            can_access_models BOOLEAN,
            rate_limit INTEGER,
            rate_window_minutes INTEGER,
            notes TEXT,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_by UUID REFERENCES users(id) ON DELETE SET NULL
          )
        `);

        this.tablesReady = true;
      } catch (error: any) {
        // Postgres can still throw this during concurrent catalog updates in rare races.
        // If tables now exist, treat initialization as complete.
        if (error?.code === '23505' && error?.constraint === 'pg_type_typname_nsp_index') {
          const exists = await client.query(
            `SELECT
               to_regclass('public.model_access_settings') IS NOT NULL AS settings_exists,
               to_regclass('public.model_access_overrides') IS NOT NULL AS overrides_exists`
          );
          const row = exists.rows[0];
          if (row?.settings_exists && row?.overrides_exists) {
            this.tablesReady = true;
            return;
          }
        }

        throw error;
      } finally {
        try {
          await client.query('SELECT pg_advisory_unlock($1)', [this.initLockKey]);
        } catch {
          // Ignore unlock failures on connection teardown.
        }
        client.release();
      }
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private static normalizeEmails(emails: string[]): string[] {
    return Array.from(
      new Set(
        emails
          .map((email) => email.trim().toLowerCase())
          .filter((email) => !!email)
      )
    );
  }

  private static parseEmailList(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return this.normalizeEmails(value.map(String));
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? this.normalizeEmails(parsed.map(String)) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  static async getSettings(): Promise<ModelAccessSettings> {
    const cacheKey = 'cache:model_access_settings';
    const cached = await getKey<ModelAccessSettings>(cacheKey);
    if (cached) return { ...cached, updatedAt: new Date(cached.updatedAt) };

    await this.ensureTables();

    const result = await query(
      `SELECT access_mode, allowed_emails, blocked_emails, default_rate_limit, default_rate_window_minutes,
              admins_bypass_access, admins_bypass_rate_limit, allow_manual_upload, allow_direct_hf_url,
              max_upload_size_mb, updated_at, updated_by
       FROM model_access_settings
       WHERE id = TRUE`
    );

    const row = result.rows[0];
    const settings = {
      accessMode: row?.access_mode === 'allowlist' ? 'allowlist' : 'open',
      allowedEmails: this.parseEmailList(row?.allowed_emails),
      blockedEmails: this.parseEmailList(row?.blocked_emails),
      defaultRateLimit: Number(row?.default_rate_limit || 0),
      defaultRateWindowMinutes: Number(row?.default_rate_window_minutes || 60),
      adminsBypassAccess: row?.admins_bypass_access !== false,
      adminsBypassRateLimit: row?.admins_bypass_rate_limit !== false,
      allowManualUpload: row?.allow_manual_upload !== false,
      allowDirectHuggingFaceUrl: row?.allow_direct_hf_url !== false,
      maxUploadSizeMb: Math.max(0, Number(row?.max_upload_size_mb || 0)),
      updatedAt: row?.updated_at ? new Date(row.updated_at) : new Date(),
      updatedBy: row?.updated_by || undefined,
    };

    await setKey(cacheKey, settings, 60 * 60 * 1000);
    return settings;
  }

  static async updateSettings(
    updates: Partial<Pick<ModelAccessSettings,
      'accessMode' |
      'allowedEmails' |
      'blockedEmails' |
      'defaultRateLimit' |
      'defaultRateWindowMinutes' |
      'adminsBypassAccess' |
      'adminsBypassRateLimit' |
      'allowManualUpload' |
      'allowDirectHuggingFaceUrl' |
      'maxUploadSizeMb'
    >>,
    updatedBy?: string
  ): Promise<void> {
    await this.ensureTables();

    const fields: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.accessMode !== undefined) {
      fields.push(`access_mode = $${paramIndex++}`);
      values.push(updates.accessMode);
    }

    if (updates.allowedEmails !== undefined) {
      fields.push(`allowed_emails = $${paramIndex++}`);
      values.push(JSON.stringify(this.normalizeEmails(updates.allowedEmails)));
    }

    if (updates.blockedEmails !== undefined) {
      fields.push(`blocked_emails = $${paramIndex++}`);
      values.push(JSON.stringify(this.normalizeEmails(updates.blockedEmails)));
    }

    if (updates.defaultRateLimit !== undefined) {
      fields.push(`default_rate_limit = $${paramIndex++}`);
      values.push(Math.max(0, Number(updates.defaultRateLimit) || 0));
    }

    if (updates.defaultRateWindowMinutes !== undefined) {
      fields.push(`default_rate_window_minutes = $${paramIndex++}`);
      values.push(Math.max(1, Number(updates.defaultRateWindowMinutes) || 60));
    }

    if (updates.adminsBypassAccess !== undefined) {
      fields.push(`admins_bypass_access = $${paramIndex++}`);
      values.push(Boolean(updates.adminsBypassAccess));
    }

    if (updates.adminsBypassRateLimit !== undefined) {
      fields.push(`admins_bypass_rate_limit = $${paramIndex++}`);
      values.push(Boolean(updates.adminsBypassRateLimit));
    }

    if (updates.allowManualUpload !== undefined) {
      fields.push(`allow_manual_upload = $${paramIndex++}`);
      values.push(Boolean(updates.allowManualUpload));
    }

    if (updates.allowDirectHuggingFaceUrl !== undefined) {
      fields.push(`allow_direct_hf_url = $${paramIndex++}`);
      values.push(Boolean(updates.allowDirectHuggingFaceUrl));
    }

    if (updates.maxUploadSizeMb !== undefined) {
      fields.push(`max_upload_size_mb = $${paramIndex++}`);
      values.push(Math.max(0, Number(updates.maxUploadSizeMb) || 0));
    }

    if (updatedBy) {
      fields.push(`updated_by = $${paramIndex++}`);
      values.push(updatedBy);
    }

    await query(
      `UPDATE model_access_settings
       SET ${fields.join(', ')}
       WHERE id = TRUE`,
      values
    );

    await deleteKey('cache:model_access_settings');
  }

  static async getUserOverride(userId: string): Promise<ModelAccessOverride | null> {
    await this.ensureTables();

    const result = await query(
      `SELECT user_id, can_access_models, rate_limit, rate_window_minutes, notes, updated_at, updated_by
       FROM model_access_overrides
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      userId: row.user_id,
      canAccessModels: row.can_access_models,
      rateLimit: row.rate_limit !== null ? Number(row.rate_limit) : undefined,
      rateWindowMinutes: row.rate_window_minutes !== null ? Number(row.rate_window_minutes) : undefined,
      notes: row.notes || undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
      updatedBy: row.updated_by || undefined,
    };
  }

  static async upsertUserOverride(
    userId: string,
    updates: Partial<Pick<ModelAccessOverride, 'canAccessModels' | 'rateLimit' | 'rateWindowMinutes' | 'notes'>>,
    updatedBy?: string
  ): Promise<void> {
    await this.ensureTables();

    const existing = await this.getUserOverride(userId);
    if (!existing) {
      await query(
        `INSERT INTO model_access_overrides (user_id, can_access_models, rate_limit, rate_window_minutes, notes, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [
          userId,
          updates.canAccessModels ?? null,
          updates.rateLimit ?? null,
          updates.rateWindowMinutes ?? null,
          updates.notes ?? null,
          updatedBy || null,
        ]
      );
      return;
    }

    const fields: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.canAccessModels !== undefined) {
      fields.push(`can_access_models = $${paramIndex++}`);
      values.push(updates.canAccessModels);
    }

    if (updates.rateLimit !== undefined) {
      fields.push(`rate_limit = $${paramIndex++}`);
      values.push(updates.rateLimit === null ? null : Math.max(0, Number(updates.rateLimit) || 0));
    }

    if (updates.rateWindowMinutes !== undefined) {
      fields.push(`rate_window_minutes = $${paramIndex++}`);
      values.push(updates.rateWindowMinutes === null ? null : Math.max(1, Number(updates.rateWindowMinutes) || 1));
    }

    if (updates.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(updates.notes || null);
    }

    if (updatedBy) {
      fields.push(`updated_by = $${paramIndex++}`);
      values.push(updatedBy);
    }

    values.push(userId);
    await query(
      `UPDATE model_access_overrides
       SET ${fields.join(', ')}
       WHERE user_id = $${paramIndex}`,
      values
    );
  }

  static async deleteUserOverride(userId: string): Promise<void> {
    await this.ensureTables();
    await query(`DELETE FROM model_access_overrides WHERE user_id = $1`, [userId]);
  }

  static async listUserOverrides(): Promise<Array<ModelAccessOverride & { email?: string; displayName?: string; isAdmin?: boolean }>> {
    await this.ensureTables();

    const result = await query(
      `SELECT
         o.user_id,
         o.can_access_models,
         o.rate_limit,
         o.rate_window_minutes,
         o.notes,
         o.updated_at,
         o.updated_by,
         u.email,
         u.display_name,
         u.is_admin
       FROM model_access_overrides o
       INNER JOIN users u ON u.id = o.user_id
       ORDER BY COALESCE(u.display_name, u.email) ASC`
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      canAccessModels: row.can_access_models,
      rateLimit: row.rate_limit !== null ? Number(row.rate_limit) : undefined,
      rateWindowMinutes: row.rate_window_minutes !== null ? Number(row.rate_window_minutes) : undefined,
      notes: row.notes || undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
      updatedBy: row.updated_by || undefined,
      email: row.email,
      displayName: row.display_name,
      isAdmin: row.is_admin,
    }));
  }

  static async canUserAccessModels(user: { userId?: string; email?: string; isAdmin?: boolean }): Promise<boolean> {
    const email = (user.email || '').trim().toLowerCase();
    const settings = await this.getSettings();
    const override = user.userId ? await this.getUserOverride(user.userId) : null;

    if (user.isAdmin && settings.adminsBypassAccess) return true;

    if (override?.canAccessModels === true) return true;
    if (override?.canAccessModels === false) return false;

    if (settings.blockedEmails.includes(email)) return false;

    if (settings.accessMode === 'allowlist') {
      return settings.allowedEmails.includes(email);
    }

    return true;
  }

  static async getEffectiveRateLimit(user: { userId?: string; email?: string; isAdmin?: boolean }): Promise<{ limit: number; windowMinutes: number }> {
    const settings = await this.getSettings();

    if (user.isAdmin && settings.adminsBypassRateLimit) {
      return { limit: 0, windowMinutes: 60 };
    }

    const override = user.userId ? await this.getUserOverride(user.userId) : null;

    return {
      limit: override?.rateLimit !== undefined && override?.rateLimit !== null ? override.rateLimit : settings.defaultRateLimit,
      windowMinutes:
        override?.rateWindowMinutes !== undefined && override?.rateWindowMinutes !== null
          ? override.rateWindowMinutes
          : settings.defaultRateWindowMinutes,
    };
  }

  static async consumeRateLimit(key: string, limit: number, windowMinutes: number): Promise<{ allowed: boolean; remaining: number }> {
    if (!limit || limit <= 0) {
      return { allowed: true, remaining: Infinity };
    }

    const windowMs = Math.max(1, windowMinutes) * 60 * 1000;
    const counterKey = `model:rate:${key}`;
    const current = await getKey<number>(counterKey);
    const next = (current || 0) + 1;

    if (next > limit) {
      return { allowed: false, remaining: 0 };
    }

    await setKey(counterKey, next, windowMs);
    return { allowed: true, remaining: limit - next };
  }

  static async canUseDirectHuggingFaceUrl(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.allowDirectHuggingFaceUrl;
  }

  static async canUseManualUpload(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.allowManualUpload;
  }

  static async getMaxUploadSizeBytes(): Promise<number> {
    const settings = await this.getSettings();
    if (!settings.maxUploadSizeMb || settings.maxUploadSizeMb <= 0) return 0;
    return settings.maxUploadSizeMb * 1024 * 1024;
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

// Session operations (PostgreSQL-backed)
export class SessionService {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

  static async createSession(userId: string, userData: any): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    const expiresAt = new Date(Date.now() + this.SESSION_TTL);
    const sessionData = {
      ...userData,
      userId,
      sessionId,
      createdAt: new Date().toISOString(),
    };

    await query(
      `INSERT INTO user_sessions (user_id, session_token, session_data, created_at, expires_at)
       VALUES ($1, $2, $3::jsonb, NOW(), $4)
       ON CONFLICT (session_token) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         session_data = EXCLUDED.session_data,
         expires_at = EXCLUDED.expires_at`,
      [userId, sessionId, JSON.stringify(sessionData), expiresAt]
    );

    await setKey(sessionKey, sessionData, this.SESSION_TTL);

    return sessionId;
  }

  static async getSession(sessionId: string): Promise<any | null> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    const sessionResult = await query(
      `SELECT user_id, session_data, created_at, expires_at
       FROM user_sessions
       WHERE session_token = $1
       LIMIT 1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      await deleteKey(sessionKey);
      return null;
    }

    const row = sessionResult.rows[0];
    const expiresAt = new Date(row.expires_at);
    if (expiresAt.getTime() <= Date.now()) {
      await this.deleteSession(sessionId);
      return null;
    }

    const cachedSession = await getKey(sessionKey);
    if (cachedSession) {
      return cachedSession;
    }

    const restoredSession = {
      ...(row.session_data || {}),
      userId: row.user_id,
      sessionId,
      createdAt: row.session_data?.createdAt || row.created_at?.toISOString?.() || new Date().toISOString(),
    };

    const remainingTtl = Math.max(expiresAt.getTime() - Date.now(), 1000);
    await setKey(sessionKey, restoredSession, remainingTtl);
    return restoredSession;
  }

  static async deleteSession(sessionId: string): Promise<void> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    await query(`DELETE FROM user_sessions WHERE session_token = $1`, [sessionId]);
    await deleteKey(sessionKey);
  }

  static async extendSession(sessionId: string): Promise<void> {
    const sessionData = await this.getSession(sessionId);
    if (sessionData) {
      const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
      const expiresAt = new Date(Date.now() + this.SESSION_TTL);
      await query(
        `UPDATE user_sessions
         SET expires_at = $2,
             session_data = $3::jsonb
         WHERE session_token = $1`,
        [sessionId, expiresAt, JSON.stringify(sessionData)]
      );
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

    console.log('[Database] Application storage initialized successfully');
  } catch (error) {
    console.error('[Database] Failed to initialize databases:', error);
    throw error;
  }
}

export { pool, query, getClient };