FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Set environment variables for build
ENV NEXT_PUBLIC_BASE_PATH=/app/ijin-kerja
ENV NODE_ENV=production

# Build Next.js application
RUN npm run build

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_BASE_PATH=/app/ijin-kerja

# Copy build artifacts and dependencies from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/spil_permits.db ./spil_permits.db

EXPOSE 3000

CMD ["npm", "run", "start"]
