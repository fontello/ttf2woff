FROM node:alpine3.16

RUN apk add git

WORKDIR /app
COPY . .
RUN npm install && \
    npm audit fix --force && \ 
    npm install -g .

ENTRYPOINT [ "ttf2woff" ]