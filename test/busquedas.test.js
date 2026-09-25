const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Busquedas = require('../models/busquedas');

const dbTemporal = (contenido) => {
    const archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clima-')), 'db.json');
    if (contenido !== undefined) fs.writeFileSync(archivo, contenido);
    return archivo;
};

test('el historial guarda como máximo 5 lugares', () => {
    const b = new Busquedas(dbTemporal());
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(l => b.agregarHistorial(l));
    assert.deepEqual(b.historial, ['g', 'f', 'e', 'd', 'c']);
});

test('un lugar repetido se mueve al principio sin duplicarse', () => {
    const b = new Busquedas(dbTemporal());
    ['Monterrey', 'Saltillo', 'monterrey'].forEach(l => b.agregarHistorial(l));
    assert.deepEqual(b.historial, ['monterrey', 'saltillo']);
});

test('el historial persiste en disco', () => {
    const archivo = dbTemporal();
    new Busquedas(archivo).agregarHistorial('Acuña');
    assert.deepEqual(new Busquedas(archivo).historial, ['acuña']);
});

test('un archivo corrupto no rompe la app', () => {
    assert.deepEqual(new Busquedas(dbTemporal('{no es json')).historial, []);
});

test('historialCapitalizado tolera espacios dobles', () => {
    const b = new Busquedas(dbTemporal(JSON.stringify({ historial: ['nuevo  león, méxico'] })));
    assert.deepEqual(b.historialCapitalizado, ['Nuevo  León, México']);
});
