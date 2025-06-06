#!/bin/bash
echo "Stopping any running app..."
pm2 stop index.js || true
