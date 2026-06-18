/**
 * 面板通用配置
 * 统一管理悬浮面板（刷课助手、答题助手、首页课程）的尺寸、间距和拖拽阈值
 */

import { PanelType } from '../types'

/** 单个面板的配置项 */
export interface PanelConfig {
  /** 悬浮按钮宽度 px */
  width: number
  /** 悬浮按钮高度 px */
  height: number
  /** 离边缘间距 px */
  margin: number
  /** 拖拽判定像素阈值（低于该阈值视为点击） */
  dragThreshold: number
}

/** 面板类型 → 配置的统一映射 */
export const PANEL_CONFIG_MAP: Record<PanelType, PanelConfig> = {
  [PanelType.FLOATING]: {
    width: 56,
    height: 56,
    margin: 10,
    dragThreshold: 5,
  },
  [PanelType.QUIZ]: {
    width: 56,
    height: 56,
    margin: 10,
    dragThreshold: 5,
  },
  [PanelType.COURSE]: {
    width: 44,
    height: 44,
    margin: 10,
    dragThreshold: 5,
  },
}

/** 获取指定类型面板的配置 */
export function getPanelConfig (panelType: PanelType): PanelConfig {
  return PANEL_CONFIG_MAP[panelType] || PANEL_CONFIG_MAP[PanelType.FLOATING]
}
