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

# Install Python and pip for AI service
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Install kubectl
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -LO https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    rm kubectl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy only built code and production deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY api/package.json ./

# Copy AI service and install Python dependencies
COPY AI/requirements.txt ./AI/requirements.txt
RUN pip3 install --no-cache-dir -r ./AI/requirements.txt
COPY AI ./AI

EXPOSE 5000

# Default: start Node.js backend. To run AI service, override CMD.
CMD ["node", "dist/server.js"]
# To run the AI service: docker run ... python3 AI/main.py
# Or use docker-compose for both services
