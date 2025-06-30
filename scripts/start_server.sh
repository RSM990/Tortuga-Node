#!/bin/bash

echo "Starting Node server with PM2"

cd /home/ec2-user/Tortuga-Node

# Install dependencies and PM2 if not present
npm install
npm install pm2 -g

# Start with production environment
pm2 start ecosystem.config.js --env production

# Optional: Save the PM2 process list for restarts on reboot
pm2 save
pm2 startup | tail -n 1 | bash
