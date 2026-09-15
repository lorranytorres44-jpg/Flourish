// Testes das regras de segurança (firestore.rules) contra o emulador do Firestore.
// Rodar com: npm run test:rules  (sobe o emulador, roda e derruba).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, Timestamp } from 'firebase/firestore';

let env;
const ARTHUR = 'arthur';   // dono do livro
const LORRANY = 'lorrany'; // solicitante
const INTRUSO = 'intruso'; // terceiro autenticado

const dbAs = (uid) => env.authenticatedContext(uid).firestore();
const dbAnon = () => env.unauthenticatedContext().firestore();

// Dados iniciais gravados sem passar pelas regras.
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ARTHUR), { nome: 'Arthur', pontos: 10 });
    await setDoc(doc(db, 'users', LORRANY), { nome: 'Lorrany', pontos: 10 });
    await setDoc(doc(db, 'users', LORRANY, 'private', 'agencia'), { nome: 'AC Itaquera', telefone: '(11) 99999-9999' });
    await setDoc(doc(db, 'books', 'b1'), { titulo: 'Elton John', ownerId: ARTHUR, curtidas: 0 });
    await setDoc(doc(db, 'trades', 't1'), {
      bookId: 'b1', ownerId: ARTHUR, requesterId: LORRANY, tipo: 'pontos', status: 'Aceita',
    });
    await setDoc(doc(db, 'trades', 't1', 'messages', 'm1'), { autorId: LORRANY, texto: 'oi' });
    await setDoc(doc(db, 'trades', 'tFinal'), {
      bookId: 'b1', ownerId: ARTHUR, requesterId: LORRANY, tipo: 'pontos', status: 'Finalizada',
      finalizadoEm: Timestamp.fromMillis(Date.now() - 20 * 86400000), // 20 dias atrás
    });
    await setDoc(doc(db, 'trades', 'tFinal', 'messages', 'm1'), { autorId: LORRANY, texto: 'endereço...' });
    await setDoc(doc(db, 'trades', 'tRecente'), {
      bookId: 'b1', ownerId: ARTHUR, requesterId: LORRANY, tipo: 'pontos', status: 'Finalizada',
      finalizadoEm: Timestamp.fromMillis(Date.now() - 2 * 86400000), // 2 dias atrás
    });
    await setDoc(doc(db, 'trades', 'tRecente', 'messages', 'm1'), { autorId: LORRANY, texto: 'endereço...' });
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
  it('só o próprio usuário edita o perfil', async () => {
    await assertSucceeds(updateDoc(doc(dbAs(ARTHUR), 'users', ARTHUR), { bio: 'Leitor' }));
    await assertFails(updateDoc(doc(dbAs(LORRANY), 'users', ARTHUR), { bio: 'hack' }));
  });
  it('o próprio usuário pode apagar o perfil, outros não', async () => {
    await assertFails(deleteDoc(doc(dbAs(LORRANY), 'users', ARTHUR)));
    await assertSucceeds(deleteDoc(doc(dbAs(ARTHUR), 'users', ARTHUR)));
  });
});

describe('dados privados (agência salva, telefone, nome completo)', () => {
  it('só o dono lê e grava users/{uid}/private', async () => {
    await assertSucceeds(getDoc(doc(dbAs(LORRANY), 'users', LORRANY, 'private', 'agencia')));
    await assertSucceeds(setDoc(doc(dbAs(LORRANY), 'users', LORRANY, 'private', 'agencia'), { nome: 'AC Centro' }));
  });
  it('outro usuário (mesmo participante de uma troca) não lê a agência salva', async () => {
    await assertFails(getDoc(doc(dbAs(ARTHUR), 'users', LORRANY, 'private', 'agencia')));
    await assertFails(getDoc(doc(dbAnon(), 'users', LORRANY, 'private', 'agencia')));
  });
});

describe('notificações', () => {
  it('qualquer usuário autenticado pode criar notificação para outro (aviso de troca)', async () => {
    await assertSucceeds(addDoc(collection(dbAs(LORRANY), 'users', ARTHUR, 'notifications'), { titulo: 'Nova proposta', lida: false }));
  });
  it('só o dono lê as próprias notificações', async () => {
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'users', ARTHUR, 'notifications', 'n1'), { titulo: 'x' }));
    await assertSucceeds(getDoc(doc(dbAs(ARTHUR), 'users', ARTHUR, 'notifications', 'n1')));
    await assertFails(getDoc(doc(dbAs(LORRANY), 'users', ARTHUR, 'notifications', 'n1')));
  });
});

describe('livros (books)', () => {
  it('leitura pública; só o dono cria com o próprio ownerId', async () => {
    await assertSucceeds(getDoc(doc(dbAnon(), 'books', 'b1')));
    await assertSucceeds(setDoc(doc(dbAs(ARTHUR), 'books', 'b2'), { titulo: 'Novo', ownerId: ARTHUR }));
    await assertFails(setDoc(doc(dbAs(LORRANY), 'books', 'b3'), { titulo: 'Falso', ownerId: ARTHUR }));
  });
  it('outro usuário só pode mexer em curtidas', async () => {
    await assertSucceeds(updateDoc(doc(dbAs(LORRANY), 'books', 'b1'), { curtidas: 1 }));
    await assertFails(updateDoc(doc(dbAs(LORRANY), 'books', 'b1'), { titulo: 'Alterado' }));
  });
  it('só o dono apaga', async () => {
    await assertFails(deleteDoc(doc(dbAs(LORRANY), 'books', 'b1')));
    await assertSucceeds(deleteDoc(doc(dbAs(ARTHUR), 'books', 'b1')));
  });
});

describe('trocas (trades)', () => {
  it('só o solicitante cria a troca em seu nome', async () => {
    await assertSucceeds(addDoc(collection(dbAs(LORRANY), 'trades'), { bookId: 'b1', ownerId: ARTHUR, requesterId: LORRANY }));
    await assertFails(addDoc(collection(dbAs(INTRUSO), 'trades'), { bookId: 'b1', ownerId: ARTHUR, requesterId: LORRANY }));
  });
  it('as duas partes leem e atualizam; terceiros não', async () => {
    await assertSucceeds(getDoc(doc(dbAs(ARTHUR), 'trades', 't1')));
    await assertSucceeds(getDoc(doc(dbAs(LORRANY), 'trades', 't1')));
    await assertFails(getDoc(doc(dbAs(INTRUSO), 'trades', 't1')));
    await assertSucceeds(updateDoc(doc(dbAs(LORRANY), 'trades', 't1'), { agenciaRetirada: { nome: 'AC Itaquera' } }));
    await assertSucceeds(updateDoc(doc(dbAs(ARTHUR), 'trades', 't1'), { status: 'Postada' }));
    await assertFails(updateDoc(doc(dbAs(INTRUSO), 'trades', 't1'), { status: 'Cancelada' }));
  });
  it('troca nunca é apagada', async () => {
    await assertFails(deleteDoc(doc(dbAs(ARTHUR), 'trades', 't1')));
  });
});

describe('chat da troca (messages)', () => {
  it('só as partes leem e enviam mensagens', async () => {
    await assertSucceeds(getDoc(doc(dbAs(ARTHUR), 'trades', 't1', 'messages', 'm1')));
    await assertSucceeds(addDoc(collection(dbAs(LORRANY), 'trades', 't1', 'messages'), { autorId: LORRANY, texto: 'olá' }));
    await assertFails(getDoc(doc(dbAs(INTRUSO), 'trades', 't1', 'messages', 'm1')));
    await assertFails(addDoc(collection(dbAs(INTRUSO), 'trades', 't1', 'messages'), { autorId: INTRUSO, texto: 'spam' }));
  });
  it('não dá para apagar mensagens de troca em andamento', async () => {
    await assertFails(deleteDoc(doc(dbAs(LORRANY), 'trades', 't1', 'messages', 'm1')));
  });
  it('nem de troca finalizada há menos de 14 dias', async () => {
    await assertFails(deleteDoc(doc(dbAs(LORRANY), 'trades', 'tRecente', 'messages', 'm1')));
  });
  it('depois de 14 dias da finalização, as partes podem apagar', async () => {
    await assertSucceeds(deleteDoc(doc(dbAs(LORRANY), 'trades', 'tFinal', 'messages', 'm1')));
    await assertFails(deleteDoc(doc(dbAs(INTRUSO), 'trades', 'tFinal', 'messages', 'm1')));
  });
});

describe('avaliações (ratings)', () => {
  it('leitura pública; só o autor cria a própria avaliação', async () => {
    await assertSucceeds(addDoc(collection(dbAs(LORRANY), 'ratings'), { tradeId: 't1', autorId: LORRANY, avaliadoId: ARTHUR, nota: 5 }));
    await assertFails(addDoc(collection(dbAs(LORRANY), 'ratings'), { tradeId: 't1', autorId: ARTHUR, avaliadoId: LORRANY, nota: 1 }));
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'ratings', 'r1'), { autorId: LORRANY }));
    await assertSucceeds(getDoc(doc(dbAnon(), 'ratings', 'r1')));
  });
});
