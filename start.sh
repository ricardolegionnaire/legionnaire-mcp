#!/bin/sh
set -e

echo "Starting Legionnaire MCP bridge..."

if [ -z "$MCP_ENDPOINT" ]; then
  echo "ERROR: MCP_ENDPOINT is not set"
  exit 1
fi

xiaozhi config set mcpEndpoint "$MCP_ENDPOINT"

exec xiaozhi start
