import roomHero from "../assets/room-hero.jpg";

/**
 * Sfondo della hero: il video della stanza, con lo screenshot come poster (su rete lenta la
 * hero non è mai vuota: il video subentra quando è pronto). Sopra, lo **scrim** — la
 * sfumatura che fonde lo sfondo nel colore della pagina: senza, il testo bianco su un punto
 * chiaro della stanza diventa illeggibile — e due bagliori nei colori d'accento.
 *
 * `aria-hidden` su tutto: è decorazione, non contenuto — uno screen reader non deve
 * annunciare nulla di qui.
 */
export function HeroBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* muted+playsInline perché l'autoplay funzioni */}
      <video
        autoPlay
        loop
        muted
        playsInline
        poster={roomHero}
        className="absolute inset-x-0 top-0 h-[120%] w-full object-cover object-top opacity-50"
      >
        <source src="/room-hero.webm" type="video/webm" />
      </video>

      {/* scrim verticale: fonde lo sfondo nel colore della pagina (regge entrambi i temi) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgb(var(--c-ink-950) / 0.55) 0%, rgb(var(--c-ink-950) / 0.72) 45%, rgb(var(--c-ink-950)) 100%)",
        }}
      />

      {/* bagliori nei colori d'accento */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(900px 460px at 50% -10%, rgb(var(--c-accent) / 0.20), transparent 60%), radial-gradient(700px 400px at 85% 20%, rgb(var(--c-accent-2) / 0.12), transparent 60%)",
        }}
      />
    </div>
  );
}
