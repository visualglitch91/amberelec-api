FROM alpine:latest

RUN set -ex && apk add nodejs npm sudo p7zip sshfs wget build-base qt5-qtbase-dev && \
     mkdir /mnt/library /data /root/.ssh && \
     echo "StrictHostKeyChecking=accept-new" > /root/.ssh/config

RUN mkdir /skysource && \
    cd skysource && \
    wget -q -O - https://raw.githubusercontent.com/Gemba/skyscraper/master/update_skyscraper.sh | sh


COPY scripts /scripts
RUN chmod +x /scripts/*

WORKDIR /usr/app

COPY app .
RUN npm install && npm run build

EXPOSE 3000
CMD npm run start