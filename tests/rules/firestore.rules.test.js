// Testes das regras de segurança (firestore.rules) contra o emulador do Firestore.
// Rodar com: npm run test:rules  (sobe o emulador, roda e derruba).
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let env;
const ARTHUR = 'arthur';   // dono do livro
const LORRANY = 'lorrany'; // interessada no livro

const dbAs = (uid) => env.authenticatedContext(uid).firestore();
const dbAnon = () => env.unauthenticatedContext().firestore();

// Dados iniciais gravados sem passar pelas regras.
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ARTHUR), { nome: 'Arthur' });
    await setDoc(doc(db, 'users', LORRANY), { nome: 'Lorrany' });
    await setDoc(doc(db, 'users', ARTHUR, 'contato', 'whatsapp'), { telefone: '(11) 99999-8888' });
    await setDoc(doc(db, 'books', 'b1'), { titulo: 'Elton John', ownerId: ARTHUR, curtidas: 0 });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-flowrish',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => { await env.clearFirestore(); await seed(); });

describe('perfis (users)', () => {
  it('qualquer um lê o perfil público', async () => {
    await assertSucceeds(getDoc(doc(dbAnon(), 'users', ARTHUR)));
  });
  it('só o próprio usuário cria, edita e apaga o perfil', async () => {
    await assertSucceeds(setDoc(doc(dbAs('novo'), 'users', 'novo'), { nome: 'Novo' }));
    await assertFails(setDoc(doc(dbAs(LORRANY), 'users', 'outro'), { nome: 'Falso' }));
    await assertSucceeds(updateDoc(doc(dbAs(ARTHUR), 'users', ARTHUR), { bio: 'Leitor' }));
    await assertFails(updateDoc(doc(dbAs(LORRANY), 'users', ARTHUR), { bio: 'hack' }));
    await assertFails(deleteDoc(doc(dbAs(LORRANY), 'users', ARTHUR)));
    await assertSucceeds(deleteDoc(doc(dbAs(ARTHUR), 'users', ARTHUR)));
  });
});

describe('WhatsApp (users/{uid}/contato/whatsapp)', () => {
  it('quem está logado lê; visitante sem login não', async () => {
    await assertSucceeds(getDoc(doc(dbAs(LORRANY), 'users', ARTHUR, 'contato', 'whatsapp')));
    await assertFails(getDoc(doc(dbAnon(), 'users', ARTHUR, 'contato', 'whatsapp')));
  });
  it('só o dono grava, no formato (11) 99999-9999', async () => {
    const meu = doc(dbAs(LORRANY), 'users', LORRANY, 'contato', 'whatsapp');
    await assertSucceeds(setDoc(meu, { telefone: '(21) 98888-7777' }));
    await assertSucceeds(setDoc(meu, { telefone: '(21) 3333-4444' }));
    await assertFails(setDoc(meu, { telefone: '21988887777' }));
    await assertFails(setDoc(meu, { telefone: '(21) 98888-7777', extra: 1 }));
    await assertFails(setDoc(doc(dbAs(LORRANY), 'users', ARTHUR, 'contato', 'whatsapp'), { telefone: '(21) 98888-7777' }));
    await assertFails(setDoc(doc(dbAs(LORRANY), 'users', LORRANY, 'contato', 'outro'), { telefone: '(21) 98888-7777' }));
  });
});

describe('favoritos', () => {
  it('só o dono lê e grava os próprios favoritos', async () => {
    await assertSucceeds(setDoc(doc(dbAs(LORRANY), 'users', LORRANY, 'favorites', 'b1'), {}));
    await assertFails(setDoc(doc(dbAs(LORRANY), 'users', ARTHUR, 'favorites', 'b1'), {}));
    await assertFails(getDoc(doc(dbAs(ARTHUR), 'users', LORRANY, 'favorites', 'b1')));
  });
});

describe('livros (books)', () => {
  it('leitura pública; só o dono cria com o próprio ownerId', async () => {
    await assertSucceeds(getDoc(doc(dbAnon(), 'books', 'b1')));
    await assertSucceeds(setDoc(doc(dbAs(LORRANY), 'books', 'b2'), { titulo: 'X', ownerId: LORRANY }));
    await assertFails(setDoc(doc(dbAs(LORRANY), 'books', 'b3'), { titulo: 'X', ownerId: ARTHUR }));
  });
  it('outro usuário só pode mexer em curtidas; o dono não troca o ownerId', async () => {
    await assertSucceeds(updateDoc(doc(dbAs(LORRANY), 'books', 'b1'), { curtidas: 1 }));
    await assertFails(updateDoc(doc(dbAs(LORRANY), 'books', 'b1'), { titulo: 'hack' }));
    await assertSucceeds(updateDoc(doc(dbAs(ARTHUR), 'books', 'b1'), { titulo: 'Novo título' }));
    await assertFails(updateDoc(doc(dbAs(ARTHUR), 'books', 'b1'), { ownerId: LORRANY }));
  });
  it('só o dono apaga', async () => {
    await assertFails(deleteDoc(doc(dbAs(LORRANY), 'books', 'b1')));
    await assertSucceeds(deleteDoc(doc(dbAs(ARTHUR), 'books', 'b1')));
  });
});

describe('avaliações de perfil (ratings)', () => {
  const avaliacao = (extra = {}) => ({ avaliadoId: ARTHUR, autorId: LORRANY, nota: 5, comentario: 'Combinou tudo certinho', criadoEm: 'agora', ...extra });
  const id = `${ARTHUR}_${LORRANY}`;

  it('leitura pública', async () => {
    await assertSucceeds(getDoc(doc(dbAnon(), 'ratings', id)));
  });
  it('quem está logado avalia outro perfil uma vez, sem editar depois; pode apagar a própria', async () => {
    const ref = doc(dbAs(LORRANY), 'ratings', id);
    await assertSucceeds(setDoc(ref, avaliacao({ comentario: '' })));
    await assertFails(setDoc(ref, avaliacao({ nota: 3 })));
    await assertSucceeds(deleteDoc(ref));
  });
  it('não avalia sem login, a si mesmo, em nome de outro ou com outro id', async () => {
    await assertFails(setDoc(doc(dbAnon(), 'ratings', id), avaliacao()));
    await assertFails(setDoc(doc(dbAs(LORRANY), 'ratings', `${LORRANY}_${LORRANY}`), avaliacao({ avaliadoId: LORRANY })));
    await assertFails(setDoc(doc(dbAs(LORRANY), 'ratings', `${LORRANY}_${ARTHUR}`), avaliacao({ avaliadoId: LORRANY, autorId: ARTHUR })));
    await assertFails(setDoc(doc(dbAs(LORRANY), 'ratings', 'qualquer'), avaliacao()));
  });
  it('nota de 1 a 5, comentário de até 500 letras, sem campos extras e só para perfil existente', async () => {
    const ref = doc(dbAs(LORRANY), 'ratings', id);
    await assertFails(setDoc(ref, avaliacao({ nota: 0 })));
    await assertFails(setDoc(ref, avaliacao({ nota: 6 })));
    await assertFails(setDoc(ref, avaliacao({ nota: 4.5 })));
    await assertFails(setDoc(ref, avaliacao({ comentario: 'a'.repeat(501) })));
    await assertFails(setDoc(ref, avaliacao({ extra: 1 })));
    await assertFails(setDoc(doc(dbAs(LORRANY), 'ratings', `fantasma_${LORRANY}`), avaliacao({ avaliadoId: 'fantasma' })));
  });
  it('o dono do perfil responde uma vez; ninguém mais responde nem mexe na nota', async () => {
    await assertSucceeds(setDoc(doc(dbAs(LORRANY), 'ratings', id), avaliacao()));
    await assertFails(updateDoc(doc(dbAs(LORRANY), 'ratings', id), { resposta: 'eu mesma', respostaEm: 'agora' }));
    await assertFails(updateDoc(doc(dbAs(ARTHUR), 'ratings', id), { nota: 1 }));
    await assertFails(updateDoc(doc(dbAs(ARTHUR), 'ratings', id), { resposta: '', respostaEm: 'agora' }));
    await assertFails(updateDoc(doc(dbAs(ARTHUR), 'ratings', id), { resposta: 'a'.repeat(501), respostaEm: 'agora' }));
    await assertSucceeds(updateDoc(doc(dbAs(ARTHUR), 'ratings', id), { resposta: 'Obrigado!', respostaEm: 'agora' }));
    await assertFails(updateDoc(doc(dbAs(ARTHUR), 'ratings', id), { resposta: 'Mudei de ideia', respostaEm: 'depois' }));
  });
  it('ninguém apaga a avaliação de outra pessoa', async () => {
    await assertSucceeds(setDoc(doc(dbAs(LORRANY), 'ratings', id), avaliacao()));
    await assertFails(deleteDoc(doc(dbAs(ARTHUR), 'ratings', id)));
  });
});
