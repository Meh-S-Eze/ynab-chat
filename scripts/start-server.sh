#!/bin/bash

# Load environment variables
export YNAB_TOKEN="your_ynab_token_here"
export DB_HOST="ep-divine-mouse-a4r514nc.us-east-1.aws.neon.tech"
export DB_PORT="5432"
export DB_NAME="neondb"
export DB_USER="neondb_owner"
export DB_PASSWORD="npg_T4PvwKot0zIN"
export NODE_ENV="development"

# Start the server
ts-node --project tsconfig.json src/server.ts 