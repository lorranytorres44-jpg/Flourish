import {
  signUpWithEmail, loginWithGoogle, isLoggedIn, authReady,
  checkEmailVerified, resendVerificationEmail, getAuthCurrentUser
} from './storage.js';
import { showToast } from './toast.js';
import { initTheme } from './theme.js';
import { bindPasswordStrength, isStrongPassword } from './auth.js';
import { isValidEmail, suggestEmailCorrection } from './validators.js';

initTheme();
await authReady;

const step1Panel = document.getElementById('step1Panel');
const step2Panel = document.getElementById('step2Panel');
const step1Badge = document.getElementById('step1Badge');
const step2Badge = document.getElementById('step2Badge');
const stepperLine = document.getElementById('stepperLine');
const step1Indicator = document.getElementById('step1Indicator');
const step2Indicator = document.getElementById('step2Indicator');
const displayTargetEmail = document.getElementById('displayTargetEmail');
const btnOpenGmail = document.getElementById('btnOpenGmail');
const btnCheckVerified = document.getElementById('btnCheckVerified');
const btnResendEmail = document.getElementById('btnResendEmail');
const btnBackToEdit = document.getElementById('btnBackToEdit');
const cadEmailInput = document.getElementById('cadEmail');
const emailSuggestionHint = document.getElementById('emailSuggestionHint');
const suggestedEmailText = document.getElementById('suggestedEmailText');

// Se já estiver logado e verificado, vai para o dashboard; se não verificado, mostra a Etapa 2
const currentAuth = getAuthCurrentUser();
if (isLoggedIn()) {
  if (currentAuth?.emailVerified || currentAuth?.providerData[0]?.providerId === 'google.com') {
    window.location.href = 'dashboard.html';
  } else if (currentAuth?.email) {
    showStep2(currentAuth.email);
  }
}

bindPasswordStrength(document.getElementById('cadSenha'), document.getElementById('strengthBar'));

// Sugestão de correção para erros comuns de digitação de domínio (ex: @gmai.com -> @gmail.com)
cadEmailInput.addEventListener('input', () => {
  const val = cadEmailInput.value.trim();
  const suggestion = suggestEmailCorrection(val);
  if (suggestion) {
    suggestedEmailText.textContent = suggestion;
    emailSuggestionHint.style.display = 'block';
  } else {
    emailSuggestionHint.style.display = 'none';
  }
});

emailSuggestionHint.addEventListener('click', () => {
  if (suggestedEmailText.textContent) {
    cadEmailInput.value = suggestedEmailText.textContent;
    emailSuggestionHint.style.display = 'none';
    cadEmailInput.focus();
  }
});

function showStep1() {
  step1Panel.style.display = 'block';
  step2Panel.style.display = 'none';
  step1Badge.textContent = '1';
  step1Badge.style.background = 'var(--primary)';
  step1Badge.style.color = '#fff';
  step1Indicator.style.color = 'var(--primary)';
  step1Indicator.style.fontWeight = '600';
  stepperLine.style.background = 'var(--border)';
  step2Badge.style.background = 'var(--border)';
  step2Badge.style.color = 'var(--text-muted)';
  step2Indicator.style.color = 'var(--text-muted)';
  step2Indicator.style.fontWeight = '500';
}

function showStep2(email) {
  step1Panel.style.display = 'none';
  step2Panel.style.display = 'block';
  step1Badge.textContent = '✓';
  step1Badge.style.background = 'var(--sage-dark)';
  step1Badge.style.color = '#fff';
  step1Indicator.style.color = 'var(--text-muted)';
  step1Indicator.style.fontWeight = '500';
  stepperLine.style.background = 'var(--primary)';
  step2Badge.style.background = 'var(--primary)';
  step2Badge.style.color = '#fff';
  step2Indicator.style.color = 'var(--primary)';
  step2Indicator.style.fontWeight = '600';

  displayTargetEmail.textContent = email;

  const isGmail = /@(gmail\.com|googlemail\.com)$/i.test(email);
  if (isGmail) {
    btnOpenGmail.style.display = 'inline-flex';
  } else {
    btnOpenGmail.style.display = 'none';
  }
}

btnBackToEdit.addEventListener('click', () => {
  showStep1();
});

let resendTimer = null;
btnResendEmail.addEventListener('click', async () => {
  btnResendEmail.disabled = true;
  try {
    await resendVerificationEmail();
    showToast('E-mail reenviado', 'Um novo link de confirmação foi enviado para sua caixa de entrada.', 'success');
    let secondsLeft = 30;
    btnResendEmail.textContent = `Aguarde ${secondsLeft}s para reenviar`;
    clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(resendTimer);
        btnResendEmail.disabled = false;
        btnResendEmail.textContent = '🔄 Reenviar e-mail de verificação';
      } else {
        btnResendEmail.textContent = `Aguarde ${secondsLeft}s para reenviar`;
      }
    }, 1000);
  } catch (err) {
    showToast('Erro ao reenviar', err.message || 'Tente novamente em instantes.', 'error');
    btnResendEmail.disabled = false;
  }
});

btnCheckVerified.addEventListener('click', async () => {
  btnCheckVerified.disabled = true;
  btnCheckVerified.textContent = 'Verificando...';
  try {
    const verified = await checkEmailVerified();
    if (verified) {
      showToast('E-mail verificado com sucesso!', 'Conta confirmada! Redirecionando para a sua área...', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 800);
    } else {
      showToast('Ainda não confirmado', 'Não detectamos o clique no link de confirmação. Verifique sua caixa de entrada (ou spam) e tente novamente.', 'warning');
      btnCheckVerified.disabled = false;
      btnCheckVerified.textContent = '✓ Já cliquei no link / Confirmar';
    }
  } catch (err) {
    showToast('Erro na verificação', err.message || '', 'error');
    btnCheckVerified.disabled = false;
    btnCheckVerified.textContent = '✓ Já cliquei no link / Confirmar';
  }
});

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
  const aceiteTermos = document.getElementById('aceiteTermos');
  confirmarSenhaHint.style.display = 'none';

  if (!nome || !email || !senha || !confirmarSenha) {
    showToast('Preencha todos os campos', '', 'error');
    return;
  }

  if (!aceiteTermos.checked) {
    showToast('Termos de Uso', 'Você precisa concordar com os Termos de Uso e Política de Privacidade para continuar.', 'warning');
    return;
  }

  if (!isValidEmail(email)) {
    showToast('E-mail inválido', 'Digite um endereço de e-mail com formato válido (ex: seuemail@gmail.com).', 'error');
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

  const btn = document.getElementById('btnSubmitStep1');
  btn.disabled = true;
  btn.textContent = 'Criando conta...';
  try {
    await signUpWithEmail({ nome, email, senha });
    showToast('Conta criada!', 'Enviamos um e-mail de confirmação. Prossiga com a verificação.', 'success');
    showStep2(email);
  } catch (err) {
    showToast('Erro ao criar conta', mensagemErro(err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Avançar para verificação →';
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
