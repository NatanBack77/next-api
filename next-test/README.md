# API Usuários com JWT

API RESTful para cadastro, autenticação e gerenciamento de usuários utilizando Node.js, Express, SQLite, JWT, validação com Zod e documentação Swagger.

## Funcionalidades
- Cadastro de usuário com senha criptografada
- Login com geração de token JWT
- Listagem de usuários
- Atualização e remoção de usuário autenticado
- Documentação interativa via Swagger
- Testes automatizados com Jest e Supertest

## Tecnologias
- Node.js
- Express
- SQLite (via sqlite3)
- JWT (jsonwebtoken)
- Validação: Zod
- Documentação: Swagger (swagger-ui-express, swagger-jsdoc)
- Testes: Jest, Supertest
- Docker/Docker Compose

## Instalação

### 1. Clonar o repositório
```bash
git clone <repo-url>
cd <repo>
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto:

```
PORT=3000
JWT_SECRET=<sua_chave_secreta>
JWT_EXPIRES_IN=1h
DB_PATH=./data/database.sqlite
NODE_ENV=production
```

### 4. Rodar localmente
```bash
npm start
```
A API estará disponível em `http://localhost:3000`.

### 5. Rodar com Docker
```bash
docker build -t api-usuarios .
docker run -p 3000:3000 --env-file .env api-usuarios
```

## Endpoints principais

- `POST /register` — Cadastro de usuário
- `POST /login` — Login e obtenção de token JWT
- `GET /users` — Lista todos os usuários
- `GET /users/:id` — Busca usuário por ID
- `PUT /users` — Atualiza usuário autenticado (requer JWT)
- `DELETE /users` — Remove usuário autenticado (requer JWT)

## Documentação Swagger
Acesse a documentação interativa em:
```
http://localhost:3000/api-docs
```

## Testes automatizados
Execute os testes com:
```bash
npm test
```

## Estrutura dos arquivos principais

- `server.js` — API Express e rotas
- `db.js` — Configuração e inicialização do banco SQLite
- `test/server.test.js` — Testes automatizados
- `.env` — Variáveis de ambiente
- `Dockerfile` — Build da aplicação para produção

## Observações
- O banco de dados é criado automaticamente na primeira execução.
- Em ambiente de teste (`NODE_ENV=test`), o banco roda em memória.
- O endpoint `/api-docs` só funciona se o servidor estiver rodando normalmente.

---

Feito com ❤️ por NatanBack77
