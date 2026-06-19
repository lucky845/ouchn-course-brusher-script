export const NAV_ITEM_SELECTORS = {
  /** 侧边栏导航容器选择器 */
  sidebarSelectors: [
    '#nav-drawer',
    '.sidebar',
    '.nav-sidebar',
    'nav.drawer',
    '[data-region="drawer"]',
    '.block_settings',
    '.block_navigation',
    '.courseindex',
    '.course-index'
  ],

  /** 课程主页上的活动链接选择器（按优先级） */
  courseActivitySelectors: [
    '.course-content .activity a[href]',
    '.course-content li.activity > div a[href]',
    '.section .activity a[href]',
    '#region-main .activity a[href]',
    '.course-section .activity a[href]',
    '.topics .activity a[href]',
    'li.activity a[href]',
    'a[href*="/mod/"][href*="view.php"]',
    'a.aalink[href]'
  ],

  /** 学习内容页上的"下一个活动"导航链接选择器 */
  nextActivitySelectors: [
    '.next-activity-link',
    'a.next-activity-link',
    '#next-activity-link',
    '.modchoosernext a',
    '.modchooser .next a',
    '.activitynavigation .next a',
    '.activity-navigation a.next',
    '.pagelayout-next a',
    'a[title*="下一个"]',
    'a[title*="Next"]',
    'a[aria-label*="下一个活动"]',
    'a[aria-label*="next activity"]',
    '.jumpmenu_next a',
    '.urlselect + a'
  ],

  /** "下一个活动"关键字匹配（中英文） */
  nextActivityKeywords: [
    '下一个活动',
    '下一活动',
    '下一项',
    '下一个',
    'Next activity',
    'Next Activity',
    'next activity'
  ],

  /** 面包屑/导航链选择器 */
  breadcrumbSelectors: [
    '.breadcrumb',
    '#page-navbar',
    '.navbar .breadcrumb',
    '.navbar-brand'
  ]
}
