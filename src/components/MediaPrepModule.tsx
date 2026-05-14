import { useCallback, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";

type Position =
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "center" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

const POSITIONS: Position[] = [
  "top-left", "top-center", "top-right",
  "middle-left", "center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];

interface SrcImage { id: string; file: File; url: string; }
interface OutImage { id: string; name: string; blob: Blob; url: string; status: "done" | "error"; }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function placement(pos: Position, bw: number, bh: number, ww: number, wh: number, pad: number): [number, number] {
  const xs = { left: pad, center: (bw - ww) / 2, right: bw - ww - pad };
  const ys = { top: pad, middle: (bh - wh) / 2, bottom: bh - wh - pad };
  const [v, h] = pos.split("-") as [keyof typeof ys, keyof typeof xs];
  return [xs[h], ys[v]];
}

export function MediaPrepModule() {
  const [images, setImages] = useState<SrcImage[]>([]);
  const [watermark, setWatermark] = useState<{ file: File; url: string } | null>(null);
  const [position, setPosition] = useState<Position>("bottom-right");
  const [opacity, setOpacity] = useState(70);
  const [sizePct, setSizePct] = useState(15);
  const [outputs, setOutputs] = useState<OutImage[]>([]);
  const [progress, setProgress] = useState<Record<string, "idle" | "processing" | "done" | "error">>({});
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wmInputRef = useRef<HTMLInputElement>(null);

  const onPickImages = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const next: SrcImage[] = [];
    for (const f of Array.from(files)) {
      if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) continue;
      next.push({ id: crypto.randomUUID(), file: f, url: URL.createObjectURL(f) });
    }
    setImages((prev) => [...prev, ...next]);
  }, []);

  const onPickWatermark = useCallback((files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (watermark) URL.revokeObjectURL(watermark.url);
    setWatermark({ file: f, url: URL.createObjectURL(f) });
  }, [watermark]);

  const removeImage = (id: string) => {
    setImages((prev) => {
      const x = prev.find((p) => p.id === id);
      if (x) URL.revokeObjectURL(x.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearOutputs = () => {
    outputs.forEach((o) => URL.revokeObjectURL(o.url));
    setOutputs([]);
    setProgress({});
  };

  const process = async () => {
    if (!images.length) { toast.error("Add some images first"); return; }
    if (!watermark) { toast.error("Upload a watermark PNG"); return; }
    setBusy(true);
    clearOutputs();
    const wm = await loadImage(watermark.url);
    const results: OutImage[] = [];

    for (const src of images) {
      setProgress((p) => ({ ...p, [src.id]: "processing" }));
      try {
        const base = await loadImage(src.url);
        const canvas = document.createElement("canvas");
        canvas.width = base.naturalWidth;
        canvas.height = base.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(base, 0, 0);

        const targetW = canvas.width * (sizePct / 100);
        const ratio = targetW / wm.naturalWidth;
        const targetH = wm.naturalHeight * ratio;
        const pad = canvas.width * 0.02;
        const [x, y] = placement(position, canvas.width, canvas.height, targetW, targetH, pad);

        ctx.globalAlpha = opacity / 100;
        ctx.drawImage(wm, x, y, targetW, targetH);
        ctx.globalAlpha = 1;

        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        if (!blob) throw new Error("encode failed");
        const name = src.file.name.replace(/\.\w+$/, "") + "_wm.png";
        results.push({ id: src.id, name, blob, url: URL.createObjectURL(blob), status: "done" });
        setProgress((p) => ({ ...p, [src.id]: "done" }));
      } catch (e) {
        console.error(e);
        setProgress((p) => ({ ...p, [src.id]: "error" }));
      }
    }
    setOutputs(results);
    setBusy(false);
    toast.success(`Watermarked ${results.length} image${results.length === 1 ? "" : "s"}`);
  };

  const downloadOne = (o: OutImage) => {
    const a = document.createElement("a");
    a.href = o.url; a.download = o.name; a.click();
  };

  const downloadZip = async () => {
    if (!outputs.length) return;
    const zip = new JSZip();
    outputs.forEach((o) => zip.file(o.name, o.blob));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `watermarked_${Date.now()}.zip`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const counts = useMemo(() => ({
    done: Object.values(progress).filter((s) => s === "done").length,
    total: images.length,
  }), [progress, images.length]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Media Prep</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk-watermark images in your browser. Configure once, process all, download as ZIP.
        </p>
      </div>

      {/* Upload */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onPickImages(e.dataTransfer.files); }}
        className="border-2 border-dashed border-border p-8 text-center"
      >
        <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,image/webp"
          onChange={(e) => onPickImages(e.target.files)} className="hidden" id="mp-up" />
        <label htmlFor="mp-up" className="cursor-pointer inline-block px-4 py-2 bg-foreground text-background text-sm font-mono">
          Upload images
        </label>
        <p className="text-xs font-mono text-muted-foreground mt-3">or drag & drop · PNG / JPG / WEBP</p>
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Source images ({images.length})
            </h3>
            <button onClick={() => { images.forEach((i) => URL.revokeObjectURL(i.url)); setImages([]); }}
              className="text-[10px] font-mono px-2 py-1 border border-border hover:bg-destructive hover:text-destructive-foreground">
              Clear all
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {images.map((img) => {
              const st = progress[img.id];
              return (
                <div key={img.id} className="relative aspect-square border border-border bg-muted">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  {st && st !== "idle" && (
                    <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-mono ${
                      st === "processing" ? "bg-background/70" : st === "done" ? "bg-foreground/80 text-background" : "bg-destructive/80 text-destructive-foreground"
                    }`}>
                      {st === "processing" ? "…" : st === "done" ? "✓" : "✕"}
                    </div>
                  )}
                  <button onClick={() => removeImage(img.id)}
                    className="absolute top-1 right-1 w-5 h-5 bg-background/90 border border-border text-[10px] leading-none">×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Watermark config */}
      <div className="border border-border p-4 space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Watermark configuration</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase block">Watermark PNG</label>
            <input ref={wmInputRef} type="file" accept="image/png" onChange={(e) => onPickWatermark(e.target.files)}
              className="hidden" id="mp-wm" />
            <label htmlFor="mp-wm" className="cursor-pointer inline-block px-3 py-1.5 text-xs font-mono border border-border hover:bg-foreground hover:text-background">
              {watermark ? "Replace watermark" : "Choose watermark"}
            </label>
            {watermark && (
              <div className="mt-2 inline-block border border-border bg-muted/30 p-2">
                <img src={watermark.url} alt="watermark" className="h-12 object-contain" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase block">Position</label>
            <div className="grid grid-cols-3 gap-1 max-w-[180px]">
              {POSITIONS.map((p) => (
                <button key={p} onClick={() => setPosition(p)}
                  title={p}
                  className={`aspect-square border text-[8px] font-mono ${
                    position === p ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"
                  }`}>
                  •
                </button>
              ))}
            </div>
            <p className="text-[10px] font-mono text-muted-foreground">{position}</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase block flex justify-between">
              <span>Opacity</span><span>{opacity}%</span>
            </label>
            <input type="range" min={0} max={100} value={opacity} onChange={(e) => setOpacity(+e.target.value)}
              className="w-full" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase block flex justify-between">
              <span>Size (% of image width)</span><span>{sizePct}%</span>
            </label>
            <input type="range" min={5} max={30} value={sizePct} onChange={(e) => setSizePct(+e.target.value)}
              className="w-full" />
          </div>
        </div>

        <button onClick={process} disabled={busy || !images.length || !watermark}
          className="w-full py-2 bg-foreground text-background text-sm font-mono disabled:opacity-40">
          {busy ? `Processing… ${counts.done}/${counts.total}` : `Process ${images.length} image${images.length === 1 ? "" : "s"}`}
        </button>
      </div>

      {/* Output */}
      {outputs.length > 0 && (
        <div className="border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Output ({outputs.length})
            </h3>
            <div className="flex gap-2">
              <button onClick={downloadZip} className="text-[11px] font-mono px-3 py-1.5 bg-foreground text-background">
                Download all as ZIP
              </button>
              <button onClick={clearOutputs} className="text-[11px] font-mono px-3 py-1.5 border border-border">
                Clear
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {outputs.map((o) => (
              <div key={o.id} className="border border-border bg-card">
                <div className="aspect-square bg-muted overflow-hidden">
                  <img src={o.url} alt={o.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-[10px] font-mono truncate" title={o.name}>{o.name}</p>
                  <button onClick={() => downloadOne(o)} className="w-full text-[10px] font-mono py-1 border border-border hover:bg-foreground hover:text-background">
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
