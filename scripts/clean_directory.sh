#!/bin/bash

echo "Cleaning up /home/ec2-user/Tortuga-Node"

# Remove entire directory (including .git folder)
rm -rf /home/ec2-user/Tortuga-Node

# Recreate the directory so CodeDeploy has somewhere to deploy to
mkdir -p /home/ec2-user/Tortuga-Node

echo "Cleaned up successfully."
