import mongoose from 'mongoose';
import { sanitizeString } from '../utils/sanitization.js';

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'submission_received',
        'submission_verified',
        'submission_rejected',
        'submission_claimed',
        'appeal_opened',
        'comment_added',
        'system',
      ],
      default: 'system',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      set: sanitizeString,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      set: sanitizeString,
    },
    link: {
      type: String,
      trim: true,
      maxlength: 255,
      set: sanitizeString,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
