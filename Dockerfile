FROM shenjingnan/xiaozhi-client:latest

COPY start.sh /app/start.sh
COPY patch-reconnect.js /app/patch-reconnect.js

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
