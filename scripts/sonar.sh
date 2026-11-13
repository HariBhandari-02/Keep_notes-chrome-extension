#!/usr/bin/env bash
set -euo pipefail

: "${SONAR_TOKEN:?Set SONAR_TOKEN to a token generated in SonarQube}"

SONAR_HOST_URL="${SONAR_HOST_URL:-http://localhost:9002}"

# SonarQube only imports coverage when the report exists. Generate it here so a
# direct `bash scripts/sonar.sh` run cannot silently report 0% coverage.
if [[ ! -s coverage/lcov.info ]]; then
  echo "coverage/lcov.info is missing — running npm run test:coverage first."
  npm run test:coverage
fi

docker run --rm \
  --network host \
  -e SONAR_HOST_URL="$SONAR_HOST_URL" \
  -e SONAR_TOKEN \
  -v "$PWD:/usr/src" \
  -w /usr/src \
  sonarsource/sonar-scanner-cli:latest
