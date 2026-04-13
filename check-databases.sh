#!/bin/bash

# Zentith LLM - Database Status Check
# Verifies PostgreSQL is running and accessible

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

# Check PostgreSQL service/cluster
echo "PostgreSQL:"
if command -v pg_lsclusters >/dev/null 2>&1 && pg_lsclusters --no-header 2>/dev/null | awk '{print $4}' | grep -q "online"; then
    print_status "✅ At least one PostgreSQL cluster is online"
elif sudo service postgresql status >/dev/null 2>&1; then
    print_warning "⚠️ PostgreSQL service wrapper is active, but no online cluster detected"
else
    print_error "❌ PostgreSQL service is not running"
    echo "   Start with: npm run db:start"
fi

if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
        print_status "✅ TCP endpoint is accepting connections on 127.0.0.1:5432"
    else
        print_error "❌ TCP endpoint is not accepting connections on 127.0.0.1:5432"
    fi
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

echo
print_status "Status check complete!"
echo
echo "Quick commands:"
echo "  Start databases: npm run db:start"
echo "  Stop databases:  npm run db:stop"
echo "  View logs:       npm run db:logs"
echo "  Reset database:  npm run db:reset"