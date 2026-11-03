// Avisos do site aparecem na caixa de aviso nativa do navegador (alert).
export function showToast(titulo, texto = '') {
  alert(texto ? `${titulo}\n\n${texto}` : titulo);
}
