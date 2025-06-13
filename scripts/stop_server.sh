#!/bin/bash

echo "Stopping Node server (if running)"
# Kill any Node processes running on your app port
# Replace 3000 with your app port if necessary
fuser -k 3000/tcp || true
