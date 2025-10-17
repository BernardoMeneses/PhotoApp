# Etapa 1: build TypeScript
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copia package.json e instala TUDO (incluindo devDependencies)
COPY package*.json ./
RUN npm install 

# Compila o projeto TypeScript
COPY . .
RUN chmod +x node_modules/.bin/tsc
RUN npx tsc

# Etapa 2: imagem final (produção)
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Copia apenas o necessário da fase de build
COPY package*.json ./
RUN npm install --omit=dev

# Copia os ficheiros compilados da etapa anterior
COPY --from=builder /usr/src/app/dist ./dist

# Expor a porta
EXPOSE 3000

# Comando de arranque
CMD ["node", "dist/main.js"]

