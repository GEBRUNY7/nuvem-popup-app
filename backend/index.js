require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors'); // 👈 novo

const app = express();
app.use(cors()); // 👈 ativa o CORS

const PORT = 3001;


// 2. Rota raiz (página de instalação)
app.get('/', (req, res) => {
  res.send(`<a href="https://www.nuvemshop.com.br/apps/${process.env.CLIENT_ID}/authorize">Instalar app</a>`);
});

// 3. Callback do OAuth
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send('Código de autorização ausente');

  try {
    const response = await axios.post('https://www.nuvemshop.com.br/apps/token', {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.REDIRECT_URI
    });

    const { access_token, user_id } = response.data;

    console.log('Token:', access_token);
    console.log('Loja ID:', user_id);

    res.send('Autenticação realizada com sucesso! Você pode fechar esta aba.');
  } catch (err) {
    console.error('Erro ao obter token:', err.response?.data || err.message);
    res.status(500).send('Erro ao autenticar');
  }
});

// ✅ 4. NOVA rota de notificação fake
app.get('/notificacao', async (req, res) => {
  const produtosFake = [
    {
      nome: 'Vestido Longo Floral',
      cliente: 'Juliana de Recife',
      link: '/produtos/vestido-longo-floral'
    },
    {
      nome: 'Tênis Esportivo',
      cliente: 'Carlos de São Paulo',
      link: '/produtos/tenis-esportivo'
    },
    {
      nome: 'Camisa Oversized',
      cliente: 'Mariana de Salvador',
      link: '/produtos/camisa-oversized'
    }
  ];

  const aleatorio = produtosFake[Math.floor(Math.random() * produtosFake.length)];
  res.json(aleatorio);
});

// 5. Start do servidor
app.listen(PORT, () => {
  console.log(`Servidor backend rodando em http://localhost:${PORT}`);
});

app.get('/injetar-script', async (req, res) => {
  const token = "25ca4db565aaa76c308df90ba07664d6cb0f4791";
  const userId = "6247822";

  try {
    // 1. Buscar temas
    const temas = await axios.get(`https://api.nuvemshop.com.br/v1/${userId}/themes`, {
      headers: {
        'Authentication': `bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const temaAtivo = temas.data.find(t => t.active);
    if (!temaAtivo) return res.status(404).send("Nenhum tema ativo encontrado.");

    const themeId = temaAtivo.id;
    console.log("Tema ativo:", themeId);

    // 2. Buscar layout.tpl
    const layoutAtual = await axios.get(`https://api.nuvemshop.com.br/v1/${userId}/themes/${themeId}/files/templates/layout.tpl`, {
      headers: {
        'Authentication': `bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    let layout = layoutAtual.data.content;

    // 3. Verifica se já foi injetado
    if (layout.includes("widget.js")) {
      return res.send("Script já foi injetado.");
    }

    // 4. Injetar script antes do </body>
    const scriptTag = `<script src="https://seuapp.vercel.app/widget.js"></script>\n</body>`;
    const layoutModificado = layout.replace("</body>", scriptTag);

    // 5. Enviar novo layout
    await axios.put(
      `https://api.nuvemshop.com.br/v1/${userId}/themes/${themeId}/files/templates/layout.tpl`,
      { content: layoutModificado },
      {
        headers: {
          'Authentication': `bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.send("✅ Script injetado com sucesso!");
  } catch (err) {
    console.error("Erro ao injetar script:", err.response?.data || err.message);
    res.status(500).send("Erro ao injetar script");
  }
});

app.get('/listar-arquivos-tema', async (req, res) => {
  const token = "25ca4db565aaa76c308df90ba07664d6cb0f4791";
  const userId = "6247822";

  try {
    const temas = await axios.get(`https://api.nuvemshop.com.br/v1/${userId}/themes`, {
      headers: {
        'Authentication': `bearer ${token}`
      }
    });

    const temaAtivo = temas.data.find(t => t.active);
    if (!temaAtivo) return res.status(404).send("Nenhum tema ativo encontrado.");

    const themeId = temaAtivo.id;

    const arquivos = await axios.get(`https://api.nuvemshop.com.br/v1/${userId}/themes/${themeId}/files`, {
      headers: {
        'Authentication': `bearer ${token}`
      }
    });

    res.json(arquivos.data);
  } catch (err) {
    console.error("Erro ao listar arquivos:", err.response?.data || err.message);
    res.status(500).send("Erro ao listar arquivos");
  }
});
