#!/bin/bash

echo "Starting Node server with PM2 using ecosystem.config.js..."

cd /home/ec2-user/Tortuga-Node

# Confirm environment
export NODE_ENV=production
node -v
npm -v
pm2 -v

# Install dependencies cleanly
npm ci --omit=dev

# Stop and delete old PM2 app if it exists
pm2 delete tortuga-app || true

# Start using the ecosystem config
pm2 start ecosystem.config.js --env production

# Save PM2 state
pm2 save

# Ensure PM2 restarts on reboot (run once)
if [ ! -f /home/ec2-user/.pm2-startup-done ]; then
  pm2 startup systemd -u ec2-user --hp /home/ec2-user | grep sudo | bash
  touch /home/ec2-user/.pm2-startup-done
fi
