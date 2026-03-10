import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 5000;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const backendUrl = process.env.BACKEND_URL || `http://localhost:${port}`;

const config = {
  port,
  // Fallback to local Mongo for development if env var is not set
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wsv',
  // Development defaults; override in production via environment variables
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_change_me',
  jwtExpire: process.env.JWT_EXPIRE || '30d',
  frontendUrl,
  backendUrl,
  wikipediaOAuthBaseUrl: process.env.WIKIPEDIA_OAUTH_BASE_URL || 'https://en.wikipedia.org/w/rest.php/oauth2',
  wikipediaClientId: process.env.WIKIPEDIA_CLIENT_ID || '',
  wikipediaClientSecret: process.env.WIKIPEDIA_CLIENT_SECRET || '',
  wikipediaCallbackUrl:
    process.env.WIKIPEDIA_CALLBACK_URL || `${backendUrl}/api/auth/wikipedia/callback`,
  wikipediaOAuthScopes: process.env.WIKIPEDIA_OAUTH_SCOPES || '',
};

export default config;
