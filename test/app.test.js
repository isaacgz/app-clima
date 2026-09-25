const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');

let server;
let base;

before(async() => {
    process.env.MAPBOX_KEY = 'x';
    server = app.listen(0);
    await new Promise(r => server.once('listening', r));
    base = `http://127.0.0.1:${ server.address().port }`;
});

after(() => server.close());

const get = async(ruta, headers = {}) => {
    const resp = await fetch(base + ruta, { headers });
    return { status: resp.status, body: await resp.json() };
};

test('GET /api/salud responde ok', async() => {
    assert.deepEqual(await get('/api/salud'), { status: 200, body: { ok: true } });
});

test('/api/riesgo valida la fecha de inicio', async() => {
    const { status, body } = await get('/api/riesgo?lat=25&lng=-100');
    assert.equal(status, 400);
    assert.match(body.error, /inicio/);
});

test('/api/riesgo valida las coordenadas', async() => {
    const inicio = new Date(Date.now() + 3600e3).toISOString();
    const { status, body } = await get(`/api/riesgo?lat=200&lng=-100&inicio=${ inicio }`);
    assert.equal(status, 400);
    assert.match(body.error, /lat/);
});

test('/api/riesgo rechaza eventos que ya terminaron', async() => {
    const { status } = await get('/api/riesgo?lat=25&lng=-100&inicio=2020-01-01T10:00:00Z');
    assert.equal(status, 400);
});

test('API_KEY protege las rutas', async() => {
    process.env.API_KEY = 'secreta';
    try {
        assert.equal((await get('/api/lugares?q=x')).status, 401);
        assert.equal((await get('/api/salud')).status, 200);
        assert.equal((await get('/api/riesgo?lat=1&lng=1', { 'X-Api-Key': 'secreta' })).status, 400);
    } finally {
        delete process.env.API_KEY;
    }
});
