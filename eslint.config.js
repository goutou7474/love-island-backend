import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist'],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
)
