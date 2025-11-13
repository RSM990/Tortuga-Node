#!/bin/bash
set -e

echo "Starting Node server with PM2..."

cd /home/ec2-user/Tortuga-Node

# Set environment
export NODE_ENV=production
export PORT=3000

# Debug info
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "PM2 version: $(pm2 -v)"

# Load environment variables if file exists
if [ -f /home/ec2-user/.tortuga_env ]; then
  echo "Loading environment variables..."
  source /home/ec2-user/.tortuga_env
fi

# Stop ALL existing processes and clear saved state
echo "Stopping all PM2 processes and clearing saved state..."
pm2 delete all || true
pm2 save --force  # Clear the saved process list
pm2 kill          # Kill PM2 daemon to start fresh

# Update PM2 (now with clean state)
echo "Updating PM2..."
pm2 update || true

# Start app directly with correct path
echo "Starting app with PM2..."
pm2 start dist/server.js \
  --name tortuga-app \
  --node-args="--max-old-space-size=2048"

# Save NEW state
echo "Saving PM2 process list..."
pm2 save

# Setup PM2 to start on boot (run once)
if [ ! -f /home/ec2-user/.pm2-startup-done ]; then
  echo "Setting up PM2 startup..."
  pm2 startup systemd -u ec2-user --hp /home/ec2-user | grep sudo | bash || true
  touch /home/ec2-user/.pm2-startup-done
fi

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

# Test health check with retries
echo "Testing health check..."
MAX_RETRIES=10
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
  if curl -f -s http://localhost:3000/healthz > /dev/null 2>&1; then
    echo "✅ Server started successfully!"
    curl http://localhost:3000/healthz
    echo ""
    pm2 status
    exit 0
  else
    RETRY=$((RETRY+1))
    echo "Health check attempt $RETRY/$MAX_RETRIES failed, waiting..."
    sleep 3
  fi
done

echo "❌ Health check failed after $MAX_RETRIES attempts"
echo "PM2 Status:"
pm2 status
echo ""
echo "PM2 Logs:"
pm2 logs tortuga-app --lines 50 --nostream
exit 1