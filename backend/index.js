require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = 3001;


// 1. Página inicial
app.get('/', (req, res) => {
  res.send(`<a href="https://www.nuvemshop.com.br/apps/${process.env.CLIENT_ID}/authorize">Instalar app</a>`);
});


// 2. OAuth callback
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

    console.log('✅ Token:', access_token);
    console.log('🛒 Loja ID:', user_id);

    res.send('✅ Autenticação realizada com sucesso! Você pode fechar esta aba.');
  } catch (err) {
    console.error('Erro ao obter token:', err.response?.data || err.message);
    res.status(500).send('Erro ao autenticar');
  }
});

// 3. Notificação fake
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

// ✅ 4. Injetar script no tema
app.get('/injetar-script', async (req, res) => {
  const token = "25ca4db565aaa76c308df90ba07664d6cb0f4791"; // seu access_token
  const userId = "6247822"; // id da loja conectada

  try {
    const temas = await axios.get(`https://api.nuvemshop.com.br/v1/${userId}/themes`, {
      headers: {
        'Authentication': `bearer ${token}`
      }
    });

    const temaAtivo = temas.data.find(t => t.active);
    if (!temaAtivo) return res.status(404).send("❌ Tema ativo não encontrado");

    const themeId = temaAtivo.id;

    const arquivos = await axios.get(`https://api.nuvemshop.com.br/v1/${userId}/themes/${themeId}/files`, {
      headers: {
        'Authentication': `bearer ${token}`
      }
    });

    const tpl = arquivos.data.find(file =>
      file.path.includes('layout.tpl') || file.path.includes('index.tpl')
    );

    if (!tpl) return res.status(404).send("❌ Arquivo layout.tpl/index.tpl não encontrado");

    const filePath = tpl.path;

    const conteudo = await axios.get(`https://api.nuvemshop.com.br/v1/${userId}/themes/${themeId}/files/${filePath}`, {
      headers: {
        'Authentication': `bearer ${token}`
      }
    });

    let layout = conteudo.data.content;

    if (layout.includes("widget.js")) {
      return res.send("✅ Script já está injetado.");
    }

    if (!layout.includes("</body>")) {
      return res.status(400).send("⚠️ Não foi possível encontrar </body> no layout.");
    }

    const script = `<script src="https://nuvem-popup-app.vercel.app/widget.js"></script>\n</body>`;
    const novoLayout = layout.replace("</body>", script);

    await axios.put(
      `https://api.nuvemshop.com.br/v1/${userId}/themes/${themeId}/files/${filePath}`,
      { content: novoLayout },
      {
        headers: {
          'Authentication': `bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.send("✅ Script injetado com sucesso no tema!");
  } catch (err) {
    console.error("❌ Erro ao injetar script:", err.response?.data || err.message);
    res.status(500).send("Erro ao injetar script");
  }
});

// Rota para listar os arquivos do tema
app.get('/listar-arquivos-tema', async (req, res) => {
  const token = "25ca4db565aaa76c308df90ba07664d6cb0f4791";
  const userId = "6247822";

  try {
    console.log("🔍 Buscando temas...");

    const temas = await axios.get(`https://api.nuvemshop.com.br/v1/${userId}/themes`, {
      headers: { 'Authentication': `bearer ${token}` }
    });

    console.log("📦 Temas encontrados:", temas.data);

    const temaAtivo = temas.data.find(t => t.active);
    if (!temaAtivo) {
      console.log("❌ Nenhum tema ativo encontrado");
      return res.status(404).send("Tema ativo não encontrado");
    }

    const themeId = temaAtivo.id;
    console.log("🎯 ID do tema ativo:", themeId);

    const arquivos = await axios.get(`https://api.nuvemshop.com.br/v1/${userId}/themes/${themeId}/files`, {
      headers: { 'Authentication': `bearer ${token}` }
    });

    res.json(arquivos.data);
  } catch (err) {
    console.error("❌ Erro ao listar arquivos:", err.response?.data || err.message);
    res.status(500).send("Erro ao listar arquivos");
  }
});



// 🔚 Start do servidor (deve ficar sempre no final!)
app.listen(PORT, () => {
  console.log(`Servidor backend rodando em http://localhost:${PORT}`);
});
