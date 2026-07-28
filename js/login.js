import { loginWithEmail, loginWithGoogle, isLoggedIn, authReady, sendPasswordReset } from './storage.js';
import { showToast } from './toast.js';
import { initTheme } from './theme.js';
import { openForgotPasswordModal } from './auth.js';

initTheme();
await authReady;
if (isLoggedIn()) window.location.href = 'dashboard.html';

function mensagemErro(err) {
  const map = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Não encontramos uma conta com esse e-mail.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    'auth/popup-closed-by-user': 'Login cancelado.',
  };
  return map[err?.code] || 'Não foi possível entrar. Verifique os dados e tente novamente.';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;
  if (!email || !senha) return;

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await loginWithEmail({ email, senha });
    showToast('Login realizado!', 'Bem-vindo(a) de volta.', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 500);
  } catch (err) {
    showToast('Erro ao entrar', mensagemErro(err), 'error');
    btn.disabled = false;
  }
});

document.getElementById('googleLoginBtn').addEventListener('click', async () => {
  try {
    await loginWithGoogle();
    showToast('Login com Google', 'Conta conectada com sucesso.', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 500);
  } catch (err) {
    showToast('Erro ao entrar com Google', mensagemErro(err), 'error');
  }
});

document.getElementById('forgotBtn').addEventListener('click', () => openForgotPasswordModal(sendPasswordReset));
