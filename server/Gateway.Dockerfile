FROM python:3.12-slim AS public
WORKDIR /src
COPY . .
RUN python scripts/build_public.py /public
FROM nginx:stable-alpine
COPY --from=public /public /srv/public
COPY server/nginx.conf /etc/nginx/nginx.conf
COPY server/proxy-ege.conf /etc/nginx/proxy-ege.conf
