# Ejercicios para probar «Pegar tabla»

Empresas y cifras inventadas. Se usan para comprobar el importador y los módulos que se alimentan de él.

**Cómo usarlos**
1. Abre GestiCode → **Estados financieros**.
2. Abre el archivo `.txt` del ejercicio, selecciona todo (Ctrl+A) y copia (Ctrl+C).
3. En la tabla que corresponda (balance o estado de resultados) pulsa **⇪ Pegar tabla…**, pega el texto y pulsa **Analizar tabla**.
4. Revisa, y pulsa **Reemplazar las cuentas actuales**. Cada importación se puede deshacer.

---

## Ejercicio 1 · Comercial Volcán, S.A. (completo)

Archivos: `1-balance-comercial-volcan.txt` y `1-resultados-comercial-volcan.txt`. Importa primero el balance y después el estado de resultados.

**Qué debes ver en la ventana de revisión**

| | Balance | Resultados |
|---|---|---|
| Cuentas propuestas | 19 | 11 |
| Totales del documento | 9 «COINCIDE» | 7 «COINCIDE» |
| Cuadre | CUADRA en T1 y T2 | — |
| Columnas | 1 → T2 · 2025, 2 → T1 · 2024 | igual |
| Cuentas con dudas | *Inversiones en acciones*, *Anticipos de clientes* | *Número de acciones comunes* |

Las dudas son a propósito: esas cuentas no están en el catálogo, y el importador toma su clasificación del encabezado (o del nombre) y **te pide confirmarla**. Verás también que «Menos: Depreciación acumulada (620,000)» queda como cuenta que resta, sin doble negativo, y «Menos: Devoluciones…» como venta que resta.

**Resultados esperados** (T2 · 2025, promedios T1/T2, 365 días, compras estimadas al 70 % del costo)

| Indicador | Valor |
|---|---|
| Capital de trabajo neto | 1,097,000.00 |
| Razón corriente | 2.41 × |
| Prueba ácida | 1.46 × |
| Rotación de inventarios · días | 5.73 × · 63.65 días |
| Período promedio de cobro | 46.03 días |
| Período promedio de pago | 57.87 días |
| Rotación de activos totales | 1.64 × |
| Índice de deuda | 41.93 % |
| Cobertura de intereses | 7.62 × |
| Margen bruto · neto | 34.92 % · 9.56 % |
| ROA · ROE | 15.65 % · 27.41 % |
| Du Pont (9.56 % × 1.64 × 1.75) | 27.41 % |
| Utilidad por acción | 5.62 |

Utilidad neta 602,000; utilidad para comunes 562,000. El balance en T de **Resumen** debe mostrar el sello **CUADRA**.

### Variantes con error (para ver la detección)
Antes de analizar, cambia **una** cifra en el texto pegado (o después, en la fila de la ventana de revisión):

- **Dígito mal copiado:** en *Cuentas por cobrar* pon `601,000` en vez de `610,000` (T2).
  Verás «Total activos corrientes → NO COINCIDE T2 +9,000», «Total activos → NO COINCIDE T2 +9,000» y el cuadre de T2 en **NO CUADRA**, con diferencia −9,000. T1 sigue bien: el error está solo en T2. Corrige la cifra en la fila y todo vuelve a «COINCIDE» sin pegar de nuevo.
- **Cifras transpuestas:** en *Inventarios* pon `470,000` en vez de `740,000`. La diferencia es de 270,000.

---

## Ejercicio 2 · Papelería El Roble (solo totales)

Archivo: `2-solo-totales-papeleria-el-roble.txt` (balance).

El documento no trae todas las partes del balance: solo activos corrientes, un detalle de inventarios y pasivos corrientes.

**Qué debes ver:** una sola columna (T2); el total *Activos corrientes* se importa como dato y *Inventarios* pasa a **«De los cuales»** para no contarse dos veces; el cuadre sale «NO CUADRA» (faltan partes) y aparece la casilla **«activar Balance parcial con las partes que sí trae»**. Déjala marcada.

**Resultados esperados:** capital de trabajo **700,000**, razón corriente **2.00 ×**, prueba ácida **1.20 ×**. Las razones de deuda y rentabilidad quedan sin calcular y dicen qué partes faltan.

---

## Ejercicio 3 · Industrias La Ceiba (texto de un PDF, en miles)

Archivo: `3-texto-de-pdf-en-miles-industrias-la-ceiba.txt` (balance).

Simula un texto copiado de un PDF: puntos guía, espacios en lugar de tabuladores, paréntesis y cifras «en miles de córdobas».

**Qué debes ver:** 8 cuentas; años 2025/2024 detectados del encabezado; un aviso *«El texto menciona cifras “en miles”»* con el botón **Aplicar ×1,000** (púlsalo); 5 totales «COINCIDE»; cuadre correcto. *Préstamos bancarios a largo plazo* queda como pasivo no corriente con el rol *Deuda a largo plazo* (con duda), y *Patrimonio* se importa como dato.

**Resultados esperados (con ×1,000):** capital de trabajo **620,000**, razón corriente **3.38 ×**, prueba ácida **1.65 ×**, índice de deuda **44.9 %**.

---

## Ejercicio 4 · Dayton Products (resuelto en clase)

Archivos: `4-dayton-balance.txt` y `4-dayton-resultados.txt` (miles de dólares; años 2012 y 2011).

**Cómo:** pega el balance (Estados → Balance → «Pegar tabla…» → Reemplazar) y luego el estado de resultados. El importador reconoce «Capital» como el encabezado del patrimonio, «Depreciación y agotamientos acumulados» como cuenta que resta, «Total de pasivo + capital» y la *Tasa de impuestos*. Avisa que no trae dividendos preferentes: queda la fila en blanco y debes escribir **0** en ambos años.

**Utilidades (de la hoja):** utilidad bruta 69,208 / 75,879; utilidad operativa 11,177 / 21,658; **utilidad antes de impuestos 13,926 / 24,688**; utilidad neta después de impuestos **9,006.78 / 15,431.23** (tasas 35.324 % y 37.495 %).

**Para reproducir la hoja de razones** (Estados → «Períodos y metodología»): elige *Costo de ventas + variación de inventario* y marca *Toda la venta es a crédito*. Resultados de 2012:

| Razón | Valor |
|---|---|
| Capital de trabajo neto | 5,116 |
| Razón corriente · prueba ácida | 1.15 × · 0.91 × |
| Rotación · edad del inventario | 13.74 × · 26.57 días |
| Rotación · período de cobro (PPC) | 8.79 × · 41.53 días |
| Rotación · período de pago (PPP) | 5.99 × · 60.89 días |
| Rotación de activos fijos · totales | 1.94 × · 1.21 × |

**Ojo:** la hoja de Dayton dice que las compras son el 70 % del costo de ventas, pero su cifra (109,865) es costo de ventas + variación de inventario. Con el 70 % el período de pago sale ≈ 87 días, no 60.89. Pregunta al profesor qué criterio pide.

---

## Ejercicio 5 · Mundo Moda S.A. (resuelto en clase)

Archivo: `5-mundo-moda-balance.txt` (U$ miles; copiado tal cual desde Excel, con «Dic. 31/2018»).

**Qué debes ver:** años 2018 y 2019 detectados de las fechas; 18 cuentas; **11 totales «COINCIDE»** (incluidos los subtotales de equipo con su depreciación y los «Total» sueltos); cuadre 871,475 y 1,094,142.25.

**Análisis por cuenta** (pestaña Análisis → «Balance general, cuenta por cuenta»): Banco +195.41 % (23.85 % del activo en 2019), Clientes −39.96 %, Inventario −64.65 %, Utilidades +86.24 %, Total activos +25.55 %, pasivo 32.55 % → 30.21 %, capital 67.45 % → 69.79 %. Capital de trabajo neto **147,215 → 189,825.25** (+28.94 %).
