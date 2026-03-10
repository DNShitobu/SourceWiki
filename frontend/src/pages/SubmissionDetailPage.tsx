import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  FileClock,
  Flag,
  History,
  Loader2,
  MessageSquare,
  Scale,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { submissionApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { getCategoryColor, getCountryFlag, getCountryName, getReliabilityColor } from '../lib/mock-data';
import { getSafeExternalUrl, openExternalUrl } from '../lib/safe-url';

interface SubmissionRecord {
  id: string;
  url: string;
  title: string;
  publisher: string;
  country: string;
  category: string;
  status: string;
  reliability?: string | null;
  wikipediaArticle?: string;
  verifierNotes?: string;
  submittedDate?: string | null;
  verifiedDate?: string | null;
  submitter?: { id?: string; _id?: string; username?: string; email?: string };
  verifier?: { id?: string; _id?: string; username?: string };
  queue?: {
    claimedBy?: { id?: string; _id?: string; username?: string } | null;
    claimedByName?: string;
    claimedAt?: string | null;
  };
  articleContexts?: Array<{
    articleTitle?: string;
    articleUrl?: string;
    sectionTitle?: string;
    referenceLabel?: string;
    citationText?: string;
    archiveUrl?: string;
    accessDate?: string;
    source?: string;
    addedAt?: string;
  }>;
  reviewHistory?: Array<{
    action: string;
    actorName?: string;
    note?: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    createdAt?: string;
  }>;
  discussion?: Array<{
    _id?: string;
    type: 'comment' | 'appeal' | 'system';
    authorName?: string;
    message: string;
    status?: string;
    createdAt?: string;
    resolvedAt?: string | null;
  }>;
}

const getUserId = (value?: { id?: string; _id?: string } | null) => value?.id || value?._id || '';

export const SubmissionDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { submissionId } = useParams<{ submissionId: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submission, setSubmission] = useState<SubmissionRecord | null>(null);
  const [comment, setComment] = useState('');
  const [appeal, setAppeal] = useState('');

  const loadSubmission = async () => {
    if (!submissionId) {
      return;
    }

    setLoading(true);
    try {
      const response = await submissionApi.getById(submissionId);
      setSubmission(response.submission);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const handleClaim = async () => {
    if (!submission?.id) {
      return;
    }

    setSaving(true);
    try {
      await submissionApi.claim(submission.id);
      toast.success('Submission claimed for review');
      await loadSubmission();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to claim submission');
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async () => {
    if (!submission?.id) {
      return;
    }

    setSaving(true);
    try {
      await submissionApi.release(submission.id);
      toast.success('Submission returned to the queue');
      await loadSubmission();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to release submission');
    } finally {
      setSaving(false);
    }
  };

  const handleComment = async () => {
    if (!submission?.id || !comment.trim()) {
      return;
    }

    setSaving(true);
    try {
      await submissionApi.addDiscussion(submission.id, comment.trim());
      setComment('');
      toast.success('Comment added');
      await loadSubmission();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add comment');
    } finally {
      setSaving(false);
    }
  };

  const handleAppeal = async () => {
    if (!submission?.id || !appeal.trim()) {
      return;
    }

    setSaving(true);
    try {
      await submissionApi.appeal(submission.id, appeal.trim());
      setAppeal('');
      toast.success('Appeal opened');
      await loadSubmission();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open appeal');
    } finally {
      setSaving(false);
    }
  };

  const handleResolveDiscussion = async (discussionId?: string) => {
    if (!submission?.id || !discussionId) {
      return;
    }

    setSaving(true);
    try {
      await submissionApi.resolveDiscussion(submission.id, discussionId);
      toast.success('Discussion marked as resolved');
      await loadSubmission();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resolve discussion');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Submission not found</CardTitle>
            <CardDescription>The requested source record could not be loaded.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/directory')}>Back to Directory</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentUserId = user?.id || '';
  const submitterId = getUserId(submission.submitter);
  const claimedById = getUserId(submission.queue?.claimedBy as { id?: string; _id?: string } | null);
  const isSubmitter = Boolean(user && currentUserId === submitterId);
  const isReviewer = Boolean(user && (user.role === 'verifier' || user.role === 'admin'));
  const canClaim = Boolean(
    user &&
      submission.status === 'pending' &&
      isReviewer &&
      (!claimedById || claimedById === currentUserId),
  );
  const canRelease = Boolean(
    user &&
      submission.status === 'pending' &&
      claimedById &&
      (claimedById === currentUserId || user.role === 'admin'),
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to="/directory" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to Directory
          </Link>
          <h1 className="mt-3 mb-2">{submission.title}</h1>
          <p className="text-gray-600">{submission.publisher}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openExternalUrl(submission.url)} disabled={!getSafeExternalUrl(submission.url)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Source
          </Button>
          {isReviewer && (
            <Button variant="secondary" onClick={() => navigate('/admin')}>
              Review Queue
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Source Summary</CardTitle>
              <CardDescription>Canonical source data, queue status, and review state.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={getCategoryColor(submission.category)}>
                  {submission.category}
                </Badge>
                <Badge variant="outline">
                  {getCountryFlag(submission.country)} {getCountryName(submission.country)}
                </Badge>
                {submission.reliability && (
                  <Badge variant="outline" className={getReliabilityColor(submission.reliability)}>
                    {submission.reliability}
                  </Badge>
                )}
                <Badge variant="outline" className="capitalize">
                  {submission.status}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded border p-3">
                  <p className="text-sm text-gray-500">Submitted</p>
                  <p className="font-medium">
                    {submission.submittedDate ? new Date(submission.submittedDate).toLocaleString() : 'Unknown'}
                  </p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-sm text-gray-500">Reviewed</p>
                  <p className="font-medium">
                    {submission.verifiedDate ? new Date(submission.verifiedDate).toLocaleString() : 'Not reviewed yet'}
                  </p>
                </div>
              </div>

              <div className="rounded border p-3">
                <p className="text-sm text-gray-500">Queue owner</p>
                <p className="font-medium">
                  {submission.queue?.claimedByName || 'Unclaimed'}
                </p>
                {submission.queue?.claimedAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    Claimed {new Date(submission.queue.claimedAt).toLocaleString()}
                  </p>
                )}
              </div>

              {submission.verifierNotes && (
                <div className="rounded border bg-gray-50 p-3">
                  <p className="text-sm text-gray-500">Verifier notes</p>
                  <p className="mt-1 text-sm">{submission.verifierNotes}</p>
                </div>
              )}

              {(canClaim || canRelease) && (
                <div className="flex flex-wrap gap-2">
                  {canClaim && !claimedById && (
                    <Button onClick={handleClaim} disabled={saving}>
                      <Flag className="mr-2 h-4 w-4" />
                      Claim for Review
                    </Button>
                  )}
                  {canRelease && (
                    <Button variant="outline" onClick={handleRelease} disabled={saving}>
                      Release Claim
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileClock className="h-5 w-5 text-blue-600" />
                Article Context
              </CardTitle>
              <CardDescription>
                Where this source appears on Wikipedia and what citation text was captured.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {submission.articleContexts && submission.articleContexts.length > 0 ? (
                submission.articleContexts.map((context, index) => (
                  <div key={`${context.articleUrl || context.articleTitle || 'ctx'}-${index}`} className="rounded border p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {context.articleTitle && <p className="font-medium">{context.articleTitle}</p>}
                      {context.sectionTitle && <Badge variant="outline">{context.sectionTitle}</Badge>}
                      {context.referenceLabel && <Badge variant="outline">{context.referenceLabel}</Badge>}
                    </div>
                    {context.articleUrl && (
                      <a
                        href={getSafeExternalUrl(context.articleUrl) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        Open article
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {context.citationText && <p className="text-sm text-gray-700">{context.citationText}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      {context.archiveUrl && <span>Archive saved</span>}
                      {context.accessDate && <span>Accessed {context.accessDate}</span>}
                      {context.source && <span>Source: {context.source}</span>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No article context has been recorded yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-emerald-600" />
                Discussion and Appeals
              </CardTitle>
              <CardDescription>Keep verification decisions transparent and contestable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {submission.discussion && submission.discussion.length > 0 ? (
                submission.discussion.map((entry, index) => (
                  <div key={entry._id || `${entry.type}-${index}`} className="rounded border p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.type === 'appeal' ? 'destructive' : 'outline'}>{entry.type}</Badge>
                        {entry.status && <Badge variant="outline">{entry.status}</Badge>}
                      </div>
                      <p className="text-xs text-gray-500">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}
                      </p>
                    </div>
                    <p className="text-sm font-medium">{entry.authorName || 'Unknown user'}</p>
                    <p className="text-sm text-gray-700">{entry.message}</p>
                    {entry.status === 'open' && isReviewer && entry._id && (
                      <Button size="sm" variant="outline" onClick={() => handleResolveDiscussion(entry._id)} disabled={saving}>
                        Resolve
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No discussion yet.</p>
              )}

              {user && (isSubmitter || isReviewer) && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <LabelLine text="Add Comment" />
                    <Textarea
                      placeholder="Explain a concern, share evidence, or ask for clarification."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                    />
                    <Button onClick={handleComment} disabled={saving || !comment.trim()}>
                      Add Comment
                    </Button>
                  </div>

                  {isSubmitter && submission.status !== 'pending' && (
                    <div className="space-y-2">
                      <LabelLine text="Open Appeal" />
                      <Textarea
                        placeholder="Explain why this review should be reconsidered."
                        value={appeal}
                        onChange={(e) => setAppeal(e.target.value)}
                        rows={4}
                      />
                      <Button variant="secondary" onClick={handleAppeal} disabled={saving || !appeal.trim()}>
                        <Scale className="mr-2 h-4 w-4" />
                        Submit Appeal
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-purple-600" />
                Review History
              </CardTitle>
              <CardDescription>Audit trail of lifecycle changes and review actions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {submission.reviewHistory && submission.reviewHistory.length > 0 ? (
                [...submission.reviewHistory]
                  .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
                  .map((entry, index) => (
                    <div key={`${entry.action}-${index}`} className="rounded border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline">{entry.action}</Badge>
                        <span className="text-xs text-gray-500">
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{entry.actorName || 'System'}</p>
                      {entry.note && <p className="mt-1 text-sm text-gray-700">{entry.note}</p>}
                      {(entry.fromStatus || entry.toStatus) && (
                        <p className="mt-1 text-xs text-gray-500">
                          {entry.fromStatus || 'none'} to {entry.toStatus || 'none'}
                        </p>
                      )}
                    </div>
                  ))
              ) : (
                <p className="text-sm text-gray-500">No review history recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const LabelLine = ({ text }: { text: string }) => (
  <p className="text-sm font-medium text-gray-700">{text}</p>
);
