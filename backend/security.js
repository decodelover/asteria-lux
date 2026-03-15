const { createHash, randomBytes } = require('crypto');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DEFAULT_JWT_SECRET = 'luxury-store-dev-secret';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const EMAIL_VERIFICATION_WINDOW_HOURS = Number(
  process.env.EMAIL_VERIFICATION_WINDOW_HOURS || 24,
);
const PASSWORD_RESET_WINDOW_HOURS = Number(process.env.PASSWORD_RESET_WINDOW_HOURS || 2);
const isUsingDefaultJwtSecret = JWT_SECRET === DEFAULT_JWT_SECRET;

if (process.env.NODE_ENV === 'production' && isUsingDefaultJwtSecret) {
  throw new Error('JWT_SECRET must be set to a secure value in production.');
}

const hashPassword = (password) => bcrypt.hash(password, 12);

const comparePassword = (password, passwordHash) => bcrypt.compare(password, passwordHash);

const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const signAuthToken = (user) =>
  signToken({
    email: user.email,
    name: user.full_name || user.fullName,
    scope: 'user',
    sub: String(user.id),
  });

const signAdminToken = (admin) =>
  signToken({
    email: admin.email,
    name: admin.full_name || admin.fullName,
    role: admin.role || 'owner',
    scope: 'admin',
    sub: String(admin.id),
  });

const verifyAuthToken = (token) => jwt.verify(token, JWT_SECRET);

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

const generateEmailVerificationToken = () => {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_WINDOW_HOURS * 60 * 60 * 1000);

  return {
    expiresAt,
    token,
    tokenHash: hashToken(token),
  };
};

const generatePasswordResetToken = () => {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_WINDOW_HOURS * 60 * 60 * 1000);

  return {
    expiresAt,
    token,
    tokenHash: hashToken(token),
  };
};

module.exports = {
  comparePassword,
  DEFAULT_JWT_SECRET,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  hashPassword,
  hashToken,
  isUsingDefaultJwtSecret,
  signAdminToken,
  signAuthToken,
  verifyAuthToken,
};
