#!/bin/bash
# ============================================
# Deployment Script für process-inbound-email
# ============================================

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║  Deploy: process-inbound-email Edge Function  ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found!${NC}"
    echo "Install: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI found${NC}"

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo "Logging in..."
    supabase login
fi

echo -e "${GREEN}✅ Logged in to Supabase${NC}"

# Link project if not linked
if [ ! -f ".supabase/config.toml" ]; then
    echo -e "${YELLOW}⚠️  Project not linked${NC}"
    echo "Linking project..."
    supabase link
fi

echo -e "${GREEN}✅ Project linked${NC}"

# Deploy database schema
echo ""
echo "📦 Deploying database schema..."
if supabase db push schema.sql 2>/dev/null; then
    echo -e "${GREEN}✅ Schema deployed${NC}"
else
    echo -e "${YELLOW}⚠️  Schema deployment skipped (may already exist)${NC}"
fi

# Deploy function
echo ""
echo "🚀 Deploying Edge Function..."
supabase functions deploy process-inbound-email --no-verify-jwt

echo -e "${GREEN}✅ Function deployed${NC}"

# Check environment variables
echo ""
echo "🔐 Checking environment variables..."

MISSING_VARS=()

if ! supabase secrets list | grep -q "RESEND_API_KEY"; then
    MISSING_VARS+=("RESEND_API_KEY")
fi

if ! supabase secrets list | grep -q "GEMINI_API_KEY"; then
    MISSING_VARS+=("GEMINI_API_KEY")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Missing environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Set them with:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  supabase secrets set $var=your_value_here"
    done
else
    echo -e "${GREEN}✅ All required environment variables set${NC}"
fi

# Get function URL
echo ""
echo "🔗 Function URL:"
PROJECT_REF=$(supabase status | grep "API URL" | awk '{print $3}' | sed 's|https://||' | sed 's|\.supabase\.co||')
FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/process-inbound-email"
echo "   $FUNCTION_URL"

# Test function
echo ""
read -p "🧪 Test function now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Sending test request..."

    TEST_PAYLOAD='{
        "from": {
            "name": "Test User",
            "email": "test@example.com"
        },
        "to": "anfragen@handwerkflow.de",
        "subject": "Test Anfrage",
        "text": "Ich benötige ein Metalltor, 2m breit, feuerverzinkt. Budget ca. 1500 Euro."
    }'

    curl -X POST "$FUNCTION_URL" \
        -H "Content-Type: application/json" \
        -d "$TEST_PAYLOAD" | jq '.'

    echo ""
    echo -e "${GREEN}✅ Test completed${NC}"
fi

# Next steps
echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║            Next Steps                          ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "1. Configure Resend Inbound Route:"
echo "   https://resend.com/inbound"
echo ""
echo "   Webhook URL: $FUNCTION_URL"
echo ""
echo "2. Configure DNS Records for your domain:"
echo "   - MX: mx.resend.com (Priority: 10)"
echo "   - TXT (SPF): v=spf1 include:_spf.resend.com ~all"
echo ""
echo "3. Send test email to: anfragen@handwerkflow.de"
echo ""
echo "4. Monitor logs:"
echo "   supabase functions logs process-inbound-email --follow"
echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
