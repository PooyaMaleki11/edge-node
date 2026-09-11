FROM teddysun/xray:latest
ENV PORT=8080
COPY config.json /etc/xray/config.json
CMD ["/usr/bin/xray", "run", "-config", "/etc/xray/config.json"]
