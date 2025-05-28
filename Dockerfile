# syntax=docker/dockerfile:1.5

########################
# 📦 Base image for building
########################
FROM --platform=$BUILDPLATFORM node:20-slim AS base
WORKDIR /app

# Install libc if native modules may be used (optional)
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends libc6 && rm -rf /var/lib/apt/lists/*

########################
# 📦 Install dependencies
########################
FROM base AS deps
WORKDIR /app

COPY api/package.json api/package-lock.json* ./
RUN npm ci

########################
# 🔨 Build TypeScript
########################
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY api .

RUN npm run build

########################
# 🚀 Production image
########################
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Update system packages to reduce vulnerabilities
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Copy only built code and production deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY api/package.json ./

EXPOSE 5000

CMD ["node", "dist/server.js"]
