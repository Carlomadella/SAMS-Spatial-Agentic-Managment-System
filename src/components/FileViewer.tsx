import { useEffect, useState } from "react";
import { FileCode2, GitBranch, Loader2, X } from "lucide-react";
import { useStore } from "../store/useStore";
import { fetchFile } from "../lib/backend";

const MAX_LINES = 5000; // cap di righe renderizzate (file enormi)

// Estensioni il cui contenuto non ha senso mostrare come testo.
const BINARY_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "icns", "tif", "tiff",
  "pdf", "zip", "gz", "tgz", "tar", "rar", "7z", "bz2", "xz",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp3", "wav", "ogg", "flac", "mp4", "mov", "avi", "webm", "mkv",
  "exe", "dll", "so", "dylib", "bin", "wasm", "class", "jar",
  "docx", "xlsx", "pptx", "odt", "ods",
]);

function extOf(path: string): string {
  const dot = path.lastIndexOf(".");
  const slash = path.lastIndexOf("/");
  return dot > slash ? path.slice(dot + 1).toLowerCase() : "";
}

type State =
  | { kind: "loading" }
  | { kind: "binary" }
  | { kind: "missing" }
  | { kind: "ready"; lines: string[]; truncated: boolean };

/**
 * Visualizzatore del contenuto di un file del repo di lavoro. Si apre cliccando un
 * file nella sidebar (`openedFilePath` nello store); legge il contenuto via
 * `fetchFile` sul branch corrente. Modale in sola lettura con numeri di riga; i file
 * binari e quelli mancanti mostrano un messaggio invece di mojibake.
 */
export function FileViewer() {
  const path = useStore((s) => s.openedFilePath);
  const branch = useStore((s) => s.repoBranch);
  const close = useStore((s) => s.closeRepoFile);
  const [state, setState] = useState<State>({ kind: "loading" });

  // chiudi con Esc
  useEffect(() => {
    if (!path) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [path, close]);

  useEffect(() => {
    if (!path) return;
    if (BINARY_EXT.has(extOf(path))) {
      setState({ kind: "binary" });
      return;
    }
    let alive = true;
    setState({ kind: "loading" });
    void fetchFile(path, branch || undefined).then(({ content, exists }) => {
      if (!alive) return;
      if (!exists) {
        setState({ kind: "missing" });
        return;
      }
      const all = content.split("\n");
      setState({ kind: "ready", lines: all.slice(0, MAX_LINES), truncated: all.length > MAX_LINES });
    });
    return () => {
      alive = false;
    };
  }, [path, branch]);

  if (!path) return null;
  const name = path.slice(path.lastIndexOf("/") + 1);

  return (
    <div
      // z alto: le etichette 3D degli agenti (drei <Html>) arrivano a ~z-80, il
      // modale deve stare sopra a tutto per non farle trasparire dentro.
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 py-[6vh] backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Contenuto di ${path}`}
        className="flex max-h-[88vh] w-full max-w-3xl animate-fade-in flex-col overflow-hidden rounded-xl border border-line bg-ink-850 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileCode2 size={15} className="shrink-0 text-brand-soft" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white" title={path}>
                {name}
              </p>
              <p className="truncate text-[11px] text-mut" title={path}>
                {path}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {branch && (
              <span className="flex items-center gap-1 text-[10px] text-mut" title={`branch ${branch}`}>
                <GitBranch size={10} />
                {branch}
              </span>
            )}
            <button onClick={close} aria-label="Chiudi file" className="btn h-7 w-7 px-0">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-ink-900">
          {state.kind === "loading" && (
            <div className="flex items-center gap-2 px-4 py-6 text-[12px] text-mut">
              <Loader2 size={14} className="animate-spin" /> Carico il contenuto…
            </div>
          )}
          {state.kind === "missing" && (
            <p className="px-4 py-6 text-[12px] text-mut">File non trovato sul branch <b>{branch}</b>.</p>
          )}
          {state.kind === "binary" && (
            <p className="px-4 py-6 text-[12px] text-mut">Anteprima non disponibile per un file binario.</p>
          )}
          {state.kind === "ready" && (
            <pre className="min-w-full font-mono text-[12px] leading-relaxed text-slate-200">
              <code className="block">
                {state.lines.map((line, i) => (
                  <div key={i} className="flex hover:bg-ink-800/60">
                    <span className="select-none whitespace-pre px-3 text-right text-mut/60" style={{ minWidth: "3.5rem" }}>
                      {i + 1}
                    </span>
                    <span className="whitespace-pre px-2">{line || " "}</span>
                  </div>
                ))}
              </code>
            </pre>
          )}
        </div>

        {state.kind === "ready" && state.truncated && (
          <div className="border-t border-line px-4 py-2 text-[10px] text-mut">
            Mostro le prime {MAX_LINES} righe (file troncato).
          </div>
        )}
      </div>
    </div>
  );
}
