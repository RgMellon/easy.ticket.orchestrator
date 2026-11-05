FROM node:22-alpine AS base
WORKDIR /app
COPY package.json yarn.lock ./

# --- development ---
FROM base AS development
RUN yarn install
COPY . .
CMD ["yarn", "start:dev"]

# --- builder ---
FROM base AS builder
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# --- production ---
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
CMD ["node", "dist/main"]
