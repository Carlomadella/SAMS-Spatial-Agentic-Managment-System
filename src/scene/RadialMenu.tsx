import type { LucideIcon } from "lucide-react";

export interface RadialItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

/**
 * The signature SAMS pie-menu. Rendered inside a drei <Html> anchored to the
 * selected agent, so it floats in the 3D scene above the character's head.
 */
export function RadialMenu({
  items,
  color,
  initial,
}: {
  items: RadialItem[];
  color: string;
  initial: string;
}) {
  const radius = 52;
  const n = items.length;

  return (
    <div className="pointer-events-none relative" style={{ width: 0, height: 0 }}>
      {/* center hub */}
      <div
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-glow ring-2 ring-white/30"
        style={{ background: color }}
      >
        {initial}
      </div>

      {items.map((item, i) => {
        // start at the top, go clockwise
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            title={item.label}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
            }}
            className={[
              "pointer-events-auto absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
              "border backdrop-blur transition-all hover:scale-110",
              item.danger
                ? "border-rose-400/40 bg-rose-500/20 text-rose-200 hover:bg-rose-500/40"
                : "border-white/15 bg-ink-800/90 text-slate-200 hover:bg-ink-600 hover:text-white",
            ].join(" ")}
            style={{ left: x, top: y }}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}
