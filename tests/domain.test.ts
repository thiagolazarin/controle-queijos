import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, formatDate, formatMoney, isValidDate, summarizeOrders, todayInSaoPaulo, validateOrderInput } from '../src/lib/domain.ts';

test('10 queijos custam R$ 200,00, sem aceitar preço do cliente', () => {
  const input = validateOrderInput({ quantity: '10', deliveryDate: '2026-11-02' }, '2026-11-01');
  assert.equal(input.quantity * 20, 200);
  assert.equal(formatMoney(200), 'R$\u00a0200,00');
});

test('quantidade precisa ser inteira, positiva e limitada', () => {
  for (const quantity of ['0', '-1', '1.5', '', '1e2', '100001', NaN, null, true]) {
    assert.throws(() => validateOrderInput({ quantity, deliveryDate: '2026-11-02' }, '2026-11-01'));
  }
});

test('rejeita datas passadas e datas inexistentes', () => {
  for (const deliveryDate of ['2026-10-31', '2026-02-30', '2026-13-01', '01/11/2026', '0000-01-01', 'infinity', '']) {
    assert.throws(() => validateOrderInput({ quantity: '1', deliveryDate }, '2026-11-01'));
  }
  assert.equal(isValidDate('2028-02-29'), true);
  assert.equal(validateOrderInput({ quantity: '1', deliveryDate: '2026-11-01' }, '2026-11-01').quantity, 1);
});

test('regra de hoje e apresentação preservam o dia em São Paulo', () => {
  assert.equal(todayInSaoPaulo(new Date('2026-11-02T02:59:59Z')), '2026-11-01');
  assert.equal(todayInSaoPaulo(new Date('2026-11-02T03:00:00Z')), '2026-11-02');
  assert.equal(formatDate('2026-11-02'), '02/11/2026');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('resumo diário exclui cancelados e preserva o histórico', () => {
  const orders = [
    { quantity: 10, total_price: 200, cancelled_at: null },
    { quantity: 5, total_price: 100, cancelled_at: null },
    { quantity: 20, total_price: 400, cancelled_at: '2026-11-01T12:00:00Z' },
  ];
  assert.deepEqual(summarizeOrders(orders), { quantity: 15, amount: 300, count: 2 });
  assert.equal(orders.length, 3);
});

test('observações têm limite e espaços são removidos', () => {
  assert.equal(validateOrderInput({ quantity: '1', deliveryDate: '2026-11-01', notes: '  Recepção  ' }, '2026-11-01').notes, 'Recepção');
  assert.throws(() => validateOrderInput({ quantity: '1', deliveryDate: '2026-11-01', notes: 'x'.repeat(1001) }, '2026-11-01'));
});

test('edição histórica só aceita a mesma data passada verificada no servidor', () => {
  const original = '2026-10-20';
  assert.equal(validateOrderInput({ quantity: '5', deliveryDate: original }, '2026-11-01', original).deliveryDate, original);
  assert.throws(() => validateOrderInput({ quantity: '5', deliveryDate: '2026-10-21' }, '2026-11-01', original));
  assert.throws(() => validateOrderInput({ quantity: '5', deliveryDate: original }, '2026-11-01'));
});
