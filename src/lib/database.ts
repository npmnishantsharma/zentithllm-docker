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

// User operations (PostgreSQL - long-term)
export class UserService {
  static async createUser(email: string, displayName?: string, profilePicture?: string): Promise<User> {
    const result = await query(
      `INSERT INTO users (email, display_name, profile_picture)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, profile_picture, created_at, updated_at, last_login, is_admin`,
      [email, displayName, profilePicture]
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

  static async updateUser(id: string, updates: Partial<Pick<User, 'displayName' | 'profilePicture' | 'lastLogin'>>): Promise<void> {
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