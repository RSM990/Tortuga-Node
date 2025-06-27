#!/bin/bash

echo "Starting Node server"
cd /home/ec2-user/Tortuga-Node

# explicitly set production mode
# export NODE_ENV=production

# Example: start your server in background with nohup
nohup npm start > app.log 2>&1 &
