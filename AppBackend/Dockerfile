FROM node:20 AS builder
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Aumenta memória para o compilador TypeScript
RUN node --max-old-space-size=2048 node_modules/typescript/bin/tsc

FROM node:20-alpine AS production
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]


