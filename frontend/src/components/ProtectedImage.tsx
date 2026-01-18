import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Avatar } from "@mui/material";

import { getApiUrl, getToken } from "../api/client";

type ProtectedImageProps = {
  url: string | null;
  alt?: string;
  width?: number | string;
  height?: number | string;
  variant?: "rounded" | "circular" | "square";
  fallback?: ReactNode;
  cacheKey?: string;
};

const cache = new Map<string, string>();
const MAX_CACHE = 200;

const setCachedUrl = (key: string, objectUrl: string) => {
  if (cache.has(key)) {
    return;
  }
  if (cache.size >= MAX_CACHE) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey) {
      const oldUrl = cache.get(oldestKey);
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }
      cache.delete(oldestKey);
    }
  }
  cache.set(key, objectUrl);
};

export function ProtectedImage({
  url,
  alt,
  width = 32,
  height = 32,
  variant = "rounded",
  fallback = null,
  cacheKey
}: ProtectedImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      setObjectUrl(null);
      setError(false);
      return;
    }
    const key = cacheKey || url;
    const cached = cache.get(key);
    if (cached) {
      setObjectUrl(cached);
      setError(false);
      return;
    }
    const controller = new AbortController();
    const token = getToken();
    setError(false);

    fetch(getApiUrl(url), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load image");
        }
        return response.blob();
      })
      .then((blob) => {
        const createdUrl = URL.createObjectURL(blob);
        setCachedUrl(key, createdUrl);
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setObjectUrl(null);
        }
      });

    return () => controller.abort();
  }, [url, cacheKey]);

  if (!url || error || !objectUrl) {
    return <>{fallback}</>;
  }

  return <Avatar src={objectUrl} alt={alt} variant={variant} sx={{ width, height }} />;
}
