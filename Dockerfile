# ── Stage 1: build the Vite frontend ────────────────────────────────────────
FROM node:22-alpine AS ui-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: production image ────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Install server deps (tsx is a devDep but required to run TypeScript directly)
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy server source and config
COPY server/src ./server/src
COPY server/tsconfig.json ./server/

# Copy the compiled frontend from stage 1
COPY --from=ui-build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/server
CMD ["npm", "run", "start"]
