// Evalúa si el clima pone en riesgo un evento, a partir de bloques de pronóstico.
// No depende del proveedor: cada bloque trae una `condicion` genérica
// (despejado, nublado, niebla, lluvia, lluvia_fuerte, nieve, nieve_fuerte, tormenta).

const NIVELES = ['bajo', 'medio', 'alto'];

const UMBRALES = {
    lluviaFuerteMmH: 2.5,    // intensidad en mm por hora
    probLluviaMedia: 0.5,
    probLluviaAlta: 0.8,
    lluviaProbableMm: 2,     // mm totales que, junto con prob. alta, suben el riesgo a alto
    probTormenta: 0.3,
    rafagaMediaKmh: 40,
    rafagaAltaKmh: 60
};

const MENSAJES = {
    alto: 'Tu evento está en alto riesgo por el clima. Considera reprogramarlo o moverlo a un lugar techado.',
    medio: 'El clima podría afectar tu evento. Ten un plan B, como una carpa o un lugar techado.',
    bajo: 'El clima se ve bien para tu evento.',
    desconocido: 'Todavía no hay pronóstico para la fecha de tu evento. Vuelve a consultar cuando falten 9 días o menos.'
};

const porcentaje = p => `${ Math.round(p * 100) }%`;
const horasBloque = b => (b.fin - b.inicio) / 3600000;

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

    const hay = condicion => relevantes.some(b => b.condicion === condicion);
    const maximo = campo => Math.max(...relevantes.map(b => b[campo] ?? 0));

    const probLluviaMax = maximo('probLluvia');
    const probTormentaMax = maximo('probTormenta');
    const rafagaMaxKmh = maximo('rafagaKmh');
    const intensidadMaxMmH = Math.max(...relevantes.map(b => b.lluviaMm / horasBloque(b)));
    const lluviaTotalMm = relevantes.reduce((total, b) => total + b.lluviaMm, 0);

    const motivos = [];
    const agregar = (nivel, texto) => motivos.push({ nivel, texto });

    if (hay('tormenta')) agregar('alto', 'Tormenta eléctrica');
    else if (probTormentaMax >= UMBRALES.probTormenta) {
        agregar('alto', `Probabilidad de tormenta eléctrica de ${ porcentaje(probTormentaMax) }`);
    }

    if (hay('lluvia_fuerte') || intensidadMaxMmH >= UMBRALES.lluviaFuerteMmH) {
        agregar('alto', `Lluvia fuerte (hasta ${ intensidadMaxMmH.toFixed(1) } mm/h)`);
    } else if (probLluviaMax >= UMBRALES.probLluviaAlta && lluviaTotalMm >= UMBRALES.lluviaProbableMm) {
        agregar('alto', `Lluvia muy probable (${ porcentaje(probLluviaMax) })`);
    } else if (hay('lluvia') || probLluviaMax >= UMBRALES.probLluviaMedia) {
        agregar('medio', probLluviaMax > 0
            ? `Probabilidad de lluvia de ${ porcentaje(probLluviaMax) }`
            : 'Se pronostica lluvia');
    }

    if (hay('nieve_fuerte')) agregar('alto', 'Nevada fuerte');
    else if (hay('nieve')) agregar('medio', 'Nieve');

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
            probTormentaMax,
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
