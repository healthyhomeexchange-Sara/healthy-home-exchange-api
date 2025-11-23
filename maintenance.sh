#!/usr/bin/env bash
# Maintenance script for healthy-home-exchange-api-new
# Run: bash maintenance.sh

set -euo pipefail

PROJECT_DIR="/Users/sara2/healthy-home-exchange-api/healthy-home-exchange-api-new"
cd "$PROJECT_DIR"

echo "=========================================="
echo "Healthy Home Exchange - Maintenance"
echo "=========================================="
echo ""

# 1. Show running processes
echo "1. Checking PM2 processes..."
pm2 ls | grep hhex-new || echo "  ⚠️  hhex-new not running"
echo ""

# 2. Syntax checks
echo "2. Running syntax checks..."
if node --check server.js; then
  echo "  ✓ server.js - OK"
else
  echo "  ✗ server.js - SYNTAX ERROR"
fi

if node --check models/listing.js; then
  echo "  ✓ models/listing.js - OK"
else
  echo "  ✗ models/listing.js - SYNTAX ERROR"
fi

if node --check utils/email.js; then
  echo "  ✓ utils/email.js - OK"
else
  echo "  ✗ utils/email.js - SYNTAX ERROR"
fi
echo ""

# 3. API smoke tests
echo "3. Running API smoke tests..."
bash test_api.sh
echo ""

# 4. Check PM2 logs for errors
echo "4. Recent PM2 logs (last 20 lines)..."
pm2 logs hhex-new --lines 20 --nostream 2>&1 | tail -20
echo ""

# 5. Optional cleanup
read -p "Run delete_old_listings.js to remove listings older than 60 days? [y/N]: " cleanup
if [[ "${cleanup,,}" == "y" ]]; then
  echo "Running cleanup..."
  node scripts/delete_old_listings.js
fi
echo ""

# 6. Optional email test
read -p "Send test email? [y/N]: " emailtest
if [[ "${emailtest,,}" == "y" ]]; then
  echo "Sending test email..."
  node scripts/send_test_email.js
fi
echo ""

echo "=========================================="
echo "Maintenance Complete"
echo "=========================================="
echo ""
echo "Summary:"
pm2 show hhex-new || true
echo ""
echo "To restart: pm2 restart hhex-new"
echo "To view logs: pm2 logs hhex-new"
echo "To stop: pm2 stop hhex-new"
