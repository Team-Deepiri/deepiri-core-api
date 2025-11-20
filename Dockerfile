# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies needed for build
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies for TypeScript compilation)
# Using npm install instead of npm ci since package-lock.json may not exist
RUN npm install --legacy-peer-deps && \
    npm cache clean --force

# Copy source code
COPY src ./src

# Ensure config directory exists (Firebase JSON files are optional - code handles missing files via env vars)
RUN mkdir -p ./config

# Copy config directory if it has files (Firebase JSON files may be missing - that's OK, code uses env vars)
# Note: If config/ is empty, COPY will still work but copy nothing
COPY config ./config

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies (dumb-init and curl needed at runtime)
RUN apk add --no-cache curl dumb-init

# Copy package files
COPY package*.json ./

# Install only production dependencies
# Using npm install instead of npm ci since package-lock.json may not exist
RUN npm install --omit=dev --legacy-peer-deps && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/tmp/*

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy any additional files needed at runtime (config, etc.)
# Config directory exists (may be empty - Firebase JSON files optional, use env vars instead)
COPY config ./config
COPY scripts ./scripts

# Create non-root user and set up directories
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
