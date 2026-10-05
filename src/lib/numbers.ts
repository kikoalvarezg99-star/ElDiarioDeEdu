/** Convierte "72,4" o "72.4" en número (NaN si no es válido). */
export function num(s: string): number {
  return Number(s.trim().replace(",", "."));
}

/** Formatea un número a la española: 72,4 */
export function fmtNum(n: number, max = 2): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: max });
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Bajo peso";
  if (bmi < 25) return "Peso normal";
  if (bmi < 30) return "Sobrepeso";
  return "Obesidad";
}
