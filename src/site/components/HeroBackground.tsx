import roomHero from "../assets/room-hero.jpg";
import type { HeroKind } from "../data/heroVariants";

/**
 * Sfondo della hero, nelle cinque varianti di Roadmap 5. Tutte condividono lo **scrim** —
 * la sfumatura che fonde lo sfondo nel colore della pagina: senza, il testo bianco su un
 * punto chiaro della stanza diventa illeggibile, e cambiando palette il problema si sposta
 * invece di sparire. Per la stessa ragione i bagliori usano i token (`--c-accent`) e non
 * hex fissi: seguono la palette scelta, qualunque sia.
 *
 * `aria-hidden` su tutto: è decorazione, non contenuto — uno screen reader non deve
 * annunciare nulla di qui.
 */
export function HeroBackground({ kind }: { kind: HeroKind }) {
  const showRoom = kind === "immagine" || kind === "video";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* la stanza vera, ancorata in alto e schiarita così i robot restano riconoscibili */}
      {kind === "immagine" && (
        <img src={roomHero} alt="" className="absolute inset-x-0 top-0 h-[120%] w-full object-cover object-top opacity-[0.38]" />
      )}

      {/* Video: `poster` è lo screenshot, così su rete lenta la hero non è mai vuota — il
          video subentra quando è pronto. muted+playsInline perché l'autoplay funzioni. */}
      {kind === "video" && (
        <video
          autoPlay
          loop
          muted
          playsInline
          poster={roomHero}
          className="absolute inset-x-0 top-0 h-[120%] w-full object-cover object-top opacity-[0.38]"
        >
          <source src="/room-hero.webm" type="video/webm" />
        </video>
      )}

      {/* scrim verticale: fonde lo sfondo nel colore della pagina (regge ogni palette e tema) */}
      {showRoom && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgb(var(--c-ink-950) / 0.55) 0%, rgb(var(--c-ink-950) / 0.72) 45%, rgb(var(--c-ink-950)) 100%)",
          }}
        />
      )}

      {/* bagliori nei colori della palette — in tutte le varianti tranne la piatta */}
      {kind !== "piatta" && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(900px 460px at 50% -10%, rgb(var(--c-accent) / 0.20), transparent 60%), radial-gradient(700px 400px at 85% 20%, rgb(var(--c-accent-2) / 0.12), transparent 60%)",
          }}
        />
      )}

      {/* Reticolo: sopra allo screenshot dà profondità, da solo dà il carattere «tecnico».
          Disegnato con `--c-mut` (il grigio della palette) e non con uno slate fisso: su
          tema chiaro un grigio pensato per il fondo scuro sparirebbe, e la variante
          «griglia» resterebbe senza la sua griglia. */}
      {(kind === "immagine" || kind === "griglia") && (
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--c-mut) / 0.45) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-mut) / 0.45) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(circle at 50% 30%, black, transparent 75%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 30%, black, transparent 75%)",
          }}
        />
      )}
    </div>
  );
}
