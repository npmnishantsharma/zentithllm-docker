#!/bin/bash

# Zentith LLM - Reliable database startup script
# Starts PostgreSQL clusters (not only the meta service)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_status "Starting PostgreSQL..."

if command -v pg_lsclusters >/dev/null 2>&1; then
  if pg_lsclusters --no-header | grep -q .; then
    while read -r version cluster _port status _rest; do
      if [ "$status" = "online" ]; then
        print_status "PostgreSQL cluster ${version}/${cluster} is already online"
      else
        print_status "Starting PostgreSQL cluster ${version}/${cluster}..."
        sudo pg_ctlcluster "$version" "$cluster" start
      fi
    done < <(pg_lsclusters --no-header)
  else
    print_warning "No PostgreSQL clusters found. Falling back to service start."
    sudo service postgresql start
  fi
else
  print_warning "pg_lsclusters not found. Falling back to service start."
  sudo service postgresql start
fi

if command -v pg_isready >/dev/null 2>&1; then
  if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    print_status "✅ PostgreSQL is accepting connections on 127.0.0.1:5432"
  else
    print_error "❌ PostgreSQL is not accepting connections on 127.0.0.1:5432"
    exit 1
  fi
fi

print_status "Databases started successfully."
