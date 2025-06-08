# syntax=docker/dockerfile:1.5

FROM --platform=$BUILDPLATFORM node:20-slim AS base
WORKDIR /app

RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends libc6 && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app

COPY api/package.json api/package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY api .

RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -LO https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    rm kubectl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY api/package.json ./

COPY AI/requirements.txt ./AI/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r ./AI/requirements.txt
COPY AI ./AI

EXPOSE 5000

CMD ["node", "dist/server.js"]

