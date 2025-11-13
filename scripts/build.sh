#!/bin/bash
set -e

echo "Building TypeScript..."
cd /home/ec2-user/Tortuga-Node

npm run build

if [ ! -d "dist" ]; then
    echo "ERROR: Build failed - dist/ directory not created"
    exit 1
fi

echo "✅ Build completed successfully"
ls -la dist/