export const PHASE6_CONTRAST_MAPPING_POLICY_VERSION = 'contrast-fsrs-v1';
export const PHASE6_CONTRAST_CONFUSION_THRESHOLD = 2;
export const PHASE6_CONTRAST_WINDOW_DAYS = 30;

export function contrastPairId(
  expectedContextId: string,
  confusedContextId: string,
): string {
  return `contrast:${expectedContextId}->${confusedContextId}`;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function contrastTrainingItemId(
  sourceTrainingItemId: string,
  expectedContextId: string,
  confusedContextId: string,
): string {
  return `${contrastPairId(expectedContextId, confusedContextId)}:${stableHash(sourceTrainingItemId)}`;
}

export function insideContrastWindow(observedAt: string, now: Date): boolean {
  const timestamp = new Date(observedAt).getTime();
  return (
    Number.isFinite(timestamp) &&
    now.getTime() - timestamp <=
      PHASE6_CONTRAST_WINDOW_DAYS * 24 * 60 * 60 * 1000 &&
    timestamp <= now.getTime()
  );
}
