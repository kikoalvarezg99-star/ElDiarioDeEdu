# DietApp: configuración 100 % gratuita (fase de pruebas)

Plataforma para dietistas: fichas de cliente, pesos y gráficas, fotos, recetas,
planes, mensajes y documentos. Se publica como **web instalable (PWA)** y como
**APK de Android**, todo sin coste mientras se prueba.

## Arquitectura gratuita

| Pieza | Servicio | Coste |
|---|---|---|
| Código | **GitHub** (repositorio) | Gratis |
| Web | **GitHub Pages** (Next.js exportado como sitio estático) | Gratis |
| APK Android | **Capacitor** + **GitHub Actions** (compila el APK en los servidores de GitHub) | Gratis |
| Base de datos, login y archivos | **Supabase** plan Free (región UE) | Gratis |

No hace falta servidor propio: la app habla directamente con Supabase y **la
seguridad la imponen las políticas RLS de `schema.sql`**, no la interfaz.

## Pasos de configuración

1. **GitHub:** crea un repositorio vacío y pasa su nombre (`usuario/repositorio`).
2. **Supabase:** crea un proyecto en https://supabase.com con región **Frankfurt (UE)**.
3. En *SQL Editor*, pega y ejecuta **todo** `schema.sql`.
4. En *Authentication → Providers* deja activado el email.
5. En *Project Settings → API* copia la **Project URL** y la clave **anon**.
   La clave anon es pública por diseño; la protección real son las políticas RLS.
   **Nunca** pongas la clave `service_role` en el código.
6. Guarda esas dos claves como *Secrets* del repositorio en GitHub
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## Cómo se da de alta la gente

- **Dietista:** se registra y llama a `create_clinic(...)`; queda como `owner`.
- **Cliente:** el dietista crea la ficha, genera una invitación (`client_invites`)
  y el cliente se registra y canjea el código con `claim_invite(...)`.

## Limitaciones del plan gratuito de Supabase (importante)

- El proyecto **se pausa tras 1 semana sin actividad**.
- **No incluye copias de seguridad.**
- Solo 500 MB de base de datos y 1 GB de archivos (las fotos se comprimen en el móvil).

**Úsalo solo con datos de prueba.** Antes de meter clientes reales, pasa a
Supabase Pro (25 $/mes) para tener copias de seguridad y sin pausas. Es un cambio
de plan, no hay que tocar el código.

## Legal (RGPD)

Los datos de salud son categoría especial. Antes de usar la app con clientes reales
hay que añadir política de privacidad, consentimiento explícito (tabla `consents`)
y revisar el contrato con Supabase como encargado del tratamiento. Conviene que lo
valide un profesional legal.

## Estado

- [x] Esquema SQL con RLS, almacenamiento privado, notificaciones y alta por invitación
- [ ] Proyecto Next.js (login, dashboard, ficha de cliente)
- [ ] Pesos, medidas y gráficas
- [ ] Fotos con compresión y galería
- [ ] Recetas, planes y comidas realizadas
- [ ] Mensajería y avisos
- [ ] PWA y GitHub Action que genera el APK
