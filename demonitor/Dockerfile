FROM node:14.16-alpine


WORKDIR /usr/src/app
COPY utils /usr/src/app/utils/
COPY wait-for-it /wait-for-it

WORKDIR /usr/src/app/demonitor

COPY demonitor/package*.json ./
RUN apk add --no-cache --virtual .build-deps alpine-sdk python3

RUN npm -v
RUN npm install -g --upgrade npm
RUN npm -v
RUN npm install

RUN apk del .build-deps

RUN apk add bash

COPY demonitor/src src
COPY demonitor/start.sh /

VOLUME /usr/src/app/demonitor/config.aml

EXPOSE 3223
EXPOSE 4002
EXPOSE 4003

CMD ["/start.sh"]



