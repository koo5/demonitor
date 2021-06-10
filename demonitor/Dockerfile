FROM node:14.16-alpine



WORKDIR /usr/src/app
COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps alpine-sdk python3

RUN npm -v
RUN npm install -g --upgrade npm
RUN npm -v
RUN npm install

RUN apk del .build-deps

COPY src src
VOLUME /usr/src/app/config.aml
EXPOSE 3223

CMD ["node", "src/index.js"]



