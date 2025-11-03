FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm ci || npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --production

EXPOSE 3001
CMD ["node", "dist/server.js"]


