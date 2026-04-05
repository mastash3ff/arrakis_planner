#!/usr/bin/env bash
# Arrakis Planner — AWS deploy script
# Builds the app and deploys to S3 + CloudFront.
#
# Required env vars:
#   S3_BUCKET   — target S3 bucket name
#   CF_DIST_ID  — CloudFront distribution ID
#
# Prerequisites:
#   - AWS CLI v2 configured (aws configure or IAM role)
#   - Node.js + npm installed
#   - jq installed (for JSON parsing in pre-flight checks)

set -euo pipefail

# ─── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
info()  { echo -e "${GREEN}[deploy]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[deploy]${RESET} $*"; }
error() { echo -e "${RED}[deploy] ERROR:${RESET} $*" >&2; }

# ─── Pre-flight checks ──────────────────────────────────────────────────────────
info "Running pre-flight checks…"

if ! command -v aws &>/dev/null; then
  error "AWS CLI not found. Install AWS CLI v2: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
  exit 1
fi

AWS_VERSION=$(aws --version 2>&1 | head -1)
if ! echo "$AWS_VERSION" | grep -q "aws-cli/2"; then
  warn "Expected AWS CLI v2, got: $AWS_VERSION"
fi

if [[ -z "${S3_BUCKET:-}" ]]; then
  error "S3_BUCKET is not set. Export it before running this script."
  exit 1
fi

if [[ -z "${CF_DIST_ID:-}" ]]; then
  error "CF_DIST_ID is not set. Export it before running this script."
  exit 1
fi

# Verify the bucket exists and is accessible
if ! aws s3 ls "s3://${S3_BUCKET}" &>/dev/null; then
  error "Cannot access s3://${S3_BUCKET} — check the bucket name and your AWS credentials."
  exit 1
fi

# Verify the CloudFront distribution exists
if ! aws cloudfront get-distribution --id "${CF_DIST_ID}" &>/dev/null; then
  error "Cannot access CloudFront distribution ${CF_DIST_ID} — check the distribution ID and your AWS credentials."
  exit 1
fi

info "Pre-flight checks passed."
info "  S3 bucket  : ${S3_BUCKET}"
info "  CF dist ID : ${CF_DIST_ID}"

# ─── Build ───────────────────────────────────────────────────────────────────────
info "Building application…"

# Navigate to repo root (one level up from infra/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

if [[ -d dist ]]; then
  warn "Removing stale dist/ directory"
  rm -rf dist
fi

npm run build
info "Build complete."

if [[ ! -f dist/index.html ]]; then
  error "Build did not produce dist/index.html — something went wrong."
  exit 1
fi

# ─── S3 sync ─────────────────────────────────────────────────────────────────────
info "Syncing to s3://${S3_BUCKET}…"

# Sync all non-index.html assets with long-lived cache headers
# (Vite content-hashes all asset filenames, so these are safe to cache forever)
aws s3 sync dist/ "s3://${S3_BUCKET}" \
  --delete \
  --exclude "index.html" \
  --cache-control "max-age=31536000,immutable" \
  --no-progress

# Sync index.html with no-cache so browsers always fetch the latest entry point
aws s3 cp dist/index.html "s3://${S3_BUCKET}/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8"

info "S3 sync complete."

# ─── CloudFront invalidation ─────────────────────────────────────────────────────
info "Creating CloudFront invalidation for /*…"

INVALIDATION_ID=$(
  aws cloudfront create-invalidation \
    --distribution-id "${CF_DIST_ID}" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text
)

info "Invalidation created: ${INVALIDATION_ID}"
info "Note: invalidations typically complete within 1–2 minutes."
info ""
info "Deploy complete. Your outpost awaits on Arrakis."
