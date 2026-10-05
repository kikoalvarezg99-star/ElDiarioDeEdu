/** Traduce los errores más habituales de Supabase a mensajes claros. */
export function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (m.includes("user already registered"))
    return "Ese correo ya tiene cuenta. Usa «Entrar».";
  if (m.includes("password should be at least"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("email not confirmed"))
    return "Debes confirmar tu correo antes de entrar.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos. Espera un momento y vuelve a probar.";
  if (m.includes("invitación no válida"))
    return "El código no es válido o ha caducado. Pídele uno nuevo a tu dietista.";
  if (m.includes("ya tiene perfil"))
    return "Esta cuenta ya está configurada.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "No hay conexión con el servidor. Revisa tu Internet.";
  return message;
}
