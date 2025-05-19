import { useEffect, useState } from 'react';

export default function PopupNotification() {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    const buscarNotificacao = async () => {
      try {
        const response = await fetch('http://localhost:3001/notificacao');
        const data = await response.json();
        setDados(data);

        // Oculta após 6 segundos
        setTimeout(() => setDados(null), 6000);
      } catch (err) {
        console.error('Erro ao buscar notificação:', err);
      }
    };

    // Primeira chamada
    buscarNotificacao();

    // Chama uma nova notificação a cada 15 segundos
    const intervalo = setInterval(buscarNotificacao, 15000);

    return () => clearInterval(intervalo);
  }, []);

  if (!dados) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '24px',
      backgroundColor: '#fff',
      padding: '16px',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      border: '1px solid #ddd',
      maxWidth: '320px',
      zIndex: 9999,
      animation: 'fadein 0.5s ease-in-out'
    }}>
      <div style={{ fontSize: '14px' }}>
        🔥 <strong>{dados.cliente}</strong> acabou de ver o produto:
        <br />
        👗 <strong>{dados.nome}</strong>
        <br />
        👉 <a href={dados.link} style={{ color: '#0070f3', textDecoration: 'underline' }}>Ver produto</a>
      </div>
    </div>
  );
}
