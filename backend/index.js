require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Para servir arquivos estáticos

const PORT = process.env.PORT || 3001;

// Configurações do App
const APP_CONFIG = {
  CLIENT_ID: '17937',
  CLIENT_SECRET: '162efe3a9db6f1bf00fe1bda9603f2535ee45a700ff315ba',
  REDIRECT_URI: 'https://nuvem-popup-app.vercel.app/auth/callback',
  APP_URL: 'https://nuvem-popup-app.vercel.app'
};

// Cache simples para armazenar tokens (em produção use um banco de dados)
const tokenCache = {};

// 1. Página inicial com status de conexão
app.get('/', (req, res) => {
  const shopId = req.query.shop_id;
  let statusHtml = '';

  if (shopId && tokenCache[shopId]) {
    statusHtml = `
      <div class="status-box connected">
        <h3>✅ Loja Conectada</h3>
        <p>ID: ${shopId}</p>
        <p>Última conexão: ${new Date(tokenCache[shopId].created_at).toLocaleString()}</p>
      </div>
    `;
  } else {
    statusHtml = `
      <div class="status-box disconnected">
        <h3>⚠️ Nenhuma loja conectada</h3>
        <p>Instale o app em sua loja Nuvemshop</p>
      </div>
    `;
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Poppop - Painel</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .status-box { padding: 20px; border-radius: 8px; margin: 20px 0; }
        .connected { background: #e6f7ee; border: 1px solid #2ecc71; }
        .disconnected { background: #ffebee; border: 1px solid #e74c3c; }
        .btn { 
          display: inline-block; 
          padding: 10px 20px; 
          background: #3498db; 
          color: white; 
          text-decoration: none; 
          border-radius: 4px; 
          margin-top: 10px;
        }
        .btn:hover { background: #2980b9; }
      </style>
    </head>
    <body>
      <h1>Poppop - Notificações de Prova Social</h1>
      ${statusHtml}
      <a href="https://www.nuvemshop.com.br/apps/${APP_CONFIG.CLIENT_ID}/authorize" class="btn">
        Instalar em uma nova loja
      </a>
      
      <h3>Verificar loja existente:</h3>
      <form action="/check-status" method="get">
        <input type="text" name="shop_id" placeholder="ID da Loja" required>
        <button type="submit" class="btn">Verificar Status</button>
      </form>
    </body>
    </html>
  `);
});

// 2. Rota para verificar status da loja
app.get('/check-status', (req, res) => {
  const shopId = req.query.shop_id;
  if (shopId && tokenCache[shopId]) {
    res.redirect(`/?shop_id=${shopId}`);
  } else {
    res.redirect('/?error=Loja não encontrada');
  }
});

// 3. Callback OAuth (com armazenamento do token)
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

    const response = await axios.post(
      'https://www.nuvemshop.com.br/apps/authorize/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, user_id } = response.data;
    
    // Armazena o token no cache
    tokenCache[user_id] = {
      access_token,
      created_at: Date.now(),
      expires_at: Date.now() + 3600000 // 1 hora de validade
    };

    // Redireciona para página de sucesso
    res.redirect(`/success?user_id=${user_id}&access_token=${access_token}`);
  } catch (error) {
    console.error('Erro no callback:', error.response?.data || error.message);
    res.status(500).send(`
      <h2>Erro na autenticação</h2>
      <p>${error.response?.data?.error_description || error.message}</p>
      <a href="/">Voltar ao início</a>
    `);
  }
});

app.get('/success', (req, res) => {
  const { user_id, access_token } = req.query;
  
  if (!user_id || !access_token) {
    return res.status(400).send('Parâmetros ausentes');
  }

  // Armazena o token recebido
  tokenCache[user_id] = {
    access_token,
    created_at: Date.now()
  };

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Instalação Concluída</title>
      <style>
        /* Estilos mantidos do código anterior */
      </style>
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
            
            if (result.success) {
              // Testa o widget imediatamente após a instalação
              const widgetScript = document.createElement('script');
              widgetScript.src = '${APP_CONFIG.APP_URL}/widget.js';
              document.body.appendChild(widgetScript);
              
              setTimeout(() => {
                alert('Configuração completa! O popup deve aparecer em instantes...');
              }, 1000);
            } else {
              alert('Erro: ' + (result.error || 'Falha na configuração'));
            }
          } catch (error) {
            alert('Erro: ' + error.message);
          }
        }
        
        // Configura automaticamente quando a página carrega
        window.onload = configureApp;
      </script>
    </head>
    <body>
      <div class="success-box">
        <h2>✅ Instalação concluída com sucesso!</h2>
        <p>User ID: ${user_id}</p>
        <div class="token-info">
          <strong>Status:</strong> Popup de notificações está sendo configurado...
        </div>
        <button onclick="configureApp()" class="btn">Testar Popup Manualmente</button>
        <a href="${APP_CONFIG.APP_URL}/?shop_id=${user_id}" class="btn">Ir para o painel</a>
      </div>
    </body>
    </html>
  `);
});

// 5. Rotas da API (mantidas do código anterior)
app.get('/notificacao', (req, res) => {
  // ... mesma implementação anterior
});

app.get('/widget.js', (req, res) => {
  res.type('application/javascript');
  res.send(`
    (function() {
      console.log('[Poppop] Widget inicializado - Versão Segura');
      
      // Verifica se a CSP permite nossa execução
      try {
        new Function('return true');
      } catch (e) {
        console.warn('[Poppop] Política de segurança restritiva detectada', e);
        return;
      }

      // ... (restante do código do widget sem modificações)
      
      // Estilos atualizados
      const styles = {
        popup: \`
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 15px;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 9999;
          max-width: 300px;
          transition: all 0.3s ease;
          transform: translateY(20px);
          opacity: 0;
        \`,
        visible: \`
          transform: translateY(0);
          opacity: 1;
        \`
      };
      
      // Cria o container do popup
      function createPopup(data) {
        const popup = document.createElement('div');
        popup.style.cssText = styles.popup;
        popup.className = 'poppop-notification';
        
        popup.innerHTML = \`
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="color: #ff4757; font-size: 24px;">🔥</div>
            <div>
              <p style="margin: 0; font-weight: 500; font-size: 14px;">\${data.cliente} acabou de ver:</p>
              <a href="\${data.link}" 
                 style="color: #2f3542; font-weight: 600; font-size: 16px;"
                 onmouseover="this.style.color='#e74c3c'" 
                 onmouseout="this.style.color='#2f3542'">
                \${data.nome}
              </a>
            </div>
          </div>
        \`;
        
        document.body.appendChild(popup);
        
        // Animação de entrada
        setTimeout(() => {
          popup.style.cssText += styles.visible;
        }, 50);
        
        // Remove após 5 segundos
        setTimeout(() => {
          popup.style.opacity = '0';
          setTimeout(() => popup.remove(), 300);
        }, 5000);
      }
      
      // Busca notificação
      async function fetchNotification() {
        try {
          if(config.debug) console.log('[Poppop] Buscando notificação...');
          const response = await fetch(config.apiUrl);
          if (!response.ok) throw new Error('Falha na requisição');
          return await response.json();
        } catch (error) {
          if(config.debug) console.error('[Poppop] Erro:', error);
          return null;
        }
      }
      
      // Mostra notificação inicial
      async function showInitialNotification() {
        const data = await fetchNotification();
        if (data) {
          createPopup(data);
          if(config.debug) console.log('[Poppop] Primeira notificação exibida');
        }
      }
      
      // Inicia o widget
      function init() {
        if(config.debug) console.log('[Poppop] Inicializando widget...');
        showInitialNotification();
        
        // Configura intervalo para novas notificações
        setInterval(async () => {
          const newData = await fetchNotification();
          if (newData) {
            createPopup(newData);
            if(config.debug) console.log('[Poppop] Nova notificação exibida');
          }
        }, config.interval);
      }
      
      // Inicia quando o DOM estiver pronto
      if (document.readyState === 'complete') {
        init();
      } else {
        window.addEventListener('DOMContentLoaded', init);
      }
    })();
  `);
});

app.post('/injetar-script', async (req, res) => {
  try {
    const { user_id } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token || !user_id) {
      return res.status(400).json({ 
        success: false,
        error: 'Token ou user_id ausentes'
      });
    }

    // 1. Registra o script via API
    const scriptResponse = await axios.post(
      `${NUVEMSHOP_API}/${user_id}/scripts`,
      {
        src: `${APP_CONFIG.APP_URL}/widget.js`,
        event: "onload",
        where: "store",
        description: "Poppop - Notificações em tempo real"
      },
      { headers: { 'Authentication': `bearer ${token}` } }
    );

    // 2. Dispara uma notificação teste imediatamente
    await axios.post(
      `${NUVEMSHOP_API}/${user_id}/notifications`,
      {
        email: false,
        sms: false,
        desktop: true,
        message: "🔔 Notificações Poppop ativadas com sucesso!"
      },
      { headers: { 'Authentication': `bearer ${token}` } }
    );

    res.json({ 
      success: true,
      message: 'Script injetado com sucesso',
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


// Rota para verificar tokens (adicione com as outras rotas)
app.get('/api/verify-token', async (req, res) => {
  try {
    const { token, user_id } = req.query;

    if (!token || !user_id) {
      return res.status(400).json({
        error: 'Parâmetros faltando',
        message: 'Você deve fornecer token e user_id como query parameters',
        example: `${APP_CONFIG.APP_URL}/api/verify-token?token=SEU_TOKEN&user_id=SEU_USER_ID`
      });
    }

    // Verifica o token na API da Nuvemshop
    const response = await axios.get(
      `https://api.nuvemshop.com.br/v1/${user_id}/store`,
      {
        headers: {
          'Authentication': `bearer ${token}`
        }
      }
    );

    res.json({
      status: 'success',
      valid: true,
      store_info: {
        name: response.data.name,
        url: response.data.url,
        plan: response.data.plan
      },
      token_info: {
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hora
      }
    });
  } catch (error) {
    console.error('Erro na verificação do token:', error.response?.data || error.message);
    res.status(401).json({
      status: 'error',
      valid: false,
      error: 'Token inválido ou expirado',
      details: error.response?.data || error.message
    });
  }
});


// Rota para verificar tokens ativos (adicione antes do app.listen)
app.get('/api/active-tokens', (req, res) => {
  res.json({
    active_connections: Object.keys(tokenCache).length,
    shops: Object.keys(tokenCache).map(shopId => ({
      shop_id: shopId,
      created_at: new Date(tokenCache[shopId].created_at).toISOString(),
      expires_at: new Date(tokenCache[shopId].expires_at).toISOString()
    }))
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`URL do app: ${APP_CONFIG.APP_URL}`);
});

app.get('/api/verify-token', async (req, res) => {
  const { token, user_id } = req.query;

  if (!token || !user_id) {
    return res.status(400).json({ error: 'Token e user_id são obrigatórios' });
  }

  try {
    const response = await axios.get(
      `https://api.nuvemshop.com.br/v1/${user_id}/store`,
      {
        headers: {
          'Authentication': `bearer ${token}`
        }
      }
    );

    res.json({
      valid: true,
      store: response.data.name,
      plan: response.data.plan,
      token_expires: new Date(Date.now() + 3600000).toISOString() // 1 hora
    });
  } catch (error) {
    res.json({
      valid: false,
      error: error.response?.data || error.message
    });
  }
});

// Rota para listar todas as lojas conectadas
app.get('/api/connected-stores', (req, res) => {
  res.json({
    count: Object.keys(tokenCache).length,
    stores: Object.entries(tokenCache).map(([user_id, data]) => ({
      user_id,
      created_at: new Date(data.created_at).toISOString(),
      token_expires: new Date(data.created_at + 3600000).toISOString()
    }))
  });
});

// Rota para debug completo
app.get('/api/debug', (req, res) => {
  res.json({
    app: 'Poppop',
    status: 'online',
    version: '1.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory_usage: process.memoryUsage(),
    connected_stores: Object.keys(tokenCache).length
  });
});