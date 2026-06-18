import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync, writeFileSync } from 'fs'

const USERSCRIPT_HEADER = `// ==UserScript==
// @name         国家开放大学实验学院自动刷课脚本
// @namespace    https://github.com/lucky845
// @homepageURL   https://github.com/lucky845/ouchn-course-brusher-script
// @source        https://github.com/lucky845/ouchn-course-brusher-script
// @version       2.1.1
// @description  国家开放大学实验学院自动刷课脚本 - Vue3 版本，支持题目提取和学生首页助手(github 仓库: https://github.com/lucky845/ouchn-course-brusher-script)
// @author       lucky845
// @match        https://moodle.syxy.ouchn.cn/mod/*
// @match        https://student.syxy.ouchn.cn/*
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @run-at       document-idle
// @noframes
// ==/UserScript==

`

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'userscript-header',
      writeBundle() {
        const outputPath = resolve(__dirname, 'dist/ouchn-course-brusher-vue.user.js')
        try {
          const content = readFileSync(outputPath, 'utf-8')
          let cleanContent = content
            .replace(/^\(function\([^)]*\)\{/, '')
            .replace(/\}\)\(.*?\);?$/, '')
            .trim()
          
          const finalContent = USERSCRIPT_HEADER + '\n(function(){\n' + cleanContent + '\n})()'
          writeFileSync(outputPath, finalContent, 'utf-8')
          console.log('[Build] Userscript header injected successfully')
        } catch (e) {
          console.error('[Build] Error injecting header:', e)
        }
      }
    }
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false, // 禁用压缩，保持代码格式化，避免油猴脚本解析错误
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') },
      output: {
        format: 'iife',
        name: 'OuchnCourseBrusher',
        entryFileNames: 'ouchn-course-brusher-vue.user.js',
      },
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  }
})