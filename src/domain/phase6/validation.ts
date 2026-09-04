export function boundedText(
  value: string,
  label: string,
  max: number,
  allowEmpty = false,
): string {
  const normalized = value.trim();
  if ((!allowEmpty && normalized.length === 0) || normalized.length > max) {
    throw new Error(
      `${label} must contain ${allowEmpty ? `0-${max}` : `1-${max}`} characters.`,
    );
  }
  return normalized;
}

export function validateTags(tags: readonly string[]): string[] {
  if (tags.length > 32) {
    throw new Error('A context or playlist supports at most 32 tags.');
  }
  const cleaned = tags.map((tag) => boundedText(tag, 'Tag', 48));
  const keys = cleaned.map((tag) => tag.toLocaleLowerCase());
  if (new Set(keys).size !== keys.length) {
    throw new Error('Tags must be unique.');
  }
  return cleaned;
}

export function assertIsoDateTime(value: string, label: string): void {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    throw new Error(`${label} must be a valid ISO date-time.`);
  }
}
