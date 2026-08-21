import { MOCKUPS } from "@/lib/mockups";
import { useStudio } from "@/lib/store";
import { detectSurface } from "@/lib/detect";
import { cn } from "@/lib/utils";
import { Camera } from "lucide-react";
import { useRef } from "react";

export function Catalog({ layout }: { layout: "side" | "row" }) {
  const mockupId = useStudio((s) => s.mockupId);
  const customSrc = useStudio((s) => s.customSrc);
  const customName = useStudio((s) => s.customName);
  const selectMockup = useStudio((s) => s.selectMockup);
  const selectCustom = useStudio((s) => s.selectCustom);
  const setCustomProduct = useStudio((s) => s.setCustomProduct);
  const applyScan = useStudio((s) => s.applyScan);
  const pushHistory = useStudio((s) => s.pushHistory);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    pushHistory();
    setCustomProduct(url, file.name.replace(/\.[^.]+$/, "") || "Your product");
    detectSurface(url)
      .then((d) => {
        if (d.accepted) applyScan(d);
      })
      .catch(() => undefined);
  };

  const itemClass = layout === "row" ? "w-28 shrink-0" : "w-full";

  return (
    <div
      className={cn(
        layout === "row"
          ? "flex min-w-0 gap-2 overflow-x-auto p-3"
          : "flex h-full flex-col gap-2 overflow-y-auto p-3",
      )}
    >
      <p className={cn("text-xs font-medium uppercase tracking-wider text-muted-foreground", layout === "row" && "hidden")}>
        SKUs
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => {
          if (!customSrc) fileRef.current?.click();
          else if (mockupId !== "custom") selectCustom();
          else fileRef.current?.click();
        }}
        className={cn(
          "flex h-20 flex-col items-center justify-center gap-1 rounded-lg bg-secondary text-muted-foreground shadow-[var(--shadow-border)] hover:text-foreground",
          itemClass,
          mockupId === "custom" && "ring-1 ring-primary text-foreground",
        )}
      >
        {customSrc ? (
          <img src={customSrc} alt="" className="size-full rounded-lg object-cover outline outline-1 -outline-offset-1 outline-foreground/10" />
        ) : (
          <>
            <Camera className="size-4" />
            <span className="px-2 text-center text-[11px] leading-tight">Your photo</span>
          </>
        )}
      </button>
      {customSrc && mockupId === "custom" ? (
        <p className={cn("truncate text-[11px] text-muted-foreground", layout === "row" && "hidden")}>{customName}</p>
      ) : null}
      {MOCKUPS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => selectMockup(m.id)}
          className={cn(
            "group relative overflow-hidden rounded-lg text-left shadow-[var(--shadow-border)]",
            itemClass,
            mockupId === m.id && "ring-1 ring-primary",
          )}
        >
          <img
            src={m.src}
            alt={m.name}
            className="h-28 w-full bg-[#efe8dc] object-contain outline outline-1 -outline-offset-1 outline-foreground/10"
          />
          <span className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1 text-[11px] leading-tight text-foreground">
            <span className="block font-medium tabular-nums text-muted-foreground">{m.sku}</span>
            {m.name}
          </span>
        </button>
      ))}
    </div>
  );
}
