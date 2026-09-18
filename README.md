# GestiCode · Consultorio financiero

Proyecto académico de gestión financiera. HTML, CSS y JavaScript sin servidor de datos ni dependencias de ejecución.

## Abrir

Abre `dist/index.html` en el navegador. También puedes ejecutar `node preview.cjs` y visitar http://127.0.0.1:4173. Las fuentes web son opcionales; la aplicación y sus cálculos funcionan sin conexión.

## Módulos

- Salud financiera: cuatro respuestas Sí/No alimentan un árbol de decisiones. Los problemas de pago, caja y deuda tienen prioridad sobre la acumulación de inventario.
- Análisis: balance de dos años consecutivos; comprueba activos = pasivos + patrimonio. Calcula estructura vertical, variación absoluta y variación horizontal. Una base nula o negativa no produce un porcentaje horizontal interpretable.
- Rentabilidad: ROA, ROE y margen neto, con saldos al cierre. Admite pérdidas y exige denominadores positivos.

## Organización

- `dist/index.html`: interfaz, navegación y formularios.
- `dist/styles.css`: diseño adaptable y estados visuales.
- `dist/app.js`: eventos, validaciones, cálculos y diagnósticos.

Los rangos de salud son reglas **didácticas**, no estándares universales. Están explicados en la interfaz y pueden ajustarse en `app.js`. Los datos se mantienen únicamente en la página abierta, se pierden al recargar y no se envían a un servidor.

Ejemplo de rentabilidad: utilidad 15000, ventas 200000, activos 150000 y patrimonio 75000 → ROA 10 %, ROE 20 % y margen 7.5 %. El ejemplo de balance incluye cuentas por pagar de 25000 a 40000 → crecimiento 60 %.
