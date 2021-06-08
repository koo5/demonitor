FROM node:14.16

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --upgrade npm 
RUN npm install
COPY src src
COPY config.aml .
EXPOSE 3223
CMD ["node", "src/index.js"]



