import { describe, it, expect } from 'vitest';
import { maskCep, isValidCep, maskTelefone, isValidTelefone, isNomeCompleto, isValidSinopse } from '../../js/validators.js';

describe('CEP da agência', () => {
  it('aplica a máscara 00000-000 enquanto digita', () => {
    expect(maskCep('0')).toBe('0');
    expect(maskCep('08220')).toBe('08220');
    expect(maskCep('082209')).toBe('08220-9');
    expect(maskCep('08220959')).toBe('08220-959');
  });
  it('ignora letras e corta o excesso', () => {
    expect(maskCep('08220-959123')).toBe('08220-959');
    expect(maskCep('ab08220cd959')).toBe('08220-959');
  });
  it('valida só com 8 dígitos', () => {
    expect(isValidCep('08220-959')).toBe(true);
    expect(isValidCep('08220959')).toBe(true);
    expect(isValidCep('08220-95')).toBe(false);
    expect(isValidCep('')).toBe(false);
  });
});

describe('telefone do destinatário', () => {
  it('formata celular (11 dígitos) e fixo (10 dígitos)', () => {
    expect(maskTelefone('11999998888')).toBe('(11) 99999-8888');
    expect(maskTelefone('1133334444')).toBe('(11) 3333-4444');
  });
  it('formata progressivamente enquanto digita', () => {
    expect(maskTelefone('1')).toBe('1');
    expect(maskTelefone('11')).toBe('11');
    expect(maskTelefone('119')).toBe('(11) 9');
    expect(maskTelefone('119999')).toBe('(11) 9999');
    expect(maskTelefone('1199999')).toBe('(11) 9999-9');
  });
  it('exige DDD + número completo', () => {
    expect(isValidTelefone('(11) 99999-8888')).toBe(true);
    expect(isValidTelefone('(11) 3333-4444')).toBe(true);
    expect(isValidTelefone('99999-8888')).toBe(false); // sem DDD
    expect(isValidTelefone('(11) 9999')).toBe(false);
  });
});

describe('nome completo do destinatário', () => {
  it('precisa de nome e sobrenome', () => {
    expect(isNomeCompleto('Lorrany Torres')).toBe(true);
    expect(isNomeCompleto('  Arthur   Sanches  ')).toBe(true);
    expect(isNomeCompleto('Lorrany')).toBe(false);
    expect(isNomeCompleto('   ')).toBe(false);
    expect(isNomeCompleto(undefined)).toBe(false);
  });
});

describe('sinopse obrigatória', () => {
  it('exige texto preenchido', () => {
    expect(isValidSinopse('Uma história envolvente sobre magia e mistério.')).toBe(true);
    expect(isValidSinopse('')).toBe(false);
    expect(isValidSinopse('   ')).toBe(false);
    expect(isValidSinopse(null)).toBe(false);
    expect(isValidSinopse(undefined)).toBe(false);
  });
});
