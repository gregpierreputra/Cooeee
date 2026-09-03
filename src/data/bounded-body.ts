// Bounded reads of an external response body. This file has no imports on
// purpose: the API server imports it directly under Node, which resolves only
// explicit-extension specifiers, and the client imports it through Vite.

/** Read a response body of at most maxBytes. Reading stops, and the call
 *  throws, the moment the body runs past the limit — so an oversized reply
 *  never fills memory, on the device or on the server. */
export async function readBodyBounded(response: Response, maxBytes: number): Promise<ArrayBuffer> {
  if (!response.body) return new ArrayBuffer(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RangeError(`response body exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total); // a fresh, exact-length buffer
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

/** response.json(), but bounded. */
export async function readJsonBounded(response: Response, maxBytes: number): Promise<unknown> {
  return JSON.parse(new TextDecoder().decode(await readBodyBounded(response, maxBytes)));
}
