import { defineConfig } from 'vitest/config';

// Tests cover the pure logic layer (src/data/*) which has no Phaser/DOM
// dependency, so the lightweight 'node' environment is enough. Anything that
// touches localStorage stubs it in-test (see save.test.js).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
