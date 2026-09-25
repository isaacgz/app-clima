const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { interpretarSimbolo, pronostico, climaActual } = require('../services/clima');

test('interpreta los símbolos de MET Norway', () => {
    assert.deepEqual(interpretarSimbolo('clearsky_day'), { desc: 'despejado', condicion: 'despejado' });
    assert.deepEqual(interpretarSimbolo('partlycloudy_night'), { desc: 'parcialmente nublado', condicion: 'nublado' });
    assert.deepEqual(interpretarSimbolo('lightrain'), { desc: 'lluvia ligera', condicion: 'lluvia' });
    assert.deepEqual(interpretarSimbolo('heavyrain'), { desc: 'lluvia fuerte', condicion: 'lluvia_fuerte' });
    assert.deepEqual(interpretarSimbolo('rainshowers_day'), { desc: 'chubascos de lluvia', condicion: 'lluvia' });
    assert.deepEqual(interpretarSimbolo('heavysnowshowers_day'), { desc: 'chubascos fuertes de nieve', condicion: 'nieve_fuerte' });
    assert.deepEqual(interpretarSimbolo('lightsleet'), { desc: 'aguanieve ligera', condicion: 'lluvia' });
    assert.deepEqual(
        interpretarSimbolo('heavyrainshowersandthunder_day'),
        { desc: 'chubascos fuertes de lluvia con tormenta eléctrica', condicion: 'tormenta' }
    );
    assert.equal(interpretarSimbolo('algo_raro').condicion, 'desconocida');
});

// Respuesta con el formato de locationforecast/2.0/complete:
// bloques de 1 h al principio y de 6 h después.
const respuestaMet = {
    properties: {
        timeseries: [
            {
                time: '2026-10-03T18:00:00Z',
                data: {
                    instant: { details: { air_temperature: 27.1, relative_humidity: 60, wind_speed: 4, wind_speed_of_gust: 9 } },
                    next_1_hours: {
                        summary: { symbol_code: 'rainandthunder' },
                        details: { precipitation_amount: 3.2, probability_of_precipitation: 90, probability_of_thunder: 55 }
                    },
                    next_6_hours: {
                        summary: { symbol_code: 'rain' },
                        details: { precipitation_amount: 8, air_temperature_min: 22, air_temperature_max: 28 }
                    }
                }
            },
            {
                time: '2026-10-06T00:00:00Z',
                data: {
                    instant: { details: { air_temperature: 20, relative_humidity: 70, wind_speed: 2 } },
                    next_6_hours: {
                        summary: { symbol_code: 'cloudy' },
                        details: { precipitation_amount: 0 }
                    }
                }
            },
            {
                time: '2026-10-12T00:00:00Z',
                data: { instant: { details: { air_temperature: 19 } } }
            }
        ]
    }
};

let fetchOriginal;
let peticiones;

beforeEach(() => {
    fetchOriginal = global.fetch;
    peticiones = [];
    global.fetch = async(url, opciones) => {
        peticiones.push({ url: String(url), opciones });
        return new Response(JSON.stringify(respuestaMet), {
            headers: { expires: new Date(Date.now() + 3600e3).toUTCString() }
        });
    };
});

afterEach(() => {
    global.fetch = fetchOriginal;
});

test('convierte el pronóstico de MET en bloques genéricos', async() => {
    const bloques = await pronostico(25.6714, -100.3089);

    assert.equal(bloques.length, 2);
    assert.deepEqual(bloques[0], {
        inicio: new Date('2026-10-03T18:00:00Z'),
        fin: new Date('2026-10-03T19:00:00Z'),
        desc: 'lluvia con tormenta eléctrica',
        condicion: 'tormenta',
        temp: 27.1,
        probLluvia: 0.9,
        probTormenta: 0.55,
        lluviaMm: 3.2,
        rafagaKmh: 32
    });
    assert.equal(bloques[1].fin.toISOString(), '2026-10-06T06:00:00.000Z');
    assert.equal(bloques[1].probLluvia, null);
    assert.equal(bloques[1].rafagaKmh, 7);

    const { url, opciones } = peticiones[0];
    assert.match(url, /lat=25\.67&lon=-100\.31$/);
    assert.match(opciones.headers['User-Agent'], /app-clima/);
});

test('reutiliza la caché y arma el clima actual', async() => {
    const clima = await climaActual(25.6714, -100.3089);

    assert.equal(peticiones.length, 0, 'debe usar la respuesta guardada de la prueba anterior');
    assert.equal(clima.desc, 'lluvia con tormenta eléctrica');
    assert.equal(clima.temp, 27.1);
    assert.equal(clima.min, 22);
    assert.equal(clima.max, 28);
    assert.equal(clima.humedad, 60);
    assert.equal(clima.vientoKmh, 14);
    assert.match(clima.fuente, /MET Norway/);
});
