import express from 'express';
import {
  getUserProfile,
  getLeaderboard,
  awardBadge,
  updateUserRole,
  getUsers,
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deactivateUser,
  activateUser
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';
import { badgeValidation, validate } from '../middleware/validator.js';

const router = express.Router();

router.get('/leaderboard', getLeaderboard);
router.get('/notifications', protect, getMyNotifications);
router.put('/notifications/read-all', protect, markAllNotificationsRead);
router.put('/notifications/:notificationId/read', protect, markNotificationRead);
router.get('/', protect, authorize('admin'), getUsers);
router.get('/:id', getUserProfile);

router.post('/:id/badge', protect, authorize('admin'), badgeValidation, validate, awardBadge);
router.put('/:id/role', protect, authorize('admin'), updateUserRole);
router.put('/:id/deactivate', protect, authorize('admin'), deactivateUser);
router.put('/:id/activate', protect, authorize('admin'), activateUser);

export default router;
