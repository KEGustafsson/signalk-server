FROM ubuntu:20.04

RUN groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --shell /bin/bash --create-home node

RUN DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get -y install apt-utils \
  && DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get -y install sudo git python3 python build-essential avahi-daemon avahi-discover avahi-utils libnss-mdns mdns-scan libavahi-compat-libdnssd-dev sysstat procps nano curl \
  && groupadd -r docker -g 998 && groupadd -r i2c -g 997 && groupadd -r spi -g 999 && usermod -a -G dialout,i2c,spi,netdev,docker node

RUN echo 'node ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash - \
  && DEBIAN_FRONTEND=noninteractive apt-get -y install nodejs \
  && npm install pm2 -g

COPY --chown=root avahi/avahi-dbus.conf /etc/dbus-1/system.d/avahi-dbus.conf
RUN mkdir -p /var/run/dbus/ \
  && chmod -R 777 /var/run/dbus/ \
  && mkdir -p /var/run/avahi-daemon/ \
  && chmod -R 777 /var/run/avahi-daemon/ \
  && chown -R avahi:avahi /var/run/avahi-daemon/

USER node
RUN mkdir -p /home/node/signalk \
  && mkdir -p /home/node/.signalk
WORKDIR /home/node/signalk
COPY --chown=node startup.sh startup.sh
RUN chmod +x docker/startup.sh

WORKDIR /home/node/signalk
USER root
RUN npm i -g signalk-server
USER node

EXPOSE 3000
WORKDIR /home/node/.signalk
ENTRYPOINT /home/node/signalk/docker/startup.sh
