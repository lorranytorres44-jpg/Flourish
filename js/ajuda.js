import { renderNavbar, renderFooter } from './navbar.js';
import { initTheme } from './theme.js';
import { authReady, getSession } from './storage.js';
import { showToast } from './toast.js';

// Pegue esses 3 valores no painel do EmailJS:
// Service ID  -> "Serviços de e-mail"
// Template ID -> "Modelos de e-mail" (o template "Contact Us")
// Public Key  -> "Conta" -> Chaves de API
const EMAILJS_SERVICE_ID = 'service_tuc8gz9';
const EMAILJS_TEMPLATE_ID = 'template_39mhb4w';
const EMAILJS_PUBLIC_KEY = 'bcGVmaXDQMLwyHWSQ';

initTheme();
await authReady;
renderNavbar('ajuda.html');
renderFooter();

emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

const session = getSession();
if (session) {
  document.getElementById('ajudaNome').value = session.nome || '';
  document.getElementById('ajudaEmail').value = session.email || '';
}

document.getElementById('ajudaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('ajudaSubmitBtn');
  const nome = document.getElementById('ajudaNome').value.trim();
  const email = document.getElementById('ajudaEmail').value.trim();
  const mensagem = document.getElementById('ajudaMensagem').value.trim();

  btn.disabled = true;
  btn.textContent = 'Enviando...';
  try {
    // Nomes de variáveis batendo com o template "Contact Us" do EmailJS:
    // {{title}}, {{name}}, {{email}}, {{message}}, {{time}}.
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      title: 'Central de Ajuda',
      name: nome,
      email,
      message: mensagem,
      time: new Date().toLocaleString('pt-BR'),
    });
    showToast('Mensagem enviada!', 'Vamos responder no seu e-mail em breve.', 'success');
    e.target.reset();
  } catch (err) {
    showToast('Não foi possível enviar', 'Tente novamente em instantes.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar mensagem';
  }
});
