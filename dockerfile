# Stage 1: Build the frontend
FROM node:22-alpine AS frontend-build

WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Stage 2: Install server dependencies
FROM node:22-alpine AS server-build

WORKDIR /server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Stage 3: Final runtime image
FROM node:22-alpine

RUN apk add --no-cache nginx

# Copy frontend static files
COPY --from=frontend-build /app/out /usr/share/nginx/html

# Copy API server source and dependencies
COPY --from=server-build /server/node_modules /app/server/node_modules
COPY server/*.ts /app/server/

# Copy nginx config
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
