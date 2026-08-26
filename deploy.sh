#!/bin/bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-swift-approach-506317-p4}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-nano-banana-guide}"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

gcloud config set project "$PROJECT_ID"
gcloud services enable \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  bigquery.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  texttospeech.googleapis.com \
  --project "$PROJECT_ID"

DEPLOY_ARGS=(
  "$SERVICE"
  --source "$ROOT_DIR" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --update-env-vars "GOOGLE_TTS_ENABLED=true,GEMINI_MODEL=gemini-3.5-flash,VERTEX_LOCATION=global,BIGQUERY_DATASET=cofounder_live,BIGQUERY_LOCATION=US"
)

if gcloud secrets describe github-delivery-token --project "$PROJECT_ID" >/dev/null 2>&1; then
  DEPLOY_ARGS+=(--update-secrets "GITHUB_DELIVERY_TOKEN=github-delivery-token:latest")
fi

gcloud run deploy "${DEPLOY_ARGS[@]}"

gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format="value(status.url)"
