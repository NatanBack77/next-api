import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import chalk from 'chalk';

// === CONFIGURAÇÃO API4COM ===
dotenv.config();
if (!process.env.API4COM_EMAIL || !process.env.API4COM_PASSWORD) {
  throw new Error('API4COM_EMAIL e API4COM_PASSWORD devem estar definidas no .env');
}
if (!process.env.WEBHOOK_URL) {
  console.warn(chalk.yellow('WEBHOOK_URL não definida; usando callback local padrão'));
}

const API4COM_BASE_URL = 'https://api.api4com.com/api/v1';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/callback';

let token = null;

// === AUTENTICAÇÃO ===
async function authenticate() {
  if (token) return token;
  const res = await axios.post(`${API4COM_BASE_URL}/users/login`, {
    email: process.env.API4COM_EMAIL,
    password: process.env.API4COM_PASSWORD,
    cpf_cnpj: "63468144350"
  });
  token = res.data.id;
  console.log(chalk.green('[Auth] Token obtido:'), token);
  return token;

async function registerWebhook() {
  const t = await authenticate();
  const config = { headers: { Authorization: t } };
  const listRes = await axios.get(`${API4COM_BASE_URL}/integrations`, config);
  const items = Array.isArray(listRes.data) ? listRes.data : listRes.data.data;

  const gatewayName = 'integration-test-15';
  const payload = {

    gateway: gatewayName,
    webhook: true,
    webhookConstraint: { metadata: { gateway: gatewayName } },
    metadata: { webhookUrl: WEBHOOK_URL, webhookVersion: 'v1.8', webhookTypes: ['channel-answer', 'channel-hangup'] }

  };
  const existing = items.find(i => i.gateway === gatewayName);
  if (existing?.id) {
    payload.id = existing.id;
  }

  try {
    await axios.patch(
      `${API4COM_BASE_URL}/integrations`,
      payload,
      config
    );
    if (existing?.id) {
      console.log(chalk.green(`[Webhook] Integração existente (${existing.id}) atualizada via PATCH`));
      console.log(chalk.green('[Webhook] Payload atualizado:'), payload);
    } else {
      console.log(chalk.green('[Webhook] Nova integração criada via PATCH'));
    }
  } catch (err) {
    console.error(
      chalk.red('[Webhook] Erro ao configurar integração:'),
      err.response?.data || err.message
    );
  }
}

// === FUNÇÃO GENÉRICA PARA /dialer E /extensions ===
async function callDialer(path, data) {
  const t = await authenticate();
  try {
    const res = await axios.post(`${API4COM_BASE_URL}${path}`, data, { headers: { Authorization: t } });
    return res.data;
  } catch (err) {
    console.error(chalk.red(`[API4COM ${path}]`), err.response?.data || err.message);
    throw new Error(err.response?.data?.message || 'Erro na API4COM');
  }
}

// === BANCO MOCK ===
const db = { users: [], ramais: [], calls: [], webhooks: [] };

// === SETUP EXPRESS ===
const app = express();
app.use(cors());
app.use(bodyParser.json());
const port = process.env.PORT || 3000;

// === SWAGGER DEFINITION COM PARÂMETROS E AUTORIZAÇÃO GLOBAL ===
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API4COM Integration',
    version: '1.0.0',
    description: 'Usuários, ramais (/extensions), chamadas (/dialer), hangup e webhooks'
  },
  servers: [{ url: `http://localhost:${port}` }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Bearer'
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ]
};
const swaggerOptions = { swaggerDefinition, apis: ['./server.js'] };
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /users:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Cria um usuário (mock)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 example: João Silva
 *               email:
 *                 type: string
 *                 example: joao@exemplo.com
 *     responses:
 *       201:
 *         description: Usuário criado
 *       400:
 *         description: Dados inválidos
 */
app.post('/users', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name e email obrigatórios.' });
  const user = { id: uuidv4(), name, email };
  db.users.push(user);
  res.status(201).json(user);
});

/**
 * @swagger
 * /users/api4com:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Cria um usuário na API4COM
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - phone
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Api4Com API de Voz"
 *               email:
 *                 type: string
 *                 example: "suporte@api4com.com"
 *               password:
 *                 type: string
 *                 example: "PwDLooL"
 *               phone:
 *                 type: string
 *                 example: "4833328530"
 *               role:
 *                 type: string
 *                 enum: ["ADMIN","USER"]
 *                 example: "USER"
 *     responses:
 *       200:
 *         description: Usuário criado na API4COM
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 role:
 *                   type: string
 */
app.post('/users/api4com', async (req, res) => {
  const { name, email, password, phone, role } = req.body;
  if (!name || !email || !password || !phone || !role) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres.' });
  }
  if (!['ADMIN', 'USER'].includes(role)) {
    return res.status(400).json({ error: 'role deve ser ADMIN ou USER.' });
  }
  try {
    const t = await authenticate();
    const response = await axios.post(
      `${API4COM_BASE_URL}/users`,
      { name, email, password, phone, role },
      { headers: { Authorization: t } }
    );
    res.json(response.data);
  } catch (err) {
    console.error(chalk.red('[Users API4COM] Erro ao criar usuário:'), err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

/**
 * @swagger
 * /users/api4com:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Lista usuários diretamente da API4COM
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: Filtro JSON-encoded (e.g., {"where":{"role":"ADMIN"}})
 *     responses:
 *       200:
 *         description: Lista de usuários da API4COM
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   uuid:
 *                     type: string
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   role:
 *                     type: string
 *                   emailVerified:
 *                     type: boolean
 *                   createdAt:
 *                     type: string
 *                   updatedAt:
 *                     type: string
 *                   lastLoginAt:
 *                     type: string
 */
app.get('/users/api4com', async (req, res) => {
  try {
    const t = await authenticate();
    const opts = { headers: { Authorization: t }, params: {} };
    if (req.query.filter) opts.params.filter = req.query.filter;
    const response = await axios.get(`${API4COM_BASE_URL}/users`, opts);
    res.json(response.data);
  } catch (err) {
    console.error(chalk.red('[Users API4COM] Erro ao listar usuários:'), err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

/**
 * @swagger
 * /users:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Lista usuários (mock)
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
app.get('/users', (req, res) => {
  res.json(db.users);
});

/**
 * @swagger
 * /ramal:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Cria ramal na conta (/extensions)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ramal
 *               - senha
 *               - first_name
 *               - last_name
 *               - email_address
 *               - gravar_audio
 *             properties:
 *               ramal:
 *                 type: string
 *                 example: "1001"
 *               senha:
 *                 type: string
 *                 example: "PwDLooL"
 *               bina:
 *                 type: string
 *                 example: "4833328530"
 *               first_name:
 *                 type: string
 *                 example: "Silvio"
 *               last_name:
 *                 type: string
 *                 example: "Fernandes"
 *               email_address:
 *                 type: string
 *                 example: "suporte@api4com.com"
 *               gravar_audio:
 *                 type: integer
 *                 enum: [0,1]
 *                 example: 1
 *     responses:
 *       201:
 *         description: Ramal criado
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno
 */
app.post('/ramal', async (req, res) => {
  const { ramal, senha, bina, first_name, last_name, email_address, gravar_audio } = req.body;
  if (!ramal || !senha || !first_name || !last_name || !email_address || ![0,1].includes(gravar_audio)) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando ou inválidos.' });
  }
  try {
    const ext = await callDialer('/extensions', req.body);
    db.ramais.push(ext);
    res.status(201).json(ext);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /ramal:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Lista ramais (mock)
 *     responses:
 *       200:
 *         description: Lista de ramais
 */
app.get('/ramal', (req, res) => {
  res.json(db.ramais);
});

/**
 * @swagger
 * /ramal/api4com:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Lista todos os ramais diretamente da API4COM
 *     responses:
 *       200:
 *         description: Lista de ramais obtida da API4COM
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
app.get('/ramal/api4com', async (req, res) => {
  try {
    const t = await authenticate();
    const response = await axios.get(`${API4COM_BASE_URL}/extensions`, { headers: { Authorization: t } });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

/**
 * @swagger
 * /call:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Realiza chamada (/dialer)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - extension
 *               - phone
 *             properties:
 *               extension:
 *                 type: string
 *                 example: "1001"
 *               phone:
 *                 type: string
 *                 example: "+5548999999999"
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Chamada realizada
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno
 */
app.post('/call', async (req, res) => {
  const t = await authenticate();
  const { extension, phone, metadata } = req.body;
  if (!extension || !phone) return res.status(400).json({ error: 'extension e phone são obrigatórios.' });
  try {
    const call = await callDialer('/dialer', { extension, phone, metadata }, {headers: { Authorization: t } });
    db.calls.push({ ...call, status: 'active' });
    res.status(201).json(call);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /call:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Lista chamadas (mock)
 *     responses:
 *       200:
 *         description: Lista de chamadas
 */
app.get('/call', (req, res) => {
  res.json(db.calls);
});

/**
 * @swagger
 * /calls/{id}/hangup:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Encerra uma chamada ativa
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da chamada a ser encerrada
 *     responses:
 *       200:
 *         description: Request was successful
 *       404:
 *         description: Chamada não encontrada ou já encerrada
 */
app.post('/calls/:id/hangup', async (req, res) => {
  const { id } = req.params;
  try {
    const t = await authenticate();
    const response = await axios.post(`${API4COM_BASE_URL}/calls/${id}/hangup`, {}, { headers: { Authorization: t } });
    console.log(chalk.blue(`[Hangup] Chamada ${id} encerrada com sucesso:`), response.data);
    const callIndex = db.calls.findIndex(c => c.id === id);
    if (callIndex !== -1) db.calls[callIndex].status = 'ended';
    res.status(200).json({ status: response.data.status, message: response.data.message, id });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

/**
 * @swagger
 * /callback:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Recebe eventos de chamada (Webhook API4COM)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Webhook recebido
 *       400:
 *         description: Payload vazio
 */
app.post('/callback', (req, res) => {
  if (!req.body || !Object.keys(req.body).length) return res.status(400).json({ error: 'Payload vazio.' });
  const now = new Date().toISOString();
  console.log(chalk.cyan(`[${now}] Novo webhook recebido em /callback:`));
  console.dir(req.body, { depth: null, colors: true });
  db.webhooks.push({ data: req.body, at: new Date() });
  res.sendStatus(200);
});

/**
 * @swagger
 * /webhook:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Lista webhooks recebidos (mock)
 *     responses:
 *       200:
 *         description: Lista de webhooks
 */
app.get('/webhook', (req, res) => {
  res.json(db.webhooks);
});

// 404 para rotas não definidas
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// Inicia servidor e registra webhook
app.listen(port, async () => {
  console.log(chalk.green(` Servidor rodando em http://localhost:${port}`));
  console.log(chalk.green(` Swagger UI disponível em http://localhost:${port}/docs`));
  await registerWebhook();
  console.log(chalk.green(` Webhook URL configurado: ${WEBHOOK_URL}`));
});
