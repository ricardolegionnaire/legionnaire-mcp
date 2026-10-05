FROM shenjingnan/xiaozhi-client:latest

WORKDIR /app

COPY start.sh /app/start.sh
COPY patch-reconnect.js /app/patch-reconnect.js
COPY memory-mcp.js /app/memory-mcp.js

RUN npm init -y \
    && npm pkg set type=module \
    && npm install @modelcontextprotocol/server zod pg \
    && chmod +x /app/start.sh

CMD ["/app/start.sh"]
