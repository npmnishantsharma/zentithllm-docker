#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Tests PostgreSQL and Redis connections
 */

const { Pool } = require('pg');
const { createClient } = require('redis');

// PostgreSQL connection test
async function testPostgres() {
  console.log('🔍 Testing PostgreSQL connection...');

  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'zentith',
    user: process.env.POSTGRES_USER || 'zentith_user',
    password: process.env.POSTGRES_PASSWORD || 'zentith_password',
  });

  try {
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ PostgreSQL connected successfully');
    console.log('   Current time:', result.rows[0].current_time);

    // Test if our tables exist
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'conversations', 'messages')
    `);

    if (tablesResult.rows.length > 0) {
      console.log('✅ Database tables found:', tablesResult.rows.map(r => r.table_name).join(', '));
    } else {
      console.log('⚠️  No database tables found. Run setup-databases.sh to initialize schema');
    }

    await pool.end();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    return false;
  }
}

// Redis connection test
async function testRedis() {
  console.log('🔍 Testing Redis connection...');

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    const client = createClient({ url: redisUrl });

    await client.connect();
    const pong = await client.ping();
    console.log('✅ Redis connected successfully');
    console.log('   PING response:', pong);

    // Test basic operations
    await client.set('test_key', 'test_value');
    const value = await client.get('test_key');
    console.log('✅ Redis operations working:', value);

    await client.del('test_key');
    await client.disconnect();
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    return false;
  }
}

// Main test function
async function main() {
  console.log('🚀 Testing Zentith LLM Database Connections\n');

  const postgresOk = await testPostgres();
  console.log();
  const redisOk = await testRedis();

  console.log('\n📊 Test Results:');
  console.log('   PostgreSQL:', postgresOk ? '✅ PASS' : '❌ FAIL');
  console.log('   Redis:', redisOk ? '✅ PASS' : '❌ FAIL');

  if (postgresOk && redisOk) {
    console.log('\n🎉 All database connections successful!');
    console.log('   Your app should be able to connect to both databases.');
  } else {
    console.log('\n⚠️  Some database connections failed.');
    console.log('   Check your database services and configuration.');
  }

  process.exit(postgresOk && redisOk ? 0 : 1);
}

main().catch(console.error);