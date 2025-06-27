#!/bin/bash

echo "Starting Node server"
cd /home/ec2-user/Tortuga-Node

# 1) export in this shell
export NODE_ENV=production

# 2) now nohup will pick it up
nohup npm start > app.log 2>&1 &