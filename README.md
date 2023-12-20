# amberelec-api

An API server to upload and scrape roms in an amberelec based system, files should be stored following the structure `/roms/<PLATFORM>/roms`.

### How to run

```
docker build .
docker run \
    -e PORT=<SERVER-PORT> \
    -e SSH_USER=root \
    -e SSH_HOST=<AMBERELEC-IP> \
    -e SCRAPERS=screenscraper:user:pass,thegamesdb \
    -e SKYSCRAPER_FLAGS=unpack,nobrackets \
    -v <PRIVATE-SSH-ALLOWED-IN-AMBERELEC>:/data/id_rsa \
    --network-mode=host \
    --privileged \
    .
```
