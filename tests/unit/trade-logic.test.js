import { describe, it, expect } from 'vitest';
import {
  TRADE_STATUS, STATUS_FINAL, STATUS_CHEGADA,
  isDualTrade, normalizeTrade, getEnvios, envioTitulo, envioField, aggregateStatus, nextEnvioStatus,
} from '../../js/trade-logic.js';

const base = {
  id: 't1', bookId: 'b1', bookTitulo: 'Elton John - A biografia',
  ownerId: 'arthur', donoNome: 'Arthur Sanches',
  requesterId: 'lorrany', requesterNome: 'Lorrany Torres',
};
const pontos = (extra = {}) => ({ ...base, tipo: 'pontos', status: 'Aceita', ...extra });
const proposta = (extra = {}) => ({
  ...base, tipo: 'proposta', status: 'Aceita',
  livrosOferecidos: ['b2'], livrosOferecidosTitulos: ['A Elite'],
  envios: {
    dono: { status: 'Aceita', agenciaRetirada: null, rastreio: { codigo: '', transportadora: '' } },
    solicitante: { status: 'Aceita', agenciaRetirada: null, rastreio: { codigo: '', transportadora: '' } },
  },
  ...extra,
});

describe('tipo de troca', () => {
  it('só a proposta (livro por livro) tem dois envios', () => {
    expect(isDualTrade(pontos())).toBe(false);
    expect(isDualTrade(proposta())).toBe(true);
    expect(isDualTrade(null)).toBe(false);
  });
});

describe('getEnvios', () => {
  it('troca por pontos: um envio, do dono para o solicitante, com os dados da própria troca', () => {
    const envios = getEnvios(pontos({ agenciaRetirada: { nome: 'AC Guará' }, rastreio: { codigo: 'AA123456789BR' } }));
    expect(envios).toHaveLength(1);
    expect(envios[0]).toMatchObject({
      key: 'dono', remetenteId: 'arthur', destinatarioId: 'lorrany',
      status: 'Aceita', titulo: 'Elton John - A biografia',
      agenciaRetirada: { nome: 'AC Guará' }, rastreio: { codigo: 'AA123456789BR' },
    });
  });

  it('livro por livro: dois envios em sentidos opostos, cada um com seu status', () => {
    const t = proposta();
    t.envios.dono.status = 'Postada';
    const [dono, solicitante] = getEnvios(t);
    expect(dono).toMatchObject({ key: 'dono', remetenteId: 'arthur', destinatarioId: 'lorrany', status: 'Postada' });
    expect(solicitante).toMatchObject({ key: 'solicitante', remetenteId: 'lorrany', destinatarioId: 'arthur', status: 'Aceita', titulo: 'A Elite' });
  });

  it('antes de aceita (ou cancelada) o status da troca vale para os dois envios', () => {
    expect(getEnvios(proposta({ status: 'Solicitação enviada' })).map(e => e.status)).toEqual(['Solicitação enviada', 'Solicitação enviada']);
    expect(getEnvios(proposta({ status: 'Cancelada' })).map(e => e.status)).toEqual(['Cancelada', 'Cancelada']);
  });
});

describe('envioTitulo', () => {
  it('usa os títulos guardados dos livros oferecidos', () => {
    expect(envioTitulo(proposta({ livrosOferecidosTitulos: ['A Elite', 'A Seleção'] }), 'solicitante')).toBe('A Elite, A Seleção');
  });
  it('cai no texto genérico quando a troca antiga não tem os títulos', () => {
    expect(envioTitulo(proposta({ livrosOferecidosTitulos: undefined }), 'solicitante')).toBe('o livro de Lorrany Torres');
  });
});

describe('envioField', () => {
  it('aponta para o nível da troca (pontos) ou para dentro do envio (livro por livro)', () => {
    expect(envioField(pontos(), 'dono', 'status')).toBe('status');
    expect(envioField(proposta(), 'dono', 'status')).toBe('envios.dono.status');
    expect(envioField(proposta(), 'solicitante', 'rastreio.codigo')).toBe('envios.solicitante.rastreio.codigo');
  });
});

describe('aggregateStatus', () => {
  it('a troca fica no status do envio mais atrasado', () => {
    expect(aggregateStatus([{ status: 'Postada' }, { status: 'Aceita' }])).toBe('Aceita');
    expect(aggregateStatus([{ status: STATUS_CHEGADA }, { status: 'Em rota' }])).toBe('Em rota');
  });
  it('só fica Finalizada quando os dois envios foram finalizados', () => {
    expect(aggregateStatus([{ status: STATUS_FINAL }, { status: STATUS_CHEGADA }])).toBe(STATUS_CHEGADA);
    expect(aggregateStatus([{ status: STATUS_FINAL }, { status: STATUS_FINAL }])).toBe(STATUS_FINAL);
  });
});

describe('nextEnvioStatus', () => {
  it('avança uma etapa por vez', () => {
    expect(nextEnvioStatus('Aceita')).toBe('Postada');
    expect(nextEnvioStatus('Postada')).toBe('Em rota');
    expect(nextEnvioStatus('Em rota')).toBe(STATUS_CHEGADA);
  });
  it('quem envia não passa de "Chegada na agência" — finalizar é de quem recebe', () => {
    expect(nextEnvioStatus(STATUS_CHEGADA)).toBe(STATUS_CHEGADA);
  });
  it('a ordem das etapas é a exibida no card', () => {
    expect(TRADE_STATUS.slice(0, 6)).toEqual(['Solicitação enviada', 'Aceita', 'Postada', 'Em rota', 'Chegada na agência', 'Finalizada']);
  });
});

describe('normalizeTrade (trocas antigas salvas no Firestore)', () => {
  it('traduz os nomes antigos de status', () => {
    expect(normalizeTrade(pontos({ status: 'Em análise' })).status).toBe('Solicitação enviada');
    expect(normalizeTrade(pontos({ status: 'Em transporte' })).status).toBe('Em rota');
    expect(normalizeTrade(pontos({ status: 'Entregue' })).status).toBe(STATUS_FINAL);
  });

  it('livro por livro sem envios: o que estava na troca vira o envio do dono', () => {
    const t = normalizeTrade({
      ...base, tipo: 'proposta', status: 'Postada',
      agenciaRetirada: { nome: 'AC Guará' }, rastreio: { codigo: 'AA123456789BR', transportadora: 'Correios' },
    });
    expect(t.envios.dono).toMatchObject({ status: 'Postada', agenciaRetirada: { nome: 'AC Guará' }, rastreio: { codigo: 'AA123456789BR' } });
    expect(t.envios.solicitante).toMatchObject({ status: 'Aceita', agenciaRetirada: null });
  });

  it('livro por livro ainda em "Solicitação enviada" começa com os dois envios em Aceita', () => {
    const t = normalizeTrade({ ...base, tipo: 'proposta', status: 'Solicitação enviada' });
    expect(t.envios.dono.status).toBe('Aceita');
    expect(t.envios.solicitante.status).toBe('Aceita');
  });

  it('não mexe em envios já gravados', () => {
    const t = normalizeTrade(proposta({ envios: { dono: { status: 'Em rota' }, solicitante: { status: STATUS_FINAL } } }));
    expect(t.envios.dono.status).toBe('Em rota');
    expect(t.envios.solicitante.status).toBe(STATUS_FINAL);
    expect(t.envios.dono.rastreio).toEqual({ codigo: '', transportadora: '' }); // campos faltantes ganham o padrão
  });
});
