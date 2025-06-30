#!/bin/bash

echo "Starting Node server with PM2..."

cd /home/ec2-user/Tortuga-Node

# Ensure environment is set
export NODE_ENV=production

# Install dependencies just in case
npm install

# Stop any existing PM2 process for this app (won’t throw error if not running)
pm2 stop tortuga-app || true

# Start the app using pm2 with a consistent name
pm2 start ecosystem.config.js --env production

# Save the current PM2 process list
pm2 save

# Set up PM2 to restart on reboot
pm2 startup | grep sudo | bash
