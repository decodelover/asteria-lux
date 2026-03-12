require('dotenv').config();

const { Pool } = require('pg');

const parseBoolean = (value) => String(value).toLowerCase() === 'true';

const shouldUseSsl =
  parseBoolean(process.env.DB_SSL) ||
  (process.env.NODE_ENV === 'production' && Boolean(process.env.DATABASE_URL));

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT || 5432),
      ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool({
  ...poolConfig,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 10000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
});

pool.on('error', (error) => {
  console.error('PostgreSQL pool error:', error);
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

const testConnection = async () => {
  const client = await pool.connect();

  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
};

const end = () => pool.end();

module.exports = {
  end,
  getClient,
  pool,
  query,
  testConnection,
};
