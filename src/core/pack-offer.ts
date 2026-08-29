import * as copy from './copy';
import type { PackOffer, TextPackContent } from './types';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

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
        .sort(([left], [right]) => left.localeCompare(right))
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

export function packOfferSizeLine(offer: PackOffer): string {
  return copy.PACK_SIZE_LINE(formatPackBytes(offer.textBytes), formatPackBytes(offer.tileBytes));
}

export function offerMatchesStoredSize(
  offer: PackOffer,
  stored: { text: number; tiles: number },
  withTiles: boolean,
): boolean {
  return stored.text === offer.textBytes && stored.tiles === (withTiles ? offer.tileBytes : 0);
}
