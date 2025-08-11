import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import chalk from 'chalk';
import multer from 'multer';
import fs from 'fs';
import FormData from 'form-data';

dotenv.config();
if (!process.env.APITOKEN || !process.env.APPID) {
  throw new Error('APITOKEN and APPID must be set in the .env file');
}

const apiToken= process.env.APITOKEN
const appId = process.env.APPID

const app = express();
app.use(cors());
app.use(bodyParser.json());
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

// === SWAGGER DEFINITION COM PARÂMETROS E AUTORIZAÇÃO GLOBAL ===
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'LigueLead Integration',
    version: '1.0.0',
    description: 'liguelead integration API'
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
const swaggerOptions = { swaggerDefinition, apis: ['./liguelead.js'] };
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /audio:
 *   post:
 *     summary: Envia um áudio para a API LigueLead
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - audio
 *             properties:
 *               title:
 *                 type: string
 *                 description: Título do áudio
 *               audio:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de áudio
 *     responses:
 *       200:
 *         description: Resposta da API LigueLead
 */

app.post('/audio', upload.single('audio'), async (req, res) => {
  try {
    console.log(chalk.blue('[LOG] Requisição recebida em /audio'));
    const { title } = req.body;
    const audioFile = req.file;
  
    if (!apiToken || !appId || !audioFile || !title) {
      console.log(chalk.yellow('[WARN] Parâmetros obrigatórios ausentes.'));
      return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes.' });
    }

    console.log(chalk.green('[INFO] Parâmetros recebidos:'), { title, audioFile: audioFile.originalname, apiToken, appId });

    const formData = new FormData();
    formData.append('title', title);
    formData.append('audio', fs.createReadStream(audioFile.path), audioFile.originalname);

    console.log(chalk.blue('[LOG] Enviando requisição para API LigueLead...'));

    const response = await axios.post(
      'https://api.liguelead.com.br/v1/audio',
      formData,
      {
        headers: {
          'api-token': apiToken,
          'app-id': appId,
          ...formData.getHeaders()
        }
      }
    );

    console.log(chalk.green('[SUCCESS] Resposta recebida da API LigueLead'));
    res.json(response.data);
  } catch (error) {
    console.log(chalk.red('[ERROR] Erro ao processar requisição:'), error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /audios:
 *   get:
 *     summary: Lista todos os áudios cadastrados na API LigueLead
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de áudios retornada com sucesso
 *       400:
 *         description: Parâmetros obrigatórios ausentes
 *       500:
 *         description: Erro interno do servidor
 */
app.get('/audios', async (req, res) => {

  console.log(chalk.blue('[LOG] Requisição recebida em /audios'));

  try {
    console.log(chalk.green('[INFO] Parâmetros recebidos:'), { apiToken, appId });

    const response = await axios.get('https://api.liguelead.com.br/v1/audio', {
      headers: {
        'api-token': apiToken,
        'app-id': appId
      }
    });

    console.log("Dados da resposta:", response.status, response.data);

    console.log(chalk.green('[SUCCESS] Lista de áudios recebida com sucesso'));
    res.json(response.data);
  } catch (error) {

    if (error.response) {
    console.log(chalk.red('[ERROR] Resposta da API LigueLead:'), {
      status: error.response.status,
      data: error.response.data
    });
    return res.status(error.response.status).json(error.response.data);
  }

    console.log(chalk.red('[ERROR] Erro ao processar requisição:'), error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /audio/{id}:
 *   get:
 *     summary: Busca um áudio específico na API LigueLead pelo ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do áudio a ser buscado
 *     responses:
 *       200:
 *         description: Áudio retornado com sucesso
 *       400:
 *         description: Parâmetros obrigatórios ausentes
 *       404:
 *         description: Áudio não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
app.get('/audio/:id', async (req, res) => {
  const { id } = req.params;

  console.log(chalk.blue(`[LOG] Requisição recebida em /audio/${id}`));
  
  try {
    console.log(chalk.green('[INFO] Parâmetros recebidos:'), { id, apiToken, appId });

    const response = await axios.get(
      `https://api.liguelead.com.br/v1/audio/${id}`,
      {
        headers: {
          'api-token': apiToken,
          'app-id': appId
        }
      }
    );

    console.log(chalk.green('[SUCCESS] Áudio recebido da API LigueLead'));
    res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(chalk.yellow('[WARN] Áudio não encontrado na API LigueLead'));
      return res.status(404).json({ error: 'Áudio não encontrado.' });
    }
    console.log(chalk.red('[ERROR] Erro ao buscar áudio:'), error.message);
    res.status(500).json({ error: error.message });
  }
});


/**
 * @swagger
 * /voice:
 *   post:
 *     summary: Envia uma mensagem de voz para a API LigueLead
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - application/json
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - audio_id
 *               - phones
 *             properties:
 *               title:
 *                 type: string
 *                 description: Título da mensagem de voz
 *               audio_id:
 *                 type: integer
 *                 description: ID do áudio cadastrado
 *               phones:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de números de telefone
 *     responses:
 *       200:
 *         description: Resposta da API LigueLead
 *       400:
 *         description: Parâmetros obrigatórios ausentes
 *       500:
 *         description: Erro interno do servidor
 */
app.post('/voice', async (req, res) => {
  console.log(chalk.blue('[LOG] Requisição recebida em /voice'));
  const { title, audio_id, phones } = req.body;

  if (!title || !audio_id || !phones || !Array.isArray(phones) || phones.length === 0) {
    console.log(chalk.yellow('[WARN] Parâmetros obrigatórios ausentes ou inválidos.'));
    return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes ou inválidos.' });
  }

  try {
    console.log(chalk.green('[INFO] Parâmetros recebidos:'), { title, audio_id, phones, apiToken, appId });

    const response = await axios.post(
      'https://api.liguelead.com.br/v1/voice',
      { title, audio_id, phones },
      {
        headers: {
          'api-token': apiToken,
          'app-id': appId,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(chalk.green('[SUCCESS] Resposta recebida da API LigueLead'));
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      console.log(chalk.red('[ERROR] Resposta da API LigueLead:'), {
        status: error.response.status,
        data: error.response.data
      });
      if (error.response.status === 422 && error.response.data && error.response.data.message === 'Nenhum evento encontrado') {
        console.log(chalk.yellow('[EVENTO] Evento "iniciar flow" não encontrado na API LigueLead.'));
      }
      return res.status(error.response.status).json(error.response.data);
    }
    console.log(chalk.red('[ERROR] Erro ao processar requisição:'), error.message);
    res.status(500).json({ error: error.message });
  }
});
/**
 * @swagger
 * /campaigns/voice/{id}:
 *   get:
 *     summary: Busca campanhas de voz por ID na API LigueLead
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha de voz
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *         description: Página de resultados
 *       - in: query
 *         name: per_page
 *         required: false
 *         schema:
 *           type: integer
 *         description: Quantidade de resultados por página
 *     responses:
 *       200:
 *         description: Campanhas de voz retornadas com sucesso
 *       400:
 *         description: Parâmetros obrigatórios ausentes
 *       404:
 *         description: Campanha não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
app.get('/campaigns/voice/:id', async (req, res) => {
  const { id } = req.params;
  const { page, per_page } = req.query;
  console.log(chalk.blue(`[LOG] Requisição recebida em /campaigns/voice/${id}`));

  if (!id) {
    console.log(chalk.yellow('[WARN] Parâmetros obrigatórios ausentes.'));
    return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes.' });
  }

  try {
    const url = `https://api.liguelead.com.br/v1/campaigns/voice/${id}`;
    const params = {};
    if (page) params.page = page;
    if (per_page) params.per_page = per_page;

    console.log(chalk.green('[INFO] Parâmetros recebidos:'), { id, page, per_page, apiToken, appId });

    const response = await axios.get(url, {
      headers: {
        'api-token': apiToken,
        'app-id': appId
      },
      params
    });

    console.log(chalk.green('[SUCCESS] Campanhas de voz recebidas da API LigueLead'));
    res.json(response.data);
  } catch (error) {

    if (error.response) {
      console.log(chalk.red('[ERROR] Resposta da API LigueLead:'), {
        status: error.response.status,
        data: error.response.data
      });
      return res.status(error.response.status).json(error.response.data);
    }
    if (error.response && error.response.status === 404) {
      console.log(chalk.yellow('[WARN] Campanha não encontrada na API LigueLead'));
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    console.log(chalk.red('[ERROR] Erro ao buscar campanhas de voz:'), error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /flow/start:
 *   post:
 *     summary: Inicia um flow na API LigueLead
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *     responses:
 *       200:
 *         description: Flow iniciado com sucesso
 *       500:
 *         description: Erro ao iniciar flow
 */
app.post('/flow/start', async (req, res) => {
  console.log(chalk.blue('[LOG] Requisição recebida em /flow/start'));

  const url = 'https://areadocliente.liguelead.com.br/api/crm/webhook/f914ed2e-30d3-4c5a-b4a4-6fe7ea1223d3';
  const headers = {
    'Content-Type': 'application/json',
    ...(process.env.APITOKEN ? { 'api-token': apiToken } : {}),
    ...(process.env.APPID ? { 'app-id': appId } : {}),
  };

  const candidates = [
    { event: 'iniciar_flow' },
    { event: 'start_flow' },
    { action: 'iniciar_flow' },
    { action: 'start_flow' },
    { type: 'iniciar_flow' },
    { type: 'start_flow' },
    { trigger: 'iniciar_flow' },
    { trigger: 'start_flow' },
    { event: { name: 'iniciar_flow' } },
    { event: { name: 'start_flow' } },
    { event: 'iniciar_flow', leadId: 'manual-test-1' },
    { event: 'iniciar_flow', lead: { id: 'manual-test-1', name: 'Teste' } },
    { action: 'start_flow', data: { source: 'api' } },
    {},
    { }
  ];

  const results = [];
  const delay = ms => new Promise(r => setTimeout(r, ms));

  try {
    for (const payload of candidates) {
      console.log(chalk.green('[INFO] tentando payload:'), payload);
      try {
        const resp = await axios.post(url, payload, { headers, timeout: 10000 });
        console.log(chalk.green('[SUCCESS] webhook aceitou payload:'), payload, 'status', resp.status);
        return res.json({ ok: true, usedPayload: payload, response: resp.data });
      } catch (err) {
        const status = err.response?.status;
        const data = err.response?.data;
        console.log(chalk.yellow('[WARN] tentativa falhou:'), { payload, status, data });
        results.push({ payload, status: status || 'no-response', data: data || err.message });
        if (status && ![422, 400].includes(status)) {
          console.log(chalk.red('[ERROR] erro não-recoverable retornado, abortando tentativas'));
          return res.status(status).json({ error: data || err.message, attempts: results });
        }
        await delay(300);
      }
    }
    console.log(chalk.red('[ERROR] nenhum payload funcionou'));
    return res.status(422).json({
      ok: false,
      message: 'Nenhum payload aceito pelo webhook. Verifique schema esperado pela LigueLead.',
      attempts: results,
    });
  } catch (err) {
    console.error('[ERROR] erro interno ao tentar disparar flow:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(chalk.green(`Servidor rodando na porta ${port}`));
});

