import { describe, expect, it } from 'vitest';
import { silencedBySilentMode } from '../../src/core/device';

describe('where silent mode mutes the games', () => {
  it('is an iPhone, an iPad, or an iPad asking for the desktop site', () => {
    expect(silencedBySilentMode('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5)).toBe(true);
    expect(silencedBySilentMode('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'iPad', 5)).toBe(true);
    expect(silencedBySilentMode('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
  });

  it('is not a Mac, an Android phone or a Windows computer', () => {
    expect(silencedBySilentMode('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
    expect(silencedBySilentMode('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Linux armv8l', 5)).toBe(false);
    expect(silencedBySilentMode('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 10)).toBe(false);
  });
});
