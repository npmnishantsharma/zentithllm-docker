# Running Redis Locally (Without Docker)

## 🚀 Installation on Ubuntu/Debian

### Option 1: Using apt (Recommended)

```bash
# Update package manager
sudo apt-get update

# Install Redis
sudo apt-get install -y redis-server

# Verify installation
redis-cli --version
```

### Option 2: Install from Source

```bash
# Install dependencies
sudo apt-get install -y build-essential tcl

# Download Redis (check latest version at https://redis.io/download)
wget http://download.redis.io/redis-stable.tar.gz
tar xzf redis-stable.tar.gz
cd redis-stable

# Compile
make
make test

# Install
sudo make install

# Verify
redis-cli --version
```

## 🔧 Starting Redis

### Option 1: Start as a Service (Recommended)

```bash
# Start Redis service
sudo systemctl start redis-server

# Enable auto-start on boot
sudo systemctl enable redis-server

# Check status
sudo systemctl status redis-server

# Stop Redis
sudo systemctl stop redis-server

# Restart Redis
sudo systemctl restart redis-server

# View logs
sudo journalctl -u redis-server -f
```

### Option 2: Start Redis Manually

```bash
# Run Redis in foreground (logs visible)
redis-server

# Or run in background with config
redis-server /etc/redis/redis.conf
```

## ✅ Verify Redis is Running

```bash
# Test connection
redis-cli ping
# Should return: PONG

# Get Redis info
redis-cli INFO

# Check Redis version
redis-cli --version

# Monitor real-time commands
redis-cli MONITOR

# View memory usage
redis-cli INFO memory
```

## 🔐 Configuration

Default config file: `/etc/redis/redis.conf`

### Common Settings

```bash
# Edit config
sudo nano /etc/redis/redis.conf

# Key settings to check:
# port 6379                    # Default port
# bind 127.0.0.1              # Only localhost (for security)
# requirepass yourpassword     # Set password (optional)
# appendonly yes               # Enable persistence
```

### For Development (Simple)

```bash
# Minimal setup - just start server
redis-server
```

### For Production

```bash
# Edit config
sudo nano /etc/redis/redis.conf

# Set these:
port 6379
bind 127.0.0.1
requirepass your_secure_password
appendonly yes
appendfsync everysec
maxmemory 256mb
maxmemory-policy allkeys-lru
```

## 📊 Check if Redis is Running

```bash
# Method 1: Check process
ps aux | grep redis

# Method 2: Check listening port
netstat -tlnp | grep 6379
# or
lsof -i:6379

# Method 3: Try to connect
redis-cli ping
```

## 🛠️ Useful Commands

```bash
# Connect to Redis
redis-cli

# Once connected, useful commands:
PING                          # Test connection
INFO                          # Server info
DBSIZE                        # Number of keys
KEYS *                        # All keys
FLUSHDB                       # Clear current database
FLUSHALL                      # Clear all databases
MONITOR                       # Monitor commands in real-time
SAVE                          # Manually save (RDB)
BGSAVE                        # Background save
SHUTDOWN                      # Shutdown server

# Check memory
INFO memory

# Check stats
INFO stats
```

## 🔄 Data Persistence

Redis has two persistence options:

### 1. RDB (Snapshots)
```bash
# Edit config
sudo nano /etc/redis/redis.conf

# Add:
save 900 1          # Save after 900s if 1+ key changed
save 300 10         # Save after 300s if 10+ keys changed
save 60 10000       # Save after 60s if 10000+ keys changed
```

### 2. AOF (Append-Only File)
```bash
# Edit config
sudo nano /etc/redis/redis.conf

# Add:
appendonly yes
appendfsync everysec
```

## 🌐 Configure for Your App

Update your `.env.local`:

```env
# Local Redis (default)
REDIS_URL=redis://localhost:6379

# With password (if set)
REDIS_URL=redis://:yourpassword@localhost:6379

# Custom port
REDIS_URL=redis://localhost:6380
```

## 🧪 Test with Your App

```bash
# 1. Start Redis
redis-server

# 2. In another terminal, start your app
npm run dev

# 3. In another terminal, monitor Redis
redis-cli MONITOR

# 4. Login to your app - watch Redis activity
```

## 📈 Monitor Redis Usage

```bash
# Real-time stats
watch -n 1 'redis-cli INFO stats | grep "total_"'

# Memory usage
redis-cli INFO memory | grep used

# Number of connections
redis-cli INFO clients | grep connected

# Commands per second
redis-cli INFO stats | grep "instantaneous"

# Key count
redis-cli DBSIZE
```

## 🚨 Troubleshooting

### Redis not starting
```bash
# Check logs
sudo journalctl -u redis-server -n 50

# Check if port is in use
lsof -i :6379

# Check config syntax
redis-server /etc/redis/redis.conf --test-memory 1
```

### Connection refused
```bash
# Make sure Redis is running
redis-cli ping

# Check firewall (if needed)
sudo ufw allow 6379

# Check bind address in config
grep "^bind" /etc/redis/redis.conf
```

### Out of memory
```bash
# Check memory usage
redis-cli INFO memory

# Increase maxmemory in config
sudo nano /etc/redis/redis.conf
# maxmemory 512mb
# maxmemory-policy allkeys-lru
```

### Slow performance
```bash
# Check for slow queries
redis-cli SLOWLOG GET 10

# Clear slow log
redis-cli SLOWLOG RESET

# Monitor commands
redis-cli MONITOR
```

## 🔄 Backup & Restore

```bash
# Backup RDB file
cp /var/lib/redis/dump.rdb ~/redis-backup.rdb

# Backup AOF file
cp /var/lib/redis/appendonly.aof ~/redis-appendonly.aof

# Restore (stop Redis first)
sudo systemctl stop redis-server
sudo cp ~/redis-backup.rdb /var/lib/redis/dump.rdb
sudo chown redis:redis /var/lib/redis/dump.rdb
sudo systemctl start redis-server
```

## ✨ Quick Setup Summary

```bash
# Install
sudo apt-get install -y redis-server

# Start
sudo systemctl start redis-server

# Verify
redis-cli ping

# Update .env.local
echo "REDIS_URL=redis://localhost:6379" >> .env.local

# Start your app
npm run dev

# Monitor (optional)
redis-cli MONITOR
```

---

**Done!** Redis is now running locally on port 6379. Your app will automatically use it when you set `REDIS_URL=redis://localhost:6379` in `.env.local`.
