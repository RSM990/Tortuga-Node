#!/bin/bash
set -e

echo "Starting Node server with PM2..."

cd /home/ec2-user/Tortuga-Node

# Set environment
export NODE_ENV=production

# Debug info
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "PM2 version: $(pm2 -v)"

# Load environment variables if file exists
if [ -f /home/ec2-user/.tortuga_env ]; then
  echo "Loading environment variables..."
  source /home/ec2-user/.tortuga_env
fi

# Stop any existing process
echo "Stopping any existing PM2 processes..."
pm2 delete tortuga-app || true

# Start using ecosystem file
echo "Starting app with PM2..."
pm2 start ecosystem.config.js --env production

# Save state
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

# Test health check
echo "Testing health check..."
if curl -f http://localhost:3000/healthz; then
    echo "✅ Server started successfully!"
    pm2 status
    pm2 logs tortuga-app --lines 10
else
    echo "❌ Health check failed - showing logs:"
    pm2 logs tortuga-app --lines 50
    exit 1
fi