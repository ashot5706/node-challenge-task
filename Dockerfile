# Multi-stage Dockerfile for both development and production
ARG NODE_VERSION=20-alpine
FROM node:${NODE_VERSION} AS base

# Build arguments for environment configuration
ARG NODE_ENV=production
ARG BUILD_ENV=production

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./

# Dependencies stage
FROM base AS deps
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Development dependencies stage
FROM base AS dev-deps
RUN npm ci --ignore-scripts && npm cache clean --force

# Build stage
FROM base AS builder
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .
ENV PATH="/app/node_modules/.bin:$PATH"
RUN npx tsc

# Development stage
FROM base AS development
COPY --from=dev-deps /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs . .
ENV PATH="/app/node_modules/.bin:$PATH"
RUN npx tsc
USER nestjs
EXPOSE 3000
ENV NODE_ENV=development
CMD ["dumb-init", "node", "--experimental-global-webcrypto", "dist/src/main.js"]

# Production stage
FROM base AS production
# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --chown=nestjs:nodejs package*.json ./

# Remove unnecessary files for security
RUN rm -rf /app/node_modules/.cache && \
    find /app/node_modules -name "*.md" -delete && \
    find /app/node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true

# Set proper file permissions
RUN chmod -R 755 /app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Health check with proper timeout
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "--experimental-global-webcrypto", "dist/src/main.js"]