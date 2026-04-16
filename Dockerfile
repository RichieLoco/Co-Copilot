# Stage 1: Build the React app
FROM node:25-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM node:25-alpine AS runtime
WORKDIR /app

# Only copy what we need at runtime
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY server.js ./
COPY --from=builder /app/dist ./dist

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

# Run as non-root for security
RUN addgroup -g 1001 -S nodejs && adduser -S co-copilot -u 1001 -G nodejs
USER co-copilot

CMD ["node", "server.js"]
