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
      "url": "https://mcp.api.coingecko.com/mcp"
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

exec xiaozhi start
