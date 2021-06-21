FROM node:14.16-alpine

WORKDIR /usr/src/app

COPY karma/package*.json ./
RUN apk add --no-cache --virtual .build-deps alpine-sdk python3

RUN npm -v
RUN npm install -g --upgrade npm
RUN npm -v
RUN npm install

RUN apk del .build-deps

COPY karma/src src
COPY karma/start.sh /
COPY wait-for-it /wait-for-it

VOLUME /usr/src/app/config.aml

EXPOSE 3223
EXPOSE 4002
EXPOSE 4003

CMD ["/start.sh"]



