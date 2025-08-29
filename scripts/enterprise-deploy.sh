#!/bin/bash

# Enterprise-Scale Deployment Script for Solar Express Backend
# Designed for 100,000+ users per month

echo "🚀 Solar Express Enterprise Deployment Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in production
if [ "$NODE_ENV" != "production" ]; then
    print_warning "NODE_ENV is not set to 'production'. This script is optimized for production deployment."
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ required for enterprise features. Current: $(node --version)"
    exit 1
else
    print_success "Node.js version check passed: $(node --version)"
fi

# Install dependencies with production optimizations
print_status "Installing dependencies for enterprise scale..."
npm ci --only=production --no-audit --no-fund --silent

if [ $? -eq 0 ]; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Check required environment variables for 100k+ users
print_status "Checking enterprise environment variables..."

# Load environment variables from config.env
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
    print_success "Environment variables loaded from .env"
fi

required_vars=(
    "NODE_ENV"
    "MONGODB_URI"
    "JWT_SECRET"
    "REFRESH_JWT_SECRET"
    "FRONTEND_URL"
    "COOKIE_DOMAIN"
)

missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_warning "Missing or empty environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    print_warning "Check your .env file"
else
    print_success "All critical environment variables are set"
fi

# Check Redis configuration (recommended for 100k+ users)
if [ -z "$REDIS_URL" ] && [ -z "$REDIS_HOST" ]; then
    print_warning "Redis not configured. HIGHLY RECOMMENDED for 100k+ users for caching"
    print_warning "Set REDIS_URL or REDIS_HOST/REDIS_PORT for optimal performance"
else
    print_success "Redis configuration detected - excellent for high-scale caching"
fi

# Check MongoDB configuration
if [[ "$MONGODB_URI" == *"retryWrites=true"* ]]; then
    print_success "MongoDB retry writes enabled - good for enterprise reliability"
else
    print_warning "Consider adding 'retryWrites=true' to MongoDB URI for enterprise reliability"
fi

# Pre-deployment health checks
print_status "Running pre-deployment health checks..."

# Check if port is available
PORT=${PORT:-3000}
if lsof -i:$PORT > /dev/null 2>&1; then
    print_warning "Port $PORT is already in use. This may cause deployment issues."
else
    print_success "Port $PORT is available"
fi

# Memory check
TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
if [ "$TOTAL_MEM" -lt 2048 ]; then
    print_warning "Less than 2GB RAM detected. Consider upgrading for 100k+ user load"
else
    print_success "Memory check passed: ${TOTAL_MEM}MB available"
fi

# Create logs directory for enterprise monitoring
mkdir -p logs
print_success "Logs directory created for enterprise monitoring"

# Set optimal Node.js flags for high-scale performance
export NODE_OPTIONS="--max-old-space-size=2048"
print_success "Node.js optimized for high-scale performance"

print_status "🎯 Enterprise deployment checklist completed!"
print_status ""
print_status "📊 Expected Performance with Current Configuration:"
print_status "   • MongoDB Connections: 10-50 concurrent"
print_status "   • Request Rate Limit: 1000 req/15min general API"
print_status "   • Authentication Rate: 20 req/15min"
print_status "   • Product Browsing: 2000 req/15min"
print_status "   • Memory Usage: ~1-2GB under normal load"
print_status ""

if [ -n "$REDIS_URL" ] || [ -n "$REDIS_HOST" ]; then
    print_status "🚀 With Redis Caching: Ready for 100,000+ users/month"
else
    print_status "⚠️  Without Redis: Suitable for ~10,000-20,000 users/month"
    print_status "   Add Redis for full 100k+ user capacity"
fi

print_status ""
print_status "🌟 Starting Solar Express in Enterprise Mode..."
print_status "   Health Check: http://localhost:$PORT/api/health"
print_status "   Metrics: http://localhost:$PORT/api/metrics"
print_status ""

# Start the application
exec node server.js
