#!/bin/sh
set -e

echo "Starting Legionnaire MCP bridge..."

if [ -z "$MCP_ENDPOINT" ]; then
  echo "ERROR: MCP_ENDPOINT is not set"
  exit 1
fi

xiaozhi config set mcpEndpoint "$MCP_ENDPOINT"

xiaozhi config set web.port "${PORT:-10000}"

exec xiaozhi start
