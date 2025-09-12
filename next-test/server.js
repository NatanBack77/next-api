// server.js
import "dotenv/config";
import express from "express";
import db from "./db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "replace_this_secret_in_prod";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

// Swagger config
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: { title: "API Usuários com JWT", version: "1.0.0" },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      }
    }
  },
  apis: [path.join(__dirname, "server.js")]
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Middleware JWT
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ error: "Token ausente" });

    const [scheme, token] = authHeader.split(" ");
    if (!/^Bearer$/i.test(scheme)) return res.status(401).json({ error: "Formato de token inválido" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ error: "Token inválido ou expirado" });
      req.user = user;
      next();
    });
  } catch (e) {
    res.status(500).json({ error: "Erro na autenticação do token" });
  }
}

// Helper para formatar erros do Zod
function formatZodErrors(e) {
  if (!e || !e.issues) return [{ message: e.message || "Erro desconhecido" }];
  return e.issues.map(err => ({
    field: err.path.join("."),
    message: err.message
  }));
}

// Schemas Zod
const registerSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(6),
  idade: z.number().int().positive()
});

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6)
});

const updateSchema = z.object({
  nome: z.string().min(1).optional(),
  email: z.string().email().optional(),
  senha: z.string().min(6).optional(),
  idade: z.number().int().positive().optional()
});

// Routes
app.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    db.get("SELECT id FROM users WHERE email = ?", [data.email], async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) return res.status(400).json({ error: "Email já cadastrado" });

      const hashed = await bcrypt.hash(data.senha, 10);
      db.run(
        "INSERT INTO users (nome, email, senha, idade) VALUES (?, ?, ?, ?)",
        [data.nome, data.email, hashed, data.idade],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ id: this.lastID, nome: data.nome, email: data.email, idade: data.idade });
        }
      );
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ errors: formatZodErrors(e) });
    }
    res.status(400).json({ error: e.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    db.get("SELECT * FROM users WHERE email = ?", [data.email], async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(400).json({ error: "Credenciais inválidas" });

      const match = await bcrypt.compare(data.senha, row.senha);
      if (!match) return res.status(400).json({ error: "Credenciais inválidas" });

      const token = jwt.sign({ id: row.id, email: row.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      res.json({ token });
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ errors: formatZodErrors(e) });
    }
    res.status(400).json({ error: e.message });
  }
});

app.get("/users", (req, res) => {
  db.all("SELECT id, nome, email, idade FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/users/:id", (req, res) => {
  db.get("SELECT id, nome, email, idade FROM users WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(row);
  });
});

app.put("/users", authenticateToken, async (req, res) => {
  try {
    const data = updateSchema.parse(req.body);
    const id = req.user.id;

    db.get("SELECT * FROM users WHERE id = ?", [id], async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Usuário não encontrado" });

      const updates = [];
      const params = [];

      if (data.nome) updates.push("nome = ?"), params.push(data.nome);
      if (data.email) updates.push("email = ?"), params.push(data.email);
      if (data.idade) updates.push("idade = ?"), params.push(data.idade);
      if (data.senha) {
        const hashed = await bcrypt.hash(data.senha, 10);
        updates.push("senha = ?"), params.push(hashed);
      }

      if (updates.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar" });

      params.push(id);

      db.run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Usuário atualizado" });
      });
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ errors: formatZodErrors(e) });
    }
    res.status(400).json({ error: e.message });
  }
});

app.delete("/users", authenticateToken, (req, res) => {
  const id = req.user.id;

  db.run("DELETE FROM users WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json({ message: "Usuário deletado" });
  });
});

// Middleware de 404
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// Middleware de erros gerais
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor" });
});

// Só roda servidor em ambiente normal, não em teste
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
}

export default app;
