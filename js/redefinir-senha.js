import { verifyResetCode, confirmReset } from './storage.js';
import { showToast } from './toast.js';
import { initTheme } from './theme.js';
import { bindPasswordStrength, isStrongPassword } from './auth.js';

initTheme();

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode');
const oobCode = params.get('oobCode');

const subtitle = document.getElementById('redefinirSubtitle');
const form = document.getElementById('redefinirForm');
const invalidBox = document.getElementById('redefinirInvalido');

function mensagemErro(err) {
  const map = {
    'auth/expired-action-code': 'Esse link expirou. Solicite um novo na tela de login.',
    'auth/invalid-action-code': 'Esse link já foi usado ou é inválido. Solicite um novo na tela de login.',
    'auth/user-disabled': 'Esta conta foi desativada.',
    'auth/user-not-found': 'Não encontramos a conta associada a este link.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  };
  return map[err?.code] || 'Não foi possível redefinir a senha. Tente novamente.';
}

if (mode !== 'resetPassword' || !oobCode) {
  subtitle.textContent = 'Link inválido ou incompleto.';
  invalidBox.style.display = 'block';
} else {
  try {
    const email = await verifyResetCode(oobCode);
    subtitle.textContent = `Defina uma nova senha para ${email}.`;
    form.style.display = 'block';
  } catch (err) {
    subtitle.textContent = mensagemErro(err);
    invalidBox.style.display = 'block';
  }
}

bindPasswordStrength(document.getElementById('novaSenha'), document.getElementById('strengthBar'));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const novaSenha = document.getElementById('novaSenha').value;
  const confirmarNovaSenha = document.getElementById('confirmarNovaSenha').value;
  const hint = document.getElementById('confirmarNovaSenhaHint');
  hint.style.display = 'none';

  if (novaSenha !== confirmarNovaSenha) {
    hint.style.display = 'block';
    showToast('As senhas não coincidem', 'Digite a mesma senha nos dois campos.', 'error');
    return;
  }

  if (!isStrongPassword(novaSenha)) {
    showToast('Senha fraca', 'Use pelo menos 10 caracteres com letra maiúscula, número e símbolo para uma senha forte.', 'error');
    return;
  }

  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await confirmReset(oobCode, novaSenha);
    showToast('Senha redefinida!', 'Você já pode entrar com a nova senha.', 'success');
    setTimeout(() => window.location.href = 'login.html', 900);
  } catch (err) {
    showToast('Erro ao redefinir senha', mensagemErro(err), 'error');
    btn.disabled = false;
  }
});
