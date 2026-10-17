FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./

COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci

COPY . .

# Railway passes the DATABASE_URL service variable here; the placeholder default is
# only used so `prisma generate` can load prisma.config.ts (it never connects).
ARG DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
