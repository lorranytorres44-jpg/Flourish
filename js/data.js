// ============================================
// Listas fixas usadas nos formulários e filtros
// ============================================

export const GENEROS = [
  'Romance', 'Ficção Científica', 'Fantasia', 'Suspense', 'Terror',
  'Biografia', 'Autoajuda', 'História', 'Poesia', 'Infantil',
  'Young Adult', 'Clássicos', 'Quadrinhos/HQ', 'Negócios', 'Filosofia'
];

export const ESTADOS_CONSERVACAO = ['Novo', 'Seminovo', 'Usado'];

// Livros cadastrados antes do suporte a múltiplos gêneros só têm o campo
// "genero" (string); os novos têm "generos" (array). Centraliza a leitura
// para o resto do app não precisar saber da diferença.
export function bookGeneros(book) {
  if (!book) return [];
  return book.generos || (book.genero ? [book.genero] : []);
}
