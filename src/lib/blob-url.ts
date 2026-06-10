// base64 → object URL pra <img>/<video> renderizarem sem estourar o atributo src
// com data-URI gigante. O chamador é dono da URL e deve revogar no cleanup.
export function b64ToObjectUrl(dataB64: string, mime: string): string | null {
  try {
    const bin = atob(dataB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
}
