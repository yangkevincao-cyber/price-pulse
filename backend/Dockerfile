# backend/Dockerfile
FROM node:18-alpine

# Install dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads/products uploads/users uploads/listings uploads/temp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start app
CMD ["node", "src/app.js"]