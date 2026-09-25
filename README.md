# App Clima

API REST (y app de terminal) para consultar el clima y **saber si un evento está en riesgo por lluvia, tormentas, viento o nieve**.

Usa [Mapbox](https://www.mapbox.com/) para buscar lugares y [OpenWeather](https://openweathermap.org/) para el clima y el pronóstico.

## Instalación

```bash
npm install
cp .env.example .env   # y llena MAPBOX_KEY y OPENWEATHER_KEY
npm start              # API en http://localhost:3000
npm run cli            # app interactiva de terminal
npm test
```

Requiere Node 18 o superior.

## Endpoints

Si defines `API_KEY` en `.env`, envía el header `X-Api-Key: <tu clave>` en cada petición (menos en `/api/salud`).

### `GET /api/riesgo`

Evalúa el riesgo climático de un evento.

| Parámetro | Obligatorio | Descripción |
|---|---|---|
| `inicio` | sí | Fecha y hora ISO 8601, p. ej. `2026-10-03T18:00:00-06:00` |
| `fin` | no | Fecha y hora de fin. Por defecto, `inicio` + 3 horas |
| `lat`, `lng` | uno de los dos | Coordenadas del evento |
| `lugar` | uno de los dos | Texto a buscar, p. ej. `Parque Fundidora, Monterrey` (se usa el primer resultado) |

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
  "motivos": ["Tormenta eléctrica", "Rachas de viento de 65 km/h"],
  "resumen": { "probLluviaMax": 0.92, "lluviaTotalMm": 6.1, "rafagaMaxKmh": 65 },
  "bloques": [ { "inicio": "...", "fin": "...", "desc": "tormenta", "probLluvia": 0.92, "...": "..." } ]
}
```

**Niveles de riesgo**

| Nivel | Cuándo |
|---|---|
| `alto` | Tormenta eléctrica, tornado o vientos violentos, lluvia fuerte (≥ 7.5 mm en 3 h), lluvia muy probable (≥ 80 % y ≥ 2 mm acumulados), nevada fuerte o rachas ≥ 60 km/h |
| `medio` | Lluvia pronosticada o probabilidad ≥ 50 %, nieve, o rachas ≥ 40 km/h |
| `bajo` | Nada de lo anterior |
| `desconocido` | El evento está a más de 5 días: todavía no hay pronóstico |

Los umbrales están en `services/riesgo.js` (`UMBRALES`) por si quieres ajustarlos.

### `GET /api/clima?lat=&lng=` (o `?lugar=`)

Clima actual: descripción, temperatura, sensación térmica, mínima, máxima, humedad y viento.

### `GET /api/lugares?q=`

Busca lugares y devuelve hasta 5 resultados con `id`, `nombre`, `lat` y `lng`.

### `GET /api/salud`

Responde `{ "ok": true }`. Sirve para monitoreo.

## Cómo usarla para avisar a los usuarios

El pronóstico solo cubre los **próximos 5 días**, así que lo recomendable es que tu proyecto tenga una tarea programada (cron) que, una o dos veces al día, consulte `/api/riesgo` para cada evento de los próximos 5 días y notifique al organizador cuando `enRiesgo` sea `true` o el `nivel` suba respecto a la última revisión.

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

Las respuestas de OpenWeather se guardan en memoria 10 minutos por ubicación, así que consultar muchos eventos en el mismo lugar no gasta cuota de más.
