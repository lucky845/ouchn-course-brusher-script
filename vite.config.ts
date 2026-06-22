import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'

const USERSCRIPT_HEADER = `// ==UserScript==
// @name         国家开放大学实验学院自动刷课脚本
// @namespace    https://github.com/lucky845
// @homepageURL   https://github.com/lucky845/ouchn-course-brusher-script
// @source        https://github.com/lucky845/ouchn-course-brusher-script
// @version       2.2.2
// @description  国家开放大学实验学院自动刷课脚本 - Vue3 版本，支持题目提取、学生首页助手和课程详情页助手(github 仓库: https://github.com/lucky845/ouchn-course-brusher-script)
// @author       lucky845
// @match        https://moodle.syxy.ouchn.cn/mod/*
// @match        https://moodle.syxy.ouchn.cn/course/*
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
      name: 'userscript-header-and-css-injector',
      // 使用 closeBundle 确保在所有代码压缩切行完毕后再进行合并
      closeBundle() {
        const distDir = resolve(__dirname, 'dist')
        const outputPath = resolve(distDir, 'ouchn-course-brusher-vue.user.js')
        // 根据你当前的构建产物名称，Vite 默认可能会生成 style.css
        const cssPath = resolve(distDir, 'style.css') 
        
        try {
          let cssContent = ''
          
          // 1. 如果抽离出了单独的 CSS 文件，读取它并将其转化为油猴的 GM_addStyle
          if (existsSync(cssPath)) {
            const rawCss = readFileSync(cssPath, 'utf-8')
            // 将内联样式代码进行安全的压缩和特殊字符转义
            const safeCss = rawCss.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
            cssContent = `\n;(function(){ if(typeof GM_addStyle !== 'undefined') { GM_addStyle(\`${safeCss}\`); } })();\n`
            
            // 读取完后删除掉 dist 下独立的 css 文件，保持目录干净
            unlinkSync(cssPath)
          }
          
          // 2. 读取已经压缩好的核心 JS 代码
          const jsContent = readFileSync(outputPath, 'utf-8')
          
          // 3. 将【元数据】+【抽离出的 CSS 样式】+【JS主体】完美融合成一个纯净单文件
          const finalContent = USERSCRIPT_HEADER + '\n' + cssContent + '\n' + jsContent.trim()
          
          writeFileSync(outputPath, finalContent, 'utf-8')
          console.log('[Build] Userscript header and CSS injected into single file successfully!')
        } catch (e) {
          console.error('[Build] Error packing single file userscript:', e)
        }
      }
    }
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser', 
    terserOptions: {
      compress: {
        drop_console: false, 
        drop_debugger: true,
      },
      mangle: true, 
      format: {
        max_line_len: 500, // 核心：每 500 个字符强制换行
      },
    },
    // 注意：这里需要改为 true，以便让 Vite 把 CSS 正常生成出来供我们插件读取注入
    cssCodeSplit: true, 
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') },
      output: {
        format: 'iife',
        name: 'OuchnCourseBrusher',
        entryFileNames: 'ouchn-course-brusher-vue.user.js',
        // 强制固定生成的 CSS 文件名为 style.css 方便精准读取
        assetFileNames: 'style.css',
        inlineDynamicImports: true, 
      },
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  }
})
