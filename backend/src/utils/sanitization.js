import xss from 'xss';

const XSS_OPTIONS = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

const SENSITIVE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'refreshToken',
  'token',
  'accessToken',
]);

const stripNullBytes = (value) => value.replace(/\u0000/g, '');

export const sanitizeString = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  return xss(stripNullBytes(value).trim(), XSS_OPTIONS);
};

export const sanitizeRequestValue = (value, key = '') => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRequestValue(item, key));
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeRequestValue(entryValue, entryKey),
      ]),
    );
  }

  if (typeof value === 'string') {
    if (SENSITIVE_KEYS.has(key)) {
      return stripNullBytes(value);
    }

    return sanitizeString(value);
  }

  return value;
};

export const sanitizeRequestInput = (req, _res, next) => {
  if (req.body) {
    req.body = sanitizeRequestValue(req.body);
  }

  if (req.query) {
    req.query = sanitizeRequestValue(req.query);
  }

  if (req.params) {
    req.params = sanitizeRequestValue(req.params);
  }

  next();
};

export const escapeRegex = (value = '') =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildSafeSearchRegex = (value) => {
  const sanitized = sanitizeString(value);

  if (!sanitized) {
    return null;
  }

  return new RegExp(escapeRegex(sanitized), 'i');
};
