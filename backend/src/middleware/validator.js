import { body, validationResult } from 'express-validator';
import { ErrorCodes } from '../utils/errorCodes.js';
import { sanitizeString } from '../utils/sanitization.js';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errorCode: ErrorCodes.VALIDATION_ERROR,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      })),
      requestId: req.requestId
    });
  }
  next();
};


export const registerValidation = [
  body('username')
    .trim()
    .customSanitizer(sanitizeString)
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('country')
    .trim()
    .customSanitizer(sanitizeString)
    .notEmpty()
    .withMessage('Country is required')
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters')
];


export const loginValidation = [
  body('username')
    .trim()
    .customSanitizer(sanitizeString)
    .notEmpty()
    .withMessage('Username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];


export const submissionValidation = [
  body('url')
    .trim()
    .notEmpty()
    .withMessage('URL is required')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Please provide a valid http or https URL'),
  body('title')
    .trim()
    .customSanitizer(sanitizeString)
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('publisher')
    .trim()
    .customSanitizer(sanitizeString)
    .notEmpty()
    .withMessage('Publisher is required')
    .isLength({ max: 100 })
    .withMessage('Publisher cannot exceed 100 characters'),
  body('country')
    .trim()
    .customSanitizer(sanitizeString)
    .notEmpty()
    .withMessage('Country is required'),
  body('category')
    .isIn(['primary', 'secondary', 'unreliable'])
    .withMessage('Category must be primary, secondary, or unreliable'),
  body('wikipediaArticle')
    .optional({ checkFalsy: true })
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Please provide a valid Wikipedia article URL'),
  body('fileType')
    .optional()
    .isIn(['url', 'pdf'])
    .withMessage('File type must be url or pdf'),
  body('fileName')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer(sanitizeString)
    .isLength({ max: 255 })
    .withMessage('File name cannot exceed 255 characters')
];


export const verificationValidation = [
  body('status')
    .isIn(['approved', 'rejected'])
    .withMessage('Status must be approved or rejected'),
  body('credibility')
    .optional()
    .isIn(['credible', 'unreliable'])
    .withMessage('Credibility must be credible or unreliable'),
  body('verifierNotes')
    .optional()
    .trim()
    .customSanitizer(sanitizeString)
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

export const submissionUpdateValidation = [
  body('title')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer(sanitizeString)
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('publisher')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer(sanitizeString)
    .isLength({ max: 100 })
    .withMessage('Publisher cannot exceed 100 characters'),
  body('wikipediaArticle')
    .optional({ checkFalsy: true })
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Please provide a valid Wikipedia article URL'),
  body('category')
    .optional()
    .isIn(['primary', 'secondary', 'unreliable'])
    .withMessage('Category must be primary, secondary, or unreliable'),
];

export const updateProfileValidation = [
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('country')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer(sanitizeString)
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters'),
];

export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
];

export const badgeValidation = [
  body('name')
    .trim()
    .customSanitizer(sanitizeString)
    .notEmpty()
    .withMessage('Badge name is required')
    .isLength({ max: 100 })
    .withMessage('Badge name cannot exceed 100 characters'),
  body('icon')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer(sanitizeString)
    .isLength({ max: 20 })
    .withMessage('Badge icon cannot exceed 20 characters'),
];
