declare const __STATIC_ASSET_VERSION__: string;

export function staticAssetUrl(path: string): string {
  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}v=${encodeURIComponent(__STATIC_ASSET_VERSION__)}`;
}
