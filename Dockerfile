FROM mhart/alpine-node:11

RUN mkdir -p /opt/app
RUN mkdir -p /entrypoint.d

COPY app.js /opt/app
COPY config-loader.js /opt/app
COPY config.defaults.json /opt/app
COPY node_modules /opt/app/node_modules

WORKDIR /opt/app

ENTRYPOINT [ "node" ]

CMD [ "app" ]
