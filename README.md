# GestiCode · Consultorio financiero

Proyecto académico de gestión financiera. HTML, CSS y JavaScript sin servidor de datos. Chart.js 4.5.1 se carga desde jsDelivr para los gráficos interactivos.

## Abrir

Ejecuta `node preview.cjs` y visita http://127.0.0.1:4173. También puedes abrir `dist/index.html`, aunque el comportamiento de localStorage con archivos locales depende del navegador. Las fuentes web y los gráficos requieren conexión para su carga inicial; los cálculos y las tablas siguen funcionando si Chart.js no está disponible.

## Módulos

- Salud financiera: cuatro respuestas Sí/No alimentan un árbol de decisiones. Los problemas de pago, caja y deuda tienen prioridad sobre la acumulación de inventario.
- Análisis: balance de dos años consecutivos; comprueba activos = pasivos + patrimonio. Calcula estructura vertical, variación absoluta y variación horizontal. Una base nula o negativa no produce un porcentaje horizontal interpretable.
- Rentabilidad: ROA, ROE y margen neto, con saldos al cierre. Admite pérdidas y exige denominadores positivos. Incluye Du Pont: margen neto × rotación de activos × multiplicador del patrimonio = ROE.
- Escenarios: controles de variación de ventas (−50 a +50 %) y pago a proveedores (0 a 100 %), con recálculo instantáneo de ROA, ROE y liquidez corriente. La base separa pasivos corrientes de pasivos a largo plazo.
- Casos: creación, cambio y nombre de hasta 50 empresas o ejercicios, con autoguardado local y recuperación tras recargar. No hay sincronización entre dispositivos. Los errores de almacenamiento y conflictos entre pestañas se muestran sin sobrescribir datos existentes.
- Reportes: vista ejecutiva de todos los módulos, con datos base, tablas, gráficos, criterios y supuestos. Pulsa **Reporte / PDF**, luego **Imprimir / Guardar PDF** y elige **Guardar como PDF** en un navegador que admita impresión. Los módulos incompletos o inválidos se identifican; no se exportan resultados obsoletos. Se advierte si balance y rentabilidad no coinciden.

## Organización

- `dist/index.html`: interfaz, navegación y formularios.
- `dist/styles.css`: diseño adaptable y estados visuales.
- `dist/app.js`: eventos, validaciones, cálculos y diagnósticos.
- `dist/finance.js`: motor puro de Du Pont y escenarios, comprobable sin navegador.
- `dist/advanced.js`: gráficos, persistencia por caso, simulador y reporte.
- `dist/advanced.css`: diseño de las ampliaciones y estilos de impresión A4.
- `finance.test.cjs`: ejecuta `node finance.test.cjs` para verificar el motor.

Los rangos de salud son reglas **didácticas**, no estándares universales. Están explicados en la interfaz y pueden ajustarse en `app.js`. Los datos financieros se guardan bajo la clave `gesticode.cases.v1` de localStorage en el origen actual y no se envían a un servidor. Borrar los datos del navegador elimina los casos. Las pruebas en localhost y el sitio publicado tienen almacenes separados.

## Supuestos del simulador

Es un escenario pro forma del mismo período, no un presupuesto de caja. Mantiene el margen neto constante; la variación de utilidad se retiene en efectivo y patrimonio. Pagar a proveedores reduce simultáneamente efectivo y cuentas por pagar. Los otros saldos se mantienen constantes, sin cambios adicionales en impuestos, intereses o capital de trabajo. Se bloquean escenarios con caja negativa o patrimonio no positivo. Si no existen pasivos corrientes, la liquidez se muestra como no aplicable. El patrimonio se deriva de activos menos pasivos.

Ejemplo del simulador: ventas +15 % y pago a proveedores 10 % → ventas 230000, utilidad 17250, efectivo 23250, activos 168250, patrimonio 87250, ROA 10.25 %, ROE 19.77 % y liquidez 1.73 veces. Se conserva activos = pasivos + patrimonio. Con pérdidas, aumentar ventas al mismo margen negativo incrementa las pérdidas.

## Referencias

- [CFA Institute: Financial Analysis Techniques](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/financial-analysis-techniques)
- [Chart.js: integración](https://www.chartjs.org/docs/latest/getting-started/integration)

Ejemplo de rentabilidad: utilidad 15000, ventas 200000, activos 150000 y patrimonio 75000 → ROA 10 %, ROE 20 % y margen 7.5 %. El ejemplo de balance incluye cuentas por pagar de 25000 a 40000 → crecimiento 60 %.
