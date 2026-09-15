// Máscaras e validações de formulário (sem DOM), usadas no modal da agência de
// retirada e testadas em tests/unit/validators.test.js.

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

// 00000-000
export function maskCep(value) {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function isValidCep(value) {
  return onlyDigits(value).length === 8;
}

// (11) 99999-9999 ou (11) 9999-9999
export function maskTelefone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d.length > 10
    ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

// DDD + número (fixo com 8 ou celular com 9 dígitos).
export function isValidTelefone(value) {
  const n = onlyDigits(value).length;
  return n === 10 || n === 11;
}

// Nome e sobrenome, como no documento apresentado na agência.
export function isNomeCompleto(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length >= 2;
}

// Sinopse obrigatória (não pode ser vazia)
export function isValidSinopse(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

