#!/bin/bash

echo "Starting Node server"
cd /home/ec2-user/Tortuga-Node

# prefix the env var
nohup NODE_ENV=production npm start > app.log 2>&1 &

