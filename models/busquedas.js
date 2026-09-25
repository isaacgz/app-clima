const fs = require('fs');
const path = require('path');

const { buscarLugares, climaActual } = require('../services/clima');

const MAX_HISTORIAL = 5;

class Busquedas {

    historial = [];

    constructor(dbPath = path.join(__dirname, '../db/database.json')) {
        this.dbPath = dbPath;
        this.leerDB();
    }

    get historialCapitalizado() {
        return this.historial.map(lugar =>
            lugar
                .split(' ')
                .map(p => p.charAt(0).toUpperCase() + p.substring(1))
                .join(' ')
        );
    }

    ciudad(lugar = '') {
        return buscarLugares(lugar);
    }

    climaLugar(lat, lng) {
        return climaActual(lat, lng);
    }

    agregarHistorial(lugar = '') {
        const normalizado = lugar.toLocaleLowerCase();

        // Si ya existía, se mueve al principio en lugar de duplicarse.
        this.historial = [
            normalizado,
            ...this.historial.filter(l => l !== normalizado)
        ].slice(0, MAX_HISTORIAL);

        this.guardarDB();
    }

    guardarDB() {
        const payload = {
            historial: this.historial
        };

        fs.writeFileSync(this.dbPath, JSON.stringify(payload));
    }

    leerDB() {
        if (!fs.existsSync(this.dbPath)) return;

        try {
            const info = fs.readFileSync(this.dbPath, { encoding: 'utf-8' });
            const data = JSON.parse(info);
            this.historial = Array.isArray(data.historial) ? data.historial : [];
        } catch (error) {
            this.historial = [];
        }
    }

}

module.exports = Busquedas;
