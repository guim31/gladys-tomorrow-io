# Tomorrow.io

El tiempo hiperlocal de [Tomorrow.io](https://www.tomorrow.io) en Gladys: condiciones actuales, la
lluvia de la próxima hora minuto a minuto, la previsión de los próximos días y, con un plan de pago,
la calidad del aire y el polen. Un dispositivo por lugar, un disparador de escena «lluvia prevista»,
una acción de escena que lee la previsión y dos widgets para el panel.

Esta integración no está afiliada a Tomorrow.io. Se ha desarrollado sin cuenta de Tomorrow.io, a
partir de la documentación oficial y de las respuestas publicadas por la integración de Home
Assistant: sus comentarios son bienvenidos.

## Requisitos

- Gladys 5.1.0 o posterior.
- Una cuenta de Tomorrow.io (basta con el plan gratuito) y su clave de API: inicie sesión en
  [app.tomorrow.io](https://app.tomorrow.io/development/keys), **Development → API keys**.
- Acceso a Internet desde Gladys: la integración llama a `api.tomorrow.io`.

## Configuración

### Clave de API y cuota

Pegue la clave en **Clave de API** y pulse **Probar la clave de API**: la respuesta indica la
temperatura leída, el número de lugares y el ritmo de las lecturas.

El plan gratuito permite **500 llamadas al día** (se reinicia a medianoche UTC), **25 por hora** (se
reinicia a cada hora en punto) y 3 por segundo. Cada lectura de un lugar cuesta **2 llamadas**
(condiciones actuales y luego la previsión, que trae todas las escalas de tiempo a la vez), 3 con las
capas premium. La integración:

- solo lee los lugares cuyo dispositivo se ha añadido a Gladys;
- alarga el **intervalo de lectura** (15 minutos por defecto) para que todos los lugares quepan en el
  90 % de los límites por hora y por día: 1 o 2 lugares cada 15 minutos, 3 lugares cada 20 minutos,
  4 cada 26 minutos;
- cuenta sus llamadas, conserva el recuento en `/data` entre reinicios y se detiene cuando se alcanza
  un límite.

Con un plan de pago, ajuste **Llamadas permitidas al día** y **por hora** a sus límites.

### Lugares

**Lugares que leer**: las casas de Gladys (por defecto), las coordenadas introducidas abajo, o ambos.
Una casa solo se lee cuando su ubicación está fijada en su mapa en **Ajustes → Casas**. Las
coordenadas son grados decimales, con coma o punto (`40,4168` y `-3,7038`); **Nombre del lugar**
da nombre a ese dispositivo.

**Idioma** fija los nombres de las funcionalidades (al crear el dispositivo) y los textos que escribe
la integración: el tiempo, el resumen de la acción de escena. Francés por defecto.

## Dispositivos

Abra la pestaña **Descubrimiento** y añada el dispositivo de cada lugar. Sus estados llegan enseguida
y luego en cada lectura. Todo es de solo lectura.

### Funcionalidades

| Funcionalidad                  | Unidad | Origen                                                               |
| ------------------------------ | ------ | -------------------------------------------------------------------- |
| Temperatura, Sensación térmica | °C     | condiciones actuales                                                 |
| Humedad                        | %      | condiciones actuales                                                 |
| Presión                        | hPa    | a nivel del mar, si no en superficie                                 |
| Velocidad del viento, Ráfagas  | km/h   | condiciones actuales                                                 |
| Dirección del viento           | °      | de dónde viene el viento                                             |
| Nubosidad                      | %      | condiciones actuales                                                 |
| Precipitación actual           | mm/h   | lluvia, nieve, aguanieve y lluvia helada juntas                      |
| Precipitación próxima hora     | mm     | prevista en los próximos 60 minutos (mostrada en mm/h: mismo número) |
| Lluvia en la próxima hora      | 0/1    | al menos un minuto con 0,1 mm/h o más en los próximos 60 minutos     |
| Probabilidad de lluvia         | %      | la más alta de la próxima hora                                       |
| Tiempo                         | texto  | código de tiempo de Tomorrow.io, traducido                           |
| Visibilidad                    | km     | condiciones actuales                                                 |
| Índice UV                      |        | condiciones actuales                                                 |

Se usa la previsión minuto a minuto cuando el plan la ofrece; si no, la hora en curso de la previsión
horaria (lluvia si hay 0,1 mm/h o más con una probabilidad del 50 % o más).

### Capas premium: calidad del aire y polen

**Calidad del aire y polen (plan de pago)** añade: índice de calidad del aire EPA, PM2,5, PM10, ozono
(µg/m³, convertido desde ppb), polen de árboles, gramíneas y malezas (de 0 ninguno a 5 muy alto) y el
índice de incendio. Estas capas **no están en el plan gratuito**: con un plan que las rechaza, la
integración lo indica una vez en sus registros y vuelve a preguntar un día después; las demás
funcionalidades siguen funcionando. Activar o desactivar la opción cambia la estructura del
dispositivo: pulse **Actualizar** en la pestaña Descubrimiento.

## Widgets

- **Previsión Tomorrow.io**: el tiempo actual (temperatura, sensación térmica, viento y probabilidad
  de lluvia en directo), los seis días siguientes (temperaturas, tiempo, probabilidad de lluvia), la
  lluvia de la hora y, con las capas premium, la calidad del aire y el polen.
- **Lluvia próxima hora**: cuándo empieza la lluvia, un gráfico de barras de los próximos 60 minutos,
  la intensidad máxima y la probabilidad de lluvia. Sin previsión minuto a minuto, lo indica y da la
  estimación horaria.

Elija el lugar en los ajustes del widget. Ninguno de los dos llama a Tomorrow.io: muestran la última
lectura.

## Disparador de escena

**Lluvia prevista pronto (Tomorrow.io)** inicia una escena cuando la lluvia va a empezar **dentro de
15, 30 o 60 minutos** en un lugar (o acaba de empezar). Cada ventana se dispara una vez por chubasco:
un chubasco anunciado a 50 minutos dispara «60», luego «30» y «15» al acercarse. Solo vuelve a
dispararse cuando la previsión ha vuelto a ser seca para esa ventana. Variables: el lugar, los minutos
antes de la lluvia, la intensidad máxima (mm/h), la probabilidad de lluvia (%).

Un reinicio de la integración durante un chubasco no lo vuelve a disparar. Sin previsión minuto a
minuto, solo existe la ventana de 60 minutos.

## Acción de escena

**Leer la previsión de Tomorrow.io** da, para hoy o mañana en un lugar: una frase de resumen, el
tiempo, las temperaturas mínima y máxima y la probabilidad de lluvia, para las acciones siguientes de
la escena. Usa la última lectura: ninguna llamada.

## Ejemplos de escenas

- **Recoger la ropa**: disparador «Lluvia prevista pronto», dentro de 30 minutos → enviar el mensaje
  «Lluvia en {{triggerEvent.data.minutes}} min en {{triggerEvent.data.place}}».
- **Cerrar la claraboya**: disparador «Lluvia prevista pronto», dentro de 15 minutos → cerrar el
  dispositivo de la claraboya (o del toldo).
- **Tiempo de la mañana**: cada día a las 7:00 → «Leer la previsión de Tomorrow.io» (hoy) → enviar un
  mensaje con el resumen.
- **Polen**: con las capas premium, un disparador de dispositivo «Polen de árboles» por encima de 3 →
  avisar a los alérgicos de la casa.

## Solución de problemas

- **«Tomorrow.io rechaza la clave de API»**: vuelva a copiar la clave desde su cuenta, sin espacios.
  Una clave nueva puede tardar unos minutos en funcionar.
- **«Cuota de Tomorrow.io alcanzada»**: quizá otra aplicación (Home Assistant…) use la misma clave.
  Las lecturas se reanudan cuando se reinicia la hora o el día; reduzca el número de lugares o cree
  una clave para Gladys.
- **Ningún dispositivo en Descubrimiento**: ninguna casa tiene ubicación y no hay coordenadas.
  Fije la ubicación de la casa en el mapa o cambie a coordenadas.
- **«Sin valor reciente»**: compruebe que el dispositivo se ha añadido y revise los registros de la
  integración.
- Más detalles en los registros: ajuste `LOG_LEVEL=debug`. La clave de API nunca aparece en ellos.

## Limitaciones

- Desarrollada sin cuenta de Tomorrow.io: los nombres de los campos siguen la documentación oficial
  y los fixtures de Home Assistant; el primer uso real puede revelar diferencias.
- Solo unidades métricas (°C, km/h, hPa, mm, km).
- Un lugar cuesta 2 llamadas por lectura: con el plan gratuito, a partir de 4 lugares las lecturas
  se espacian para respetar la cuota.
- La calidad del aire, el polen y el índice de incendio requieren un plan de pago de Tomorrow.io.
- Los nombres de las funcionalidades se fijan al crear el dispositivo: cambiar el idioma después no
  los renombra.
- Sin alertas meteorológicas: el disparador de alertas de Gladys requiere una integración de tipo
  proveedor meteorológico.
