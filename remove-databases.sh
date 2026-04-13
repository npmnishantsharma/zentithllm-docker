#!/bin/bash

# Zentith LLM - Database Removal Script
# Removes PostgreSQL from the system

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

echo "⚠️  WARNING: This will remove PostgreSQL from your system!"
echo "   All data will be permanently deleted."
echo
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status "Operation cancelled."
    exit 0
fi

print_warning "Stopping services..."
sudo systemctl stop postgresql 2>/dev/null || true
sudo systemctl disable postgresql 2>/dev/null || true

print_warning "Removing packages..."
sudo apt-get remove --purge -y postgresql postgresql-contrib

print_warning "Removing data directories..."
sudo rm -rf /var/lib/postgresql
sudo rm -rf /var/log/postgresql
sudo rm -rf /etc/postgresql

print_warning "Removing system user..."
sudo userdel postgres 2>/dev/null || true
sudo groupdel postgres 2>/dev/null || true
print_warning "Cleaning up..."
sudo apt-get autoremove -y
sudo apt-get autoclean

print_status "✅ PostgreSQL has been removed from your system."
print_status ""
print_status "To reinstall, run: npm run db:setup"