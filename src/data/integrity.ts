import { canonicalJson } from '../core/pack-offer';

async function sha256Canonical(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function manifestGroup<T extends { id: string }>(rows: readonly T[]) {
  const ordered = [...rows].sort((left, right) => left.id.localeCompare(right.id));
  return {
    count: ordered.length, 
    sha256: await sha256Canonical(ordered) 
  };
}
