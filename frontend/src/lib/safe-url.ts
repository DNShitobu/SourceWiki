const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

export const getSafeExternalUrl = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value.trim());

    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
};

export const openExternalUrl = (value?: string | null): boolean => {
  const safeUrl = getSafeExternalUrl(value);

  if (!safeUrl) {
    return false;
  }

  window.open(safeUrl, '_blank', 'noopener,noreferrer');
  return true;
};
