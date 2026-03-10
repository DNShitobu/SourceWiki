import crypto from 'crypto';
import { parse } from 'node-html-parser';
import CountryStats from '../models/CountryStats.js';
import Submission from '../models/Submission.js';
import User from '../models/User.js';

const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';
const DEFAULT_BATCH_LIMIT = 5;
const MAX_BATCH_LIMIT = 25;
const IMPORT_DELAY_MS = 250;
const ARCHIVE_HOSTS = new Set([
  'web.archive.org',
  'archive.today',
  'archive.is',
  'archive.ph',
  'archive.md',
  'ghostarchive.org',
]);
const GENERIC_LINK_TEXT = new Set(['archived', 'original', 'the original']);
const COINS_TITLE_KEYS = ['rft.atitle', 'rft.btitle', 'rft.title', 'rft.ctitle'];
const COINS_PUBLISHER_KEYS = ['rft.jtitle', 'rft.pub'];
const PRIMARY_CITATION_TYPES = new Set([
  'journal',
  'report',
  'thesis',
  'conference',
  'book',
  'government',
  'legislation',
  'dataset',
]);
const SECONDARY_CITATION_TYPES = new Set(['news', 'magazine', 'newspaper', 'web']);
const UNRELIABLE_HOST_PATTERNS = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)reddit\.com$/i,
  /(^|\.)quora\.com$/i,
  /(^|\.)fandom\.com$/i,
  /(^|\.)wikia\.com$/i,
  /(^|\.)wordpress\.com$/i,
  /(^|\.)blogspot\./i,
  /(^|\.)medium\.com$/i,
  /(^|\.)substack\.com$/i,
  /(^|\.)tumblr\.com$/i,
  /(^|\.)pinterest\.com$/i,
];
const PRIMARY_HOST_PATTERNS = [
  /\.gov$/i,
  /\.gov\.[a-z]{2}$/i,
  /\.edu$/i,
  /\.edu\.[a-z]{2}$/i,
  /\.ac\.[a-z]{2}$/i,
  /(^|\.)nature\.com$/i,
  /(^|\.)science\.org$/i,
  /(^|\.)sciencedirect\.com$/i,
  /(^|\.)springer\.com$/i,
  /(^|\.)link\.springer\.com$/i,
  /(^|\.)wiley\.com$/i,
  /(^|\.)tandfonline\.com$/i,
  /(^|\.)cambridge\.org$/i,
  /(^|\.)oup\.com$/i,
  /(^|\.)jstor\.org$/i,
  /(^|\.)nejm\.org$/i,
  /(^|\.)thelancet\.com$/i,
  /(^|\.)plos\.org$/i,
  /(^|\.)arxiv\.org$/i,
  /(^|\.)ncbi\.nlm\.nih\.gov$/i,
  /(^|\.)pubmed\.ncbi\.nlm\.nih\.gov$/i,
  /(^|\.)doi\.org$/i,
  /(^|\.)who\.int$/i,
  /(^|\.)worldbank\.org$/i,
  /(^|\.)imf\.org$/i,
  /(^|\.)oecd\.org$/i,
  /(^|\.)un\.org$/i,
  /(^|\.)europa\.eu$/i,
];
const SECONDARY_HOST_PATTERNS = [
  /(^|\.)reuters\.com$/i,
  /(^|\.)apnews\.com$/i,
  /(^|\.)bbc\.com$/i,
  /(^|\.)bbc\.co\.uk$/i,
  /(^|\.)nytimes\.com$/i,
  /(^|\.)wsj\.com$/i,
  /(^|\.)washingtonpost\.com$/i,
  /(^|\.)ft\.com$/i,
  /(^|\.)theguardian\.com$/i,
  /(^|\.)economist\.com$/i,
  /(^|\.)cnbc\.com$/i,
  /(^|\.)bloomberg\.com$/i,
  /(^|\.)time\.com$/i,
  /(^|\.)forbes\.com$/i,
  /(^|\.)openai\.com$/i,
];
const COUNTRY_CATALOG = [
  { code: 'GH', name: 'Ghana', tlds: ['gh'] },
  { code: 'NG', name: 'Nigeria', tlds: ['ng'] },
  { code: 'KE', name: 'Kenya', tlds: ['ke'] },
  { code: 'ZA', name: 'South Africa', tlds: ['za'] },
  { code: 'EG', name: 'Egypt', tlds: ['eg'] },
  { code: 'ET', name: 'Ethiopia', tlds: ['et'] },
  { code: 'MA', name: 'Morocco', tlds: ['ma'] },
  { code: 'TN', name: 'Tunisia', tlds: ['tn'] },
  { code: 'UG', name: 'Uganda', tlds: ['ug'] },
  { code: 'TZ', name: 'Tanzania', tlds: ['tz'] },
  { code: 'RW', name: 'Rwanda', tlds: ['rw'] },
  { code: 'MZ', name: 'Mozambique', tlds: ['mz'] },
  { code: 'MG', name: 'Madagascar', tlds: ['mg'] },
  { code: 'US', name: 'United States', tlds: ['us'] },
  { code: 'GB', name: 'United Kingdom', tlds: ['uk', 'gb'] },
  { code: 'CA', name: 'Canada', tlds: ['ca'] },
  { code: 'AU', name: 'Australia', tlds: ['au'] },
  { code: 'DE', name: 'Germany', tlds: ['de'] },
  { code: 'FR', name: 'France', tlds: ['fr'] },
  { code: 'ES', name: 'Spain', tlds: ['es'] },
  { code: 'IT', name: 'Italy', tlds: ['it'] },
  { code: 'JP', name: 'Japan', tlds: ['jp'] },
  { code: 'IN', name: 'India', tlds: ['in'] },
  { code: 'BR', name: 'Brazil', tlds: ['br'] },
  { code: 'MX', name: 'Mexico', tlds: ['mx'] },
  { code: 'KR', name: 'South Korea', tlds: ['kr'] },
  { code: 'CN', name: 'China', tlds: ['cn'] },
];
const DOMAIN_COUNTRY_RULES = [
  { pattern: /(^|\.)bbc\.(com|co\.uk)$/i, code: 'GB' },
  { pattern: /(^|\.)theguardian\.com$/i, code: 'GB' },
  { pattern: /(^|\.)reuters\.com$/i, code: 'GB' },
  { pattern: /(^|\.)ft\.com$/i, code: 'GB' },
  { pattern: /(^|\.)economist\.com$/i, code: 'GB' },
  { pattern: /(^|\.)nature\.com$/i, code: 'GB' },
  { pattern: /(^|\.)nytimes\.com$/i, code: 'US' },
  { pattern: /(^|\.)wsj\.com$/i, code: 'US' },
  { pattern: /(^|\.)washingtonpost\.com$/i, code: 'US' },
  { pattern: /(^|\.)cnbc\.com$/i, code: 'US' },
  { pattern: /(^|\.)bloomberg\.com$/i, code: 'US' },
  { pattern: /(^|\.)fortune\.com$/i, code: 'US' },
  { pattern: /(^|\.)wired\.com$/i, code: 'US' },
  { pattern: /(^|\.)vanityfair\.com$/i, code: 'US' },
  { pattern: /(^|\.)technologyreview\.com$/i, code: 'US' },
  { pattern: /(^|\.)csmonitor\.com$/i, code: 'US' },
  { pattern: /(^|\.)popsci\.com$/i, code: 'US' },
  { pattern: /(^|\.)theverge\.com$/i, code: 'US' },
  { pattern: /(^|\.)observer\.com$/i, code: 'US' },
  { pattern: /(^|\.)gizmodo\.com$/i, code: 'US' },
  { pattern: /(^|\.)sfchronicle\.com$/i, code: 'US' },
  { pattern: /(^|\.)openai\.com$/i, code: 'US' },
  { pattern: /(^|\.)apnews\.com$/i, code: 'US' },
  { pattern: /(^|\.)opencorporates\.com$/i, code: 'GB' },
  { pattern: /(^|\.)business-standard\.com$/i, code: 'IN' },
  { pattern: /(^|\.)analyticsindiamag\.com$/i, code: 'IN' },
  { pattern: /(^|\.)abc\.net\.au$/i, code: 'AU' },
  { pattern: /(^|\.)cbc\.ca$/i, code: 'CA' },
  { pattern: /(^|\.)theglobeandmail\.com$/i, code: 'CA' },
  { pattern: /(^|\.)dw\.com$/i, code: 'DE' },
  { pattern: /(^|\.)spiegel\.de$/i, code: 'DE' },
  { pattern: /(^|\.)lemonde\.fr$/i, code: 'FR' },
];
const PUBLISHER_COUNTRY_RULES = [
  { pattern: /\b(BBC|Reuters|Financial Times|The Guardian|Nature)\b/i, code: 'GB' },
  {
    pattern:
      /\b(New York Times|Wall Street Journal|CNBC|Bloomberg|OpenAI|Associated Press|Fortune|Wired|Vanity Fair|MIT Technology Review|Christian Science Monitor|Popular Science|The Verge|Observer|Gizmodo|San Francisco Chronicle)\b/i,
    code: 'US',
  },
  { pattern: /\b(CBC|The Globe and Mail)\b/i, code: 'CA' },
  { pattern: /\b(ABC News Australia)\b/i, code: 'AU' },
  { pattern: /\b(Der Spiegel|Deutsche Welle)\b/i, code: 'DE' },
  { pattern: /\b(Business Standard|Analytics India Magazine)\b/i, code: 'IN' },
];
const COUNTRY_NAME_BY_CODE = new Map(COUNTRY_CATALOG.map((country) => [country.code, country.name]));
const COUNTRY_TLD_TO_CODE = new Map(
  COUNTRY_CATALOG.flatMap((country) => country.tlds.map((tld) => [tld, country.code])),
);

const BOT_USERNAME = process.env.WIKIPEDIA_IMPORT_BOT_USERNAME || 'wikipedia_import_bot';
const BOT_EMAIL = process.env.WIKIPEDIA_IMPORT_BOT_EMAIL || 'wikipedia-import-bot@sourcewiki.local';
const BOT_PASSWORD = process.env.WIKIPEDIA_IMPORT_BOT_PASSWORD || crypto.randomUUID();
const WIKIPEDIA_USER_AGENT =
  process.env.WIKIPEDIA_IMPORT_USER_AGENT ||
  'SourceWikiImporter/1.0 (https://github.com/DNShitobu/SourceWiki)';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeExternalUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const candidate = value.startsWith('//') ? `https:${value}` : value.trim();

  try {
    const parsed = new URL(candidate);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
};

const normalizeArticleInput = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.hostname !== 'en.wikipedia.org') {
      throw new Error('Only English Wikipedia article URLs are supported');
    }

    if (!parsed.pathname.startsWith('/wiki/')) {
      throw new Error('Wikipedia article URLs must use /wiki/ paths');
    }

    return decodeURIComponent(parsed.pathname.replace(/^\/wiki\//, '')).replace(/_/g, ' ');
  } catch (error) {
    if (error instanceof TypeError) {
      return trimmed.replace(/_/g, ' ');
    }

    throw error;
  }
};

const toWikipediaArticleUrl = (title) =>
  `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

const trimImportedText = (value, maxLength) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();

  if (!cleaned) {
    return null;
  }

  return typeof maxLength === 'number' ? cleaned.slice(0, maxLength) : cleaned;
};

const derivePublisher = (referenceUrl) => {
  const hostname = new URL(referenceUrl).hostname.replace(/^www\./, '');
  return hostname.slice(0, 100);
};

const deriveReferenceTitle = (referenceUrl, articleTitle) => {
  const parsed = new URL(referenceUrl);
  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  const lastSegment = decodeURIComponent(pathSegments[pathSegments.length - 1] || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (lastSegment.length >= 5) {
    return lastSegment.slice(0, 200);
  }

  const fallback = `Reference from ${articleTitle}`;
  return fallback.slice(0, 200);
};

const getReferenceHostname = (referenceUrl) => {
  try {
    return new URL(referenceUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
};

const matchesAnyPattern = (value, patterns) =>
  Boolean(value) && patterns.some((pattern) => pattern.test(value));

const getCitationType = (referenceItem) => {
  const citationClasses = referenceItem.querySelector('cite')?.getAttribute('class') || '';

  return citationClasses
    .split(/\s+/)
    .map((className) => className.trim().toLowerCase())
    .find((className) => className && className !== 'citation' && className !== 'cs1') || null;
};

const detectCountryFromHostname = (hostname) => {
  if (!hostname) {
    return null;
  }

  const matchingRule = DOMAIN_COUNTRY_RULES.find((rule) => rule.pattern.test(hostname));

  if (matchingRule) {
    return matchingRule.code;
  }

  if (hostname.endsWith('.gov') || hostname.endsWith('.edu')) {
    return 'US';
  }

  const normalizedHostname = hostname.replace(/^www\./, '');
  const labels = normalizedHostname.split('.');
  const trailingLabels = labels.slice(-2).join('.');

  if (trailingLabels === 'co.uk' || trailingLabels === 'gov.uk' || trailingLabels === 'ac.uk') {
    return 'GB';
  }

  const tld = labels[labels.length - 1];
  return COUNTRY_TLD_TO_CODE.get(tld) || null;
};

const detectCountryFromPublisher = (publisher) => {
  const matchingRule = PUBLISHER_COUNTRY_RULES.find((rule) => rule.pattern.test(publisher || ''));
  return matchingRule?.code || null;
};

const classifyReferenceCountry = (reference, defaultCountry) => {
  const hostname = getReferenceHostname(reference.url);
  const countryFromHostname = detectCountryFromHostname(hostname);

  if (countryFromHostname) {
    return countryFromHostname;
  }

  const countryFromPublisher = detectCountryFromPublisher(reference.publisher);

  if (countryFromPublisher) {
    return countryFromPublisher;
  }

  return defaultCountry;
};

const classifyReferenceCategory = (reference, fallbackCategory) => {
  const hostname = getReferenceHostname(reference.url);

  if (matchesAnyPattern(hostname, UNRELIABLE_HOST_PATTERNS)) {
    return 'unreliable';
  }

  if (
    PRIMARY_CITATION_TYPES.has(reference.citationType) ||
    matchesAnyPattern(hostname, PRIMARY_HOST_PATTERNS)
  ) {
    return 'primary';
  }

  if (
    SECONDARY_CITATION_TYPES.has(reference.citationType) ||
    matchesAnyPattern(hostname, SECONDARY_HOST_PATTERNS)
  ) {
    return 'secondary';
  }

  return fallbackCategory;
};

const isLikelyCredibleReference = (reference, fallbackCategory) => {
  const hostname = getReferenceHostname(reference.url);
  const hasPublisherAndTitle = Boolean(reference.publisher && reference.title);

  if (matchesAnyPattern(hostname, UNRELIABLE_HOST_PATTERNS)) {
    return false;
  }

  if (
    matchesAnyPattern(hostname, PRIMARY_HOST_PATTERNS) ||
    matchesAnyPattern(hostname, SECONDARY_HOST_PATTERNS)
  ) {
    return true;
  }

  if (
    PRIMARY_CITATION_TYPES.has(reference.citationType) ||
    (SECONDARY_CITATION_TYPES.has(reference.citationType) && hasPublisherAndTitle)
  ) {
    return true;
  }

  if (
    hasPublisherAndTitle &&
    (detectCountryFromHostname(hostname) || detectCountryFromPublisher(reference.publisher))
  ) {
    return true;
  }

  return classifyReferenceCategory(reference, fallbackCategory) === 'primary';
};

const isArchiveUrl = (referenceUrl) => {
  try {
    const hostname = new URL(referenceUrl).hostname.toLowerCase();
    return ARCHIVE_HOSTS.has(hostname);
  } catch {
    return false;
  }
};

const parseCoinsMetadata = (referenceItem) => {
  const coins = referenceItem.querySelector('span.Z3988');
  const rawMetadata = coins?.getAttribute('title');

  if (!rawMetadata) {
    return null;
  }

  const params = new URLSearchParams(rawMetadata);
  const url = params
    .getAll('rft_id')
    .map((value) => normalizeExternalUrl(value))
    .find(Boolean) || null;
  const title = COINS_TITLE_KEYS
    .map((key) => trimImportedText(params.get(key), 200))
    .find(Boolean) || null;
  const publisher = COINS_PUBLISHER_KEYS
    .map((key) => trimImportedText(params.get(key), 100))
    .find(Boolean) || null;

  if (!url && !title && !publisher) {
    return null;
  }

  return { url, title, publisher };
};

const pickBestExternalAnchor = (referenceItem) => {
  let bestAnchor = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const anchor of referenceItem.querySelectorAll('a.external[href]')) {
    const url = normalizeExternalUrl(anchor.getAttribute('href'));

    if (!url) {
      continue;
    }

    const text = trimImportedText(anchor.text, 200);
    const normalizedText = text?.toLowerCase() || '';
    let score = 0;

    if (!isArchiveUrl(url)) {
      score += 10;
    }

    if (text && !GENERIC_LINK_TEXT.has(normalizedText)) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestAnchor = { url, text };
    }
  }

  return bestAnchor;
};

const extractFallbackTitle = (referenceItem, bestAnchor, referenceUrl, articleTitle) => {
  const quotedTitle = trimImportedText(referenceItem.querySelector('cite q')?.text, 200);

  if (quotedTitle) {
    return quotedTitle;
  }

  const anchorTitle = trimImportedText(bestAnchor?.text, 200);

  if (anchorTitle && !GENERIC_LINK_TEXT.has(anchorTitle.toLowerCase())) {
    return anchorTitle;
  }

  return deriveReferenceTitle(referenceUrl, articleTitle);
};

const extractFallbackPublisher = (referenceItem, referenceUrl) => {
  const citedPublication = trimImportedText(referenceItem.querySelector('cite i')?.text, 100);

  if (citedPublication) {
    return citedPublication;
  }

  return derivePublisher(referenceUrl);
};

const extractReferenceEntriesFromHtml = (html, articleTitle) => {
  const root = parse(html);
  const referencesByUrl = new Map();
  const referenceItems = root.querySelectorAll('li[id^="cite_note"], ol.references > li');

  for (const item of referenceItems) {
    const coinsMetadata = parseCoinsMetadata(item);
    const bestAnchor = pickBestExternalAnchor(item);
    const citationType = getCitationType(item);
    const referenceUrl = coinsMetadata?.url || bestAnchor?.url;

    if (!referenceUrl) {
      continue;
    }

    const nextEntry = {
      url: referenceUrl,
      title:
        coinsMetadata?.title ||
        extractFallbackTitle(item, bestAnchor, referenceUrl, articleTitle),
      publisher:
        coinsMetadata?.publisher ||
        extractFallbackPublisher(item, referenceUrl),
      citationType,
    };
    const existingEntry = referencesByUrl.get(referenceUrl);

    if (!existingEntry) {
      referencesByUrl.set(referenceUrl, nextEntry);
      continue;
    }

    if (!existingEntry.title && nextEntry.title) {
      existingEntry.title = nextEntry.title;
    }

    if (!existingEntry.publisher && nextEntry.publisher) {
      existingEntry.publisher = nextEntry.publisher;
    }

    if (!existingEntry.citationType && nextEntry.citationType) {
      existingEntry.citationType = nextEntry.citationType;
    }
  }

  return [...referencesByUrl.values()];
};

const callWikipediaApi = async (params) => {
  const url = new URL(WIKIPEDIA_API_URL);

  Object.entries({
    format: 'json',
    formatversion: '2',
    origin: '*',
    maxlag: '5',
    ...params,
  }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': WIKIPEDIA_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia API returned ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.info || data.error.code || 'Wikipedia API error');
  }

  return data;
};

const fetchArticleMetadata = async (articleInput) => {
  const normalizedTitle = normalizeArticleInput(articleInput);

  if (!normalizedTitle) {
    throw new Error('Article title or URL is required');
  }

  const data = await callWikipediaApi({
    action: 'query',
    prop: 'info',
    inprop: 'url',
    redirects: '1',
    titles: normalizedTitle,
  });

  const page = data?.query?.pages?.[0];

  if (!page || page.missing) {
    throw new Error(`Wikipedia article not found: ${normalizedTitle}`);
  }

  return {
    pageId: page.pageid,
    title: page.title,
    url: page.fullurl || toWikipediaArticleUrl(page.title),
  };
};

const fetchReferenceEntriesForArticle = async (article) => {
  const parseData = await callWikipediaApi({
    action: 'parse',
    page: article.title,
    prop: 'text',
    redirects: '1',
  });

  const html = parseData?.parse?.text || '';
  const references = extractReferenceEntriesFromHtml(html, article.title);

  if (references.length > 0) {
    return references;
  }

  let continuation = {};
  const referencesFromExtlinks = [];
  const urls = new Set();

  while (true) {
    const extlinksData = await callWikipediaApi({
      action: 'query',
      prop: 'extlinks',
      titles: article.title,
      redirects: '1',
      ellimit: 'max',
      ...continuation,
    });

    const page = extlinksData?.query?.pages?.[0];

    for (const link of page?.extlinks || []) {
      const normalizedUrl = normalizeExternalUrl(link['*'] || link.url);

      if (normalizedUrl && !urls.has(normalizedUrl)) {
        urls.add(normalizedUrl);
        referencesFromExtlinks.push({
          url: normalizedUrl,
          title: deriveReferenceTitle(normalizedUrl, article.title),
          publisher: derivePublisher(normalizedUrl),
          citationType: null,
        });
      }
    }

    if (!extlinksData.continue) {
      break;
    }

    continuation = Object.fromEntries(
      Object.entries(extlinksData.continue).filter(([key]) => key !== 'continue'),
    );
  }

  return referencesFromExtlinks;
};

const getOrCreateWikipediaBotUser = async () => {
  let user = await User.findOne({ username: BOT_USERNAME });

  if (user) {
    return user;
  }

  user = await User.create({
    username: BOT_USERNAME,
    email: BOT_EMAIL,
    password: BOT_PASSWORD,
    country: 'GLOBAL',
    role: 'contributor',
  });

  return user;
};

const summarizeCountryAssignments = (references) =>
  references.reduce((summary, reference) => {
    summary[reference.country] = (summary[reference.country] || 0) + 1;
    return summary;
  }, {});

const mergeCountryAssignments = (assignmentMaps) =>
  assignmentMaps.reduce((summary, assignmentMap) => {
    for (const [country, count] of Object.entries(assignmentMap || {})) {
      summary[country] = (summary[country] || 0) + count;
    }

    return summary;
  }, {});

const prepareReferencesForImport = ({
  references,
  defaultCountry,
  defaultCategory,
  credibleOnly,
  autoDetectCountry,
  autoClassifyCategory,
}) => {
  const preparedReferences = [];
  let filteredOutReferences = 0;

  for (const reference of references) {
    const category = autoClassifyCategory
      ? classifyReferenceCategory(reference, defaultCategory)
      : defaultCategory;
    const likelyCredible = isLikelyCredibleReference(reference, defaultCategory);

    if (credibleOnly && !likelyCredible) {
      filteredOutReferences += 1;
      continue;
    }

    preparedReferences.push({
      ...reference,
      country: autoDetectCountry
        ? classifyReferenceCountry(reference, defaultCountry)
        : defaultCountry,
      category,
      likelyCredible,
      credibleOnlyImport: credibleOnly,
      usedAutoCountry: autoDetectCountry,
      usedAutoCategory: autoClassifyCategory,
    });
  }

  return {
    preparedReferences,
    filteredOutReferences,
    countryAssignments: summarizeCountryAssignments(preparedReferences),
  };
};

const syncCountryStats = async (references) => {
  const countryCodes = [...new Set(references.map((reference) => reference.country))]
    .filter((countryCode) => countryCode && countryCode !== 'GLOBAL');

  for (const countryCode of countryCodes) {
    const stats = await CountryStats.getOrCreate(
      countryCode,
      COUNTRY_NAME_BY_CODE.get(countryCode) || countryCode,
    );
    await stats.updateStats();
  }
};

const buildSubmissionDocuments = ({ references, article, submitterId }) =>
  references.map((reference) => {
    const noteParts = [
      `Imported automatically from English Wikipedia article "${article.title}".`,
    ];

    if (reference.credibleOnlyImport && reference.likelyCredible) {
      noteParts.push('Bot filtered this source as likely credible.');
    }

    if (reference.usedAutoCountry) {
      noteParts.push(`Auto-assigned country ${reference.country}.`);
    }

    if (reference.usedAutoCategory) {
      noteParts.push(`Auto-classified category ${reference.category}.`);
    }

    return {
      url: reference.url,
      title: reference.title || deriveReferenceTitle(reference.url, article.title),
      publisher: reference.publisher || derivePublisher(reference.url),
      country: reference.country,
      category: reference.category,
      wikipediaArticle: article.url,
      fileType: 'url',
      submitter: submitterId,
      tags: ['wikipedia-import', 'enwiki', article.title],
      verifierNotes: noteParts.join(' '),
    };
  });

export const importWikipediaArticleReferences = async ({
  articleInput,
  submitterId,
  defaultCountry = 'GLOBAL',
  defaultCategory = 'secondary',
  credibleOnly = false,
  autoDetectCountry = false,
  autoClassifyCategory = false,
}) => {
  const article = await fetchArticleMetadata(articleInput);
  const references = await fetchReferenceEntriesForArticle(article);
  const {
    preparedReferences,
    filteredOutReferences,
    countryAssignments,
  } = prepareReferencesForImport({
    references,
    defaultCountry,
    defaultCategory,
    credibleOnly,
    autoDetectCountry,
    autoClassifyCategory,
  });
  const referenceUrls = preparedReferences.map((reference) => reference.url);

  const existingSubmissions = await Submission.find({
    wikipediaArticle: article.url,
    url: { $in: referenceUrls },
  }).select('url');

  const existingUrls = new Set(existingSubmissions.map((submission) => submission.url));
  const newReferences = preparedReferences.filter((reference) => !existingUrls.has(reference.url));
  const documents = buildSubmissionDocuments({
    references: newReferences,
    article,
    submitterId,
  });

  if (documents.length > 0) {
    await Submission.insertMany(documents, { ordered: false });
    await syncCountryStats(newReferences);
  }

  return {
    articleTitle: article.title,
    wikipediaArticle: article.url,
    totalReferenceUrls: references.length,
    filteredOutReferences,
    createdSubmissions: documents.length,
    skippedSubmissions: preparedReferences.length - documents.length,
    countryAssignments,
  };
};

export const importWikipediaArticles = async ({
  articleInputs,
  defaultCountry = 'GLOBAL',
  defaultCategory = 'secondary',
  credibleOnly = false,
  autoDetectCountry = false,
  autoClassifyCategory = false,
}) => {
  const botUser = await getOrCreateWikipediaBotUser();
  const results = [];
  const failures = [];

  for (const articleInput of articleInputs) {
    try {
      const result = await importWikipediaArticleReferences({
        articleInput,
        submitterId: botUser._id,
        defaultCountry,
        defaultCategory,
        credibleOnly,
        autoDetectCountry,
        autoClassifyCategory,
      });

      results.push(result);
    } catch (error) {
      failures.push({
        article: articleInput,
        error: error.message,
      });
    }

    await delay(IMPORT_DELAY_MS);
  }

  return {
    mode: 'titles',
    processedArticles: results.length,
    failedArticles: failures,
    createdSubmissions: results.reduce((total, result) => total + result.createdSubmissions, 0),
    skippedSubmissions: results.reduce((total, result) => total + result.skippedSubmissions, 0),
    filteredOutReferences: results.reduce(
      (total, result) => total + (result.filteredOutReferences || 0),
      0,
    ),
    countryAssignments: mergeCountryAssignments(
      results.map((result) => result.countryAssignments || {}),
    ),
    results,
  };
};

export const fetchWikipediaAllPagesBatch = async ({
  limit = DEFAULT_BATCH_LIMIT,
  continueToken,
}) => {
  const data = await callWikipediaApi({
    action: 'query',
    list: 'allpages',
    apnamespace: '0',
    aplimit: String(Math.min(Math.max(limit, 1), MAX_BATCH_LIMIT)),
    apcontinue: continueToken,
  });

  return {
    titles: (data?.query?.allpages || []).map((page) => page.title),
    nextContinueToken: data?.continue?.apcontinue || null,
  };
};

export const importWikipediaAllPagesBatch = async ({
  limit = DEFAULT_BATCH_LIMIT,
  continueToken,
  defaultCountry = 'GLOBAL',
  defaultCategory = 'secondary',
  credibleOnly = false,
  autoDetectCountry = false,
  autoClassifyCategory = false,
}) => {
  const batch = await fetchWikipediaAllPagesBatch({ limit, continueToken });
  const importResult = await importWikipediaArticles({
    articleInputs: batch.titles,
    defaultCountry,
    defaultCategory,
    credibleOnly,
    autoDetectCountry,
    autoClassifyCategory,
  });

  return {
    ...importResult,
    mode: 'allpages',
    requestedArticles: batch.titles.length,
    nextContinueToken: batch.nextContinueToken,
  };
};
