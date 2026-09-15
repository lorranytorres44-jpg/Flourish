// Utilidades dos Correios no navegador: código de rastreio e exibição da agência
// de retirada. O acompanhamento do objeto é feito no site dos Correios (trackingUrl).
//
// A agência é informada pelo próprio solicitante (consultando o buscador oficial
// dos Correios) — não existe API pública de agências sem contrato.

export const CORREIOS_BUSCA_AGENCIAS_URL = 'https://buscacepinter.correios.com.br/app/clique_retire/index.php';

export const TRACKING_CODE_RE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
export function normalizeTrackingCode(codigo) {
  return String(codigo || '').replace(/\s/g, '').toUpperCase();
}
export function isValidTrackingCode(codigo) {
  return TRACKING_CODE_RE.test(normalizeTrackingCode(codigo));
}
export function trackingUrl(codigo) {
  return `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(normalizeTrackingCode(codigo))}`;
}

// Texto de uma linha para exibir a agência (card da troca, chat, notificação).
export function agenciaResumo(agencia) {
  if (!agencia) return '';
  const local = [agencia.endereco, agencia.bairro, [agencia.cidade, agencia.estado].filter(Boolean).join('/')]
    .filter(Boolean).join(' · ');
  return local ? `${agencia.nome} — ${local}` : agencia.nome;
}

// Link para conferir a agência no Google Maps, pelo endereço digitado.
export function agenciaMapUrl(agencia) {
  if (!agencia?.nome) return '';
  const query = [agencia.nome, agencia.endereco, agencia.bairro, agencia.cidade, agencia.estado].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
