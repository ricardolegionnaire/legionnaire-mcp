#!/bin/sh
set -e

echo "Starting Legionnaire MCP bridge..."

mkdir -p /workspaces

xiaozhi config set web.port "${PORT:-9999}"

exec xiaozhi start
