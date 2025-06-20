FROM node:18-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --silent

COPY . .
RUN mkdir -p logs uploads

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

CMD ["node", "server.js"]