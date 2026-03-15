#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const db = require('../db');
const { ensureSchema } = require('../schema');
const { hashToken } = require('../security');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 5000);
const BASE_URL = String(process.env.AUDIT_BASE_URL || `http://127.0.0.1:${PORT}/api`).replace(/\/+$/, '');
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();
const STAMP = Date.now();
const PASS = '[PASS]';
const SKIP = '[SKIP]';
const FAIL = '[FAIL]';

const state = {
  adminEmails: new Set(),
  emails: new Set(),
  files: new Set(),
  orderNumbers: new Set(),
  paymentReferences: new Set(),
  productIds: new Set(),
  sessionIds: new Set(),
};

let spawnedServer = null;
let passedChecks = 0;
const warnings = [];

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in backend/.env before running npm run audit:api.');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const trackEmail = (email) => email && state.emails.add(String(email).trim().toLowerCase());
const trackAdminEmail = (email) =>
  email && state.adminEmails.add(String(email).trim().toLowerCase());
const trackFile = (assetPath) =>
  assetPath && state.files.add(path.resolve(ROOT, String(assetPath).replace(/^\/+/, '')));
const trackOrder = (orderNumber) => orderNumber && state.orderNumbers.add(String(orderNumber).trim());
const trackPayment = (reference) =>
  reference && state.paymentReferences.add(String(reference).trim());
const trackProduct = (productId) => productId && state.productIds.add(Number(productId));
const trackSession = (sessionId) => sessionId && state.sessionIds.add(String(sessionId).trim());

const buildUrl = (route, query = {}) => {
  const url = new URL(route.replace(/^\//, ''), `${BASE_URL}/`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
};

const request = async (route, { body, expected = [200], headers = {}, method = 'GET', query, token } = {}) => {
  const requestHeaders = new Headers(headers);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  let requestBody = body;

  if (requestBody !== undefined && requestBody !== null && !isFormData && typeof requestBody !== 'string') {
    requestBody = JSON.stringify(requestBody);
    if (!requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }
  }

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(route, query), {
    body: requestBody,
    headers: requestHeaders,
    method,
    signal: AbortSignal.timeout(30000),
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
  const text = payload ? '' : await response.text().catch(() => '');

  if (!expected.includes(response.status)) {
    const message = payload?.message || text.slice(0, 160);
    throw new Error(`${route} expected ${expected.join(', ')} but received ${response.status}${message ? ` (${message})` : ''}`);
  }

  return { payload, status: response.status };
};

const check = async (label, fn) => {
  await fn();
  passedChecks += 1;
  console.log(`${PASS} ${label}`);
};

const apiReady = async () => {
  try {
    await request('/health');
    return true;
  } catch (_error) {
    return false;
  }
};

const ensureServerRunning = async () => {
  if (await apiReady()) {
    return;
  }

  spawnedServer = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    stdio: 'ignore',
  });

  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (await apiReady()) {
      return;
    }
    if (spawnedServer.exitCode !== null) {
      break;
    }
    await sleep(1000);
  }

  throw new Error('The API server did not become ready in time.');
};

const pngBlob = () =>
  new Blob(
    [
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P8z8DwnwEIAgMBN1mQ7QAAAABJRU5ErkJggg==',
        'base64',
      ),
    ],
    { type: 'image/png' },
  );

const cleanup = async () => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    if (state.orderNumbers.size > 0) {
      const orderNumbers = Array.from(state.orderNumbers);
      const proofRows = await client.query(
        `
          SELECT payment_proof_path
          FROM orders
          WHERE order_number = ANY($1::varchar[]);
        `,
        [orderNumbers],
      );
      proofRows.rows.forEach((row) => trackFile(row.payment_proof_path));
      await client.query(
        `
          UPDATE products AS products
          SET stock_quantity = products.stock_quantity + restored.quantity
          FROM (
            SELECT oi.product_id, SUM(oi.quantity)::int AS quantity
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            WHERE o.order_number = ANY($1::varchar[])
              AND oi.product_id IS NOT NULL
            GROUP BY oi.product_id
          ) AS restored
          WHERE products.id = restored.product_id;
        `,
        [orderNumbers],
      );
      await client.query('DELETE FROM orders WHERE order_number = ANY($1::varchar[]);', [orderNumbers]);
    }

    if (state.paymentReferences.size > 0 || state.sessionIds.size > 0) {
      await client.query(
        `
          DELETE FROM payment_attempts
          WHERE ($1::varchar[] <> '{}'::varchar[] AND reference = ANY($1::varchar[]))
             OR ($2::varchar[] <> '{}'::varchar[] AND session_id = ANY($2::varchar[]));
        `,
        [Array.from(state.paymentReferences), Array.from(state.sessionIds)],
      );
    }

    if (state.sessionIds.size > 0) {
      await client.query('DELETE FROM cart_items WHERE session_id = ANY($1::varchar[]);', [
        Array.from(state.sessionIds),
      ]);
    }

    if (state.productIds.size > 0) {
      await client.query('DELETE FROM products WHERE id = ANY($1::int[]);', [Array.from(state.productIds)]);
    }

    if (state.emails.size > 0) {
      const emails = Array.from(state.emails);
      await client.query('DELETE FROM contact_messages WHERE email = ANY($1::varchar[]);', [emails]);
      await client.query('DELETE FROM newsletter_subscribers WHERE email = ANY($1::varchar[]);', [emails]);
      await client.query('DELETE FROM users WHERE email = ANY($1::varchar[]);', [emails]);
    }

    if (state.adminEmails.size > 0) {
      await client.query('DELETE FROM admins WHERE email = ANY($1::varchar[]);', [
        Array.from(state.adminEmails),
      ]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${FAIL} Cleanup failed: ${error.message}`);
  } finally {
    client.release();
  }

  state.files.forEach((filePath) => {
    try {
      fs.rmSync(filePath, { force: true });
    } catch (_error) {}
  });

  if (spawnedServer && spawnedServer.exitCode === null) {
    spawnedServer.kill();
  }
};

const userIdentity = (label) => ({
  email: `audit.${label}.${STAMP}@example.com`,
  fullName: `API Audit ${label}`,
  password: 'AuditPass123!',
  phoneNumber: '+2348012345678',
});

const main = async () => {
  await ensureSchema();
  await ensureServerRunning();

  const requiredTables = [
    'admins',
    'cart_items',
    'contact_messages',
    'newsletter_subscribers',
    'order_items',
    'order_tracking_events',
    'orders',
    'payment_attempts',
    'products',
    'site_settings',
    'users',
  ];
  const primaryUser = userIdentity('primary');
  const secondaryUser = userIdentity('secondary');
  const tempAdminEmail = `audit.admin.${STAMP}@example.com`;
  const sessions = {
    cart: `audit-cart-${STAMP}`,
    paystack: `audit-paystack-${STAMP}`,
  };

  trackEmail(primaryUser.email);
  trackEmail(secondaryUser.email);
  trackAdminEmail(tempAdminEmail);
  trackSession(sessions.cart);
  trackSession(sessions.paystack);

  let ownerToken;
  let primaryToken;
  let primaryUserId;
  let secondaryUserId;
  let primaryReferralCode;
  let tempAdminId;
  let tempAdminPassword = 'AdminAudit123!';
  let tempProductId;
  let tempProductImageUrl;
  let paymentConfig;
  let orderNumber;

  await check('Database tables exist', async () => {
    const result = await db.query(
      `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = ANY($1::text[]);
      `,
      [requiredTables],
    );
    const existing = new Set(result.rows.map((row) => row.tablename));
    requiredTables.forEach((table) => assert(existing.has(table), `Missing required table: ${table}`));
  });

  await check('Public endpoints respond', async () => {
    const health = await request('/health');
    const settings = await request('/settings/public');
    const location = await request('/location/resolve', {
      body: { latitude: 6.5244, longitude: 3.3792, timezone: 'Africa/Lagos' },
      method: 'POST',
    });
    const products = await request('/products');
    const categories = await request('/categories');

    assert(health.payload?.success === true, 'Health check did not report success.');
    assert(settings.payload?.settings?.storeName, 'Public settings are missing storeName.');
    assert(location.payload?.deviceContext?.latitude !== null, 'Location resolver did not return latitude.');
    assert((products.payload?.products || []).length > 0, 'Products endpoint returned no products.');
    assert(Array.isArray(categories.payload?.categories), 'Categories endpoint did not return categories.');
  });

  await check('Newsletter and contact endpoints work', async () => {
    const newsletterEmail = `audit.newsletter.${STAMP}@example.com`;
    const contactEmail = `audit.contact.${STAMP}@example.com`;

    trackEmail(newsletterEmail);
    trackEmail(contactEmail);

    await request('/newsletter/subscribe', {
      body: { email: newsletterEmail, fullName: 'API Audit Newsletter' },
      expected: [201],
      method: 'POST',
    });
    await request('/contact', {
      body: {
        email: contactEmail,
        fullName: 'API Audit Contact',
        message: 'Deployment readiness audit.',
        subject: 'API audit',
      },
      expected: [201],
      method: 'POST',
    });
  });

  await check('Anonymous customer access is blocked', async () => {
    await request('/auth/me', { expected: [401] });
  });

  await check('Customer signup, profile, settings, resend verification, and verify-email work', async () => {
    const primarySignup = await request('/auth/signup', {
      body: {
        email: primaryUser.email,
        fullName: primaryUser.fullName,
        password: primaryUser.password,
        acceptTerms: true,
        latitude: 6.5244,
        longitude: 3.3792,
        newsletterOptIn: true,
      },
      expected: [201],
      method: 'POST',
    });

    primaryToken = primarySignup.payload?.token;
    primaryUserId = primarySignup.payload?.user?.id;
    primaryReferralCode = primarySignup.payload?.user?.referralCode;

    assert(primaryReferralCode, 'Primary signup did not return a referral code.');

    const referralLookup = await request(`/auth/referrals/${primaryReferralCode}`);
    assert(referralLookup.payload?.valid === true, 'Referral lookup did not validate the primary code.');

    const secondarySignup = await request('/auth/signup', {
      body: {
        email: secondaryUser.email,
        fullName: secondaryUser.fullName,
        password: secondaryUser.password,
        acceptTerms: true,
        newsletterOptIn: false,
        referralCode: primaryReferralCode,
      },
      expected: [201],
      method: 'POST',
    });

    secondaryUserId = secondarySignup.payload?.user?.id;

    assert(primaryUserId && secondaryUserId, 'Customer signups did not return ids.');
    assert(
      secondarySignup.payload?.user?.referredByCode === primaryReferralCode,
      'Secondary signup did not store the referral code.',
    );

    if (!primaryToken) {
      const signupLogin = await request('/auth/login', {
        body: { email: primaryUser.email, password: primaryUser.password },
        method: 'POST',
      });
      primaryToken = signupLogin.payload?.token;
    }

    assert(primaryToken, 'Primary signup/login did not return a token.');

    const profile = await request('/auth/me', { token: primaryToken });
    assert(profile.payload?.user?.email === primaryUser.email, 'auth/me returned the wrong customer.');

    const settings = await request('/auth/settings', {
      body: {
        defaultAddress: '12 Audit Avenue',
        defaultCity: 'Lagos',
        defaultCountry: 'Nigeria',
        fullName: 'API Audit Primary',
        newsletterOptIn: true,
        phoneNumber: primaryUser.phoneNumber,
      },
      method: 'PATCH',
      token: primaryToken,
    });
    assert(settings.payload?.user?.defaultCity === 'Lagos', 'auth/settings did not persist defaultCity.');

    await request('/auth/resend-verification', {
      body: { email: secondaryUser.email },
      expected: [200, 409],
      method: 'POST',
    });

    const verificationToken = `audit-verify-${STAMP}`;
    await db.query(
      `
        UPDATE users
        SET
          email_verified_at = NULL,
          verification_token_hash = $1,
          verification_token_expires_at = CURRENT_TIMESTAMP + INTERVAL '1 hour'
        WHERE id = $2;
      `,
      [hashToken(verificationToken), primaryUserId],
    );
    await request('/auth/verify-email', {
      query: { token: verificationToken },
    });

    const login = await request('/auth/login', {
      body: { email: primaryUser.email, password: primaryUser.password },
      method: 'POST',
    });
    primaryToken = login.payload?.token;
    assert(primaryToken, 'Customer login did not return a token.');
  });

  await check('Admin auth, bootstrap, and settings work', async () => {
    const login = await request('/admin/auth/login', {
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      method: 'POST',
    });
    ownerToken = login.payload?.token;
    assert(ownerToken, 'Admin login did not return a token.');

    const adminMe = await request('/admin/auth/me', { token: ownerToken });
    const bootstrap = await request('/admin/bootstrap', { token: ownerToken });
    const settings = await request('/admin/settings', { token: ownerToken });

    assert(adminMe.payload?.admin?.email === ADMIN_EMAIL, 'admin/auth/me returned the wrong admin.');
    assert(Array.isArray(bootstrap.payload?.orders), 'Admin bootstrap is missing orders.');
    assert(settings.payload?.settings?.brand?.storeName, 'Admin settings are missing storeName.');

    await request('/admin/settings', {
      body: settings.payload.settings,
      method: 'PUT',
      token: ownerToken,
    });
  });

  await check('Admin team endpoints work', async () => {
    const createResponse = await request('/admin/admins', {
      body: {
        email: tempAdminEmail,
        fullName: 'API Audit Team',
        isActive: true,
        password: tempAdminPassword,
        role: 'manager',
      },
      expected: [201],
      method: 'POST',
      token: ownerToken,
    });
    tempAdminId = createResponse.payload?.admin?.id;
    assert(tempAdminId, 'Creating a temporary admin did not return an id.');

    tempAdminPassword = 'AdminAudit456!';
    await request(`/admin/admins/${tempAdminId}`, {
      body: {
        email: tempAdminEmail,
        fullName: 'API Audit Support',
        isActive: true,
        newPassword: tempAdminPassword,
        role: 'support',
      },
      method: 'PATCH',
      token: ownerToken,
    });

    let tempLogin = await request('/admin/auth/login', {
      body: { email: tempAdminEmail, password: tempAdminPassword },
      method: 'POST',
    });
    let tempToken = tempLogin.payload?.token;
    assert(tempToken, 'Temporary admin could not log in.');

    tempAdminPassword = 'AdminAudit789!';
    await request('/admin/auth/change-password', {
      body: { currentPassword: 'AdminAudit456!', newPassword: tempAdminPassword },
      method: 'POST',
      token: tempToken,
    });

    tempLogin = await request('/admin/auth/login', {
      body: { email: tempAdminEmail, password: tempAdminPassword },
      method: 'POST',
    });
    tempToken = tempLogin.payload?.token;
    assert(tempToken, 'Temporary admin could not log in after changing password.');
  });

  await check('Product media and product CRUD work', async () => {
    const formData = new FormData();
    formData.append('image', pngBlob(), 'audit-product.png');

    const upload = await request('/admin/uploads/product-image', {
      body: formData,
      expected: [201],
      method: 'POST',
      token: ownerToken,
    });
    tempProductImageUrl = upload.payload?.imageUrl;
    trackFile(upload.payload?.path);
    assert(tempProductImageUrl, 'Product image upload did not return an imageUrl.');

    const created = await request('/admin/products', {
      body: {
        badge: 'Audit',
        category: 'Accessories',
        description: 'Temporary product used by the API audit.',
        featured: true,
        imageUrl: tempProductImageUrl,
        name: 'API Audit Travel Case',
        price: 18500,
        stockQuantity: 8,
      },
      expected: [201],
      method: 'POST',
      token: ownerToken,
    });
    tempProductId = created.payload?.product?.id;
    trackProduct(tempProductId);
    assert(tempProductId, 'Creating a temporary product did not return an id.');

    const updated = await request(`/admin/products/${tempProductId}`, {
      body: {
        badge: 'Audited',
        category: 'Accessories',
        description: 'Updated temporary product used by the API audit.',
        featured: false,
        imageUrl: tempProductImageUrl,
        name: 'API Audit Travel Case Updated',
        price: 19250,
        stockQuantity: 8,
      },
      method: 'PATCH',
      token: ownerToken,
    });
    assert(updated.payload?.product?.name === 'API Audit Travel Case Updated', 'Product update did not persist.');

    const search = await request('/products', {
      query: { search: 'Travel Case Updated' },
    });
    assert(
      (search.payload?.products || []).some((product) => product.id === tempProductId),
      'Public product search did not return the temporary product.',
    );
  });

  await check('Payment config, cart, and checkout routes work', async () => {
    const payment = await request('/payments/config');
    paymentConfig = payment.payload?.paymentConfig;
    assert(paymentConfig?.bankTransfer?.enabled, 'Bank transfer must be enabled to audit order placement.');

    const emptyCart = await request('/cart', { query: { sessionId: sessions.cart } });
    assert((emptyCart.payload?.cart?.items || []).length === 0, 'Expected an empty cart before adding items.');

    const added = await request('/cart/items', {
      body: { productId: tempProductId, quantity: 1, sessionId: sessions.cart },
      expected: [201],
      method: 'POST',
    });
    assert((added.payload?.cart?.items || []).length === 1, 'Cart add did not create an item.');

    const updated = await request(`/cart/items/${tempProductId}`, {
      body: { quantity: 2, sessionId: sessions.cart },
      method: 'PATCH',
    });
    assert(updated.payload?.cart?.summary?.itemCount === 2, 'Cart update did not change quantity.');

    const removed = await request(`/cart/items/${tempProductId}`, {
      method: 'DELETE',
      query: { sessionId: sessions.cart },
    });
    assert((removed.payload?.cart?.items || []).length === 0, 'Cart delete did not remove the item.');

    await request('/checkout', {
      body: {},
      expected: [410],
      method: 'POST',
    });
  });

  await check('Paystack initialize and webhook behavior are correct', async () => {
    const expectedWebhookStatus = paymentConfig?.paystack?.enabled ? [401] : [503];

    if (paymentConfig?.paystack?.enabled) {
      await request('/cart/items', {
        body: { productId: tempProductId, quantity: 1, sessionId: sessions.paystack },
        expected: [201],
        method: 'POST',
      });

      const initialized = await request('/payments/paystack/initialize', {
        body: {
          customer: {
            address: '12 Audit Avenue',
            city: 'Lagos',
            country: 'Nigeria',
            email: primaryUser.email,
            name: 'API Audit Primary',
            phone: primaryUser.phoneNumber,
          },
          notes: 'Audit paystack initialization',
          sessionId: sessions.paystack,
        },
        method: 'POST',
        token: primaryToken,
      });

      trackPayment(initialized.payload?.reference);
      assert(initialized.payload?.authorizationUrl, 'Paystack initialize did not return an authorizationUrl.');
    } else {
      warnings.push('Paystack is disabled in runtime settings, so Paystack initialize was skipped.');
      console.log(`${SKIP} Paystack is disabled in runtime settings, so Paystack initialize was skipped.`);
    }

    await request('/payments/paystack/webhook', {
      body: {
        data: { reference: `audit-invalid-${STAMP}` },
        event: 'charge.success',
      },
      expected: expectedWebhookStatus,
      headers: { 'x-paystack-signature': 'invalid-signature' },
      method: 'POST',
    });
  });

  await check('Bank transfer order flow works end to end', async () => {
    await request('/cart/items', {
      body: { productId: tempProductId, quantity: 1, sessionId: sessions.cart },
      expected: [201],
      method: 'POST',
    });

    const formData = new FormData();
    formData.append('proof', pngBlob(), 'audit-proof.png');
    formData.append('sessionId', sessions.cart);
    formData.append('name', 'API Audit Primary');
    formData.append('email', primaryUser.email);
    formData.append('phone', primaryUser.phoneNumber);
    formData.append('address', '12 Audit Avenue');
    formData.append('city', 'Lagos');
    formData.append('country', 'Nigeria');
    formData.append('notes', 'Audit bank transfer order');

    const orderResponse = await request('/payments/bank-transfer/submit', {
      body: formData,
      expected: [201],
      method: 'POST',
      token: primaryToken,
    });

    orderNumber = orderResponse.payload?.order?.orderNumber;
    trackOrder(orderNumber);
    trackFile(orderResponse.payload?.order?.paymentProofPath);
    assert(orderNumber, 'Bank transfer submit did not return an order number.');

    await request(`/orders/${orderNumber}`, { expected: [403] });

    const publicLookup = await request(`/orders/${orderNumber}`, {
      query: { email: primaryUser.email },
    });
    assert(publicLookup.payload?.order?.orderNumber === orderNumber, 'Order email lookup returned the wrong order.');

    const customerAccount = await request('/auth/me', { token: primaryToken });
    assert(
      (customerAccount.payload?.orders || []).some((order) => order.orderNumber === orderNumber),
      'Customer account did not include the new bank transfer order.',
    );
  });

  await check('Admin order and user management endpoints work', async () => {
    await request(`/admin/orders/${orderNumber}`, {
      body: { status: 'unknown-status' },
      expected: [400],
      method: 'PATCH',
      token: ownerToken,
    });

    const updatedOrder = await request(`/admin/orders/${orderNumber}`, {
      body: {
        adminNote: 'Audit reviewed the order.',
        notifyCustomer: false,
        paymentReviewNote: 'Proof looks correct.',
        paymentStatus: 'paid',
        status: 'processing',
        trackingCarrier: 'DHL',
        trackingEventLocation: 'Lagos',
        trackingEventMessage: 'Order packed and queued for dispatch.',
        trackingEventStatus: 'processing',
        trackingNumber: 'AUDIT123456',
        trackingUrl: 'https://example.com/track/AUDIT123456',
      },
      method: 'PATCH',
      token: ownerToken,
    });
    assert(updatedOrder.payload?.order?.status === 'processing', 'Admin order update did not persist status.');

    await request(`/admin/orders/${orderNumber}/email`, {
      body: {
        message: 'Your order has moved into processing.',
        subject: `Update for ${orderNumber}`,
      },
      method: 'POST',
      token: ownerToken,
    });

    const account = await request('/auth/me', { token: primaryToken });
    const matchingOrder = (account.payload?.orders || []).find((order) => order.orderNumber === orderNumber);
    assert(matchingOrder?.status === 'processing', 'Updated order status did not appear in the customer account.');
    assert((matchingOrder?.trackingEvents || []).length > 0, 'Tracking events did not appear in the customer account.');

    await request(`/admin/users/${secondaryUserId}`, {
      body: {
        accountStatus: 'paused',
        emailVerified: false,
        fullName: secondaryUser.fullName,
        newsletterOptIn: false,
        phoneNumber: secondaryUser.phoneNumber,
      },
      expected: [400],
      method: 'PATCH',
      token: ownerToken,
    });

    const suspended = await request(`/admin/users/${secondaryUserId}`, {
      body: {
        accountStatus: 'suspended',
        emailVerified: false,
        fullName: secondaryUser.fullName,
        newsletterOptIn: false,
        phoneNumber: secondaryUser.phoneNumber,
      },
      method: 'PATCH',
      token: ownerToken,
    });
    assert(suspended.payload?.user?.accountStatus === 'suspended', 'User suspension did not persist.');

    await request('/auth/login', {
      body: { email: secondaryUser.email, password: secondaryUser.password },
      expected: [403],
      method: 'POST',
    });

    await request(`/admin/users/${secondaryUserId}/email`, {
      body: {
        message: 'Your account status changed during the audit.',
        subject: 'Audit message',
      },
      method: 'POST',
      token: ownerToken,
    });

    await request(`/admin/users/${secondaryUserId}`, {
      method: 'DELETE',
      token: ownerToken,
    });
  });

  await check('Temporary product can be deleted cleanly', async () => {
    await request(`/admin/products/${tempProductId}`, {
      method: 'DELETE',
      token: ownerToken,
    });
    state.productIds.delete(tempProductId);
  });
};

main()
  .then(async () => {
    console.log(`\n${PASS} API audit completed with ${passedChecks} passing checks.`);
    if (warnings.length > 0) {
      console.log(`${SKIP} ${warnings.length} warning(s) were recorded.`);
    }
  })
  .catch((error) => {
    console.error(`\n${FAIL} API audit failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await db.end().catch(() => {});
  });
