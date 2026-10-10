import type { Pack, PackOffer, TextPackContent } from './types';

/** The one order every hashed or canonical form sorts by. Pinned to 'en', not the
 *  device's language: a collation that follows the language (Czech sorts 'ch'
 *  after 'h') would make a saved pack fail its check after a language change.
 *  'en' is the root order the existing hashes were made with, so they stay valid. */
export const canonicalOrder = new Intl.Collator('en').compare;

type JsonValue = null | boolean | number | string | JsonValue[] | { 
  [key: string]: JsonValue 
};

function canonicalValue(value: unknown): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical content contains a non-finite number');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => canonicalOrder(left, right))
        .map(([key, child]) => [key, canonicalValue(child)]),
    );
  }
  throw new TypeError('canonical content contains an unsupported value');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function exactTextBytes(content: TextPackContent): number {
  return new TextEncoder().encode(canonicalJson(content)).length;
}

export function formatPackBytes(bytes: number): string {
  if (!Number.isInteger(bytes) || bytes < 0) throw new RangeError('bytes must be a non-negative integer');
  if (bytes < 1_048_576) return `${Math.ceil(bytes / 1_024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/** The pack's whole size, as the summary states it before the save. */
export const packOfferSize = (offer: PackOffer): string => formatPackBytes(offer.textBytes + offer.fileBytes);

/** The stated size and the stored size must be the same number. A stored pack
 * claiming tile bytes cannot match an offer, because nothing in this iteration
 * can produce them: that is a corrupted record, not a bigger pack. */
export function offerMatchesStoredSize(offer: PackOffer, stored: Pack['sizeBytes']): boolean {
  return stored.text === offer.textBytes
    && (stored.files ?? 0) === offer.fileBytes
    && stored.tiles === 0;
}
