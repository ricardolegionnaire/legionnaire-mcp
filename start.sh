#!/bin/sh
set -e

mkdir -p /workspaces

# Verificar variáveis obrigatórias
if [ -z "$MCP_ENDPOINT" ]; then
  echo "ERRO: MCP_ENDPOINT não definido"
  exit 1
fi

if [ -z "$TAVILY_API_KEY" ]; then
  echo "ERRO: TAVILY_API_KEY não definida"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERRO: DATABASE_URL não definida"
  exit 1
fi

# Limpar eventuais espaços/quebras de linha
TAVILY_API_KEY="$(printf '%s' "$TAVILY_API_KEY" | tr -d '\r\n')"
DATABASE_URL="$(printf '%s' "$DATABASE_URL" | tr -d '\r\n')"

export TAVILY_API_KEY
export DATABASE_URL

echo "======================================"
echo "LEGIONNAIRE MCP - ARRANQUE"
echo "MCP_ENDPOINT: OK"
echo "TAVILY_API_KEY: OK"
echo "DATABASE_URL: OK"
echo "======================================"

cat > /workspaces/xiaozhi.config.json <<EOF
{
  "mcpEndpoint": "${MCP_ENDPOINT}",

  "connection": {
    "heartbeatInterval": 30000,
    "heartbeatTimeout": 10000,
    "reconnectInterval": 5000
  },

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
    },

    "memory": {
      "command": "node",
      "args": ["/app/memory-mcp.mjs"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
EOF

echo "Configuração MCP criada em /workspaces/xiaozhi.config.json"

echo "Ligação configurada:"
echo " - Heartbeat: 30 segundos"
echo " - Timeout: 10 segundos"
echo " - Reconexão: 5 segundos"

echo "MCPs configurados:"
echo " - coingecko"
echo " - tavily"
echo " - google-calendar"
echo " - memory"

echo "A aplicar patch de reconexão automática..."
node /app/patch-reconnect.js

echo "A iniciar Xiaozhi Client..."

exec xiaozhi start
