import Submission from '../models/Submission.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { buildSafeSearchRegex } from '../utils/sanitization.js';
import {
  appendSubmissionDiscussion,
  appendSubmissionHistory,
  buildArticleContext,
  buildSourceFingerprint,
  buildSubmissionLink,
  createDiscussionEntry,
  createHistoryEntry,
  createNotification,
  createNotificationHtml,
  mergeArticleContext,
  normalizeSourceUrl,
} from '../services/submissionWorkflowService.js';
import { serializeSubmission, serializeSubmissions } from '../utils/serializers.js';

const populateSubmission = (query) =>
  query
    .populate('submitter', 'username country email role points badges')
    .populate('verifier', 'username country email role')
    .populate('queue.claimedBy', 'username country role')
    .populate('reviewHistory.actor', 'username role')
    .populate('discussion.author', 'username role')
    .populate('discussion.resolvedBy', 'username role');

const buildArticleContextFromBody = (body = {}, fallbackArticleUrl) =>
  buildArticleContext({
    articleTitle: body.articleTitle,
    articleUrl: body.articleUrl || body.wikipediaArticle || fallbackArticleUrl,
    sectionTitle: body.sectionTitle,
    referenceLabel: body.referenceLabel,
    citationText: body.citationText,
    archiveUrl: body.archiveUrl,
    accessDate: body.accessDate,
    source: body.contextSource || 'manual',
  });

const findDuplicateSubmission = async ({ sourceFingerprint, excludeId = null }) => {
  if (!sourceFingerprint) {
    return null;
  }

  const query = { sourceFingerprint };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Submission.findOne(query);
};

const getVerifierRecipients = async (country) =>
  User.find({
    isActive: true,
    $or: [
      { role: 'admin' },
      { role: 'verifier', country },
    ],
  }).select('username email role country');

const notifySubmissionCreated = async (submissionDoc, submitter, country) => {
  const submissionLink = buildSubmissionLink(submissionDoc._id);
  const verifierRecipients = await getVerifierRecipients(country);

  await createNotification({
    userId: submitter._id,
    type: 'submission_received',
    title: 'Submission received',
    message: `"${submissionDoc.title}" is now pending review.`,
    link: submissionLink,
    email: submitter.email,
    emailSubject: 'Submission received',
    emailHtml: createNotificationHtml({
      heading: `Hello ${submitter.username},`,
      body: `Your submission "${submissionDoc.title}" is now pending review for ${country}.`,
      footer: 'You can track its progress inside SourceWiki.',
    }),
  });

  await Promise.all(
    verifierRecipients
      .filter((user) => user._id.toString() !== submitter._id.toString())
      .map((user) =>
        createNotification({
          userId: user._id,
          type: 'system',
          title: 'New submission pending review',
          message: `"${submissionDoc.title}" is waiting in the ${country} queue.`,
          link: submissionLink,
          email: user.email,
          emailSubject: `New submission for ${country}`,
          emailHtml: createNotificationHtml({
            heading: 'New submission pending review',
            body: `${submitter.username} submitted "${submissionDoc.title}" for ${country}.`,
            footer: 'Log in to claim or review it.',
          }),
        }),
      ),
  );
};

const notifySubmissionReviewOutcome = async (submissionDoc, submitter, reviewer, status, credibility) => {
  const approved = status === 'approved';
  const title = approved ? 'Submission reviewed' : 'Submission rejected';
  const message = approved
    ? `"${submissionDoc.title}" was reviewed as ${credibility || 'unreliable'}.`
    : `"${submissionDoc.title}" was rejected.`;

  await createNotification({
    userId: submitter._id,
    type: approved ? 'submission_verified' : 'submission_rejected',
    title,
    message,
    link: buildSubmissionLink(submissionDoc._id),
    email: submitter.email,
    emailSubject: title,
    emailHtml: createNotificationHtml({
      heading: `Hello ${submitter.username},`,
      body: `${reviewer.username} reviewed "${submissionDoc.title}". ${message}`,
      footer: submissionDoc.verifierNotes ? `Notes: ${submissionDoc.verifierNotes}` : '',
    }),
  });
};

const notifyDiscussionEvent = async ({ submission, actor, type, message }) => {
  const recipients = new Map();
  const submissionLink = buildSubmissionLink(submission._id);

  [submission.submitter, submission.verifier, submission.queue?.claimedBy]
    .filter(Boolean)
    .forEach((user) => {
      recipients.set(user._id.toString(), user);
    });

  for (const entry of submission.discussion || []) {
    if (entry.author && typeof entry.author === 'object') {
      recipients.set(entry.author._id.toString(), entry.author);
    }
  }

  recipients.delete(actor._id.toString());

  await Promise.all(
    [...recipients.values()].map((recipient) =>
      createNotification({
        userId: recipient._id,
        type: type === 'appeal' ? 'appeal_opened' : 'comment_added',
        title: type === 'appeal' ? 'A submission appeal needs review' : 'New submission discussion',
        message,
        link: submissionLink,
        email: recipient.email,
        emailSubject: type === 'appeal' ? 'Submission appeal opened' : 'New submission comment',
        emailHtml: createNotificationHtml({
          heading: type === 'appeal' ? 'Submission appeal opened' : 'New submission comment',
          body: `${actor.username} added ${type === 'appeal' ? 'an appeal' : 'a comment'} on "${submission.title}".`,
          footer: 'Open SourceWiki to read the full discussion.',
        }),
      }),
    ),
  );
};

const ensureQueueAccess = (submission, user) => {
  const claimedBy = submission.queue?.claimedBy?.toString?.() || submission.queue?.claimedBy?._id?.toString?.();

  if (claimedBy && claimedBy !== user.id && user.role !== 'admin') {
    throw new AppError(
      'This submission is currently claimed by another verifier.',
      409,
      ErrorCodes.OPERATION_NOT_ALLOWED,
    );
  }
};

const transformSubmissionPayload = (body, userId) => {
  const normalizedUrl = normalizeSourceUrl(body.url);
  const sourceFingerprint = buildSourceFingerprint(body.url);

  return {
    url: normalizedUrl || body.url,
    normalizedUrl,
    sourceFingerprint,
    sourceHostname: normalizedUrl ? new URL(normalizedUrl).hostname : undefined,
    title: body.title,
    publisher: body.publisher,
    country: body.country,
    category: body.category,
    wikipediaArticle: body.wikipediaArticle,
    fileType: body.fileType || 'url',
    fileName: body.fileName,
    submitter: userId,
  };
};

// @desc    Create new submission
// @route   POST /api/submissions
// @access  Private
export const createSubmission = async (req, res, next) => {
  try {
    const submissionPayload = transformSubmissionPayload(req.body, req.user.id);
    const articleContext = buildArticleContextFromBody(req.body, req.body.wikipediaArticle);

    if (!submissionPayload.normalizedUrl || !submissionPayload.sourceFingerprint) {
      return next(new AppError('Please provide a valid http or https URL', 400, ErrorCodes.INVALID_INPUT));
    }

    const duplicate = await findDuplicateSubmission({
      sourceFingerprint: submissionPayload.sourceFingerprint,
    });

    if (duplicate) {
      duplicate.articleContexts = mergeArticleContext(duplicate.articleContexts, articleContext);
      if (!duplicate.wikipediaArticle && submissionPayload.wikipediaArticle) {
        duplicate.wikipediaArticle = submissionPayload.wikipediaArticle;
      }
      appendSubmissionHistory(
        duplicate,
        createHistoryEntry({
          action: 'duplicate_detected',
          actor: req.user.id,
          actorName: req.user.username,
          note: 'A duplicate submission attempt was merged into the existing source record.',
          metadata: { submittedBy: req.user.id.toString() },
        }),
      );
      await duplicate.save();

      const populatedDuplicate = await populateSubmission(Submission.findById(duplicate._id));

      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'This source already exists. The article context was merged into the existing record.',
        submission: serializeSubmission(populatedDuplicate),
      });
    }

    const submission = await Submission.create({
      ...submissionPayload,
      articleContexts: articleContext ? [articleContext] : [],
      reviewHistory: [
        createHistoryEntry({
          action: submissionPayload.wikipediaArticle ? 'imported' : 'created',
          actor: req.user.id,
          actorName: req.user.username,
          note: submissionPayload.wikipediaArticle
            ? 'Submission created with linked Wikipedia context.'
            : 'Submission created by contributor.',
          toStatus: 'pending',
        }),
      ],
    });

    await User.findByIdAndUpdate(req.user.id, {
      $inc: { points: 10 },
    });

    const populatedSubmission = await populateSubmission(Submission.findById(submission._id));
    await notifySubmissionCreated(populatedSubmission, req.user, submission.country);

    res.status(201).json({
      success: true,
      submission: serializeSubmission(populatedSubmission),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all submissions with filters
// @route   GET /api/submissions
// @access  Public
export const getSubmissions = async (req, res, next) => {
  try {
    const {
      country,
      category,
      status,
      page = 1,
      limit = 20,
      search,
      reliability,
      claimed,
    } = req.query;
    const searchRegex = buildSafeSearchRegex(search);

    const query = {};

    if (country) query.country = country;
    if (category) query.category = category;
    if (status) query.status = status;
    if (reliability) query.credibility = reliability;
    if (claimed === 'true') query['queue.claimedBy'] = { $ne: null };
    if (claimed === 'false') query['queue.claimedBy'] = null;
    if (searchRegex) {
      query.$or = [
        { title: searchRegex },
        { publisher: searchRegex },
        { url: searchRegex },
      ];
    }

    const numericPage = parseInt(page, 10);
    const numericLimit = parseInt(limit, 10);
    const skip = (numericPage - 1) * numericLimit;

    const submissions = await populateSubmission(
      Submission.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit),
    );

    const total = await Submission.countDocuments(query);

    res.status(200).json({
      success: true,
      count: submissions.length,
      total,
      page: numericPage,
      pages: Math.ceil(total / numericLimit),
      submissions: serializeSubmissions(submissions),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single submission
// @route   GET /api/submissions/:id
// @access  Public
export const getSubmission = async (req, res, next) => {
  try {
    const submission = await populateSubmission(Submission.findById(req.params.id));

    if (!submission) {
      return next(new AppError('Submission not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
    }

    res.status(200).json({
      success: true,
      submission: serializeSubmission(submission),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's submissions
// @route   GET /api/submissions/my/submissions
// @access  Private
export const getMySubmissions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const numericPage = parseInt(page, 10);
    const numericLimit = parseInt(limit, 10);
    const skip = (numericPage - 1) * numericLimit;

    const submissions = await populateSubmission(
      Submission.find({ submitter: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit),
    );

    const total = await Submission.countDocuments({ submitter: req.user.id });

    res.status(200).json({
      success: true,
      count: submissions.length,
      total,
      page: numericPage,
      pages: Math.ceil(total / numericLimit),
      submissions: serializeSubmissions(submissions),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update submission (only by submitter before verification)
// @route   PUT /api/submissions/:id
// @access  Private
export const updateSubmission = async (req, res, next) => {
  try {
    let submission = await Submission.findById(req.params.id);

    if (!submission) {
      return next(new AppError('Submission not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
    }

    if (submission.submitter.toString() !== req.user.id) {
      return next(new AppError('Not authorized to update this submission', 403, ErrorCodes.UNAUTHORIZED_ACCESS));
    }

    if (submission.status !== 'pending') {
      return next(new AppError('Cannot update a verified submission', 400, ErrorCodes.SUBMISSION_LOCKED));
    }

    const articleContext = buildArticleContextFromBody(req.body, req.body.wikipediaArticle || submission.wikipediaArticle);
    submission.title = req.body.title || submission.title;
    submission.publisher = req.body.publisher || submission.publisher;
    submission.wikipediaArticle = req.body.wikipediaArticle || submission.wikipediaArticle;
    submission.category = req.body.category || submission.category;
    submission.articleContexts = mergeArticleContext(submission.articleContexts, articleContext);

    appendSubmissionHistory(
      submission,
      createHistoryEntry({
        action: 'updated',
        actor: req.user.id,
        actorName: req.user.username,
        note: 'Contributor updated submission metadata or article context.',
      }),
    );

    await submission.save();
    submission = await populateSubmission(Submission.findById(submission._id));

    res.status(200).json({
      success: true,
      submission: serializeSubmission(submission),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete submission (only by submitter if pending)
// @route   DELETE /api/submissions/:id
// @access  Private
export const deleteSubmission = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);

    if (!submission) {
      return next(new AppError('Submission not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
    }

    if (submission.submitter.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new AppError('Not authorized to delete this submission', 403, ErrorCodes.UNAUTHORIZED_ACCESS));
    }

    await submission.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Submission deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Claim submission for review
// @route   POST /api/submissions/:id/claim
// @access  Private (verifier, admin)
export const claimSubmission = async (req, res, next) => {
  try {
    let submission = await Submission.findById(req.params.id).populate('submitter', 'username email');

    if (!submission) {
      return next(new AppError('Submission not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
    }

    if (submission.status !== 'pending') {
      return next(new AppError('Only pending submissions can be claimed', 400, ErrorCodes.SUBMISSION_LOCKED));
    }

    if (req.user.role !== 'admin' && submission.country !== req.user.country) {
      return next(new AppError('You can only claim submissions from your country queue', 403, ErrorCodes.UNAUTHORIZED_ACCESS));
    }

    ensureQueueAccess(submission, req.user);

    submission.queue = {
      ...submission.queue,
      claimedBy: req.user.id,
      claimedAt: new Date(),
      priority: submission.queue?.priority || 'normal',
    };

    appendSubmissionHistory(
      submission,
      createHistoryEntry({
        action: 'claimed',
        actor: req.user.id,
        actorName: req.user.username,
        note: 'Submission claimed for review.',
      }),
    );

    await submission.save();
    submission = await populateSubmission(Submission.findById(submission._id));

    await createNotification({
      userId: submission.submitter._id,
      type: 'submission_claimed',
      title: 'A verifier claimed your submission',
      message: `${req.user.username} claimed "${submission.title}" for review.`,
      link: buildSubmissionLink(submission._id),
      email: submission.submitter.email,
      emailSubject: 'A verifier claimed your submission',
      emailHtml: createNotificationHtml({
        heading: 'Your submission is being reviewed',
        body: `${req.user.username} claimed "${submission.title}" for review.`,
      }),
    });

    res.status(200).json({
      success: true,
      submission: serializeSubmission(submission),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Release submission claim
// @route   POST /api/submissions/:id/release
// @access  Private (verifier, admin)
export const releaseSubmissionClaim = async (req, res, next) => {
  try {
    let submission = await Submission.findById(req.params.id);

    if (!submission) {
      return next(new AppError('Submission not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
    }

    const claimedBy = submission.queue?.claimedBy?.toString?.();
    if (!claimedBy) {
      return next(new AppError('Submission is not currently claimed', 400, ErrorCodes.INVALID_INPUT));
    }

    if (claimedBy !== req.user.id && req.user.role !== 'admin') {
      return next(new AppError('Only the claimer or an admin can release this submission', 403, ErrorCodes.UNAUTHORIZED_ACCESS));
    }

    submission.queue.claimedBy = null;
    submission.queue.claimedAt = null;

    appendSubmissionHistory(
      submission,
      createHistoryEntry({
        action: 'released',
        actor: req.user.id,
        actorName: req.user.username,
        note: 'Submission claim released back to the queue.',
      }),
    );

    await submission.save();
    submission = await populateSubmission(Submission.findById(submission._id));

    res.status(200).json({
      success: true,
      submission: serializeSubmission(submission),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add comment to a submission discussion
// @route   POST /api/submissions/:id/discussion
// @access  Private
export const addSubmissionDiscussion = async (req, res, next) => {
  try {
    let submission = await populateSubmission(Submission.findById(req.params.id));

    if (!submission) {
      return next(new AppError('Submission not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
    }

    const canDiscuss =
      submission.submitter?._id?.toString() === req.user.id ||
      ['verifier', 'admin'].includes(req.user.role);

    if (!canDiscuss) {
      return next(new AppError('Not authorized to discuss this submission', 403, ErrorCodes.UNAUTHORIZED_ACCESS));
    }

    const entry = createDiscussionEntry({
      type: 'comment',
      author: req.user.id,
      authorName: req.user.username,
      message: req.body.message,
    });

    appendSubmissionDiscussion(submission, entry);
    appendSubmissionHistory(
      submission,
      createHistoryEntry({
        action: 'comment_added',
        actor: req.user.id,
        actorName: req.user.username,
        note: 'Discussion comment added.',
      }),
    );

    await submission.save();
    submission = await populateSubmission(Submission.findById(submission._id));

    await notifyDiscussionEvent({
      submission,
      actor: req.user,
      type: 'comment',
      message: `${req.user.username} commented on "${submission.title}".`,
    });

    res.status(201).json({
      success: true,
      submission: serializeSubmission(submission),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Open appeal on a reviewed submission
// @route   POST /api/submissions/:id/appeal
// @access  Private
export const appealSubmission = async (req, res, next) => {
  try {
    let submission = await populateSubmission(Submission.findById(req.params.id));

    if (!submission) {
      return next(new AppError('Submission not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
    }

    if (submission.submitter?._id?.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new AppError('Only the submitter or an admin can open an appeal', 403, ErrorCodes.UNAUTHORIZED_ACCESS));
    }

    if (submission.status === 'pending') {
      return next(new AppError('Pending submissions cannot be appealed', 400, ErrorCodes.INVALID_INPUT));
    }

    const entry = createDiscussionEntry({
      type: 'appeal',
      author: req.user.id,
      authorName: req.user.username,
      message: req.body.message,
      status: 'open',
    });

    appendSubmissionDiscussion(submission, entry);
    appendSubmissionHistory(
      submission,
      createHistoryEntry({
        action: 'appeal_opened',
        actor: req.user.id,
        actorName: req.user.username,
        note: 'Appeal opened for reviewed submission.',
        metadata: { currentStatus: submission.status },
      }),
    );

    await submission.save();
    submission = await populateSubmission(Submission.findById(submission._id));

    await notifyDiscussionEvent({
      submission,
      actor: req.user,
      type: 'appeal',
      message: `${req.user.username} opened an appeal on "${submission.title}".`,
    });

    res.status(201).json({
      success: true,
      submission: serializeSubmission(submission),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resolve a discussion entry
// @route   PUT /api/submissions/:id/discussion/:discussionId/resolve
// @access  Private (verifier, admin)
export const resolveSubmissionDiscussion = async (req, res, next) => {
  try {
    let submission = await Submission.findById(req.params.id);

    if (!submission) {
      return next(new AppError('Submission not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
    }

    const discussionEntry = submission.discussion.id(req.params.discussionId);
    if (!discussionEntry) {
      return next(new AppError('Discussion entry not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
    }

    discussionEntry.status = req.body.status || 'resolved';
    discussionEntry.resolvedAt = new Date();
    discussionEntry.resolvedBy = req.user.id;

    appendSubmissionHistory(
      submission,
      createHistoryEntry({
        action: 'appeal_resolved',
        actor: req.user.id,
        actorName: req.user.username,
        note: `${discussionEntry.type === 'appeal' ? 'Appeal' : 'Discussion'} marked as ${discussionEntry.status}.`,
      }),
    );

    await submission.save();
    submission = await populateSubmission(Submission.findById(submission._id));

    res.status(200).json({
      success: true,
      submission: serializeSubmission(submission),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify submission (verifier/admin only)
// @route   PUT /api/submissions/:id/verify
// @access  Private (verifier, admin)
export const verifySubmission = async (req, res, next) => {
  try {
    const { status, credibility, verifierNotes } = req.body;

    let submission = await populateSubmission(Submission.findById(req.params.id));

    if (!submission) {
      return next(new AppError('Submission not found', 404, ErrorCodes.RESOURCE_NOT_FOUND));
    }

    if (submission.status !== 'pending') {
      return next(new AppError('Submission has already been verified', 400, ErrorCodes.SUBMISSION_LOCKED));
    }

    if (req.user.role !== 'admin' && submission.country !== req.user.country) {
      return next(new AppError('You can only review submissions from your assigned country', 403, ErrorCodes.UNAUTHORIZED_ACCESS));
    }

    ensureQueueAccess(submission, req.user);

    const previousStatus = submission.status;

    if (status === 'rejected') {
      submission.status = 'rejected';
      submission.credibility = undefined;
    } else if (status === 'approved' && credibility) {
      submission.status = 'approved';
      submission.credibility = credibility;
    } else if (status === 'approved' && !credibility) {
      return next(new AppError('Credibility rating is required for approved submissions', 400, ErrorCodes.INVALID_INPUT));
    } else {
      return next(new AppError('Invalid status provided', 400, ErrorCodes.INVALID_INPUT));
    }

    submission.verifier = req.user.id;
    submission.verifierNotes = verifierNotes;
    submission.verifiedAt = new Date();
    submission.queue.claimedBy = null;
    submission.queue.claimedAt = null;

    appendSubmissionHistory(
      submission,
      createHistoryEntry({
        action: 'verified',
        actor: req.user.id,
        actorName: req.user.username,
        note: verifierNotes || `Submission marked as ${submission.status}.`,
        fromStatus: previousStatus,
        toStatus: submission.status,
        metadata: { credibility },
      }),
    );

    await submission.save();

    if (status === 'approved') {
      const points = credibility === 'credible' ? 25 : 10;
      await User.findByIdAndUpdate(submission.submitter._id, {
        $inc: { points },
      });
    }

    await User.findByIdAndUpdate(req.user.id, {
      $inc: { points: 5 },
    });

    submission = await populateSubmission(Submission.findById(submission._id));
    await notifySubmissionReviewOutcome(submission, submission.submitter, req.user, status, credibility);

    res.status(200).json({
      success: true,
      submission: serializeSubmission(submission),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get submissions pending verification for user's country
// @route   GET /api/submissions/pending/country
// @access  Private (verifier, admin)
export const getPendingSubmissionsForCountry = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, queue = 'all' } = req.query;
    const numericPage = parseInt(page, 10);
    const numericLimit = parseInt(limit, 10);
    const skip = (numericPage - 1) * numericLimit;

    const query = { status: 'pending' };

    if (req.user.role !== 'admin') {
      query.country = req.user.country;
    }

    if (queue === 'claimed') {
      query['queue.claimedBy'] = { $ne: null };
    } else if (queue === 'unclaimed') {
      query['queue.claimedBy'] = null;
    } else if (queue === 'mine') {
      query['queue.claimedBy'] = req.user.id;
    }

    const submissions = await populateSubmission(
      Submission.find(query)
        .sort({ 'queue.claimedAt': 1, createdAt: 1 })
        .skip(skip)
        .limit(numericLimit),
    );

    const total = await Submission.countDocuments(query);

    res.status(200).json({
      success: true,
      count: submissions.length,
      total,
      page: numericPage,
      pages: Math.ceil(total / numericLimit),
      submissions: serializeSubmissions(submissions),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get submission statistics
// @route   GET /api/submissions/stats
// @access  Public
export const getSubmissionStats = async (req, res, next) => {
  try {
    const { country } = req.query;
    const matchStage = country ? { country } : {};

    const stats = await Submission.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          primary: { $sum: { $cond: [{ $eq: ['$category', 'primary'] }, 1, 0] } },
          secondary: { $sum: { $cond: [{ $eq: ['$category', 'secondary'] }, 1, 0] } },
          unreliable: { $sum: { $cond: [{ $eq: ['$category', 'unreliable'] }, 1, 0] } },
          claimed: { $sum: { $cond: [{ $ne: ['$queue.claimedBy', null] }, 1, 0] } },
          withAppeals: {
            $sum: {
              $cond: [
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: '$discussion',
                          as: 'entry',
                          cond: {
                            $and: [
                              { $eq: ['$$entry.type', 'appeal'] },
                              { $eq: ['$$entry.status', 'open'] },
                            ],
                          },
                        },
                      },
                    },
                    0,
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const countryStats = await Submission.aggregate([
      { $match: matchStage },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({
      success: true,
      stats:
        stats[0] || {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          primary: 0,
          secondary: 0,
          unreliable: 0,
          claimed: 0,
          withAppeals: 0,
        },
      topCountries: countryStats,
    });
  } catch (error) {
    next(error);
  }
};
