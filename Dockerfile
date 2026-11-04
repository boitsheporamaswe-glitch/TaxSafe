# ---- build the React app
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json .npmrc ./
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build

# ---- run: only what the server needs
FROM node:22-slim
ENV NODE_ENV=production
ENV TZ=Africa/Johannesburg
WORKDIR /app
COPY package*.json .npmrc ./
COPY client/package.json client/
RUN npm ci --omit=dev
COPY server server
COPY --from=build /app/client/dist client/dist
# The database lives here. Mount a persistent volume on /app/data (or set DATABASE_PATH elsewhere).
RUN mkdir -p data
EXPOSE 4999
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:'+(process.env.PORT||4999)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
