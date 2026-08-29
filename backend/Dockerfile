# =====================================================
# Production Stage
# =====================================================
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache \
    curl \
    chromium \
    nss \
    freetype \
    freetype-dev \
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

COPY --from=builder /app/dist ./dist

COPY --from=builder /app/src/modules/reports/templates \
    ./dist/modules/reports/templates

COPY --from=builder /app/src/assets \
    ./dist/assets

RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "dist/main.js"]