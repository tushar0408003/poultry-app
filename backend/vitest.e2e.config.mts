import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const testUri = process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/supplier_ledger_e2e';
if (!/test|e2e/i.test(testUri)) {
  throw new Error('Refusing to run e2e tests on a database without "test" or "e2e" in its URI (it is dropped)');
}

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    // Set before any test file is imported, because ConfigModule reads env on import.
    env: {
      MONGODB_URI: testUri,
      JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'e2e-password',
      BUSINESS_TZ_OFFSET_MINUTES: '330',
    },
  },
});
