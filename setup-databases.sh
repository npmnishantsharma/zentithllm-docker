#!/bin/bash

# Zentith LLM - System Database Setup Script
# Installs and configures PostgreSQL locally

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


# Update package list
print_status "Updating package list..."
sudo apt-get update --allow-unauthenticated

# Install PostgreSQL
print_status "Installing PostgreSQL..."
sudo apt-get install -y postgresql postgresql-contrib --allow-unauthenticated

# Start and enable PostgreSQL
print_status "Starting PostgreSQL service..."
sudo service postgresql start

# Configure PostgreSQL
print_status "Configuring PostgreSQL..."

# Fix collation version mismatch if it exists (ignoring errors if not applicable)
sudo -u postgres psql -c "ALTER DATABASE template1 REFRESH COLLATION VERSION;" 2>/dev/null || true
sudo -u postgres psql -c "ALTER DATABASE postgres REFRESH COLLATION VERSION;" 2>/dev/null || true

# Create database user if needed and always enforce expected password
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zentith_user') THEN
        CREATE ROLE zentith_user LOGIN;
    END IF;
END
$$;
ALTER ROLE zentith_user WITH PASSWORD 'zentith_password';
SQL

# Create database if needed (CREATE DATABASE cannot run inside DO/transaction blocks)
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='zentith'" | grep -q 1; then
        sudo -u postgres createdb -O zentith_user zentith
else
        print_warning "Database zentith already exists"
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE zentith TO zentith_user;"

# Run database initialization script
print_status "Initializing database schema..."
sudo -u postgres psql -d zentith -f "$(dirname "$0")/init.sql" || print_error "Failed to initialize database schema"

# Repair user_sessions shape for pre-existing databases
print_status "Ensuring session table schema is current..."
sudo -u postgres psql -d zentith -c "ALTER TABLE IF EXISTS user_sessions ADD COLUMN IF NOT EXISTS session_data JSONB NOT NULL DEFAULT '{}'::jsonb;"
sudo -u postgres psql -d zentith -c "CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);"
sudo -u postgres psql -d zentith -c "CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);"

# Grant privileges on schema objects
print_status "Granting schema privileges..."
sudo -u postgres psql -d zentith -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zentith_user;"
sudo -u postgres psql -d zentith -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO zentith_user;"
sudo -u postgres psql -d zentith -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zentith_user;"
sudo -u postgres psql -d zentith -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO zentith_user;"

# Test connections
print_status "Testing database connections..."

# Test PostgreSQL
if sudo -u postgres psql -d zentith -c "SELECT 1;" >/dev/null 2>&1; then
    print_status "✅ PostgreSQL connection successful"
else
    print_error "❌ PostgreSQL connection failed"
fi

print_status "🎉 Database setup complete!"
print_status ""
print_status "Database Details:"
print_status "  PostgreSQL: localhost:5432/zentith (user: zentith_user)"
print_status ""
print_status "To start the application:"
print_status "  npm run dev"
print_status ""
print_status "Management commands:"
print_status "  PostgreSQL status: sudo systemctl status postgresql"
print_status "  PostgreSQL logs: sudo journalctl -u postgresql -f"