#!/bin/sh
set -e

mkdir -p /workspaces

if [ -z "$MCP_ENDPOINT" ]; then
  echo "ERRO: MCP_ENDPOINT não definido"
  exit 1
fi

if [ -z "$TAVILY_API_KEY" ]; then
  echo "ERRO: TAVILY_API_KEY não definida"
  exit 1
fi

echo "MCP_ENDPOINT: OK"
echo "TAVILY_API_KEY: OK (${#TAVILY_API_KEY} caracteres)"

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
