import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import stylistic from '@stylistic/eslint-plugin'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'legacy/**',
      'node_modules/**',
      '*.d.ts',
      'vite.config.ts',
      'vite.config.*.ts',
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylistic,

  ...vue.configs['flat/recommended'],

  {
    files: ['**/*.{ts,tsx,mts,cts,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
        projectService: {
          allowDefaultProject: ['*.config.*'],
          defaultProject: './tsconfig.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        GM_info: 'readonly',
        GM_setValue: 'readonly',
        GM_getValue: 'readonly',
        GM_deleteValue: 'readonly',
        GM_listValues: 'readonly',
        GM_addValueChangeListener: 'readonly',
        GM_removeValueChangeListener: 'readonly',
        GM_setClipboard: 'readonly',
        GM_notification: 'readonly',
        GM_openInTab: 'readonly',
        GM_xmlhttpRequest: 'readonly',
        GM_fetch: 'readonly',
        unsafeWindow: 'writable',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
      },
    },
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'log', 'info'] }],
      'no-debugger': 'warn',
      'no-alert': 'warn',
      'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: true }],
      'no-var': 'error',
      eqeqeq: ['error', 'smart'],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': 'off',
      'no-case-declarations': 'off',
      'no-useless-escape': 'warn',

      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/class-literal-property-style': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/require-await': 'off',

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
        },
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: 'variable',
          types: ['function'],
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'variableLike',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: ['function', 'method'],
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: ['typeLike', 'class', 'interface', 'typeAlias', 'enum', 'typeParameter'],
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE'],
        },
        {
          selector: 'property',
          format: null,
        },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'off',
        { accessibility: 'explicit', overrides: { constructors: 'no-public' } },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/no-inferrable-types': ['warn', { ignoreParameters: true, ignoreProperties: true }],
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-empty-interface': ['warn', { allowSingleExtends: true }],
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],

      'vue/multi-word-component-names': 'off',
      'vue/component-name-in-template-casing': [
        'error',
        'PascalCase',
        {
          registeredComponentsOnly: false,
          ignores: ['/^teleport$/i', '/^keep-alive$/i', '/^slot$/i', '/^component$/i', '/^transition$/i', '/^transition-group$/i'],
        },
      ],
      'vue/prop-name-casing': ['error', 'camelCase'],
      'vue/component-definition-name-casing': ['error', 'PascalCase'],
      'vue/component-tags-order': [
        'error',
        { order: ['template', 'script', 'style'] },
      ],
      'vue/html-self-closing': [
        'error',
        {
          html: { void: 'always', normal: 'never', component: 'always' },
          svg: 'always',
          math: 'always',
        },
      ],
      'vue/max-attributes-per-line': [
        'warn',
        { singleline: { max: 3 }, multiline: { max: 1 } },
      ],
      'vue/html-closing-bracket-newline': ['error', { singleline: 'never', multiline: 'always' }],
      'vue/html-indent': ['error', 2, { attribute: 1, baseIndent: 1, closeBracket: 0 }],
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'warn',
      'vue/block-order': ['error', { order: ['template', 'script', 'style'] }],
      'vue/no-v-html': 'warn',
      'vue/attributes-order': [
        'error',
        {
          order: [
            'DEFINITION',
            'LIST_RENDERING',
            'CONDITIONALS',
            'RENDER_MODIFIERS',
            'GLOBAL',
            'UNIQUE',
            'TWO_WAY_BINDING',
            'OTHER_DIRECTIVES',
            'OTHER_ATTR',
            'EVENTS',
            'CONTENT',
          ],
          alphabetical: false,
        },
      ],
      'vue/v-on-event-hyphenation': ['error', 'always', { autofix: true }],
      'vue/require-default-prop': 'off',
      'vue/require-prop-types': 'off',

      '@stylistic/indent': ['error', 2, { SwitchCase: 1, ignoredNodes: ['TemplateLiteral *'] }],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/max-len': ['warn', { code: 140, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxBOF: 0, maxEOF: 1 }],
      '@stylistic/space-before-function-paren': [
        'error',
        { anonymous: 'always', named: 'never', asyncArrow: 'always' },
      ],
      '@stylistic/arrow-parens': ['error', 'as-needed', { requireForBlockBody: true }],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
      curly: ['error', 'multi-line'],
      '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
      '@stylistic/object-curly-spacing': ['error', 'always', { arraysInObjects: false, objectsInObjects: false }],
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true, mode: 'strict' }],
      '@stylistic/type-annotation-spacing': ['error', { before: false, after: true }],
      '@stylistic/member-delimiter-style': [
        'error',
        {
          multiline: { delimiter: 'none', requireLast: false },
          singleline: { delimiter: 'comma', requireLast: false },
        },
      ],
    },
  },

  {
    files: ['vite.config.ts', '*.config.{js,ts,mjs,cjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off',
    },
  },
)
