FROM ghcr.io/prymitive/karma:v0.86

VOLUME /karma.yaml

COPY karma/start.sh /
COPY wait-for-it /wait-for-it

ENTRYPOINT ["/start.sh"]
