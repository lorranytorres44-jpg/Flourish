// Telefone (WhatsApp) do usuário: máscara, validação e link do WhatsApp (sem
// DOM), usados no cadastro, no perfil e na página do livro; testados em
// tests/unit/validators.test.js.

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
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

// Conversa no WhatsApp com o número (brasileiro, +55) e a mensagem já escrita.
export function whatsappUrl(telefone, mensagem = '') {
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : '';
  return `https://wa.me/55${onlyDigits(telefone)}${texto}`;
}
