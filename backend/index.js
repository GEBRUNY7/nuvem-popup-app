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
const AUTH_URL = 'https://www.nuvemshop.com.br/apps/token';

// Middleware para autenticação
const authenticateStore = async (req, res, next) => {
  try {
    const { access_token, user_id } = req.query;
    
    if (!access_token || !user_id) {
      return res.status(400).json({ error: 'Token de acesso e ID da loja são necessários' });
    }

    req.store = {
      token: access_token,
      userId: user_id
    };
    
    next();
  } catch (error) {
    console.error('Erro na autenticação:', error);
    res.status(500).json({ error: 'Erro na autenticação' });
  }
};

// 1. Página inicial
app.get('/', (req, res) => {
  res.send(`
    <h1>Poppop - Notificações de Prova Social</h1>
    <a href="https://www.nuvemshop.com.br/apps/${process.env.CLIENT_ID}/authorize">
      Instalar app na minha loja
    </a>
  `);
});

// 2. OAuth callback
app.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Código de autorização ausente');

    const response = await axios.post(AUTH_URL, {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.REDIRECT_URI
    });

    const { access_token, user_id } = response.data;
    
    // Redireciona para uma página de sucesso com os tokens
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

// Página de sucesso após autenticação
app.get('/success', (req, res) => {
  res.send(`
    <h2>✅ Aplicativo instalado com sucesso!</h2>
    <p>Você pode fechar esta aba e voltar para o painel da sua loja.</p>
    <button onclick="injectScript()">Configurar Notificações</button>
    <script>
      async function injectScript() {
        try {
          const response = await fetch('/injetar-script?access_token=${req.query.access_token}&user_id=${req.query.user_id}');
          const result = await response.json();
          alert(result.message || 'Script configurado com sucesso!');
        } catch (error) {
          alert('Erro ao configurar: ' + error.message);
        }
      }
    </script>
  `);
});

// 3. Notificações fake
app.get('/notificacao', (req, res) => {
  const produtosFake = [
    { nome: 'Vestido Longo Floral', cliente: 'Juliana de Recife', link: '/produtos/vestido-longo-floral' },
    { nome: 'Tênis Esportivo', cliente: 'Carlos de São Paulo', link: '/produtos/tenis-esportivo' },
    { nome: 'Camisa Oversized', cliente: 'Mariana de Salvador', link: '/produtos/camisa-oversized' }
  ];
  
  res.json(produtosFake[Math.floor(Math.random() * produtosFake.length)]);
});

// 4. Injetar script (usando API de Scripts)
app.post('/injetar-script', authenticateStore, async (req, res) => {
  try {
    const { token, userId } = req.store;

    // Primeiro tentamos registrar via API de Scripts
    try {
      const scriptResponse = await axios.post(
        `${NUVEMSHOP_API}/${userId}/scripts`,
        {
          src: `${process.env.APP_URL}/widget.js`,
          event: "onload",
          where: "store",
          description: "Poppop - Notificações de prova social"
        },
        { headers: { 'Authentication': `bearer ${token}` } }
      );

      return res.json({ 
        success: true, 
        message: 'Script registrado com sucesso via API de Scripts',
        data: scriptResponse.data
      });
    } catch (apiError) {
      console.log('Falha na API de Scripts, tentando modificação de tema...');
    }

    // Fallback: Modificação de arquivo de tema
    const themes = await axios.get(`${NUVEMSHOP_API}/${userId}/themes`, {
      headers: { 'Authentication': `bearer ${token}` }
    });

    const activeTheme = themes.data.find(t => t.active);
    if (!activeTheme) throw new Error('Nenhum tema ativo encontrado');

    const themeId = activeTheme.id;
    const files = await axios.get(`${NUVEMSHOP_API}/${userId}/themes/${themeId}/files`, {
      headers: { 'Authentication': `bearer ${token}` }
    });

    // Procuramos por arquivos que possam conter a tag </body>
    const targetFiles = files.data.filter(file => 
      file.path.match(/(layout|theme|index)\.(tpl|liquid|html)/i)
    );

    if (targetFiles.length === 0) {
      throw new Error('Nenhum arquivo de tema adequado encontrado');
    }

    // Tentamos modificar cada arquivo até ter sucesso
    for (const file of targetFiles) {
      try {
        const fileContent = await axios.get(`${NUVEMSHOP_API}/${userId}/themes/${themeId}/files/${file.path}`, {
          headers: { 'Authentication': `bearer ${token}` }
        });

        let content = fileContent.data.content;
        if (content.includes(process.env.APP_URL)) {
          continue; // Já contém nosso script
        }

        if (content.includes('</body>')) {
          const newContent = content.replace(
            '</body>', 
            `<script src="${process.env.APP_URL}/widget.js"></script>\n</body>`
          );

          await axios.put(
            `${NUVEMSHOP_API}/${userId}/themes/${themeId}/files/${file.path}`,
            { content: newContent },
            { headers: { 
              'Authentication': `bearer ${token}`,
              'Content-Type': 'application/json'
            }}
          );

          return res.json({ 
            success: true, 
            message: `Script injetado com sucesso no arquivo ${file.path}`,
            file: file.path
          });
        }
      } catch (fileError) {
        console.error(`Erro ao processar arquivo ${file.path}:`, fileError.message);
        continue;
      }
    }

    throw new Error('Não foi possível injetar o script em nenhum arquivo do tema');
  } catch (error) {
    console.error('Erro ao injetar script:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      suggestion: 'Por favor, adicione manualmente o script ao seu tema'
    });
  }
});

// 5. Listar arquivos do tema (para debug)
app.get('/listar-arquivos-tema', authenticateStore, async (req, res) => {
  try {
    const { token, userId } = req.store;

    const themes = await axios.get(`${NUVEMSHOP_API}/${userId}/themes`, {
      headers: { 'Authentication': `bearer ${token}` }
    });

    const activeTheme = themes.data.find(t => t.active);
    if (!activeTheme) throw new Error('Nenhum tema ativo encontrado');

    const files = await axios.get(`${NUVEMSHOP_API}/${userId}/themes/${activeTheme.id}/files`, {
      headers: { 'Authentication': `bearer ${token}` }
    });

    res.json({
      theme: activeTheme,
      files: files.data.map(file => ({
        path: file.path,
        type: file.type,
        size: file.size
      }))
    });
  } catch (error) {
    console.error('Erro ao listar arquivos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Rota para o widget.js
app.get('/widget.js', (req, res) => {
  res.type('application/javascript');
  res.send(`
    (function() {
      console.log('Poppop Widget carregado');
      
      function showNotification(data) {
        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.bottom = '20px';
        popup.style.right = '20px';
        popup.style.padding = '15px';
        popup.style.background = '#fff';
        popup.style.borderRadius = '8px';
        popup.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        popup.style.zIndex = '9999';
        popup.style.maxWidth = '300px';
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
          popup.style.transition = 'opacity 0.5s';
          popup.style.opacity = '0';
          setTimeout(() => popup.remove(), 500);
        }, 5000);
      }
      
      // Busca notificação inicial
      fetch('${process.env.APP_URL}/notificacao')
        .then(res => res.json())
        .then(showNotification);
      
      // Atualiza a cada 30 segundos
      setInterval(() => {
        fetch('${process.env.APP_URL}/notificacao')
          .then(res => res.json())
          .then(showNotification);
      }, 30000);
    })();
  `);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`URL do app: ${process.env.APP_URL}`);
});

// ... (mantenha suas configurações existentes)

// Rota de status - verifica conexão com a Nuvemshop
app.get('/status', async (req, res) => {
  try {
    const { access_token, user_id } = req.query;
    
    if (!access_token || !user_id) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Access token e user ID são necessários' 
      });
    }

    // Testa uma chamada simples à API
    const response = await axios.get(
      `https://api.nuvemshop.com.br/v1/${user_id}/store`,
      {
        headers: {
          'Authentication': `bearer ${access_token}`
        }
      }
    );

    res.json({
      status: 'success',
      message: 'Conexão com a Nuvemshop API está funcionando',
      store: response.data.name,
      url: response.data.url
    });
  } catch (error) {
    console.error('Erro no status check:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: 'Falha na conexão com a Nuvemshop API',
      error: error.response?.data || error.message
    });
  }
});

// Rota de health check básica
app.get('/health', (req, res) => {
  res.json({
    status: 'up',
    app: 'Poppop',
    version: '1.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ... (mantenha o restante do seu código existente)