FROM node:24-bookworm-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN pnpm install -g xiaozhi-client

WORKDIR /app

COPY start.sh /app/start.sh

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
