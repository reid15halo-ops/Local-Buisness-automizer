#!/bin/bash
# ============================================
# FreyAI App — Deploy Script
# Usage: ./deploy.sh [staging|production|both]
# ============================================

set -e

VPS_HOST="root@72.61.187.24"
STAGING_DIR="/home/openclaw/workspace/projects/freyai-app-staging"
PRODUCTION_DIR="/home/openclaw/workspace/projects/freyai-app"
SUPABASE_PROJECT_REF="incbhhaiiayohrjqevog"

DEPLOY_TARGET="${1:-production}"

if [[ "$DEPLOY_TARGET" != "staging" && "$DEPLOY_TARGET" != "production" && "$DEPLOY_TARGET" != "both" ]]; then
    echo "Usage: ./deploy.sh [staging|production|both]"
    exit 1
fi

# ---- Step 1: Build JS/CSS bundles ----
echo "==> Building bundles..."
if ! node scripts/build.js; then
    echo "ERROR: Build failed. Aborting deployment."
    exit 1
fi

# Verify dist files exist
for f in dist/js/app-sync.min.js dist/js/app-bundle.min.js dist/css/app.min.css; do
    if [ ! -f "$f" ]; then
        echo "ERROR: $f not found after build. Aborting."
        exit 1
    fi
done

# ---- Step 2: Push to GitHub ----
if [ "$DEPLOY_TARGET" = "production" ] || [ "$DEPLOY_TARGET" = "both" ]; then
    echo "==> Pushing to GitHub (production deploy)..."
    git push origin main
else
    echo "==> Skipping git push (staging-only deploy)"
fi

# ---- Step 3: Deploy to VPS ----
deploy_vps() {
    local target_dir="$1"
    local label="$2"

    echo "==> Deploying ${label} on VPS (${target_dir})..."
    ssh "$VPS_HOST" "cd ${target_dir} && git stash --include-untracked -q 2>/dev/null; git fetch origin main && git reset --hard origin/main"
    # Sync build artifacts (not in git)
    ssh "$VPS_HOST" "mkdir -p ${target_dir}/dist/js ${target_dir}/dist/css"
    if command -v rsync &> /dev/null; then
        rsync -az --delete dist/ "$VPS_HOST:${target_dir}/dist/"
    else
        scp dist/js/app-sync.min.js dist/js/app-bundle.min.js "$VPS_HOST:${target_dir}/dist/js/"
        scp dist/css/app.min.css "$VPS_HOST:${target_dir}/dist/css/"
    fi
    echo "==> ${label} deployed."
}

if [ "$DEPLOY_TARGET" = "staging" ] || [ "$DEPLOY_TARGET" = "both" ]; then
    deploy_vps "$STAGING_DIR" "Staging"
fi

if [ "$DEPLOY_TARGET" = "production" ] || [ "$DEPLOY_TARGET" = "both" ]; then
    deploy_vps "$PRODUCTION_DIR" "Production"
fi

# ---- Step 4: Deploy Edge Functions (production/both only) ----
if [ "$DEPLOY_TARGET" = "staging" ]; then
    echo "==> Skipping Edge Functions (staging-only deploy)"
    echo ""
    echo "==> Deployment complete (${DEPLOY_TARGET})."
    exit 0
fi

echo "==> Deploying Supabase Edge Functions..."

FUNCTIONS_DIR="supabase/functions"
DEPLOYED=0

# Functions with own auth — JWT verification disabled (webhooks, portal, crons)
NO_JWT_FUNCTIONS="process-inbound-email check-overdue run-webhook stripe-webhook portal-api"

for func_dir in ${FUNCTIONS_DIR}/*/; do
    func_name=$(basename "$func_dir")
    if [ -f "${func_dir}index.ts" ]; then
        echo "    Deploying function: ${func_name}"
        if echo "$NO_JWT_FUNCTIONS" | grep -qw "$func_name"; then
            npx supabase functions deploy "$func_name" --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt
        else
            npx supabase functions deploy "$func_name" --project-ref "$SUPABASE_PROJECT_REF"
        fi
        DEPLOYED=$((DEPLOYED + 1))
    fi
done

echo "==> ${DEPLOYED} Edge Functions deployed."

echo ""
echo "==> Deployment complete (${DEPLOY_TARGET})."
