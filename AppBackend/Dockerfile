# Usa uma imagem base Node.js
FROM node:20-alpine

# Define diretório de trabalho
WORKDIR /usr/src/app

# Copia package.json e instala dependências
COPY package*.json ./
RUN npm install

# Copia o resto do código
COPY . .

# Compila TypeScript
RUN npm run build

# Expõe a porta (CapRover irá mapear automaticamente)
EXPOSE 3000

# Comando para arrancar a app
CMD ["node", "dist/main.js"]
