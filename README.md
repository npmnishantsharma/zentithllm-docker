# Zentith LLM - System Database Setup

A Next.js application with PostgreSQL + Redis for local data storage.

## 🗄️ Database Architecture

- **PostgreSQL**: Long-term storage for users, conversations, and messages
- **Redis**: Short-term storage for sessions, cache, and temporary data
- **System Installation**: All databases run directly on your system, no containers

## 🚀 Quick Start

### 1. Install Databases

```bash
# One-time setup (installs PostgreSQL and Redis system-wide)
npm run db:setup

# Or run the script directly
./setup-databases.sh
```

### 2. Start Databases

```bash
# Start PostgreSQL and Redis services
npm run db:start
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment

The environment variables are already configured for system installation in `.env.local`.

### 5. Run the Application

```bash
npm run dev
```

Visit `http://localhost:9002` to access the application.

## 📊 Database Services

### PostgreSQL (Port 5432)
- **Purpose**: Persistent data storage
- **Data**: Users, conversations, messages
- **Location**: `/var/lib/postgresql/data`
- **User**: zentith_user
- **Database**: zentith

### Redis (Port 6379)
- **Purpose**: Fast caching and sessions
- **Data**: Session tokens, temporary cache
- **Location**: `/var/lib/redis`
- **Persistence**: AOF (Append Only File) enabled

## 🔧 Database Management

### Check Status

```bash
npm run db:status
```

### View Logs

```bash
# PostgreSQL logs
npm run db:logs

# Redis logs
npm run db:redis-logs
```

### Reset Database

```bash
# WARNING: This deletes all data
npm run db:reset
```

### Manual Database Access

```bash
# PostgreSQL CLI
sudo -u postgres psql -d zentith

# Redis CLI
redis-cli
```

## 🔒 Security

- All data is stored locally on your system
- PostgreSQL uses system authentication
- Redis runs without password (local access only)
- Session cookies are HttpOnly and secure
- No external database connections

## 📝 System Requirements

- Ubuntu/Debian-based Linux distribution
- sudo access for database installation
- At least 2GB free disk space
- At least 1GB RAM

## 🛠️ Troubleshooting

### PostgreSQL Issues

```bash
# Check if service is running
sudo service postgresql status

# Restart service
sudo service postgresql restart

# Check logs
sudo journalctl -u postgresql -n 50
```

### Redis Issues

```bash
# Check if service is running
sudo service redis-server status

# Restart service
sudo service redis-server restart

# Test connection
redis-cli ping
```

### Permission Issues

If you get permission errors, make sure you're running commands with appropriate privileges:
- Use `sudo` for system service commands
- Use `sudo -u postgres` for PostgreSQL commands

## 📋 Database Schema

The database schema is automatically created during setup via `init.sql`:

- `users` - User profiles and authentication
- `conversations` - Chat conversations
- `messages` - Individual chat messages
- `user_sessions` - Session tracking (for analytics)

## 🔄 Data Persistence

- PostgreSQL data persists across system restarts
- Redis data uses AOF persistence
- No data loss on system reboot
- Backup important data regularly
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=zentith
POSTGRES_USER=zentith_user
POSTGRES_PASSWORD=zentith_password

# Redis
REDIS_URL=redis://localhost:6379
```

### API Endpoints

- `/api/models` - List available models
- `/api/auth/*` - Authentication endpoints
- `/api/profile` - User profile management

## 🔒 Security

- All data is stored locally on your device
- No external API calls for data storage
- Session cookies are HttpOnly and secure
- Passwords are handled via passkeys (WebAuthn)

## 📝 Notes

- First user to register becomes an admin automatically
- Sessions expire after 24 hours
- Database connections are pooled for performance
- Redis persistence is enabled with AOF (Append Only File)
