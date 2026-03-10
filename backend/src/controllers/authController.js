import crypto from 'crypto';
import User from '../models/User.js';
import config from '../config/config.js';
import {
  clearAuthCookies,
  createAuthPayload,
  sendTokenResponse,
  setAuthCookies,
  verifyRefreshToken,
  generateAccessToken
} from '../utils/jwt.js';
import AppError from '../utils/AppError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { sanitizeString } from '../utils/sanitization.js';
import {
  exchangeWikipediaCodeForToken,
  getWikipediaAuthorizeUrl,
  getWikipediaProfile,
  isWikipediaOAuthConfigured
} from '../services/wikipediaOAuthService.js';

const WIKIPEDIA_OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 10 * 60 * 1000,
  path: '/api/auth/wikipedia',
};

const MAX_USERNAME_LENGTH = 30;

const sanitizeReturnTo = (value) => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
};

const buildWikipediaCallbackRedirect = ({ returnTo = '/', accessToken, refreshToken, error }) => {
  const callbackUrl = new URL('/auth/wikipedia/callback', config.frontendUrl);
  callbackUrl.searchParams.set('returnTo', sanitizeReturnTo(returnTo));

  if (error) {
    callbackUrl.searchParams.set('error', error);
    return callbackUrl.toString();
  }

  callbackUrl.hash = new URLSearchParams({
    accessToken,
    refreshToken,
  }).toString();

  return callbackUrl.toString();
};

const clearWikipediaOAuthCookies = (res) =>
  res
    .clearCookie('wikipedia_oauth_state', WIKIPEDIA_OAUTH_COOKIE_OPTIONS)
    .clearCookie('wikipedia_oauth_return_to', WIKIPEDIA_OAUTH_COOKIE_OPTIONS);

const buildWikipediaUsernameBase = (profile) => {
  const rawUsername =
    sanitizeString(
      profile.username ||
        profile.preferred_username ||
        profile.name ||
        `Wikimedian-${String(profile.sub || 'user').slice(-8)}`
    ) || 'Wikimedian';

  return rawUsername.slice(0, MAX_USERNAME_LENGTH);
};

const buildUniqueUsername = async (baseUsername, excludeUserId = null) => {
  const base = (sanitizeString(baseUsername) || 'Wikimedian').slice(0, MAX_USERNAME_LENGTH);
  let candidate = base;
  let counter = 1;

  while (
    await User.exists({
      username: candidate,
      ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    })
  ) {
    const suffix = `-wiki${counter}`;
    candidate = `${base.slice(0, MAX_USERNAME_LENGTH - suffix.length)}${suffix}`;
    counter += 1;
  }

  return candidate;
};

const findOrCreateWikipediaUser = async (profile) => {
  const wikipediaUserId = String(profile.sub || '').trim();
  const wikipediaUsername = sanitizeString(
    profile.username || profile.preferred_username || profile.name || ''
  ).slice(0, MAX_USERNAME_LENGTH);

  if (!wikipediaUserId || !wikipediaUsername) {
    throw new Error('Wikipedia profile did not include a usable user identity');
  }

  let user = await User.findOne({ wikipediaUserId });

  if (user) {
    const updates = {};

    if (user.wikipediaUsername !== wikipediaUsername) {
      updates.wikipediaUsername = wikipediaUsername;
    }

    const resolvedUsername = await buildUniqueUsername(wikipediaUsername, user._id);
    if (user.username !== resolvedUsername) {
      updates.username = resolvedUsername;
    }

    if (Object.keys(updates).length > 0) {
      user = await User.findByIdAndUpdate(user._id, updates, { new: true, runValidators: true });
    }

    return user;
  }

  const username = await buildUniqueUsername(buildWikipediaUsernameBase(profile));

  return User.create({
    username,
    country: 'GLOBAL',
    authProvider: 'wikipedia',
    wikipediaUserId,
    wikipediaUsername,
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { username, email, password, country } = req.body;

    const user = await User.create({
      username,
      email,
      password,
      country
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username }).select('+password');

    if (!user) {
      return next(new AppError('Invalid credentials', 401, ErrorCodes.INVALID_CREDENTIALS));
    }

    if (user.authProvider === 'wikipedia') {
      return next(
        new AppError(
          'This account uses Wikipedia login. Continue with Wikipedia instead.',
          401,
          ErrorCodes.INVALID_CREDENTIALS
        )
      );
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return next(new AppError('Invalid credentials', 401, ErrorCodes.INVALID_CREDENTIALS));
    }

    if (!user.isActive) {
      return next(new AppError('Account is deactivated', 401, ErrorCodes.ACCOUNT_INACTIVE));
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Start Wikipedia OAuth login
// @route   GET /api/auth/wikipedia
// @access  Public
export const beginWikipediaLogin = async (req, res, next) => {
  try {
    if (!isWikipediaOAuthConfigured()) {
      return res.redirect(
        buildWikipediaCallbackRedirect({
          returnTo: req.query.returnTo,
          error: 'Wikipedia login is not configured on this server.',
        })
      );
    }

    const state = crypto.randomBytes(32).toString('hex');
    const returnTo = sanitizeReturnTo(req.query.returnTo);

    res.cookie('wikipedia_oauth_state', state, WIKIPEDIA_OAUTH_COOKIE_OPTIONS);
    res.cookie('wikipedia_oauth_return_to', returnTo, WIKIPEDIA_OAUTH_COOKIE_OPTIONS);

    return res.redirect(getWikipediaAuthorizeUrl(state));
  } catch (error) {
    next(error);
  }
};

// @desc    Wikipedia OAuth callback
// @route   GET /api/auth/wikipedia/callback
// @access  Public
export const handleWikipediaCallback = async (req, res, next) => {
  try {
    const returnTo = sanitizeReturnTo(req.cookies.wikipedia_oauth_return_to);
    const expectedState = req.cookies.wikipedia_oauth_state;
    const { code, state, error, error_description: errorDescription } = req.query;

    clearWikipediaOAuthCookies(res);

    if (error) {
      return res.redirect(
        buildWikipediaCallbackRedirect({
          returnTo,
          error: sanitizeString(errorDescription || error),
        })
      );
    }

    if (!code || !state || !expectedState || state !== expectedState) {
      return res.redirect(
        buildWikipediaCallbackRedirect({
          returnTo,
          error: 'Wikipedia login could not be verified. Please try again.',
        })
      );
    }

    const tokenResponse = await exchangeWikipediaCodeForToken(code);
    const wikipediaProfile = await getWikipediaProfile(tokenResponse.access_token);
    const user = await findOrCreateWikipediaUser(wikipediaProfile);

    if (!user.isActive) {
      return res.redirect(
        buildWikipediaCallbackRedirect({
          returnTo,
          error: 'Your account is deactivated.',
        })
      );
    }

    const authPayload = createAuthPayload(user);
    setAuthCookies(res, authPayload.accessToken, authPayload.refreshToken);

    return res.redirect(
      buildWikipediaCallbackRedirect({
        returnTo,
        accessToken: authPayload.accessToken,
        refreshToken: authPayload.refreshToken,
      })
    );
  } catch (error) {
    if (error instanceof Error) {
      return res.redirect(
        buildWikipediaCallbackRedirect({
          returnTo: req.cookies.wikipedia_oauth_return_to,
          error: sanitizeString(error.message || 'Wikipedia login failed'),
        })
      );
    }

    next(error);
  }
};

// @desc    Get Wikipedia OAuth availability
// @route   GET /api/auth/wikipedia/status
// @access  Public
export const getWikipediaLoginStatus = (_req, res) => {
  res.status(200).json({
    success: true,
    configured: isWikipediaOAuthConfigured(),
  });
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res, next) => {
  try {
    clearAuthCookies(res).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      user: user.getPublicProfile()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError('Refresh token is required', 401, ErrorCodes.AUTH_TOKEN_MISSING));
    }

    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return next(new AppError('Invalid refresh token', 401, ErrorCodes.AUTH_TOKEN_INVALID));
    }

    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return next(new AppError('User not found or inactive', 401, ErrorCodes.AUTH_TOKEN_INVALID));
    }

    const accessToken = generateAccessToken(user._id);

    res.status(200).json({
      success: true,
      accessToken,
      user: user.getPublicProfile()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { email, country } = req.body;

    const fieldsToUpdate = {};
    if (email) fieldsToUpdate.email = email;
    if (country) fieldsToUpdate.country = country;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      user: user.getPublicProfile()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    if (user.authProvider !== 'local') {
      return next(
        new AppError(
          'Password changes are only available for local accounts.',
          400,
          ErrorCodes.INVALID_INPUT
        )
      );
    }

    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return next(new AppError('Current password is incorrect', 401, ErrorCodes.INVALID_CREDENTIALS));
    }

    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};
