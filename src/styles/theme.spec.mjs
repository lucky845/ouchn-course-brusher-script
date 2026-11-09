/**
 * 主题令牌守卫：新增面板样式时若引用了未定义变量、或暗色分支漏覆盖关键变量，这里直接失败。
 * 跑法：node src/styles/theme.spec.mjs（已接进 npm run test:theme）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.join(here, 'theme.css'), 'utf8')

const vars = (block) => [...block.matchAll(/(--ouch-[a-z0-9-]+):/g)].map(m => m[1])
const lightVars = vars(css.split('/* 暗色')[0])
const darkBlocks = [...css.split('/* 暗色')[1].split('/* ---------- 悬浮球')[0].matchAll(/\{([\s\S]*?)\}/g)].map(m => vars(m[1]))

assert.ok(lightVars.length > 20, `浅色变量过少: ${lightVars.length}`)
assert.ok(darkBlocks.length >= 2, `暗色分支缺失: ${darkBlocks.length}`)

const critical = ['--ouch-glass-bg', '--ouch-surface', '--ouch-text', '--ouch-line', '--ouch-shadow-panel', '--ouch-hover']
for (const [i, set] of darkBlocks.entries()) {
  for (const c of critical) assert.ok(set.includes(c), `暗色块${i} 缺少 ${c}`)
}

const used = [...new Set([...css.matchAll(/var\((--ouch-[a-z0-9-]+)\)/g)].map(m => m[1]))]
for (const v of used) assert.ok(lightVars.includes(v), `引用了未定义的变量 ${v}`)

console.log(`主题自检通过: ${lightVars.length} 个变量, ${darkBlocks.length} 个暗色分支, ${used.length} 个被引用`)
