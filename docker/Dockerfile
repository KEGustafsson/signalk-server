FROM ubuntu:20.04

RUN groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --shell /bin/bash --create-home node

RUN DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get -y install git python3 python build-essential avahi-daemon avahi-discover avahi-utils libnss-mdns mdns-scan libavahi-compat-libdnssd-dev sysstat procps nano curl
RUN groupadd -r docker -g 998 && groupadd -r i2c -g 997 && groupadd -r spi -g 999 && usermod -a -G dialout,i2c,spi,netdev,docker node

RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN DEBIAN_FRONTEND=noninteractive apt-get -y install nodejs
RUN npm install pm2 -g

COPY --chown=root avahi/avahi-dbus.conf /etc/dbus-1/system.d/avahi-dbus.conf
RUN mkdir -p /var/run/dbus/
RUN chmod -R 777 /var/run/dbus/
RUN mkdir -p /var/run/avahi-daemon/
RUN chmod -R 777 /var/run/avahi-daemon/
RUN chown -R avahi:avahi /var/run/avahi-daemon/

USER node
RUN mkdir -p /home/node/signalk_build
WORKDIR /home/node/signalk_build
COPY --chown=node:node ./.. .
RUN chmod +x docker/startup.sh

ARG NPM_TOKEN
COPY .npmrc /home/node/signalk_build/.npmrc
COPY .npmrc /home/node/signalk_build/packages/server-api/.npmrc
COPY .npmrc /home/node/signalk_build/packages/server-admin-ui/.npmrc
COPY .npmrc /home/node/signalk_build/packages/streams/.npmrc

RUN npm install

WORKDIR /home/node/signalk_build/packages/server-api
RUN npm run build
RUN npm publish

WORKDIR /home/node/signalk_build/packages/server-admin-ui
RUN npm run build
RUN npm publish

WORKDIR /home/node/signalk_build/packages/streams
RUN npm run build
RUN npm publish

WORKDIR /home/node/signalk_build
RUN npm run build
RUN npm publish
# RUN npm pack  # for testing

RUN mkdir -p /home/node/signalk
RUN mkdir -p /home/node/.signalk

WORKDIR /home/node/signalk
USER root
# RUN npm i -g ./../signalk_build/signalk-server*.tgz
RUN npm i -g signalk-server
USER node
RUN rm -rf /home/node/signalk_build

EXPOSE 3000
ENV IS_IN_DOCKER true  # If everything is installed from npmjs then is this needed?
WORKDIR /home/node/.signalk
ENTRYPOINT /home/node/signalk/docker/startup.sh
