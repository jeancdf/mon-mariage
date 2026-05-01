ARG DEPLOY_SHA=local
ARG DEPLOY_VERSION=0
ARG DEPLOYED_AT=local

FROM node:22-alpine AS build

ARG DEPLOY_SHA
ARG DEPLOY_VERSION
ARG DEPLOYED_AT

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

ARG DEPLOY_SHA
ARG DEPLOY_VERSION
ARG DEPLOYED_AT
LABEL org.opencontainers.image.revision="${DEPLOY_SHA}" \
      org.opencontainers.image.version="${DEPLOY_VERSION}" \
      org.opencontainers.image.created="${DEPLOYED_AT}"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/client/browser /usr/share/nginx/html
RUN printf '{"revision":"%s","version":%s,"deployedAt":"%s"}\n' "${DEPLOY_SHA}" "${DEPLOY_VERSION}" "${DEPLOYED_AT}" > /usr/share/nginx/html/deploy-version.json

EXPOSE 80
