// ============================================
// Dados mockados — futura substituição por chamadas a backend (Node.js/Firebase)
// ============================================

export const GENEROS = [
  'Romance', 'Ficção Científica', 'Fantasia', 'Suspense', 'Terror',
  'Biografia', 'Autoajuda', 'História', 'Poesia', 'Infantil',
  'Young Adult', 'Clássicos', 'Quadrinhos/HQ', 'Negócios', 'Filosofia'
];

// Livros cadastrados antes do suporte a múltiplos gêneros só têm o campo
// "genero" (string); os novos têm "generos" (array). Centraliza a leitura
// para o resto do app não precisar saber da diferença.
export function bookGeneros(book) {
  return book.generos || (book.genero ? [book.genero] : []);
}

export const ESTADOS_CONSERVACAO = ['Novo', 'Seminovo', 'Usado'];

export const STATS = {
  livrosTrocados: 8420,
  usuarios: 3150,
  trocasConcluidas: 5230,
};
