#!/bin/bash

# SAFE TO RUN MULTIPLE TIMES

set -e

# Frontend setup for Movi project
echo "🚀 Setting up Movi Frontend..."
echo "================================"

echo "Moving into movi-frontend..."
cd movi-frontend

# Install dependencies
echo "📥 Installing frontend dependencies..."
echo "This may take a few minutes..."

if npm install; then
    echo "✅ Frontend dependencies installed successfully!"
    cd ..
else
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

echo ""
echo "🎉 Frontend setup completed successfully!"
echo "================================"
echo "Next steps:"
echo "  1. cd movi-frontend"
echo "  2. npm run start (or npx expo start)"
echo ""

# Backend setup for Movi project
echo "🚀 Setting up Movi Api..."
echo "================================"

echo "Moving into Movi-api..."
cd movi-api

# Install dependencies
pip install -r requirements.txt

# Create .env file if it doesn't exist
echo "📄 Checking for .env file..."
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
MONGODB_URI=
DB_NAME=
PORT=3000
TMDB_V3_KEY=
EOF
    echo "✅ .env file created successfully!"
    echo "⚠️  Please update the .env file with your actual configuration values"
else
    echo "✅ .env file already exists"
fi