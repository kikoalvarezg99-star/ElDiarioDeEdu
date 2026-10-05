import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Política de privacidad · Eduardo Rivero" };

export default function PrivacidadPage() {
  const h = "mt-6 text-lg font-bold text-brand";
  return (
    <main className="mx-auto max-w-2xl space-y-3 p-5 pb-16 text-sm leading-relaxed">
      <Link href="/" className="text-xs text-brand underline">
        ← Volver
      </Link>
      <h1 className="text-2xl font-bold text-brand">Política de privacidad</h1>
      <p className="text-ink/60">Última actualización: {LEGAL.actualizado}</p>

      <h2 className={h}>1. Quién es el responsable</h2>
      <p>
        {LEGAL.responsable} · NIF {LEGAL.nif} · {LEGAL.direccion} · Contacto: {LEGAL.email}
      </p>

      <h2 className={h}>2. Qué datos tratamos</h2>
      <p>
        Datos de identificación y contacto (nombre, correo, teléfono, fecha de nacimiento) y{" "}
        <strong>datos de salud</strong>: peso, medidas corporales, revisiones, fotos de progreso y de comidas,
        planes nutricionales, documentos (analíticas, informes), notas del dietista y mensajes.
      </p>

      <h2 className={h}>3. Para qué los usamos</h2>
      <p>
        Para prestarte el servicio de asesoramiento nutricional: hacer tu seguimiento, preparar tu plan,
        comunicarnos contigo y avisarte de novedades. No los usamos para publicidad ni los vendemos.
      </p>

      <h2 className={h}>4. Base legal</h2>
      <p>
        Tu <strong>consentimiento explícito</strong> (art. 9.2.a RGPD) para los datos de salud, que das al
        entrar por primera vez en la aplicación, y la ejecución del servicio que has contratado (art. 6.1.b).
        Puedes retirar el consentimiento en cualquier momento; ello no afecta al tratamiento ya realizado.
      </p>

      <h2 className={h}>5. Quién puede ver tus datos</h2>
      <p>
        Solo tú y el equipo del dietista. Cada cliente solo ve sus propios datos. Tus archivos son privados
        y se sirven mediante enlaces temporales. Usamos como proveedor de infraestructura a Supabase (base de
        datos y almacenamiento) y GitHub (alojamiento de la web), con los que existen las garantías contractuales
        de protección de datos aplicables.
      </p>

      <h2 className={h}>6. Cuánto tiempo los conservamos</h2>
      <p>
        Mientras dure la relación y, después, durante los plazos que exija la normativa aplicable a la
        documentación clínica y sanitaria. Pasado ese plazo se eliminan.
      </p>

      <h2 className={h}>7. Tus derechos</h2>
      <p>
        Acceso, rectificación, supresión, limitación, oposición y portabilidad. Desde «Mi cuenta» puedes{" "}
        <strong>descargar tus datos</strong> y <strong>solicitar su borrado</strong>. También puedes escribir a{" "}
        {LEGAL.email}. Si consideras que no tratamos bien tus datos, puedes reclamar ante la Agencia Española de
        Protección de Datos (www.aepd.es).
      </p>

      <h2 className={h}>8. Seguridad</h2>
      <p>
        Acceso solo con cuenta e invitación, comunicaciones cifradas, permisos por usuario aplicados en la
        propia base de datos y archivos privados.
      </p>

      <p className="mt-8 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
        Texto base preparado para la aplicación. Antes de usarla con clientes reales debe completarse con los
        datos del responsable y revisarse por un profesional jurídico.
      </p>
    </main>
  );
}
