import eslintPluginTs from '@typescript-eslint/eslint-plugin';
import eslintParserTs from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

const recommendedConfig =
  eslintPluginTs.configs.recommended ?? eslintPluginTs.configs['recommended'];

const typeCheckedConfig =
  eslintPluginTs.configs.recommendedTypeChecked ??
  eslintPluginTs.configs['recommended-requiring-type-checking'] ??
  eslintPluginTs.configs['recommended-type-checked'];

const configArray = [
  {
    ignores: ['dist', 'coverage', '**/*.d.ts', '**/.next/**', '**/.prisma/**', '**/.vitepress/cache/**', 'docs/.vitepress/theme/**', '**/seed.ts', '**/tsup.config.ts', 'vitest.config.ts'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: eslintParserTs,
      parserOptions: {
        project: [
          './tsconfig.base.json',
          './packages/*/tsconfig.json',
          './packages/*/tsconfig.build.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': eslintPluginTs,
    },
    rules: {
      ...(recommendedConfig?.rules ?? {}),
      ...(typeCheckedConfig?.rules ?? {}),
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
  prettierConfig,
];

export default configArray;
