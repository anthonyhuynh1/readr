import { describe, expect, it } from 'vitest';
import {
  getBundledSyncAssetBySlug,
  getBundledTextAssetBySlug,
} from '../data/bundledSyncAssets';

describe('bundled offline fallback', () => {
  it('exposes the bundled Gatsby ch.1 sync asset by slug', () => {
    const sync = getBundledSyncAssetBySlug('the-great-gatsby-ch-1');
    expect(sync).not.toBeNull();
    expect(sync?.chapter_slug).toBe('the-great-gatsby-ch-1');
    expect((sync?.sentences.length ?? 0)).toBeGreaterThan(0);
  });

  it('returns null for chapters without a bundled asset', () => {
    expect(getBundledSyncAssetBySlug('the-great-gatsby-ch-2')).toBeNull();
    expect(getBundledTextAssetBySlug('unknown-ch-1')).toBeNull();
  });

  it('derives an offline reading-text asset from the bundled sync asset', () => {
    const text = getBundledTextAssetBySlug('the-great-gatsby-ch-1');
    expect(text).not.toBeNull();
    expect(text?.chapter_slug).toBe('the-great-gatsby-ch-1');
    expect(text?.sentences.length).toBeGreaterThan(0);

    const first = text?.sentences[0];
    expect(first?.text.length ?? 0).toBeGreaterThan(0);
    expect(first?.id).toBe('the-great-gatsby-ch-1-s-0');
    expect(first?.index).toBe(0);
  });
});
