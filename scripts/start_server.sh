#!/bin/bash

echo "Starting Node server with PM2 using ecosystem.config.js..."

cd /home/ec2-user/Tortuga-Node

# Set environment
export NODE_ENV=production

# Debug info (optional but helpful for deploy logs)
node -v
npm -v
pm2 -v

# 🔄 Don't install here anymore if you're using install_deps.sh
# npm ci --omit=dev    # <-- move this to install_deps.sh if you're splitting hooks

# Ensure old PM2 process is gone
pm2 delete tortuga-app || true

# Start using ecosystem file
source /home/ec2-user/.tortuga_env
pm2 start ecosystem.config.js --env production

# Save state
pm2 save

# Only run startup command once
if [ ! -f /home/ec2-user/.pm2-startup-done ]; then
  pm2 startup systemd -u ec2-user --hp /home/ec2-user | grep sudo | bash
  touch /home/ec2-user/.pm2-startup-done
fi
