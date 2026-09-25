// Evalúa si el clima pone en riesgo un evento, a partir del pronóstico en bloques de 3 h.
// Códigos de condición de OpenWeather: https://openweathermap.org/weather-conditions

const NIVELES = ['bajo', 'medio', 'alto'];

const UMBRALES = {
    lluviaFuerteMm: 7.5,     // mm en un bloque de 3 h (~2.5 mm/h)
    probLluviaMedia: 0.5,
    probLluviaAlta: 0.8,
    lluviaProbableMm: 2,     // mm totales que, junto con prob. alta, suben el riesgo a alto
    rafagaMediaKmh: 40,
    rafagaAltaKmh: 60
};

const LLUVIA_FUERTE_IDS = [502, 503, 504, 511, 522];
const NIEVE_FUERTE_IDS = [602, 622];
const VIENTO_EXTREMO_IDS = [771, 781];

const esTormenta = id => id >= 200 && id < 300;
const esLluvia = id => id >= 300 && id < 600;
const esNieve = id => id >= 600 && id < 700;

const MENSAJES = {
    alto: 'Tu evento está en alto riesgo por el clima. Considera reprogramarlo o moverlo a un lugar techado.',
    medio: 'El clima podría afectar tu evento. Ten un plan B, como una carpa o un lugar techado.',
    bajo: 'El clima se ve bien para tu evento.',
    desconocido: 'Todavía no hay pronóstico para la fecha de tu evento. Vuelve a consultar cuando falten 5 días o menos.'
};

const porcentaje = p => `${ Math.round(p * 100) }%`;

const evaluarRiesgo = (bloques, inicio, fin) => {
    const relevantes = bloques.filter(b => b.inicio < fin && b.fin > inicio);

    if (relevantes.length === 0) {
        return {
            nivel: 'desconocido',
            enRiesgo: false,
            mensaje: MENSAJES.desconocido,
            motivos: [],
            bloques: []
        };
    }

    const ids = relevantes.map(b => b.condicionId);
    const probLluviaMax = Math.max(...relevantes.map(b => b.probLluvia));
    const lluviaMaxMm = Math.max(...relevantes.map(b => b.lluviaMm));
    const lluviaTotalMm = relevantes.reduce((total, b) => total + b.lluviaMm, 0);
    const rafagaMaxKmh = Math.max(...relevantes.map(b => b.rafagaKmh));

    const motivos = [];
    const agregar = (nivel, texto) => motivos.push({ nivel, texto });

    if (ids.some(esTormenta)) agregar('alto', 'Tormenta eléctrica');
    if (ids.some(id => VIENTO_EXTREMO_IDS.includes(id))) agregar('alto', 'Vientos violentos o tornado');

    if (ids.some(id => LLUVIA_FUERTE_IDS.includes(id)) || lluviaMaxMm >= UMBRALES.lluviaFuerteMm) {
        agregar('alto', `Lluvia fuerte (hasta ${ lluviaMaxMm.toFixed(1) } mm en 3 h)`);
    } else if (probLluviaMax >= UMBRALES.probLluviaAlta && lluviaTotalMm >= UMBRALES.lluviaProbableMm) {
        agregar('alto', `Lluvia muy probable (${ porcentaje(probLluviaMax) })`);
    } else if (ids.some(esLluvia) || probLluviaMax >= UMBRALES.probLluviaMedia) {
        agregar('medio', `Probabilidad de lluvia de ${ porcentaje(probLluviaMax) }`);
    }

    if (ids.some(id => NIEVE_FUERTE_IDS.includes(id))) agregar('alto', 'Nevada fuerte');
    else if (ids.some(esNieve)) agregar('medio', 'Nieve');

    if (rafagaMaxKmh >= UMBRALES.rafagaAltaKmh) agregar('alto', `Rachas de viento de ${ rafagaMaxKmh } km/h`);
    else if (rafagaMaxKmh >= UMBRALES.rafagaMediaKmh) agregar('medio', `Rachas de viento de ${ rafagaMaxKmh } km/h`);

    const nivel = motivos.reduce(
        (peor, m) => NIVELES.indexOf(m.nivel) > NIVELES.indexOf(peor) ? m.nivel : peor,
        'bajo'
    );

    return {
        nivel,
        enRiesgo: nivel !== 'bajo',
        mensaje: MENSAJES[nivel],
        motivos: motivos.map(m => m.texto),
        resumen: {
            probLluviaMax,
            lluviaTotalMm: Number(lluviaTotalMm.toFixed(1)),
            rafagaMaxKmh
        },
        bloques: relevantes
    };
};

module.exports = {
    UMBRALES,
    evaluarRiesgo
};
