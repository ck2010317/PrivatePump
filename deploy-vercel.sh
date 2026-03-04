#!/bin/bash

# PrivatePump Vercel Deployment Script
# This script helps you deploy PrivatePump to Vercel

set -e

echo "🚀 PrivatePump Vercel Deployment"
echo "════════════════════════════════════════════"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo ""
echo "📋 Deployment Steps:"
echo "1. Make sure you're logged in to Vercel"
echo "2. Set environment variables"
echo "3. Deploy the application"
echo ""

# Prompt for environment variables
read -p "Enter NEXT_PUBLIC_PROGRAM_ID (press Enter for default): " PROGRAM_ID
PROGRAM_ID=${PROGRAM_ID:-84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk}

read -p "Enter NEXT_PUBLIC_RPC_URL (press Enter for devnet): " RPC_URL
RPC_URL=${RPC_URL:-https://api.devnet.solana.com}

read -p "Enter NEXT_PUBLIC_SERVER_URL (press Enter to skip): " SERVER_URL
SERVER_URL=${SERVER_URL:-}

# Change to app directory
cd app || exit 1

echo ""
echo "🔐 Setting environment variables in Vercel..."

# Deploy with environment variables
if [ -z "$SERVER_URL" ]; then
    vercel --env NEXT_PUBLIC_PROGRAM_ID="$PROGRAM_ID" \
           --env NEXT_PUBLIC_RPC_URL="$RPC_URL" \
           --prod
else
    vercel --env NEXT_PUBLIC_PROGRAM_ID="$PROGRAM_ID" \
           --env NEXT_PUBLIC_RPC_URL="$RPC_URL" \
           --env NEXT_PUBLIC_SERVER_URL="$SERVER_URL" \
           --prod
fi

echo ""
echo "✅ Deployment complete!"
echo "📍 Check your Vercel dashboard for the deployment URL"
