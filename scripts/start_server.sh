#!/bin/bash

echo "Starting Node server"
cd /home/ec2-user/Tortuga-Node

# Example: start your server in background with nohup
nohup npm start > app.log 2>&1 &
