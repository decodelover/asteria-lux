const db = require('./db');
const { ensureSchema, seedCatalog } = require('./schema');

const seedDatabase = async () => {
  try {
    console.log('Preparing database schema...');
    await ensureSchema();

    console.log('Seeding luxury catalog...');
    await seedCatalog();

    console.log('Database seeded successfully.');
  } catch (error) {
    console.error('Failed to seed database:', error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

seedDatabase();
