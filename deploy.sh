#!/bin/bash
# ============================================
# Production Deployment Script
# Local-Business-Automizer v3.0
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

# Copy entire directories (more robust than individual files)
cp -r css dist/
cp -r js dist/
cp -r config dist/
cp -r supabase dist/

# Copy HTML files
cp index.html dist/
cp auth.html dist/
cp landing.html dist/
cp offline.html dist/

# Copy configuration and manifest files
cp manifest.json dist/
cp service-worker.js dist/
cp .htaccess dist/
cp netlify.toml dist/

# Copy fonts directory if it exists
if [ -d "fonts" ]; then
    cp -r fonts dist/
fi

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

# 5. Verify file count
echo "📊 Step 5: Verifying file counts..."
echo "   CSS files: $(find dist/css -name '*.css' 2>/dev/null | wc -l)"
echo "   JS service files: $(find dist/js/services -name '*.js' 2>/dev/null | wc -l)"
echo "   JS module files: $(find dist/js/modules -name '*.js' 2>/dev/null | wc -l)"
echo "   JS UI files: $(find dist/js/ui -name '*.js' 2>/dev/null | wc -l)"
echo "   JS i18n files: $(find dist/js/i18n -name '*.js' 2>/dev/null | wc -l)"
echo "   Supabase functions: $(find dist/supabase/functions -type d -mindepth 1 2>/dev/null | wc -l)"
TOTAL_FILES=$(find dist -type f | wc -l)
echo "   Total files in build: $TOTAL_FILES"

# 6. Create deployment package
echo "📦 Step 6: Creating deployment package..."
cd dist
zip -r ../freyai-production-$(date +%Y%m%d-%H%M%S).zip . -x "*.git*"
cd ..
echo "✅ Deployment package created"

# 7. Display deployment info
echo ""
echo "✅ Production Deployment Ready!"
echo ""
echo "📁 Build Directory: ./dist"
echo "📦 Package: freyai-production-*.zip"
echo ""
echo "🌐 Deployment Options:"
echo "  1. Netlify: Drag & drop ./dist folder to netlify.app"
echo "  2. Apache: Copy ./dist/* to /var/www/html"
echo "  3. XAMPP: Copy ./dist/* to C:/xampp/htdocs/freyai"
echo "  4. Raspberry Pi: scp -r ./dist/* pi@raspberrypi:/var/www/html"
echo ""
echo "🔒 Security Headers:"
echo "  - Apache: .htaccess included"
echo "  - Netlify: netlify.toml included"
echo ""
echo "✨ Done!"
