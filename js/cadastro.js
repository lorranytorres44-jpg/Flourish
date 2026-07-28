import { signUpWithEmail, loginWithGoogle, isLoggedIn, authReady } from './storage.js';
import { showToast } from './toast.js';
import { initTheme } from './theme.js';
import { bindPasswordStrength, isStrongPassword } from './auth.js';

initTheme();
await authReady;
if (isLoggedIn()) window.location.href = 'dashboard.html';

bindPasswordStrength(document.getElementById('cadSenha'), document.getElementById('strengthBar'));

function mensagemErro(err) {
  const map = {
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Tente entrar.',
    'auth/invalid-email': 'Digite um e-mail válido.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/popup-closed-by-user': 'Cadastro cancelado.',
  };
  return map[err?.code] || 'Não foi possível criar a conta. Tente novamente.';
}

document.getElementById('cadastroForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('nome').value.trim();
  const email = document.getElementById('cadEmail').value.trim();
  const senha = document.getElementById('cadSenha').value;
  const confirmarSenha = document.getElementById('cadConfirmarSenha').value;
  const confirmarSenhaHint = document.getElementById('confirmarSenhaHint');
  confirmarSenhaHint.style.display = 'none';

  if (!nome || !email || !senha || !confirmarSenha) {
    showToast('Preencha todos os campos', '', 'error');
    return;
  }

  if (senha !== confirmarSenha) {
    confirmarSenhaHint.style.display = 'block';
    showToast('As senhas não coincidem', 'Digite a mesma senha nos dois campos.', 'error');
    return;
  }

  if (!isStrongPassword(senha)) {
    showToast('Senha fraca', 'Use pelo menos 10 caracteres com letra maiúscula, número e símbolo para uma senha forte.', 'error');
    return;
  }

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await signUpWithEmail({ nome, email, senha });
    showToast('Conta criada!', 'Você ganhou 5 pontos de boas-vindas. Enviamos um e-mail de verificação — complete seu perfil quando quiser.', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 900);
  } catch (err) {
    showToast('Erro ao criar conta', mensagemErro(err), 'error');
    btn.disabled = false;
  }
});

document.getElementById('googleSignupBtn').addEventListener('click', async () => {
  try {
    await loginWithGoogle();
    showToast('Cadastro com Google', 'Conta criada e conectada com sucesso.', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 700);
  } catch (err) {
    showToast('Erro ao cadastrar com Google', mensagemErro(err), 'error');
  }
});
