import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, type App } from 'vue'
import RemindersTab from './RemindersTab.vue'

function mountTab(onAddReminder = vi.fn()): { app: App, root: HTMLElement } {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createApp(defineComponent({
    render: () => h(RemindersTab, {
      notifications: [],
      reminders: [],
      onAddReminder
    })
  }))
  app.mount(root)
  return { app, root }
}

function q<T extends Element>(root: HTMLElement, sel: string): T {
  const el = root.querySelector<T>(sel)
  if (!el) throw new Error('missing: ' + sel)
  return el
}

describe('RemindersTab 添加提醒对话框', () => {
  let mounted: { app: App, root: HTMLElement } | null = null

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    mounted?.app.unmount()
    mounted = null
    document.body.innerHTML = ''
  })

  it('用原生 <dialog> 且默认关闭，点「添加提醒」走 showModal', async () => {
    const onAdd = vi.fn()
    mounted = mountTab(onAdd)
    const dialog = q<HTMLDialogElement>(mounted.root, 'dialog.reminder-dialog')

    expect(dialog.open).toBe(false)

    q<HTMLButtonElement>(mounted.root, '.action-btn.primary').click()
    await nextTick()

    expect(dialog.open).toBe(true)
  })

  it('取消后关闭，并丢弃草稿（下次打开是干净表单）', async () => {
    mounted = mountTab()
    const dialog = q<HTMLDialogElement>(mounted.root, 'dialog.reminder-dialog')

    q<HTMLButtonElement>(mounted.root, '.action-btn.primary').click()
    await nextTick()

    const title = q<HTMLInputElement>(mounted.root, '#reminder-title')
    title.value = '写了一半的提醒'
    title.dispatchEvent(new Event('input'))
    await nextTick()

    q<HTMLButtonElement>(mounted.root, '.btn-cancel').click()
    await nextTick()
    expect(dialog.open).toBe(false)

    // 重新打开：标题必须已被清空，不能把上次取消的草稿带回来
    q<HTMLButtonElement>(mounted.root, '.action-btn.primary').click()
    await nextTick()
    expect(q<HTMLInputElement>(mounted.root, '#reminder-title').value).toBe('')
  })

  it('确定后提交数据并重置表单', async () => {
    const onAdd = vi.fn()
    mounted = mountTab(onAdd)
    const dialog = q<HTMLDialogElement>(mounted.root, 'dialog.reminder-dialog')

    q<HTMLButtonElement>(mounted.root, '.action-btn.primary').click()
    await nextTick()

    const title = q<HTMLInputElement>(mounted.root, '#reminder-title')
    title.value = '完成测验'
    title.dispatchEvent(new Event('input'))
    await nextTick()

    q<HTMLButtonElement>(mounted.root, '.btn-confirm').click()
    await nextTick()

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd.mock.calls[0][0]).toMatchObject({ title: '完成测验', type: 'daily' })
    expect(dialog.open).toBe(false)

    q<HTMLButtonElement>(mounted.root, '.action-btn.primary').click()
    await nextTick()
    expect(q<HTMLInputElement>(mounted.root, '#reminder-title').value).toBe('')
  })

  it('标题为空时不提交', async () => {
    const onAdd = vi.fn()
    mounted = mountTab(onAdd)

    q<HTMLButtonElement>(mounted.root, '.action-btn.primary').click()
    await nextTick()
    q<HTMLButtonElement>(mounted.root, '.btn-confirm').click()
    await nextTick()

    expect(onAdd).not.toHaveBeenCalled()
  })

  it('每个表单控件都有可关联的 label', async () => {
    mounted = mountTab()
    q<HTMLButtonElement>(mounted.root, '.action-btn.primary').click()
    await nextTick()

    for (const id of ['reminder-title', 'reminder-type', 'reminder-time-daily']) {
      const field = mounted.root.querySelector('#' + id)
      if (!field) continue
      const label = mounted.root.querySelector(`label[for="${id}"]`)
      expect(label, id + ' 缺少 label[for]').toBeTruthy()
    }
  })
})
