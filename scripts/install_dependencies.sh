#!/bin/bash
cd /home/ec2-user/Tortuga-Node

# Clean old node_modules to avoid permissions issue
rm -rf node_modules package-lock.json

# Install cleanly
npm install --omit=dev
