import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default tseslint.config(
  { ignores: ['dist/**', 'src/lib/collection/three.mjs', 'src/lib/motion-pack/vendor/**'] }, ...tseslint.configs.recommended,
  // Imported artwork is kept source-faithful; these two upstream idioms are legal JS.
  // Our adapter, controls and runtime retain the normal rules.
  { files: ['src/lib/studio-library/source/*.mjs', 'src/lib/motion-pack/{captions,strata,contour,mosaic,elements,title-effects}.mjs', 'src/lib/collection/*-renderer.mjs', 'src/lib/collection/{forged,prism-bloom,ink-riot,porcelain-flow,laser-trace,velvet-pulse,magma-core,abyssal-pearl}.mjs'], rules: {
    '@typescript-eslint/no-unused-vars': 'off', '@typescript-eslint/no-unused-expressions': 'off',
  } },
  { files: ['src/**/*.{ts,tsx}'], plugins: { 'react-hooks': hooks }, rules: {
    'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  } },
);
