import { describe, it, expect } from 'vitest';
import {
  normalizeTrackingCode, isValidTrackingCode, trackingUrl, agenciaResumo, agenciaMapUrl,
} from '../../js/correios.js';

describe('código de rastreio dos Correios', () => {
  it('aceita o formato AA123456789BR', () => {
    expect(isValidTrackingCode('AA123456789BR')).toBe(true);
    expect(isValidTrackingCode('QB987654321BR')).toBe(true);
  });

  it('normaliza espaços e minúsculas antes de validar', () => {
    expect(normalizeTrackingCode(' aa 123456789 br ')).toBe('AA123456789BR');
    expect(isValidTrackingCode('aa123456789br')).toBe(true);
  });

  it('rejeita códigos incompletos ou fora do padrão', () => {
    expect(isValidTrackingCode('AA12345678BR')).toBe(false);   // 8 dígitos
    expect(isValidTrackingCode('AA1234567890BR')).toBe(false); // 10 dígitos
    expect(isValidTrackingCode('A1123456789BR')).toBe(false);  // prefixo com número
    expect(isValidTrackingCode('AA123456789B')).toBe(false);   // sufixo incompleto
    expect(isValidTrackingCode('')).toBe(false);
    expect(isValidTrackingCode(null)).toBe(false);
  });

  it('monta o link do site dos Correios com o código normalizado', () => {
    expect(trackingUrl('aa123456789br')).toBe('https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR');
  });
});

describe('agência de retirada', () => {
  const agencia = { nome: 'AC Itaquera', endereco: 'Rua Padre Viegas, 349', bairro: 'Itaquera', cidade: 'São Paulo', estado: 'SP' };

  it('resume nome e endereço em uma linha', () => {
    expect(agenciaResumo(agencia)).toBe('AC Itaquera — Rua Padre Viegas, 349 · Itaquera · São Paulo/SP');
  });

  it('omite partes ausentes sem deixar separadores soltos', () => {
    expect(agenciaResumo({ nome: 'AC Centro', cidade: 'Taubaté', estado: 'SP' })).toBe('AC Centro — Taubaté/SP');
    expect(agenciaResumo({ nome: 'AC Centro' })).toBe('AC Centro');
    expect(agenciaResumo(null)).toBe('');
  });

  it('gera link do Google Maps só quando há nome', () => {
    expect(agenciaMapUrl(agencia)).toContain('https://www.google.com/maps/search/?api=1&query=');
    expect(decodeURIComponent(agenciaMapUrl(agencia))).toContain('AC Itaquera, Rua Padre Viegas, 349, Itaquera, São Paulo, SP');
    expect(agenciaMapUrl({})).toBe('');
  });
});
