// db.js
import path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Se estivermos em testes, usar banco em memória
const isTest = process.env.NODE_ENV === "test";
const dbPath = isTest
  ? ":memory:"
  : process.env.DB_PATH || path.join(__dirname, "data", "database.sqlite");

// Cria pasta apenas se não estivermos em memória
if (!isTest && dbPath !== ":memory:") {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Pasta criada: ${dir}`);
  }
}

// Conecta ao SQLite
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Erro ao abrir o banco de dados:", err.message);
  } else {
    console.log(`Banco aberto em: ${dbPath}`);
  }
});

// Inicializa tabela de usuários
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      idade INTEGER NOT NULL
    )
  `, (err) => {
    if (err) console.error("Erro ao criar tabela users:", err.message);
  });
});

export default db;
