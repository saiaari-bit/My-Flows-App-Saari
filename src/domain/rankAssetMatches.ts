import type { AssetMatch } from './asset360Types';

/**
 * Re-ranks CDF search hits so a tag the analyst typed in full comes first.
 *
 * Four deterministic bands; CDF's own relevance order is preserved inside each
 * band. This is exact-, prefix-, and substring-matching only — there is no
 * fuzzy or edit-distance matching here, and the UI must not claim any.
 */
export function rankAssetMatches(matches: AssetMatch[], query: string): AssetMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return matches;
  }

  return matches
    .map((match, index) => ({ match, index, band: bandOf(match, needle) }))
    .sort((a, b) => (a.band === b.band ? a.index - b.index : a.band - b.band))
    .map((entry) => entry.match);
}

function bandOf(match: AssetMatch, needle: string): number {
  const name = (match.name ?? match.ref.externalId).toLowerCase();
  const identifiers = [name, match.ref.externalId.toLowerCase(), ...match.aliases.map((a) => a.toLowerCase())];

  if (identifiers.some((value) => value === needle)) {
    return 0;
  }
  if (identifiers.some((value) => value.startsWith(needle))) {
    return 1;
  }
  if (identifiers.some((value) => value.includes(needle))) {
    return 2;
  }
  return 3;
}
