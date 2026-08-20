import { SAMPLE_LOGOS } from "@/lib/mockups";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { useRef } from "react";

export function LogoDock() {
  const logo = useStudio((s) => s.logo);
  const wordmark = useStudio((s) => s.wordmark);
  const invert = useStudio((s) => s.invert);
  const setLogo = useStudio((s) => s.setLogo);
  const setWordmark = useStudio((s) => s.setWordmark);
  const pushHistory = useStudio((s) => s.pushHistory);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    pushHistory();
    setLogo({
      id: "upload",
      name: file.name.replace(/\.[^.]+$/, "") || "Logo",
      src: url,
      kind: "image",
    });
  };

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto p-3">
      <p className="hidden shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:block">
        Mark
      </p>
      {SAMPLE_LOGOS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => setLogo({ id: l.id, name: l.name, src: l.src, kind: "image" })}
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary p-2 shadow-[var(--shadow-border)]",
            logo.id === l.id && logo.kind === "image" && "ring-1 ring-primary",
          )}
          aria-label={l.name}
        >
          <img
            src={l.src}
            alt=""
            className={cn("size-full object-contain", invert && "invert")}
          />
        </button>
      ))}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/svg+xml,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={cn(
          "flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-muted-foreground shadow-[var(--shadow-border)] hover:text-foreground",
          logo.id === "upload" && "ring-1 ring-primary text-foreground",
        )}
        aria-label="Upload logo"
      >
        <Upload className="size-4" />
      </button>
      <input
        type="text"
        value={logo.kind === "wordmark" ? wordmark : ""}
        placeholder="Type a wordmark"
        onChange={(e) => setWordmark(e.target.value)}
        className="h-12 min-w-32 flex-1 rounded-lg bg-secondary px-3 font-serif text-lg text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
