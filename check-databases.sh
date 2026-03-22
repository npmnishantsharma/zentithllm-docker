#!/bin/bash

# Zentith LLM - Database Status Check
# Verifies PostgreSQL and Redis are running and accessible

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🔍 Checking Zentith LLM database status..."
echo

# Check PostgreSQL service
echo "PostgreSQL:"
if sudo service postgresql status >/dev/null 2>&1; then
    print_status "✅ Service is running"
else
    print_error "❌ Service is not running"
    echo "   Start with: sudo service postgresql start"
fi

# Test PostgreSQL connection
if command -v psql >/dev/null 2>&1; then
    if sudo -u postgres psql -d zentith -c "SELECT 1;" >/dev/null 2>&1; then
        print_status "✅ Database connection successful"
    else
        print_error "❌ Cannot connect to database"
        echo "   Check if database exists: sudo -u postgres psql -l"
    fi
else
    print_warning "⚠️  psql client not found"
fi

echo

# Check Redis service
echo "Redis:"
if sudo service redis-server status >/dev/null 2>&1; then
    print_status "✅ Service is running"
else
    print_error "❌ Service is not running"
    echo "   Start with: sudo service redis-server start"
fi

# Test Redis connection
if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli ping 2>/dev/null | grep -q "PONG"; then
        print_status "✅ Connection successful"
    else
        print_error "❌ Cannot connect to Redis"
    fi
else
    print_warning "⚠️  redis-cli not found"
fi

echo
print_status "Status check complete!"
echo
echo "Quick commands:"
echo "  Start databases: npm run db:start"
echo "  Stop databases:  npm run db:stop"
echo "  View logs:       npm run db:logs"
echo "  Reset database:  npm run db:reset"