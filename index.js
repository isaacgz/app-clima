require('dotenv').config();
require('colors');
const { leerInput, inquirerMenu, pausa, listarLugares } = require('./helpers/inquirer');
const Busquedas = require('./models/busquedas');

const buscarCiudad = async(busquedas) => {
    const termino = await leerInput('Ciudad: ');

    let lugares;
    try {
        lugares = await busquedas.ciudad(termino);
    } catch (error) {
        console.log(`\n${ error.message }`.red);
        return;
    }

    if (lugares.length === 0) {
        console.log('\nNo se encontraron lugares con ese nombre'.yellow);
        return;
    }

    const id = await listarLugares(lugares);
    if (id === '0') return;

    const lugarSel = lugares.find(l => l.id === id);
    busquedas.agregarHistorial(lugarSel.nombre);

    let clima;
    try {
        clima = await busquedas.climaLugar(lugarSel.lat, lugarSel.lng);
    } catch (error) {
        console.log(`\nNo se pudo obtener el clima: ${ error.message }`.red);
        return;
    }

    console.clear();
    console.log('\n Informacion de la ciudad \n'.green);
    console.log('Ciudad: ', lugarSel.nombre.green);
    console.log('Lat: ', lugarSel.lat);
    console.log('Lng: ', lugarSel.lng);
    console.log('Temperatura: ', clima.temp);
    console.log('Sensación térmica: ', clima.sensacion);
    console.log('Minima: ', clima.min);
    console.log('Máxima: ', clima.max);
    console.log('Humedad: ', `${ clima.humedad }%`);
    console.log('Viento: ', `${ clima.vientoKmh } km/h`);
    console.log('Cómo está el clima: ', clima.desc.green);
};

const main = async() => {
    console.clear();
    const busquedas = new Busquedas();
    let opt;

    do {
        opt = await inquirerMenu();

        switch (opt) {
            case 1:
                await buscarCiudad(busquedas);
                break;

            case 2:
                busquedas.historialCapitalizado.forEach((lugar, i) => {
                    const idx = `${ i + 1 }.`.green;
                    console.log(`${ idx } ${ lugar }`);
                });
                break;
        }

        if (opt !== 0) await pausa();

    } while (opt !== 0);
};

main();
