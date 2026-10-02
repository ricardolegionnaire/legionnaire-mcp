#!/bin/sh
set -e

echo "Starting Legionnaire MCP bridge..."

if [ -z "$MCP_ENDPOINT" ]; then
  echo "ERROR: MCP_ENDPOINT is not set"
  exit 1
fi

mkdir -p /workspaces

cat > /workspaces/xiaozhi.config.json <<EOF
{
  "mcpEndpoint": "$MCP_ENDPOINT",
  "mcpServers": {
    "coingecko": {
      "type": "http",
      "url": "https://mcp.coingecko.com/mcp",
      "headers": {
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    }
  },
  "connection": {
    "heartbeatInterval": 30000,
    "heartbeatTimeout": 10000,
    "reconnectInterval": 5000
  },
  "webUI": {
    "port": 9999
  }
}
EOF

cd /workspaces

echo "Config loaded from /workspaces/xiaozhi.config.json"

exec xiaozhi start
