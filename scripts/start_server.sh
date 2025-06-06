#!/bin/bash
echo "Starting the app with PM2..."
cd /home/ec2-user/app
pm2 start index.js --name tortuga-node-api || pm2 restart tortuga-node-api
