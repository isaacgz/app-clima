// Clientes HTTP para Mapbox (geocoding) y MET Norway (clima y pronóstico).
// Usa el fetch nativo de Node 18+.
//
// MET Norway es gratuito, también para uso comercial, con dos condiciones:
// identificarse con un User-Agent que tenga datos de contacto y citar la fuente.
// Términos: https://api.met.no/doc/TermsOfService

const MAPBOX_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const MET_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const MET_USER_AGENT_DEFAULT = 'app-clima/1.0 (+https://github.com/isaacgz/app-clima)';
const CACHE_MS = 10 * 60 * 1000;

const FUENTE = 'Datos meteorológicos de MET Norway (api.met.no), licencia CC BY 4.0';

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

const pedir = async(url, servicio, opciones) => {
    let resp;
    try {
        resp = await fetch(url, opciones);
    } catch (error) {
        throw new ErrorServicio(`No se pudo conectar con ${ servicio }`);
    }
    if (!resp.ok) {
        throw new ErrorServicio(`${ servicio } respondió con estado ${ resp.status }`);
    }
    return resp;
};

// Guarda en memoria las respuestas para no repetir peticiones.
// fn devuelve { valor, expira } donde expira (ms) es opcional.
const conCache = async(clave, fn) => {
    const guardado = cache.get(clave);
    if (guardado && guardado.expira > Date.now()) return guardado.valor;

    const { valor, expira } = await fn();
    cache.set(clave, { valor, expira: expira || Date.now() + CACHE_MS });
    return valor;
};

const buscarLugares = async(termino = '') => {
    const params = new URLSearchParams({
        access_token: requerirClave('MAPBOX_KEY'),
        limit: 5,
        language: 'es'
    });
    const url = `${ MAPBOX_URL }/${ encodeURIComponent(termino) }.json?${ params }`;
    const data = await (await pedir(url, 'Mapbox')).json();

    return data.features.map(lugar => ({
        id: lugar.id,
        nombre: lugar.place_name,
        lng: lugar.center[0],
        lat: lugar.center[1]
    }));
};

// --- MET Norway ---------------------------------------------------------

const FENOMENOS = {
    rain: { nombre: 'lluvia', condicion: 'lluvia' },
    sleet: { nombre: 'aguanieve', condicion: 'lluvia' },
    snow: { nombre: 'nieve', condicion: 'nieve' }
};

const CIELO = {
    clearsky: { desc: 'despejado', condicion: 'despejado' },
    fair: { desc: 'mayormente despejado', condicion: 'despejado' },
    partlycloudy: { desc: 'parcialmente nublado', condicion: 'nublado' },
    cloudy: { desc: 'nublado', condicion: 'nublado' },
    fog: { desc: 'niebla', condicion: 'niebla' }
};

// Traduce un symbol_code de MET (p. ej. "heavyrainshowersandthunder_day") a una
// descripción en español y a una condición independiente del proveedor:
// despejado | nublado | niebla | lluvia | lluvia_fuerte | nieve | nieve_fuerte | tormenta | desconocida
const interpretarSimbolo = (simbolo = '') => {
    const base = simbolo.split('_')[0];
    if (CIELO[base]) return CIELO[base];

    const tormenta = base.includes('andthunder');
    let resto = base.replace('andthunder', '');

    const intensidad = resto.startsWith('light') ? 'ligera' : resto.startsWith('heavy') ? 'fuerte' : '';
    resto = resto.replace(/^(light|heavy)/, '');

    const chubascos = resto.endsWith('showers');
    const fenomeno = FENOMENOS[resto.replace('showers', '')];
    if (!fenomeno) return { desc: simbolo || 'sin datos', condicion: 'desconocida' };

    let desc = chubascos
        ? `chubascos${ intensidad ? (intensidad === 'ligera' ? ' ligeros' : ' fuertes') : '' } de ${ fenomeno.nombre }`
        : `${ fenomeno.nombre }${ intensidad ? ` ${ intensidad }` : '' }`;
    if (tormenta) desc += ' con tormenta eléctrica';

    const condicion = tormenta
        ? 'tormenta'
        : `${ fenomeno.condicion }${ intensidad === 'fuerte' ? '_fuerte' : '' }`;

    return { desc, condicion };
};

const aKmh = ms => Math.round((ms ?? 0) * 3.6);

// MET pide como máximo 4 decimales; con 2 (~1 km) basta para el clima y se aprovecha mejor la caché.
const redondear = n => Number(Number(n).toFixed(2));

const datosMet = (lat, lng) => {
    const latR = redondear(lat);
    const lngR = redondear(lng);

    return conCache(`met:${ latR },${ lngR }`, async() => {
        const url = `${ MET_URL }?${ new URLSearchParams({ lat: latR, lon: lngR }) }`;
        const resp = await pedir(url, 'MET Norway', {
            headers: { 'User-Agent': process.env.MET_USER_AGENT || MET_USER_AGENT_DEFAULT }
        });

        // MET indica en Expires hasta cuándo los datos son válidos; se respeta como pide su política.
        const expira = Date.parse(resp.headers.get('expires'));
        return {
            valor: (await resp.json()).properties.timeseries,
            expira: Number.isNaN(expira) ? undefined : expira
        };
    });
};

const climaActual = async(lat, lng) => {
    const [ahora] = await datosMet(lat, lng);
    if (!ahora) throw new ErrorServicio('MET Norway no devolvió datos para esa ubicación');
    const instante = ahora.data.instant.details;
    const periodo = ahora.data.next_1_hours || ahora.data.next_6_hours;
    const seisHoras = ahora.data.next_6_hours?.details ?? {};

    return {
        desc: interpretarSimbolo(periodo?.summary.symbol_code).desc,
        temp: instante.air_temperature,
        min: seisHoras.air_temperature_min ?? null,
        max: seisHoras.air_temperature_max ?? null,
        humedad: instante.relative_humidity,
        vientoKmh: aKmh(instante.wind_speed),
        fuente: FUENTE
    };
};

// Pronóstico en bloques: de 1 hora para los primeros ~2-3 días y de 6 horas hasta ~9 días.
const pronostico = async(lat, lng) => {
    const serie = await datosMet(lat, lng);

    return serie
        .map(({ time, data }) => {
            const horas = data.next_1_hours ? 1 : data.next_6_hours ? 6 : 0;
            if (!horas) return null;

            const periodo = horas === 1 ? data.next_1_hours : data.next_6_hours;
            const detalles = periodo.details ?? {};
            const instante = data.instant.details;
            const inicio = new Date(time);

            return {
                inicio,
                fin: new Date(inicio.getTime() + horas * 3600 * 1000),
                ...interpretarSimbolo(periodo.summary.symbol_code),
                temp: instante.air_temperature,
                probLluvia: detalles.probability_of_precipitation != null
                    ? detalles.probability_of_precipitation / 100
                    : null,
                probTormenta: detalles.probability_of_thunder != null
                    ? detalles.probability_of_thunder / 100
                    : null,
                lluviaMm: detalles.precipitation_amount ?? 0,
                rafagaKmh: aKmh(instante.wind_speed_of_gust ?? instante.wind_speed)
            };
        })
        .filter(Boolean);
};

module.exports = {
    FUENTE,
    ErrorServicio,
    buscarLugares,
    climaActual,
    interpretarSimbolo,
    pronostico
};
