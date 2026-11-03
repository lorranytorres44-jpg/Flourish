import { signUpWithEmail, isLoggedIn, authReady } from './storage.js';
import { showToast } from './toast.js';
import { bindPasswordStrength, isStrongPassword } from './auth.js';
import { maskTelefone, isValidTelefone } from './validators.js';
import { initTheme } from './theme.js';

initTheme();
await authReady;
if (isLoggedIn()) window.location.href = 'perfil.html';

bindPasswordStrength(document.getElementById('cadSenha'), document.getElementById('strengthBar'));
document.getElementById('cadTelefone').addEventListener('input', (e) => { e.target.value = maskTelefone(e.target.value); });

function mensagemErro(err) {
  const map = {
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Tente entrar.',
    'auth/invalid-email': 'Digite um e-mail válido.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  };
  return map[err?.code] || 'Não foi possível criar a conta. Tente novamente.';
}

document.getElementById('cadastroForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('nome').value.trim();
  const email = document.getElementById('cadEmail').value.trim();
  const telefone = document.getElementById('cadTelefone').value.trim();
  const senha = document.getElementById('cadSenha').value;
  const confirmarSenha = document.getElementById('cadConfirmarSenha').value;
  const confirmarSenhaHint = document.getElementById('confirmarSenhaHint');
  confirmarSenhaHint.style.display = 'none';
  const emailHint = document.getElementById('emailHint');
  emailHint.style.display = 'none';

  if (!nome || !email || !telefone || !senha || !confirmarSenha) {
    showToast('Preencha todos os campos');
    return;
  }

  // Exige texto antes e depois do @ (ex.: nome@dominio).
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    emailHint.style.display = 'block';
    showToast('Email inválido', 'O email precisa ter um @, como nome@exemplo.com.');
    return;
  }

  if (!isValidTelefone(telefone)) {
    showToast('WhatsApp inválido', 'Informe o DDD e o número, como (11) 99999-9999.');
    document.getElementById('cadTelefone').focus();
    return;
  }

  if (!document.getElementById('confirmaIdade').checked) {
    showToast('Idade mínima', 'O Flowrish é destinado a pessoas com 16 anos ou mais.');
    return;
  }

  if (!document.getElementById('aceiteTermos').checked) {
    showToast('Aceite os termos', 'Para criar a conta, concorde com os termos de uso e a política de privacidade.');
    return;
  }

  if (senha !== confirmarSenha) {
    confirmarSenhaHint.style.display = 'block';
    showToast('As senhas não coincidem', 'Digite a mesma senha nos dois campos.');
    return;
  }

  if (!isStrongPassword(senha)) {
    showToast('Senha fraca', 'Use pelo menos 10 caracteres com letra maiúscula, número e símbolo para uma senha forte.');
    return;
  }

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await signUpWithEmail({ nome, email, senha, telefone });
    showToast('Conta criada!', 'Enviamos um e-mail de verificação — complete seu perfil quando quiser.');
    setTimeout(() => window.location.href = 'perfil.html', 900);
  } catch (err) {
    showToast('Erro ao criar conta', mensagemErro(err));
    btn.disabled = false;
  }
});
