FROM node:14-alpine

RUN mkdir -p /home/node/app/checker && chown -R node:node /home/node/app/checker
RUN mkdir -p /home/node/app/utils && chown -R node:node /home/node/app/utils
WORKDIR /home/node/app
USER node

COPY checker/package*.json ./checker/
WORKDIR /home/node/app/checker
RUN npm install

COPY checker /home/node/app/checker/
#COPY checker/bin/www /home/node/app/checker/bin/
#COPY checker/routes /home/node/app/checker/
COPY utils /home/node/app/utils/

EXPOSE 3000
WORKDIR /home/node/app/checker
CMD ["npm", "start"]
