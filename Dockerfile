FROM shenjingnan/xiaozhi-client:latest

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
