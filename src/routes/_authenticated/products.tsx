import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SignedStorageImage } from "@/hooks/useSignedStorageUrl";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({ component: MediaLibrary });

interface Asset {
  id: string;
  created_at: string;
  image_path: string;
  name: string | null;
}

function MediaLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,created_at,image_path,name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Asset[];
    },
  });

  async function storeImage(file: File | Blob, name: string, contentType: string) {
    if (!user) throw new Error("Sign in to upload content");
    const extension = name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, { contentType });
    if (uploadError) throw uploadError;
    const { error: rowError } = await supabase.from("products").insert({ image_path: path, name });
    if (rowError) {
      await supabase.storage.from("product-images").remove([path]);
      throw rowError;
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!images.length) return toast.error("Choose image files to add to your library");
    setUploading(images.length);
    let saved = 0;
    for (const file of images) {
      try {
        await storeImage(file, file.name, file.type || "image/jpeg");
        saved++;
      } catch (error) {
        toast.error(`${file.name}: ${error instanceof Error ? error.message : "Upload failed"}`);
      }
      setUploading(images.length - saved);
    }
    setUploading(0);
    if (inputRef.current) inputRef.current.value = "";
    await queryClient.invalidateQueries({ queryKey: ["assets"] });
    if (saved) toast.success(`Added ${saved} image${saved === 1 ? "" : "s"} to your library`);
  }

  async function importZip(file: File | null) {
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) return toast.error("Choose a .zip file");
    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((entry) => !entry.dir && /\.(jpe?g|png|webp)$/i.test(entry.name));
      if (!entries.length) return toast.error("No JPG, PNG, or WEBP images found in that ZIP");
      setUploading(entries.length);
      let saved = 0;
      for (const entry of entries) {
        const blob = await entry.async("blob");
        const extension = entry.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
        try {
          await storeImage(blob, entry.name.split("/").pop() ?? entry.name, mime);
          saved++;
        } catch (error) {
          toast.error(`${entry.name}: ${error instanceof Error ? error.message : "Upload failed"}`);
        }
        setUploading(entries.length - saved);
      }
      setUploading(0);
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      if (saved) toast.success(`Imported ${saved} image${saved === 1 ? "" : "s"}`);
    } catch (error) {
      setUploading(0);
      toast.error(error instanceof Error ? error.message : "Could not open ZIP file");
    }
  }

  async function deleteAsset(asset: Asset) {
    if (!confirm(`Delete ${asset.name ?? "this image"}?`)) return;
    const { error: fileError } = await supabase.storage.from("product-images").remove([asset.image_path]);
    if (fileError) return toast.error(fileError.message);
    const { error } = await supabase.from("products").delete().eq("id", asset.id);
    if (error) return toast.error(error.message);
    await queryClient.invalidateQueries({ queryKey: ["assets"] });
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-xs uppercase text-muted-foreground">Your content</p>
        <h1 className="mt-2 text-2xl font-bold">Media library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Store and organize image assets for your account. Upload videos to add them directly to the review queue.</p>
      </header>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}
        className="border-2 border-dashed border-border p-8 text-center"
      >
        <input ref={inputRef} type="file" multiple accept="image/*" onChange={(event) => void uploadFiles(event.target.files)} className="hidden" id="asset-upload" />
        <input type="file" accept=".zip,application/zip" onChange={(event) => void importZip(event.target.files?.[0] ?? null)} className="hidden" id="asset-zip" />
        <div className="flex justify-center gap-2 flex-wrap">
          <label htmlFor="asset-upload" className="cursor-pointer bg-foreground px-4 py-2 text-sm font-mono text-background">
            {uploading ? `Uploading ${uploading}…` : "Add images"}
          </label>
          <label htmlFor="asset-zip" className="cursor-pointer border border-border px-4 py-2 text-sm font-mono hover:bg-muted">Import ZIP</label>
        </div>
        <p className="mt-3 text-xs font-mono text-muted-foreground">Drop images here · JPG / PNG / WEBP · bulk ZIP supported</p>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading library…</p> : assets.length === 0 ? (
        <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Your image library is empty.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <article key={asset.id} className="border border-border bg-card">
              <div className="aspect-square overflow-hidden bg-muted">
                <SignedStorageImage bucket="product-images" path={asset.image_path} alt={asset.name ?? ""} className="h-full w-full object-cover" />
              </div>
              <div className="space-y-2 p-2">
                <p className="truncate text-[11px] font-mono" title={asset.name ?? ""}>{asset.name ?? "Untitled image"}</p>
                <button onClick={() => void deleteAsset(asset)} className="w-full border border-border py-1 text-[10px] font-mono hover:bg-destructive hover:text-destructive-foreground">Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
