const unavailableAudio = new Set<string>();

export function playOptionalAudio(src: string, volume: number) {
  if (unavailableAudio.has(src) || typeof Audio === "undefined") {
    return;
  }

  const audio = new Audio(src);
  audio.volume = volume;
  audio.addEventListener("error", () => unavailableAudio.add(src), { once: true });
  audio.play().catch(() => {});
}
