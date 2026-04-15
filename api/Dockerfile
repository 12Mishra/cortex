FROM node:22-alpine

# openssl is required by Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy manifest files first for better layer caching
COPY package.json package-lock.json ./

# Copy Prisma schema and config before npm ci so postinstall can run generate
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci

# Copy the rest of the source
COPY . .

# Generate Prisma client (this is what "npm run build" does)
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
