import { GENEROS, ESTADOS_CONSERVACAO } from './data.js';
import { addMyBook, updateMyBook, getAnyBookById, getSession, isLoggedIn, authReady } from './storage.js';
import { renderNavbar, renderFooter, requireLoginModal } from './navbar.js';
import { showToast } from './toast.js';
import { compressImage } from './image-utils.js';
import { googleBooksApiKey } from './firebase-config.js';

window.addEventListener('unload', () => {});
window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload(); });
await authReady;
renderNavbar('cadastrar-livro.html');
renderFooter();

if (!isLoggedIn()) {
  requireLoginModal();
} else if (!getSession().telefone) {
  // Sem WhatsApp ninguém consegue combinar a troca: pede antes de anunciar.
  showToast('Informe seu WhatsApp', 'Ele é necessário para anunciar. Você será levado às configurações do perfil.');
  setTimeout(() => { window.location.href = 'perfil.html#config'; }, 1800);
}

// Popular selects
const generosSelecionados = new Set();
const generoTrigger = document.getElementById('generoTrigger');
const generoTriggerText = document.getElementById('generoTriggerText');
const generoPanel = document.getElementById('generoPanel');

function atualizarGeneroTrigger() {
  const valores = [...generosSelecionados];
  generoTriggerText.textContent = valores.length ? valores.join(', ') : 'Selecione';
  generoTrigger.classList.toggle('placeholder', valores.length === 0);
}

GENEROS.forEach(g => {
  const option = document.createElement('label');
  option.className = 'custom-select-option';
  option.innerHTML = `<input type="checkbox" value="${g}"> ${g}`;
  option.querySelector('input').addEventListener('change', (e) => {
    if (e.target.checked) generosSelecionados.add(g);
    else generosSelecionados.delete(g);
    atualizarGeneroTrigger();
  });
  generoPanel.appendChild(option);
});
atualizarGeneroTrigger();

generoTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  const abrir = !generoPanel.classList.contains('open');
  generoPanel.classList.toggle('open', abrir);
  generoTrigger.setAttribute('aria-expanded', String(abrir));
});
generoPanel.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', () => {
  generoPanel.classList.remove('open');
  generoTrigger.setAttribute('aria-expanded', 'false');
});

const conservacaoSelect = document.getElementById('estadoConservacao');
ESTADOS_CONSERVACAO.forEach(c => conservacaoSelect.appendChild(new Option(c, c)));

// Textareas crescem conforme o conteúdo, mantendo o visual de campo em pílula
function ajustarAltura(t) { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; }
document.querySelectorAll('.anunciar-textarea').forEach(t => t.addEventListener('input', () => ajustarAltura(t)));

let capaEncontrada = '';

// Extrai só o número digitado no campo de edição, ignorando a máscara "Xª edição" já aplicada
function numeroEdicao() {
  return (document.getElementById('edicao').value.match(/\d+/) || [''])[0];
}

// Mantém o cartão de pré-visualização sincronizado com o que o usuário edita
// no formulário, para que ele possa revisar/ajustar tudo antes de publicar.
function atualizarPreview() {
  document.getElementById('previewCapa').src = capaEncontrada || 'assets/sem-capa.svg';
  document.getElementById('previewCapa').onerror = function() { this.src = 'assets/sem-capa.svg'; };
  document.getElementById('removeCapaBtn').style.display = capaEncontrada ? 'inline-flex' : 'none';
  document.getElementById('previewTitulo').textContent = document.getElementById('titulo').value || 'Título não encontrado';
  document.getElementById('previewAutor').textContent = document.getElementById('autor').value || 'Autor desconhecido';
  const ano = document.getElementById('ano').value;
  const paginas = document.getElementById('paginas').value;
  const edicao = numeroEdicao();
  document.getElementById('previewMeta').textContent = [document.getElementById('editora').value, edicao ? `${edicao}ª edição` : '', ano, paginas ? `${paginas} páginas` : ''].filter(Boolean).join(' · ');
}
['titulo', 'autor', 'editora', 'edicao', 'ano', 'paginas'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    if (document.getElementById('bookPreview').classList.contains('show')) atualizarPreview();
  });
});

// Máscara "Xª edição": mostra só o número enquanto o usuário edita e aplica
// a formatação completa assim que ele termina de preencher o campo (blur).
const edicaoInput = document.getElementById('edicao');
edicaoInput.addEventListener('input', () => { edicaoInput.value = edicaoInput.value.replace(/\D/g, ''); });
edicaoInput.addEventListener('focus', () => { edicaoInput.value = numeroEdicao(); });
edicaoInput.addEventListener('blur', () => {
  const numero = numeroEdicao();
  edicaoInput.value = numero ? `${numero}ª edição` : '';
});
const observacoesInput = document.getElementById('observacoes');
const semDanificacoesCheckbox = document.getElementById('semDanificacoes');
semDanificacoesCheckbox.addEventListener('change', () => {
  observacoesInput.disabled = semDanificacoesCheckbox.checked;
  if (semDanificacoesCheckbox.checked) observacoesInput.value = '';
});

document.getElementById('removeCapaBtn').addEventListener('click', () => {
  capaEncontrada = '';
  atualizarPreview();
  showToast('Capa removida', 'Adicione fotos reais do livro para usar como capa.');
});

// Normaliza a resposta da Open Library para um formato comum
async function buscarNaOpenLibrary(isbn) {
  const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  if (!res.ok) throw new Error('Open Library indisponível');
  const data = await res.json();
  const info = data[`ISBN:${isbn}`];
  if (!info) return null;
  return {
    titulo: info.title || '',
    autores: (info.authors || []).map(a => a.name).join(', '),
    editora: (info.publishers || []).map(p => p.name).join(', '),
    ano: info.publish_date ? (info.publish_date.match(/\d{4}/) || [''])[0] : '',
    paginas: info.number_of_pages || '',
    sinopse: info.notes ? (typeof info.notes === 'string' ? info.notes : info.notes.value) : (info.subtitle || ''),
    capa: info.cover?.large || '',
  };
}

// Fallback: Google Books tem cobertura bem melhor para livros nacionais/brasileiros
async function buscarNoGoogleBooks(isbn) {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${googleBooksApiKey}`);
  if (!res.ok) throw new Error('Google Books indisponível');
  const data = await res.json();
  const item = data.items?.[0]?.volumeInfo;
  if (!item) return null;
  return {
    titulo: item.title || '',
    autores: (item.authors || []).join(', '),
    editora: item.publisher || '',
    ano: item.publishedDate ? (item.publishedDate.match(/\d{4}/) || [''])[0] : '',
    paginas: item.pageCount || '',
    sinopse: item.description || '',
    capa: item.imageLinks?.thumbnail?.replace('http://', 'https://') || '',
  };
}

document.getElementById('isbnSearchBtn').addEventListener('click', async () => {
  const raw = document.getElementById('isbnInput').value.trim().replace(/[^0-9Xx]/g, '');
  const status = document.getElementById('isbnStatus');
  const searchBtn = document.getElementById('isbnSearchBtn');
  if (!raw) { status.textContent = 'Digite um ISBN válido.'; return; }

  status.textContent = 'Buscando informações do livro...';
  document.getElementById('bookPreview').classList.remove('show');
  searchBtn.disabled = true;

  try {
    const [openLibraryInfo, googleInfo] = await Promise.all([
      buscarNaOpenLibrary(raw).catch(() => null),
      buscarNoGoogleBooks(raw).catch(() => null),
    ]);

    const info = openLibraryInfo || googleInfo;
    if (!info) {
      status.textContent = 'Nenhum livro encontrado para esse ISBN. Tente o cadastro manual.';
      return;
    }

    // Um provedor pode achar o livro sem capa/sinopse — completa com o outro.
    const complemento = info === openLibraryInfo ? googleInfo : openLibraryInfo;
    info.sinopse = info.sinopse || complemento?.sinopse || '';
    info.capa = info.capa || complemento?.capa || '';

    document.getElementById('titulo').value = info.titulo;
    document.getElementById('autor').value = info.autores;
    document.getElementById('editora').value = info.editora;
    document.getElementById('ano').value = info.ano;
    document.getElementById('paginas').value = info.paginas;
    document.getElementById('sinopse').value = info.sinopse;
    ajustarAltura(document.getElementById('sinopse'));

    capaEncontrada = info.capa || '';
    atualizarPreview();
    document.getElementById('bookPreview').classList.add('show');

    status.textContent = 'Informações preenchidas automaticamente! Você pode editar qualquer campo abaixo antes de publicar.';
    showToast('Livro encontrado!', 'Confira os dados preenchidos automaticamente.');
  } catch (err) {
    status.textContent = 'Erro ao buscar o livro. Verifique sua conexão ou tente o cadastro manual.';
  } finally {
    searchBtn.disabled = false;
  }
});

// Upload de fotos — comprime para caber no limite de 1MB por documento do Firestore
const photoGrid = document.getElementById('photoGrid');
const photoInput = document.getElementById('photoInput');
const photos = [];

photoInput.addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try {
      photos.push(await compressImage(file));
      renderPhotoGrid();
    } catch { /* ignora arquivo que falhar ao processar */ }
  }
  photoInput.value = '';
});

function renderPhotoGrid() {
  const addSlot = photoGrid.querySelector('label.photo-slot');
  photoGrid.innerHTML = '';
  photos.forEach((src, i) => {
    const slot = document.createElement('div');
    slot.className = 'photo-slot';
    slot.innerHTML = `<img src="${src}" alt="Foto do livro ${i + 1}"><button type="button" class="remove-photo" aria-label="Remover foto">✕</button>`;
    slot.querySelector('.remove-photo').addEventListener('click', () => { photos.splice(i, 1); renderPhotoGrid(); });
    photoGrid.appendChild(slot);
  });
  photoGrid.appendChild(addSlot);
}

// Edição (lápis do "Meu acervo"): cadastrar-livro.html?editar=<id> abre o
// formulário preenchido com o livro, e o botão vira "Republicar".
const editarId = new URLSearchParams(window.location.search).get('editar');
let livroEditado = null;
if (editarId && isLoggedIn()) {
  livroEditado = await getAnyBookById(editarId).catch(() => null);
  if (!livroEditado || livroEditado.ownerId !== getSession().id) {
    showToast('Livro não encontrado', 'Só é possível editar livros do seu acervo.');
    setTimeout(() => { window.location.href = 'acervo.html'; }, 1500);
    livroEditado = null;
  } else {
    preencherFormulario(livroEditado);
  }
}

function preencherFormulario(book) {
  document.title = 'Editar livro — Flowrish';
  const campos = { titulo: book.titulo, autor: book.autor, editora: book.editora, ano: book.ano, paginas: book.paginas, sinopse: book.sinopse, tempoUso: book.tempoUso, observacoes: book.observacoes, nacionalidade: book.nacionalidade, estadoConservacao: book.estadoConservacao };
  Object.entries(campos).forEach(([id, valor]) => { document.getElementById(id).value = valor ?? ''; });
  edicaoInput.value = book.edicao ? `${book.edicao}ª edição` : '';
  book.generos.forEach(g => generosSelecionados.add(g));
  generoPanel.querySelectorAll('input').forEach(input => { input.checked = generosSelecionados.has(input.value); });
  atualizarGeneroTrigger();
  semDanificacoesCheckbox.checked = !!book.semDanificacoes;
  observacoesInput.disabled = semDanificacoesCheckbox.checked;
  document.querySelectorAll('.anunciar-textarea').forEach(ajustarAltura);

  // A capa vinda do ISBN fica fora da lista de fotos (ver o envio abaixo).
  photos.push(...(book.fotos || []).filter(f => f && !f.includes('placehold.co') && !f.includes('sem-capa.svg')));
  if (book.capa && book.capa !== photos[0] && !book.capa.includes('placehold.co') && !book.capa.includes('sem-capa.svg')) {
    capaEncontrada = book.capa;
    atualizarPreview();
    document.getElementById('bookPreview').classList.add('show');
  }
  renderPhotoGrid();
  document.querySelector('#bookForm button[type=submit]').textContent = 'Republicar';
}

// Submissão do formulário
document.getElementById('bookForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const capaFinal = (capaEncontrada && (capaEncontrada.startsWith('http') || capaEncontrada.startsWith('data:')))
    ? capaEncontrada
    : (photos[0] || 'assets/sem-capa.svg');

  const book = {
    titulo: document.getElementById('titulo').value.trim(),
    autor: document.getElementById('autor').value.trim(),
    editora: document.getElementById('editora').value.trim(),
    edicao: Number(numeroEdicao()) || null,
    ano: Number(document.getElementById('ano').value) || null,
    paginas: Number(document.getElementById('paginas').value) || null,
    generos: [...generosSelecionados],
    nacionalidade: document.getElementById('nacionalidade').value,
    sinopse: document.getElementById('sinopse').value.trim(),
    estadoConservacao: document.getElementById('estadoConservacao').value,
    tempoUso: document.getElementById('tempoUso').value.trim(),
    observacoes: document.getElementById('observacoes').value.trim(),
    semDanificacoes: semDanificacoesCheckbox.checked,
    capa: capaFinal,
    fotos: photos.length ? photos : [capaFinal],
  };

  if (!book.titulo || !book.autor || !book.generos.length || !book.nacionalidade || !book.sinopse || !book.estadoConservacao) {
    showToast('Preencha os campos obrigatórios');
    return;
  }

  if ((book.editora || book.edicao || book.ano) && (!book.editora || !book.edicao || !book.ano)) {
    showToast('Preencha editora, edição e ano da edição', 'Ao informar um desses campos, os outros dois também passam a ser obrigatórios.');
    return;
  }

  if (!book.observacoes && !book.semDanificacoes) {
    showToast('Descreva o estado do livro', 'Preencha as observações ou marque "Sem danificações relevantes".');
    return;
  }

  if (!photos.length) {
    showToast('Adicione ao menos uma foto', 'Fotos reais do livro são obrigatórias para anunciar.');
    return;
  }

  const submitBtn = e.target.querySelector('button[type=submit]');
  submitBtn.disabled = true;
  try {
    if (livroEditado) {
      await updateMyBook(livroEditado.id, book);
      showToast('Livro republicado!', 'As alterações já aparecem na Biblioteca.');
      setTimeout(() => window.location.href = 'acervo.html', 900);
      return;
    }
    const saved = await addMyBook(book);
    showToast('Livro publicado!', 'Quem tiver interesse vai falar com você pelo WhatsApp.');
    setTimeout(() => window.location.href = `livro.html?id=${saved.id}`, 900);
  } catch (err) {
    showToast('Erro ao publicar', 'O livro pode ter fotos grandes demais — tente com menos fotos.');
    submitBtn.disabled = false;
  }
});
