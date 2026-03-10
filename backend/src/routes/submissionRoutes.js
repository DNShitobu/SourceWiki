import express from 'express';
import {
  createSubmission,
  getSubmissions,
  getSubmission,
  getMySubmissions,
  updateSubmission,
  deleteSubmission,
  verifySubmission,
  claimSubmission,
  releaseSubmissionClaim,
  addSubmissionDiscussion,
  appealSubmission,
  resolveSubmissionDiscussion,
  getPendingSubmissionsForCountry,
  getSubmissionStats
} from '../controllers/submissionController.js';
import { protect, authorize } from '../middleware/auth.js';
import {
  submissionValidation,
  submissionUpdateValidation,
  verificationValidation,
  discussionValidation,
  appealValidation,
  discussionResolveValidation,
  validate,
} from '../middleware/validator.js';

const router = express.Router();

router.route('/')
  .get(getSubmissions)
  .post(protect, submissionValidation, validate, createSubmission);

router.get('/stats', getSubmissionStats);
router.get('/my/submissions', protect, getMySubmissions);
router.get('/pending/country', protect, authorize('verifier', 'admin'), getPendingSubmissionsForCountry);
router.post('/:id/claim', protect, authorize('verifier', 'admin'), claimSubmission);
router.post('/:id/release', protect, authorize('verifier', 'admin'), releaseSubmissionClaim);
router.post('/:id/discussion', protect, discussionValidation, validate, addSubmissionDiscussion);
router.post('/:id/appeal', protect, appealValidation, validate, appealSubmission);
router.put(
  '/:id/discussion/:discussionId/resolve',
  protect,
  authorize('verifier', 'admin'),
  discussionResolveValidation,
  validate,
  resolveSubmissionDiscussion,
);

router.route('/:id')
  .get(getSubmission)
  .put(protect, submissionUpdateValidation, validate, updateSubmission)
  .delete(protect, deleteSubmission);

router.put('/:id/verify', protect, authorize('verifier', 'admin'), verificationValidation, validate, verifySubmission);

export default router;
