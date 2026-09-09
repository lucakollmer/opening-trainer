export const OPENING_NAME_MAPPING_POLICY_VERSION = 'opening-name-fsrs-v1';
export const OPENING_NAME_NORMALIZATION_VERSION = 'opening-name-normalization-v1';

export function normalizeOpeningName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function openingNameAnswerSet(labels: readonly string[]): readonly string[] {
  return [...new Set(labels.map(normalizeOpeningName).filter(Boolean))].sort();
}

export function openingNameAnswerSetKey(labels: readonly string[]): string {
  return openingNameAnswerSet(labels).join('\u001f');
}

export function openingNameMatches(answer: string, answerSetKey: string): boolean {
  const normalized = normalizeOpeningName(answer);
  return Boolean(normalized) && answerSetKey.split('\u001f').includes(normalized);
}

export function validateOpeningNameLabels(
  primaryLabel: string,
  aliases: readonly string[],
): { primaryLabel: string; aliases: string[]; answerSetKey: string } {
  const primary = primaryLabel.trim();
  if (!primary || primary.length > 160) {
    throw new Error('Opening name must contain 1-160 characters.');
  }
  if (aliases.length > 20) {
    throw new Error('Opening name supports at most 20 aliases.');
  }
  const cleaned = aliases.map((value) => value.trim()).filter(Boolean);
  if (cleaned.some((value) => value.length > 160)) {
    throw new Error('Opening-name aliases must contain at most 160 characters.');
  }
  const primaryNormalized = normalizeOpeningName(primary);
  const aliasNormalized = cleaned.map(normalizeOpeningName);
  if (
    new Set(aliasNormalized).size !== aliasNormalized.length ||
    aliasNormalized.includes(primaryNormalized)
  ) {
    throw new Error('Opening-name aliases must be unique after normalization.');
  }
  return {
    primaryLabel: primary,
    aliases: cleaned,
    answerSetKey: openingNameAnswerSet([primary, ...cleaned]).join('\u001f'),
  };
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function nameTrainingItemId(
  repertoireId: string,
  contextId: string,
  answerSetKey: string,
): string {
  return `name:${repertoireId}:${contextId}:${stableHash(answerSetKey)}`;
}
