// ==UserScript==
// @name         国家开放大学实验学院自动刷课脚本
// @namespace    https://github.com
// @version      1.2
// @description  自动刷完学习项目
// @author       You
// @match        https://moodle.syxy.ouchn.cn/mod/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://github.com/lucky845/ouchn-course-brusher-script/raw/refs/heads/main/ouchn-course-brusher.user.js
// @updateURL    https://github.com/lucky845/ouchn-course-brusher-script/raw/refs/heads/main/ouchn-course-brusher.user.js
// ==/UserScript==

(function() {
    'use strict';

    // 防止页面刷新时重复执行
    let initialized = false;
    
    // 脚本运行状态
    let scriptEnabled = true;
    
    // localStorage键名
    const STORAGE_KEY_ENABLED = 'ouchn_brusher_enabled';
    const STORAGE_KEY_POSITION = 'ouchn_brusher_position';
    
    // 从localStorage读取脚本开关状态
    function loadScriptEnabled() {
        const saved = localStorage.getItem(STORAGE_KEY_ENABLED);
        if (saved !== null) {
            return saved === 'true';
        }
        return true;
    }
    
    // 保存脚本开关状态到localStorage
    function saveScriptEnabled(enabled) {
        localStorage.setItem(STORAGE_KEY_ENABLED, enabled.toString());
    }
    
    // 从localStorage读取悬浮窗位置（百分比）
    function loadPanelPosition() {
        const saved = localStorage.getItem(STORAGE_KEY_POSITION);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return null;
            }
        }
        return null;
    }
    
    // 保存悬浮窗位置到localStorage（百分比）
    function savePanelPosition(x, y) {
        // 转换为百分比
        var percentX = (x / window.innerWidth) * 100;
        var percentY = (y / window.innerHeight) * 100;
        localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify({ x: percentX, y: percentY }));
    }
    
    // 重置悬浮窗位置
    function resetPanelPosition() {
        localStorage.removeItem(STORAGE_KEY_POSITION);
    }
    
    // 创建悬浮控制窗口
    function createControlPanel() {
        // 检查是否已存在控制窗口
        if (document.getElementById('ouchn-brusher-container')) {
            return;
        }
        
        // 读取保存的开关状态
        scriptEnabled = loadScriptEnabled();
        
        // 创建容器
        const container = document.createElement('div');
        container.id = 'ouchn-brusher-container';
        
        // 读取保存的位置
        const savedPos = loadPanelPosition();
        let initialX = window.innerWidth - 60; // 默认在右边缘
        let initialY = 100; // 默认在顶部下方100px
        
        if (savedPos) {
            // 检查保存的位置是否合理（百分比值应该在0-100之间）
            if (savedPos.x >= 0 && savedPos.x <= 100 &&
                savedPos.y >= 0 && savedPos.y <= 100) {
                initialX = savedPos.x + '%';
                initialY = savedPos.y + '%';
            } else {
                // 如果位置不合理，重置位置
                resetPanelPosition();
            }
        }
        
        // 判断是否为百分比值
        const isPercentX = typeof initialX === 'string' && initialX.endsWith('%');
        const isPercentY = typeof initialY === 'string' && initialY.endsWith('%');
        
        container.style.cssText = `
            position: fixed;
            left: ${initialX}${isPercentX ? '' : 'px'};
            top: ${initialY}${isPercentY ? '' : 'px'};
            z-index: 999999;
            font-family: Arial, sans-serif;
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            transform-origin: top left;
        `;
        
        // 创建小圆球按钮（用于缩放状态）
        const button = document.createElement('div');
        button.id = 'ouchn-brusher-button';
        button.style.cssText = `
            width: 50px;
            height: 50px;
            background: #4CAF50;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            color: white;
            font-size: 24px;
            z-index: 999999;
            position: relative;
        `;
        button.textContent = '📚'; // 书籍图标
        
        // 创建控制窗口
        const panel = document.createElement('div');
        panel.id = 'ouchn-brusher-panel';
        panel.style.cssText = `
            position: absolute;
            top: 0;
            right: 60px; /* 默认位于按钮左侧 */
            width: 280px;
            background: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            font-size: 14px;
            display: none;
            z-index: 999998;
            padding: 10px;
        `;
        
        // 创建标题栏
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 12px;
            background: #4CAF50;
            color: white;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        `;
        header.innerHTML = `
            <span>刷课脚本控制</span>
            <button id="ouchn-brusher-close" style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 16px;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">×</button>
        `;
        
        // 创建内容区域
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 12px;
        `;
        
        // 创建启用/禁用开关
        const toggleDiv = document.createElement('div');
        toggleDiv.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        `;
        toggleDiv.innerHTML = `
            <span>启用刷课脚本</span>
            <label class="switch">
                <input type="checkbox" id="ouchn-brusher-toggle" ${scriptEnabled ? 'checked' : ''}>
                <span class="slider round"></span>
            </label>
        `;
        
        // 创建状态显示
        const statusDiv = document.createElement('div');
        statusDiv.id = 'ouchn-brusher-status';
        statusDiv.style.cssText = `
            padding: 8px;
            background: #f5f5f5;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 12px;
            color: #666;
        `;
        statusDiv.textContent = scriptEnabled ? '脚本已启用，等待页面加载...' : '脚本已禁用';
        
        // 创建操作按钮
        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.cssText = `
            display: flex;
            gap: 8px;
        `;
        
        const startButton = document.createElement('button');
        startButton.id = 'ouchn-brusher-start';
        startButton.textContent = '开始刷课';
        startButton.style.cssText = `
            flex: 1;
            padding: 8px 12px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        
        const stopButton = document.createElement('button');
        stopButton.id = 'ouchn-brusher-stop';
        stopButton.textContent = '停止刷课';
        stopButton.style.cssText = `
            flex: 1;
            padding: 8px 12px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        
        // 组装控制窗口
        buttonsDiv.appendChild(startButton);
        buttonsDiv.appendChild(stopButton);
        content.appendChild(toggleDiv);
        content.appendChild(statusDiv);
        content.appendChild(buttonsDiv);
        panel.appendChild(header);
        panel.appendChild(content);
        
        // 组装容器
        container.appendChild(button);
        container.appendChild(panel);
        
        // 添加到页面
        document.body.appendChild(container);
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .switch {
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
            }
            
            .switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            .slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: .4s;
            }
            
            .slider:before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .4s;
            }
            
            input:checked + .slider {
                background-color: #4CAF50;
            }
            
            input:focus + .slider {
                box-shadow: 0 0 1px #4CAF50;
            }
            
            input:checked + .slider:before {
                transform: translateX(20px);
            }
            
            .slider.round {
                border-radius: 24px;
            }
            
            .slider.round:before {
                border-radius: 50%;
            }
            
            #ouchn-brusher-container {
                transition: all 0.3s ease;
            }
            
            #ouchn-brusher-container.dragging {
                opacity: 0.8;
                transition: none;
            }
            
            #ouchn-brusher-container.dragging #ouchn-brusher-button {
                cursor: grabbing;
            }
        `;
        document.head.appendChild(style);
        
        // 展开/收起面板
        let isPanelOpen = false; // 默认关闭
        // 初始状态为可见（不最小化）
        // 移除默认的minimized类，让用户能看到悬浮窗
        // container.classList.add('minimized');
        
        button.onclick = function(e) {
            e.stopPropagation(); // 防止事件冒泡
            // 只有当不是拖拽状态时才切换面板
            if (!isActuallyDragging) {
                if (isPanelOpen) {
                    panel.style.display = 'none';
                    isPanelOpen = false;
                } else {
                    // 根据悬浮窗位置动态调整面板位置
                    var rect = container.getBoundingClientRect();
                    var windowWidth = document.documentElement.clientWidth;
                    var centerX = windowWidth / 2;
                    
                    if (rect.left < centerX) {
                        // 在左侧，面板显示在按钮右侧
                        panel.style.right = 'auto';
                        panel.style.left = '60px';
                    } else {
                        // 在右侧，面板显示在按钮左侧
                        panel.style.left = 'auto';
                        panel.style.right = '60px';
                    }
                    
                    panel.style.display = 'block';
                    isPanelOpen = true;
                }
            }
        };
        
        // 点击面板外部只关闭面板（不改变最小化状态）
        document.addEventListener('click', function(event) {
            if (!container.contains(event.target)) {
                if (isPanelOpen) {
                    panel.style.display = 'none';
                    isPanelOpen = false;
                }
            }
        });
        
        // 防止面板内部点击导致关闭
        panel.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        
        // 添加事件监听器
        document.getElementById('ouchn-brusher-close').onclick = function(e) {
            e.stopPropagation();
            panel.style.display = 'none';
            isPanelOpen = false;
        };
        
        // 更新按钮状态
        function updateButtonStates() {
            const startButton = document.getElementById('ouchn-brusher-start');
            const stopButton = document.getElementById('ouchn-brusher-stop');
            
            if (scriptEnabled) {
                startButton.disabled = true;
                startButton.style.opacity = '0.5';
                startButton.style.cursor = 'not-allowed';
                stopButton.disabled = false;
                stopButton.style.opacity = '1';
                stopButton.style.cursor = 'pointer';
            } else {
                startButton.disabled = false;
                startButton.style.opacity = '1';
                startButton.style.cursor = 'pointer';
                stopButton.disabled = true;
                stopButton.style.opacity = '0.5';
                stopButton.style.cursor = 'not-allowed';
            }
        }
        
        // 初始化按钮状态
        updateButtonStates();
        
        document.getElementById('ouchn-brusher-toggle').onchange = function() {
            scriptEnabled = this.checked;
            saveScriptEnabled(scriptEnabled); // 保存状态
            const status = document.getElementById('ouchn-brusher-status');
            if (scriptEnabled) {
                status.textContent = '脚本已启用，等待页面加载...';
                status.style.background = '#f5f5f5';
                status.style.color = '#666';
            } else {
                status.textContent = '脚本已禁用';
                status.style.background = '#ffebee';
                status.style.color = '#c62828';
            }
            // 更新按钮状态
            updateButtonStates();
        };
        
        document.getElementById('ouchn-brusher-start').onclick = function() {
            scriptEnabled = true;
            saveScriptEnabled(true); // 保存状态
            document.getElementById('ouchn-brusher-toggle').checked = true;
            const status = document.getElementById('ouchn-brusher-status');
            status.textContent = '开始刷课...';
            status.style.background = '#e8f5e8';
            status.style.color = '#2e7d32';
            
            // 更新按钮状态
            updateButtonStates();
            
            // 重新初始化脚本
            initialized = false;
            init();
        };
        
        document.getElementById('ouchn-brusher-stop').onclick = function() {
            scriptEnabled = false;
            saveScriptEnabled(false); // 保存状态
            document.getElementById('ouchn-brusher-toggle').checked = false;
            const status = document.getElementById('ouchn-brusher-status');
            status.textContent = '脚本已停止';
            status.style.background = '#ffebee';
            status.style.color = '#c62828';
            
            // 更新按钮状态
            updateButtonStates();
        };
        
        // 拖拽功能 - 简化版
        var dragOffsetX = 0;
        var dragOffsetY = 0;
        var hideTimer = null;
        
        // 鼠标悬停事件处理
        container.addEventListener('mouseenter', function() {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            // 鼠标靠近时显示完整浮窗并恢复透明度
            container.style.transition = 'all 0.3s ease';
            container.style.transform = 'translateX(0)';
            container.style.opacity = '1';
        });
        
        // 鼠标离开时开始隐藏计时器
        container.addEventListener('mouseleave', function() {
            // 鼠标离开后，开始隐藏计时器，0.5秒后才隐藏
            hideTimer = setTimeout(function() {
                // 只降低透明度，不缩入侧边，确保悬浮窗始终可见
                container.style.transition = 'opacity 0.3s ease';
                container.style.transform = 'translateX(0)'; // 重置transform
                container.style.opacity = '0.6';
            }, 500);
        });
        
        // 为按钮和标题栏添加拖拽事件
        var startX, startY;
        var isActuallyDragging = false;
        
        function startDrag(e) {
            container.style.transition = 'none'; // 拖拽时禁用动画
            
            var clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            var clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            
            startX = clientX;
            startY = clientY;
            isActuallyDragging = false;
            
            var rect = container.getBoundingClientRect();
            dragOffsetX = clientX - rect.left;
            dragOffsetY = clientY - rect.top;
            
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            
            // 显示完整浮窗
            container.style.transform = 'translateX(0)';
            container.style.opacity = '1';
            
            e.preventDefault();
        }
        
        function doDrag(e) {
            // 确保只处理鼠标或触摸事件
            if (!e.clientX && !e.touches) return;
            
            var clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            var clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            
            // 检查是否真正开始拖拽（移动超过5像素）
            if (!isActuallyDragging) {
                var distance = Math.sqrt(Math.pow(clientX - startX, 2) + Math.pow(clientY - startY, 2));
                if (distance > 5) {
                    isActuallyDragging = true;
                } else {
                    return;
                }
            }
            
            var newX = clientX - dragOffsetX;
            var newY = clientY - dragOffsetY;
            
            // 限制在视口内，确保不会超出屏幕边缘
            // 使用实际可视区域大小，以适应控制台的存在
            var containerWidth = container.offsetWidth;
            var containerHeight = container.offsetHeight;
            var windowWidth = document.documentElement.clientWidth;
            var windowHeight = document.documentElement.clientHeight;
            var maxX = windowWidth - containerWidth;
            var maxY = windowHeight - containerHeight;
            
            // 确保坐标在有效范围内
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));
            
            container.style.left = newX + 'px';
            container.style.top = newY + 'px';
            
            e.preventDefault();
        }
        
        function endDrag() {
            if (isActuallyDragging) {
                container.style.transition = 'all 0.3s ease'; // 恢复动画
                
                // 保存位置
                var rect = container.getBoundingClientRect();
                savePanelPosition(rect.left, rect.top);
                
                // 自动吸附到最近的边缘（只有在靠近边缘时才吸附）
                // 使用requestAnimationFrame优化性能
                requestAnimationFrame(snapToEdge);
            }
            isActuallyDragging = false;
        }
        
        // 物理磁吸系统
        function snapToEdge() {
            var rect = container.getBoundingClientRect();
            // 使用实际可视区域大小，而不是整个屏幕尺寸，以适应控制台的存在
            var windowWidth = document.documentElement.clientWidth;
            var windowHeight = document.documentElement.clientHeight;
            var containerWidth = container.offsetWidth;
            var containerHeight = container.offsetHeight;
            
            // 吸附阈值（像素）
            var snapThreshold = 80;
            
            // 计算距离各边缘的距离
            var distanceToLeft = rect.left;
            var distanceToRight = windowWidth - rect.right;
            var distanceToTop = rect.top;
            var distanceToBottom = windowHeight - rect.bottom;
            
            // 检查是否靠近任何边缘
            var isNearEdge = distanceToLeft < snapThreshold || distanceToRight < snapThreshold || 
                           distanceToTop < snapThreshold || distanceToBottom < snapThreshold;
            
            if (isNearEdge) {
                var targetX = parseInt(container.style.left) || 0;
                var targetY = parseInt(container.style.top) || 0;
                
                // 水平吸附逻辑
                if (distanceToLeft < snapThreshold) {
                    // 吸附到左边缘，但保持完全可见
                    targetX = 0;
                } else if (distanceToRight < snapThreshold) {
                    // 吸附到右边缘，但保持完全可见
                    targetX = windowWidth - containerWidth;
                }
                
                // 垂直吸附逻辑
                if (distanceToTop < snapThreshold) {
                    // 吸附到上边缘，但保持完全可见
                    targetY = 0;
                } else if (distanceToBottom < snapThreshold) {
                    // 吸附到下边缘，但保持完全可见
                    targetY = windowHeight - containerHeight;
                }
                
                // 确保容器完全在视口内
                targetX = Math.max(0, Math.min(targetX, windowWidth - containerWidth));
                targetY = Math.max(0, Math.min(targetY, windowHeight - containerHeight));
                
                // 应用平滑过渡
                container.style.transition = 'left 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                container.style.left = targetX + 'px';
                container.style.top = targetY + 'px';
                container.style.opacity = '1'; // 吸附时保持完全可见
                
                // 保存吸附后的位置
                setTimeout(function() {
                    var newRect = container.getBoundingClientRect();
                    savePanelPosition(newRect.left, newRect.top);
                }, 200);
            } else {
                // 非靠近边缘时，只降低透明度
                container.style.transition = 'opacity 0.3s ease';
                container.style.opacity = '0.6';
            }
        }
        
        // 拖拽事件处理函数
        function setupDragEvents() {
            // 开始拖拽时添加移动和结束事件监听器
            function startDragWithEvents(e) {
                startDrag(e);
                
                // 添加移动事件监听器
                document.addEventListener('mousemove', doDrag);
                document.addEventListener('touchmove', doDrag, { passive: false });
                
                // 添加结束事件监听器
                function endDragWithCleanup(e) {
                    endDrag(e);
                    
                    // 移除事件监听器
                    document.removeEventListener('mousemove', doDrag);
                    document.removeEventListener('touchmove', doDrag);
                    document.removeEventListener('mouseup', endDragWithCleanup);
                    document.removeEventListener('touchend', endDragWithCleanup);
                    document.removeEventListener('mouseleave', endDragWithCleanup);
                    document.removeEventListener('touchcancel', endDragWithCleanup);
                }
                
                document.addEventListener('mouseup', endDragWithCleanup);
                document.addEventListener('touchend', endDragWithCleanup);
                document.addEventListener('mouseleave', endDragWithCleanup);
                document.addEventListener('touchcancel', endDragWithCleanup);
            }
            
            // 为按钮和标题栏添加开始拖拽事件
            button.addEventListener('mousedown', startDragWithEvents);
            button.addEventListener('touchstart', startDragWithEvents, { passive: false });
            header.addEventListener('mousedown', startDragWithEvents);
            header.addEventListener('touchstart', startDragWithEvents, { passive: false });
        }
        
        // 初始化拖拽事件
        setupDragEvents();
        
        // 点击面板外部关闭面板
        document.addEventListener('click', function(e) {
            if (!container.contains(e.target)) {
                panel.style.display = 'none';
            }
        });
        
        // 初始化状态
        // 从localStorage加载状态
        var savedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);
        if (savedEnabled !== null) {
            scriptEnabled = savedEnabled === 'true';
            document.getElementById('ouchn-brusher-toggle').checked = scriptEnabled;
        }
        
        // 加载保存的位置
        var loadedPos = loadPanelPosition();
        if (loadedPos) {
            container.style.left = loadedPos.x + '%';
            container.style.top = loadedPos.y + '%';
        }
        
        // 监听屏幕缩放事件，自动调整位置
        window.addEventListener('resize', function() {
            var currentLeft = parseFloat(container.style.left);
            var currentTop = parseFloat(container.style.top);
            
            // 如果是百分比已经设置好了，不需要调整
            // 如果是旧版本的像素值，需要转换为百分比
            if (container.style.left.indexOf('px') !== -1) {
                var newLeft = (currentLeft / window.innerWidth) * 100;
                var newTop = (currentTop / window.innerHeight) * 100;
                container.style.left = newLeft + '%';
                container.style.top = newTop + '%';
            }
        });
        
        // 初始状态为完全可见
        container.style.transform = 'translateX(0)';
        container.style.opacity = '1';
        
        // 确保容器在初始化时可见
        container.style.display = 'block';
    }
    
    // 更新状态信息
    function updateStatus(message, type = 'info') {
        const status = document.getElementById('ouchn-brusher-status');
        if (status) {
            status.textContent = message;
            
            switch (type) {
                case 'success':
                    status.style.background = '#e8f5e8';
                    status.style.color = '#2e7d32';
                    break;
                case 'error':
                    status.style.background = '#ffebee';
                    status.style.color = '#c62828';
                    break;
                case 'warning':
                    status.style.background = '#fff3e0';
                    status.style.color = '#ef6c00';
                    break;
                default:
                    status.style.background = '#f5f5f5';
                    status.style.color = '#666';
            }
        }
    }

    // 脚本初始化
    function init() {
        // 创建控制面板
        createControlPanel();
        
        // 检查脚本是否启用
        if (!scriptEnabled) {
            updateStatus('脚本已禁用', 'error');
            return;
        }
        
        if (initialized) {
            return;
        }
        initialized = true;
        updateStatus('脚本已启动，开始检查页面...', 'success');
        
        // 检查当前平台
        if (window.location.hostname === 'moodle.syxy.ouchn.cn') {
            updateStatus('检测到Moodle平台', 'info');
            setTimeout(() => {
                if (window.location.pathname.includes('/mod/')) {
                    // 在Moodle学习项目页面
                    updateStatus('当前页面是课程学习项目页面，开始处理...', 'info');
                    processMoodleLearningItem();
                }
            }, 2000);
        }
    }

    // 检查视频状态并自动播放
    function checkVideoStatus() {
        // 尝试多种选择器查找视频元素
        let videoElement = document.querySelector('video');
        if (!videoElement) {
            // 尝试查找iframe中的视频
            const iframe = document.querySelector('iframe');
            if (iframe) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    videoElement = iframeDoc.querySelector('video');
                } catch (e) {
                    // 忽略错误
                }
            }
        }
        
        if (videoElement) {
            // 确保视频已开始播放
            if (videoElement.paused) {
                try {
                    videoElement.play();
                } catch (e) {
                    // 忽略错误
                }
            }
            
            // 监听视频结束事件
            videoElement.addEventListener('ended', function() {
                // 等待页面更新后再处理下一个项目
                setTimeout(() => {
                    // 对于Moodle平台，返回课程页面并处理下一个项目
                    window.history.back();
                    setTimeout(() => {
                        processMoodleCourse();
                    }, 2000);
                }, 2000);
            });
            
            // 定期检查视频状态，确保视频在播放
            const videoCheckInterval = setInterval(() => {
                if (videoElement.paused && !videoElement.ended) {
                    try {
                        videoElement.play();
                    } catch (e) {
                        // 忽略错误
                    }
                } else if (videoElement.ended) {
                    clearInterval(videoCheckInterval);
                    setTimeout(() => {
                        // 对于Moodle平台，返回课程页面并处理下一个项目
                        window.history.back();
                        setTimeout(() => {
                            processMoodleCourse();
                        }, 2000);
                    }, 2000);
                }
            }, 10000); // 每10秒检查一次
        } else {
            // 检查是否为文档、网页内容或文件页面等
            const contentElements = document.querySelectorAll('.document-viewer, .pdf-viewer, .text-content, .resourcecontent, .mod-resource-content, .forum, .mod-forum-content, .page-content, .mod-page-content, .content');
            
            if (contentElements.length > 0) {
                // 对于网页内容或文件页面，等待5秒后继续
                setTimeout(() => {
                    // 对于Moodle平台，返回课程页面并处理下一个项目
                    window.history.back();
                    setTimeout(() => {
                        processMoodleCourse();
                    }, 2000);
                }, 5000);
            } else {
                // 对于其他类型，等待3秒后继续
                setTimeout(() => {
                    // 对于Moodle平台，返回课程页面并处理下一个项目
                    window.history.back();
                    setTimeout(() => {
                        processMoodleCourse();
                    }, 2000);
                }, 3000);
            }
        }
    }

    // 处理Moodle平台的课程详情页
    function processMoodleCourse() {
        // 查找课程内容区域
        const courseContent = document.querySelector('.course-content, .topics, .newgk-coursecontent');
        if (!courseContent) {
            return;
        }
        
        // 查找所有学习项目
        // 根据HTML结构，学习项目可能在.section或其他容器中
        const learningItems = courseContent.querySelectorAll('.activity, .resource, .modtype_resource, .modtype_url, .modtype_video, .section .activityinstance');
        
        // 需要用户手动操作的项目类型
        const manualActionTypes = [
            'forum', // 论坛/发帖
            'assign', // 作业
            'quiz', // 测验/答题
            'survey', // 调查
            'feedback', // 反馈
            'choice', // 选择
            'database', // 数据库
            'workshop' // 工作坊
        ];
        
        // 遍历学习项目，找到未完成的项目
        for (const item of learningItems) {
            // 检查项目是否已完成
            let isCompleted = false;
            
            // 方法1：检查完成状态元素
            const completionElement = item.querySelector('.completion-icon, .completionstate, .status');
            if (completionElement) {
                const completionClass = completionElement.className;
                const completionText = completionElement.textContent || completionElement.innerText;
                if (completionClass.includes('completed') || completionClass.includes('state-completed') || 
                    completionText.includes('已完成') || completionText.includes('完成')) {
                    isCompleted = true;
                }
            }
            
            // 方法2：检查项目是否有完成标记
            const completedMark = item.querySelector('.icon-check, .completion-complete, .completion-check');
            if (completedMark) {
                isCompleted = true;
            }
            
            if (!isCompleted) {
                // 检查项目类型，判断是否需要用户手动操作
                let requiresManualAction = false;
                const itemClass = item.className;
                const itemLink = item.querySelector('a');
                const itemHref = itemLink ? itemLink.href : '';
                
                // 检查项目类名和链接是否包含需要手动操作的类型
                for (const type of manualActionTypes) {
                    if (itemClass.includes(type) || itemHref.includes(`/mod/${type}/`)) {
                        requiresManualAction = true;
                        break;
                    }
                }
                
                if (requiresManualAction) {
                    continue; // 跳过需要手动操作的项目
                }
                
                // 查找项目链接
                let link = item.querySelector('a');
                if (!link) {
                    // 尝试查找父元素中的链接
                    link = item.closest('.activityinstance')?.querySelector('a');
                }
                if (link) {
                    link.click();
                    return;
                }
            }
        }
    }

    // 处理Moodle平台的学习项目页面
    function processMoodleLearningItem() {
        // 检查是否为视频类型
        const videoElement = document.querySelector('video');
        if (videoElement) {
            // 尝试自动播放视频（使用静音模式绕过Chrome的自动播放限制）
            function tryPlayVideo() {
                // 设置视频为静音，这样可以绕过Chrome的自动播放限制
                videoElement.muted = true;
                
                if (videoElement.paused) {
                    try {
                        videoElement.play();
                    } catch (e) {
                        // 5秒后继续，即使视频未播放
                        setTimeout(() => {
                            findNextItemInSidebar();
                        }, 5000);
                    }
                }
            }
            
            // 尝试自动播放
            tryPlayVideo();
            
            // 监听用户交互，当用户有任何触发时，取消静音
            document.addEventListener('click', function enableSound() {
                if (videoElement.muted) {
                    videoElement.muted = false;
                }
                // 只需要监听一次
                document.removeEventListener('click', enableSound);
            });
            
            // 也监听其他可能的用户交互事件
            document.addEventListener('keydown', function enableSound() {
                if (videoElement.muted) {
                    videoElement.muted = false;
                }
                // 只需要监听一次
                document.removeEventListener('keydown', enableSound);
            });
            
            // 监听视频结束事件
            videoElement.addEventListener('ended', function() {
                // 尝试在侧边栏找到下一个未完成的项目
                setTimeout(() => {
                    findNextItemInSidebar();
                }, 2000);
            });
            
            // 定期检查视频状态，确保视频在播放
            const videoCheckInterval = setInterval(() => {
                if (videoElement.paused && !videoElement.ended) {
                    try {
                        videoElement.play();
                    } catch (e) {
                        // 忽略错误
                    }
                } else if (videoElement.ended) {
                    clearInterval(videoCheckInterval);
                    setTimeout(() => {
                        findNextItemInSidebar();
                    }, 2000);
                }
            }, 10000); // 每10秒检查一次
        } else {
            // 检查是否为网页内容、文件页面或论坛等
            // 增加更多选择器以匹配不同类型的页面
            const contentElements = document.querySelectorAll(
                '.resourcecontent, .mod-resource-content, .forum, .mod-forum-content, .page-content, .mod-page-content, .content, ' +
                '#page-content, .main-content, .region-content, .course-content, .forum-content, .discussion-content'
            );
            
            // 检查页面URL是否包含特定路径，以识别不同类型的页面
            const isForumPage = window.location.pathname.includes('/mod/forum/');
            const isResourcePage = window.location.pathname.includes('/mod/resource/');
            const isPagePage = window.location.pathname.includes('/mod/page/');
            
            // 如果找到内容元素或通过URL识别为特定类型的页面
            if (contentElements.length > 0 || isForumPage || isResourcePage || isPagePage) {
                // 对于网页内容或文件页面，等待5秒后继续
                setTimeout(() => {
                    // 尝试在侧边栏找到下一个未完成的项目
                    findNextItemInSidebar();
                }, 5000);
            } else {
                // 对于其他类型，等待3秒后继续
                setTimeout(() => {
                    // 尝试在侧边栏找到下一个未完成的项目
                    findNextItemInSidebar();
                }, 3000);
            }
        }
    }

    // 在侧边栏中寻找下一个未完成的学习项目
    function findNextItemInSidebar() {
        // 尝试查找侧边栏容器
        const sidebar = document.querySelector('#nav-drawer, .sidebar, .nav-sidebar');
        if (!sidebar) {
            // 尝试返回课程页面
            if (document.referrer && document.referrer.includes('/course/view.php')) {
                window.location.href = document.referrer;
            } else {
                // 如果没有referrer，尝试从URL中提取课程ID并构建课程页面URL
                const courseIdMatch = window.location.search.match(/id=(\d+)/);
                if (courseIdMatch) {
                    const courseId = courseIdMatch[1];
                    const courseUrl = `https://moodle.syxy.ouchn.cn/course/view.php?id=${courseId}`;
                    window.location.href = courseUrl;
                } else {
                    // 否则使用history.back()
                    window.history.back();
                }
            }
            setTimeout(() => {
                processMoodleCourse();
            }, 2000);
            return;
        }
        
        // 查找侧边栏中的所有学习项目链接
        // 按单元组织学习项目为二维数组
        const sidebarStructure = []; // 二维数组：[单元][学习项目]
        const seenUrls = new Set(); // 用于去重
        const sections = sidebar.querySelectorAll('.section');
        
        // 遍历每个单元，收集学习项目
        sections.forEach((section, sectionIndex) => {
            // 查找单元中的学习项目
            const activities = section.querySelectorAll('.activity, .resource, .modtype_resource, .modtype_url, .modtype_video, .modtype_quiz');
            
            const sectionItems = [];
            activities.forEach((activity) => {
                const link = activity.querySelector('a');
                if (link && link.href.includes('/mod/')) {
                    // 去重：只添加未见过的链接
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
        
        // 将二维数组扁平化为一维数组，方便处理
        const sidebarItems = sidebarStructure.flat();
        
        // 如果没有通过单元找到项目，尝试直接查找所有学习项目链接
        if (sidebarItems.length === 0) {
            const allLinks = sidebar.querySelectorAll('a');
            for (const link of allLinks) {
                const href = link.href;
                if (href.includes('/mod/') && !seenUrls.has(href)) {
                    seenUrls.add(href);
                    sidebarItems.push(link);
                }
            }
        }
        
        if (sidebarItems.length === 0) {
            // 尝试返回课程页面
            if (document.referrer && document.referrer.includes('/course/view.php')) {
                window.location.href = document.referrer;
            } else {
                // 如果没有referrer，尝试从URL中提取课程ID并构建课程页面URL
                const courseIdMatch = window.location.search.match(/id=(\d+)/);
                if (courseIdMatch) {
                    const courseId = courseIdMatch[1];
                    const courseUrl = `https://moodle.syxy.ouchn.cn/course/view.php?id=${courseId}`;
                    window.location.href = courseUrl;
                } else {
                    // 否则使用history.back()
                    window.history.back();
                }
            }
            setTimeout(() => {
                processMoodleCourse();
            }, 2000);
            return;
        }
        
        // 找到当前页面在侧边栏中的位置
        let currentIndex = -1;
        const currentUrl = window.location.href;
        const currentUrlPath = window.location.pathname;
        const currentUrlId = currentUrl.split('id=')[1]?.split('&')[0];
        
        // 方法1：通过完整URL匹配
        for (let i = 0; i < sidebarItems.length; i++) {
            const item = sidebarItems[i];
            const itemUrl = item.href;
            
            if (currentUrl === itemUrl) {
                currentIndex = i;
                break;
            }
        }
        
        // 方法2：通过路径匹配
        if (currentIndex === -1) {
            for (let i = 0; i < sidebarItems.length; i++) {
                const item = sidebarItems[i];
                const itemUrl = item.href;
                const itemPath = new URL(itemUrl).pathname;
                
                if (currentUrlPath === itemPath) {
                    currentIndex = i;
                    break;
                }
            }
        }
        
        // 方法3：通过ID匹配
        if (currentIndex === -1 && currentUrlId) {
            for (let i = 0; i < sidebarItems.length; i++) {
                const item = sidebarItems[i];
                const itemUrl = item.href;
                const itemId = itemUrl.split('id=')[1]?.split('&')[0];
                
                if (currentUrlId === itemId) {
                    currentIndex = i;
                    break;
                }
            }
        }
        
        // 方法4：通过包含关系查找
        if (currentIndex === -1) {
            for (let i = 0; i < sidebarItems.length; i++) {
                const item = sidebarItems[i];
                const itemUrl = item.href;
                
                // 检查当前URL是否包含项目URL的关键部分
                if (currentUrl.includes(itemUrl.split('?')[0].split('/').pop())) {
                    currentIndex = i;
                    break;
                }
            }
        }
        
        // 从当前位置的下一个项目开始查找未完成的项目
        if (currentIndex >= 0 && currentIndex < sidebarItems.length - 1) {
            // 从当前位置的下一个项目开始遍历
            for (let i = currentIndex + 1; i < sidebarItems.length; i++) {
                const item = sidebarItems[i];
                const itemUrl = item.href;
                
                // 使用直接跳转而不是点击，避免可能的页面跳转问题
                setTimeout(() => {
                    window.location.href = itemUrl;
                }, 500);
                return;
            }
        }
        
        // 如果没有找到下一个项目，返回课程列表页
        // 尝试返回课程页面
        if (document.referrer && document.referrer.includes('/course/view.php')) {
            window.location.href = document.referrer;
        } else {
            // 如果没有referrer，尝试从URL中提取课程ID并构建课程页面URL
            const courseIdMatch = window.location.search.match(/id=(\d+)/);
            if (courseIdMatch) {
                const courseId = courseIdMatch[1];
                const courseUrl = `https://moodle.syxy.ouchn.cn/course/view.php?id=${courseId}`;
                window.location.href = courseUrl;
            } else {
                // 否则使用history.back()
                window.history.back();
            }
        }
        setTimeout(() => {
            processMoodleCourse();
        }, 2000);
    }

    // 页面加载完成后初始化
    // 使用 DOMContentLoaded 事件，确保页面结构已加载
    window.addEventListener('DOMContentLoaded', function() {
        setTimeout(init, 1000); // 延迟1秒执行，确保页面完全加载
    });
    
    // 监听页面hash变化，处理路由切换
    window.addEventListener('hashchange', function() {
        // 重置初始化状态，以便重新执行
        initialized = false;
        setTimeout(init, 1000); // 延迟1秒执行，确保页面完全加载
    });
    
    // 监听页面加载完成事件，作为后备
    window.addEventListener('load', function() {
        if (!initialized) {
            setTimeout(init, 500); // 延迟500毫秒执行
        }
    });

})();