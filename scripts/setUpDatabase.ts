import { createTables } from '../src/db/schema';

async function bootstrap() {
  try {
    await createTables();
    console.log('Tables created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to create tables:', err);
    process.exit(1);
  }
}

bootstrap();
