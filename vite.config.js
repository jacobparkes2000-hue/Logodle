import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'copy-quiz-days',
    closeBundle() {
      cpSync(resolve('days'), resolve('dist/days'), { recursive: true });
    }
  }]
});
