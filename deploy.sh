#!/bin/bash
# ============================================
# Production Deployment Script
# Local-Business-Automizer v2.0
# ============================================

set -e  # Exit on error

echo "🚀 Starting Production Deployment..."

# 1. Build Check
echo "📋 Step 1: Checking build files..."
if [ ! -f "index.html" ]; then
    echo "❌ index.html not found!"
    exit 1
fi
echo "✅ Build files present"

# 2. Create production build directory
echo "📦 Step 2: Creating production build..."
rm -rf dist
mkdir -p dist

# Copy files
cp -r css dist/
cp -r js dist/
cp index.html dist/
cp manifest.json dist/
cp service-worker.js dist/
cp .htaccess dist/
cp netlify.toml dist/

echo "✅ Production build created in ./dist"

# 3. Optimize (optional)
echo "🔧 Step 3: Optimization..."
# Could add minification here if needed
echo "✅ Optimization skipped (files already optimized)"

# 4. Test production build
echo "🧪 Step 4: Testing production build..."
if [ ! -f "dist/index.html" ]; then
    echo "❌ Production build failed!"
    exit 1
fi
echo "✅ Production build verified"

# 5. Create deployment package
echo "📦 Step 5: Creating deployment package..."
cd dist
zip -r ../mhs-production-$(date +%Y%m%d-%H%M%S).zip . -x "*.git*"
cd ..
echo "✅ Deployment package created"

# 6. Display deployment info
echo ""
echo "✅ Production Deployment Ready!"
echo ""
echo "📁 Build Directory: ./dist"
echo "📦 Package: mhs-production-*.zip"
echo ""
echo "🌐 Deployment Options:"
echo "  1. Netlify: Drag & drop ./dist folder to netlify.app"
echo "  2. Apache: Copy ./dist/* to /var/www/html"
echo "  3. XAMPP: Copy ./dist/* to C:/xampp/htdocs/mhs"
echo "  4. Raspberry Pi: scp -r ./dist/* pi@raspberrypi:/var/www/html"
echo ""
echo "🔒 Security Headers:"
echo "  - Apache: .htaccess included"
echo "  - Netlify: netlify.toml included"
echo ""
echo "✨ Done!"
