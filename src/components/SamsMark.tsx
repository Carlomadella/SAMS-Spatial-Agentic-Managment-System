/**
 * Il mark SAMS: un cubo isometrico (la stanza) con dentro l'agente rossonero sulla sua
 * pedana. Stesso disegno dei file in `media/logo/`. Il contorno del cubo usa
 * `currentColor`, così segue il colore del testo intorno (bianco sul tema scuro).
 */
export function SamsMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <g transform="translate(0 7)" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
        <polygon points="8,34 32,22 32,4 8,16" />
        <polygon points="32,22 56,34 56,16 32,4" />
        <polyline points="8,34 32,46 56,34" />
      </g>
      <ellipse cx="32" cy="43" rx="10" ry="4.5" fill="none" stroke="#e30613" strokeWidth="2" />
      {/* gambe e piedi */}
      <rect x="28.36" y="37.29" width="2.7" height="5.67" rx="1.35" fill="#be0a19" />
      <rect x="32.95" y="37.29" width="2.7" height="5.67" rx="1.35" fill="#be0a19" />
      <rect x="28.15" y="41.61" width="3.1" height="1.35" rx="0.54" fill="#aa0814" />
      <rect x="32.74" y="41.61" width="3.1" height="1.35" rx="0.54" fill="#aa0814" />
      {/* braccia */}
      <rect x="25.52" y="28.11" width="2.43" height="5.67" rx="1.21" fill="#be0a19" />
      <rect x="36.05" y="28.11" width="2.43" height="5.67" rx="1.21" fill="#be0a19" />
      <circle cx="26.73" cy="33.78" r="1.35" fill="#aa0814" />
      <circle cx="37.27" cy="33.78" r="1.35" fill="#aa0814" />
      {/* busto */}
      <rect x="27.55" y="26.76" width="8.91" height="8.64" rx="2.43" fill="#e30613" />
      <rect x="29.16" y="28.38" width="5.67" height="5.94" rx="1.62" fill="#aa0814" />
      <circle cx="32" cy="29.59" r="0.68" fill="#ffffff" />
      {/* antenna e testa */}
      <rect x="31.76" y="16.5" width="0.47" height="2.16" rx="0.23" fill="#aa0814" />
      <circle cx="32" cy="15.96" r="0.81" fill="#e30613" />
      <rect x="26.6" y="21.09" width="1.35" height="3.24" rx="0.54" fill="#aa0814" />
      <rect x="36.05" y="21.09" width="1.35" height="3.24" rx="0.54" fill="#aa0814" />
      <rect x="27.55" y="18.66" width="8.91" height="7.83" rx="2.7" fill="#e30613" />
      <rect x="28.36" y="20.41" width="7.29" height="4.05" rx="1.76" fill="#000000" />
      <circle cx="30.38" cy="22.3" r="0.74" fill="#ffffff" />
      <circle cx="33.62" cy="22.3" r="0.74" fill="#ffffff" />
    </svg>
  );
}
