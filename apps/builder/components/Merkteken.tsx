/**
 * Het merkteken. Staat apart omdat zowel de Shell als het startscherm het gebruikt, en het
 * logoverloop op één plek hoort te staan.
 *
 * Dit is de enige plek in de app waar alle drie de kleurenparen in één element samenkomen. Dat
 * mag hier omdat een logo geen state is — het betekent niets, het is een merk. Overal elders
 * geldt "max één glow per element" en "kleur = betekenis". Via de tokens, niet via losse
 * hexwaarden, zodat er één bron blijft.
 */
import { cn } from "@ob/ui";

export function Merkteken({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-card text-base font-bold text-white",
        "shadow-glow-flow",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(135deg, var(--flow-from), var(--bloom-to) 55%, var(--glow-from))",
      }}
    >
      P
    </span>
  );
}

export function Woordmerk() {
  return (
    <span>
      <b className="block text-base font-bold -tracking-[0.01em]">Prism Builder</b>
      <span className="block text-[11px] font-medium tracking-[0.06em] text-ink-faint">
        LEERMODULE BOUWEN
      </span>
    </span>
  );
}
