# API image for Cloud Run (or any Docker host).
# Build: docker build -t westminster-api .

FROM node:22-bookworm-slim AS build
# OpenSSL so Prisma downloads the migration engine built for OpenSSL 3,
# the same version as the runtime image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate \
  && npm run build \
  && npm prune --omit=dev

FROM node:22-bookworm-slim
# Tesseract with Portuguese and English for the OCR import.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-por tesseract-ocr-eng openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    TRUST_PROXY=1

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./

USER node
EXPOSE 8080
# Apply pending database migrations, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]
