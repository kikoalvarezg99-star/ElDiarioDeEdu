/** Esquema sencillo del cuerpo con las seis líneas de medición. */
export default function CuerpoMedidas() {
  const body = "#e3ece5";
  return (
    <svg
      viewBox="0 0 200 350"
      className="mx-auto h-auto w-full max-w-[220px]"
      role="img"
      aria-label="Esquema del cuerpo con las zonas donde se miden el cuello, el brazo, la cintura, el abdomen, la cadera y el muslo"
    >
      {/* Silueta */}
      <circle cx={100} cy={30} r={20} fill={body} />
      <rect x={91} y={48} width={18} height={16} rx={4} fill={body} />
      <path
        d="M60 68 Q100 58 140 68 L147 150 Q141 175 139 205 L61 205 Q59 175 53 150 Z"
        fill={body}
      />
      <line x1={55} y1={76} x2={36} y2={178} stroke={body} strokeWidth={15} strokeLinecap="round" />
      <line x1={145} y1={76} x2={164} y2={178} stroke={body} strokeWidth={15} strokeLinecap="round" />
      <line x1={84} y1={205} x2={80} y2={335} stroke={body} strokeWidth={28} strokeLinecap="round" />
      <line x1={116} y1={205} x2={120} y2={335} stroke={body} strokeWidth={28} strokeLinecap="round" />

      {/* Líneas de medición */}
      <line x1={86} y1={60} x2={114} y2={60} stroke="#3b82f6" strokeWidth={4} strokeLinecap="round" />
      <line x1={36} y1={114} x2={58} y2={106} stroke="#eab308" strokeWidth={4} strokeLinecap="round" />
      <line x1={62} y1={125} x2={138} y2={125} stroke="#111827" strokeWidth={4} strokeLinecap="round" />
      <line x1={60} y1={148} x2={140} y2={148} stroke="#22c55e" strokeWidth={4} strokeLinecap="round" />
      <line x1={61} y1={190} x2={139} y2={190} stroke="#f97316" strokeWidth={4} strokeLinecap="round" />
      <line x1={68} y1={232} x2={96} y2={232} stroke="#6b7280" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}
