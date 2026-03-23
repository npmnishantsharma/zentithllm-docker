/**
 * Practical Redis patterns for Keyv
 * 
 * Real-world examples for the Zentith LLM chat application
 * 
 * Note: All functions are async and require await
 */

import { setKey, getKey, deleteKey, getKeyvInstance } from '@/lib/keyv';

/**
 * Example 1: Cache AI chat responses
 */
export async function cacheAIChatResponse(userId: string, messageHash: string, response: any) {
  const cacheKey = `chat:${userId}:${messageHash}`;
  // Cache for 1 hour
  await setKey(cacheKey, response, 60 * 60 * 1000);
}

export async function getCachedChatResponse(userId: string, messageHash: string) {
  const cacheKey = `chat:${userId}:${messageHash}`;
  return await getKey(cacheKey);
}

/**
 * Example 2: Session management
 */
export async function storeUserSession(sessionId: string, userData: any) {
  // Sessions expire after 24 hours
  const sessionKey = `session:${sessionId}`;
  await setKey(sessionKey, userData, 24 * 60 * 60 * 1000);
}

export async function getSession(sessionId: string) {
  const sessionKey = `session:${sessionId}`;
  return await getKey(sessionKey);
}

export async function destroySession(sessionId: string) {
  const sessionKey = `session:${sessionId}`;
  await deleteKey(sessionKey);
}

/**
 * Example 3: Rate limiting
 */
export async function checkRateLimit(userId: string, limit: number, windowMs: number) {
  const key = `ratelimit:${userId}`;
  const count = (await getKey<number>(key)) || 0;

  if (count >= limit) {
    return false; // Rate limit exceeded
  }

  // Increment counter
  await setKey(key, count + 1, windowMs);
  return true;
}

/**
 * Example 4: Conversation history caching
 */
export async function cacheConversationHistory(conversationId: string, messages: any[]) {
  const key = `conversation:${conversationId}`;
  // Cache for 3 hours
  await setKey(key, messages, 3 * 60 * 60 * 1000);
}

export async function getCachedConversation(conversationId: string) {
  const key = `conversation:${conversationId}`;
  return await getKey(key);
}

/**
 * Example 5: Model availability cache
 */
export async function cacheAvailableModels(models: any[]) {
  const key = 'models:available';
  // Cache for 1 hour
  await setKey(key, models, 60 * 60 * 1000);
}

export async function getAvailableModels() {
  const key = 'models:available';
  return await getKey(key);
}

/**
 * Example 6: User preferences cache
 */
export async function cacheUserPreferences(userId: string, preferences: any) {
  const key = `user:preferences:${userId}`;
  // Cache indefinitely
  await setKey(key, preferences);
}

export async function getUserPreferences(userId: string) {
  const key = `user:preferences:${userId}`;
  return await getKey(key);
}

export async function invalidateUserPreferences(userId: string) {
  const key = `user:preferences:${userId}`;
  await deleteKey(key);
}

/**
 * Example 7: Temperature-based cache (frequently accessed data)
 */
export async function getHotData(userId: string) {
  const key = `hot:${userId}`;
  const data = await getKey(key);

  if (!data) {
    // Generate or fetch data if not cached
    const freshData = await fetchUserData(userId);
    // Cache with short TTL (5 minutes) for frequently accessed data
    await setKey(key, freshData, 5 * 60 * 1000);
    return freshData;
  }

  return data;
}

/**
 * Example 8: Pagination cache for large result sets
 */
export async function cacheSearchResults(query: string, page: number, results: any[]) {
  const key = `search:${query}:page:${page}`;
  // Cache for 30 minutes
  await setKey(key, results, 30 * 60 * 1000);
}

export async function getSearchResults(query: string, page: number) {
  const key = `search:${query}:page:${page}`;
  return await getKey(key);
}

/**
 * Example 9: Processing flags
 */
export async function markProcessing(userId: string, conversationId: string) {
  const key = `processing:${userId}:${conversationId}`;
  // Mark as processing with 5 minute timeout
  await setKey(key, true, 5 * 60 * 1000);
}

export async function isProcessing(userId: string, conversationId: string) {
  const key = `processing:${userId}:${conversationId}`;
  const value = await getKey<boolean>(key);
  return value === true;
}

export async function clearProcessing(userId: string, conversationId: string) {
  const key = `processing:${userId}:${conversationId}`;
  await deleteKey(key);
}

/**
 * Dummy helper
 */
async function fetchUserData(userId: string) {
  return { id: userId, data: 'user data' };
}

