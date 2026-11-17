# Step 1: Use the official lightweight Node.js 20 Alpine Linux image
FROM node:20-alpine AS base

# Step 2: Install OpenSSL (required by Prisma ORM to talk to PostgreSQL)
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Step 3: Copy package manifests first so Docker caches `npm install` when code changes
COPY package.json ./
RUN npm install

# Step 4: Copy Prisma schema and generate the typed database client
COPY prisma ./prisma
RUN npx prisma generate

# Step 5: Copy the rest of the project files
COPY . .

EXPOSE 3000

# Step 6: Push the Prisma schema to local Postgres and start the Next.js dev server
CMD ["sh", "-c", "npx prisma db push && npm run dev"]