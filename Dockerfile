FROM node:24.12.0-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Build-time value only; production must supply its own secret at runtime.
RUN PAYLOAD_SECRET=build-only-secret-never-used-at-runtime DATABASE_URL=postgresql://unused:unused@127.0.0.1/unused APP_ENV=staging pnpm build

FROM node:24.12.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg && \
    install -d /usr/share/postgresql-common/pgdg && \
    curl --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc && \
    echo 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main' > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 && \
    rm -rf /var/lib/apt/lists/* && corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/media /app/backups /app/.data && chown -R node:node /app/media /app/backups /app/.data
USER node
EXPOSE 3000
CMD ["pnpm","exec","next","start","--hostname","0.0.0.0"]
