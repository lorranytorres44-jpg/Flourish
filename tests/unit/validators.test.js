import { describe, it, expect } from 'vitest';
import { maskTelefone, isValidTelefone, whatsappUrl } from '../../js/validators.js';

describe('telefone (WhatsApp)', () => {
  it('formata celular e fixo', () => {
    expect(maskTelefone('11999998888')).toBe('(11) 99999-8888');
    expect(maskTelefone('1133334444')).toBe('(11) 3333-4444');
  });
  it('formata enquanto digita', () => {
    expect(maskTelefone('1')).toBe('1');
    expect(maskTelefone('11')).toBe('11');
    expect(maskTelefone('119')).toBe('(11) 9');
    expect(maskTelefone('119999')).toBe('(11) 9999');
    expect(maskTelefone('1199999')).toBe('(11) 9999-9');
  });
  it('exige DDD e número completo', () => {
    expect(isValidTelefone('(11) 99999-8888')).toBe(true);
    expect(isValidTelefone('(11) 3333-4444')).toBe(true);
    expect(isValidTelefone('99999-8888')).toBe(false); // sem DDD
    expect(isValidTelefone('(11) 9999')).toBe(false);
  });
});

describe('link do WhatsApp', () => {
  it('usa o número com +55 e a mensagem codificada', () => {
    expect(whatsappUrl('(11) 99999-8888', 'Olá! Tenho interesse em "Dom Casmurro"'))
      .toBe('https://wa.me/5511999998888?text=Ol%C3%A1!%20Tenho%20interesse%20em%20%22Dom%20Casmurro%22');
  });
  it('sem mensagem, só abre a conversa', () => {
    expect(whatsappUrl('11999998888')).toBe('https://wa.me/5511999998888');
  });
});
