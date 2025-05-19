require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Configurações da Nuvemshop API
const NUVEMSHOP_API = 'https://api.nuvemshop.com.br/v1';
const AUTH_URL = 'https://www.nuvemshop.com.br/apps/authorize/token';

// Variáveis do seu app (substitua pelas suas)
const APP_CONFIG = {
  CLIENT_ID: '17937',
  CLIENT_SECRET: '162efe3a9db6f1bf00fe1bda9603f2535ee45a700ff315ba',
  REDIRECT_URI: 'https://nuvem-popup-app.vercel.app/auth/callback',
  APP_URL: 'https://nuvem-popup-app.vercel.app'
};

// 1. Página inicial - Link de instalação
app.get('/', (req, res) => {
  res.send(`
    <h1>Poppop - Notificações de Prova Social</h1>
    <a href="https://www.nuvemshop.com.br/apps/${APP_CONFIG.CLIENT_ID}/authorize">
      Instalar app na minha loja
    </a>
    <p>App ID: ${APP_CONFIG.CLIENT_ID}</p>
  `);
});

// 2. Rotas de Termos e Política (obrigatórias)
app.get('/terms', (req, res) => {
  res.send('<h1>Termos de Serviço</h1><p>Conteúdo dos termos...</p>');
});

app.get('/privacy', (req, res) => {
  res.send('<h1>Política de Privacidade</h1><p>Conteúdo da política...</p>');
});

// 3. Callback OAuth
app.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Código de autorização ausente');

    const params = new URLSearchParams();
    params.append('client_id', APP_CONFIG.CLIENT_ID);
    params.append('client_secret', APP_CONFIG.CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', APP_CONFIG.REDIRECT_URI);

    const response = await axios.post(AUTH_URL, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, user_id } = response.data;
    
    // Redireciona para página de sucesso com os tokens
    res.redirect(`/success?access_token=${access_token}&user_id=${user_id}`);
  } catch (error) {
    console.error('Erro no callback:', error.response?.data || error.message);
    res.status(500).send(`
      <h2>Erro na autenticação</h2>
      <p>${error.response?.data?.error_description || error.message}</p>
      <a href="/">Tentar novamente</a>
    `);
  }
});

// 4. Página de sucesso pós-instalação
app.get('/success', (req, res) => {
  const { access_token, user_id } = req.query;
  
  res.send(`
    <h2>✅ Aplicativo instalado com sucesso!</h2>
    <p>User ID: ${user_id}</p>
    <button onclick="configureApp()">Configurar Notificações</button>
    <script>
      async function configureApp() {
        try {
          const response = await fetch('/injetar-script', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${access_token}'
            },
            body: JSON.stringify({ user_id: '${user_id}' })
          });
          const result = await response.json();
          alert(result.message || 'Configuração completa!');
        } catch (error) {
          alert('Erro: ' + error.message);
        }
      }
    </script>
  `);
});

// 5. Injeção do Script (método recomendado via API de Scripts)
app.post('/injetar-script', async (req, res) => {
  try {
    const { user_id } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });
    
    const token = authHeader.split(' ')[1]; // Remove "Bearer "

    // 1. Registrar via API de Scripts
    const scriptResponse = await axios.post(
      `${NUVEMSHOP_API}/${user_id}/scripts`,
      {
        src: `${APP_CONFIG.APP_URL}/widget.js`,
        event: "onload",
        where: "store",
        description: "Poppop - Notificações de prova social"
      },
      { headers: { 'Authentication': `bearer ${token}` } }
    );

    res.json({ 
      success: true,
      message: 'Widget instalado com sucesso via API de Scripts',
      data: scriptResponse.data
    });
  } catch (error) {
    console.error('Erro ao injetar script:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});

// 6. Notificações Fake (endpoint para o widget)
app.get('/notificacao', (req, res) => {
  const produtosFake = [
    { nome: 'Vestido Longo Floral', cliente: 'Juliana de Recife', link: '/produtos/vestido-longo-floral' },
    { nome: 'Tênis Esportivo', cliente: 'Carlos de São Paulo', link: '/produtos/tenis-esportivo' },
    { nome: 'Camisa Oversized', cliente: 'Mariana de Salvador', link: '/produtos/camisa-oversized' }
  ];
  
  res.json(produtosFake[Math.floor(Math.random() * produtosFake.length)]);
});

// 7. Widget JS
app.get('/widget.js', (req, res) => {
  res.type('application/javascript');
  res.send(`
    (function() {
      console.log('[Poppop] Widget carregado');
      
      const config = {
        apiUrl: '${APP_CONFIG.APP_URL}/notificacao',
        interval: 30000
      };
      
      function showNotification(data) {
        const popup = document.createElement('div');
        popup.style.cssText = \`
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 15px;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 9999;
          max-width: 300px;
          transition: opacity 0.5s;
        \`;
        
        popup.innerHTML = \`
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="color: #ff4757; font-size: 24px;">🔥</div>
            <div>
              <p style="margin: 0; font-weight: 500;">\${data.cliente} acabou de ver:</p>
              <a href="\${data.link}" style="color: #2f3542; font-weight: 600;">\${data.nome}</a>
            </div>
          </div>
        \`;
        
        document.body.appendChild(popup);
        
        setTimeout(() => {
          popup.style.opacity = '0';
          setTimeout(() => popup.remove(), 500);
        }, 5000);
      }
      
      async function fetchNotification() {
        try {
          const response = await fetch(config.apiUrl);
          return await response.json();
        } catch (error) {
          console.error('[Poppop] Erro:', error);
          return null;
        }
      }
      
      // Inicia
      async function init() {
        const data = await fetchNotification();
        if (data) showNotification(data);
        
        setInterval(async () => {
          const newData = await fetchNotification();
          if (newData) showNotification(newData);
        }, config.interval);
      }
      
      if (document.readyState === 'complete') {
        init();
      } else {
        window.addEventListener('DOMContentLoaded', init);
      }
    })();
  `);
});

// 8. Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'up',
    app: 'Poppop',
    version: '1.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`URL do app: ${APP_CONFIG.APP_URL}`);
});