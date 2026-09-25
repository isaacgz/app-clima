const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluarRiesgo } = require('../services/riesgo');

const BASE = new Date('2026-10-03T18:00:00Z');
const h = horas => new Date(BASE.getTime() + horas * 3600 * 1000);

const bloque = (horaInicio, extra = {}) => ({
    inicio: h(horaInicio),
    fin: h(horaInicio + 3),
    condicionId: 800,
    desc: 'cielo claro',
    temp: 24,
    probLluvia: 0,
    lluviaMm: 0,
    nieveMm: 0,
    rafagaKmh: 10,
    ...extra
});

test('cielo despejado es riesgo bajo', () => {
    const r = evaluarRiesgo([bloque(0), bloque(3)], h(0), h(4));
    assert.equal(r.nivel, 'bajo');
    assert.equal(r.enRiesgo, false);
    assert.deepEqual(r.motivos, []);
    assert.equal(r.bloques.length, 2);
});

test('tormenta eléctrica es riesgo alto', () => {
    const r = evaluarRiesgo([bloque(0, { condicionId: 211, probLluvia: 0.9, lluviaMm: 4 })], h(0), h(2));
    assert.equal(r.nivel, 'alto');
    assert.equal(r.enRiesgo, true);
    assert.ok(r.motivos.includes('Tormenta eléctrica'));
});

test('lluvia fuerte por milímetros es riesgo alto', () => {
    const r = evaluarRiesgo([bloque(0, { condicionId: 501, probLluvia: 1, lluviaMm: 9 })], h(0), h(2));
    assert.equal(r.nivel, 'alto');
    assert.match(r.motivos[0], /Lluvia fuerte/);
});

test('lluvia ligera con probabilidad media es riesgo medio', () => {
    const r = evaluarRiesgo([bloque(0, { condicionId: 500, probLluvia: 0.55, lluviaMm: 0.4 })], h(0), h(2));
    assert.equal(r.nivel, 'medio');
    assert.deepEqual(r.motivos, ['Probabilidad de lluvia de 55%']);
});

test('lluvia muy probable y acumulada sube a riesgo alto', () => {
    const bloques = [
        bloque(0, { condicionId: 500, probLluvia: 0.85, lluviaMm: 1.2 }),
        bloque(3, { condicionId: 500, probLluvia: 0.9, lluviaMm: 1.5 })
    ];
    const r = evaluarRiesgo(bloques, h(0), h(6));
    assert.equal(r.nivel, 'alto');
    assert.deepEqual(r.motivos, ['Lluvia muy probable (90%)']);
});

test('rachas de viento suben el riesgo según umbral', () => {
    assert.equal(evaluarRiesgo([bloque(0, { rafagaKmh: 45 })], h(0), h(2)).nivel, 'medio');
    assert.equal(evaluarRiesgo([bloque(0, { rafagaKmh: 70 })], h(0), h(2)).nivel, 'alto');
});

test('solo cuenta los bloques que se cruzan con el evento', () => {
    const bloques = [bloque(0), bloque(3, { condicionId: 202 }), bloque(6)];
    const r = evaluarRiesgo(bloques, h(0), h(3));
    assert.equal(r.nivel, 'bajo');
    assert.equal(r.bloques.length, 1);
});

test('fuera del rango del pronóstico es desconocido', () => {
    const r = evaluarRiesgo([bloque(0)], h(24 * 10), h(24 * 10 + 3));
    assert.equal(r.nivel, 'desconocido');
    assert.equal(r.enRiesgo, false);
});
