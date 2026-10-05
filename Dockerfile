FROM shenjingnan/xiaozhi-client:latest

WORKDIR /app

COPY start.sh /app/start.sh
COPY patch-reconnect.js /app/patch-reconnect.js
COPY memory-mcp.mjs /app/memory-mcp.mjs

RUN npm init -y \
    && npm install @modelcontextprotocol/server zod pg \
    && chmod +x /app/start.sh

CMD ["/app/start.sh"]
