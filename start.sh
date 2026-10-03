#!/bin/sh
set -e

mkdir -p /workspaces

cat > /workspaces/xiaozhi.config.json <<EOF
{
  "mcpEndpoint": "${MCP_ENDPOINT}",
  "mcpServers": {
    "coingecko": {
      "type": "streamable-http",
      "url": "https://mcp.coingecko.com/mcp",
      "headers": {
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    },
    "tavily": {
      "type": "streamable-http",
      "url": "https://mcp.tavily.com/mcp",
      "headers": {
        "Authorization": "Bearer ${TAVILY_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    },
    "google-calendar": {
      "type": "streamable-http",
      "url": "https://legionnaire-calendar.onrender.com/mcp",
      "headers": {
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    }
  }
}
EOF

echo "Configuração MCP criada:"
cat /workspaces/xiaozhi.config.json | sed 's/Bearer [^"]*/Bearer ***HIDDEN***/'

exec xiaozhi start
