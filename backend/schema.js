const crypto = require('crypto');

const db = require('./db');
const { PRODUCT_CATALOG } = require('./catalog');
const { hashPassword } = require('./security');

const FREE_SHIPPING_THRESHOLD = 15000;
const STANDARD_SHIPPING_FEE = 250;

const toMoney = (value) => Number.parseFloat(Number(value).toFixed(2));

const calculateShippingFee = (subtotal) => {
  if (subtotal <= 0) {
    return 0;
  }

  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
};

const calculateCartSummary = (items) => {
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = toMoney(items.reduce((total, item) => total + item.lineTotal, 0));
  const shippingFee = calculateShippingFee(subtotal);

  return {
    itemCount,
    subtotal,
    shippingFee,
    total: toMoney(subtotal + shippingFee),
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  };
};

const mapProductRow = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  price: toMoney(row.price),
  category: row.category,
  imageUrl: row.image_url,
  stockQuantity: row.stock_quantity,
  badge: row.badge,
  featured: row.featured,
  createdAt: row.created_at,
});

const mapCartRow = (row) => ({
  cartItemId: row.cart_item_id,
  productId: row.product_id,
  name: row.name,
  description: row.description,
  category: row.category,
  price: toMoney(row.price),
  imageUrl: row.image_url,
  stockQuantity: row.stock_quantity,
  badge: row.badge,
  featured: row.featured,
  quantity: row.quantity,
  lineTotal: toMoney(row.line_total),
});

const mapOrderRow = (row) => ({
  id: row.id,
  orderNumber: row.order_number,
  sessionId: row.session_id,
  userId: row.user_id,
  customerName: row.customer_name,
  customerEmail: row.customer_email,
  customerPhone: row.customer_phone,
  shippingAddress: row.shipping_address,
  shippingCity: row.shipping_city,
  shippingCountry: row.shipping_country,
  notes: row.notes,
  status: row.status,
  paymentMethod: row.payment_method,
  paymentProvider: row.payment_provider,
  paymentReference: row.payment_reference,
  paymentStatus: row.payment_status,
  paymentCurrency: row.payment_currency,
  paymentProofPath: row.payment_proof_path,
  paymentProofName: row.payment_proof_name,
  paymentReviewNote: row.payment_review_note,
  paymentReviewedAt: row.payment_reviewed_at,
  paymentReviewedByAdminId: row.payment_reviewed_by_admin_id,
  trackingCarrier: row.tracking_carrier,
  trackingNumber: row.tracking_number,
  trackingUrl: row.tracking_url,
  estimatedDeliveryAt: row.estimated_delivery_at,
  shippedAt: row.shipped_at,
  paidAt: row.paid_at,
  subtotal: toMoney(row.subtotal),
  shippingFee: toMoney(row.shipping_fee),
  total: toMoney(row.total),
  adminNote: row.admin_note,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapUserRow = (row) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  emailVerified: Boolean(row.email_verified_at),
  emailVerifiedAt: row.email_verified_at,
  accountStatus: row.account_status || 'active',
  newsletterOptIn: row.newsletter_opt_in,
  phoneNumber: row.phone_number,
  defaultCountry: row.default_country,
  defaultCity: row.default_city,
  defaultAddress: row.default_address,
  lastKnownLocation: row.last_known_location,
  lastKnownTimezone: row.last_known_timezone,
  lastKnownLatitude:
    row.last_known_latitude === null || row.last_known_latitude === undefined
      ? null
      : Number(row.last_known_latitude),
  lastKnownLongitude:
    row.last_known_longitude === null || row.last_known_longitude === undefined
      ? null
      : Number(row.last_known_longitude),
  createdAt: row.created_at,
  lastLoginAt: row.last_login_at,
  updatedAt: row.updated_at,
});

const ensureSchema = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
      category VARCHAR(100) NOT NULL,
      image_url TEXT NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      badge VARCHAR(80),
      featured BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS badge VARCHAR(80),
      ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(180) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      account_status VARCHAR(20) NOT NULL DEFAULT 'active',
      newsletter_opt_in BOOLEAN NOT NULL DEFAULT false,
      phone_number VARCHAR(40),
      default_country VARCHAR(120),
      default_city VARCHAR(120),
      default_address TEXT,
      last_known_location VARCHAR(180),
      last_known_timezone VARCHAR(80),
      last_known_latitude NUMERIC(9, 6),
      last_known_longitude NUMERIC(9, 6),
      email_verified_at TIMESTAMP,
      verification_token_hash TEXT,
      verification_token_expires_at TIMESTAMP,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS phone_number VARCHAR(40),
      ADD COLUMN IF NOT EXISTS default_country VARCHAR(120),
      ADD COLUMN IF NOT EXISTS default_city VARCHAR(120),
      ADD COLUMN IF NOT EXISTS default_address TEXT,
      ADD COLUMN IF NOT EXISTS last_known_location VARCHAR(180),
      ADD COLUMN IF NOT EXISTS last_known_timezone VARCHAR(80),
      ADD COLUMN IF NOT EXISTS last_known_latitude NUMERIC(9, 6),
      ADD COLUMN IF NOT EXISTS last_known_longitude NUMERIC(9, 6),
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS verification_token_hash TEXT,
      ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(180) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(40) NOT NULL DEFAULT 'owner',
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      setting_key VARCHAR(80) PRIMARY KEY,
      setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      full_name VARCHAR(180),
      source VARCHAR(80) NOT NULL DEFAULT 'website',
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(180) NOT NULL,
      email VARCHAR(255) NOT NULL,
      subject VARCHAR(180) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(120) NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (session_id, product_id)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(40) NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      session_id VARCHAR(120) NOT NULL,
      customer_name VARCHAR(160) NOT NULL,
      customer_email VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(40),
      shipping_address TEXT NOT NULL,
      shipping_city VARCHAR(120) NOT NULL,
      shipping_country VARCHAR(120) NOT NULL,
      notes TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
      payment_method VARCHAR(30) NOT NULL DEFAULT 'manual',
      payment_provider VARCHAR(40),
      payment_reference VARCHAR(120),
      payment_status VARCHAR(40) NOT NULL DEFAULT 'pending',
      payment_currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      payment_proof_path TEXT,
      payment_proof_name VARCHAR(255),
      payment_review_note TEXT,
      payment_reviewed_at TIMESTAMP,
      payment_reviewed_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
      paid_at TIMESTAMP,
      admin_note TEXT,
      subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
      shipping_fee NUMERIC(10, 2) NOT NULL CHECK (shipping_fee >= 0),
      total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(40),
      ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(120),
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(40) NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS payment_currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      ADD COLUMN IF NOT EXISTS payment_proof_path TEXT,
      ADD COLUMN IF NOT EXISTS payment_proof_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS payment_review_note TEXT,
      ADD COLUMN IF NOT EXISTS payment_reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS payment_reviewed_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS tracking_carrier VARCHAR(120),
      ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(120),
      ADD COLUMN IF NOT EXISTS tracking_url TEXT,
      ADD COLUMN IF NOT EXISTS estimated_delivery_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS admin_note TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS payment_attempts (
      id SERIAL PRIMARY KEY,
      reference VARCHAR(120) NOT NULL UNIQUE,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      session_id VARCHAR(120) NOT NULL,
      payment_method VARCHAR(30) NOT NULL,
      provider VARCHAR(40) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'initialized',
      access_code VARCHAR(120),
      authorization_url TEXT,
      customer_name VARCHAR(160) NOT NULL,
      customer_email VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(40),
      shipping_address TEXT NOT NULL,
      shipping_city VARCHAR(120) NOT NULL,
      shipping_country VARCHAR(120) NOT NULL,
      notes TEXT,
      subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
      shipping_fee NUMERIC(10, 2) NOT NULL CHECK (shipping_fee >= 0),
      total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
      currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      items_json JSONB NOT NULL,
      gateway_response JSONB,
      paid_at TIMESTAMP,
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name VARCHAR(255) NOT NULL,
      product_category VARCHAR(100) NOT NULL,
      unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0),
      image_url TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_tracking_events (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      created_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
      status VARCHAR(40) NOT NULL,
      message TEXT NOT NULL,
      location VARCHAR(180),
      occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query('CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);');
  await db.query('CREATE INDEX IF NOT EXISTS idx_products_featured ON products (featured);');
  await db.query('CREATE INDEX IF NOT EXISTS idx_admins_email ON admins (email);');
  await db.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);');
  await db.query(
    'CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers (email);',
  );
  await db.query(
    'CREATE INDEX IF NOT EXISTS idx_cart_items_session_id ON cart_items (session_id);',
  );
  await db.query('CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders (order_number);');
  await db.query('CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders (session_id);');
  await db.query('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);');
  await db.query('CREATE INDEX IF NOT EXISTS idx_order_tracking_events_order_id ON order_tracking_events (order_id);');
  await db.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders (payment_reference) WHERE payment_reference IS NOT NULL;',
  );
  await db.query(
    'CREATE INDEX IF NOT EXISTS idx_payment_attempts_reference ON payment_attempts (reference);',
  );
  await db.query(
    'CREATE INDEX IF NOT EXISTS idx_payment_attempts_user_id ON payment_attempts (user_id);',
  );
  await db.query(
    'CREATE INDEX IF NOT EXISTS idx_payment_attempts_session_id ON payment_attempts (session_id);',
  );

  const adminEmail = String(process.env.ADMIN_EMAIL || 'owner@local-bootstrap.invalid').trim().toLowerCase();
  const adminName = String(process.env.ADMIN_NAME || 'Store Owner').trim() || 'Store Owner';
  const configuredAdminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
  const generatedAdminPassword = crypto.randomBytes(18).toString('base64url');
  const adminPassword = configuredAdminPassword || generatedAdminPassword;
  const existingAdminResult = await db.query('SELECT id FROM admins WHERE email = $1 LIMIT 1;', [
    adminEmail,
  ]);

  if (existingAdminResult.rowCount === 0) {
    const passwordHash = await hashPassword(adminPassword);

    await db.query(
      `
        INSERT INTO admins (full_name, email, password_hash, role, is_active)
        VALUES ($1, $2, $3, 'owner', true);
      `,
      [adminName, adminEmail, passwordHash],
    );

    if (!configuredAdminPassword) {
      console.warn(
        `Owner admin created for ${adminEmail} with a generated one-time password. Set ADMIN_PASSWORD before bootstrap or change it immediately from the admin dashboard. Temporary password: ${generatedAdminPassword}`,
      );
    }
  }
};

const seedCatalog = async () => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    await client.query(
      'TRUNCATE TABLE payment_attempts, order_items, orders, cart_items, products RESTART IDENTITY CASCADE;',
    );

    for (const product of PRODUCT_CATALOG) {
      await client.query(
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
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `,
        [
          product.name,
          product.description,
          product.price,
          product.category,
          product.imageUrl,
          product.stockQuantity,
          product.badge,
          product.featured,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE,
  calculateCartSummary,
  calculateShippingFee,
  ensureSchema,
  mapCartRow,
  mapOrderRow,
  mapProductRow,
  mapUserRow,
  seedCatalog,
  toMoney,
};
