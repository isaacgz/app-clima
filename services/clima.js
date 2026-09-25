// Clientes HTTP para Mapbox (geocoding) y OpenWeather (clima y pronóstico).
// Usa el fetch nativo de Node 18+.

const MAPBOX_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const OPENWEATHER_URL = 'https://api.openweathermap.org/data/2.5';
const CACHE_MS = 10 * 60 * 1000;

const cache = new Map();

class ErrorServicio extends Error {
    constructor(message, status = 502) {
        super(message);
        this.status = status;
    }
}

const requerirClave = (nombre) => {
    const valor = process.env[nombre];
    if (!valor) throw new ErrorServicio(`Falta la variable de entorno ${ nombre }`, 500);
    return valor;
};

const pedirJSON = async(url, servicio) => {
    let resp;
    try {
        resp = await fetch(url);
    } catch (error) {
        throw new ErrorServicio(`No se pudo conectar con ${ servicio }`);
    }
    if (!resp.ok) {
        throw new ErrorServicio(`${ servicio } respondió con estado ${ resp.status }`);
    }
    return resp.json();
};

// Guarda en memoria las respuestas por unos minutos para no gastar cuota de la API.
const conCache = async(clave, fn) => {
    const guardado = cache.get(clave);
    if (guardado && guardado.expira > Date.now()) return guardado.valor;

    const valor = await fn();
    cache.set(clave, { valor, expira: Date.now() + CACHE_MS });
    return valor;
};

const coordsClave = (lat, lng) => `${ Number(lat).toFixed(2) },${ Number(lng).toFixed(2) }`;

const buscarLugares = async(termino = '') => {
    const params = new URLSearchParams({
        access_token: requerirClave('MAPBOX_KEY'),
        limit: 5,
        language: 'es'
    });
    const url = `${ MAPBOX_URL }/${ encodeURIComponent(termino) }.json?${ params }`;
    const data = await pedirJSON(url, 'Mapbox');

    return data.features.map(lugar => ({
        id: lugar.id,
        nombre: lugar.place_name,
        lng: lugar.center[0],
        lat: lugar.center[1]
    }));
};

const paramsWeather = (lat, lng) => new URLSearchParams({
    appid: requerirClave('OPENWEATHER_KEY'),
    units: 'metric',
    lang: 'es',
    lat,
    lon: lng
});

const climaActual = (lat, lng) => conCache(`actual:${ coordsClave(lat, lng) }`, async() => {
    const data = await pedirJSON(`${ OPENWEATHER_URL }/weather?${ paramsWeather(lat, lng) }`, 'OpenWeather');
    const { weather, main, wind } = data;

    return {
        desc: weather[0].description,
        temp: main.temp,
        sensacion: main.feels_like,
        min: main.temp_min,
        max: main.temp_max,
        humedad: main.humidity,
        vientoKmh: Math.round((wind?.speed ?? 0) * 3.6)
    };
});

// Pronóstico en bloques de 3 horas para los próximos 5 días.
const pronostico = (lat, lng) => conCache(`pronostico:${ coordsClave(lat, lng) }`, async() => {
    const data = await pedirJSON(`${ OPENWEATHER_URL }/forecast?${ paramsWeather(lat, lng) }`, 'OpenWeather');

    return data.list.map(p => ({
        inicio: new Date(p.dt * 1000),
        fin: new Date((p.dt + 3 * 3600) * 1000),
        condicionId: p.weather[0].id,
        desc: p.weather[0].description,
        temp: p.main.temp,
        probLluvia: p.pop ?? 0,
        lluviaMm: p.rain?.['3h'] ?? 0,
        nieveMm: p.snow?.['3h'] ?? 0,
        rafagaKmh: Math.round((p.wind?.gust ?? p.wind?.speed ?? 0) * 3.6)
    }));
});

module.exports = {
    ErrorServicio,
    buscarLugares,
    climaActual,
    pronostico
};
