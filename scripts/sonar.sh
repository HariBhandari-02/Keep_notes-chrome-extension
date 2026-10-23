#!/usr/bin/env bash
set -euo pipefail

: "${SONAR_TOKEN:?Set SONAR_TOKEN to a token generated in SonarQube}"

SONAR_HOST_URL="${SONAR_HOST_URL:-http://localhost:9002}"

docker run --rm \
  --network host \
  -e SONAR_HOST_URL="$SONAR_HOST_URL" \
  -e SONAR_TOKEN \
  -v "$PWD:/usr/src" \
  -w /usr/src \
  sonarsource/sonar-scanner-cli:latest
