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

const critical = ['--ouch-glass-bg', '--ouch-surface', '--ouch-text', '--ouch-line', '--ouch-shadow-panel', '--ouch-hover', '--ouch-scrollbar-thumb', '--ouch-scrollbar-track']
for (const [i, set] of darkBlocks.entries()) {
  for (const c of critical) assert.ok(set.includes(c), `暗色块${i} 缺少 ${c}`)
}

// 带上 fallback 的写法 var(--x, #fff) 同样要算作「被引用」——
// 之前只匹配 var(--x) 的严格形式，--ouch-switch-* 因为写了 fallback 就漏检了，
// 结果暗色分支从未定义它，开关在两种主题下都退回到浅色常量。
const used = [...new Set([...css.matchAll(/var\((--ouch-[a-z0-9-]+)\s*[,)]/g)].map(m => m[1]))]
for (const v of used) assert.ok(lightVars.includes(v), `引用了未定义的变量 ${v}`)

// 开关的滑块/轨道必须是两个不同令牌，否则滑块和轨道同色就看不见了。
for (const c of ['--ouch-switch-track', '--ouch-switch-knob']) {
  assert.ok(lightVars.includes(c), `缺少开关令牌 ${c}`)
  for (const [i, set] of darkBlocks.entries()) {
    assert.ok(set.includes(c), `暗色块${i} 缺少开关令牌 ${c}`)
  }
}

// 注释里会刻意提到这些旧 API 作为反面教材，检查前先剥掉注释。
const code = css.replace(/\/\*[\s\S]*?\*\//g, '')

// :host-context() 只有 Chromium 实现，Firefox / Safari 会整条规则失效。
// 主题必须靠自定义属性继承跨 Shadow 边界，这里守住回归。
assert.ok(!/:host-context\s*\(/.test(code), ':host-context() 不受 Firefox / Safari 支持，请改用继承的自定义属性')

// 只写 ::-webkit-scrollbar 的话 Firefox 完全拿不到滚动条样式。
const hasStdScrollbar = /scrollbar-color\s*:/.test(code)
const hasWebkitScrollbar = /::-webkit-scrollbar/.test(code)
if (hasWebkitScrollbar) {
  assert.ok(hasStdScrollbar, '只写了 ::-webkit-scrollbar（Firefox 无样式），必须先用 scrollbar-color / scrollbar-width')
  const withoutFallback = code.replace(/@supports not \(scrollbar-color: auto\)\s*\{[\s\S]*?\n\}/g, '')
  assert.ok(
    /@supports not \(scrollbar-color: auto\)/.test(code),
    '::-webkit-scrollbar 必须包在 @supports not (scrollbar-color: auto) 里'
  )
  assert.ok(!/::-webkit-scrollbar/.test(withoutFallback), '::-webkit-scrollbar 不能出现在 @supports 回退块之外')
}

// 进度条伪元素不能合并成一条规则，浏览器会整条丢弃。
assert.ok(
  !/::-webkit-progress-value[^{]*,[\s\S]{0,120}::-moz-progress-bar/.test(code),
  '::-webkit-progress-value 与 ::-moz-progress-bar 不能写在同一组选择器里，否则整条规则失效'
)

console.log(`主题自检通过: ${lightVars.length} 个变量, ${darkBlocks.length} 个暗色分支, ${used.length} 个被引用`)
