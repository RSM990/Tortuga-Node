#!/bin/bash

cd /home/ec2-user/Tortuga-Node

# Force ownership of everything
sudo chown -R ec2-user:ec2-user .

# Now remove node_modules (safe because we own it now)
rm -rf node_modules package-lock.json

# Clean install (as ec2-user)
npm install --omit=dev
