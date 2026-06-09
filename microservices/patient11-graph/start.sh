#!/bin/sh
# GQL-HIVE-MIGRATE (#160): compose -> serve pipeline for GraphQL Hive Gateway (Mesh v1).
#
# 1. mesh-compose reads MESH_SOURCES (runtime env) via mesh.config.ts and writes a
#    supergraph SDL. Output goes to /app/config (emptyDir, writable) because the
#    container root FS may be read-only under Knative runAsNonRoot.
# 2. hive-gateway serves the supergraph on :8080 with gateway.config.ts (/graphql,
#    /health JSON, Authorization propagation).
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="${APP_DIR}/node_modules/.bin"
CONFIG_DIR="${CONFIG_DIR:-/app/config}"
SUPERGRAPH="${CONFIG_DIR}/supergraph.graphql"
PORT="${PORT:-8080}"

mkdir -p "$CONFIG_DIR"

echo "Composing supergraph from MESH_SOURCES -> $SUPERGRAPH"
"${BIN}/mesh-compose" -c "${APP_DIR}/mesh.config.ts" -o "$SUPERGRAPH"

echo "Starting GraphQL Hive Gateway on :$PORT"
exec "${BIN}/hive-gateway" supergraph "$SUPERGRAPH" \
  --host 0.0.0.0 \
  --port "$PORT" \
  -c "${APP_DIR}/gateway.config.ts"
