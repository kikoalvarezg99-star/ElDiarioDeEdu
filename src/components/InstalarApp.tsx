"use client";

import { useEffect, useState } from "react";
import { Card, btn } from "./ui";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Invita a instalar la app en el móvil (Android: botón; iPhone: instrucciones). */
export default function InstalarApp() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIP);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  if (installed || (!evt && !ios)) return null;

  return (
    <Card title="Instala la app">
      {evt ? (
        <>
          <p className="mb-3 text-sm text-ink/70">Ten la app en tu pantalla de inicio, como cualquier otra.</p>
          <button
            type="button"
            className={btn}
            onClick={() => {
              void evt.prompt();
              setEvt(null);
            }}
          >
            Instalar
          </button>
        </>
      ) : (
        <p className="text-sm text-ink/70">
          En iPhone: pulsa el botón de compartir de Safari y elige <strong>«Añadir a pantalla de inicio»</strong>.
        </p>
      )}
    </Card>
  );
}
