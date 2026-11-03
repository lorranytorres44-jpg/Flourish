import { showToast } from './toast.js';
import { openModal } from './modal.js';

export const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export const NOMES_ESTADOS = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará',
  PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

export function populateEstados(selectEl) {
  ESTADOS_BR.forEach(uf => {
    const opt = document.createElement('option');
    opt.value = uf; opt.textContent = uf;
    selectEl.appendChild(opt);
  });
}

function passwordStrengthScore(senha) {
  let score = 0;
  if (senha.length >= 6) score += 1;
  if (senha.length >= 10) score += 1;
  if (/[A-Z]/.test(senha)) score += 1;
  if (/[0-9]/.test(senha)) score += 1;
  if (/[^A-Za-z0-9]/.test(senha)) score += 1;
  return score;
}

export function isStrongPassword(senha) {
  return passwordStrengthScore(senha) >= 4;
}

export function bindPasswordStrength(inputEl, barEl) {
  inputEl.addEventListener('input', () => {
    const score = passwordStrengthScore(inputEl.value);
    const pct = (score / 5) * 100;
    const colors = ['#C5654C', '#C5654C', '#D9A441', '#D9A441', '#6FA779', '#6FA779'];
    barEl.style.width = pct + '%';
    barEl.style.background = colors[score];
  });
}

export function openForgotPasswordModal(sendPasswordReset) {
  openModal(`
    <h3 id="forgotTitle" class="senha-modal-titulo">Recuperar a senha</h3>
    <p class="senha-modal-texto">Informe o mesmo email cadastrado na sua conta e enviaremos um link para redefinir a senha.</p>
    <form id="forgotForm">
      <input class="senha-modal-input" type="email" id="forgotEmail" required aria-label="Email" autocomplete="email">
      <button type="submit" class="senha-modal-enviar">Enviar</button>
    </form>
    <p class="senha-modal-obs">Não recebeu o email? Verifique sua caixa de spam.</p>
  `, { labelledBy: 'forgotTitle', className: 'senha-modal', onMount: (overlay, close) => {
    overlay.querySelector('#forgotForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = overlay.querySelector('#forgotEmail').value.trim();
      try {
        await sendPasswordReset(email);
        close();
        showToast('Link enviado!', 'Verifique sua caixa de entrada para redefinir a senha.');
      } catch {
        showToast('Não foi possível enviar', 'Verifique se o e-mail está correto.');
      }
    });
  }});
}
