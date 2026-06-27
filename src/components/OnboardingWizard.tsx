import { useState } from "react";
import { ArrowRight, Bot, Check, GitBranch, Sprout, X } from "lucide-react";
import { useStore } from "../store/useStore";

const TOTAL = 2;

function dismiss() {
  try { localStorage.setItem("sams.welcomed", "1"); } catch { /* ignore */ }
}

export function OnboardingWizard() {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const [open] = useState(() => {
    try { return !localStorage.getItem("sams.welcomed"); } catch { return false; }
  });
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);

  if (!open || closed) return null;

  function close() { dismiss(); setClosed(true); }
  function next() {
    if (step < TOTAL - 1) { setStep(step + 1); }
    else {
      dismiss();
      setClosed(true);
      setSettingsOpen(true);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Benvenuto in SAMS"
        className="relative mx-4 w-full max-w-md animate-fade-in overflow-hidden rounded-2xl border border-line bg-ink-850 shadow-panel"
      >
        {/* close */}
        <button
          onClick={close}
          aria-label="Chiudi"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-ink-700 hover:text-slate-200"
        >
          <X size={15} />
        </button>

        {/* step dots */}
        <div className="flex items-center justify-center gap-1.5 pt-5">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-brand" : "w-1.5 bg-ink-600"}`}
            />
          ))}
        </div>

        <div className="px-6 pb-6 pt-4">
          {step === 0 && (
            <>
              <h2 className="text-[22px] font-bold text-white">Benvenuto in SAMS</h2>
              <p className="mt-0.5 text-[12px] text-mut">Spatial Agentic Management System</p>
              <p className="mt-3 text-[13px] leading-relaxed text-slate-300">
                Una sala-ufficio 3D dove vivono i tuoi agenti AI. Ogni agente può leggere codice,
                scrivere file e aprire PR — tutto in autonomia, mentre lo guardi muoversi in scena.
              </p>
              <div className="mt-4 space-y-3">
                <FeatureRow icon={Bot} label="Agenti vivi" desc="Cliccali, assegna un task, guardali lavorare in tempo reale." />
                <FeatureRow icon={GitBranch} label="GitHub nativo" desc="Ogni agente opera sul tuo repo: legge, committa, apre PR." />
                <FeatureRow icon={Sprout} label="Commit Garden" desc="I tuoi push innaffiano una pianta 3D che cresce nel tempo." />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-[22px] font-bold text-white">Come iniziare</h2>
              <p className="mt-0.5 text-[12px] text-mut">Tre passi per essere operativi</p>
              <ol className="mt-4 space-y-4">
                <StepRow n={1} label="Avvia il runtime">
                  Nel terminale della repo:{" "}
                  <code className="rounded bg-ink-700 px-1.5 py-0.5 text-[12px] text-brand-soft">npm start</code>.
                  Il server parte sulla porta 8787.
                </StepRow>
                <StepRow n={2} label="Configura le chiavi">
                  Apri ⚙ Impostazioni, inserisci la API key (Gemini è gratuito), il GitHub token e il repository.
                </StepRow>
                <StepRow n={3} label="Assegna il primo task">
                  Clicca un agente in scena, scrivi il task nel pannello a destra e premi <strong>Assegna</strong>.
                </StepRow>
              </ol>
            </>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button onClick={close} className="text-[12px] text-mut transition-colors hover:text-slate-300">
              Salta
            </button>
            <button onClick={next} className="btn btn-primary gap-1.5">
              {step < TOTAL - 1 ? (
                <><ArrowRight size={14} /> Avanti</>
              ) : (
                <><Check size={14} /> Apri impostazioni</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ icon: Icon, label, desc }: { icon: typeof Bot; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/15">
        <Icon size={16} className="text-brand-soft" />
      </div>
      <div>
        <div className="text-[13px] font-semibold text-white">{label}</div>
        <div className="text-[12px] leading-snug text-mut">{desc}</div>
      </div>
    </div>
  );
}

function StepRow({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/20 text-[11px] font-bold text-brand-soft">
        {n}
      </span>
      <div>
        <div className="text-[13px] font-semibold text-white">{label}</div>
        <div className="text-[12px] leading-snug text-mut">{children}</div>
      </div>
    </li>
  );
}
