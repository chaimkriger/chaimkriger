# One image for local Docker Compose and for Azure App Service.
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npx next build

FROM base AS run
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1
# Keeps the full node_modules on purpose: the entrypoint runs Prisma
# migrations (and, optionally, the seed) before starting the server.
COPY --from=build /app ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
