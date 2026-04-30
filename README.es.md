# HR Color Predictor

> Horse Reality color predictor ☆ es una extensión de Chrome hecha por **claymore**
>
> 🌐 [English](README.md) · **Español**

Horse Reality color predictor es una extensión de Chrome para el juego web [Horse Reality](https://v2.horsereality.com). La herramienta se encarga de leer la información genética que aparece en la página de un caballo. Te permite elegir una yegua y un semental, y calcula al instante todos los resultados posibles de capas para su descendencia (genotipo, fenotipo, nombre de la capa y probabilidad) para cualquier pareja de caballos de la misma raza.

Se acabó cruzar referencias con la wiki, hacer Punnet Squares manualmente, o utilizar hojas de cálculo. Todo corre localmente en tu navegador.

---

## Cómo funciona

En la página de cada caballo aparecerán dos botones nuevos en la esquina superior derecha.

![alt text](images/image.png)

Al pulsar **HR Color Predictor** se abrirá un menú lateral, donde podrás ver tus parejas guardadas.

![alt text](images/image-1.png)

---

## Crear una pareja

**Reglas para crear una pareja:**

- Ambos caballos deben ser de la **misma raza**.
- Debe tener al menos una **yegua** (Dam) y un **semental** (Sire).
- Cada caballo necesita **al menos un gen testado**. Los caballos parcialmente testados producen resultados parciales. Se mostrará una advertencia en la tarjeta de la pareja correspondiente.


No importa la edad del caballo, si está retirado o ha fallecido. Se pueden emparejar potros y potras para predecir su descendencia futura.

### Paso a paso

Para empezar una pareja, pulsa **Add as Dam** (añadir como yegua) o **Add as Sire** (añadir como semental) en la página del caballo que quieras añadir.

![alt text](images/image-2.png)

Después pulsa **+ Create new pairing** (crear nueva pareja). Si ya tienes una pareja con un hueco libre del sexo correspondiente, también aparecerá la opción de añadirlo.

![alt text](images/image-3.png)
![alt text](images/image-4.png)

Una vez que añadimos la yegua a una pareja, debemos buscarle un semental. Ve a la página del semental y pulsa **Add as Sire**.

![alt text](images/image-5.png)

Tendrás la opción de añadirlo a la pareja que acabas de crear.

![alt text](images/image-6.png)

El botón **+ New Pairing** crea una pareja vacía que puedes rellenar después.

![alt text](images/image-7.png)

---

## Visualización de resultados

Pulsa cualquier pareja completa para abrir la vista de resultados. Verás una tabla con una fila por cada posible resultado de descendencia, mostrando:

- **Genotipo**: la combinación exacta de alelos (`E: E/e · A: A/a · CR: CR/n …`)
- **Fenotipo**: el nombre del color de la capa y cualquier patrón blanco superpuesto (por ejemplo, *Buckskin Dun · Tobiano*)
- **Probabilidad**: la probabilidad de ese resultado, en %

![alt text](images/image-8.png)

Las combinaciones letales (OLW/OLW, Wx homocigotos excepto W20/W20) se marcan en su propia fila.

![alt text](images/image-9.png)

---

## Seleccionar genes ocultos manualmente

La tabla de color de Horse Reality no muestra todos los genes. Algunos están presentes en la raza pero no son testables, estos genes se conocen como "Genes ocultos" (Hidden Genes). Por ejemplo A+ y At dentro del slot de Agouti, Hidden Sabino (Y), etc. El predictor extrae todo lo que puede del panel de tests, el resto puede seleccionarse manualmente si sabemos que el caballo tiene ese gen.

Pulsa **How do I know if my horse has these?** (¿Cómo sé si mi caballo tiene estos?) para ver más información sobre los genes ocultos.

![alt text](images/image-12.png) ![alt text](images/image-13.png)

Activar un gen oculto actualiza los resultados al instante. **Si desconoces que el caballo sea portador de ese gen, déjalo como está por defecto.**

---

## Renombrar, copiar y eliminar una pareja

Puedes renombrar, duplicar y eliminar parejas desde la tarjeta de la pareja. La flecha junto a cada caballo te permite añadir la yegua o semental a otra pareja, o empezar una nueva, sin volver a su página de perfil. Las selecciones de genes ocultos se mantienen, así que no tienes que volver a configurarlas.

![alt text](images/image-11.png)

![alt text](images/image-14.png)

![alt text](images/image-15.png)

![alt text](images/image-16.png)

---

## Cómo instalar

HR Color Predictor todavía no está en la Chrome Web Store, así que se instala como extensión sin empaquetar. Configuración inicial:

1. Descarga el `.zip` de la última versión desde la [página de releases](#) y descomprímelo, o clona este repositorio.
2. En Chrome, ve a `chrome://extensions/`.
3. Activa el **modo de desarrollador** (esquina superior derecha).
4. Pulsa **Cargar descomprimida** (Load unpacked) y selecciona la carpeta `hr-genetics-extension/`.
5. Fija la extensión desde el menú del puzzle para que el icono quede visible.

Abre el perfil de cualquier caballo en horsereality.com y deberías ver los dos botones nuevos.

**Actualizar:** descarga la nueva versión, reemplaza el contenido de la carpeta y pulsa el icono de recarga en la tarjeta de la extensión en `chrome://extensions/`.

---

## Seguridad y uso responsable

HR Color Predictor no tiene servidor, cuenta, ni telemetría. **Todo ocurre localmente.** Tus parejas se guardan en el almacenamiento local de la extensión en tu navegador. Si desinstalas la extensión, todas las parejas guardadas se eliminan. No existe una copia en la nube, tus datos nunca salen de tu ordenador.

**No es un cheat ni una herramienta de automatización.** La extensión solo lee información que ya está visible en la página del caballo y te ayuda a interpretarla. No interactúa con el juego, ni expone nada que no se te estuviese mostrando ya.

Esto entra dentro del tipo de herramienta descrita en la [Regla 7: Writing Scripts](https://v2.horsereality.com/rules#7) de Horse Reality, que permite programas que extraen datos públicamente disponibles de Horse Reality a una hoja de cálculo o base de datos externa, o que solo modifican la interfaz de usuario.

(*"Programs that scrape publicly available Horse Reality data to an external spreadsheet or database, or that only modify the user interface."*)

Antes de publicarla, me puse en contacto con el equipo de Horse Reality y me confirmaron que la extensión cumple con esa regla.

Esto no significa que la extensión tenga soporte oficial por parte de Horse Reality. Ya que según la misma regla, los programas de terceros son responsabilidad exclusiva de quienes los desarrollan. Horse Reality no se hace responsable del mantenimiento, integridad ni continuidad de esta extensión. Cualquier bug o petición de funcionalidad debe enviarse directamente a mí, no al soporte de HR.

---

## Reportar un bug

HR Color Predictor está desarrollado y mantenido por una sola persona como side project. Cada raza y cada mecánica específica del juego están mapeadas a mano, así que es probable que aparezcan bugs y edge cases.

Si ves un bug, un mapeo desactualizado para una raza concreta, un nombre de color incorrecto o cualquier cosa visualmente rara, por favor contáctame.
**Información útil que puedes incluir:**

- Raza y genotipo de ambos caballos (o las URL de los perfiles)
- Lo que esperabas ver vs. lo que viste
- Captura de los resultados y del panel de tests del caballo
- Versión de la extensión (visible en `chrome://extensions/`)

Puedes encontrarme en Horse Reality como **claymore**, o abrir un issue en este repositorio. Lo solucionaré tan pronto como sea posible.

---

## Más documentación

Para más detalles sobre cómo está diseñada la extensión y cómo funciona:

- [`planning-and-research/hr_genetics_reference_claymore_v1.html`](planning-and-research/hr_genetics_reference_claymore_v1.html): copia completa de los datos de genética del Notion de Horse Reality, usada como fuente autoritativa para el mapeo de razas.
- [`planning-and-research/planning.md`](planning-and-research/planning.md): documento de planificación del proyecto. Alcance, arquitectura, capa de datos y fases de desarrollo.
- [`planning-and-research/phenotype_resolver_plan.md`](planning-and-research/phenotype_resolver_plan.md): reglas y jerarquía de overrides utilizadas para traducir genotipos en nombres de color.

Si encuentras algo en la documentación que sea incorrecto, esté desactualizado o no se entienda, avísame.

---

## Licencia

[GPL-3.0](LICENSE). HR Color Predictor es software libre y de código abierto. Puedes usarlo, modificarlo y redistribuirlo, pero cualquier versión que distribuyas debe seguir siendo open source bajo GPL-3.0.

---

Gracias por probar HR Color Predictor! Espero que te ahorre algunos dolores de cabeza con la genética y te ayude a criar justo el caballo que estás buscando. Si tienes feedback, ideas, o simplemente quieres compartir un potro 10/10 que te haya salido, ya sabes dónde encontrarme.

### Happy Horsing ! !

```text
        /\/\
       /    \
     ~/(^  ^)
    ~/  )  (
   ~/   (  )
  ~/     ~~
 ~/      |_
```
