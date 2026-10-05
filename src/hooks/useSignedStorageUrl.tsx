import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSignedStorageUrl(bucket: "videos" | "product-images", path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!path) return;
    void supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data, error }) => {
      if (!cancelled && !error) setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [bucket, path]);

  return url;
}

export function SignedStorageImage({ bucket, path, alt, className }: {
  bucket: "videos" | "product-images";
  path: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const url = useSignedStorageUrl(bucket, path);
  if (!url) return <div className={className} aria-label={alt} />;
  return <img src={url} alt={alt} className={className} />;
}
