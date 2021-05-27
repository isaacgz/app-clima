require('dotenv').config();
require('colors');
const { leerInput, inquirerMenu, pausa, listarLugares } = require("./helpers/inquirer");
const Busquedas = require('./models/busquedas');

// console.log(process.env);


const main = async() => {
    console.clear();
    const busquedas = new Busquedas();
    let opt;

    do {
         // Imprimir el menú
         opt = await inquirerMenu();
            
         switch (opt) {
             case 1:
                 //mostrar mensaje
                    const termino = await leerInput('Ciudad: ');
                   
                 //buscar los lugares
                 const lugares = await busquedas.ciudad(termino);
                                
                 //seleccionar el lugar
                 const id = await listarLugares(lugares);

                 if ( id === '0') continue;

                 const lugarSel = lugares.find(l => l.id === id);
                
                 //guardar en db
                busquedas.agregarHistorial( lugarSel.nombre );


                 //clima
                const clima = await busquedas.climaLugar( lugarSel.lat, lugarSel.lng);
                // console.log(clima);

                 //mostrar resultado
                 console.clear();
                console.log('\n Informacion de la ciudad \n'.green);
                console.log('Ciudad: ', lugarSel.nombre.green);
                console.log('Lat: ', lugarSel.lat);
                console.log('Lng: ', lugarSel.lng);
                console.log('Temperatura: ', clima.temp);
                console.log('Minima: ', clima.min);
                console.log('Máxima: ', clima.max);
                console.log('Cómo está el clima: ', clima.desc.green);

             break;
 
             case 2:


                 busquedas.historialCapitalizado.forEach( (lugar,i) => {
                    const idx = `${ i + 1}.`.green;
                     
                    console.log(`${ idx } ${ lugar }`);
                 })
             break;
             
         }

         await pausa();

    } while ( opt !== 0 );

}



main();