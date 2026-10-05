/** Las seis medidas corporales (perímetros), con el color de la guía visual. */
export const PERIMETERS = [
  {
    code: "neck",
    label: "Cuello",
    color: "#3b82f6",
    hint: "Justo por debajo de la nuez, con la cinta horizontal.",
  },
  {
    code: "arm",
    label: "Brazo",
    color: "#eab308",
    hint: "A mitad de camino entre el hombro y el codo, con el brazo relajado.",
  },
  {
    code: "waist",
    label: "Cintura",
    color: "#111827",
    hint: "En la parte más estrecha del tronco, por encima del ombligo.",
  },
  {
    code: "abdomen",
    label: "Abdomen",
    color: "#22c55e",
    hint: "A la altura del ombligo.",
  },
  {
    code: "hip",
    label: "Cadera",
    color: "#f97316",
    hint: "En la zona más ancha de los glúteos.",
  },
  {
    code: "thigh",
    label: "Muslo",
    color: "#6b7280",
    hint: "Justo debajo del glúteo, con la pierna relajada.",
  },
] as const;

export const PERIMETER_CODES: string[] = PERIMETERS.map((p) => p.code);
