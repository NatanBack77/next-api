// tests/users.test.js
import request from "supertest";
import app from "../server.js";
import db from "../db.js";

let token;

beforeAll(done => {
  db.run("DELETE FROM users", done);
});

afterAll(done => {
  db.close(done);
});

describe("API Usuários", () => {
  it("deve cadastrar um usuário", async () => {
    const res = await request(app)
      .post("/register")
      .send({
        nome: "Teste",
        email: "teste@example.com",
        senha: "123456",
        idade: 25
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("id");
  });

  it("deve fazer login e retornar token", async () => {
    const res = await request(app)
      .post("/login")
      .send({
        email: "teste@example.com",
        senha: "123456"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
    token = res.body.token;
  });

  it("deve listar usuários", async () => {
    const res = await request(app).get("/users");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("deve atualizar usuário autenticado", async () => {
    const res = await request(app)
      .put("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Novo Nome" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("message", "Usuário atualizado");
  });

  it("deve deletar usuário autenticado", async () => {
    const res = await request(app)
      .delete("/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("message", "Usuário deletado");
  });
});
