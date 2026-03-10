const formatDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

export const serializeSubmission = (submission) => {
  if (!submission) {
    return null;
  }

  const record = typeof submission.toObject === 'function'
    ? submission.toObject({ virtuals: true })
    : submission;

  const queueClaim = record.queue?.claimedBy;

  return {
    ...record,
    id: record.id || record._id?.toString?.(),
    mediaType: record.fileType || 'url',
    reliability: record.credibility || null,
    submittedDate: formatDate(record.submittedDate || record.createdAt),
    verifiedDate: formatDate(record.verifiedAt),
    createdAt: formatDate(record.createdAt),
    updatedAt: formatDate(record.updatedAt),
    submitterName: record.submitter?.username || record.submitterName || '',
    verifierName: record.verifier?.username || record.verifierName || '',
    queue: {
      ...(record.queue || {}),
      claimedBy: queueClaim || null,
      claimedByName:
        queueClaim && typeof queueClaim === 'object' ? queueClaim.username || '' : '',
      claimedAt: formatDate(record.queue?.claimedAt),
    },
  };
};

export const serializeSubmissions = (submissions = []) =>
  submissions.map((submission) => serializeSubmission(submission));
