// ==UserScript==
// @name         国家开放大学实验学院自动刷课脚本
// @namespace    https://github.com/lucky845/ouchn-course-brusher-script
// @downloadURL  https://github.com/lucky845/ouchn-course-brusher-script/raw/main/ouchn-course-brusher.user.js
// @updateURL    https://github.com/lucky845/ouchn-course-brusher-script/raw/main/ouchn-course-brusher.user.js
// @version      1.3.0
// @description  （个人自用）自动识别并处理Moodle平台的学习项目，包括视频自动播放、文档自动处理等。如果有更好的实现方式，欢迎参与贡献。
// @author       lucky845
// @match        https://moodle.syxy.ouchn.cn/mod/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置管理 ====================
    const STORAGE_KEY = {
        ENABLED: 'ouchn_brusher_enabled',
        POSITION: 'ouchn_brusher_position',
        SETTINGS: 'ouchn_brusher_settings'
    };

    const DEFAULT_SETTINGS = {
        videoCheckInterval: 10000,
        pageWaitTime: 5000,
        autoNavigate: true,
        autoPauseOnComplete: true,
        enableSoundOnInteraction: true,
        debugMode: false
    };

    const MANUAL_ACTION_TYPES = ['forum', 'assign', 'quiz', 'survey', 'feedback', 'choice', 'database', 'workshop'];

    // ==================== 全局状态 ====================
    let scriptEnabled = true;
    let initialized = false;
    let settings = loadSettings();
    let container = null;
    let panel = null;
    let button = null;

    // ==================== 工具函数 ====================
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function extractCourseId(url) {
        url = url || window.location.href;
        const match = url.match(/[?&]id=(\d+)/);
        return match ? match[1] : null;
    }

    function buildCourseUrl(courseId) {
        return `https://moodle.syxy.ouchn.cn/course/view.php?id=${courseId}`;
    }

    function isCoursePage(url) {
        return (url || window.location.href).includes('/course/view.php');
    }

    function loadSettings() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY.SETTINGS);
            if (saved) {
                return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('[刷课脚本] 加载设置失败:', e);
        }
        return { ...DEFAULT_SETTINGS };
    }

    // ==================== 日志系统 ====================
    const Log = {
        debug: (msg) => settings.debugMode && console.log(`[刷课脚本] [DEBUG] ${msg}`),
        info: (msg) => { console.log(`[刷课脚本] ${msg}`); updateStatus(msg, 'info'); },
        success: (msg) => { console.log(`[刷课脚本] ✓ ${msg}`); updateStatus(msg, 'success'); },
        warn: (msg) => { console.warn(`[刷课脚本] ⚠ ${msg}`); updateStatus(msg, 'warning'); },
        error: (msg) => { console.error(`[刷课脚本] ✗ ${msg}`); updateStatus(msg, 'error'); }
    };

    // ==================== 视频管理 ====================
    const Video = {
        find() {
            let video = document.querySelector('video');
            if (video) return video;
            
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (doc) {
                        video = doc.querySelector('video');
                        if (video) return video;
                    }
                } catch (e) {
                    Log.debug('无法访问iframe内容');
                }
            }
            return null;
        },

        async play(video, maxAttempts = 3) {
            for (let i = 0; i < maxAttempts; i++) {
                try {
                    if (video.paused) {
                        video.muted = true;
                        await video.play();
                        Log.success('视频开始播放');
                        return true;
                    }
                    return true;
                } catch (err) {
                    Log.warn(`播放尝试 ${i + 1}/${maxAttempts} 失败`);
                    await sleep(1000);
                }
            }
            return false;
        },

        setupAutoAdvance(video, onComplete) {
            const handleEnded = () => {
                Log.success('视频播放完成');
                setTimeout(onComplete, 2000);
            };

            video.addEventListener('ended', handleEnded);

            const checkInterval = setInterval(() => {
                if (!video || video.ended) {
                    clearInterval(checkInterval);
                    return;
                }
                if (video.paused) {
                    this.play(video).catch(() => {});
                }
            }, settings.videoCheckInterval);

            if (settings.enableSoundOnInteraction) {
                const enableSound = () => {
                    if (video.muted) {
                        video.muted = false;
                        Log.info('已恢复声音');
                    }
                    document.removeEventListener('click', enableSound);
                    document.removeEventListener('keydown', enableSound);
                };
                document.addEventListener('click', enableSound);
                document.addEventListener('keydown', enableSound);
            }
        }
    };

    // ==================== 学习项目管理 ====================
    const Item = {
        isCompleted(el) {
            const completion = el.querySelector('.completion-icon, .completionstate, .status, .completion-complete, .icon-check');
            if (completion) {
                const cls = completion.className || '';
                const txt = completion.textContent || '';
                return cls.includes('completed') || cls.includes('complete') || txt.includes('已完成') || txt.includes('完成');
            }
            return el.classList.contains('completed');
        },

        needsManualAction(el) {
            const cls = el.className || '';
            const href = el.querySelector('a')?.href || '';
            return MANUAL_ACTION_TYPES.some(type => cls.includes(type) || href.includes(`/mod/${type}/`));
        },

        getAll() {
            const selectors = [
                '.course-content .activity',
                '.course-content .resource',
                '.topics .activity',
                '.section .activityinstance',
                '.newgk-coursecontent .activity'
            ];
            for (const sel of selectors) {
                const items = document.querySelectorAll(sel);
                if (items.length > 0) return Array.from(items);
            }
            return [];
        },

        findNext(startIndex = -1) {
            const items = this.getAll();
            for (let i = startIndex + 1; i < items.length; i++) {
                const item = items[i];
                if (!this.isCompleted(item) && !this.needsManualAction(item)) {
                    const link = item.querySelector('a');
                    if (link) return { item, index: i, url: link.href };
                }
            }
            return null;
        }
    };

    // ==================== 侧边栏导航管理 ====================
    const Sidebar = {
        find() {
            return document.querySelector('#nav-drawer, .sidebar, .nav-sidebar');
        },

        getItems(sidebar) {
            const sidebarStructure = [];
            const seenUrls = new Set();
            const sections = sidebar.querySelectorAll('.section');
            
            sections.forEach((section) => {
                const activities = section.querySelectorAll('.activity, .resource, .modtype_resource, .modtype_url, .modtype_video, .modtype_quiz');
                const sectionItems = [];
                
                activities.forEach((activity) => {
                    const link = activity.querySelector('a');
                    if (link && link.href.includes('/mod/')) {
                        if (!seenUrls.has(link.href)) {
                            seenUrls.add(link.href);
                            sectionItems.push(link);
                        }
                    }
                });
                
                if (sectionItems.length > 0) {
                    sidebarStructure.push(sectionItems);
                }
            });
            
            let items = sidebarStructure.flat();
            
            if (items.length === 0) {
                const allLinks = sidebar.querySelectorAll('a');
                for (const link of allLinks) {
                    const href = link.href;
                    if (href.includes('/mod/') && !seenUrls.has(href)) {
                        seenUrls.add(href);
                        items.push(link);
                    }
                }
            }
            
            return items;
        },

        findCurrentIndex(items) {
            const currentUrl = window.location.href;
            const currentUrlPath = window.location.pathname;
            const currentUrlId = currentUrl.split('id=')[1]?.split('&')[0];
            
            for (let i = 0; i < items.length; i++) {
                if (currentUrl === items[i].href) return i;
            }
            
            if (currentUrlId) {
                for (let i = 0; i < items.length; i++) {
                    const itemUrl = items[i].href;
                    const itemPath = new URL(itemUrl).pathname;
                    if (currentUrlPath === itemPath) return i;
                }
            }
            
            if (currentUrlId) {
                for (let i = 0; i < items.length; i++) {
                    const itemUrl = items[i].href;
                    const itemId = itemUrl.split('id=')[1]?.split('&')[0];
                    if (currentUrlId === itemId) return i;
                }
            }
            
            for (let i = 0; i < items.length; i++) {
                const itemUrl = items[i].href;
                if (currentUrl.includes(itemUrl.split('?')[0].split('/').pop())) return i;
            }
            
            return -1;
        }
    };

    // ==================== 导航管理 ====================
    async function goToNextItem() {
        Log.info('查找下一个学习项目...');
        
        const sidebar = Sidebar.find();
        if (sidebar) {
            const sidebarItems = Sidebar.getItems(sidebar);
            if (sidebarItems.length > 0) {
                const currentIndex = Sidebar.findCurrentIndex(sidebarItems);
                
                if (currentIndex >= 0 && currentIndex === sidebarItems.length - 1) {
                    Log.success('已完成最后一个项目！');
                    pauseScript();
                    return;
                }
                
                if (currentIndex >= 0 && currentIndex < sidebarItems.length - 1) {
                    const nextUrl = sidebarItems[currentIndex + 1].href;
                    Log.info(`跳转到下一个项目（侧边栏 ${currentIndex + 1}/${sidebarItems.length}）`);
                    await sleep(500);
                    window.location.href = nextUrl;
                    return;
                }
            }
        }
        
        const next = Item.findNext();
        if (next) {
            Log.info(`跳转到下一个项目（索引 ${next.index}）`);
            await sleep(500);
            window.location.href = next.url;
        } else {
            Log.success('所有学习项目已完成！');
            pauseScript();
        }
    }

    // ==================== 页面处理 ====================
    async function processLearningItem() {
        Log.info('处理学习项目页面...');

        const video = Video.find();
        if (video) {
            Log.info('检测到视频，开始播放');
            const playing = await Video.play(video);
            if (playing) {
                Video.setupAutoAdvance(video, goToNextItem);
            } else {
                setTimeout(goToNextItem, 5000);
            }
            return;
        }

        const contentSelectors = '.resourcecontent, .mod-resource-content, .forum, .mod-forum-content, .page-content, .mod-page-content, .content, #page-content, .main-content, .region-content, .course-content, .forum-content, .discussion-content';
        const hasContent = document.querySelector(contentSelectors);
        
        const waitTime = hasContent ? settings.pageWaitTime : 3000;
        Log.info(`${hasContent ? '文档' : '其他'}内容，等待 ${waitTime/1000} 秒后继续`);
        
        setTimeout(goToNextItem, waitTime);
    }

    async function processCoursePage() {
        Log.info('处理课程页面...');
        
        const next = Item.findNext();
        if (next) {
            Log.info('找到未完成项目，跳转...');
            await sleep(500);
            window.location.href = next.url;
        } else {
            Log.success('所有项目已完成！');
            pauseScript();
        }
    }

    // ==================== 脚本控制 ====================
    function pauseScript() {
        scriptEnabled = false;
        localStorage.setItem(STORAGE_KEY.ENABLED, 'false');
        Log.success('脚本已暂停');
        updateButtonStates();
    }

    function resumeScript() {
        scriptEnabled = true;
        localStorage.setItem(STORAGE_KEY.ENABLED, 'true');
        Log.info('脚本已恢复');
        updateButtonStates();
        init();
    }

    function updateButtonStates() {
        const startBtn = document.getElementById('ouchn-brusher-start');
        const stopBtn = document.getElementById('ouchn-brusher-stop');
        const toggle = document.getElementById('ouchn-brusher-toggle');
        
        if (toggle) toggle.checked = scriptEnabled;
        
        if (startBtn && stopBtn) {
            startBtn.disabled = scriptEnabled;
            startBtn.style.opacity = scriptEnabled ? '0.5' : '1';
            startBtn.style.cursor = scriptEnabled ? 'not-allowed' : 'pointer';
            stopBtn.disabled = !scriptEnabled;
            stopBtn.style.opacity = !scriptEnabled ? '0.5' : '1';
            stopBtn.style.cursor = !scriptEnabled ? 'not-allowed' : 'pointer';
        }
    }

    // ==================== UI 状态更新 ====================
    function updateStatus(msg, type = 'info') {
        const status = document.getElementById('ouchn-brusher-status');
        if (!status) return;
        
        status.textContent = msg;
        const styles = {
            success: { bg: '#e8f5e8', color: '#2e7d32' },
            error: { bg: '#ffebee', color: '#c62828' },
            warning: { bg: '#fff3e0', color: '#ef6c00' },
            info: { bg: '#f5f5f5', color: '#666' }
        };
        const s = styles[type] || styles.info;
        status.style.background = s.bg;
        status.style.color = s.color;
    }

    // ==================== 物理磁吸系统 ====================
    const Snap = {
        apply(containerEl) {
            const windowWidth = document.documentElement.clientWidth;
            const windowHeight = document.documentElement.clientHeight;
            const containerWidth = containerEl.offsetWidth;
            const containerHeight = containerEl.offsetHeight;

            // 从 transform 中获取当前像素位置
            const transform = containerEl.style.transform;
            const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
            let currentX = match ? parseFloat(match[1]) : 0;
            let currentY = match ? parseFloat(match[2]) : 0;

            // 根据当前位置判断吸附到哪边
            const centerX = windowWidth / 2;
            let targetX;
            
            if (currentX + containerWidth / 2 < centerX) {
                // 当前在左半边，吸附到左边
                targetX = 0;
            } else {
                // 当前在右半边，吸附到右边
                targetX = windowWidth - containerWidth;
            }

            // Y 方向保持在当前位置，但确保在视口内
            const targetY = Math.max(0, Math.min(currentY, windowHeight - containerHeight));

            containerEl.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            containerEl.style.transform = `translate(${targetX}px, ${targetY}px)`;
            containerEl.style.opacity = '1';

            setTimeout(() => {
                savePositionPercentage(containerEl);
            }, 300);
        }
    };

    // ==================== 位置管理（边缘状态 + 百分比定位） ====================
    function savePositionPercentage(containerEl) {
        const windowWidth = document.documentElement.clientWidth;
        const windowHeight = document.documentElement.clientHeight;
        const containerWidth = containerEl.offsetWidth;
        const containerHeight = containerEl.offsetHeight;
        
        // 从 transform 获取当前位置
        const transform = containerEl.style.transform;
        const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
        const currentX = match ? parseFloat(match[1]) : 0;
        const currentY = match ? parseFloat(match[2]) : 0;
        
        // 判断是否在边缘位置
        let edge = 'none';
        if (currentX < 10) {
            edge = 'left';
        } else if (currentX > windowWidth - containerWidth - 10) {
            edge = 'right';
        }
        
        // 保存边缘状态和百分比位置
        const percentY = (currentY / windowHeight) * 100;
        localStorage.setItem(STORAGE_KEY.POSITION, JSON.stringify({ 
            edge: edge, 
            y: percentY 
        }));
    }

    function loadPositionPercentage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY.POSITION);
            if (saved) {
                const pos = JSON.parse(saved);
                const windowWidth = document.documentElement.clientWidth;
                const windowHeight = document.documentElement.clientHeight;
                const containerWidth = container.offsetWidth;
                
                let x = windowWidth - 60; // 默认右侧
                
                // 如果保存了边缘状态，直接定位到边缘
                if (pos.edge === 'left') {
                    x = 0;
                } else if (pos.edge === 'right') {
                    x = windowWidth - containerWidth;
                } else if (pos.x !== undefined && pos.x >= 0 && pos.x <= 100) {
                    // 兼容旧版本的百分比存储
                    x = (pos.x / 100) * windowWidth;
                }
                
                // 计算Y位置
                let y = 100; // 默认位置
                if (pos.y !== undefined && pos.y >= 0 && pos.y <= 100) {
                    y = (pos.y / 100) * windowHeight;
                }
                
                return { x, y };
            }
        } catch (e) {
            Log.debug('加载位置失败，使用默认位置');
        }
        return null;
    }

    // ==================== 控制面板 ====================
    function createControlPanel() {
        if (document.getElementById('ouchn-brusher-container')) return;

        scriptEnabled = localStorage.getItem(STORAGE_KEY.ENABLED) !== 'false';

        container = document.createElement('div');
        container.id = 'ouchn-brusher-container';
        
        const savedPos = loadPositionPercentage();
        let initialX = savedPos?.x || (window.innerWidth - 60);
        let initialY = savedPos?.y || 100;
        
        container.style.cssText = `
            position: fixed; 
            left: 0; 
            top: 0;
            transform: translate(${initialX}px, ${initialY}px);
            z-index: 999999;
            font-family: Arial, sans-serif; 
            transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease;
            transform-origin: top left;
            opacity: 1;
            user-select: none;
            -webkit-user-select: none;
            touch-action: none;
            will-change: transform;
            pointer-events: auto;
        `;

        button = document.createElement('div');
        button.id = 'ouchn-brusher-button';
        button.style.cssText = `
            width: 50px; height: 50px; background: #4CAF50; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            color: white; font-size: 24px; position: relative;
            user-select: none;
            -webkit-user-select: none;
            touch-action: none;
        `;
        button.textContent = '📚';

        panel = document.createElement('div');
        panel.id = 'ouchn-brusher-panel';
        panel.style.cssText = `
            position: absolute; top: 0; right: 60px; width: 280px;
            background: #fff; border: 1px solid #e0e0e0; border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); font-size: 14px;
            display: none; padding: 0;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 12px; background: #4CAF50; color: white; 
            border-radius: 8px 8px 0 0; font-weight: bold; 
            display: flex; justify-content: space-between; align-items: center;
            cursor: move;
        `;
        header.innerHTML = `
            <span>刷课脚本控制 v2.2</span>
            <button id="ouchn-brusher-close" style="
                background: none; border: none; color: white; 
                cursor: pointer; font-size: 18px; padding: 0;
                width: 20px; height: 20px; display: flex;
                align-items: center; justify-content: center;
            ">×</button>
        `;

        const content = document.createElement('div');
        content.style.cssText = 'padding: 12px;';
        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span>启用脚本</span>
                <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 24px;">
                    <input type="checkbox" id="ouchn-brusher-toggle" ${scriptEnabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                    <span class="slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #f44336; transition: 0.4s; border-radius: 24px;"></span>
                </label>
            </div>
            <div id="ouchn-brusher-status" style="padding: 8px; background: #f5f5f5; border-radius: 4px; margin-bottom: 12px; font-size: 12px; color: #666;">
                ${scriptEnabled ? '脚本已启用' : '脚本已禁用'}
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="ouchn-brusher-start" style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">开始</button>
                <button id="ouchn-brusher-stop" style="flex: 1; padding: 8px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">停止</button>
            </div>
        `;

        panel.appendChild(header);
        panel.appendChild(content);

        const style = document.createElement('style');
        style.textContent = `
            .switch input:checked + .slider { background: #2196F3; }
            .slider:before { 
                position: absolute; content: ""; height: 18px; width: 18px; 
                left: 3px; bottom: 3px; background: white; 
                transition: 0.4s; border-radius: 50%; 
            }
            .switch input:checked + .slider:before { transform: translateX(20px); }
        `;
        document.head.appendChild(style);

        container.appendChild(button);
        container.appendChild(panel);
        document.body.appendChild(container);

        let isOpen = false;
        let isActuallyDragging = false;
        let startX, startY, startLeft, startTop;
        let hideTimer = null;
        let isDraggingFlag = false;

        button.addEventListener('click', (e) => {
            if (isDraggingFlag) {
                isDraggingFlag = false;
                return;
            }
            e.stopPropagation();
            
            const rect = container.getBoundingClientRect();
            const windowWidth = document.documentElement.clientWidth;
            const centerX = windowWidth / 2;
            
            if (rect.left < centerX) {
                panel.style.left = '60px';
                panel.style.right = 'auto';
            } else {
                panel.style.left = 'auto';
                panel.style.right = '60px';
            }
            
            panel.style.display = isOpen ? 'none' : 'block';
            isOpen = !isOpen;
        });

        document.getElementById('ouchn-brusher-close').onclick = (e) => {
            e.stopPropagation();
            panel.style.display = 'none';
            isOpen = false;
        };

        document.getElementById('ouchn-brusher-toggle').onchange = function() {
            if (this.checked) resumeScript();
            else pauseScript();
        };

        document.getElementById('ouchn-brusher-start').onclick = () => resumeScript();
        document.getElementById('ouchn-brusher-stop').onclick = () => pauseScript();

        container.addEventListener('mouseenter', () => {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            container.style.transition = 'all 0.3s ease';
            container.style.opacity = '1';
        });

        container.addEventListener('mouseleave', () => {
            hideTimer = setTimeout(() => {
                container.style.transition = 'opacity 0.3s ease';
                container.style.opacity = '0.6';
            }, 500);
        });

        let dragContainerWidth = 0;
        let dragContainerHeight = 0;
        let dragWindowWidth = 0;
        let dragWindowHeight = 0;
        let dragStartX = 0;
        let dragStartY = 0;
        let dragOffsetX = 0; // 鼠标相对于容器左上角的偏移
        let dragOffsetY = 0;
        let dragListenersAdded = false;

        const doDrag = (e) => {
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            if (!isActuallyDragging) {
                const distance = Math.sqrt(Math.pow(clientX - startX, 2) + Math.pow(clientY - startY, 2));
                if (distance > 5) {
                    isActuallyDragging = true;
                    isDraggingFlag = true;
                    dragContainerWidth = container.offsetWidth;
                    dragContainerHeight = container.offsetHeight;
                    dragWindowWidth = document.documentElement.clientWidth;
                    dragWindowHeight = document.documentElement.clientHeight;
                    document.body.style.cursor = 'grabbing';
                    container.style.cursor = 'grabbing';
                    button.style.cursor = 'grabbing';
                } else {
                    return;
                }
            }
            
            const newX = Math.max(0, Math.min(clientX - dragOffsetX, dragWindowWidth - dragContainerWidth));
            const newY = Math.max(0, Math.min(clientY - dragOffsetY, dragWindowHeight - dragContainerHeight));
            
            container.style.transform = `translate(${newX}px, ${newY}px)`;
        };

        const endDragWithCleanup = (e) => {
            document.body.style.cursor = '';
            container.style.cursor = '';
            button.style.cursor = 'pointer';
            
            if (isActuallyDragging) {
                container.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                Snap.apply(container);
            }
            isActuallyDragging = false;
            
            if (dragListenersAdded) {
                document.removeEventListener('mousemove', doDrag);
                document.removeEventListener('touchmove', doDrag);
                document.removeEventListener('mouseup', endDragWithCleanup);
                document.removeEventListener('touchend', endDragWithCleanup);
                document.removeEventListener('mouseleave', endDragWithCleanup);
                document.removeEventListener('touchcancel', endDragWithCleanup);
                dragListenersAdded = false;
            }
        };

        const startDragWithEvents = (e) => {
            e.preventDefault();
            isActuallyDragging = false;
            isDraggingFlag = false;
            
            container.style.transition = 'none !important';
            container.style.opacity = '1';
            
            document.body.style.cursor = 'grab';
            container.style.cursor = 'grab';
            button.style.cursor = 'grab';
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            
            // 计算鼠标相对于容器左上角的偏移
            const rect = container.getBoundingClientRect();
            dragOffsetX = clientX - rect.left;
            dragOffsetY = clientY - rect.top;
            
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            
            if (!dragListenersAdded) {
                document.addEventListener('mousemove', doDrag, { passive: false });
                document.addEventListener('touchmove', doDrag, { passive: false });
                document.addEventListener('mouseup', endDragWithCleanup);
                document.addEventListener('touchend', endDragWithCleanup);
                document.addEventListener('mouseleave', endDragWithCleanup);
                document.addEventListener('touchcancel', endDragWithCleanup);
                dragListenersAdded = true;
            }
        };

        button.addEventListener('mousedown', startDragWithEvents);
        button.addEventListener('touchstart', startDragWithEvents, { passive: true });
        header.addEventListener('mousedown', startDragWithEvents);
        header.addEventListener('touchstart', startDragWithEvents, { passive: true });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target) && isOpen) {
                panel.style.display = 'none';
                isOpen = false;
            }
        });

        window.addEventListener('resize', () => {
            const savedPos = loadPositionPercentage();
            if (savedPos) {
                container.style.transition = 'none';
                container.style.transform = `translate(${savedPos.x}px, ${savedPos.y}px)`;
            }
        });

        updateButtonStates();
    }

    // ==================== 初始化 ====================
    async function init() {
        createControlPanel();

        if (!scriptEnabled) {
            Log.warn('脚本已禁用');
            return;
        }

        if (initialized) return;
        initialized = true;

        Log.success('脚本已启动');

        await sleep(100);
        Snap.apply(container);

        await sleep(900);

        const url = window.location.href;
        
        if (isCoursePage(url)) {
            await processCoursePage();
        } else if (url.includes('/mod/')) {
            await processLearningItem();
        }
    }

    // ==================== 启动 ====================
    window.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
    window.addEventListener('load', () => !initialized && setTimeout(init, 500));
    window.addEventListener('hashchange', () => { initialized = false; setTimeout(init, 1000); });
    
    // 视口变化时重新计算位置
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const savedPos = loadPositionPercentage();
            if (savedPos) {
                container.style.transition = 'none';
                container.style.transform = `translate(${savedPos.x}px, ${savedPos.y}px)`;
            }
        }, 100);
    });

})();
