import config from '../config/config.js';

const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

const getOAuthBaseUrl = () => trimTrailingSlash(config.wikipediaOAuthBaseUrl);

const buildOAuthUrl = (path) => `${getOAuthBaseUrl()}${path}`;

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

export const isWikipediaOAuthConfigured = () =>
  Boolean(
    config.wikipediaClientId &&
      config.wikipediaClientSecret &&
      config.wikipediaCallbackUrl &&
      config.frontendUrl
  );

export const getWikipediaAuthorizeUrl = (state) => {
  const authorizeUrl = new URL(buildOAuthUrl('/authorize'));

  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', config.wikipediaClientId);
  authorizeUrl.searchParams.set('redirect_uri', config.wikipediaCallbackUrl);
  authorizeUrl.searchParams.set('state', state);

  if (config.wikipediaOAuthScopes) {
    authorizeUrl.searchParams.set('scope', config.wikipediaOAuthScopes);
  }

  return authorizeUrl.toString();
};

export const exchangeWikipediaCodeForToken = async (code) => {
  const response = await fetch(buildOAuthUrl('/access_token'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.wikipediaClientId,
      client_secret: config.wikipediaClientSecret,
      redirect_uri: config.wikipediaCallbackUrl,
    }).toString(),
  });

  const data = await parseJson(response);

  if (!response.ok || !data?.access_token) {
    const message = data?.error_description || data?.error || 'Failed to exchange Wikipedia OAuth code';
    throw new Error(message);
  }

  return data;
};

export const getWikipediaProfile = async (accessToken) => {
  const response = await fetch(buildOAuthUrl('/resource/profile'), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const data = await parseJson(response);

  if (!response.ok || !data) {
    throw new Error('Failed to fetch Wikipedia profile');
  }

  return data;
};
