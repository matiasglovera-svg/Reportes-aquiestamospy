import { redirect } from 'next/navigation';

/** Análisis ahora vive al final de Resumen: el link viejo sigue funcionando. */
export default function Analisis() {
  redirect('/resumen#analisis');
}
