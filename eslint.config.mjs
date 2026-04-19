import nextConfig from 'eslint-config-next';
import eslintConfigPrettier from 'eslint-config-prettier';

const config = [
  ...nextConfig,
  eslintConfigPrettier,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'src/db/migrations/**',
      'deploy/**',
    ],
  },
];

export default config;
