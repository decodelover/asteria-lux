require('dotenv').config();

const db = require('./db');

const DEFAULT_PORT = Number(process.env.PORT || 5000);

const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const normalizeText = (value, maxLength = 255, fallback = '') => {
  const normalized = String(value ?? fallback).trim();
  return normalized.slice(0, maxLength);
};

const normalizeOptionalText = (value, maxLength = 255) => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, maxLength) : '';
};

const normalizePort = (value, fallback = 587) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeHeadlines = (value, fallback) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const headlines = value
    .map((item) => normalizeOptionalText(item, 140))
    .filter(Boolean)
    .slice(0, 4);

  return headlines.length > 0 ? headlines : fallback;
};

const createDefaultSettings = () => ({
  brand: {
    storeName: normalizeText(process.env.STORE_NAME, 120, 'Asteria Luxury House'),
    supportEmail: normalizeOptionalText(
      process.env.STORE_SUPPORT_EMAIL || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      255,
    ),
    supportPhone: normalizeOptionalText(process.env.STORE_SUPPORT_PHONE, 40),
    whatsappNumber: normalizeOptionalText(process.env.WHATSAPP_NUMBER, 32),
  },
  storefront: {
    heroHeadlines: [
      'What would you love to collect today?',
      'Discover signature watches, rings, and rare jewelry.',
      'Curated luxury pieces, delivered with a smoother experience.',
    ],
  },
  payments: {
    bankAccountName: normalizeOptionalText(process.env.BANK_ACCOUNT_NAME, 160),
    bankAccountNumber: normalizeOptionalText(process.env.BANK_ACCOUNT_NUMBER, 80),
    bankInstructions: normalizeText(
      process.env.BANK_TRANSFER_INSTRUCTIONS,
      600,
      'Transfer the exact order total, then upload a clear proof of payment for review.',
    ),
    bankName: normalizeOptionalText(process.env.BANK_NAME, 120),
    bankTransferEnabled: parseBoolean(process.env.BANK_TRANSFER_ENABLED, true),
    currency: normalizeText(
      process.env.STORE_CURRENCY || process.env.PAYSTACK_CURRENCY,
      10,
      'NGN',
    ).toUpperCase(),
    locale: normalizeText(process.env.STORE_LOCALE, 20, 'en-NG'),
    paystackPublicKey: normalizeOptionalText(process.env.PAYSTACK_PUBLIC_KEY, 255),
    paystackSecretKey: normalizeOptionalText(process.env.PAYSTACK_SECRET_KEY, 255),
  },
  email: {
    appBaseUrl: normalizeText(
      process.env.APP_BASE_URL || process.env.FRONTEND_URL,
      255,
      `http://localhost:${DEFAULT_PORT}`,
    ),
    smtpFromEmail: normalizeOptionalText(process.env.SMTP_FROM_EMAIL, 255),
    smtpHost: normalizeOptionalText(process.env.SMTP_HOST, 255),
    smtpPass: normalizeOptionalText(process.env.SMTP_PASS, 255),
    smtpPort: normalizePort(process.env.SMTP_PORT, 587),
    smtpSecure: parseBoolean(process.env.SMTP_SECURE, false),
    smtpUser: normalizeOptionalText(process.env.SMTP_USER, 255),
    supportEmail: normalizeOptionalText(
      process.env.STORE_SUPPORT_EMAIL || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      255,
    ),
  },
});

const normalizeGroup = (key, input = {}, defaults = createDefaultSettings()[key]) => {
  switch (key) {
    case 'brand':
      return {
        storeName: normalizeText(input.storeName, 120, defaults.storeName),
        supportEmail: normalizeOptionalText(input.supportEmail, 255) || defaults.supportEmail,
        supportPhone: normalizeOptionalText(input.supportPhone, 40) || defaults.supportPhone,
        whatsappNumber:
          normalizeOptionalText(input.whatsappNumber, 32) || defaults.whatsappNumber,
      };
    case 'storefront':
      return {
        heroHeadlines: normalizeHeadlines(input.heroHeadlines, defaults.heroHeadlines),
      };
    case 'payments':
      return {
        bankAccountName:
          normalizeOptionalText(input.bankAccountName, 160) || defaults.bankAccountName,
        bankAccountNumber:
          normalizeOptionalText(input.bankAccountNumber, 80) || defaults.bankAccountNumber,
        bankInstructions:
          normalizeText(input.bankInstructions, 600, defaults.bankInstructions) ||
          defaults.bankInstructions,
        bankName: normalizeOptionalText(input.bankName, 120) || defaults.bankName,
        bankTransferEnabled: parseBoolean(input.bankTransferEnabled, defaults.bankTransferEnabled),
        currency: normalizeText(input.currency, 10, defaults.currency).toUpperCase(),
        locale: normalizeText(input.locale, 20, defaults.locale),
        paystackPublicKey:
          normalizeOptionalText(input.paystackPublicKey, 255) || defaults.paystackPublicKey,
        paystackSecretKey:
          normalizeOptionalText(input.paystackSecretKey, 255) || defaults.paystackSecretKey,
      };
    case 'email':
      return {
        appBaseUrl: normalizeText(input.appBaseUrl, 255, defaults.appBaseUrl),
        smtpFromEmail:
          normalizeOptionalText(input.smtpFromEmail, 255) || defaults.smtpFromEmail,
        smtpHost: normalizeOptionalText(input.smtpHost, 255) || defaults.smtpHost,
        smtpPass: normalizeOptionalText(input.smtpPass, 255) || defaults.smtpPass,
        smtpPort: normalizePort(input.smtpPort, defaults.smtpPort),
        smtpSecure: parseBoolean(input.smtpSecure, defaults.smtpSecure),
        smtpUser: normalizeOptionalText(input.smtpUser, 255) || defaults.smtpUser,
        supportEmail: normalizeOptionalText(input.supportEmail, 255) || defaults.supportEmail,
      };
    default:
      return defaults;
  }
};

const getRuntimeSettings = async (client = db) => {
  const defaults = createDefaultSettings();
  const result = await client.query(`
    SELECT setting_key, setting_value
    FROM site_settings
    ORDER BY setting_key ASC;
  `);

  const settings = { ...defaults };

  result.rows.forEach((row) => {
    const key = String(row.setting_key || '').trim();

    if (!settings[key]) {
      return;
    }

    settings[key] = normalizeGroup(key, row.setting_value || {}, settings[key]);
  });

  return settings;
};

const saveRuntimeSettings = async (partialSettings = {}, adminId = null, client = db) => {
  const currentSettings = await getRuntimeSettings(client);
  const nextSettings = { ...currentSettings };
  const knownKeys = ['brand', 'storefront', 'payments', 'email'];

  for (const key of knownKeys) {
    if (partialSettings[key] && typeof partialSettings[key] === 'object') {
      nextSettings[key] = normalizeGroup(key, partialSettings[key], currentSettings[key]);
    }
  }

  for (const key of knownKeys) {
    await client.query(
      `
        INSERT INTO site_settings (setting_key, setting_value, updated_by_admin_id, updated_at)
        VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (setting_key)
        DO UPDATE
        SET
          setting_value = EXCLUDED.setting_value,
          updated_by_admin_id = EXCLUDED.updated_by_admin_id,
          updated_at = CURRENT_TIMESTAMP;
      `,
      [key, JSON.stringify(nextSettings[key]), adminId],
    );
  }

  return nextSettings;
};

const isPaystackEnabled = (settings) =>
  Boolean(settings?.payments?.paystackPublicKey && settings?.payments?.paystackSecretKey);

const isBankTransferEnabled = (settings) =>
  Boolean(
    settings?.payments?.bankTransferEnabled &&
      settings?.payments?.bankName &&
      settings?.payments?.bankAccountName &&
      settings?.payments?.bankAccountNumber,
  );

const buildPaymentConfig = (settings) => ({
  bankTransfer: {
    accountName: settings.payments.bankAccountName,
    accountNumber: settings.payments.bankAccountNumber,
    bankName: settings.payments.bankName,
    enabled: isBankTransferEnabled(settings),
    instructions: settings.payments.bankInstructions,
    maxProofSizeMb: 5,
    proofTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  },
  currency: settings.payments.currency,
  locale: settings.payments.locale,
  paystack: {
    enabled: isPaystackEnabled(settings),
    publicKey: settings.payments.paystackPublicKey || null,
  },
});

const getPublicSiteSettings = async (client = db) => {
  const settings = await getRuntimeSettings(client);

  return {
    heroHeadlines: settings.storefront.heroHeadlines,
    storeName: settings.brand.storeName,
    supportEmail: settings.brand.supportEmail || settings.email.supportEmail,
    supportPhone: settings.brand.supportPhone,
    whatsappNumber: settings.brand.whatsappNumber,
  };
};

module.exports = {
  buildPaymentConfig,
  createDefaultSettings,
  getPublicSiteSettings,
  getRuntimeSettings,
  isBankTransferEnabled,
  isPaystackEnabled,
  normalizeGroup,
  saveRuntimeSettings,
};
