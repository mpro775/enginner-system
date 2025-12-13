# =====================================================
# Backend Dockerfile - NestJS Application
# =====================================================

# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# =====================================================
# Production Stage
# =====================================================
FROM node:20-alpine

WORKDIR /app

# 1. تثبيت المتطلبات أولاً
RUN apk add --no-cache \
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

# 2. ضبط متغيرات البيئة *قبل* تثبيت الحزم لمنع تحميل كروم
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./

# 3. الآن نثبت الحزم (Puppeteer سيحترم المتغير ولن يحمل كروم)
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy assets explicitly (Important!)
COPY --from=builder /app/src/modules/reports/templates ./dist/modules/reports/templates
COPY --from=builder /app/src/assets ./dist/assets

# Change ownership
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# 3. استخدام dumb-init لتشغيل التطبيق (أكثر استقراراً مع Puppeteer)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/main.js"]