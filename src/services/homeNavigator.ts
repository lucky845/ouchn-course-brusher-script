import type { CourseInfo, SemesterInfo } from '../types'

export class HomeNavigatorService {
  private semesters: SemesterInfo[] = []
  private seenNames = new Set<string>()

  extractSemesters(): SemesterInfo[] {
    this.semesters = []
    this.seenNames.clear()
    
    try {
      // 根据实际 DOM 结构：学期使用 .card，课程使用 .card-body
      const semesterCards = document.querySelectorAll('.card')
      
      if (semesterCards.length > 0) {
        semesterCards.forEach((card) => {
          this.extractFromCard(card as HTMLElement)
        })
      }
      
      if (this.semesters.length === 0) {
        this.extractByTextMatching()
      }
    } catch (e) {
      console.warn('[HomeNavigator] 提取学期信息失败', e)
    }
    
    return this.semesters
  }

  private extractFromCard(card: HTMLElement): void {
    // 查找学期标题
    const header = card.querySelector('.card-header')
    if (!header) return
    
    const titleEl = header.querySelector('.card-title, h3, h4, h5, h6')
    const headerText = titleEl?.textContent?.trim() || ''
    
    // 判断是否为当前学期 - 只检查标题开头是否为"本学期"或"当前学期"
    const isCurrent = headerText.startsWith('本学期') || headerText.startsWith('当前学期')

    // 提取学期名称
    let semesterName = headerText
      .replace(/（.*$/, '')  // 移除中文括号及后面内容
      .replace(/\(.*\)/, '')  // 移除英文括号及后面内容
      .trim()
    
    if (!semesterName) {
      semesterName = isCurrent ? '本学期课程' : '其他学期'
    }

    // 查找课程列表（.card-body 是课程项）
    const courseBodies = card.querySelectorAll(':scope > .card-body, .collapse .card-body, .collapse.show .card-body')
    const courses: CourseInfo[] = []
    
    courseBodies.forEach((body) => {
      const course = this.extractCourseFromBody(body as HTMLElement)
      if (course && course.name && !this.seenNames.has(course.name)) {
        this.seenNames.add(course.name)
        courses.push(course)
      }
    })
    
    if (courses.length > 0) {
      this.semesters.push({
        name: semesterName,
        isCurrent,
        courses,
      })
    }
  }

  private extractCourseFromBody(body: HTMLElement): CourseInfo | null {
    const course: CourseInfo = {
      name: '',
      progress: 0,
      isCompleted: false,
      pendingTasks: 0,
      credits: 0,
      score: 0,
      examType: '',
      hasHomework: false,
    }
    
    // 提取课程名称（.course-title h3）
    const titleEl = body.querySelector('.course-title h3, .course-title, h3')
    if (titleEl) {
      course.name = titleEl.textContent?.trim() || ''
    }
    
    if (!course.name) return null
    
    // 提取封面
    const imgEl = body.querySelector('img[src]') as HTMLImageElement
    if (imgEl && imgEl.src && !imgEl.src.includes('placeholder')) {
      course.coverUrl = imgEl.src
    }
    
    // 提取学分
    const text = body.textContent || ''
    const creditsMatch = text.match(/学分[：:]\s*(\d+)/)
    if (creditsMatch) {
      course.credits = parseInt(creditsMatch[1])
    }
    
    // 提取形考成绩
    const scoreMatch = text.match(/形考总成绩[：:]\s*(\d+)/)
    if (scoreMatch) {
      course.score = parseInt(scoreMatch[1])
    }
    
    // 提取考试形式
    const examMatch = text.match(/考试形式[：:]\s*([^\s形考学学分]+)/)
    if (examMatch) {
      course.examType = examMatch[1].trim()
    }
    
    // 提取进度
    const progressBar = body.querySelector('.progress-bar[style*="width"]')
    if (progressBar) {
      const style = progressBar.getAttribute('style') || ''
      const widthMatch = style.match(/width:\s*(\d+(?:\.\d+)?)%/)
      if (widthMatch) {
        course.progress = Math.round(parseFloat(widthMatch[1]))
      }
    }
    
    // 或者从文本中提取进度
    const progressMatch = text.match(/已学\s*(\d+)\s*%/)
    if (progressMatch) {
      course.progress = parseInt(progressMatch[1])
    } else if (text.includes('已学完')) {
      course.progress = 100
    }
    
    course.isCompleted = course.progress >= 100
    
    // 提取待完成任务 - 优先从 class="card-body-status" 的元素中提取
    const statusEl = body.querySelector('.card-body-status')
    if (statusEl) {
      const statusText = statusEl.textContent?.trim() || ''
      
      if (statusText.includes('无可提交作业')) {
        course.pendingTasks = 0
      } else {
        const pendingMatch = statusText.match(/有\s*([1-9]\d?)\s*个(?:作业(?:和测验)?|测验)\s*(?:待|未)完成/)
        if (pendingMatch) {
          const pendingCount = parseInt(pendingMatch[1])
          if (pendingCount > 0 && pendingCount <= 10) {
            course.pendingTasks = pendingCount
            course.hasHomework = true
          }
        }
      }
    } else {
      // 降级方案：从整个文本中提取
      const textContent = body.textContent || ''
      if (textContent.includes('无可提交作业')) {
        course.pendingTasks = 0
      } else {
        const pendingMatch = textContent.match(/有\s*([1-9]\d?)\s*个(?:作业(?:和测验)?|测验)\s*(?:待|未)完成/)
        if (pendingMatch) {
          const pendingCount = parseInt(pendingMatch[1])
          if (pendingCount > 0 && pendingCount <= 10) {
            course.pendingTasks = pendingCount
            course.hasHomework = true
          }
        }
      }
    }
    
    // 保存按钮元素引用，用于模拟点击跳转
    const buttons = body.querySelectorAll('button')
    buttons.forEach((btn) => {
      const btnText = btn.textContent?.trim() || ''
      if (btnText.includes('查看课程')) {
        course.viewButton = btn as HTMLButtonElement
      } else if (btnText.includes('去学习')) {
        course.studyButton = btn as HTMLButtonElement
      }
    })
    
    return course
  }

  private extractByTextMatching(): void {
    const allDivs = document.querySelectorAll('div')
    let currentSemesterSection: HTMLElement | null = null
    const otherSemesters: { name: string; section: HTMLElement }[] = []
    
    for (const div of allDivs) {
      const text = div.textContent || ''
      
      if (text.startsWith('本学期课程') || text.includes('本学期我的课程有')) {
        if (!currentSemesterSection) {
          currentSemesterSection = div.closest('[class*="el-collapse-item"]') as HTMLElement || div
        }
      }
      
      const semesterMatch = text.match(/^(20\d{2}(?:春|秋|夏|冬|上|下))\s*[\(（]?本学期/)
      if (semesterMatch) {
        const section = div.closest('[class*="el-collapse-item"]') as HTMLElement
        if (section && section !== currentSemesterSection) {
          otherSemesters.push({
            name: semesterMatch[1] + (text.includes('（本）') ? '（本）' : ''),
            section,
          })
        }
      }
    }
    
    if (currentSemesterSection) {
      const courses = this.extractCoursesFromSection(currentSemesterSection)
      this.semesters.push({
        name: '本学期课程',
        isCurrent: true,
        courses,
      })
    }
    
    for (const sem of otherSemesters) {
      const courses = this.extractCoursesFromSection(sem.section)
      if (courses.length > 0) {
        this.semesters.push({
          name: sem.name,
          isCurrent: false,
          courses,
        })
      }
    }
  }

  private extractCoursesFromSection(section: HTMLElement): CourseInfo[] {
    const courses: CourseInfo[] = []
    const seen = new Set<string>()
    
    const courseContainers = section.querySelectorAll('div')
    
    courseContainers.forEach((el) => {
      if (el.querySelectorAll('div').length < 2) return
      
      const course = this.extractSingleCourse(el)
      if (course && course.name && !seen.has(course.name) && !this.seenNames.has(course.name)) {
        const isValidCourse = this.validateCourseElement(el, course)
        if (isValidCourse) {
          seen.add(course.name)
          this.seenNames.add(course.name)
          courses.push(course)
        }
      }
    })
    
    return courses
  }

  private validateCourseElement(el: Element, course: CourseInfo): boolean {
    const text = el.textContent || ''
    
    if (text.includes('本学期我的课程有')) return false
    if (text.match(/^20\d{2}[春夏秋冬上下]/)) return false
    
    if (text.length < 10) return false
    if (text.length > 2000) return false
    
    if (text.includes('课程名称') && text.includes('学分') && text.includes('查看课程')) {
      return true
    }
    
    if (course.credits > 0 || course.score > 0 || course.progress > 0) {
      return true
    }
    
    if (text.includes('学习进度') || text.includes('形考成绩') || text.includes('查看课程')) {
      return true
    }
    
    return false
  }

  private extractSingleCourse(el: Element): CourseInfo | null {
    const text = el.textContent || ''
    
    const course: CourseInfo = {
      name: '',
      progress: 0,
      isCompleted: false,
      pendingTasks: 0,
      credits: 0,
      score: 0,
      examType: '',
      hasHomework: false,
    }
    
    course.name = this.findCourseName(el, text)
    if (!course.name) return null
    
    course.coverUrl = this.findCourseCover(el)
    course.progress = this.findCourseProgress(el, text)
    course.isCompleted = course.progress >= 100
    course.credits = this.findField(text, /学分[：:]\s*(\d+)/)
    course.score = this.findField(text, /形考总成绩[：:]\s*(\d+)/)
    course.pendingTasks = this.findPendingTasks(text)
    course.hasHomework = course.pendingTasks > 0
    course.examType = this.findExamType(text)
    this.findCourseUrls(el, course)
    
    return course
  }

  private findCourseName(el: Element, text: string): string {
    const titleEl = el.querySelector('[data-title]')
    if (titleEl) {
      return titleEl.getAttribute('data-title')?.trim() || ''
    }
    
    const headerEl = el.querySelector('.course-title, h3, h4, .title')
    if (headerEl) {
      const name = headerEl.textContent?.trim() || ''
      if (name.length > 1 && name.length < 50) return name
    }
    
    const imgEl = el.querySelector('img')
    if (imgEl) {
      const alt = imgEl.getAttribute('alt')?.trim() || ''
      if (alt.length > 1 && alt.length < 50) return alt
      const title = imgEl.getAttribute('title')?.trim() || ''
      if (title.length > 1 && title.length < 50) return title
    }
    
    const nameMatch = text.match(/^([^学分形考查看课程去学习\(\d]{2,30}?)(?=\s*学分|\s*形考|\s*查看课程|\s*去学习|\s*学完|$)/m)
    if (nameMatch) {
      return nameMatch[1].trim()
    }
    
    return ''
  }

  private findCourseCover(el: Element): string {
    const imgEl = el.querySelector('img[src]') as HTMLImageElement
    if (imgEl) {
      return imgEl.src || ''
    }
    return ''
  }

  private findCourseProgress(el: Element, text: string): number {
    const progressBar = el.querySelector('.el-progress-bar__inner, [class*="progress"] [style*="width"]')
    if (progressBar) {
      const style = progressBar.getAttribute('style') || ''
      const widthMatch = style.match(/width:\s*(\d+(?:\.\d+)?)%/)
      if (widthMatch) {
        return Math.round(parseFloat(widthMatch[1]))
      }
    }
    
    const percentMatch = text.match(/已学\s*(\d+)\s*%/)
    if (percentMatch) {
      return parseInt(percentMatch[1])
    }
    
    const progressMatch = text.match(/(\d+)\s*%/)
    if (progressMatch && text.includes('学完')) {
      return parseInt(progressMatch[1])
    }
    
    return 0
  }

  private findField(text: string, regex: RegExp): number {
    const match = text.match(regex)
    if (match) {
      return parseInt(match[1])
    }
    return 0
  }

  private findPendingTasks(text: string): number {
    // 使用严格的正则：必须以"有"开头，只匹配"作业"或"测验"的待办提示
    const match = text.match(/有\s*([1-9]\d?)\s*个(?:作业(?:和测验)?|测验)\s*(?:待|未)完成/)
    if (match) {
      const pendingCount = parseInt(match[1])
      // 验证：待办任务数应该在合理范围内（1-10）
      if (pendingCount > 0 && pendingCount <= 10) {
        return pendingCount
      }
    }
    
    return 0
  }

  private findExamType(text: string): string {
    const match = text.match(/考试形式[：:]\s*([^形考学学分]+?)(?=\s|$)/)
    if (match) {
      return match[1].trim()
    }
    return ''
  }

  private findCourseUrls(el: Element, course: CourseInfo): void {
    const buttons = el.querySelectorAll('button, a, [role="button"], .el-button')
    buttons.forEach((btn) => {
      const text = btn.textContent?.trim() || ''
      const href = (btn as HTMLAnchorElement).href || ''
      const onclick = btn.getAttribute('onclick') || ''
      const dataUrl = btn.getAttribute('data-url') || btn.getAttribute('data-href') || ''
      
      // 提取"查看课程"链接
      if (text.includes('查看课程')) {
        if (href) {
          course.viewCourseUrl = href
        } else if (dataUrl) {
          course.viewCourseUrl = dataUrl
        } else if (onclick) {
          const urlMatch = onclick.match(/location\.(?:href|assign)\(['"]([^'"]+)['"]/)
          if (urlMatch) {
            course.viewCourseUrl = urlMatch[1]
          }
        }
      }
      
      // 提取"去学习"链接
      if (text.includes('去学习')) {
        if (href) {
          course.studyUrl = href
        } else if (dataUrl) {
          course.studyUrl = dataUrl
        } else if (onclick) {
          const urlMatch = onclick.match(/location\.(?:href|assign)\(['"]([^'"]+)['"]/)
          if (urlMatch) {
            course.studyUrl = urlMatch[1]
          }
        }
      }
      
      // 备用：提取任何包含课程链接的按钮
      if (!course.studyUrl && href && href.includes('/course/')) {
        course.studyUrl = href
      }
    })
  }

  getTotalCourses(): number {
    return this.semesters.reduce((sum, s) => sum + s.courses.length, 0)
  }

  getCompletedCourses(): number {
    return this.semesters.reduce((sum, s) => sum + s.courses.filter(c => c.isCompleted).length, 0)
  }

  getPendingTasksCount(): number {
    return this.semesters.reduce((sum, s) => sum + s.courses.reduce((s, c) => s + c.pendingTasks, 0), 0)
  }

  getIncompleteCourses(): CourseInfo[] {
    const allCourses = this.semesters.flatMap(s => s.courses)
    return allCourses.filter(c => !c.isCompleted).sort((a, b) => a.progress - b.progress)
  }

  getCoursesWithHomework(): CourseInfo[] {
    const allCourses = this.semesters.flatMap(s => s.courses)
    return allCourses.filter(c => c.hasHomework)
  }

  navigateToCourse(course: CourseInfo): void {
    // 优先使用保存的按钮引用，模拟点击触发 Angular 路由跳转
    if (course.studyButton) {
      course.studyButton.click()
      return
    }
    
    if (course.viewButton) {
      course.viewButton.click()
      return
    }
    
    // 降级方案：尝试使用 URL 跳转
    if (course.viewCourseUrl) {
      window.location.href = course.viewCourseUrl
    } else if (course.studyUrl) {
      window.location.href = course.studyUrl
    } else {
      console.warn('[HomeNavigator] 未找到课程导航方式')
    }
  }
}

export const homeNavigatorService = new HomeNavigatorService()