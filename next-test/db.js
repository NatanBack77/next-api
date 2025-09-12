// db.js
import path from "path";
import fs from "fs";
import os from "os";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isTest = process.env.NODE_ENV === "test";

/**
 * Tenta garantir que um diretório existe e é gravável.
 * Retorna true se conseguiu criar/verificar permissão de escrita.
 */
function ensureWritableDir(dir) {
  try {
    // Criar diretório (caso não exista)
    fs.mkdirSync(dir, { recursive: true });
    // Verifica permissão de escrita
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Resolve DB path com várias estratégias:
 * 1) process.env.DB_PATH (aceita arquivo ou diretório)
 * 2) ./data (na pasta de execução)
 * 3) ~/.local/share/<app> (home do usuário)
 * 4) os.tmpdir()
 * 5) ':memory:' (fallback final, usa DB em memória)
 */
function resolveDbPath() {
  if (isTest) {
    console.log("NODE_ENV=test -> usando banco em memória");
    return ":memory:";
  }

  // 1) DB_PATH (se definido)
  const envPath = process.env.DB_PATH;
  if (envPath) {
    try {
      const resolved = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
      const ext = path.extname(resolved);
      if (ext) {
        // envPath parece ser um arquivo (ex: /foo/bar/database.sqlite)
        const dir = path.dirname(resolved);
        if (ensureWritableDir(dir)) {
          console.log(`Usando DB_PATH (arquivo): ${resolved}`);
          return resolved;
        } else {
          console.warn(`DB_PATH informado, mas diretório não gravável: ${dir}`);
        }
      } else {
        // envPath parece ser um diretório
        if (ensureWritableDir(resolved)) {
          const file = path.join(resolved, "database.sqlite");
          console.log(`Usando DB_PATH (diretório): ${file}`);
          return file;
        } else {
          console.warn(`DB_PATH informado, mas diretório não gravável: ${resolved}`);
        }
      }
    } catch (err) {
      console.warn("Erro ao processar DB_PATH:", err?.message || err);
    }
  }
  const candidates = [
    path.join(process.cwd(), "data"),                           
    path.join(os.homedir() || "", ".local", "share", "octor-api"),
    os.tmpdir()                                                  // fallback para temp do sistema
  ];

  for (const candidateDir of candidates) {
    try {
      if (ensureWritableDir(candidateDir)) {
        const file = path.join(candidateDir, "database.sqlite");
        console.log(`Usando diretório gravável para DB: ${file}`);
        return file;
      } else {
        console.warn(`Diretório candidato não gravável: ${candidateDir}`);
      }
    } catch (err) {
      console.warn(`Erro ao testar candidato ${candidateDir}:`, err?.message || err);
    }
  }

  // Se nada funcionou, como último recurso usa memória (não persistente)
  console.warn("Nenhum diretório gravável encontrado; usando ':memory:' como fallback (não persistente).");
  return ":memory:";
}

const dbPath = resolveDbPath();

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
