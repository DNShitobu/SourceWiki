import fs from 'node:fs/promises';
import path from 'node:path';
import connectDB, { closeDB } from '../config/database.js';
import {
  importWikipediaAllPagesBatch,
  importWikipediaArticles,
} from '../services/wikipediaImportService.js';

const parseArguments = (argv) => {
  const parsed = {};

  for (const rawArg of argv) {
    const arg = rawArg.startsWith('--') ? rawArg.slice(2) : rawArg;
    const [key, ...rest] = arg.split('=');
    parsed[key] = rest.length > 0 ? rest.join('=') : true;
  }

  return parsed;
};

const parseBooleanFlag = (value) =>
  value === true || value === 'true' || value === '1';

const loadStateFile = async (stateFilePath) => {
  if (!stateFilePath) {
    return null;
  }

  try {
    const rawState = await fs.readFile(stateFilePath, 'utf8');
    return JSON.parse(rawState);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
};

const saveStateFile = async (stateFilePath, state) => {
  if (!stateFilePath) {
    return;
  }

  await fs.mkdir(path.dirname(stateFilePath), { recursive: true });
  await fs.writeFile(stateFilePath, JSON.stringify(state, null, 2));
};

const mergeCountryAssignments = (assignmentMaps) =>
  assignmentMaps.reduce((summary, assignmentMap) => {
    for (const [country, count] of Object.entries(assignmentMap || {})) {
      summary[country] = (summary[country] || 0) + count;
    }

    return summary;
  }, {});

const aggregateBatchResults = (batchResults) => ({
  mode: 'allpages',
  processedBatches: batchResults.length,
  requestedArticles: batchResults.reduce(
    (total, result) => total + (result.requestedArticles || 0),
    0,
  ),
  processedArticles: batchResults.reduce(
    (total, result) => total + (result.processedArticles || 0),
    0,
  ),
  createdSubmissions: batchResults.reduce(
    (total, result) => total + result.createdSubmissions,
    0,
  ),
  skippedSubmissions: batchResults.reduce(
    (total, result) => total + result.skippedSubmissions,
    0,
  ),
  filteredOutReferences: batchResults.reduce(
    (total, result) => total + (result.filteredOutReferences || 0),
    0,
  ),
  countryAssignments: mergeCountryAssignments(
    batchResults.map((result) => result.countryAssignments || {}),
  ),
  failedArticles: batchResults.flatMap((result) => result.failedArticles || []),
  nextContinueToken:
    batchResults.length > 0
      ? batchResults[batchResults.length - 1].nextContinueToken
      : null,
  batches: batchResults,
});

const args = parseArguments(process.argv.slice(2));
const mode = args['all-pages'] ? 'allpages' : 'titles';
const articleTitle = args.title;
const articleTitles = args.titles
  ? String(args.titles).split(',').map((item) => item.trim()).filter(Boolean)
  : [];
const articleLimit = Number(args.limit || 5);
const requestedContinueToken = args.continue ? String(args.continue) : undefined;
const defaultCountry = args.country ? String(args.country) : 'GLOBAL';
const defaultCategory = args.category ? String(args.category) : 'secondary';
const credibleOnly = parseBooleanFlag(args['credible-only']);
const autoDetectCountry = parseBooleanFlag(args['auto-detect-country']);
const autoClassifyCategory = parseBooleanFlag(args['auto-classify-category']);
const requestedBatches = Number(args.batches || 1);
const batchCount = Number.isFinite(requestedBatches) && requestedBatches > 0
  ? Math.floor(requestedBatches)
  : 1;
const stateFile = args['state-file']
  ? path.resolve(process.cwd(), String(args['state-file']))
  : undefined;

if (mode === 'titles' && !articleTitle && articleTitles.length === 0) {
  console.error('Provide --title="Article" or --titles="Article One,Article Two".');
  process.exit(1);
}

try {
  await connectDB();

  const importerState = stateFile ? await loadStateFile(stateFile) : null;
  let continueToken = requestedContinueToken || importerState?.continueToken;

  const result = mode === 'allpages'
    ? aggregateBatchResults(
        await (async () => {
          const batchResults = [];

          for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
            const batchResult = await importWikipediaAllPagesBatch({
              limit: articleLimit,
              continueToken,
              defaultCountry,
              defaultCategory,
              credibleOnly,
              autoDetectCountry,
              autoClassifyCategory,
            });

            batchResults.push(batchResult);
            continueToken = batchResult.nextContinueToken || null;

            await saveStateFile(stateFile, {
              continueToken,
              updatedAt: new Date().toISOString(),
              processedBatches: batchIndex + 1,
            });

            if (!continueToken) {
              break;
            }
          }

          return batchResults;
        })(),
      )
    : await importWikipediaArticles({
        articleInputs: articleTitle ? [articleTitle] : articleTitles,
        defaultCountry,
        defaultCategory,
        credibleOnly,
        autoDetectCountry,
        autoClassifyCategory,
      });

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
