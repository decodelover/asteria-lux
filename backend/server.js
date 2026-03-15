require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const db = require('./db');
const {
  calculateCartSummary,
  ensureSchema,
  mapCartRow,
  mapOrderRow,
  mapProductRow,
  mapUserRow,
  toMoney,
} = require('./schema');
const {
  comparePassword,
  generateEmailVerificationToken,
  hashPassword,
  hashToken,
  isUsingDefaultJwtSecret,
  signAdminToken,
  signAuthToken,
  verifyAuthToken,
} = require('./security');
const {
  buildPaymentConfig,
  getRuntimeSettings,
  isBankTransferEnabled,
  isPaystackEnabled,
  saveRuntimeSettings,
} = require('./runtime-settings');
const {
  getMailMode,
  getPublicSiteUrl,
  sendBankTransferNotificationEmail,
  sendBankTransferSubmissionEmail,
  sendContactAcknowledgementEmail,
  sendContactNotificationEmail,
  sendManualCustomerEmail,
  sendNewsletterConfirmationEmail,
  sendOrderConfirmationEmail,
  sendVerificationEmail,
} = require('./mailer');

const app = express();

const PORT = Number(process.env.PORT || 5000);
const FRONTEND_DIST = path.resolve(__dirname, '../frontend/dist');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const PAYMENT_PROOFS_DIR = path.join(UPLOADS_DIR, 'payment-proofs');
const PRODUCT_IMAGES_DIR = path.join(UPLOADS_DIR, 'product-images');
const hasFrontendBuild = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));
const allowedOrigins = new Set(
  String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const defaultDevOrigins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173']);
const PAYSTACK_API_BASE_URL = 'https://api.paystack.co';
const PAYMENT_PROOF_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const PRODUCT_IMAGE_MAX_SIZE_BYTES = 4 * 1024 * 1024;
const ADMIN_ROLES = new Set(['owner', 'manager', 'support']);
const USER_ACCOUNT_STATUSES = new Set(['active', 'suspended']);
const ORDER_STATUSES = new Set([
  'awaiting_payment_review',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]);
const PAYMENT_STATUSES = new Set(['pending', 'proof_submitted', 'paid', 'rejected', 'failed']);
const ADMIN_ROLE_CAPABILITIES = {
  owner: new Set(['overview', 'products', 'orders', 'users', 'inbox', 'settings', 'team']),
  manager: new Set(['overview', 'products', 'orders', 'users', 'inbox']),
  support: new Set(['overview', 'orders', 'users', 'inbox']),
};
const ACTIVE_TRACKING_STATUSES = new Set([
  'awaiting_payment_review',
  'confirmed',
  'processing',
  'shipped',
]);
const NON_SPENDABLE_ORDER_STATUSES = new Set(['cancelled']);
const NON_SPENDABLE_PAYMENT_STATUSES = new Set(['failed']);

fs.mkdirSync(PAYMENT_PROOFS_DIR, { recursive: true });
fs.mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });

const normalizeSessionId = (value) => {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return `guest-${randomUUID()}`;
  }

  return normalized.slice(0, 120);
};

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeOptionalText = (value, maxLength = 255) => {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
};

const normalizeEnumValue = (value, allowedValues, fallback = '') => {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (allowedValues.has(normalized)) {
    return normalized;
  }

  return fallback;
};

const normalizePhoneNumber = (value) =>
  String(value || '')
    .replace(/[^\d+]/g, '')
    .slice(0, 20);

const validatePhoneNumber = (value) => normalizePhoneNumber(value).replace(/\D/g, '').length >= 7;

const normalizeCoordinate = (value, min, max) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return Number(parsed.toFixed(6));
};

const normalizeAdminRole = (value, fallback = 'support') => {
  const normalized = String(value || fallback).trim().toLowerCase();
  return ADMIN_ROLES.has(normalized) ? normalized : fallback;
};

const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const validatePassword = (value) => String(value || '').trim().length >= 8;

const toMinorUnits = (value) => Math.round(Number(value || 0) * 100);

const sanitizeFilename = (value) =>
  String(value || 'payment-proof')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const parseOptionalDate = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const createPaymentReference = (prefix) =>
  `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID()
    .split('-')[0]
    .toUpperCase()}`;

const buildRequestOrigin = (req) =>
  process.env.BACKEND_PUBLIC_URL ||
  `${req.protocol || 'http'}://${req.get('host') || `localhost:${PORT}`}`;

const buildPublicAssetUrl = (req, assetPath) =>
  new URL(assetPath.replace(/\\/g, '/').replace(/^\/+/, '/'), `${buildRequestOrigin(req)}/`).toString();

const getAdminCapabilities = (role) => [
  ...(ADMIN_ROLE_CAPABILITIES[normalizeAdminRole(role, 'support')] || new Set()),
];

const hasAdminCapability = (admin, capability) =>
  getAdminCapabilities(admin?.role).includes(capability);

const assertAdminCapability = (admin, capability) => {
  if (!hasAdminCapability(admin, capability)) {
    const error = new Error('You do not have permission to perform this admin action.');
    error.status = 403;
    throw error;
  }
};

const parseCustomerPayload = (body = {}) => {
  const customer = typeof body.customer === 'object' && body.customer ? body.customer : body;

  return {
    address: String(customer.address || '').trim(),
    city: String(customer.city || '').trim(),
    country: String(customer.country || '').trim(),
    email: String(customer.email || '').trim().toLowerCase(),
    name: String(customer.name || '').trim(),
    phone: String(customer.phone || '').trim(),
  };
};

const validateCheckoutCustomer = (customer) =>
  Boolean(
    customer.name &&
      validateEmail(customer.email) &&
      customer.address &&
      customer.city &&
      customer.country,
  );

const createOrderNumber = () => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `AST-${stamp}-${randomUUID().split('-')[0].toUpperCase()}`;
};

const parseDeviceContextPayload = (body = {}) => {
  const source = typeof body.deviceContext === 'object' && body.deviceContext ? body.deviceContext : body;

  return {
    city: normalizeOptionalText(source.city, 120),
    country: normalizeOptionalText(source.country, 120),
    latitude: normalizeCoordinate(source.latitude, -90, 90),
    locationLabel: normalizeOptionalText(source.locationLabel || source.label, 180),
    longitude: normalizeCoordinate(source.longitude, -180, 180),
    timezone: normalizeOptionalText(source.timezone, 80),
  };
};

const buildLocationLabel = ({ city, country, state } = {}) =>
  [city, state, country]
    .filter(Boolean)
    .join(', ')
    .replace(/\s+,/g, ',')
    .trim();

const resolveLocationFromCoordinates = async (deviceContext) => {
  if (deviceContext.latitude === null || deviceContext.longitude === null) {
    return deviceContext;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        deviceContext.latitude,
      )}&lon=${encodeURIComponent(deviceContext.longitude)}&zoom=10&addressdetails=1`,
      {
        headers: {
          'accept-language': 'en',
          'user-agent': 'Luxury Store/1.0 (location resolver)',
        },
      },
    );

    if (!response.ok) {
      return deviceContext;
    }

    const payload = await response.json().catch(() => null);
    const address = payload?.address || {};
    const city =
      deviceContext.city ||
      normalizeOptionalText(
        address.city ||
          address.town ||
          address.village ||
          address.hamlet ||
          address.county ||
          address.state_district,
        120,
      );
    const country = deviceContext.country || normalizeOptionalText(address.country, 120);
    const locationLabel =
      deviceContext.locationLabel ||
      normalizeOptionalText(
        buildLocationLabel({
          city,
          country,
          state: normalizeOptionalText(address.state, 120),
        }),
        180,
      );

    return {
      ...deviceContext,
      city,
      country,
      locationLabel,
    };
  } catch (_error) {
    return deviceContext;
  }
};

const getFallbackLocationLabel = (deviceContext) => {
  if (deviceContext.locationLabel) {
    return deviceContext.locationLabel;
  }

  if (deviceContext.city || deviceContext.country) {
    return buildLocationLabel({
      city: deviceContext.city,
      country: deviceContext.country,
    });
  }

  if (deviceContext.timezone?.includes('/')) {
    return deviceContext.timezone.split('/').pop().replace(/_/g, ' ');
  }

  return null;
};

const buildReadinessReport = ({ emailMode, settings }) => {
  const warnings = [];
  const appBaseUrl = String(settings?.email?.appBaseUrl || '').trim();
  const backendPublicUrl = String(process.env.BACKEND_PUBLIC_URL || '').trim();
  const frontendUrl = String(process.env.FRONTEND_URL || '').trim();
  const isLocalhostUrl = (value) => /localhost|127\.0\.0\.1/i.test(String(value || ''));

  if (isUsingDefaultJwtSecret) {
    warnings.push('JWT_SECRET is still using the development fallback and must be changed before production deployment.');
  }

  if (!appBaseUrl || isLocalhostUrl(appBaseUrl)) {
    warnings.push('APP_BASE_URL or runtime email.appBaseUrl still points to a local address, so verification links will not be correct on a live site.');
  }

  if (!hasFrontendBuild && !frontendUrl) {
    warnings.push('FRONTEND_URL is not set and no frontend build is present for backend hosting, so a separate production frontend would fail CORS requests.');
  }

  if (frontendUrl && isLocalhostUrl(frontendUrl)) {
    warnings.push('FRONTEND_URL still points to localhost and should be replaced with the live frontend domain.');
  }

  if (backendPublicUrl && isLocalhostUrl(backendPublicUrl)) {
    warnings.push('BACKEND_PUBLIC_URL still points to localhost and should be replaced with the live API domain.');
  }

  if (!['smtp', 'brevo_api'].includes(emailMode)) {
    warnings.push('A real email provider is not configured, so verification and order emails will not reach real inboxes in production.');
  }

  if (!isPaystackEnabled(settings) && !isBankTransferEnabled(settings)) {
    warnings.push('No live payment method is fully configured. Enable Paystack or complete bank transfer details before launch.');
  }

  if (!settings?.brand?.supportEmail && !settings?.email?.supportEmail) {
    warnings.push('Support email is not configured, so admin notifications and customer contact routing may be incomplete.');
  }

  if (!settings?.brand?.whatsappNumber) {
    warnings.push('WhatsApp contact is not configured for the storefront floating action button.');
  }

  return {
    ready: warnings.length === 0,
    warnings,
  };
};

const finalizeDeviceContext = async (body = {}) => {
  const parsed = await resolveLocationFromCoordinates(parseDeviceContextPayload(body));

  return {
    ...parsed,
    locationLabel: normalizeOptionalText(getFallbackLocationLabel(parsed), 180),
  };
};

const sendApiError = (res, status, message, extra = {}) =>
  res.status(status).json({
    success: false,
    message,
    ...extra,
  });

const handleAsync = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const queueMail = (promiseFactory) => {
  promiseFactory().catch((error) => {
    console.error('Mail delivery failed:', error);
  });
};

const buildMailMessage = ({
  delivery,
  fallbackMessage,
  previewMessage,
  smtpFailureMessage,
  successMessage,
}) => {
  if (delivery?.mode === 'preview' && delivery?.delivered) {
    return previewMessage || fallbackMessage;
  }

  if (delivery?.delivered) {
    return successMessage;
  }

  if (delivery?.mode === 'smtp') {
    return smtpFailureMessage;
  }

  return fallbackMessage;
};

const createLimiter = (message, maxProduction = 30) =>
  rateLimit({
    handler: (_req, res) => {
      sendApiError(res, 429, message);
    },
    legacyHeaders: false,
    max: process.env.NODE_ENV === 'production' ? maxProduction : 250,
    standardHeaders: true,
    windowMs: 15 * 60 * 1000,
  });

const authLimiter = createLimiter(
  'Too many authentication requests. Please wait a few minutes and try again.',
  25,
);
const publicWriteLimiter = createLimiter(
  'Too many requests were sent from this client. Please slow down and try again shortly.',
  40,
);

const paymentProofUpload = multer({
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);

    if (!allowedTypes.has(String(file.mimetype || '').toLowerCase())) {
      const error = new Error('Only JPG, PNG, or PDF proof files are allowed.');
      error.status = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: PAYMENT_PROOF_MAX_SIZE_BYTES,
  },
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, PAYMENT_PROOFS_DIR);
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname || '').toLowerCase() || '.bin';
      const baseName = sanitizeFilename(path.basename(file.originalname || 'proof', extension));
      callback(null, `${Date.now()}-${randomUUID().split('-')[0]}-${baseName}${extension}`);
    },
  }),
});

const productImageUpload = multer({
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

    if (!allowedTypes.has(String(file.mimetype || '').toLowerCase())) {
      const error = new Error('Only JPG, PNG, or WEBP product images are allowed.');
      error.status = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: PRODUCT_IMAGE_MAX_SIZE_BYTES,
  },
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, PRODUCT_IMAGES_DIR);
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      const baseName = sanitizeFilename(path.basename(file.originalname || 'product', extension));
      callback(null, `${Date.now()}-${randomUUID().split('-')[0]}-${baseName}${extension}`);
    },
  }),
});

const buildCheckoutSummary = (items) =>
  calculateCartSummary(
    items.map((item) => ({
      ...item,
      badge: null,
      description: '',
      featured: false,
      price: item.unitPrice,
      stockQuantity: item.stockQuantity || 0,
    })),
  );

const mapCheckoutItem = (row) => ({
  category: row.category || row.product_category,
  imageUrl: row.image_url || row.imageUrl,
  lineTotal: toMoney(row.line_total ?? Number(row.price ?? row.unitPrice) * Number(row.quantity || 0)),
  name: row.name || row.product_name,
  productId: row.product_id ?? row.productId,
  quantity: Number(row.quantity || 0),
  stockQuantity: Number(row.stock_quantity || row.stockQuantity || 0),
  unitPrice: toMoney(row.price ?? row.unit_price ?? row.unitPrice),
});

const getSessionCheckoutSnapshot = async (sessionId, client, { forUpdate = false } = {}) => {
  const result = await client.query(
    `
      SELECT
        ci.product_id,
        ci.quantity,
        p.name,
        p.category,
        p.price,
        p.image_url,
        p.stock_quantity
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.session_id = $1
      ORDER BY ci.created_at ASC
      ${forUpdate ? 'FOR UPDATE OF ci, p' : ''};
    `,
    [sessionId],
  );

  const items = result.rows.map(mapCheckoutItem);
  const unavailableItem = result.rows.find((item) => item.quantity > item.stock_quantity);

  return {
    items,
    unavailableItem,
    summary: buildCheckoutSummary(items),
  };
};

const getOrderItems = async (orderId, client = db) => {
  const itemsResult = await client.query(
    `
      SELECT
        product_id,
        product_name,
        product_category,
        unit_price,
        quantity,
        line_total,
        image_url
      FROM order_items
      WHERE order_id = $1
      ORDER BY id ASC;
    `,
    [orderId],
  );

  return itemsResult.rows.map(mapCheckoutItem);
};

const lockProductInventory = async (items, client) => {
  const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];

  if (productIds.length === 0) {
    return;
  }

  const stockResult = await client.query(
    `
      SELECT id, stock_quantity
      FROM products
      WHERE id = ANY($1::int[])
      FOR UPDATE;
    `,
    [productIds],
  );

  if (stockResult.rowCount !== productIds.length) {
    const error = new Error('One or more products are no longer available.');
    error.status = 409;
    throw error;
  }

  const stockMap = new Map(stockResult.rows.map((row) => [row.id, Number(row.stock_quantity)]));
  const unavailableItem = items.find(
    (item) => Number(item.quantity || 0) > Number(stockMap.get(item.productId) || 0),
  );

  if (unavailableItem) {
    const error = new Error(`Insufficient stock for ${unavailableItem.name}.`);
    error.status = 409;
    error.availableStock = Number(stockMap.get(unavailableItem.productId) || 0);
    throw error;
  }
};

const createOrderRecord = async ({
  client,
  customer,
  items,
  notes,
  payment,
  sessionId,
  summary,
  userId,
}) => {
  const orderResult = await client.query(
    `
      INSERT INTO orders (
        order_number,
        user_id,
        session_id,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        shipping_city,
        shipping_country,
        notes,
        status,
        payment_method,
        payment_provider,
        payment_reference,
        payment_status,
        payment_currency,
        payment_proof_path,
        payment_proof_name,
        paid_at,
        subtotal,
        shipping_fee,
        total,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, CURRENT_TIMESTAMP
      )
      RETURNING *;
    `,
    [
      createOrderNumber(),
      userId || null,
      sessionId,
      customer.name,
      customer.email,
      customer.phone || null,
      customer.address,
      customer.city,
      customer.country,
      notes || null,
      payment.orderStatus,
      payment.method,
      payment.provider || null,
      payment.reference || null,
      payment.status,
      payment.currency || 'NGN',
      payment.proofPath || null,
      payment.proofName || null,
      payment.paidAt || null,
      summary.subtotal,
      summary.shippingFee,
      summary.total,
    ],
  );

  const order = orderResult.rows[0];

  await client.query(
    `
      INSERT INTO order_tracking_events (
        order_id,
        status,
        message,
        occurred_at
      )
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP);
    `,
    [
      order.id,
      payment.orderStatus,
      payment.orderStatus === 'awaiting_payment_review'
        ? 'Payment proof was received and is awaiting admin review.'
        : 'Your order has been received and is moving into fulfillment.',
    ],
  );

  for (const item of items) {
    await client.query(
      `
        INSERT INTO order_items (
          order_id,
          product_id,
          product_name,
          product_category,
          unit_price,
          quantity,
          line_total,
          image_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `,
      [
        order.id,
        item.productId,
        item.name,
        item.category,
        item.unitPrice,
        item.quantity,
        item.lineTotal,
        item.imageUrl,
      ],
    );

    await client.query(
      `
        UPDATE products
        SET stock_quantity = stock_quantity - $1
        WHERE id = $2;
      `,
      [item.quantity, item.productId],
    );
  }

  await client.query('DELETE FROM cart_items WHERE session_id = $1;', [sessionId]);

  return order;
};

const callPaystack = async (secretKey, pathname, { body, method = 'GET' } = {}) => {
  if (!secretKey) {
    const error = new Error('Paystack is not configured on this server.');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${PAYSTACK_API_BASE_URL}${pathname}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    method,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.status === false) {
    const error = new Error(payload?.message || 'Paystack request failed.');
    error.details = payload;
    error.status = 502;
    throw error;
  }

  return payload;
};

const finalizePaystackAttempt = async ({ gatewayResponse, reference }) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const attemptResult = await client.query(
      'SELECT * FROM payment_attempts WHERE reference = $1 FOR UPDATE;',
      [reference],
    );

    if (attemptResult.rowCount === 0) {
      const error = new Error('Payment record not found.');
      error.status = 404;
      throw error;
    }

    const attempt = attemptResult.rows[0];

    if (attempt.order_id) {
      const existingOrderResult = await client.query('SELECT * FROM orders WHERE id = $1;', [
        attempt.order_id,
      ]);
      const existingItems = await getOrderItems(attempt.order_id, client);
      await client.query('COMMIT');

      return {
        alreadyProcessed: true,
        items: existingItems,
        order: mapOrderRow(existingOrderResult.rows[0]),
      };
    }

    const items = Array.isArray(attempt.items_json) ? attempt.items_json.map(mapCheckoutItem) : [];

    if (items.length === 0) {
      const error = new Error('Stored payment items are invalid.');
      error.status = 500;
      throw error;
    }

    if (String(gatewayResponse?.status || '').toLowerCase() !== 'success') {
      const error = new Error('Paystack has not confirmed this payment yet.');
      error.status = 409;
      throw error;
    }

    if (toMinorUnits(attempt.total) !== Number(gatewayResponse.amount || 0)) {
      const error = new Error('Verified payment amount does not match the order total.');
      error.status = 409;
      throw error;
    }

    if (String(gatewayResponse.currency || '').toUpperCase() !== String(attempt.currency).toUpperCase()) {
      const error = new Error('Verified payment currency does not match the order currency.');
      error.status = 409;
      throw error;
    }

    await lockProductInventory(items, client);

    const order = await createOrderRecord({
      client,
      customer: {
        address: attempt.shipping_address,
        city: attempt.shipping_city,
        country: attempt.shipping_country,
        email: attempt.customer_email,
        name: attempt.customer_name,
        phone: attempt.customer_phone,
      },
      items,
      notes: attempt.notes,
      payment: {
        currency: attempt.currency,
        method: 'paystack',
        orderStatus: 'confirmed',
        paidAt: new Date(),
        provider: 'paystack',
        reference,
        status: 'paid',
      },
      sessionId: attempt.session_id,
      summary: {
        shippingFee: toMoney(attempt.shipping_fee),
        subtotal: toMoney(attempt.subtotal),
        total: toMoney(attempt.total),
      },
      userId: attempt.user_id,
    });

    await client.query(
      `
        UPDATE payment_attempts
        SET
          gateway_response = $1,
          order_id = $2,
          paid_at = CURRENT_TIMESTAMP,
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3;
      `,
      [JSON.stringify(gatewayResponse), order.id, attempt.id],
    );

    await client.query('COMMIT');

    return {
      alreadyProcessed: false,
      items,
      order: mapOrderRow(order),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const buildCartSnapshot = async (sessionId, client = db) => {
  const result = await client.query(
    `
      SELECT
        ci.id AS cart_item_id,
        ci.product_id,
        ci.quantity,
        p.name,
        p.description,
        p.category,
        p.price,
        p.image_url,
        p.stock_quantity,
        p.badge,
        p.featured,
        (p.price * ci.quantity) AS line_total
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.session_id = $1
      ORDER BY ci.updated_at DESC, ci.created_at DESC;
    `,
    [sessionId],
  );

  const items = result.rows.map(mapCartRow);

  return {
    sessionId,
    items,
    summary: calculateCartSummary(items),
  };
};

const getBearerToken = (req) => {
  const header = String(req.headers.authorization || '');

  if (!header.startsWith('Bearer ')) {
    return null;
  }

  return header.slice(7).trim();
};

const resolveAuthenticatedUser = async (req, { required = false } = {}) => {
  const token = getBearerToken(req);

  if (!token) {
    if (required) {
      const error = new Error('Authentication required.');
      error.status = 401;
      throw error;
    }

    return null;
  }

  try {
    const decoded = verifyAuthToken(token);

    if (decoded.scope === 'admin') {
      const error = new Error('Authentication required.');
      error.status = 401;
      throw error;
    }

    const result = await db.query('SELECT * FROM users WHERE id = $1;', [decoded.sub]);

    if (result.rowCount === 0) {
      const error = new Error('User not found.');
      error.status = 401;
      throw error;
    }

    if (String(result.rows[0].account_status || 'active').trim().toLowerCase() !== 'active') {
      const error = new Error('This account is currently suspended.');
      error.status = 403;
      throw error;
    }

    return result.rows[0];
  } catch (error) {
    if (required) {
      error.status = error.status || 401;
      throw error;
    }

    return null;
  }
};

const requireAuth = handleAsync(async (req, _res, next) => {
  req.user = await resolveAuthenticatedUser(req, { required: true });
  next();
});

const attachOrderItemsToOrders = async (orders, client = db) => {
  if (orders.length === 0) {
    return orders;
  }

  const orderIds = orders.map((order) => order.id);
  const itemsResult = await client.query(
    `
      SELECT
        order_id,
        product_id,
        product_name,
        product_category,
        unit_price,
        quantity,
        line_total,
        image_url
      FROM order_items
      WHERE order_id = ANY($1::int[])
      ORDER BY order_id DESC, id ASC;
    `,
    [orderIds],
  );
  const itemsByOrderId = new Map();

  itemsResult.rows.forEach((row) => {
    const items = itemsByOrderId.get(row.order_id) || [];
    items.push(mapCheckoutItem(row));
    itemsByOrderId.set(row.order_id, items);
  });

  return orders.map((order) => {
    const items = itemsByOrderId.get(order.id) || [];
    const quantityCount = items.reduce((total, item) => total + Number(item.quantity || 0), 0);

    return {
      ...order,
      itemCount: Number(order.itemCount || items.length),
      items,
      quantityCount: Number(order.quantityCount || quantityCount),
    };
  });
};

const attachTrackingEventsToOrders = async (orders, client = db) => {
  if (orders.length === 0) {
    return orders;
  }

  const orderIds = orders.map((order) => order.id);
  const eventsResult = await client.query(
    `
      SELECT
        id,
        order_id,
        created_by_admin_id,
        status,
        message,
        location,
        occurred_at,
        created_at
      FROM order_tracking_events
      WHERE order_id = ANY($1::int[])
      ORDER BY occurred_at DESC, id DESC;
    `,
    [orderIds],
  );

  const eventsByOrderId = new Map();

  eventsResult.rows.forEach((row) => {
    const events = eventsByOrderId.get(row.order_id) || [];
    events.push({
      createdAt: row.created_at,
      createdByAdminId: row.created_by_admin_id,
      id: row.id,
      location: row.location,
      message: row.message,
      occurredAt: row.occurred_at,
      orderId: row.order_id,
      status: row.status,
    });
    eventsByOrderId.set(row.order_id, events);
  });

  return orders.map((order) => ({
    ...order,
    trackingEvents: eventsByOrderId.get(order.id) || [],
  }));
};

const buildUserDashboard = (orders) => {
  const productsOrdered = orders.reduce(
    (total, order) => total + Number(order.quantityCount || order.itemCount || 0),
    0,
  );
  const totalAmountSpent = toMoney(
    orders.reduce((total, order) => {
      const orderStatus = String(order.status || '').trim().toLowerCase();
      const paymentStatus = String(order.paymentStatus || '').trim().toLowerCase();

      if (
        NON_SPENDABLE_ORDER_STATUSES.has(orderStatus) ||
        NON_SPENDABLE_PAYMENT_STATUSES.has(paymentStatus)
      ) {
        return total;
      }

      return total + Number(order.total || 0);
    }, 0),
  );
  const activeTrackingCount = orders.filter((order) =>
    ACTIVE_TRACKING_STATUSES.has(String(order.status || '').trim().toLowerCase()),
  ).length;
  const deliveredOrders = orders.filter(
    (order) => String(order.status || '').trim().toLowerCase() === 'delivered',
  ).length;
  const pendingReviewCount = orders.filter((order) => {
    const orderStatus = String(order.status || '').trim().toLowerCase();
    const paymentStatus = String(order.paymentStatus || '').trim().toLowerCase();

    return orderStatus === 'awaiting_payment_review' || paymentStatus === 'proof_submitted';
  }).length;

  return {
    activeTrackingCount,
    deliveredOrders,
    ordersCount: orders.length,
    pendingReviewCount,
    productsOrdered,
    totalAmountSpent,
  };
};

const getUserOrders = async (userId, client = db) => {
  const result = await client.query(
    `
      SELECT
        o.*,
        COUNT(oi.id)::int AS item_count,
        COALESCE(SUM(oi.quantity), 0)::int AS quantity_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC;
    `,
    [userId],
  );

  const orders = result.rows.map((row) => ({
    ...mapOrderRow(row),
    itemCount: row.item_count,
    quantityCount: row.quantity_count,
  }));

  return attachTrackingEventsToOrders(await attachOrderItemsToOrders(orders, client), client);
};

const buildAccountSnapshot = async (user, client = db) => {
  const orders = await getUserOrders(user.id, client);

  return {
    dashboard: buildUserDashboard(orders),
    orders,
    user: mapUserRow(user),
  };
};

const mapAdminRow = (row) => ({
  capabilities: getAdminCapabilities(row.role),
  createdAt: row.created_at,
  email: row.email,
  fullName: row.full_name,
  id: row.id,
  isActive: Boolean(row.is_active),
  lastLoginAt: row.last_login_at,
  role: row.role,
  updatedAt: row.updated_at,
});

const resolveAuthenticatedAdmin = async (req, { required = false } = {}) => {
  const token = getBearerToken(req);

  if (!token) {
    if (required) {
      const error = new Error('Admin authentication required.');
      error.status = 401;
      throw error;
    }

    return null;
  }

  try {
    const decoded = verifyAuthToken(token);

    if (decoded.scope !== 'admin') {
      const error = new Error('Admin authentication required.');
      error.status = 401;
      throw error;
    }

    const result = await db.query('SELECT * FROM admins WHERE id = $1;', [decoded.sub]);

    if (result.rowCount === 0 || !result.rows[0].is_active) {
      const error = new Error('Admin account not found.');
      error.status = 401;
      throw error;
    }

    return result.rows[0];
  } catch (error) {
    if (required) {
      error.status = error.status || 401;
      throw error;
    }

    return null;
  }
};

const requireAdmin = handleAsync(async (req, _res, next) => {
  req.admin = await resolveAuthenticatedAdmin(req, { required: true });
  next();
});

const requireAdminCapability = (capability) =>
  handleAsync(async (req, _res, next) => {
    assertAdminCapability(req.admin, capability);
    next();
  });

const getAdminProducts = async (client = db) => {
  const result = await client.query(
    `
      SELECT *
      FROM products
      ORDER BY featured DESC, created_at DESC, name ASC;
    `,
  );

  return result.rows.map(mapProductRow);
};

const getAdminOrders = async (req, client = db) => {
  const result = await client.query(
    `
      SELECT
        o.*,
        COUNT(oi.id)::int AS item_count,
        COALESCE(SUM(oi.quantity), 0)::int AS quantity_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC;
    `,
  );

  const orders = result.rows.map((row) => ({
    ...mapOrderRow(row),
    itemCount: row.item_count,
    paymentProofUrl: row.payment_proof_path
      ? buildPublicAssetUrl(req, row.payment_proof_path)
      : null,
    quantityCount: row.quantity_count,
  }));

  return attachTrackingEventsToOrders(await attachOrderItemsToOrders(orders, client), client);
};

const getAdminUsers = async (client = db) => {
  const result = await client.query(
    `
      SELECT
        u.*,
        COUNT(o.id)::int AS orders_count,
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(COALESCE(o.status, '')) = 'cancelled'
                OR LOWER(COALESCE(o.payment_status, '')) = 'failed'
              THEN 0
              ELSE o.total
            END
          ),
          0
        ) AS total_spent
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC;
    `,
  );

  return result.rows.map((row) => ({
    ...mapUserRow(row),
    ordersCount: Number(row.orders_count || 0),
    totalSpent: toMoney(row.total_spent),
  }));
};

const getAdminTeam = async (client = db) => {
  const result = await client.query(
    `
      SELECT *
      FROM admins
      ORDER BY
        CASE WHEN LOWER(role) = 'owner' THEN 0 ELSE 1 END,
        created_at ASC;
    `,
  );

  return result.rows.map(mapAdminRow);
};

const countActiveOwners = async (client = db) => {
  const result = await client.query(
    `
      SELECT COUNT(*)::int AS active_owner_count
      FROM admins
      WHERE is_active = true AND LOWER(role) = 'owner';
    `,
  );

  return Number(result.rows[0]?.active_owner_count || 0);
};

const getAdminNewsletterSubscribers = async (client = db) => {
  const result = await client.query(
    `
      SELECT *
      FROM newsletter_subscribers
      ORDER BY updated_at DESC, created_at DESC;
    `,
  );

  return result.rows.map((row) => ({
    createdAt: row.created_at,
    email: row.email,
    fullName: row.full_name,
    id: row.id,
    source: row.source,
    status: row.status,
    updatedAt: row.updated_at,
  }));
};

const getAdminContactMessages = async (client = db) => {
  const result = await client.query(
    `
      SELECT *
      FROM contact_messages
      ORDER BY created_at DESC;
    `,
  );

  return result.rows.map((row) => ({
    createdAt: row.created_at,
    email: row.email,
    fullName: row.full_name,
    id: row.id,
    message: row.message,
    subject: row.subject,
  }));
};

const buildAdminDashboardSnapshot = async (req, client = db) => {
  const countsResult = await client.query(
    `
      SELECT
        (SELECT COUNT(*)::int FROM products) AS products_count,
        (SELECT COUNT(*)::int FROM users) AS users_count,
        (SELECT COUNT(*)::int FROM admins) AS admins_count,
        (SELECT COUNT(*)::int FROM orders) AS orders_count,
        (SELECT COUNT(*)::int FROM contact_messages) AS contacts_count,
        (SELECT COUNT(*)::int FROM newsletter_subscribers) AS newsletter_count,
        (
          SELECT COUNT(*)::int
          FROM orders
          WHERE LOWER(COALESCE(payment_status, '')) IN ('pending', 'proof_submitted')
             OR LOWER(COALESCE(status, '')) = 'awaiting_payment_review'
        ) AS pending_reviews_count,
        (
          SELECT COALESCE(
            SUM(
              CASE
                WHEN LOWER(COALESCE(status, '')) = 'cancelled'
                  OR LOWER(COALESCE(payment_status, '')) = 'failed'
                THEN 0
                ELSE total
              END
            ),
            0
          )
          FROM orders
        ) AS revenue_total;
    `,
  );

  const counts = countsResult.rows[0];
  const recentOrders = (await getAdminOrders(req, client)).slice(0, 5);
  const recentUsers = (await getAdminUsers(client)).slice(0, 5);

  return {
    contactsCount: Number(counts.contacts_count || 0),
    adminsCount: Number(counts.admins_count || 0),
    newsletterCount: Number(counts.newsletter_count || 0),
    ordersCount: Number(counts.orders_count || 0),
    pendingReviewsCount: Number(counts.pending_reviews_count || 0),
    productsCount: Number(counts.products_count || 0),
    recentOrders,
    recentUsers,
    revenueTotal: toMoney(counts.revenue_total),
    usersCount: Number(counts.users_count || 0),
  };
};

const buildAdminBootstrap = async (req, admin, client = db) => {
  const [admins, contacts, dashboard, newsletterSubscribers, orders, products, settings, users] =
    await Promise.all([
      hasAdminCapability(admin, 'team') ? getAdminTeam(client) : Promise.resolve([]),
      hasAdminCapability(admin, 'inbox') ? getAdminContactMessages(client) : Promise.resolve([]),
      buildAdminDashboardSnapshot(req, client),
      hasAdminCapability(admin, 'inbox')
        ? getAdminNewsletterSubscribers(client)
        : Promise.resolve([]),
      hasAdminCapability(admin, 'orders') ? getAdminOrders(req, client) : Promise.resolve([]),
      hasAdminCapability(admin, 'products') ? getAdminProducts(client) : Promise.resolve([]),
      hasAdminCapability(admin, 'settings') ? getRuntimeSettings(client) : Promise.resolve(null),
      hasAdminCapability(admin, 'users') ? getAdminUsers(client) : Promise.resolve([]),
    ]);

  return {
    admin: mapAdminRow(admin),
    admins,
    contacts,
    dashboard,
    newsletterSubscribers,
    orders,
    products,
    settings,
    users,
  };
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin) || defaultDevOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.size === 0 && process.env.NODE_ENV !== 'production') {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  }),
);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(compression());
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buffer) => {
      if (buffer?.length) {
        req.rawBody = buffer.toString('utf8');
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

const api = express.Router();

api.get(
  '/health',
  handleAsync(async (_req, res) => {
    await db.testConnection();
    const settings = await getRuntimeSettings();
    const emailMode = await getMailMode();
    const readiness = buildReadinessReport({ emailMode, settings });

    res.status(200).json({
      emailConfigured: ['smtp', 'brevo_api'].includes(emailMode),
      emailMode,
      paymentConfig: buildPaymentConfig(settings),
      readiness,
      success: true,
      message: 'Luxury Store API is healthy.',
      timestamp: new Date().toISOString(),
    });
  }),
);

api.get(
  '/settings/public',
  handleAsync(async (_req, res) => {
    const settings = await getRuntimeSettings();

    res.status(200).json({
      settings: {
        heroHeadlines: settings.storefront.heroHeadlines,
        storeName: settings.brand.storeName,
        supportEmail: settings.brand.supportEmail || settings.email.supportEmail,
        supportPhone: settings.brand.supportPhone,
        whatsappNumber: settings.brand.whatsappNumber,
      },
      success: true,
    });
  }),
);

api.post(
  '/location/resolve',
  publicWriteLimiter,
  handleAsync(async (req, res) => {
    const deviceContext = await finalizeDeviceContext(req.body);

    if (deviceContext.latitude === null || deviceContext.longitude === null) {
      return sendApiError(res, 400, 'Valid latitude and longitude are required.');
    }

    res.status(200).json({
      success: true,
      deviceContext,
    });
  }),
);

api.get(
  '/products',
  handleAsync(async (req, res) => {
    const params = [];
    const where = [];
    const category = String(req.query.category || '').trim();
    const search = String(req.query.search || '').trim();
    const featured = String(req.query.featured || '').toLowerCase() === 'true';
    const sort = String(req.query.sort || 'featured').trim();

    if (category && category.toLowerCase() !== 'all') {
      params.push(category);
      where.push(`category = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`);
    }

    if (featured) {
      where.push('featured = true');
    }

    const orderByMap = {
      featured: 'featured DESC, created_at DESC, name ASC',
      newest: 'created_at DESC, name ASC',
      'price-asc': 'price ASC, name ASC',
      'price-desc': 'price DESC, name ASC',
      name: 'name ASC',
    };

    const result = await db.query(
      `
        SELECT
          id,
          name,
          description,
          price,
          category,
          image_url,
          stock_quantity,
          badge,
          featured,
          created_at
        FROM products
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ${orderByMap[sort] || orderByMap.featured};
      `,
      params,
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      products: result.rows.map(mapProductRow),
    });
  }),
);

api.get(
  '/categories',
  handleAsync(async (_req, res) => {
    const result = await db.query(
      `
        SELECT category, COUNT(*)::int AS count
        FROM products
        GROUP BY category
        ORDER BY category ASC;
      `,
    );

    res.status(200).json({
      success: true,
      categories: result.rows.map((row) => ({
        count: row.count,
        name: row.category,
      })),
    });
  }),
);

api.post(
  '/newsletter/subscribe',
  publicWriteLimiter,
  handleAsync(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const fullName = String(req.body.fullName || '').trim();

    if (!validateEmail(email)) {
      return sendApiError(res, 400, 'A valid email address is required.');
    }

    await db.query(
      `
        INSERT INTO newsletter_subscribers (email, full_name, source, status, updated_at)
        VALUES ($1, $2, 'website', 'active', CURRENT_TIMESTAMP)
        ON CONFLICT (email)
        DO UPDATE SET
          full_name = COALESCE(EXCLUDED.full_name, newsletter_subscribers.full_name),
          status = 'active',
          updated_at = CURRENT_TIMESTAMP;
      `,
      [email, fullName || null],
    );

    const delivery = await sendNewsletterConfirmationEmail({ email, fullName });

    res.status(201).json({
      mailDelivered: delivery.delivered,
      mailError: delivery.error || undefined,
      mailMode: delivery.mode,
      mailPreviewUrl: delivery.previewUrl || undefined,
      success: true,
      message: buildMailMessage({
        delivery,
        fallbackMessage:
          'You are subscribed, but this environment is not configured to send real inbox emails yet.',
        previewMessage:
          'You are subscribed. Open the preview link below to review the confirmation email locally.',
        smtpFailureMessage:
          'You are subscribed, but the confirmation email could not be delivered right now.',
        successMessage: 'You are now subscribed to store updates.',
      }),
    });
  }),
);

api.post(
  '/contact',
  publicWriteLimiter,
  handleAsync(async (req, res) => {
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();

    if (!fullName || !validateEmail(email) || !subject || !message) {
      return sendApiError(res, 400, 'Full name, email, subject, and message are required.');
    }

    await db.query(
      `
        INSERT INTO contact_messages (full_name, email, subject, message)
        VALUES ($1, $2, $3, $4);
      `,
      [fullName, email, subject, message],
    );

    const acknowledgement = await sendContactAcknowledgementEmail({
      email,
      fullName,
      subject,
    });
    queueMail(() => sendContactNotificationEmail({ email, fullName, message, subject }));

    res.status(201).json({
      mailDelivered: acknowledgement.delivered,
      mailError: acknowledgement.error || undefined,
      mailMode: acknowledgement.mode,
      mailPreviewUrl: acknowledgement.previewUrl || undefined,
      success: true,
      message: buildMailMessage({
        delivery: acknowledgement,
        fallbackMessage:
          'Your message has been received. Email acknowledgement is not configured for real inbox delivery in this environment yet.',
        previewMessage:
          'Your message has been received. Open the preview link below to review the acknowledgement email locally.',
        smtpFailureMessage:
          'Your message has been received, but the acknowledgement email could not be delivered right now.',
        successMessage: 'Your message has been received. We will get back to you shortly.',
      }),
    });
  }),
);

api.post(
  '/auth/signup',
  authLimiter,
  handleAsync(async (req, res) => {
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
    const newsletterOptIn = Boolean(req.body.newsletterOptIn);
    const deviceContext = await finalizeDeviceContext(req.body);

    if (
      !fullName ||
      !validateEmail(email) ||
      !validatePassword(password) ||
      !validatePhoneNumber(phoneNumber)
    ) {
      return sendApiError(
        res,
        400,
        'Full name, phone number, a valid email, and a password of at least 8 characters are required.',
      );
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const existingResult = await client.query('SELECT * FROM users WHERE email = $1 FOR UPDATE;', [
        email,
      ]);

      if (existingResult.rowCount > 0) {
        await client.query('ROLLBACK');
        return sendApiError(res, 409, 'That email address is already registered.');
      }

      const passwordHash = await hashPassword(password);
      const verification = generateEmailVerificationToken();

      const userResult = await client.query(
        `
          INSERT INTO users (
            full_name,
            email,
            password_hash,
            newsletter_opt_in,
            phone_number,
            default_country,
            default_city,
            last_known_location,
            last_known_timezone,
            last_known_latitude,
            last_known_longitude,
            verification_token_hash,
            verification_token_expires_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *;
        `,
        [
          fullName,
          email,
          passwordHash,
          newsletterOptIn,
          phoneNumber,
          deviceContext.country,
          deviceContext.city,
          deviceContext.locationLabel,
          deviceContext.timezone,
          deviceContext.latitude,
          deviceContext.longitude,
          verification.tokenHash,
          verification.expiresAt,
        ],
      );

      if (newsletterOptIn) {
        await client.query(
          `
            INSERT INTO newsletter_subscribers (email, full_name, source, status, updated_at)
            VALUES ($1, $2, 'signup', 'active', CURRENT_TIMESTAMP)
            ON CONFLICT (email)
            DO UPDATE SET
              full_name = COALESCE(EXCLUDED.full_name, newsletter_subscribers.full_name),
              status = 'active',
              updated_at = CURRENT_TIMESTAMP;
          `,
          [email, fullName],
        );
      }

      await client.query('COMMIT');

      const user = userResult.rows[0];
      const token = signAuthToken(user);
      const verificationMail = await sendVerificationEmail({
        email,
        fullName,
        token: verification.token,
      });

      res.status(201).json({
        mailDelivered: verificationMail.delivery.delivered,
        mailError: verificationMail.delivery.error || undefined,
        mailMode: verificationMail.delivery.mode,
        success: true,
        message: buildMailMessage({
          delivery: verificationMail.delivery,
          fallbackMessage:
            'Account created. Real inbox delivery is not configured for this environment yet, so use the verification link shown below.',
          previewMessage:
            'Account created. Open the verification link below because this environment is using local preview email.',
          smtpFailureMessage:
            'Account created, but the verification email could not be delivered right now.',
          successMessage: 'Account created. Check your inbox to verify your email address.',
        }),
        token,
        user: mapUserRow(user),
        verificationPreviewUrl:
          verificationMail.delivery.previewUrl || verificationMail.verificationUrl,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

api.post(
  '/auth/login',
  authLimiter,
  handleAsync(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const deviceContext = await finalizeDeviceContext(req.body);

    if (!validateEmail(email) || !password) {
      return sendApiError(res, 400, 'Email and password are required.');
    }

    const userResult = await db.query('SELECT * FROM users WHERE email = $1;', [email]);

    if (userResult.rowCount === 0) {
      return sendApiError(res, 401, 'Invalid email or password.');
    }

    const user = userResult.rows[0];
    const passwordMatches = await comparePassword(password, user.password_hash);

    if (!passwordMatches) {
      return sendApiError(res, 401, 'Invalid email or password.');
    }

    if (normalizeEnumValue(user.account_status, USER_ACCOUNT_STATUSES, 'active') !== 'active') {
      return sendApiError(res, 403, 'This account is currently suspended.');
    }

    const updatedUserResult = await db.query(
      `
        UPDATE users
        SET
          last_login_at = CURRENT_TIMESTAMP,
          phone_number = COALESCE(phone_number, $2),
          default_country = COALESCE(default_country, $3),
          default_city = COALESCE(default_city, $4),
          last_known_location = COALESCE($5, last_known_location),
          last_known_timezone = COALESCE($6, last_known_timezone),
          last_known_latitude = COALESCE($7, last_known_latitude),
          last_known_longitude = COALESCE($8, last_known_longitude),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `,
      [
        user.id,
        validatePhoneNumber(req.body.phoneNumber) ? normalizePhoneNumber(req.body.phoneNumber) : null,
        deviceContext.country,
        deviceContext.city,
        deviceContext.locationLabel,
        deviceContext.timezone,
        deviceContext.latitude,
        deviceContext.longitude,
      ],
    );

    const updatedUser = updatedUserResult.rows[0];

    res.status(200).json({
      success: true,
      message: updatedUser.email_verified_at
        ? 'Signed in successfully.'
        : 'Signed in successfully. Please verify your email to complete account setup.',
      token: signAuthToken(updatedUser),
      user: mapUserRow(updatedUser),
    });
  }),
);

api.get(
  '/auth/me',
  requireAuth,
  handleAsync(async (req, res) => {
    res.status(200).json({
      success: true,
      ...(await buildAccountSnapshot(req.user)),
    });
  }),
);

api.patch(
  '/auth/settings',
  authLimiter,
  requireAuth,
  handleAsync(async (req, res) => {
    const hasOwn = (field) => Object.prototype.hasOwnProperty.call(req.body, field);
    const fullName = String(
      hasOwn('fullName') ? req.body.fullName : req.user.full_name || '',
    ).trim();
    const newsletterOptIn = hasOwn('newsletterOptIn')
      ? Boolean(req.body.newsletterOptIn)
      : Boolean(req.user.newsletter_opt_in);
    const phoneNumber = normalizeOptionalText(
      hasOwn('phoneNumber') ? req.body.phoneNumber : req.user.phone_number,
      40,
    );
    const defaultCountry = normalizeOptionalText(
      hasOwn('defaultCountry') ? req.body.defaultCountry : req.user.default_country,
      120,
    );
    const defaultCity = normalizeOptionalText(
      hasOwn('defaultCity') ? req.body.defaultCity : req.user.default_city,
      120,
    );
    const defaultAddress = normalizeOptionalText(
      hasOwn('defaultAddress') ? req.body.defaultAddress : req.user.default_address,
      800,
    );

    if (!fullName) {
      return sendApiError(res, 400, 'Full name is required.');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const updatedUserResult = await client.query(
        `
          UPDATE users
          SET
            full_name = $1,
            newsletter_opt_in = $2,
            phone_number = $3,
            default_country = $4,
            default_city = $5,
            default_address = $6,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $7
          RETURNING *;
        `,
        [
          fullName,
          newsletterOptIn,
          phoneNumber,
          defaultCountry,
          defaultCity,
          defaultAddress,
          req.user.id,
        ],
      );
      const updatedUser = updatedUserResult.rows[0];

      if (newsletterOptIn) {
        await client.query(
          `
            INSERT INTO newsletter_subscribers (email, full_name, source, status, updated_at)
            VALUES ($1, $2, 'account_settings', 'active', CURRENT_TIMESTAMP)
            ON CONFLICT (email)
            DO UPDATE SET
              full_name = EXCLUDED.full_name,
              status = 'active',
              updated_at = CURRENT_TIMESTAMP;
          `,
          [updatedUser.email, updatedUser.full_name],
        );
      } else {
        await client.query(
          `
            UPDATE newsletter_subscribers
            SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
            WHERE email = $1;
          `,
          [updatedUser.email],
        );
      }

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: 'Account settings updated successfully.',
        ...(await buildAccountSnapshot(updatedUser)),
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

api.post(
  '/auth/resend-verification',
  authLimiter,
  handleAsync(async (req, res) => {
    const authenticatedUser = await resolveAuthenticatedUser(req);
    const requestedEmail = String(req.body.email || '').trim().toLowerCase();
    const email = authenticatedUser?.email || requestedEmail;

    if (!validateEmail(email)) {
      return sendApiError(res, 400, 'A valid email address is required.');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const userResult = await client.query('SELECT * FROM users WHERE email = $1 FOR UPDATE;', [
        email,
      ]);

      if (userResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return sendApiError(res, 404, 'No user exists with that email address.');
      }

      const user = userResult.rows[0];

      if (user.email_verified_at) {
        await client.query('ROLLBACK');
        return res.status(200).json({
          success: true,
          message: 'This account is already verified.',
        });
      }

      const verification = generateEmailVerificationToken();

      const updatedUserResult = await client.query(
        `
          UPDATE users
          SET
            verification_token_hash = $1,
            verification_token_expires_at = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING *;
        `,
        [verification.tokenHash, verification.expiresAt, user.id],
      );

      await client.query('COMMIT');

      const verificationMail = await sendVerificationEmail({
        email: updatedUserResult.rows[0].email,
        fullName: updatedUserResult.rows[0].full_name,
        token: verification.token,
      });

      res.status(200).json({
        mailDelivered: verificationMail.delivery.delivered,
        mailError: verificationMail.delivery.error || undefined,
        mailMode: verificationMail.delivery.mode,
        success: true,
        message: buildMailMessage({
          delivery: verificationMail.delivery,
          fallbackMessage:
            'A fresh verification link is ready below because real inbox delivery is not configured for this environment yet.',
          previewMessage:
            'A fresh verification link is ready below because this environment is using local preview email.',
          smtpFailureMessage:
            'A new verification email was prepared, but it could not be delivered right now.',
          successMessage: 'A fresh verification email has been sent.',
        }),
        verificationPreviewUrl:
          verificationMail.delivery.previewUrl || verificationMail.verificationUrl,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

api.get(
  '/auth/verify-email',
  authLimiter,
  handleAsync(async (req, res) => {
    const token = String(req.query.token || '').trim();

    if (!token) {
      return sendApiError(res, 400, 'Verification token is required.');
    }

    const tokenHash = hashToken(token);
    const userResult = await db.query(
      `
        SELECT *
        FROM users
        WHERE verification_token_hash = $1
          AND verification_token_expires_at > CURRENT_TIMESTAMP;
      `,
      [tokenHash],
    );

    if (userResult.rowCount === 0) {
      return sendApiError(res, 400, 'That verification link is invalid or has expired.');
    }

    const updatedUserResult = await db.query(
      `
        UPDATE users
        SET
          email_verified_at = CURRENT_TIMESTAMP,
          verification_token_hash = NULL,
          verification_token_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `,
      [userResult.rows[0].id],
    );

    res.status(200).json({
      success: true,
      message: 'Your email address has been verified.',
      user: mapUserRow(updatedUserResult.rows[0]),
    });
  }),
);

api.post(
  '/admin/auth/login',
  authLimiter,
  handleAsync(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();

    if (!validateEmail(email) || !password) {
      return sendApiError(res, 400, 'Admin email and password are required.');
    }

    const adminResult = await db.query('SELECT * FROM admins WHERE email = $1;', [email]);

    if (adminResult.rowCount === 0) {
      return sendApiError(res, 401, 'Invalid admin credentials.');
    }

    const admin = adminResult.rows[0];
    const passwordMatches = await comparePassword(password, admin.password_hash);

    if (!passwordMatches || !admin.is_active) {
      return sendApiError(res, 401, 'Invalid admin credentials.');
    }

    await db.query(
      `
        UPDATE admins
        SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `,
      [admin.id],
    );

    res.status(200).json({
      admin: mapAdminRow({
        ...admin,
        last_login_at: new Date().toISOString(),
      }),
      message: 'Admin signed in successfully.',
      success: true,
      token: signAdminToken(admin),
    });
  }),
);

api.get(
  '/admin/auth/me',
  requireAdmin,
  handleAsync(async (req, res) => {
    res.status(200).json({
      admin: mapAdminRow(req.admin),
      success: true,
    });
  }),
);

api.post(
  '/admin/auth/change-password',
  authLimiter,
  requireAdmin,
  handleAsync(async (req, res) => {
    const currentPassword = String(req.body.currentPassword || '').trim();
    const newPassword = String(req.body.newPassword || '').trim();

    if (!currentPassword || !validatePassword(newPassword)) {
      return sendApiError(
        res,
        400,
        'Current password and a new password of at least 8 characters are required.',
      );
    }

    const matches = await comparePassword(currentPassword, req.admin.password_hash);

    if (!matches) {
      return sendApiError(res, 401, 'Current password is incorrect.');
    }

    const passwordHash = await hashPassword(newPassword);
    await db.query(
      `
        UPDATE admins
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2;
      `,
      [passwordHash, req.admin.id],
    );

    res.status(200).json({
      message: 'Admin password updated successfully.',
      success: true,
    });
  }),
);

api.get(
  '/admin/bootstrap',
  requireAdmin,
  handleAsync(async (req, res) => {
    res.status(200).json({
      success: true,
      ...(await buildAdminBootstrap(req, req.admin)),
    });
  }),
);

api.post(
  '/admin/uploads/product-image',
  authLimiter,
  requireAdmin,
  requireAdminCapability('products'),
  productImageUpload.single('image'),
  handleAsync(async (req, res) => {
    if (!req.file) {
      return sendApiError(res, 400, 'A product image file is required.');
    }

    const assetPath = `/uploads/product-images/${req.file.filename}`;

    res.status(201).json({
      imageUrl: buildPublicAssetUrl(req, assetPath),
      message: 'Product image uploaded successfully.',
      path: assetPath,
      success: true,
    });
  }),
);

api.post(
  '/admin/admins',
  authLimiter,
  requireAdmin,
  requireAdminCapability('team'),
  handleAsync(async (req, res) => {
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    const role = normalizeAdminRole(req.body.role, 'support');
    const isActive = req.body.isActive === undefined ? true : Boolean(req.body.isActive);

    if (!fullName || !validateEmail(email) || !validatePassword(password)) {
      return sendApiError(
        res,
        400,
        'Full name, email, and a password of at least 8 characters are required.',
      );
    }

    const existingAdminResult = await db.query('SELECT id FROM admins WHERE email = $1 LIMIT 1;', [
      email,
    ]);

    if (existingAdminResult.rowCount > 0) {
      return sendApiError(res, 409, 'An admin account already exists with that email address.');
    }

    const passwordHash = await hashPassword(password);
    const result = await db.query(
      `
        INSERT INTO admins (full_name, email, password_hash, role, is_active, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING *;
      `,
      [fullName, email, passwordHash, role, isActive],
    );

    res.status(201).json({
      admin: mapAdminRow(result.rows[0]),
      message: 'Admin account created successfully.',
      success: true,
    });
  }),
);

api.patch(
  '/admin/admins/:adminId',
  authLimiter,
  requireAdmin,
  requireAdminCapability('team'),
  handleAsync(async (req, res) => {
    const adminId = parsePositiveInt(req.params.adminId);

    if (!adminId) {
      return sendApiError(res, 400, 'A valid admin id is required.');
    }

    const adminResult = await db.query('SELECT * FROM admins WHERE id = $1;', [adminId]);

    if (adminResult.rowCount === 0) {
      return sendApiError(res, 404, 'Admin account not found.');
    }

    const current = adminResult.rows[0];
    const fullName = String(req.body.fullName ?? current.full_name).trim();
    const email = String(req.body.email ?? current.email).trim().toLowerCase();
    const role = normalizeAdminRole(req.body.role ?? current.role, current.role);
    const isActive = req.body.isActive === undefined ? Boolean(current.is_active) : Boolean(req.body.isActive);
    const newPassword = String(req.body.newPassword || '').trim();

    if (!fullName || !validateEmail(email)) {
      return sendApiError(res, 400, 'A valid full name and email address are required.');
    }

    if (newPassword && !validatePassword(newPassword)) {
      return sendApiError(res, 400, 'New admin passwords must contain at least 8 characters.');
    }

    if (adminId === req.admin.id && (!isActive || role !== 'owner')) {
      return sendApiError(res, 400, 'You cannot deactivate yourself or remove your owner role.');
    }

    if (String(current.role || '').toLowerCase() === 'owner' && (!isActive || role !== 'owner')) {
      const activeOwnerCount = await countActiveOwners();

      if (activeOwnerCount <= 1) {
        return sendApiError(res, 400, 'At least one active owner admin account must remain.');
      }
    }

    const duplicateEmailResult = await db.query(
      'SELECT id FROM admins WHERE email = $1 AND id <> $2 LIMIT 1;',
      [email, adminId],
    );

    if (duplicateEmailResult.rowCount > 0) {
      return sendApiError(res, 409, 'Another admin account already uses that email address.');
    }

    const passwordHash = newPassword ? await hashPassword(newPassword) : current.password_hash;
    const updatedResult = await db.query(
      `
        UPDATE admins
        SET
          full_name = $1,
          email = $2,
          password_hash = $3,
          role = $4,
          is_active = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *;
      `,
      [fullName, email, passwordHash, role, isActive, adminId],
    );

    res.status(200).json({
      admin: mapAdminRow(updatedResult.rows[0]),
      message: 'Admin account updated successfully.',
      success: true,
    });
  }),
);

api.get(
  '/admin/settings',
  requireAdmin,
  requireAdminCapability('settings'),
  handleAsync(async (_req, res) => {
    res.status(200).json({
      settings: await getRuntimeSettings(),
      success: true,
    });
  }),
);

api.put(
  '/admin/settings',
  authLimiter,
  requireAdmin,
  requireAdminCapability('settings'),
  handleAsync(async (req, res) => {
    const settings = await saveRuntimeSettings(req.body || {}, req.admin.id);

    res.status(200).json({
      message: 'Admin settings updated successfully.',
      settings,
      success: true,
    });
  }),
);

api.post(
  '/admin/products',
  authLimiter,
  requireAdmin,
  requireAdminCapability('products'),
  handleAsync(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const category = String(req.body.category || '').trim();
    const imageUrl = String(req.body.imageUrl || '').trim();
    const badge = normalizeOptionalText(req.body.badge, 80);
    const featured = Boolean(req.body.featured);
    const price = Number(req.body.price);
    const stockQuantity = Number.parseInt(req.body.stockQuantity, 10);

    if (!name || !description || !category || !imageUrl || !Number.isFinite(price) || price < 0) {
      return sendApiError(
        res,
        400,
        'Name, description, category, image URL, and a valid price are required.',
      );
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return sendApiError(res, 400, 'A valid stock quantity is required.');
    }

    const result = await db.query(
      `
        INSERT INTO products (
          name,
          description,
          price,
          category,
          image_url,
          stock_quantity,
          badge,
          featured
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `,
      [name, description, price, category, imageUrl, stockQuantity, badge, featured],
    );

    res.status(201).json({
      message: 'Product created successfully.',
      product: mapProductRow(result.rows[0]),
      success: true,
    });
  }),
);

api.patch(
  '/admin/products/:productId',
  authLimiter,
  requireAdmin,
  requireAdminCapability('products'),
  handleAsync(async (req, res) => {
    const productId = parsePositiveInt(req.params.productId);

    if (!productId) {
      return sendApiError(res, 400, 'A valid product id is required.');
    }

    const existingResult = await db.query('SELECT * FROM products WHERE id = $1;', [productId]);

    if (existingResult.rowCount === 0) {
      return sendApiError(res, 404, 'Product not found.');
    }

    const current = existingResult.rows[0];
    const name = String(req.body.name ?? current.name).trim();
    const description = String(req.body.description ?? current.description).trim();
    const category = String(req.body.category ?? current.category).trim();
    const imageUrl = String(req.body.imageUrl ?? current.image_url).trim();
    const badge = normalizeOptionalText(
      req.body.badge ?? current.badge,
      80,
    );
    const featured = req.body.featured === undefined ? current.featured : Boolean(req.body.featured);
    const price = req.body.price === undefined ? Number(current.price) : Number(req.body.price);
    const stockQuantity =
      req.body.stockQuantity === undefined
        ? Number(current.stock_quantity)
        : Number.parseInt(req.body.stockQuantity, 10);

    if (!name || !description || !category || !imageUrl || !Number.isFinite(price) || price < 0) {
      return sendApiError(
        res,
        400,
        'Name, description, category, image URL, and a valid price are required.',
      );
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return sendApiError(res, 400, 'A valid stock quantity is required.');
    }

    const result = await db.query(
      `
        UPDATE products
        SET
          name = $1,
          description = $2,
          price = $3,
          category = $4,
          image_url = $5,
          stock_quantity = $6,
          badge = $7,
          featured = $8
        WHERE id = $9
        RETURNING *;
      `,
      [name, description, price, category, imageUrl, stockQuantity, badge, featured, productId],
    );

    res.status(200).json({
      message: 'Product updated successfully.',
      product: mapProductRow(result.rows[0]),
      success: true,
    });
  }),
);

api.delete(
  '/admin/products/:productId',
  authLimiter,
  requireAdmin,
  requireAdminCapability('products'),
  handleAsync(async (req, res) => {
    const productId = parsePositiveInt(req.params.productId);

    if (!productId) {
      return sendApiError(res, 400, 'A valid product id is required.');
    }

    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING id;', [productId]);

    if (result.rowCount === 0) {
      return sendApiError(res, 404, 'Product not found.');
    }

    res.status(200).json({
      message: 'Product removed successfully.',
      success: true,
    });
  }),
);

api.patch(
  '/admin/orders/:orderNumber',
  authLimiter,
  requireAdmin,
  requireAdminCapability('orders'),
  handleAsync(async (req, res) => {
    const orderNumber = String(req.params.orderNumber || '').trim();
    const orderResult = await db.query('SELECT * FROM orders WHERE order_number = $1;', [orderNumber]);

    if (!orderNumber || orderResult.rowCount === 0) {
      return sendApiError(res, 404, 'Order not found.');
    }

    const current = orderResult.rows[0];
    const currentStatus = normalizeEnumValue(current.status, ORDER_STATUSES, 'confirmed');
    const currentPaymentStatus = normalizeEnumValue(
      current.payment_status,
      PAYMENT_STATUSES,
      'pending',
    );
    const status = normalizeEnumValue(
      req.body.status === undefined ? currentStatus : req.body.status,
      ORDER_STATUSES,
    );
    const paymentStatus = normalizeEnumValue(
      req.body.paymentStatus === undefined ? currentPaymentStatus : req.body.paymentStatus,
      PAYMENT_STATUSES,
    );
    const adminNote = normalizeOptionalText(req.body.adminNote ?? current.admin_note, 1200) || null;
    const paymentReviewNote =
      normalizeOptionalText(req.body.paymentReviewNote ?? current.payment_review_note, 1200) ||
      null;
    const trackingCarrier =
      normalizeOptionalText(req.body.trackingCarrier ?? current.tracking_carrier, 120) || null;
    const trackingNumber =
      normalizeOptionalText(req.body.trackingNumber ?? current.tracking_number, 120) || null;
    const trackingUrl =
      normalizeOptionalText(req.body.trackingUrl ?? current.tracking_url, 1200) || null;
    const estimatedDeliveryAt =
      req.body.estimatedDeliveryAt === undefined
        ? current.estimated_delivery_at
        : parseOptionalDate(req.body.estimatedDeliveryAt);
    const paidAt =
      paymentStatus === 'paid' && !current.paid_at
        ? new Date().toISOString()
        : paymentStatus === 'paid'
          ? current.paid_at
          : null;
    const shippedAt =
      status === 'shipped' || status === 'delivered'
        ? current.shipped_at || new Date().toISOString()
        : current.shipped_at;
    const explicitTrackingEventMessage = normalizeOptionalText(req.body.trackingEventMessage, 600);
    const trackingEventLocation = normalizeOptionalText(req.body.trackingEventLocation, 180) || null;
    const trackingEventStatus = normalizeEnumValue(
      req.body.trackingEventStatus === undefined ? status : req.body.trackingEventStatus,
      ORDER_STATUSES,
    );
    let trackingEventMessage = explicitTrackingEventMessage;

    if (!status) {
      return sendApiError(
        res,
        400,
        `Order status must be one of: ${Array.from(ORDER_STATUSES).join(', ')}.`,
      );
    }

    if (!paymentStatus) {
      return sendApiError(
        res,
        400,
        `Payment status must be one of: ${Array.from(PAYMENT_STATUSES).join(', ')}.`,
      );
    }

    if (!trackingEventStatus) {
      return sendApiError(
        res,
        400,
        `Tracking event status must be one of: ${Array.from(ORDER_STATUSES).join(', ')}.`,
      );
    }

    if (!trackingEventMessage) {
      if (status !== current.status) {
        trackingEventMessage = `Order status updated to ${String(status).replace(/_/g, ' ')}.`;
      } else if (
        trackingNumber !== current.tracking_number ||
        trackingCarrier !== current.tracking_carrier ||
        trackingUrl !== current.tracking_url
      ) {
        trackingEventMessage = 'Tracking details updated.';
      }
    }

    const client = await db.getClient();
    let order;

    try {
      await client.query('BEGIN');

      const updatedResult = await client.query(
        `
          UPDATE orders
          SET
            status = $1,
            payment_status = $2,
            admin_note = $3,
            payment_review_note = $4,
            payment_reviewed_at = CURRENT_TIMESTAMP,
            payment_reviewed_by_admin_id = $5,
            tracking_carrier = $6,
            tracking_number = $7,
            tracking_url = $8,
            estimated_delivery_at = $9,
            shipped_at = $10,
            paid_at = $11,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $12
          RETURNING *;
        `,
        [
          status,
          paymentStatus,
          adminNote,
          paymentReviewNote,
          req.admin.id,
          trackingCarrier,
          trackingNumber,
          trackingUrl,
          estimatedDeliveryAt,
          shippedAt,
          paidAt,
          current.id,
        ],
      );

      if (trackingEventMessage) {
        await client.query(
          `
            INSERT INTO order_tracking_events (
              order_id,
              created_by_admin_id,
              status,
              message,
              location,
              occurred_at
            )
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP);
          `,
          [current.id, req.admin.id, trackingEventStatus, trackingEventMessage, trackingEventLocation],
        );
      }

      order = mapOrderRow(updatedResult.rows[0]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const [orderWithEvents] = await attachTrackingEventsToOrders(
      [
        {
          ...order,
          paymentProofUrl: current.payment_proof_path
            ? buildPublicAssetUrl(req, current.payment_proof_path)
            : null,
        },
      ],
      db,
    );
    const mailRequested = Boolean(req.body.notifyCustomer) && current.customer_email;
    let mail = null;

    if (mailRequested) {
      const subject =
        normalizeOptionalText(req.body.emailSubject, 180) ||
        `Update for order ${order.orderNumber}`;
      const message =
        normalizeOptionalText(req.body.emailMessage, 4000) ||
        `Your order ${order.orderNumber} is now marked as ${status}. Payment status: ${paymentStatus}.`;
      mail = await sendManualCustomerEmail({
        email: current.customer_email,
        message,
        subject,
      });
    }

    res.status(200).json({
      mailDelivered: mail?.delivered,
      mailMode: mail?.mode,
      mailPreviewUrl: mail?.previewUrl || undefined,
      message: 'Order updated successfully.',
      order: orderWithEvents,
      success: true,
    });
  }),
);

api.post(
  '/admin/orders/:orderNumber/email',
  authLimiter,
  requireAdmin,
  requireAdminCapability('orders'),
  handleAsync(async (req, res) => {
    const orderNumber = String(req.params.orderNumber || '').trim();
    const subject = normalizeOptionalText(req.body.subject, 180);
    const message = normalizeOptionalText(req.body.message, 4000);
    const orderResult = await db.query('SELECT customer_email FROM orders WHERE order_number = $1;', [
      orderNumber,
    ]);

    if (!orderNumber || orderResult.rowCount === 0) {
      return sendApiError(res, 404, 'Order not found.');
    }

    if (!subject || !message) {
      return sendApiError(res, 400, 'A subject and message are required.');
    }

    const mail = await sendManualCustomerEmail({
      email: orderResult.rows[0].customer_email,
      message,
      subject,
    });

    res.status(200).json({
      mailDelivered: mail.delivered,
      mailMode: mail.mode,
      mailPreviewUrl: mail.previewUrl || undefined,
      message: 'Email sent successfully.',
      success: true,
    });
  }),
);

api.patch(
  '/admin/users/:userId',
  authLimiter,
  requireAdmin,
  requireAdminCapability('users'),
  handleAsync(async (req, res) => {
    const userId = parsePositiveInt(req.params.userId);

    if (!userId) {
      return sendApiError(res, 400, 'A valid user id is required.');
    }

    const userResult = await db.query('SELECT * FROM users WHERE id = $1;', [userId]);

    if (userResult.rowCount === 0) {
      return sendApiError(res, 404, 'User not found.');
    }

    const current = userResult.rows[0];
    const currentAccountStatus = normalizeEnumValue(
      current.account_status,
      USER_ACCOUNT_STATUSES,
      'active',
    );
    const accountStatus = normalizeEnumValue(
      req.body.accountStatus === undefined ? currentAccountStatus : req.body.accountStatus,
      USER_ACCOUNT_STATUSES,
    );
    const fullName = String(req.body.fullName ?? current.full_name).trim();
    const newsletterOptIn =
      req.body.newsletterOptIn === undefined
        ? Boolean(current.newsletter_opt_in)
        : Boolean(req.body.newsletterOptIn);
    const phoneNumber = normalizeOptionalText(req.body.phoneNumber ?? current.phone_number, 40) || null;
    const emailVerified =
      req.body.emailVerified === undefined
        ? Boolean(current.email_verified_at)
        : Boolean(req.body.emailVerified);

    if (!fullName) {
      return sendApiError(res, 400, 'Full name is required.');
    }

    if (!accountStatus) {
      return sendApiError(res, 400, 'Account status must be either active or suspended.');
    }

    const updatedResult = await db.query(
      `
        UPDATE users
        SET
          full_name = $1,
          account_status = $2,
          newsletter_opt_in = $3,
          phone_number = $4,
          email_verified_at = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *;
      `,
      [
        fullName,
        accountStatus,
        newsletterOptIn,
        phoneNumber,
        emailVerified ? current.email_verified_at || new Date().toISOString() : null,
        userId,
      ],
    );

    if (newsletterOptIn) {
      await db.query(
        `
          INSERT INTO newsletter_subscribers (email, full_name, source, status, updated_at)
          VALUES ($1, $2, 'admin_dashboard', 'active', CURRENT_TIMESTAMP)
          ON CONFLICT (email)
          DO UPDATE
          SET
            full_name = EXCLUDED.full_name,
            status = 'active',
            updated_at = CURRENT_TIMESTAMP;
        `,
        [current.email, fullName],
      );
    } else {
      await db.query(
        `
          UPDATE newsletter_subscribers
          SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
          WHERE email = $1;
        `,
        [current.email],
      );
    }

    res.status(200).json({
      message: 'User updated successfully.',
      success: true,
      user: mapUserRow(updatedResult.rows[0]),
    });
  }),
);

api.delete(
  '/admin/users/:userId',
  authLimiter,
  requireAdmin,
  requireAdminCapability('users'),
  handleAsync(async (req, res) => {
    const userId = parsePositiveInt(req.params.userId);

    if (!userId) {
      return sendApiError(res, 400, 'A valid user id is required.');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'SELECT id, email, full_name FROM users WHERE id = $1 FOR UPDATE;',
        [userId],
      );

      if (userResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return sendApiError(res, 404, 'User not found.');
      }

      const current = userResult.rows[0];

      await client.query('DELETE FROM newsletter_subscribers WHERE email = $1;', [current.email]);
      await client.query('DELETE FROM users WHERE id = $1;', [userId]);

      await client.query('COMMIT');

      res.status(200).json({
        message: `${current.full_name || current.email} deleted successfully.`,
        success: true,
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }),
);

api.post(
  '/admin/users/:userId/email',
  authLimiter,
  requireAdmin,
  requireAdminCapability('users'),
  handleAsync(async (req, res) => {
    const userId = parsePositiveInt(req.params.userId);
    const subject = normalizeOptionalText(req.body.subject, 180);
    const message = normalizeOptionalText(req.body.message, 4000);

    if (!userId) {
      return sendApiError(res, 400, 'A valid user id is required.');
    }

    if (!subject || !message) {
      return sendApiError(res, 400, 'A subject and message are required.');
    }

    const userResult = await db.query('SELECT email FROM users WHERE id = $1;', [userId]);

    if (userResult.rowCount === 0) {
      return sendApiError(res, 404, 'User not found.');
    }

    const mail = await sendManualCustomerEmail({
      email: userResult.rows[0].email,
      message,
      subject,
    });

    res.status(200).json({
      mailDelivered: mail.delivered,
      mailMode: mail.mode,
      mailPreviewUrl: mail.previewUrl || undefined,
      message: 'Email sent successfully.',
      success: true,
    });
  }),
);

api.get(
  '/payments/config',
  handleAsync(async (_req, res) => {
    const settings = await getRuntimeSettings();

    res.status(200).json({
      paymentConfig: buildPaymentConfig(settings),
      success: true,
    });
  }),
);

api.post(
  '/payments/paystack/webhook',
  handleAsync(async (req, res) => {
    const settings = await getRuntimeSettings();
    const paystackSecretKey = settings.payments.paystackSecretKey;

    if (!paystackSecretKey) {
      return sendApiError(res, 503, 'Paystack is not configured on this server.');
    }

    const signature = String(req.headers['x-paystack-signature'] || '').trim();
    const expectedSignature = crypto
      .createHmac('sha512', paystackSecretKey)
      .update(req.rawBody || '')
      .digest('hex');

    if (!signature || signature !== expectedSignature) {
      return sendApiError(res, 401, 'Invalid Paystack signature.');
    }

    if (String(req.body?.event || '').trim() !== 'charge.success') {
      return res.status(200).json({ received: true });
    }

    const reference = String(req.body?.data?.reference || '').trim();

    if (!reference) {
      return res.status(200).json({ received: true });
    }

    try {
      const finalized = await finalizePaystackAttempt({
        gatewayResponse: req.body.data,
        reference,
      });

      if (!finalized.alreadyProcessed) {
        queueMail(() => sendOrderConfirmationEmail({ items: finalized.items, order: finalized.order }));
      }
    } catch (error) {
      if (error.status === 404 || error.status === 409) {
        console.warn('Paystack webhook was received but could not finalize payment:', error.message);
        return res.status(200).json({ received: true });
      }

      throw error;
    }

    return res.status(200).json({ received: true });
  }),
);

api.post(
  '/payments/paystack/initialize',
  publicWriteLimiter,
  requireAuth,
  handleAsync(async (req, res) => {
    const settings = await getRuntimeSettings();

    if (!isPaystackEnabled(settings)) {
      return sendApiError(res, 503, 'Paystack payments are not configured yet.');
    }

    const sessionId = normalizeSessionId(req.body.sessionId);
    const customer = parseCustomerPayload(req.body);
    const notes = String(req.body.notes || '').trim();

    if (!validateCheckoutCustomer(customer)) {
      return sendApiError(
        res,
        400,
        'Checkout requires a valid name, email, address, city, and country.',
      );
    }

    const snapshot = await getSessionCheckoutSnapshot(sessionId, db);

    if (snapshot.items.length === 0) {
      return sendApiError(res, 400, 'Your cart is empty.');
    }

    if (snapshot.unavailableItem) {
      return sendApiError(res, 409, `Insufficient stock for ${snapshot.unavailableItem.name}.`, {
        availableStock: snapshot.unavailableItem.stock_quantity,
      });
    }

    const reference = createPaymentReference('PAY');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const attemptResult = await db.query(
      `
        INSERT INTO payment_attempts (
          reference,
          user_id,
          session_id,
          payment_method,
          provider,
          customer_name,
          customer_email,
          customer_phone,
          shipping_address,
          shipping_city,
          shipping_country,
          notes,
          subtotal,
          shipping_fee,
          total,
          currency,
          items_json,
          expires_at
        )
        VALUES (
          $1, $2, $3, 'paystack', 'paystack', $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16
        )
        RETURNING *;
      `,
      [
        reference,
        req.user.id,
        sessionId,
        customer.name,
        customer.email,
        customer.phone || null,
        customer.address,
        customer.city,
        customer.country,
        notes || null,
        snapshot.summary.subtotal,
        snapshot.summary.shippingFee,
        snapshot.summary.total,
        settings.payments.currency,
        JSON.stringify(snapshot.items),
        expiresAt,
      ],
    );

    const attempt = attemptResult.rows[0];
    const publicSiteUrl = await getPublicSiteUrl();
    const callbackUrl =
      String(process.env.PAYSTACK_CALLBACK_URL || '').trim() ||
      `${publicSiteUrl}/?tab=cart&payment=paystack&reference=${encodeURIComponent(reference)}`;

    try {
      const paystackResponse = await callPaystack(
        settings.payments.paystackSecretKey,
        '/transaction/initialize',
        {
        body: {
          amount: toMinorUnits(snapshot.summary.total),
          callback_url: callbackUrl,
          currency: settings.payments.currency,
          email: customer.email,
          metadata: {
            attemptId: attempt.id,
            customerName: customer.name,
            itemCount: snapshot.summary.itemCount,
            sessionId,
            userId: req.user.id,
          },
          reference,
        },
        method: 'POST',
      });

      await db.query(
        `
          UPDATE payment_attempts
          SET
            access_code = $1,
            authorization_url = $2,
            gateway_response = $3,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $4;
        `,
        [
          paystackResponse.data.access_code,
          paystackResponse.data.authorization_url,
          JSON.stringify(paystackResponse.data),
          attempt.id,
        ],
      );

      res.status(200).json({
        accessCode: paystackResponse.data.access_code,
        amount: snapshot.summary.total,
        amountMinor: toMinorUnits(snapshot.summary.total),
        authorizationUrl: paystackResponse.data.authorization_url,
        currency: settings.payments.currency,
        message: 'Paystack checkout is ready.',
        publicKey: settings.payments.paystackPublicKey,
        reference,
        success: true,
      });
    } catch (error) {
      await db.query(
        `
          UPDATE payment_attempts
          SET
            status = 'failed',
            gateway_response = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2;
        `,
        [JSON.stringify({ details: error.details || null, message: error.message }), attempt.id],
      );

      throw error;
    }
  }),
);

api.post(
  '/payments/paystack/verify',
  publicWriteLimiter,
  requireAuth,
  handleAsync(async (req, res) => {
    const settings = await getRuntimeSettings();
    const reference = String(req.body.reference || '').trim();

    if (!reference) {
      return sendApiError(res, 400, 'Payment reference is required.');
    }

    const attemptResult = await db.query('SELECT user_id FROM payment_attempts WHERE reference = $1;', [
      reference,
    ]);

    if (attemptResult.rowCount === 0) {
      return sendApiError(res, 404, 'Payment record not found.');
    }

    if (attemptResult.rows[0].user_id && attemptResult.rows[0].user_id !== req.user.id) {
      return sendApiError(res, 403, 'You cannot verify this payment.');
    }

    const paystackResponse = await callPaystack(
      settings.payments.paystackSecretKey,
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    const finalized = await finalizePaystackAttempt({
      gatewayResponse: paystackResponse.data,
      reference,
    });
    const orderMail = finalized.alreadyProcessed
      ? null
      : await sendOrderConfirmationEmail({
          items: finalized.items,
          order: finalized.order,
        });

    res.status(200).json({
      items: finalized.items,
      mailDelivered: orderMail?.delivered,
      mailError: orderMail?.error || undefined,
      mailMode: orderMail?.mode,
      mailPreviewUrl: orderMail?.previewUrl || undefined,
      message: finalized.alreadyProcessed
        ? 'This Paystack payment has already been verified.'
        : buildMailMessage({
            delivery: orderMail,
            fallbackMessage:
              'Payment verified and order placed. This environment is not configured for real inbox delivery yet, so no confirmation email was sent.',
            previewMessage:
              'Payment verified and order placed. Use the preview link below to review the confirmation email locally.',
            smtpFailureMessage:
              'Payment verified and order placed, but the confirmation email could not be delivered right now.',
            successMessage: 'Payment verified and order placed successfully.',
          }),
      order: finalized.order,
      success: true,
    });
  }),
);

api.post(
  '/payments/bank-transfer/submit',
  publicWriteLimiter,
  requireAuth,
  (req, res, next) => {
    getRuntimeSettings()
      .then((settings) => {
        if (!isBankTransferEnabled(settings)) {
          res.status(503).json({
            success: false,
            message: 'Bank transfer payments are not available right now.',
          });
          return;
        }

        req.runtimeSettings = settings;
        next();
      })
      .catch(next);
  },
  paymentProofUpload.single('proof'),
  handleAsync(async (req, res) => {
    const settings = req.runtimeSettings || (await getRuntimeSettings());
    const sessionId = normalizeSessionId(req.body.sessionId);
    const customer = parseCustomerPayload(req.body);
    const notes = String(req.body.notes || '').trim();

    if (!validateCheckoutCustomer(customer)) {
      if (req.file?.path) {
        fs.rmSync(req.file.path, { force: true });
      }

      return sendApiError(
        res,
        400,
        'Checkout requires a valid name, email, address, city, and country.',
      );
    }

    if (!req.file) {
      return sendApiError(res, 400, 'Upload a JPG, PNG, or PDF proof of payment to continue.');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const snapshot = await getSessionCheckoutSnapshot(sessionId, client, { forUpdate: true });

      if (snapshot.items.length === 0) {
        await client.query('ROLLBACK');
        fs.rmSync(req.file.path, { force: true });
        return sendApiError(res, 400, 'Your cart is empty.');
      }

      if (snapshot.unavailableItem) {
        await client.query('ROLLBACK');
        fs.rmSync(req.file.path, { force: true });
        return sendApiError(res, 409, `Insufficient stock for ${snapshot.unavailableItem.name}.`, {
          availableStock: snapshot.unavailableItem.stock_quantity,
        });
      }

      const proofPath = `/uploads/payment-proofs/${req.file.filename}`;
      const order = await createOrderRecord({
        client,
        customer,
        items: snapshot.items,
        notes,
        payment: {
          currency: settings.payments.currency,
          method: 'bank_transfer',
          orderStatus: 'awaiting_payment_review',
          proofName: req.file.originalname,
          proofPath,
          provider: 'bank_transfer',
          reference: createPaymentReference('BANK'),
          status: 'proof_submitted',
        },
        sessionId,
        summary: snapshot.summary,
        userId: req.user.id,
      });

      await client.query('COMMIT');

      const mappedOrder = mapOrderRow(order);
      const proofUrl = buildPublicAssetUrl(req, proofPath);
      const customerMail = await sendBankTransferSubmissionEmail({ order: mappedOrder });

      queueMail(() =>
        sendBankTransferNotificationEmail({
          items: snapshot.items,
          order: mappedOrder,
          proofUrl,
        }),
      );

      res.status(201).json({
        items: snapshot.items,
        mailDelivered: customerMail.delivered,
        mailError: customerMail.error || undefined,
        mailMode: customerMail.mode,
        mailPreviewUrl: customerMail.previewUrl || undefined,
        message: buildMailMessage({
          delivery: customerMail,
          fallbackMessage:
            'Proof uploaded successfully. Your transfer is awaiting review, but real inbox delivery is not configured for this environment yet.',
          previewMessage:
            'Proof uploaded successfully. Your transfer is awaiting review, and the acknowledgement email can be previewed locally below.',
          smtpFailureMessage:
            'Proof uploaded successfully, but the acknowledgement email could not be delivered right now.',
          successMessage: 'Proof uploaded successfully. Your transfer is awaiting review.',
        }),
        order: {
          ...mappedOrder,
          paymentProofUrl: proofUrl,
        },
        success: true,
      });
    } catch (error) {
      await client.query('ROLLBACK');

      if (req.file?.path) {
        fs.rmSync(req.file.path, { force: true });
      }

      throw error;
    } finally {
      client.release();
    }
  }),
);

api.get(
  '/cart',
  handleAsync(async (req, res) => {
    const sessionId = normalizeSessionId(req.query.sessionId);
    const cart = await buildCartSnapshot(sessionId);

    res.status(200).json({
      success: true,
      cart,
    });
  }),
);

api.post(
  '/cart/items',
  handleAsync(async (req, res) => {
    const sessionId = normalizeSessionId(req.body.sessionId);
    const productId = parsePositiveInt(req.body.productId);
    const quantity = parsePositiveInt(req.body.quantity || 1);

    if (!productId || !quantity) {
      return sendApiError(res, 400, 'A valid productId and quantity are required.');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const productResult = await client.query(
        `
          SELECT id, stock_quantity
          FROM products
          WHERE id = $1
          FOR UPDATE;
        `,
        [productId],
      );

      if (productResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return sendApiError(res, 404, 'Product not found.');
      }

      const product = productResult.rows[0];

      if (product.stock_quantity < quantity) {
        await client.query('ROLLBACK');
        return sendApiError(res, 409, 'Requested quantity exceeds current stock.', {
          availableStock: product.stock_quantity,
        });
      }

      const existingResult = await client.query(
        `
          SELECT id, quantity
          FROM cart_items
          WHERE session_id = $1 AND product_id = $2
          FOR UPDATE;
        `,
        [sessionId, productId],
      );

      const nextQuantity = (existingResult.rows[0]?.quantity || 0) + quantity;

      if (nextQuantity > product.stock_quantity) {
        await client.query('ROLLBACK');
        return sendApiError(res, 409, 'Requested quantity exceeds current stock.', {
          availableStock: product.stock_quantity,
        });
      }

      if (existingResult.rowCount > 0) {
        await client.query(
          `
            UPDATE cart_items
            SET quantity = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2;
          `,
          [nextQuantity, existingResult.rows[0].id],
        );
      } else {
        await client.query(
          `
            INSERT INTO cart_items (session_id, product_id, quantity)
            VALUES ($1, $2, $3);
          `,
          [sessionId, productId, quantity],
        );
      }

      const cart = await buildCartSnapshot(sessionId, client);

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Item added to cart.',
        cart,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

api.patch(
  '/cart/items/:productId',
  handleAsync(async (req, res) => {
    const sessionId = normalizeSessionId(req.body.sessionId || req.query.sessionId);
    const productId = parsePositiveInt(req.params.productId);
    const quantity = Number.parseInt(req.body.quantity, 10);

    if (!productId || Number.isNaN(quantity) || quantity < 0) {
      return sendApiError(res, 400, 'A valid productId and quantity are required.');
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const cartItemResult = await client.query(
        `
          SELECT id
          FROM cart_items
          WHERE session_id = $1 AND product_id = $2
          FOR UPDATE;
        `,
        [sessionId, productId],
      );

      if (cartItemResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return sendApiError(res, 404, 'Cart item not found.');
      }

      if (quantity === 0) {
        await client.query(
          'DELETE FROM cart_items WHERE session_id = $1 AND product_id = $2;',
          [sessionId, productId],
        );
      } else {
        const productResult = await client.query(
          `
            SELECT stock_quantity
            FROM products
            WHERE id = $1
            FOR UPDATE;
          `,
          [productId],
        );

        if (productResult.rowCount === 0) {
          await client.query('ROLLBACK');
          return sendApiError(res, 404, 'Product not found.');
        }

        const availableStock = productResult.rows[0].stock_quantity;

        if (quantity > availableStock) {
          await client.query('ROLLBACK');
          return sendApiError(res, 409, 'Requested quantity exceeds current stock.', {
            availableStock,
          });
        }

        await client.query(
          `
            UPDATE cart_items
            SET quantity = $1, updated_at = CURRENT_TIMESTAMP
            WHERE session_id = $2 AND product_id = $3;
          `,
          [quantity, sessionId, productId],
        );
      }

      const cart = await buildCartSnapshot(sessionId, client);

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: 'Cart updated.',
        cart,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

api.delete(
  '/cart/items/:productId',
  handleAsync(async (req, res) => {
    const sessionId = normalizeSessionId(req.query.sessionId || req.body.sessionId);
    const productId = parsePositiveInt(req.params.productId);

    if (!productId) {
      return sendApiError(res, 400, 'A valid productId is required.');
    }

    await db.query('DELETE FROM cart_items WHERE session_id = $1 AND product_id = $2;', [
      sessionId,
      productId,
    ]);

    const cart = await buildCartSnapshot(sessionId);

    res.status(200).json({
      success: true,
      message: 'Item removed from cart.',
      cart,
    });
  }),
);

api.delete(
  '/cart',
  handleAsync(async (req, res) => {
    const sessionId = normalizeSessionId(req.query.sessionId || req.body.sessionId);

    await db.query('DELETE FROM cart_items WHERE session_id = $1;', [sessionId]);

    res.status(200).json({
      success: true,
      message: 'Cart cleared.',
      cart: {
        sessionId,
        items: [],
        summary: calculateCartSummary([]),
      },
    });
  }),
);

api.post(
  '/checkout',
  publicWriteLimiter,
  handleAsync(async (req, res) => {
    return sendApiError(
      res,
      410,
      'Checkout now requires a payment method. Use the Paystack or bank-transfer payment endpoints.',
    );
  }),
);

api.get(
  '/orders/:orderNumber',
  handleAsync(async (req, res) => {
    const orderNumber = String(req.params.orderNumber || '').trim();

    if (!orderNumber) {
      return sendApiError(res, 400, 'Order number is required.');
    }

    const orderResult = await db.query('SELECT * FROM orders WHERE order_number = $1;', [
      orderNumber,
    ]);

    if (orderResult.rowCount === 0) {
      return sendApiError(res, 404, 'Order not found.');
    }

    const orderRow = orderResult.rows[0];
    const authenticatedUser = await resolveAuthenticatedUser(req);
    const requestedEmail = String(req.query.email || '').trim().toLowerCase();
    const customerEmail = String(orderRow.customer_email || '').trim().toLowerCase();
    const isOrderOwner =
      Boolean(authenticatedUser) &&
      (Number(authenticatedUser.id) === Number(orderRow.user_id) ||
        String(authenticatedUser.email || '').trim().toLowerCase() === customerEmail);
    const hasMatchingEmail = validateEmail(requestedEmail) && requestedEmail === customerEmail;

    if (!isOrderOwner && !hasMatchingEmail) {
      return sendApiError(
        res,
        403,
        'Sign in or provide the email used for the order to view tracking details.',
      );
    }

    const [order] = await attachTrackingEventsToOrders([mapOrderRow(orderRow)], db);
    const items = await getOrderItems(orderRow.id, db);

    res.status(200).json({
      success: true,
      order,
      items,
    });
  }),
);

app.use('/api', api);

app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found.',
  });
});

app.use('/uploads', express.static(UPLOADS_DIR));

if (hasFrontendBuild) {
  app.use(express.static(FRONTEND_DIST));

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use((error, req, res, _next) => {
  console.error(error);

  if (error.message === 'Origin not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof multer.MulterError) {
    const isProductImageUpload = String(req.path || '').includes('/admin/uploads/product-image');
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      success: false,
      message:
        error.code === 'LIMIT_FILE_SIZE'
          ? isProductImageUpload
            ? `Product images must be ${Math.round(PRODUCT_IMAGE_MAX_SIZE_BYTES / (1024 * 1024))}MB or smaller.`
            : `Proof uploads must be ${Math.round(PAYMENT_PROOF_MAX_SIZE_BYTES / (1024 * 1024))}MB or smaller.`
          : error.message,
    });
  }

  return res.status(error.status || 500).json({
    success: false,
    message: error.status ? error.message : 'Internal server error.',
  });
});

const startServer = async () => {
  await ensureSchema();
  await db.testConnection();

  app.listen(PORT, () => {
    console.log(`Luxury Store API listening on port ${PORT}`);
  });
};

startServer().catch(async (error) => {
  console.error('Failed to start server:', error);
  await db.end();
  process.exit(1);
});


