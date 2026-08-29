# =====================================================
# Build Stage
# =====================================================
FROM node:20-alpine AS builder

WORKDIR /app

ENV NODE_ENV=development
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./

RUN npm ci --legacy-peer-deps --include=dev

RUN test -x node_modules/.bin/nest && \
    node_modules/.bin/nest --version

COPY . .

RUN npm run build

RUN test -f dist/main.js || \
    (echo "ERROR: dist/main.js was not generated" && \
     find dist -maxdepth 5 -type f -print 2>/dev/null && \
     exit 1)


# =====================================================
# Production Stage
# =====================================================
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# مهم:
# هذه الخطوة تجعل Production تنتظر اكتمال Builder
COPY --from=builder /app/dist ./dist

COPY --from=builder /app/src/modules/reports/templates \
    ./dist/modules/reports/templates

COPY --from=builder /app/src/assets \
    ./dist/assets

RUN apk add --no-cache \
    curl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-arabic \
    font-noto-emoji \
    dumb-init

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

COPY package*.json ./

RUN npm ci --omit=dev --legacy-peer-deps && \
    npm cache clean --force

RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "dist/main.js"]