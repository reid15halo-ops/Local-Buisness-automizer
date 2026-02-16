#!/bin/bash

# ============================================
# Download Inter Font Files for DSGVO Compliance
# ============================================
# This script downloads the Inter font family from Google Fonts
# and places them in the fonts/ directory for self-hosting.
#
# Usage: bash tools/download-fonts.sh
# Or: ./tools/download-fonts.sh (if executable)
#
# Requirements: curl or wget

set -e

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FONTS_DIR="$PROJECT_ROOT/fonts"

# Create fonts directory if it doesn't exist
mkdir -p "$FONTS_DIR"

echo "=========================================="
echo "Inter Font Download for DSGVO Compliance"
echo "=========================================="
echo ""
echo "Downloading fonts to: $FONTS_DIR"
echo ""

# Define base URL for Google Fonts (Inter v13)
BASE_URL="https://fonts.gstatic.com/s/inter/v13"

# Array of font weights and their hashes
declare -A FONTS=(
    ["Inter-300.woff2"]="UcCO3FwrK3iLTeHAPMtVVFtXRa8TVwTIOUfqWrZdx5U.woff2"
    ["Inter-400.woff2"]="UcCO3FwrK3iLTeHAPMtVVGhUWcazsTfltoggM_vsFBE.woff2"
    ["Inter-500.woff2"]="UcCO3FwrK3iLTeHAPMtVVGdcxLBLNe5WlqdOaWA-5ZI.woff2"
    ["Inter-600.woff2"]="UcCO3FwrK3iLTeHAPMtVVGR7Ye-c8fwVYlU0EYlI0Ng.woff2"
    ["Inter-700.woff2"]="UcCO3FwrK3iLTeHAPMtVVEr0n23_CFXsntqgIAoHJ50.woff2"
)

# Check if curl or wget is available
if command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl -L -o"
    DOWNLOAD_SILENT="-s"
elif command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget -O"
    DOWNLOAD_SILENT="-q"
else
    echo "ERROR: Neither curl nor wget is installed."
    echo "Please install curl or wget and try again."
    exit 1
fi

# Download each font file
FAILED=0
for filename in "${!FONTS[@]}"; do
    hash="${FONTS[$filename]}"
    url="${BASE_URL}/${hash}"
    filepath="$FONTS_DIR/$filename"

    echo -n "Downloading $filename... "

    if [ "$DOWNLOAD_CMD" = "curl -L -o" ]; then
        if curl -L -s -f -o "$filepath" "$url"; then
            size=$(stat -f%z "$filepath" 2>/dev/null || stat -c%s "$filepath" 2>/dev/null)
            echo "OK ($size bytes)"
        else
            echo "FAILED"
            FAILED=$((FAILED + 1))
        fi
    else
        if wget -q -O "$filepath" "$url"; then
            size=$(stat -f%z "$filepath" 2>/dev/null || stat -c%s "$filepath" 2>/dev/null)
            echo "OK ($size bytes)"
        else
            echo "FAILED"
            FAILED=$((FAILED + 1))
        fi
    fi
done

echo ""
echo "=========================================="
echo "Download Summary"
echo "=========================================="

# List downloaded files
echo ""
echo "Font files in directory:"
if [ -d "$FONTS_DIR" ]; then
    for f in "$FONTS_DIR"/*.woff2; do
        if [ -f "$f" ]; then
            size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
            echo "  ✓ $(basename "$f"): $size bytes"
        fi
    done
fi

echo ""

if [ $FAILED -eq 0 ]; then
    echo "✓ All fonts downloaded successfully!"
    echo ""
    echo "Your application is now DSGVO-compliant."
    echo "Fonts are self-hosted and no longer depend on Google's CDN."
    exit 0
else
    echo "✗ Failed to download $FAILED font file(s)."
    echo ""
    echo "Troubleshooting:"
    echo "1. Check your internet connection"
    echo "2. Verify curl or wget is installed and working"
    echo "3. Try running the script with: curl -V or wget --version"
    echo "4. Check if your firewall is blocking downloads"
    exit 1
fi
