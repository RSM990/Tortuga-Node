#!/bin/bash

echo "Installing Node.js and PM2..."

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install PM2 globally
npm install -g pm2

# Check versions (optional)
node -v
npm -v
pm2 -v
