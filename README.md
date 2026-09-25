# App Clima

Microservicio REST (y app de terminal) para consultar el clima y **saber si un evento está en riesgo por lluvia, tormentas, viento o nieve**. Está pensado para usarse desde cualquier app: solo expone HTTP + JSON.

- **Clima y pronóstico:** [MET Norway](https://api.met.no/), el servicio meteorológico de Noruega. Es gratuito, también para uso comercial, cubre todo el mundo y da pronóstico de ~9 días. No pide clave.
- **Búsqueda de lugares:** [Mapbox](https://www.mapbox.com/) (plan gratuito). Solo se usa si buscas por nombre; si mandas coordenadas no hace falta.

## Instalación

```bash
npm install
cp .env.example .env   # llena MAPBOX_KEY y MET_USER_AGENT
npm start              # API en http://localhost:3000
npm run cli            # app interactiva de terminal
npm test
```

Requiere Node 18 o superior.

## Condiciones de uso de MET Norway

Sus [términos](https://api.met.no/doc/TermsOfService) piden:

1. **Identificarte:** define `MET_USER_AGENT` con el nombre de tu app y un correo o URL de contacto. Si usas uno genérico te pueden bloquear.
2. **Citar la fuente:** las respuestas incluyen el campo `fuente`; muéstralo en algún lugar de tu app (por ejemplo, junto al aviso de clima).
3. **No saturar su servidor:** la API ya guarda las respuestas en memoria hasta la hora de expiración que indica MET, así que consultar muchos eventos en la misma zona no genera peticiones de más.

## Endpoints

Si defines `API_KEY` en `.env`, envía el header `X-Api-Key: <tu clave>` en cada petición (menos en `/api/salud`).

### `GET /api/riesgo`

Evalúa el riesgo climático de un evento.

| Parámetro | Obligatorio | Descripción |
|---|---|---|
| `inicio` | sí | Fecha y hora ISO 8601, p. ej. `2026-10-03T18:00:00-06:00` |
| `fin` | no | Fecha y hora de fin. Por defecto, `inicio` + 3 horas |
| `lat`, `lng` | uno de los dos | Coordenadas del evento |
| `lugar` | uno de los dos | Texto a buscar, p. ej. `Parque Fundidora, Monterrey` (se usa el primer resultado; requiere `MAPBOX_KEY`) |

```bash
curl "http://localhost:3000/api/riesgo?lat=25.67&lng=-100.3&inicio=2026-10-03T18:00:00-06:00&fin=2026-10-03T23:00:00-06:00"
```

```json
{
  "lugar": { "lat": 25.67, "lng": -100.3 },
  "evento": { "inicio": "2026-10-04T00:00:00.000Z", "fin": "2026-10-04T05:00:00.000Z" },
  "nivel": "alto",
  "enRiesgo": true,
  "mensaje": "Tu evento está en alto riesgo por el clima. Considera reprogramarlo o moverlo a un lugar techado.",
  "motivos": ["Tormenta eléctrica", "Lluvia fuerte (hasta 6.0 mm/h)", "Rachas de viento de 68 km/h"],
  "resumen": { "probLluviaMax": 0.95, "probTormentaMax": 0.6, "lluviaTotalMm": 6, "rafagaMaxKmh": 68 },
  "bloques": [ { "inicio": "...", "fin": "...", "desc": "chubascos fuertes de lluvia con tormenta eléctrica", "condicion": "tormenta", "...": "..." } ],
  "fuente": "Datos meteorológicos de MET Norway (api.met.no), licencia CC BY 4.0"
}
```

**Niveles de riesgo**

| Nivel | Cuándo |
|---|---|
| `alto` | Tormenta eléctrica (o probabilidad ≥ 30 %), lluvia fuerte (≥ 2.5 mm/h), lluvia muy probable (≥ 80 % y ≥ 2 mm acumulados), nevada fuerte o rachas ≥ 60 km/h |
| `medio` | Lluvia pronosticada o probabilidad ≥ 50 %, nieve, o rachas ≥ 40 km/h |
| `bajo` | Nada de lo anterior |
| `desconocido` | El evento está a más de ~9 días: todavía no hay pronóstico |

Los umbrales están en `services/riesgo.js` (`UMBRALES`) por si quieres ajustarlos.

El pronóstico viene en bloques de 1 hora para los primeros 2 a 3 días y de 6 horas después, así que entre más cerca esté el evento, más preciso es el aviso.

### `GET /api/clima?lat=&lng=` (o `?lugar=`)

Clima actual: descripción, temperatura, mínima y máxima de las próximas 6 horas, humedad y viento.

### `GET /api/lugares?q=`

Busca lugares y devuelve hasta 5 resultados con `id`, `nombre`, `lat` y `lng`.

### `GET /api/salud`

Responde `{ "ok": true }`. Sirve para monitoreo.

## Cómo usarla desde otra app para avisar a los usuarios

Lo recomendable es que tu app tenga una tarea programada (cron) que, una o dos veces al día, consulte `/api/riesgo` para cada evento de los próximos 9 días y notifique al organizador cuando `enRiesgo` sea `true` o el `nivel` suba respecto a la última revisión. Conviene guardar las coordenadas de cada evento para no depender de la búsqueda por nombre.

```js
const resp = await fetch(`${ CLIMA_API }/api/riesgo?` + new URLSearchParams({
    lat: evento.lat,
    lng: evento.lng,
    inicio: evento.inicio.toISOString(),
    fin: evento.fin.toISOString()
}), { headers: { 'X-Api-Key': process.env.CLIMA_API_KEY } });

const riesgo = await resp.json();
if (riesgo.enRiesgo && riesgo.nivel !== evento.ultimoNivelRiesgo) {
    await notificar(evento.organizador, `${ riesgo.mensaje } Motivos: ${ riesgo.motivos.join(', ') }`);
}
```

## Cambiar de proveedor

`services/riesgo.js` no depende de MET Norway: trabaja con bloques que traen una `condicion` genérica (`despejado`, `nublado`, `niebla`, `lluvia`, `lluvia_fuerte`, `nieve`, `nieve_fuerte`, `tormenta`). Para usar otro proveedor basta con reescribir `pronostico` y `climaActual` en `services/clima.js` para que devuelvan ese mismo formato.
