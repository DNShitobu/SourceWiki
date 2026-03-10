import jwt from 'jsonwebtoken';

export const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );
};

export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

export const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000
});

export const setAuthCookies = (res, accessToken, refreshToken) => {
  const cookieOptions = getAuthCookieOptions();

  return res
    .cookie('token', accessToken, cookieOptions)
    .cookie('refreshToken', refreshToken, cookieOptions);
};

export const clearAuthCookies = (res) => {
  const cookieOptions = {
    ...getAuthCookieOptions(),
    expires: new Date(Date.now() + 10 * 1000),
  };

  return res
    .cookie('token', 'none', cookieOptions)
    .cookie('refreshToken', 'none', cookieOptions);
};

export const createAuthPayload = (user) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  return {
    accessToken,
    refreshToken,
    user: user.getPublicProfile()
  };
};

export const sendTokenResponse = (user, statusCode, res) => {
  const authPayload = createAuthPayload(user);

  setAuthCookies(res, authPayload.accessToken, authPayload.refreshToken)
    .status(statusCode)
    .json({
      success: true,
      ...authPayload
    });
};
