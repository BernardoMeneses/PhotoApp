# Usa uma imagem base leve e moderna do Node.js
FROM node:20-alpine

# Define o diretório de trabalho
WORKDIR /usr/src/app

# Copia apenas os ficheiros de dependências primeiro (para usar cache Docker)
COPY package*.json ./

# Instala dependências de produção e de build
RUN npm install

# Copia o resto do código
COPY . .

# Compila o código TypeScript
RUN npm run build

# Expõe a porta (CapRover injeta automaticamente a variável PORT)
EXPOSE 3000

# Comando de arranque da app
CMD ["npm", "start"]
