# Etapa 1 - dependências
FROM node:20-slim AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Etapa 2 - runner
FROM node:20-slim AS runner
WORKDIR /app

# Cria a pasta de dados para o banco SQLite
RUN mkdir -p /app/data && chown -R node:node /app

# Copia node_modules da etapa anterior
COPY --from=deps /app/node_modules ./node_modules

# Copia o restante do código (com permissão do usuário node)
COPY --chown=node:node . .

# Define variável de ambiente para o SQLite
ENV DB_PATH=/app/data/database.sqlite

EXPOSE 3000

USER node

CMD ["node", "server.js"]
