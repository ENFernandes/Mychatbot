FROM node:18-alpine
WORKDIR /app

# Install OpenSSL and libc6-compat for Prisma
RUN apk add --no-cache openssl libc6-compat

# Set Prisma environment variables to handle checksum issues
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
COPY prisma ./prisma
RUN npm ci || npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --production

EXPOSE 3001
CMD ["node", "dist/server.js"]


