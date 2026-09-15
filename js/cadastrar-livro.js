import { GENEROS, ESTADOS_CONSERVACAO } from './data.js';
import { addMyBook, isLoggedIn, authReady } from './storage.js';
import { renderNavbar, renderFooter, requireLoginModal } from './navbar.js';
import { initTheme } from './theme.js';
import { showToast } from './toast.js';
import { compressImage } from './image-utils.js';
import { googleBooksApiKey } from './firebase-config.js';

initTheme();
window.addEventListener('unload', () => {});
window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload(); });
await authReady;
renderNavbar('cadastrar-livro.html');
renderFooter();

if (!isLoggedIn()) {
  requireLoginModal('Faça login para anunciar um livro.');
  return;
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

// Alternância manual / ISBN
const isbnSection = document.getElementById('isbnSection');
document.querySelectorAll('.mode-switch button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-switch button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    isbnSection.style.display = btn.dataset.mode === 'isbn' ? 'block' : 'none';
  });
});

let capaEncontrada = '';

// Extrai só o número digitado no campo de edição, ignorando a máscara "Xª edição" já aplicada
function numeroEdicao() {
  return (document.getElementById('edicao').value.match(/\d+/) || [''])[0];
}

// Mantém o cartão de pré-visualização sincronizado com o que o usuário edita
// no formulário, para que ele possa revisar/ajustar tudo antes de publicar.
function atualizarPreview() {
  document.getElementById('previewCapa').src = capaEncontrada || 'https://placehold.co/300x420/A8CFA8/2F4A2F?text=Sem+capa';
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
  showToast('Capa removida', 'Adicione fotos reais do livro para usar como capa.', 'info', 2500);
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

    capaEncontrada = info.capa || '';
    atualizarPreview();
    document.getElementById('bookPreview').classList.add('show');

    status.textContent = 'Informações preenchidas automaticamente! Você pode editar qualquer campo abaixo antes de publicar.';
    showToast('Livro encontrado!', 'Confira os dados preenchidos automaticamente.', 'success');
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

// Submissão do formulário
document.getElementById('bookForm').addEventListener('submit', async (e) => {
  e.preventDefault();
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
    capa: capaEncontrada || photos[0] || 'https://placehold.co/300x420/A8CFA8/2F4A2F?text=Sem+capa',
    fotos: photos.length ? photos : [capaEncontrada || 'https://placehold.co/300x420/A8CFA8/2F4A2F?text=Sem+capa'],
    pontosNecessarios: 3,
  };

  if (!book.titulo || !book.autor || !book.generos.length || !book.nacionalidade || !book.estadoConservacao || !book.sinopse) {
    showToast('Preencha os campos obrigatórios', 'Título, autor, gênero, nacionalidade, estado de conservação e sinopse são obrigatórios.', 'error');
    return;
  }

  if ((book.editora || book.edicao || book.ano) && (!book.editora || !book.edicao || !book.ano)) {
    showToast('Preencha editora, edição e ano da edição', 'Ao informar um desses campos, os outros dois também passam a ser obrigatórios.', 'error');
    return;
  }

  if (!book.observacoes && !book.semDanificacoes) {
    showToast('Descreva o estado do livro', 'Preencha as observações ou marque "Sem danificações relevantes".', 'error');
    return;
  }

  if (!photos.length) {
    showToast('Adicione ao menos uma foto', 'Fotos reais do livro são obrigatórias para anunciar.', 'error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type=submit]');
  submitBtn.disabled = true;
  try {
    const saved = await addMyBook(book);
    showToast('Livro publicado!', 'Você ganhou +1 ponto por anunciar um livro.', 'success');
    setTimeout(() => window.location.href = `livro.html?id=${saved.id}`, 900);
  } catch (err) {
    showToast('Erro ao publicar', 'O livro pode ter fotos grandes demais — tente com menos fotos.', 'error');
    submitBtn.disabled = false;
  }
});
