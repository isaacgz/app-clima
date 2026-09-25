const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluarRiesgo } = require('../services/riesgo');

const BASE = new Date('2026-10-03T18:00:00Z');
const h = horas => new Date(BASE.getTime() + horas * 3600 * 1000);

const bloque = (horaInicio, extra = {}) => ({
    inicio: h(horaInicio),
    fin: h(horaInicio + 3),
    condicion: 'despejado',
    desc: 'despejado',
    temp: 24,
    probLluvia: 0,
    probTormenta: null,
    lluviaMm: 0,
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
    const r = evaluarRiesgo([bloque(0, { condicion: 'tormenta', probLluvia: 0.9, lluviaMm: 4 })], h(0), h(2));
    assert.equal(r.nivel, 'alto');
    assert.equal(r.enRiesgo, true);
    assert.ok(r.motivos.includes('Tormenta eléctrica'));
});

test('probabilidad de tormenta alta es riesgo alto aunque el símbolo no la muestre', () => {
    const r = evaluarRiesgo([bloque(0, { condicion: 'nublado', probTormenta: 0.4 })], h(0), h(2));
    assert.equal(r.nivel, 'alto');
    assert.deepEqual(r.motivos, ['Probabilidad de tormenta eléctrica de 40%']);
});

test('lluvia fuerte por intensidad es riesgo alto', () => {
    const r = evaluarRiesgo([bloque(0, { condicion: 'lluvia', probLluvia: 1, lluviaMm: 9 })], h(0), h(2));
    assert.equal(r.nivel, 'alto');
    assert.deepEqual(r.motivos, ['Lluvia fuerte (hasta 3.0 mm/h)']);
});

test('la intensidad se calcula según la duración del bloque', () => {
    const bloqueDe6h = { ...bloque(0), fin: h(6), condicion: 'lluvia', probLluvia: 0.6, lluviaMm: 9 };
    const r = evaluarRiesgo([bloqueDe6h], h(0), h(2));
    assert.equal(r.nivel, 'medio');
});

test('lluvia ligera con probabilidad media es riesgo medio', () => {
    const r = evaluarRiesgo([bloque(0, { condicion: 'lluvia', probLluvia: 0.55, lluviaMm: 0.4 })], h(0), h(2));
    assert.equal(r.nivel, 'medio');
    assert.deepEqual(r.motivos, ['Probabilidad de lluvia de 55%']);
});

test('lluvia muy probable y acumulada sube a riesgo alto', () => {
    const bloques = [
        bloque(0, { condicion: 'lluvia', probLluvia: 0.85, lluviaMm: 1.2 }),
        bloque(3, { condicion: 'lluvia', probLluvia: 0.9, lluviaMm: 1.5 })
    ];
    const r = evaluarRiesgo(bloques, h(0), h(6));
    assert.equal(r.nivel, 'alto');
    assert.deepEqual(r.motivos, ['Lluvia muy probable (90%)']);
});

test('lluvia sin probabilidad reportada es riesgo medio', () => {
    const r = evaluarRiesgo([bloque(0, { condicion: 'lluvia', probLluvia: null, lluviaMm: 0.3 })], h(0), h(1));
    assert.equal(r.nivel, 'medio');
    assert.deepEqual(r.motivos, ['Se pronostica lluvia']);
});

test('nieve fuerte es riesgo alto', () => {
    assert.equal(evaluarRiesgo([bloque(0, { condicion: 'nieve_fuerte' })], h(0), h(2)).nivel, 'alto');
    assert.equal(evaluarRiesgo([bloque(0, { condicion: 'nieve' })], h(0), h(2)).nivel, 'medio');
});

test('rachas de viento suben el riesgo según umbral', () => {
    assert.equal(evaluarRiesgo([bloque(0, { rafagaKmh: 45 })], h(0), h(2)).nivel, 'medio');
    assert.equal(evaluarRiesgo([bloque(0, { rafagaKmh: 70 })], h(0), h(2)).nivel, 'alto');
});

test('solo cuenta los bloques que se cruzan con el evento', () => {
    const bloques = [bloque(0), bloque(3, { condicion: 'tormenta' }), bloque(6)];
    const r = evaluarRiesgo(bloques, h(0), h(3));
    assert.equal(r.nivel, 'bajo');
    assert.equal(r.bloques.length, 1);
});

test('fuera del rango del pronóstico es desconocido', () => {
    const r = evaluarRiesgo([bloque(0)], h(24 * 10), h(24 * 10 + 3));
    assert.equal(r.nivel, 'desconocido');
    assert.equal(r.enRiesgo, false);
});
