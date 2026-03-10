import mongoose from 'mongoose';
import { sanitizeString } from '../utils/sanitization.js';

const articleContextSchema = new mongoose.Schema(
  {
    articleTitle: {
      type: String,
      trim: true,
      set: sanitizeString,
    },
    articleUrl: {
      type: String,
      trim: true,
      set: sanitizeString,
    },
    sectionTitle: {
      type: String,
      trim: true,
      set: sanitizeString,
    },
    referenceLabel: {
      type: String,
      trim: true,
      set: sanitizeString,
    },
    citationText: {
      type: String,
      trim: true,
      set: sanitizeString,
    },
    archiveUrl: {
      type: String,
      trim: true,
      set: sanitizeString,
    },
    accessDate: {
      type: String,
      trim: true,
      set: sanitizeString,
    },
    source: {
      type: String,
      trim: true,
      set: sanitizeString,
      default: 'manual',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const historyEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'created',
        'updated',
        'claimed',
        'released',
        'verified',
        'appeal_opened',
        'comment_added',
        'appeal_resolved',
        'admin_override',
        'imported',
        'duplicate_detected',
      ],
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorName: {
      type: String,
      trim: true,
      set: sanitizeString,
    },
    note: {
      type: String,
      trim: true,
      set: sanitizeString,
    },
    fromStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', null],
      default: null,
    },
    toStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', null],
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const discussionEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['comment', 'appeal', 'system'],
      default: 'comment',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    authorName: {
      type: String,
      trim: true,
      set: sanitizeString,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Discussion messages cannot exceed 1000 characters'],
      set: sanitizeString,
    },
    status: {
      type: String,
      enum: ['open', 'resolved', 'dismissed'],
      default: 'open',
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false },
);

const submissionSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, 'URL is required'],
    trim: true,
    set: sanitizeString
  },
  normalizedUrl: {
    type: String,
    trim: true,
    set: sanitizeString,
    index: true,
  },
  sourceFingerprint: {
    type: String,
    trim: true,
    set: sanitizeString,
    index: true,
  },
  sourceHostname: {
    type: String,
    trim: true,
    set: sanitizeString,
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    set: sanitizeString,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  publisher: {
    type: String,
    required: [true, 'Publisher is required'],
    trim: true,
    set: sanitizeString,
    maxlength: [100, 'Publisher cannot exceed 100 characters']
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    set: sanitizeString
  },
  category: {
    type: String,
    enum: ['primary', 'secondary', 'unreliable'],
    required: [true, 'Category is required']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  submittedDate: {
    type: Date,
    default: Date.now()
  },
  credibility: {
    type: String,
    enum: ['credible', 'unreliable'],
    required: function() {
      return this.status === 'approved';
    }
  },
  submitter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verifier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  wikipediaArticle: {
    type: String,
    trim: true,
    set: sanitizeString
  },
  articleContexts: {
    type: [articleContextSchema],
    default: [],
  },
  verifierNotes: {
    type: String,
    trim: true,
    set: sanitizeString,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  verifiedAt: {
    type: Date
  },
  fileType: {
    type: String,
    enum: ['url', 'pdf'],
    default: 'url'
  },
  fileName: {
    type: String,
    set: sanitizeString
  },
  tags: [{
    type: String,
    trim: true,
    set: sanitizeString
  }],
  queue: {
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ['normal', 'high'],
      default: 'normal',
    },
  },
  reviewHistory: {
    type: [historyEntrySchema],
    default: [],
  },
  discussion: {
    type: [discussionEntrySchema],
    default: [],
  },
}, {
  timestamps: true
});

// Indexes for better query performance
submissionSchema.index({ country: 1, status: 1 });
submissionSchema.index({ submitter: 1 });
submissionSchema.index({ category: 1 });
submissionSchema.index({ createdAt: -1 });
submissionSchema.index({ status: 1, 'queue.claimedBy': 1, country: 1, createdAt: 1 });

// Virtual for submitter details
submissionSchema.virtual('submitterDetails', {
  ref: 'User',
  localField: 'submitter',
  foreignField: '_id',
  justOne: true
});

// Virtual for verifier details
submissionSchema.virtual('verifierDetails', {
  ref: 'User',
  localField: 'verifier',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included in JSON
submissionSchema.set('toJSON', { virtuals: true });
submissionSchema.set('toObject', { virtuals: true });

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;
