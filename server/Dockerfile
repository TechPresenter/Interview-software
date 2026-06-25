# ─── HireSense API ───────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5000
# Basic healthcheck against the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
USER node
CMD ["node", "src/server.js"]
