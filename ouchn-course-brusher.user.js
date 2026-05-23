// ==UserScript==
// @name         国家开放大学实验学院自动刷课脚本
// @namespace    https://github.com/lucky845/ouchn-course-brusher-script
// @downloadURL  https://github.com/lucky845/ouchn-course-brusher-script/raw/main/ouchn-course-brusher.user.js
// @updateURL    https://github.com/lucky845/ouchn-course-brusher-script/raw/main/ouchn-course-brusher.user.js
// @version      1.6.2
// @description  这是一个自动刷完学习项目的脚本，适用于国家开放大学实验学院的 Moodle 平台。（个人自用）
// @author       lucky845
// @match        https://moodle.syxy.ouchn.cn/mod/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 安全工具 ====================
    function safeGet(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let result = obj;
        for (const key of keys) {
            if (result == null) return defaultValue;
            result = result[key];
        }
        return result != null ? result : defaultValue;
    }

    function safeCall(fn, defaultValue = undefined) {
        try {
            return fn();
        } catch (e) {
            console.warn('[刷课脚本] 安全调用失败:', e);
            return defaultValue;
        }
    }

    // ==================== 配置 ====================
    const STORAGE_KEY = {
        ENABLED: 'ouchn_brusher_enabled',
        POSITION: 'ouchn_brusher_position',
        SETTINGS: 'ouchn_brusher_settings_v2',
        SESSION: 'ouchn_brusher_session'
    };

    const DEFAULT_SETTINGS = {
        videoCheckInterval: 10000,
        pageWaitTime: 5000,
        speedMode: 'normal',
        videoPlaybackRate: 1,
        antiDetection: true,
        wakeLock: true
    };

    const SPEED_MODES = {
        normal: { name: '正常', videoCheck: 10000, pageWait: 5000 },
        fast: { name: '快速', videoCheck: 5000, pageWait: 2000 },
        stealth: { name: '低调', videoCheck: 30000, pageWait: 15000 }
    };

    // ==================== 状态 ====================
    let scriptEnabled = true;
    let initialized = false;
    let settings = loadSettings();
    let sessionStats = loadSessionStats();
    let container, panel, button;

    // ==================== 工具函数 ====================
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) return `${hours}小时${minutes % 60}分`;
        if (minutes > 0) return `${minutes}分${seconds % 60}秒`;
        return `${seconds}秒`;
    }

    function loadSettings() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY.SETTINGS);
            if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch (e) {}
        return { ...DEFAULT_SETTINGS };
    }

    function saveSettings(newSettings) {
        settings = { ...settings, ...newSettings };
        localStorage.setItem(STORAGE_KEY.SETTINGS, JSON.stringify(settings));
    }

    function loadSessionStats() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY.SESSION);
            if (saved) {
                const stats = JSON.parse(saved);
                // 如果会话超过2小时，重置统计
                if (Date.now() - stats.startTime > 2 * 60 * 60 * 1000) {
                    return { startTime: Date.now(), itemsCompleted: 0 };
                }
                return stats;
            }
        } catch (e) {}
        return { startTime: Date.now(), itemsCompleted: 0 };
    }

    function saveSessionStats() {
        localStorage.setItem(STORAGE_KEY.SESSION, JSON.stringify(sessionStats));
    }

    // ==================== 日志 ====================
    const Log = {
        info: (msg) => { console.log(`[刷课脚本] ${msg}`); updateStatus(msg, 'info'); },
        success: (msg) => { console.log(`[刷课脚本] ✓ ${msg}`); updateStatus(msg, 'success'); },
        warn: (msg) => { console.warn(`[刷课脚本] ⚠ ${msg}`); updateStatus(msg, 'warning'); }
    };

    // ==================== 防检测 ====================
    const AntiDetection = {
        intervals: [],
        start() {
            if (!settings.antiDetection) return;
            this.intervals.push(setInterval(() => {
                if (Math.random() > 0.7 && scriptEnabled) {
                    const scroll = Math.random() * 100 - 50;
                    window.scrollBy(0, scroll);
                    setTimeout(() => window.scrollBy(0, -scroll), 1000 + Math.random() * 2000);
                }
            }, 20000 + Math.random() * 30000));
        },
        stop() {
            this.intervals.forEach(clearInterval);
            this.intervals = [];
        }
    };

    // ==================== 防止息屏 ====================
    const WakeLock = {
        lock: null,
        enabled: false,

        async acquire() {
            if (!settings.wakeLock || !scriptEnabled) return;
            try {
                if ('wakeLock' in navigator) {
                    this.lock = await navigator.wakeLock.request('screen');
                    this.enabled = true;
                    this.lock.addEventListener('release', () => {
                        this.enabled = false;
                        this.lock = null;
                        // 如果脚本还在运行且用户希望保持唤醒，自动重新获取
                        if (settings.wakeLock && scriptEnabled && document.visibilityState === 'visible') {
                            setTimeout(() => this.acquire(), 1000);
                        }
                    });
                    Log.success('防息屏已开启');
                } else {
                    // 降级方案：使用隐藏视频保持唤醒
                    this._fallbackStart();
                    Log.info('使用兼容模式防息屏');
                }
            } catch (err) {
                Log.warn('防息屏启动失败: ' + err.message);
            }
        },

        release() {
            if (this.lock) {
                this.lock.release();
                this.lock = null;
                this.enabled = false;
            }
            this._fallbackStop();
        },

        _fallbackStart() {
            if (this.audioContext) return;
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                gainNode.gain.value = 0;
                oscillator.start();
                this.enabled = true;
            } catch (err) {
                Log.warn('兼容模式防息屏失败: ' + err.message);
            }
        },

        _fallbackStop() {
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
            this.enabled = false;
        }
    };

    // ==================== 进度统计 ====================
    const Progress = {
        getStats() {
            return safeCall(() => {
                const sidebar = Sidebar.find();
                let items = [];
                let currentIndex = -1;
                
                if (sidebar) {
                    items = Sidebar.getItems(sidebar);
                    currentIndex = Sidebar.findCurrentIndex(items);
                }
                
                if (items.length === 0) {
                    items = Item.getAll();
                }
                
                const current = currentIndex >= 0 ? currentIndex + 1 : 0;
                return {
                    total: items.length,
                    current: current,
                    percentage: items.length > 0 ? Math.round((current / items.length) * 100) : 0,
                    sessionTime: Date.now() - (sessionStats?.startTime || Date.now()),
                    itemsCompleted: sessionStats?.itemsCompleted || 0
                };
            }, {
                total: 0,
                current: 0,
                percentage: 0,
                sessionTime: 0,
                itemsCompleted: 0
            });
        },
        
        updateDisplay() {
            safeCall(() => {
                const stats = this.getStats();
                const el = document.getElementById('ouchn-brusher-progress');
                if (el) {
                    const isComplete = stats.current >= stats.total && stats.total > 0;
                    el.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <div style="display: flex; align-items: baseline; gap: 4px;">
                                <span style="font-size: 24px; font-weight: 700; color: #667eea;">${stats.current}</span>
                                <span style="font-size: 14px; color: #999;">/ ${stats.total}</span>
                            </div>
                            <div style="background: ${isComplete ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                                ${isComplete ? '🎉 已完成' : stats.percentage + '%'}
                            </div>
                        </div>
                        <div style="background: rgba(0,0,0,0.08); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 10px;">
                            <div style="background: ${isComplete ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; height: 100%; width: ${stats.percentage}%; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 3px;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.06);">
                            <div style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #666;">
                                <span>📚</span>
                                <span>本次 <strong style="color: #667eea;">${stats.itemsCompleted}</strong> 个</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #666;">
                                <span>⏱️</span>
                                <span>${formatTime(stats.sessionTime)}</span>
                            </div>
                        </div>
                    `;
                }
            });
        }
    };

    // ==================== 视频管理 ====================
    const Video = {
        protectedVideos: new WeakMap(),
        
        find() {
            return safeCall(() => {
                let video = document.querySelector('video');
                if (video) return video;
                
                document.querySelectorAll('iframe').forEach(iframe => {
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (doc && !video) video = doc.querySelector('video');
                    } catch (e) {}
                });
                return video;
            }, null);
        },

        protectPlaybackRate(video, rate) {
            safeCall(() => {
                if (!video) return;
                const validRate = Math.max(0.25, Math.min(4, rate));
                
                if (this.protectedVideos.has(video)) {
                    const config = this.protectedVideos.get(video);
                    if (config.targetRate === validRate) return;
                    clearInterval(config.interval);
                }
                
                try {
                    const originalPlaybackRate = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
                    if (originalPlaybackRate && !originalPlaybackRate.isProtected) {
                        Object.defineProperty(video, 'playbackRate', {
                            configurable: true,
                            enumerable: true,
                            get() {
                                return originalPlaybackRate.get.call(this);
                            },
                            set(value) {
                                if (this._forceTargetRate !== undefined) {
                                    originalPlaybackRate.set.call(this, this._forceTargetRate);
                                } else {
                                    originalPlaybackRate.set.call(this, value);
                                }
                            }
                        });
                    }
                } catch (e) {}
                
                video._forceTargetRate = validRate;
                video.playbackRate = validRate;
                
                const interval = setInterval(() => {
                    safeCall(() => {
                        if (video && document.contains(video) && video._forceTargetRate !== undefined) {
                            if (video.playbackRate !== video._forceTargetRate) {
                                video.playbackRate = video._forceTargetRate;
                            }
                        }
                    });
                }, 500);
                
                this.protectedVideos.set(video, {
                    targetRate: validRate,
                    interval: interval
                });
                
                Log.info(`视频播放速度已锁定为 ${validRate}x`);
            });
        },

        setPlaybackRate(video, rate) {
            safeCall(() => {
                if (!video) return;
                const validRate = Math.max(0.25, Math.min(4, rate));
                this.protectPlaybackRate(video, validRate);
            });
        },

        async play(video) {
            return safeCall(async () => {
                if (!video) return false;
                for (let i = 0; i < 3; i++) {
                    try {
                        if (video.paused) {
                            video.muted = true;
                            await video.play();
                            if (settings?.speedMode === 'fast' && settings?.videoPlaybackRate && settings?.videoPlaybackRate !== 1) {
                                this.setPlaybackRate(video, settings.videoPlaybackRate);
                            }
                            Log.success('视频开始播放');
                            return true;
                        }
                        return true;
                    } catch (err) {
                        await sleep(1000);
                    }
                }
                return false;
            }, false);
        },

        setupAutoAdvance(video, onComplete) {
            safeCall(() => {
                if (!video) return;
                
                const handleEnded = () => {
                    Log.success('视频播放完成');
                    sessionStats.itemsCompleted = (sessionStats?.itemsCompleted || 0) + 1;
                    saveSessionStats();
                    Progress.updateDisplay();
                    setTimeout(onComplete, 2000);
                };

                video.addEventListener('ended', handleEnded);

                setInterval(() => {
                    safeCall(() => {
                        if (video && !video.ended && video.paused) {
                            this.play(video).catch(() => {});
                        }
                    });
                }, settings?.videoCheckInterval || 10000);

                const enableSound = () => {
                    try {
                        if (video.muted) video.muted = false;
                        document.removeEventListener('click', enableSound);
                    } catch (e) {}
                };
                document.addEventListener('click', enableSound);

                if (settings?.speedMode === 'fast' && settings?.videoPlaybackRate && settings?.videoPlaybackRate !== 1) {
                    this.setPlaybackRate(video, settings.videoPlaybackRate);
                }
            });
        }
    };

    // ==================== 学习项目 ====================
    const Item = {
        getAll() {
            return safeCall(() => {
                const selectors = [
                    '.course-content .activity',
                    '.section .activity',
                    '#region-main .activity'
                ];
                for (const sel of selectors) {
                    const items = document.querySelectorAll(sel);
                    if (items.length > 0) return Array.from(items);
                }
                return [];
            }, []);
        }
    };

    // ==================== 侧边栏 ====================
    const Sidebar = {
        find() {
            return safeCall(() => {
                return document.querySelector('#nav-drawer, .sidebar, .nav-sidebar');
            }, null);
        },

        getItems(sidebar) {
            return safeCall(() => {
                if (!sidebar) return [];
                const items = [];
                const seen = new Set();
                
                sidebar.querySelectorAll('.section .activity, .section .resource').forEach(activity => {
                    const link = activity.querySelector('a');
                    if (link && link.href?.includes('/mod/') && !seen.has(link.href)) {
                        seen.add(link.href);
                        items.push(link);
                    }
                });
                
                return items;
            }, []);
        },

        findCurrentIndex(items) {
            return safeCall(() => {
                if (!items || items.length === 0) return -1;
                const currentUrl = window.location.href;
                const currentId = currentUrl.split('id=')[1]?.split('&')[0];
                
                for (let i = 0; i < items.length; i++) {
                    if (!items[i]?.href) continue;
                    if (currentUrl === items[i].href) return i;
                    const itemId = items[i].href.split('id=')[1]?.split('&')[0];
                    if (currentId && currentId === itemId) return i;
                }
                return -1;
            }, -1);
        }
    };

    // ==================== 导航 ====================
    async function goToNextItem() {
        safeCall(async () => {
            Log.info('查找下一个学习项目...');
            
            const sidebar = Sidebar.find();
            if (sidebar) {
                const items = Sidebar.getItems(sidebar);
                const currentIndex = Sidebar.findCurrentIndex(items);
                
                if (currentIndex >= 0 && currentIndex < items.length - 1 && items[currentIndex + 1]?.href) {
                    Log.info(`跳转到下一个项目（${currentIndex + 2}/${items.length}）`);
                    await sleep(500);
                    window.location.href = items[currentIndex + 1].href;
                    return;
                }
            }
            
            Log.success('所有项目已完成！');
            pauseScript();
        });
    }

    // ==================== 页面处理 ====================
    async function processLearningItem() {
        safeCall(async () => {
            Log.info('处理学习项目页面...');
            AntiDetection.start();

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

            sessionStats.itemsCompleted = (sessionStats?.itemsCompleted || 0) + 1;
            saveSessionStats();
            Progress.updateDisplay();
            
            setTimeout(goToNextItem, settings?.pageWaitTime || 5000);
        });
    }

    async function processCoursePage() {
        safeCall(async () => {
            Log.info('处理课程页面...');
            Progress.updateDisplay();
            
            const items = Item.getAll();
            for (const item of items) {
                const link = item?.querySelector('a');
                if (link?.href) {
                    await sleep(500);
                    window.location.href = link.href;
                    return;
                }
            }
            
            Log.success('所有项目已完成！');
            pauseScript();
        });
    }

    // ==================== 控制 ====================
    function pauseScript() {
        safeCall(() => {
            scriptEnabled = false;
            localStorage.setItem(STORAGE_KEY.ENABLED, 'false');
            AntiDetection.stop();
            WakeLock.release();
            Log.success('脚本已暂停');
            updateButtonStates();
        });
    }

    function resumeScript() {
        safeCall(() => {
            scriptEnabled = true;
            localStorage.setItem(STORAGE_KEY.ENABLED, 'true');
            Log.info('脚本已恢复');
            updateButtonStates();
            init();
            
            if (settings?.wakeLock) {
                WakeLock.acquire();
            }
        });
    }

    function updateButtonStates() {
        safeCall(() => {
            const toggle = document.getElementById('ouchn-brusher-toggle');
            const startBtn = document.getElementById('ouchn-brusher-start');
            const stopBtn = document.getElementById('ouchn-brusher-stop');
            
            if (toggle) toggle.checked = scriptEnabled;
            if (startBtn) startBtn.disabled = scriptEnabled;
            if (stopBtn) stopBtn.disabled = !scriptEnabled;
        });
    }

    function updateStatus(msg, type) {
        safeCall(() => {
            const status = document.getElementById('ouchn-brusher-status');
            if (!status) return;
            status.textContent = msg;
            const colors = {
                success: { bg: '#e8f5e8', color: '#2e7d32' },
                warning: { bg: '#fff3e0', color: '#ef6c00' },
                info: { bg: '#f5f5f5', color: '#666' }
            };
            const c = colors[type] || colors.info;
            status.style.background = c.bg;
            status.style.color = c.color;
        });
    }

    function setSpeedMode(mode) {
        safeCall(() => {
            const config = SPEED_MODES[mode];
            if (!config) return;
            settings.speedMode = mode;
            settings.videoCheckInterval = config.videoCheck;
            settings.pageWaitTime = config.pageWait;
            saveSettings(settings);
            
            document.querySelectorAll('.speed-btn').forEach(btn => {
                const active = btn.dataset.mode === mode;
                btn.style.background = active ? '#4CAF50' : '#fff';
                btn.style.color = active ? '#fff' : '#333';
            });
            
            const playbackRateContainer = document.getElementById('playback-rate-container');
            if (playbackRateContainer) {
                if (mode === 'fast') {
                    playbackRateContainer.style.display = 'block';
                } else {
                    playbackRateContainer.style.display = 'none';
                    if (settings.videoPlaybackRate !== 1) {
                        settings.videoPlaybackRate = 1;
                        saveSettings(settings);
                        const video = Video.find();
                        if (video) {
                            Video.setPlaybackRate(video, 1);
                        }
                        document.querySelectorAll('.playback-rate-btn').forEach(btn => {
                            const active = parseFloat(btn.dataset.rate) === 1;
                            btn.style.background = active ? '#667eea' : '#fff';
                            btn.style.color = active ? '#fff' : '#666';
                        });
                        Log.info('已自动重置视频播放速度为1x');
                    }
                }
            }
            
            Log.success(`已切换到${config.name}模式`);
        });
    }

    function setVideoPlaybackRate(rate) {
        safeCall(() => {
            if (settings?.speedMode !== 'fast') {
                Log.warn('视频播放速度调节仅在快速模式下可用');
                return;
            }
            const validRate = Math.max(0.25, Math.min(4, rate));
            settings.videoPlaybackRate = validRate;
            saveSettings(settings);
            
            document.querySelectorAll('.playback-rate-btn').forEach(btn => {
                const active = parseFloat(btn.dataset.rate) === validRate;
                btn.style.background = active ? '#667eea' : '#fff';
                btn.style.color = active ? '#fff' : '#333';
            });
            
            const video = Video.find();
            if (video) {
                Video.setPlaybackRate(video, validRate);
            }
            
            Log.success(`视频播放速度已设置为 ${validRate}x`);
        });
    }

    // ==================== 位置管理 ====================
    const Position = {
        save() {
            safeCall(() => {
                if (!container) return;
                const transform = container.style.transform;
                const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
                if (!match) return;
                
                const x = parseFloat(match[1]);
                const y = parseFloat(match[2]);
                const windowWidth = document.documentElement.clientWidth;
                const containerWidth = container.offsetWidth;
                
                let edge = 'none';
                if (x < 10) edge = 'left';
                else if (x > windowWidth - containerWidth - 10) edge = 'right';
                
                localStorage.setItem(STORAGE_KEY.POSITION, JSON.stringify({
                    edge,
                    y: (y / window.innerHeight) * 100
                }));
            });
        },

        load() {
            return safeCall(() => {
                try {
                    const saved = localStorage.getItem(STORAGE_KEY.POSITION);
                    if (saved) {
                        const pos = JSON.parse(saved);
                        const windowWidth = document.documentElement.clientWidth;
                        const containerWidth = 50;
                        
                        let x = windowWidth - 60;
                        if (pos.edge === 'left') x = 0;
                        else if (pos.edge === 'right') x = windowWidth - containerWidth;
                        
                        let y = 100;
                        if (pos.y !== undefined) y = (pos.y / 100) * window.innerHeight;
                        
                        return { x, y };
                    }
                } catch (e) {}
                return { x: window.innerWidth - 60, y: 100 };
            }, { x: window.innerWidth - 60, y: 100 });
        },

        snap() {
            safeCall(() => {
                if (!container) return;
                const windowWidth = document.documentElement.clientWidth;
                const containerWidth = container.offsetWidth;
                
                const transform = container.style.transform;
                const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
                if (!match) return;
                
                let currentX = parseFloat(match[1]);
                let currentY = parseFloat(match[2]);
                
                const targetX = currentX + containerWidth / 2 < windowWidth / 2 ? 0 : windowWidth - containerWidth;
                const targetY = Math.max(0, Math.min(currentY, window.innerHeight - container.offsetHeight));
                
                container.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                container.style.transform = `translate(${targetX}px, ${targetY}px)`;
                
                setTimeout(() => this.save(), 300);
            });
        }
    };

    // ==================== 面板 ====================
    function createControlPanel() {
        safeCall(() => {
            if (document.getElementById('ouchn-brusher-container')) return;
            if (!document.body) return;

            scriptEnabled = localStorage.getItem(STORAGE_KEY.ENABLED) !== 'false';

            const pos = Position.load();
            
            container = document.createElement('div');
            container.id = 'ouchn-brusher-container';
            container.style.cssText = `
                position: fixed; left: 0; top: 0;
                transform: translate(${pos.x}px, ${pos.y}px);
                z-index: 999999; font-family: Arial, sans-serif;
                transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease;
                user-select: none; touch-action: none; will-change: transform;
            `;

            // 悬浮按钮 - 现代渐变设计
            button = document.createElement('div');
            button.style.cssText = `
                width: 56px; height: 56px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 16px;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset;
                color: white; font-size: 26px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
            `;
            button.innerHTML = '🎓';
            
            // 按钮悬停效果
            button.addEventListener('mouseenter', () => {
                safeCall(() => {
                    button.style.transform = 'scale(1.05)';
                    button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5), 0 0 0 1px rgba(255,255,255,0.2) inset';
                });
            });
            button.addEventListener('mouseleave', () => {
                safeCall(() => {
                    button.style.transform = 'scale(1)';
                    button.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset';
                });
            });

            // 面板 - 现代卡片设计
            panel = document.createElement('div');
            panel.id = 'ouchn-brusher-panel';
            panel.style.cssText = `
                position: absolute; top: 0; right: 68px; width: 300px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.5) inset;
                font-size: 14px; display: none;
                overflow: hidden;
            `;

            panel.innerHTML = `
                <div style="padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
                    <span style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 18px;">🎓</span>
                        <span>刷课助手 v1.6.2</span>
                    </span>
                    <button id="ouchn-brusher-close" style="background: rgba(255,255,255,0.2); border: none; color: white; cursor: pointer; font-size: 16px; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">✕</button>
                </div>
                <div style="padding: 16px;">
                    <!-- 进度卡片 -->
                    <div id="ouchn-brusher-progress" style="margin-bottom: 16px; padding: 14px; background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%); border-radius: 12px; border: 1px solid rgba(0,0,0,0.05);">
                        <div style="text-align: center; color: #888; font-size: 13px;">正在加载进度...</div>
                    </div>
                    
                    <!-- 速度模式 - 分段控制器 -->
                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 8px; font-weight: 500;">⚡ 速度模式</div>
                        <div style="display: flex; background: #f0f0f0; border-radius: 10px; padding: 4px; gap: 4px;">
                            <button class="speed-btn" data-mode="normal" style="flex: 1; padding: 8px 4px; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; background: ${settings?.speedMode === 'normal' ? '#fff' : 'transparent'}; color: ${settings?.speedMode === 'normal' ? '#667eea' : '#666'}; box-shadow: ${settings?.speedMode === 'normal' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'};">🐢 正常</button>
                            <button class="speed-btn" data-mode="fast" style="flex: 1; padding: 8px 4px; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; background: ${settings?.speedMode === 'fast' ? '#fff' : 'transparent'}; color: ${settings?.speedMode === 'fast' ? '#667eea' : '#666'}; box-shadow: ${settings?.speedMode === 'fast' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'};">🚀 快速</button>
                            <button class="speed-btn" data-mode="stealth" style="flex: 1; padding: 8px 4px; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; background: ${settings?.speedMode === 'stealth' ? '#fff' : 'transparent'}; color: ${settings?.speedMode === 'stealth' ? '#667eea' : '#666'}; box-shadow: ${settings?.speedMode === 'stealth' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'};">🥷 低调</button>
                        </div>
                    </div>
                    
                    <!-- 视频播放速度 -->
                    <div id="playback-rate-container" style="margin-bottom: 16px; display: ${settings?.speedMode === 'fast' ? 'block' : 'none'};">
                        <div style="font-size: 12px; color: #666; margin-bottom: 8px; font-weight: 500;">🎬 视频播放速度</div>
                        <div style="display: flex; background: #f0f0f0; border-radius: 10px; padding: 4px; gap: 4px;">
                            <button class="playback-rate-btn" data-rate="1" style="flex: 1; padding: 8px 4px; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; background: ${settings?.videoPlaybackRate === 1 ? '#667eea' : '#fff'}; color: ${settings?.videoPlaybackRate === 1 ? '#fff' : '#666'}; box-shadow: ${settings?.videoPlaybackRate === 1 ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'};">1x</button>
                            <button class="playback-rate-btn" data-rate="1.5" style="flex: 1; padding: 8px 4px; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; background: ${settings?.videoPlaybackRate === 1.5 ? '#667eea' : '#fff'}; color: ${settings?.videoPlaybackRate === 1.5 ? '#fff' : '#666'}; box-shadow: ${settings?.videoPlaybackRate === 1.5 ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'};">1.5x</button>
                            <button class="playback-rate-btn" data-rate="2" style="flex: 1; padding: 8px 4px; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; background: ${settings?.videoPlaybackRate === 2 ? '#667eea' : '#fff'}; color: ${settings?.videoPlaybackRate === 2 ? '#fff' : '#666'}; box-shadow: ${settings?.videoPlaybackRate === 2 ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'};">2x</button>
                            <button class="playback-rate-btn" data-rate="3" style="flex: 1; padding: 8px 4px; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; background: ${settings?.videoPlaybackRate === 3 ? '#667eea' : '#fff'}; color: ${settings?.videoPlaybackRate === 3 ? '#fff' : '#666'}; box-shadow: ${settings?.videoPlaybackRate === 3 ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'};">3x</button>
                        </div>
                    </div>
                    
                    <!-- 开关组 -->
                    <div style="background: #f8f9fa; border-radius: 12px; padding: 12px; margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <span style="font-size: 13px; color: #444; display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 14px;">🔒</span> 防息屏
                            </span>
                            <label class="switch" style="position: relative; display: inline-block; width: 52px; height: 28px;">
                                <input type="checkbox" id="ouchn-wakelock-toggle" ${settings?.wakeLock ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="slider ${settings?.wakeLock ? 'active' : ''}" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #e0e0e0; transition: all 0.3s; border-radius: 28px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);"></span>
                            </label>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <span style="font-size: 13px; color: #444; display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 14px;">🛡️</span> 防检测模式
                            </span>
                            <label class="switch" style="position: relative; display: inline-block; width: 52px; height: 28px;">
                                <input type="checkbox" id="ouchn-anti-detection" ${settings?.antiDetection ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="slider ${settings?.antiDetection ? 'active' : ''}" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #e0e0e0; transition: all 0.3s; border-radius: 28px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);"></span>
                            </label>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 13px; color: #444; display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 14px;">▶️</span> 启用脚本
                            </span>
                            <label class="switch" style="position: relative; display: inline-block; width: 52px; height: 28px;">
                                <input type="checkbox" id="ouchn-brusher-toggle" ${scriptEnabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="slider ${scriptEnabled ? 'active' : ''}" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #e0e0e0; transition: all 0.3s; border-radius: 28px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);"></span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- 状态 -->
                    <div id="ouchn-brusher-status" style="padding: 10px 12px; background: ${scriptEnabled ? 'rgba(102, 126, 234, 0.1)' : 'rgba(150, 150, 150, 0.1)'}; border-radius: 10px; margin-bottom: 16px; font-size: 12px; color: ${scriptEnabled ? '#667eea' : '#666'}; font-weight: 500; text-align: center; border: 1px solid ${scriptEnabled ? 'rgba(102, 126, 234, 0.2)' : 'rgba(150, 150, 150, 0.2)'};">
                        ${scriptEnabled ? '✅ 脚本运行中' : '⏸️ 脚本已暂停'}
                    </div>
                    
                    <!-- 控制按钮 -->
                    <div style="display: flex; gap: 10px;">
                        <button id="ouchn-brusher-start" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s; opacity: ${scriptEnabled ? '0.5' : '1'}; pointer-events: ${scriptEnabled ? 'none' : 'auto'}; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);" onmouseover="if(!this.disabled) this.style.transform='translateY(-2px)'" onmouseout="if(!this.disabled) this.style.transform='translateY(0)'" ${scriptEnabled ? 'disabled' : ''}>▶️ 开始</button>
                        <button id="ouchn-brusher-stop" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s; opacity: ${!scriptEnabled ? '0.5' : '1'}; pointer-events: ${!scriptEnabled ? 'none' : 'auto'}; box-shadow: 0 4px 12px rgba(245, 87, 108, 0.3);" onmouseover="if(!this.disabled) this.style.transform='translateY(-2px)'" onmouseout="if(!this.disabled) this.style.transform='translateY(0)'" ${!scriptEnabled ? 'disabled' : ''}>⏹️ 停止</button>
                    </div>
                </div>
            `;

            // 全局样式
            const style = document.createElement('style');
            style.textContent = `
                /* 开关 - 禁用状态（灰色） */
                .slider { background: #e0e0e0 !important; }
                
                /* 开关 - 启用状态（主题紫色） */
                .slider.active,
                .switch input:checked + .slider { 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important; 
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4), inset 0 1px 2px rgba(255,255,255,0.2) !important;
                }
                
                /* 开关圆点 */
                .slider:before { 
                    content: ""; 
                    position: absolute; 
                    height: 22px; 
                    width: 22px; 
                    left: 3px; 
                    bottom: 3px; 
                    background: white; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                    border-radius: 50%; 
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                
                /* 启用时圆点位置 */
                .slider.active:before,
                .switch input:checked + .slider:before { 
                    transform: translateX(24px); 
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                }
                
                /* 速度按钮悬停 */
                .speed-btn:hover { background: rgba(102, 126, 234, 0.1) !important; }
                
                /* 开关悬停效果 */
                .switch:hover .slider { 
                    filter: brightness(1.05);
                }
            `;
            safeCall(() => document.head?.appendChild(style));

            container.appendChild(button);
            container.appendChild(panel);
            document.body.appendChild(container);

            // 事件绑定
            let isOpen = false;
            let isDragging = false;

            button.addEventListener('click', (e) => {
                safeCall(() => {
                    if (isDragging) { isDragging = false; return; }
                    e.stopPropagation();
                    
                    const rect = container.getBoundingClientRect();
                    const centerX = window.innerWidth / 2;
                    panel.style.left = rect.left < centerX ? '60px' : 'auto';
                    panel.style.right = rect.left < centerX ? 'auto' : '60px';
                    
                    panel.style.display = isOpen ? 'none' : 'block';
                    isOpen = !isOpen;
                    Progress.updateDisplay();
                });
            });

            safeCall(() => {
                const closeBtn = document.getElementById('ouchn-brusher-close');
                if (closeBtn) {
                    closeBtn.onclick = () => {
                        safeCall(() => {
                            panel.style.display = 'none';
                            isOpen = false;
                        });
                    };
                }
            });

            safeCall(() => {
                const toggle = document.getElementById('ouchn-brusher-toggle');
                if (toggle) {
                    toggle.onchange = function() {
                        safeCall(() => {
                            const slider = this.parentElement.querySelector('.slider');
                            if (this.checked) {
                                slider.classList.add('active');
                                resumeScript();
                            } else {
                                slider.classList.remove('active');
                                pauseScript();
                            }
                        });
                    };
                }
            });

            safeCall(() => {
                const antiDetect = document.getElementById('ouchn-anti-detection');
                if (antiDetect) {
                    antiDetect.onchange = function() {
                        safeCall(() => {
                            const slider = this.parentElement.querySelector('.slider');
                            if (this.checked) {
                                slider.classList.add('active');
                            } else {
                                slider.classList.remove('active');
                            }
                            settings.antiDetection = this.checked;
                            saveSettings(settings);
                        });
                    };
                }
            });

            safeCall(() => {
                const wakelockToggle = document.getElementById('ouchn-wakelock-toggle');
                if (wakelockToggle) {
                    wakelockToggle.onchange = function() {
                        safeCall(() => {
                            const slider = this.parentElement.querySelector('.slider');
                            if (this.checked) {
                                slider.classList.add('active');
                            } else {
                                slider.classList.remove('active');
                            }
                            settings.wakeLock = this.checked;
                            saveSettings(settings);
                            
                            if (scriptEnabled) {
                                if (this.checked) {
                                    WakeLock.acquire();
                                } else {
                                    WakeLock.release();
                                }
                            }
                        });
                    };
                }
            });

            safeCall(() => {
                const startBtn = document.getElementById('ouchn-brusher-start');
                if (startBtn) startBtn.onclick = resumeScript;
            });

            safeCall(() => {
                const stopBtn = document.getElementById('ouchn-brusher-stop');
                if (stopBtn) stopBtn.onclick = pauseScript;
            });

            safeCall(() => {
                document.querySelectorAll('.speed-btn').forEach(btn => {
                    btn.onclick = () => safeCall(() => setSpeedMode(btn.dataset.mode));
                });
            });

            safeCall(() => {
                document.querySelectorAll('.playback-rate-btn').forEach(btn => {
                    btn.onclick = () => safeCall(() => setVideoPlaybackRate(parseFloat(btn.dataset.rate)));
                });
            });

            // 悬停效果
            let hideTimer;
            container.addEventListener('mouseenter', () => {
                safeCall(() => {
                    clearTimeout(hideTimer);
                    container.style.opacity = '1';
                });
            });
            container.addEventListener('mouseleave', () => {
                safeCall(() => {
                    hideTimer = setTimeout(() => container.style.opacity = '0.6', 500);
                });
            });

            // 拖拽
            let startX, startY, offsetX, offsetY;

            const onMove = (e) => {
                safeCall(() => {
                    e.preventDefault();
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                    
                    if (!isDragging) {
                        const dist = Math.sqrt(Math.pow(clientX - startX, 2) + Math.pow(clientY - startY, 2));
                        if (dist > 5) isDragging = true;
                        else return;
                    }
                    
                    const newX = Math.max(0, Math.min(clientX - offsetX, window.innerWidth - 50));
                    const newY = Math.max(0, Math.min(clientY - offsetY, window.innerHeight - 50));
                    container.style.transform = `translate(${newX}px, ${newY}px)`;
                });
            };

            const onEnd = () => {
                safeCall(() => {
                    if (isDragging) Position.snap();
                    isDragging = false;
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onEnd);
                });
            };

            const onStart = (e) => {
                safeCall(() => {
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                    startX = clientX;
                    startY = clientY;
                    
                    const rect = container.getBoundingClientRect();
                    offsetX = clientX - rect.left;
                    offsetY = clientY - rect.top;
                    
                    container.style.transition = 'none';
                    clearTimeout(hideTimer);
                    
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onEnd);
                });
            };

            button.addEventListener('mousedown', onStart);

            document.addEventListener('click', (e) => {
                safeCall(() => {
                    if (!container.contains(e.target) && isOpen) {
                        panel.style.display = 'none';
                        isOpen = false;
                    }
                });
            });
        });
    }

    // ==================== 初始化 ====================
    async function init() {
        safeCall(async () => {
            createControlPanel();
            
            setTimeout(() => Progress.updateDisplay(), 100);

            if (!scriptEnabled) {
                Log.warn('脚本已禁用');
                return;
            }

            if (initialized) return;
            initialized = true;

            Log.success('脚本已启动');

            await sleep(100);
            Position.snap();
            await sleep(900);

            const url = window.location.href;
            
            if (url.includes('/course/view.php')) {
                await processCoursePage();
            } else if (url.includes('/mod/')) {
                await processLearningItem();
            }
        });
    }

    // ==================== 启动 ====================
    window.addEventListener('DOMContentLoaded', () => safeCall(() => setTimeout(init, 1000)));
    window.addEventListener('load', () => safeCall(() => !initialized && setTimeout(init, 500)));
    window.addEventListener('hashchange', () => safeCall(() => { initialized = false; setTimeout(init, 1000); }));
    
    let resizeTimer;
    window.addEventListener('resize', () => {
        safeCall(() => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                safeCall(() => {
                    const pos = Position.load();
                    if (container) {
                        container.style.transition = 'none';
                        container.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
                    }
                });
            }, 100);
        });
    });

    // 定期更新进度
    setInterval(() => {
        safeCall(() => {
            if (document.getElementById('ouchn-brusher-progress')) {
                Progress.updateDisplay();
            }
        });
    }, 5000);

})();
