#!/bin/bash

# Zentith LLM - System Database Setup Script
# Installs and configures PostgreSQL and Redis locally

set -e

echo "🚀 Setting up Zentith LLM databases..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo access."
   exit 1
fi

# Update package list
print_status "Updating package list..."
sudo apt-get update --allow-unauthenticated

# Install PostgreSQL
print_status "Installing PostgreSQL..."
sudo apt-get install -y postgresql postgresql-contrib --allow-unauthenticated

# Install Redis
print_status "Installing Redis..."
sudo apt-get install -y redis-server --allow-unauthenticated

# Start and enable PostgreSQL
print_status "Starting PostgreSQL service..."
sudo service postgresql start

# Start and enable Redis
print_status "Starting Redis service..."
sudo service redis-server start

# Configure PostgreSQL
print_status "Configuring PostgreSQL..."

# Fix collation version mismatch if it exists (ignoring errors if not applicable)
sudo -u postgres psql -c "ALTER DATABASE template1 REFRESH COLLATION VERSION;" 2>/dev/null || true
sudo -u postgres psql -c "ALTER DATABASE postgres REFRESH COLLATION VERSION;" 2>/dev/null || true

# Create database and user
sudo -u postgres psql -c "CREATE USER zentith_user WITH PASSWORD 'zentith_password';" 2>/dev/null || print_warning "User might already exist"
sudo -u postgres psql -c "CREATE DATABASE zentith OWNER zentith_user;" 2>/dev/null || print_warning "Database might already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE zentith TO zentith_user;"

# Run database initialization script
print_status "Initializing database schema..."
sudo -u postgres psql -d zentith -f "$(dirname "$0")/init.sql" || print_error "Failed to initialize database schema"

# Grant privileges on schema objects
print_status "Granting schema privileges..."
sudo -u postgres psql -d zentith -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zentith_user;"
sudo -u postgres psql -d zentith -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO zentith_user;"
sudo -u postgres psql -d zentith -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zentith_user;"
sudo -u postgres psql -d zentith -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO zentith_user;"

# Configure Redis
print_status "Configuring Redis..."
sudo cp /etc/redis/redis.conf /etc/redis/redis.conf.backup

# Enable Redis persistence
sudo sed -i 's/# save 3600 1/save 3600 1/' /etc/redis/redis.conf
sudo sed -i 's/# save 300 100/save 300 100/' /etc/redis/redis.conf
sudo sed -i 's/# save 60 10000/save 60 10000/' /etc/redis/redis.conf

# Restart Redis to apply changes
sudo systemctl restart redis-server

# Test connections
print_status "Testing database connections..."

# Test PostgreSQL
if sudo -u postgres psql -d zentith -c "SELECT 1;" >/dev/null 2>&1; then
    print_status "✅ PostgreSQL connection successful"
else
    print_error "❌ PostgreSQL connection failed"
fi

# Test Redis
if redis-cli ping | grep -q "PONG"; then
    print_status "✅ Redis connection successful"
else
    print_error "❌ Redis connection failed"
fi

print_status "🎉 Database setup complete!"
print_status ""
print_status "Database Details:"
print_status "  PostgreSQL: localhost:5432/zentith (user: zentith_user)"
print_status "  Redis: localhost:6379"
print_status ""
print_status "To start the application:"
print_status "  npm run dev"
print_status ""
print_status "Management commands:"
print_status "  PostgreSQL status: sudo systemctl status postgresql"
print_status "  Redis status: sudo systemctl status redis-server"
print_status "  PostgreSQL logs: sudo journalctl -u postgresql -f"
print_status "  Redis logs: sudo journalctl -u redis-server -f"