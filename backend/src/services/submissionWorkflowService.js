import crypto from 'crypto';
import Notification from '../models/Notification.js';
import { sendEmail } from './emailService.js';
import { sanitizeString } from '../utils/sanitization.js';

const TRACKING_QUERY_KEYS = new Set([
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref',
  'source',
  'spm',
  'utm_campaign',
  'utm_content',
  'utm_id',
  'utm_medium',
  'utm_source',
  'utm_term',
]);

const ARCHIVE_HOSTS = new Set([
  'archive.is',
  'archive.md',
  'archive.ph',
  'archive.today',
  'ghostarchive.org',
  'web.archive.org',
]);

const normalizeArchiveUrl = (parsed) => {
  if (parsed.hostname === 'web.archive.org') {
    const archivePath = parsed.pathname.replace(/^\/web\/\d+\//, '');
    if (archivePath.startsWith('http://') || archivePath.startsWith('https://')) {
      return archivePath;
    }
  }

  const explicit = parsed.searchParams.get('url');
  if (explicit) {
    return explicit;
  }

  return parsed.toString();
};

export const normalizeSourceUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const candidate = value.startsWith('//') ? `https:${value}` : value.trim();

  try {
    let parsed = new URL(candidate);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    if (ARCHIVE_HOSTS.has(parsed.hostname)) {
      const unwrapped = normalizeArchiveUrl(parsed);
      if (unwrapped && unwrapped !== parsed.toString()) {
        parsed = new URL(unwrapped);
      }
    }

    parsed.hash = '';
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    const normalizedQuery = new URLSearchParams();
    [...parsed.searchParams.entries()]
      .filter(([key]) => !TRACKING_QUERY_KEYS.has(key.toLowerCase()))
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([key, valuePart]) => {
        normalizedQuery.append(key, valuePart);
      });

    parsed.search = normalizedQuery.toString();

    let pathname = parsed.pathname.replace(/\/{2,}/g, '/');
    if (pathname.length > 1) {
      pathname = pathname.replace(/\/+$/, '');
    }

    parsed.pathname = pathname || '/';

    return parsed.toString();
  } catch {
    return null;
  }
};

export const buildSourceFingerprint = (url) => {
  const normalizedUrl = normalizeSourceUrl(url);

  if (!normalizedUrl) {
    return null;
  }

  return crypto.createHash('sha256').update(normalizedUrl).digest('hex');
};

const trimText = (value, maxLength) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const sanitized = sanitizeString(value).trim();
  if (!sanitized) {
    return undefined;
  }

  return typeof maxLength === 'number' ? sanitized.slice(0, maxLength) : sanitized;
};

export const buildArticleContext = (context = {}) => {
  const articleUrl = normalizeSourceUrl(context.articleUrl || context.wikipediaArticle);
  const archiveUrl = normalizeSourceUrl(context.archiveUrl);

  const record = {
    articleTitle: trimText(context.articleTitle, 255),
    articleUrl,
    sectionTitle: trimText(context.sectionTitle, 255),
    referenceLabel: trimText(context.referenceLabel, 120),
    citationText: trimText(context.citationText, 500),
    archiveUrl,
    accessDate: trimText(context.accessDate, 40),
    source: trimText(context.source, 40) || 'manual',
  };

  if (!record.articleTitle && !record.articleUrl && !record.sectionTitle && !record.referenceLabel) {
    return null;
  }

  return record;
};

const articleContextKey = (context) =>
  [
    context.articleTitle || '',
    context.articleUrl || '',
    context.sectionTitle || '',
    context.referenceLabel || '',
  ].join('|');

export const mergeArticleContext = (existingContexts = [], nextContext) => {
  if (!nextContext) {
    return existingContexts;
  }

  const contexts = [...existingContexts];
  const key = articleContextKey(nextContext);
  const existingIndex = contexts.findIndex((context) => articleContextKey(context) === key);

  if (existingIndex === -1) {
    contexts.push(nextContext);
    return contexts;
  }

  contexts[existingIndex] = {
    ...contexts[existingIndex],
    ...Object.fromEntries(
      Object.entries(nextContext).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    ),
  };

  return contexts;
};

export const createHistoryEntry = ({
  action,
  actor = null,
  actorName,
  note,
  fromStatus,
  toStatus,
  metadata = {},
}) => ({
  action,
  actor,
  actorName: trimText(actorName, 80) || 'System',
  note: trimText(note, 500),
  fromStatus,
  toStatus,
  metadata,
  createdAt: new Date(),
});

export const createDiscussionEntry = ({
  type = 'comment',
  author,
  authorName,
  message,
  status = 'open',
}) => ({
  type,
  author,
  authorName: trimText(authorName, 80) || 'User',
  message: trimText(message, 1000),
  status,
  createdAt: new Date(),
});

export const appendSubmissionHistory = (submission, entry) => {
  submission.reviewHistory = submission.reviewHistory || [];
  submission.reviewHistory.push(entry);
};

export const appendSubmissionDiscussion = (submission, entry) => {
  submission.discussion = submission.discussion || [];
  submission.discussion.push(entry);
};

export const createNotification = async ({
  userId,
  type = 'system',
  title,
  message,
  link,
  metadata = {},
  email,
  emailSubject,
  emailHtml,
}) => {
  if (!userId || !title || !message) {
    return null;
  }

  const notification = await Notification.create({
    user: userId,
    type,
    title,
    message,
    link,
    metadata,
  });

  if (email && emailHtml) {
    await sendEmail(email, emailSubject || title, emailHtml);
  }

  return notification;
};

export const buildSubmissionLink = (submissionId) => `/submissions/${submissionId}`;

export const createNotificationHtml = ({ heading, body, footer }) => `
  <h3>${heading}</h3>
  <p>${body}</p>
  ${footer ? `<p>${footer}</p>` : ''}
`;
