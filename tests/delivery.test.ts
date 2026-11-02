import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDeliveryAddress, validateDeliveryEstimate } from '../src/lib/domain.ts';

test('endereço é obrigatório em pedidos novos e mantém linhas úteis da entrega', () => {
  assert.equal(validateDeliveryAddress('  Rua das Flores, 10\nCentro  '), 'Rua das Flores, 10\nCentro');
  for (const value of [null, undefined, '', '   ', 123, true, { address: 'Rua A' }]) {
    assert.throws(() => validateDeliveryAddress(value));
  }
});

test('endereço tem limite de 500 caracteres sem truncar a localização', () => {
  assert.equal(validateDeliveryAddress('a'.repeat(500))?.length, 500);
  assert.throws(() => validateDeliveryAddress('a'.repeat(501)), /500/);
});

test('compatibilidade legada permite ausência só quando explicitamente solicitada', () => {
  assert.equal(validateDeliveryAddress(null, { required: false }), null);
  assert.equal(validateDeliveryAddress('   ', { required: false }), null);
  assert.equal(validateDeliveryAddress('Rua A, 1', { required: false }), 'Rua A, 1');
  assert.throws(() => validateDeliveryAddress('a'.repeat(501), { required: false }));
});

test('previsão vazia representa horário a combinar e pode ser removida', () => {
  for (const value of [null, undefined, '', ' \n ']) assert.equal(validateDeliveryEstimate(value), null);
});

test('previsão aceita período ou faixa de horário sem inventar horário exato', () => {
  assert.equal(validateDeliveryEstimate('Pela manhã'), 'Pela manhã');
  assert.equal(validateDeliveryEstimate('  Entre 9h  e\n11h  '), 'Entre 9h e 11h');
  assert.equal(validateDeliveryEstimate('À tarde'), 'À tarde');
});

test('previsão rejeita tipos inválidos e conteúdo acima de 120 caracteres', () => {
  assert.equal(validateDeliveryEstimate('a'.repeat(120))?.length, 120);
  for (const value of [true, 12, {}, ['9h'], 'a'.repeat(121)]) assert.throws(() => validateDeliveryEstimate(value));
});
