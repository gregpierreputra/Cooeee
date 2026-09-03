import { canonicalJson } from '../core/pack-offer';
import type { PackFile, PackFileMeta } from '../core/types';

/** Lower-case hex SHA-256 of any bytes. */
export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function manifestGroup<T extends { id: string }>(rows: readonly T[]) {
  const ordered = [...rows].sort((left, right) => left.id.localeCompare(right.id));
  return {
    count: ordered.length,
    sha256: await sha256Hex(new TextEncoder().encode(canonicalJson(ordered))),
  };
}

/** The file without its bytes: what the offer states and the manifest hashes. */
export const fileMeta = ({ bytes, ...meta }: PackFile): PackFileMeta => {
  void bytes;
  return meta;
};

/** Do the stored rows still match what the manifest recorded? A group recorded
 *  as empty must be empty; anything else is re-hashed the same way it was written. */
export async function groupMatches(
  expected: { count: number; sha256: string },
  rows: readonly { id: string }[],
): Promise<boolean> {
  if (expected.count === 0) return rows.length === 0;
  const actual = await manifestGroup(rows);
  return actual.count === expected.count && actual.sha256 === expected.sha256;
}
