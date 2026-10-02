#!/bin/sh
set -e

echo "Starting Legionnaire MCP bridge..."

if [ -z "$MCP_ENDPOINT" ]; then
  echo "ERROR: MCP_ENDPOINT is not set"
  exit 1
fi

cat > /workspaces/xiaozhi.config.json <<EOF
{
  "mcpEndpoint": "$MCP_ENDPOINT",
  "mcpServers": {
    "coingecko": {
      "type": "http",
      "url": "https://mcp.api.coingecko.com/mcp",
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

export XIAOZHI_CONFIG_DIR=/workspaces
cd /workspaces

echo "Configuration written to /workspaces/xiaozhi.config.json"

exec xiaozhi start
