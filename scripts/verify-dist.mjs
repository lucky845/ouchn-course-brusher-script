#!/usr/bin/env node
// 产物自检：closeBundle 是 fail-open 的最后一道闸门，
// 这里断言 UserScript 头、@version 与 package.json 一致、CSS 已注入，任一不满足即 exit 1。
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distPath = resolve(root, 'dist/ouchn-course-brusher-vue.user.js')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

const errors = []
let content = ''
try {
  content = readFileSync(distPath, 'utf8')
} catch (e) {
  errors.push(`产物不存在: ${distPath}`)
}

if (!errors.length) {
  const lines = content.split('\n')
  if (lines[0].trim() !== '// ==UserScript==') errors.push(`首行不是 UserScript 头，实际: ${lines[0].slice(0, 40)}`)
  if (!content.includes('// ==/UserScript==')) errors.push('缺少 UserScript 尾部标记')

  const version = /\/\/ @version\s+(\S+)/.exec(content)?.[1]
  if (!version) errors.push('缺少 @version')
  else if (version !== pkg.version) errors.push(`@version=${version} 与 package.json=${pkg.version} 不一致`)

  if (!content.includes('window.__OCHN_CSS__')) errors.push('缺少全局 CSS 注入（window.__OCHN_CSS__），shadow root 将无样式')

  const gzipSize = gzipSync(content).length
  if (gzipSize > 120 * 1024) errors.push(`gzip 体积异常: ${(gzipSize / 1024).toFixed(1)} kB`)

  console.log(`产物: ${content.length} B / gzip ${(gzipSize / 1024).toFixed(2)} kB, @version ${version}`)
}

if (errors.length) {
  console.error('产物自检失败:')
  for (const e of errors) console.error(' - ' + e)
  process.exit(1)
}
console.log('产物自检通过')
