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

export function passwordStrengthScore(senha) {
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
    <div class="modal-header">
      <h3 id="forgotTitle">Recuperar senha</h3>
      <button class="btn-icon modal-close" data-modal-close aria-label="Fechar">✕</button>
    </div>
    <p>Informe o mesmo e-mail cadastrado na sua conta e enviaremos um link para redefinir sua senha.</p>
    <form id="forgotForm">
      <div class="field">
        <label for="forgotEmail">E-mail</label>
        <input class="input" type="email" id="forgotEmail" required placeholder="voce@email.com">
      </div>
      <button type="submit" class="btn btn-primary btn-block">Enviar link de recuperação</button>
    </form>
    <p class="text-muted" style="font-size:0.85rem;margin-top:14px;margin-bottom:0;">Não recebeu o e-mail? Verifique sua caixa de Spam.</p>
  `, { labelledBy: 'forgotTitle', onMount: (overlay, close) => {
    overlay.querySelector('#forgotForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = overlay.querySelector('#forgotEmail').value.trim();
      try {
        await sendPasswordReset(email);
        close();
        showToast('Link enviado!', 'Verifique sua caixa de entrada para redefinir a senha.', 'success');
      } catch {
        showToast('Não foi possível enviar', 'Verifique se o e-mail está correto.', 'error');
      }
    });
  }});
}
