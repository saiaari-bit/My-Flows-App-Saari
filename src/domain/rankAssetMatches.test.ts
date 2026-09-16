import { describe, expect, it } from 'vitest';

import type { AssetMatch } from './asset360Types';
import { rankAssetMatches } from './rankAssetMatches';

describe(rankAssetMatches.name, () => {
  it('returns the CDF order untouched for an empty query', () => {
    const matches = [match('B'), match('A')];
    expect(rankAssetMatches(matches, '   ')).toBe(matches);
  });

  it('puts an exact name match first', () => {
    const ranked = rankAssetMatches([match('23-HA-9114-sub'), match('23-HA-9114')], '23-HA-9114');
    expect(ranked.map((entry) => entry.label)).toEqual(['23-HA-9114', '23-HA-9114-sub']);
  });

  it('ranks prefix matches above substring matches', () => {
    const ranked = rankAssetMatches([match('pump-23-VG'), match('23-VG-pump')], '23-vg');
    expect(ranked.map((entry) => entry.label)).toEqual(['23-VG-pump', 'pump-23-VG']);
  });

  it('treats an alias as an exact match', () => {
    const ranked = rankAssetMatches(
      [match('Other tag'), match('Cooling water pump', { aliases: ['21PT1019'] })],
      '21PT1019'
    );
    expect(ranked[0]?.label).toBe('Cooling water pump');
  });

  it('keeps CDF relevance order within a band', () => {
    const ranked = rankAssetMatches([match('pump-a-23'), match('pump-b-23')], '23');
    expect(ranked.map((entry) => entry.label)).toEqual(['pump-a-23', 'pump-b-23']);
  });

  it('sorts non-matching results last rather than dropping them', () => {
    const ranked = rankAssetMatches([match('unrelated'), match('23-HA-9114')], '23-ha');
    expect(ranked.map((entry) => entry.label)).toEqual(['23-HA-9114', 'unrelated']);
  });
});

function match(name: string, extra?: Partial<AssetMatch>): AssetMatch {
  return {
    ref: { space: 'test-space', externalId: name },
    label: name,
    name,
    aliases: [],
    ...extra,
  };
}
