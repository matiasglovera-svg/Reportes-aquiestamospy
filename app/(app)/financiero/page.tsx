'use client';

import { useState } from 'react';
import { barra, base, Grafico, linea, usePaleta } from '@/components/chart';
import { useDatos } from '@/components/datos';
import { PestanasFinanciero } from '@/components/financiero-tabs';
import { Kpi } from '@/components/kpi';
import { Tabla } from '@/components/tabla';
import { Etiqueta, Panel, Segmentos, TituloSeccion } from '@/components/ui';
import { gs, gsCorto, mesCorto, mesLargo, pct } from '@/lib/format';
import { categoriasDelAnio, rFinancieroMensual, rFinancieroTotales, rFlujo, rGastosCategoria } from '@/lib/reportes';

const titulo = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace('rr. hh.', 'RR. HH.');
const nombreCategoria = (c: string) => (c === 'RECURSOS HUMANOS' ? 'RR. HH.' : c === 'SET' || c === 'IVA' ? c : titulo(c));

export default function Financiero() {
  const { dataset: d, mes } = useDatos();
  const p = usePaleta();
  const [vistaGastos, setVistaGastos] = useState<'categoria' | 'total'>('categoria');
  if (!d || !mes) return null;

  const f = d.financiero;
  const meses = f.meses.filter((m) => m.ingresos !== null || m.gastos !== null);
  const categorias = meses.map((m) => mesCorto(m.mes) + (m.enCurso ? '\nen curso' : ''));
  const elegido = f.meses[mes - 1];
  const nCerrados = f.mesesCerrados.length;
  const rango = nCerrados ? `${mesLargo(f.mesesCerrados[0])} a ${mesLargo(f.mesesCerrados[nCerrados - 1])}` : 'sin meses cerrados';
  const enCurso = elegido.enCurso ? <Etiqueta tono="vivo">En curso</Etiqueta> : undefined;
  const totales = rFinancieroTotales(d);
  const mensual = rFinancieroMensual(d);
  const serieCerrados = (campo: 'ingresos' | 'gastos' | 'ganancia' | 'rentabilidad') => f.meses.filter((m) => f.mesesCerrados.includes(m.mes)).map((m) => m[campo]);

  // El mes en curso va atenuado: todavía no es comparable con los cerrados.
  const tono = (m: (typeof meses)[number], color: string) => (m.enCurso ? { color: p.atenuado, decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [3, 3], rotation: -Math.PI / 4, color: p.superficie } } : { color });

  const opIngresos = {
    ...base(p, { categorias, formatoEje: gsCorto, formatoValor: gs }),
    series: [barra(p, { name: 'Ingresos', data: meses.map((m) => ({ value: m.ingresos, itemStyle: tono(m, p.series[0]) })) })],
  };

  // RR. HH. + las tres categorías de mayor peso en el año; el resto se agrupa.
  const cats = categoriasDelAnio(d);
  const principales = ['RECURSOS HUMANOS', ...cats.filter((c) => c !== 'RECURSOS HUMANOS').slice(0, 3)].filter((c) => cats.includes(c));
  const hayResto = cats.length > principales.length;
  const valorCat = (m: (typeof meses)[number], c: string) => m.categorias.find((x) => x.categoria === c)?.valor ?? 0;
  const opGastos =
    vistaGastos === 'total'
      ? { ...base(p, { categorias, formatoEje: gsCorto, formatoValor: gs }), series: [barra(p, { name: 'Gastos', data: meses.map((m) => ({ value: m.gastos, itemStyle: tono(m, p.series[0]) })) })] }
      : {
          ...base(p, { categorias, leyenda: true, formatoEje: gsCorto, formatoValor: gs }),
          series: [
            ...principales.map((c, i) => barra(p, { name: nombreCategoria(c), stack: 'g', color: p.series[i], data: meses.map((m) => valorCat(m, c)), itemStyle: { borderRadius: 0, borderColor: p.superficie, borderWidth: 1 } })),
            ...(hayResto ? [barra(p, { name: 'Resto', stack: 'g', color: p.series[4], data: meses.map((m) => (m.gastos ?? 0) - principales.reduce((a, c) => a + valorCat(m, c), 0)), itemStyle: { borderRadius: 0, borderColor: p.superficie, borderWidth: 1 } })] : []),
          ],
        };

  const opCaja = {
    ...base(p, { categorias, formatoEje: gsCorto, formatoValor: gs }),
    series: [linea({ name: 'Caja al cierre', data: meses.map((m) => m.cajaCierre), color: p.series[1], areaStyle: { opacity: 0.08 } })],
  };

  const opRent = {
    ...base(p, { categorias, formatoEje: (v) => `${Math.round(v * 100)} %`, formatoValor: pct }),
    series: [
      barra(p, {
        name: 'Rentabilidad',
        data: meses.map((m) => ({ value: m.rentabilidad, itemStyle: { ...((m.rentabilidad ?? 0) < 0 ? { color: p.alerta } : tono(m, p.series[0])), borderRadius: (m.rentabilidad ?? 0) < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0] } })),
        markLine:
          f.rentabilidadPromedio !== null
            ? { silent: true, symbol: 'none', lineStyle: { color: p.tenue, type: 'dashed', width: 1 }, label: { formatter: `Promedio ${pct(f.rentabilidadPromedio)}`, color: p.tenue, position: 'insideEndTop', fontSize: 11 }, data: [{ yAxis: f.rentabilidadPromedio }] }
            : undefined,
      }),
    ],
  };

  const fuenteIng = 'INGRESOS, tablas de detalle por mes (columna VALOR)';
  const fuenteGas = 'GASTOS, tablas de detalle por mes (columna VALOR)';
  const bruta = (v: number | null) => <>Ganancia bruta: <span className="num font-semibold text-text">{gs(v)}</span></>;

  const grupos = [
    { nombre: 'Facturación', campo: 'ingresos' as const, agg: f.ingresos, fuente: fuenteIng, formula: 'Σ de la columna VALOR del bloque de cada mes (lo efectivamente cobrado).', invertir: false },
    { nombre: 'Gastos', campo: 'gastos' as const, agg: f.gastos, fuente: fuenteGas, formula: 'Σ de la columna VALOR del bloque de cada mes. Lo anotado en comentarios no se suma.', invertir: true },
    { nombre: 'Ganancia', campo: 'ganancia' as const, agg: f.ganancia, fuente: `${fuenteIng} y ${fuenteGas}`, formula: 'Ingresos − Gastos totales (ganancia real). Ganancia bruta = Ingresos − Gasto en personal.', invertir: false },
  ];

  return (
    <>
      <PestanasFinanciero />
      <TituloSeccion nota={`Promedios y totales sobre ${nCerrados} meses cerrados (${rango})`}>Financiero</TituloSeccion>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {grupos.flatMap((g, i) => {
          const previo = f.meses[mes - 2]?.[g.campo] ?? null;
          const actual = elegido[g.campo];
          const esGanancia = g.campo === 'ganancia';
          return [
            <Kpi
              key={`${g.campo}-p`}
              indice={i * 3}
              titulo={`${g.nombre} promedio`}
              valor={g.agg.promedio}
              formato={gs}
              negativoEnAlerta
              serie={serieCerrados(g.campo)}
              reporte={totales}
              pie={esGanancia ? bruta(f.gananciaBruta.promedio) : `Promedio simple de ${nCerrados} meses cerrados.`}
              info={{ formula: `Promedio simple mensual de los meses cerrados. ${g.formula}`, fuente: g.fuente }}
            />,
            <Kpi
              key={`${g.campo}-m`}
              indice={i * 3 + 1}
              titulo={`${g.nombre} de ${mesLargo(mes)}`}
              valor={actual}
              formato={gs}
              negativoEnAlerta
              etiqueta={enCurso}
              reporte={mensual}
              variacion={elegido.enCurso ? undefined : { fraccion: actual !== null && previo ? (actual - previo) / Math.abs(previo) : null, etiqueta: 'vs mes anterior', invertir: g.invertir }}
              pie={esGanancia ? bruta(elegido.gananciaBruta) : elegido.enCurso ? 'Mes en curso: no entra en promedios ni totales.' : 'Cambiá el mes desde la barra superior.'}
              info={{ formula: g.formula, fuente: (g.campo === 'gastos' ? elegido.fuente.gastos : g.campo === 'ingresos' ? elegido.fuente.ingresos : null) ?? g.fuente, nota: esGanancia && elegido.planilla.gananciaReal !== null ? `Control: GANANCIA REAL de FLUJO CAJA = ${gs(elegido.planilla.gananciaReal)}. La fila GANANCIA BRUTA de la planilla (${gs(elegido.planilla.gananciaBruta)}) usa otra definición y es solo referencia.` : undefined }}
            />,
            <Kpi
              key={`${g.campo}-t`}
              indice={i * 3 + 2}
              titulo={`${g.nombre} total`}
              valor={g.agg.total}
              formato={gs}
              negativoEnAlerta
              reporte={totales}
              pie={
                esGanancia ? (
                  bruta(f.gananciaBruta.total)
                ) : (
                  <>
                    Acumulado incl. mes en curso: <span className="num font-semibold text-text">{gs(g.agg.acumulado)}</span>
                  </>
                )
              }
              info={{ formula: `Suma de los meses cerrados. ${g.formula}`, fuente: g.fuente, nota: esGanancia ? `Acumulado incluyendo el mes en curso: ${gs(g.agg.acumulado)}.` : undefined }}
            />,
          ];
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel titulo="Ingresos por mes" reporte={mensual} info={{ formula: 'Σ de la columna VALOR del bloque de cada mes.', fuente: fuenteIng, nota: 'El mes en curso se muestra atenuado y con trama.' }}>
          <Grafico opcion={opIngresos} descripcion={`Ingresos por mes: ${meses.map((m) => `${mesLargo(m.mes)} ${gs(m.ingresos)}`).join('; ')}`} />
        </Panel>
        <Panel
          titulo="Gastos por mes"
          reporte={rGastosCategoria(d)}
          acciones={<Segmentos etiqueta="Vista de gastos" valor={vistaGastos} onCambio={setVistaGastos} opciones={[{ valor: 'categoria', texto: 'Por categoría' }, { valor: 'total', texto: 'Total' }]} />}
          info={{ formula: 'Σ de VALOR agrupada por CONCEPTO. Un concepto repetido en varias filas se suma.', fuente: fuenteGas, nota: 'El gráfico muestra RR. HH. y las tres categorías de mayor peso del año; el resto se agrupa. El CSV trae todas las categorías.' }}
        >
          <Grafico opcion={opGastos} descripcion={`Gastos por mes: ${meses.map((m) => `${mesLargo(m.mes)} ${gs(m.gastos)}`).join('; ')}`} />
        </Panel>
        <Panel
          titulo="Rentabilidad por mes"
          reporte={mensual}
          info={{ formula: 'Ganancia ÷ Ingresos de cada mes. La línea punteada es el promedio simple de los meses cerrados.', fuente: `${fuenteIng} y ${fuenteGas}`, nota: 'Control cruzado contra la fila CONVERSION de FLUJO CAJA (las diferencias se informan en Salud de datos).' }}
        >
          <Grafico opcion={opRent} descripcion={`Rentabilidad por mes: ${meses.map((m) => `${mesLargo(m.mes)} ${pct(m.rentabilidad)}`).join('; ')}`} />
        </Panel>
        <div className="grid gap-4">
          <Kpi
            indice={9}
            titulo="Rentabilidad promedio"
            valor={f.rentabilidadPromedio}
            formato={pct}
            negativoEnAlerta
            serie={serieCerrados('rentabilidad')}
            reporte={mensual}
            pie={`Promedio simple de ${nCerrados} meses cerrados.`}
            info={{ formula: 'Promedio simple de (Ganancia ÷ Ingresos) de cada mes cerrado.', fuente: `${fuenteIng} y ${fuenteGas}` }}
          />
          <Kpi
            indice={10}
            titulo={`Rentabilidad de ${mesLargo(mes)}`}
            valor={elegido.rentabilidad}
            formato={pct}
            negativoEnAlerta
            etiqueta={enCurso}
            variacion={elegido.enCurso ? undefined : { fraccion: elegido.rentabilidad !== null && f.meses[mes - 2]?.rentabilidad != null ? elegido.rentabilidad - f.meses[mes - 2].rentabilidad! : null, etiqueta: 'vs mes anterior', enPuntos: true }}
            info={{ formula: 'Ganancia ÷ Ingresos del mes.', fuente: `${fuenteIng} y ${fuenteGas}`, nota: elegido.planilla.conversion !== null ? `Control: CONVERSION de FLUJO CAJA = ${pct(elegido.planilla.conversion)}.` : undefined }}
          />
        </div>
      </div>

      <TituloSeccion nota="Caja inicial y caja al cierre según la pestaña FLUJO CAJA">Flujo de caja</TituloSeccion>
      <Panel titulo="Caja al cierre por mes" reporte={rFlujo(d)} info={{ formula: 'Caja inicial y caja al cierre tal como figuran en la planilla. Ingresos, gastos y ganancia son los calculados desde el detalle.', fuente: 'FLUJO CAJA (filas CAJA INICIAL y CAJA AL CIERRE) + detalle de INGRESOS y GASTOS' }}>
        <Grafico alto={220} opcion={opCaja} descripcion={`Caja al cierre por mes: ${meses.map((m) => `${mesLargo(m.mes)} ${gs(m.cajaCierre)}`).join('; ')}`} />
        <div className="mt-4">
          <Tabla reporte={rFlujo(d)} />
        </div>
      </Panel>
    </>
  );
}
