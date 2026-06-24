// Defaults for CI and local `pnpm test` when .env is absent.
// Must match .github/workflows/ci.yml postgres service (POSTGRES_USER/PASSWORD).
process.env.DATABASE_URL ||= "postgresql://postgres:postgres@localhost:5432/acbu_test";
process.env.MONGODB_URI ||= "mongodb://localhost:27017/acbu_test";
process.env.RABBITMQ_URL ||= "amqp://guest:guest@localhost:5672";
process.env.JWT_SECRET ||= "test-jwt-secret-for-ci";
process.env.API_KEY_SALT ||= "test-api-key-salt";

// Disconnect Prisma after the entire test suite to prevent open handles.
afterAll(async () => {
  const { prisma } = await import("../src/config/database");
  await prisma.$disconnect();
});
