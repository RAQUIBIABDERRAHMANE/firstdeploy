# Stage 1: Build environment
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies for compiling node-pty
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy package requirements
COPY package*.json ./

# Install npm packages (compiling node-pty and dependencies)
RUN npm install

# Copy application source
COPY . .

# Build Next.js application
RUN npm run build

# Remove development dependencies to keep image small
RUN npm prune --production

# Stage 2: Production environment
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Install git and runtime bash/shell dependencies inside container for terminal commands
RUN apt-get update && apt-get install -y \
    git \
    bash \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

# Copy compiled files and dependencies from builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./server.js

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "server.js"]
