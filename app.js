const express = require('express');
const { FUENTE, ErrorServicio, buscarLugares, climaActual, pronostico } = require('./services/clima');
const { evaluarRiesgo } = require('./services/riesgo');

const DURACION_DEFAULT_MS = 3 * 3600 * 1000;

const app = express();

// CORS: permite que el frontend de otro dominio consuma la API.
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Si se define API_KEY, todas las rutas /api (menos /api/salud) exigen el header X-Api-Key.
app.use('/api', (req, res, next) => {
    const clave = process.env.API_KEY;
    if (!clave || req.path === '/salud' || req.get('X-Api-Key') === clave) return next();
    res.status(401).json({ error: 'API key inválida o ausente' });
});

const errorPeticion = (message) => new ErrorServicio(message, 400);

const leerCoords = async(query) => {
    if (query.lat && query.lng) {
        const lat = Number(query.lat);
        const lng = Number(query.lng);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw errorPeticion('lat debe ser un número entre -90 y 90');
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw errorPeticion('lng debe ser un número entre -180 y 180');
        return { lat, lng };
    }

    if (query.lugar) {
        const [lugar] = await buscarLugares(query.lugar);
        if (!lugar) throw new ErrorServicio(`No se encontró el lugar "${ query.lugar }"`, 404);
        return lugar;
    }

    throw errorPeticion('Envía lat y lng, o el parámetro lugar');
};

const leerFecha = (valor, nombre) => {
    const fecha = new Date(valor);
    if (!valor || Number.isNaN(fecha.getTime())) throw errorPeticion(`${ nombre } debe ser una fecha ISO 8601`);
    return fecha;
};

const ruta = fn => (req, res, next) => fn(req, res).catch(next);

app.get('/api/salud', (req, res) => res.json({ ok: true }));

app.get('/api/lugares', ruta(async(req, res) => {
    if (!req.query.q) throw errorPeticion('Falta el parámetro q');
    res.json(await buscarLugares(req.query.q));
}));

app.get('/api/clima', ruta(async(req, res) => {
    const { lat, lng } = await leerCoords(req.query);
    res.json(await climaActual(lat, lng));
}));

app.get('/api/riesgo', ruta(async(req, res) => {
    const inicio = leerFecha(req.query.inicio, 'inicio');
    const fin = req.query.fin
        ? leerFecha(req.query.fin, 'fin')
        : new Date(inicio.getTime() + DURACION_DEFAULT_MS);

    if (fin <= inicio) throw errorPeticion('fin debe ser posterior a inicio');
    if (fin <= new Date()) throw errorPeticion('El evento ya terminó');

    const { lat, lng, nombre } = await leerCoords(req.query);
    const bloques = await pronostico(lat, lng);

    res.json({
        lugar: { lat, lng, ...(nombre && { nombre }) },
        evento: { inicio, fin },
        ...evaluarRiesgo(bloques, inicio, fin),
        fuente: FUENTE
    });
}));

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status === 500 && !(err instanceof ErrorServicio) ? 'Error interno' : err.message });
});

module.exports = app;
