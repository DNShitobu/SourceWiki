import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { sanitizeString } from '../utils/sanitization.js';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    set: sanitizeString,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: function requiredEmail() {
      return this.authProvider === 'local';
    },
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    set: sanitizeString,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: function requiredPassword() {
      return this.authProvider === 'local';
    },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    default: 'GLOBAL',
    set: sanitizeString
  },
  authProvider: {
    type: String,
    enum: ['local', 'wikipedia'],
    default: 'local'
  },
  wikipediaUserId: {
    type: String,
    unique: true,
    sparse: true,
    set: sanitizeString
  },
  wikipediaUsername: {
    type: String,
    set: sanitizeString
  },
  role: {
    type: String,
    enum: ['contributor', 'verifier', 'admin'],
    default: 'contributor'
  },
  points: {
    type: Number,
    default: 0
  },
  badges: [{
    name: {
      type: String,
      set: sanitizeString,
    },
    icon: {
      type: String,
      set: sanitizeString,
    },
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 604800 // 7 days in seconds
    }
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false;
  }

  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    email: this.email || '',
    country: this.country,
    role: this.role,
    points: this.points,
    badges: this.badges,
    joinDate: this.createdAt,
    isActive: this.isActive,
    authProvider: this.authProvider,
    wikipediaUsername: this.wikipediaUsername || ''
  };
};

const User = mongoose.model('User', userSchema);

export default User;
