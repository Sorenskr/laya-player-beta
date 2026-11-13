/**
 * ==========================================================================
 * danmaku.js - 高级动态/定格弹幕双模工作台 (首屏负延时秒现、持久记忆与多端同步)
 * ==========================================================================
 */

window.DanmakuEngine = {
    list: [],
    container: null,
    trackListUI: null,
    mode: 'scroll', // 'scroll' (动态滚动) | 'fixed' (静态坐标排布)
    isPaused: false,
    speedFactor: 1.0,
    portAreaMin: 10, // 竖屏默认显示区域上边界：仅占画面上方区域 (10%)
    portAreaMax: 24, // 竖屏默认显示区域下边界：仅占画面上方区域 (24%)

    isPortraitStage() {
        const stg = document.getElementById('render-target') || document.getElementById('capture-stage');
        return !!(stg && stg.classList.contains('mode-mobile-port'));
    },

    getEffectiveTop(rawTop) {
        const t = Number.isFinite(Number(rawTop)) ? Number(rawTop) : 14;
        const stg = document.getElementById('render-target') || document.getElementById('capture-stage');
        if (stg && stg.classList.contains('mode-mobile-port')) {
            const minV = Math.min(this.portAreaMin, this.portAreaMax - 4);
            const maxV = Math.max(this.portAreaMax, minV + 4);
            const baseClamped = Math.min(maxV, Math.max(minV, t));
            // 当竖屏开启评论区时，自动将弹幕轨道等比映射并约束在上方视频可视区内，随评论区拖拽高度实时联动
            if (stg.classList.contains('dy-comment-open')) {
                const drawerTop = (window.CommentEngine && typeof window.CommentEngine.getEffectiveDrawerTopPct === 'function')
                    ? window.CommentEngine.getEffectiveDrawerTopPct()
                    : (stg.classList.contains('dy-comment-expanded') ? 33.5 : 44.5);
                const vidTopMin = 8.8;
                const vidTopMax = Math.max(vidTopMin + 2.5, drawerTop - 3.6);
                const ratio = (maxV > minV) ? ((baseClamped - minV) / (maxV - minV)) : 0.35;
                return Number((vidTopMin + ratio * (vidTopMax - vidTopMin)).toFixed(2));
            }
            return baseClamped;
        }
        return Math.min(92, Math.max(5, t));
    },

    syncStageTopPositions() {
        const container = this.container || document.getElementById('danmaku-container');
        if (!container) return;
        const activeItems = this.getActiveList();
        activeItems.forEach((dm) => {
            const el = document.getElementById('stage_' + dm.id);
            if (el) {
                el.style.top = this.getEffectiveTop(dm.top) + '%';
            }
        });
    },

    getActiveList() {
        return this.list.filter(item => item.visible !== false);
    },

    refresh() {
        if (typeof window.renderDanmakuStage === 'function') window.renderDanmakuStage();
        if (typeof window.renderDanmakuTracksUI === 'function') window.renderDanmakuTracksUI();
    },

    renderEditorList() {
        if (typeof window.renderDanmakuTracksUI === 'function') window.renderDanmakuTracksUI();
    },

    togglePause(forceState) {
        if (!this.container) return;
        this.isPaused = (forceState !== undefined) ? forceState : !this.isPaused;

        if (this.isPaused) {
            this.container.classList.add('is-paused');
        } else {
            this.container.classList.remove('is-paused');
            if (typeof window.renderDanmakuStage === 'function') window.renderDanmakuStage();
        }

        syncPauseButtonUI(this.isPaused);

        if (typeof window.showToast === 'function') {
            window.showToast(this.isPaused ? '⏸️ 弹幕已原地定格 (可直接鼠标拖动/滚轮缩放/右键调速)' : '▶ 弹幕已恢复正常飘动');
        }
    },

    loadPreset(presetKey) {
        if (!presetsDB[presetKey]) return;
        this.list = JSON.parse(JSON.stringify(presetsDB[presetKey]));
        if (typeof window.applyDanmakuVisibility === 'function') {
            window.applyDanmakuVisibility(true);
        }
        this.refresh();
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        if (typeof window.showToast === 'function') {
            window.showToast(`已载入预设案例：${presetNames[presetKey]}（默认白字黑边）`);
        }
    },

    fireLive(text, color = '#ffffff') {
        if (!text || !text.trim()) return;
        const cleanTxt = typeof window.__sanitizeDanmakuAllowedEmojisOnly === 'function'
            ? (window.__sanitizeDanmakuAllowedEmojisOnly(text.trim(), false) || text.trim())
            : text.trim();
        const minTop = this.isPortraitStage() ? this.portAreaMin : 12;
        const maxTop = this.isPortraitStage() ? this.portAreaMax : 55;
        const newTrack = {
            id: 'dm_live_' + Date.now(),
            text: cleanTxt,
            top: Math.floor(Math.random() * Math.max(4, maxTop - minTop)) + minTop,
            left: 35,
            color: color || '#ffffff',
            size: parseInt(document.getElementById('in-danmaku-size')?.value) || 14,
            speed: 9,
            visible: true
        };
        this.list.unshift(newTrack);
        this.refresh();
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
    }
};

const presetNames = {
    driver: '真人顏值誇讚組',
    climax: '高能互動熱評組',
    traffic: '前排打卡互動組'
};

// 默认全部采用原生洁净白字 (#ffffff)，较长真人自然口语风格 + 抖音黄脸表情去重，无任何 AI 套话
const presetsDB = {
    driver: [
        { id: 'd1', text: '這套穿搭看著真舒服，鏡頭拉近皮膚狀態也太好了吧😘', top: 10, left: 10, color: '#ffffff', size: 14, speed: 10, visible: true },
        { id: 'd2', text: '剛下班打開就刷到這段，連看三遍捨不得划走了', top: 13, left: 42, color: '#ffffff', size: 14, speed: 11, visible: true },
        { id: 'd3', text: '👍', top: 16, left: 12, color: '#ffffff', size: 14, speed: 8, visible: true },
        { id: 'd4', text: '笑起來特別自然耐看，完全不是那種千篇一律的網紅臉❤️', top: 19, left: 46, color: '#ffffff', size: 14, speed: 12, visible: true },
        { id: 'd5', text: '這畫質清晰度真的沒話說，連髮絲細節都看得清清楚楚👀', top: 22, left: 18, color: '#ffffff', size: 14, speed: 10, visible: true }
    ],
    climax: [
        { id: 'c1', text: '臥槽這波操作直接看傻了，換成我絕對反應不過來666', top: 10, left: 14, color: '#ffffff', size: 14, speed: 9, visible: true },
        { id: 'c2', text: '😂剛才那個小表情笑死我了，差點把嘴裡的咖啡噴出來', top: 13, left: 44, color: '#ffffff', size: 14, speed: 10, visible: true },
        { id: 'c3', text: '前面鋪墊了那麼久原來在這裡等著呢，這反轉太牛了🐮', top: 16, left: 10, color: '#ffffff', size: 14, speed: 9, visible: true },
        { id: 'c4', text: '真的假的😲這段現場發揮也太穩了吧，全程沒有一點尿點', top: 19, left: 50, color: '#ffffff', size: 14, speed: 11, visible: true },
        { id: 'c5', text: '👏', top: 22, left: 26, color: '#ffffff', size: 14, speed: 11, visible: true }
    ],
    traffic: [
        { id: 't1', text: '剛從朋友那邊推薦過來的，前排先打個卡佔個好位置😊', top: 10, left: 12, color: '#ffffff', size: 14, speed: 10, visible: true },
        { id: 't2', text: '在海外這邊看一點都不卡頓，聲音和畫面都特別穩👌', top: 13, left: 45, color: '#ffffff', size: 14, speed: 11, visible: true },
        { id: 't3', text: '蹲了好幾天終於更新了，泡杯咖啡慢慢看完整版☕', top: 16, left: 8, color: '#ffffff', size: 14, speed: 9, visible: true },
        { id: 't4', text: '評論區老哥們都在聊細節，果然好內容大家都識貨', top: 19, left: 48, color: '#ffffff', size: 14, speed: 10, visible: true },
        { id: 't5', text: '🫶', top: 22, left: 20, color: '#ffffff', size: 14, speed: 12, visible: true }
    ]
};

function syncPauseButtonUI(isPaused) {
    const btnToggle = document.getElementById('btn-toggle-dm-motion');
    const txtMotion = document.getElementById('txt-dm-motion');
    const iconMotion = document.getElementById('icon-dm-motion');

    if (btnToggle) {
        btnToggle.classList.toggle('paused', isPaused);
        if (txtMotion) txtMotion.textContent = isPaused ? '▶ 恢复弹幕滚动' : '⏸️ 原地定格弹幕 (方便预览/截图)';
        if (iconMotion) iconMotion.textContent = isPaused ? '▶' : '⏸️';
    }
}

(function () {
    const danmakuContainer = document.getElementById('danmaku-container');
    const danmakuTrackList = document.getElementById('danmaku-track-list');
    const inDanmakuSize = document.getElementById('in-danmaku-size');
    const txtDanmakuSize = document.getElementById('txt-danmaku-size');
    const btnAddDanmaku = document.getElementById('btn-add-danmaku');
    const inBatchDanmaku = document.getElementById('in-batch-danmaku');
    const btnParseBatch = document.getElementById('btn-parse-batch');
    const swDanmaku = document.getElementById('sw-danmaku');
    const btnQuickDmToggle = document.getElementById('btn-quick-dm-toggle');
    const dyBtnDmToggle = document.getElementById('dy-btn-dm-toggle');
    const btnOpenDmInput = document.getElementById('btn-open-dm-input');
    const selDmMode = document.getElementById('sel-dm-mode');

    const btnToggleDmMotion = document.getElementById('btn-toggle-dm-motion');
    const inDmGlobalSpeed = document.getElementById('in-dm-global-speed');
    const txtDmGlobalSpeed = document.getElementById('txt-dm-global-speed');
    const inDmPortMin = document.getElementById('in-dm-port-min');
    const txtDmPortMin = document.getElementById('txt-dm-port-min');
    const inDmPortMax = document.getElementById('in-dm-port-max');
    const txtDmPortMax = document.getElementById('txt-dm-port-max');
    const btnResetDmPortRange = document.getElementById('btn-reset-dm-port-range');
    const btnDmAreaUp = document.getElementById('btn-dm-area-up');
    const btnDmAreaDown = document.getElementById('btn-dm-area-down');
    const btnDmAreaShrink = document.getElementById('btn-dm-area-shrink');
    const btnDmAreaExpand = document.getElementById('btn-dm-area-expand');
    const btnDmFontDown = document.getElementById('btn-dm-font-down');
    const btnDmFontUp = document.getElementById('btn-dm-font-up');
    const btnDmFontReset = document.getElementById('btn-dm-font-reset');

    window.DanmakuEngine.container = danmakuContainer;
    window.DanmakuEngine.trackListUI = danmakuTrackList;
    window.DanmakuEngine.list = JSON.parse(JSON.stringify(presetsDB.driver));

    const toast = (msg) => {
        if (typeof window.showToast === 'function') window.showToast(msg);
    };

    /* ==========================================================================
       1. 舞台弹幕渲染 + 鼠标拖拽位置 / 滚轮缩放字号 / 右键调节速度
       ========================================================================== */
    function bindDanmakuItemInteractions(el, dm, idx) {
        el.title = '左键拖动位置 | 滚轮缩放字号 | 右键调节滚动速度';

        // 1) 鼠标左键拖动弹幕位置 (X / Y)
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // 仅响应左键拖动
            e.preventDefault();
            e.stopPropagation();
            if (!danmakuContainer) return;

            const containerRect = danmakuContainer.getBoundingClientRect();
            const itemRect = el.getBoundingClientRect();
            const offsetX = e.clientX - itemRect.left;
            const offsetY = e.clientY - itemRect.top;

            // 拖动开始：锁定在当前视觉坐标，暂停动画跳变
            const startLeftPct = ((itemRect.left - containerRect.left) / Math.max(1, containerRect.width)) * 100;
            const startTopPct = ((itemRect.top - containerRect.top) / Math.max(1, containerRect.height)) * 100;

            el.classList.add('is-dragging');
            el.style.animation = 'none';
            el.style.transform = 'none';
            el.style.left = startLeftPct.toFixed(1) + '%';
            el.style.top = startTopPct.toFixed(1) + '%';

            let finalLeftPct = startLeftPct;
            let finalTopPct = startTopPct;

            const onMouseMove = (moveEvt) => {
                moveEvt.preventDefault();
                const cRect = danmakuContainer.getBoundingClientRect();
                const rawLeft = ((moveEvt.clientX - offsetX - cRect.left) / Math.max(1, cRect.width)) * 100;
                const rawTop = ((moveEvt.clientY - offsetY - cRect.top) / Math.max(1, cRect.height)) * 100;

                const minTop = 4;
                const maxTop = 88;

                finalLeftPct = Math.min(92, Math.max(-10, rawLeft));
                finalTopPct = Math.min(maxTop, Math.max(minTop, rawTop));

                el.style.left = finalLeftPct.toFixed(1) + '%';
                el.style.top = finalTopPct.toFixed(1) + '%';
            };

            const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                el.classList.remove('is-dragging');

                dm.top = Math.round(finalTopPct);
                dm.left = Math.round(Math.min(90, Math.max(2, finalLeftPct)));
                dm.customTop = true;

                if (window.DanmakuEngine.mode === 'fixed' || window.DanmakuEngine.isPaused) {
                    el.classList.add('dm-custom-pos');
                    el.style.animation = 'none';
                    el.style.transform = 'none';
                    el.style.left = dm.left + '%';
                    el.style.top = dm.top + '%';
                    const cWidth = Math.max(1, danmakuContainer.clientWidth);
                    const iWidth = Math.max(20, el.offsetWidth);
                    const leftRatio = finalLeftPct / 100;
                    dm.customProgress = Math.min(0.95, Math.max(0.02, (1 - leftRatio) / (1 + iWidth / cWidth)));
                } else {
                    el.classList.remove('dm-custom-pos');
                    // 动态滚动模式：根据松手时的水平位置反推负延时，使弹幕从松手位置丝滑继续滚动
                    const cWidth = Math.max(1, danmakuContainer.clientWidth);
                    const iWidth = Math.max(20, el.offsetWidth);
                    const leftRatio = finalLeftPct / 100;
                    const progress = Math.min(0.95, Math.max(0.02, (1 - leftRatio) / (1 + iWidth / cWidth)));
                    dm.customProgress = progress;

                    const baseDuration = Math.max(2, (dm.speed || 8) / window.DanmakuEngine.speedFactor);
                    el.style.left = '';
                    el.style.transform = '';
                    el.style.top = dm.top + '%';
                    el.style.animation = '';
                    el.style.animationDuration = baseDuration.toFixed(1) + 's';
                    el.style.animationDelay = (-progress * baseDuration).toFixed(2) + 's';
                }

                // 同步右侧轨道面板数值
                const card = danmakuTrackList?.querySelector(`.dm-track-card[data-id="${dm.id}"]`);
                if (card) {
                    const topInp = card.querySelector('.dm-input-top');
                    if (topInp) topInp.value = dm.top;
                    const leftInp = card.querySelector('.dm-input-left');
                    if (leftInp) leftInp.value = dm.left;
                }
                if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        // 2) 鼠标滚轮：放大/缩小弹幕文字大小
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY < 0 ? 2 : -2;
            const nextSize = Math.min(44, Math.max(11, (parseInt(dm.size) || 16) + delta));
            dm.size = nextSize;
            el.style.fontSize = nextSize + 'px';

            const card = danmakuTrackList?.querySelector(`.dm-track-card[data-id="${dm.id}"]`);
            if (card) {
                const sizeInp = card.querySelector('.dm-input-size');
                if (sizeInp) sizeInp.value = nextSize;
            }
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            toast(`🔍 弹幕字号已调为：${nextSize}px`);
        }, { passive: false });

        // 3) 鼠标右键：循环调节弹幕滚动速度
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const speedPresets = [
                { speed: 10, label: '标准速度 (1.0X)' },
                { speed: 7, label: '快速滚动 (1.4X)' },
                { speed: 4.5, label: '极速飙车 (2.2X)' },
                { speed: 15, label: '慢速飘动 (0.7X)' }
            ];
            const curSpeed = Number(dm.speed) || 9;
            let curIdx = speedPresets.findIndex(p => Math.abs(p.speed - curSpeed) <= 1.2);
            const nextPreset = speedPresets[(curIdx + 1) % speedPresets.length];

            // 保持当前屏幕水平位置不跳变
            if (danmakuContainer && window.DanmakuEngine.mode !== 'fixed') {
                const cRect = danmakuContainer.getBoundingClientRect();
                const iRect = el.getBoundingClientRect();
                const cWidth = Math.max(1, cRect.width);
                const iWidth = Math.max(20, iRect.width);
                const leftRatio = (iRect.left - cRect.left) / cWidth;
                dm.customProgress = Math.min(0.95, Math.max(0.02, (1 - leftRatio) / (1 + iWidth / cWidth)));
            }

            dm.speed = nextPreset.speed;
            if (window.DanmakuEngine.mode !== 'fixed') {
                const baseDuration = Math.max(2, dm.speed / window.DanmakuEngine.speedFactor);
                const prog = dm.customProgress !== undefined ? dm.customProgress : 0.35;
                el.style.animationDuration = baseDuration.toFixed(1) + 's';
                el.style.animationDelay = (-prog * baseDuration).toFixed(2) + 's';
            }

            const card = danmakuTrackList?.querySelector(`.dm-track-card[data-id="${dm.id}"]`);
            if (card) {
                const spdInp = card.querySelector('.dm-input-speed');
                if (spdInp) spdInp.value = dm.speed;
            }
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            toast(`⚡ 弹幕滚动速度：${nextPreset.label}`);
        });
    }

    function renderDanmakuStage() {
        if (!danmakuContainer) return;
        danmakuContainer.innerHTML = '';
        const isFixed = (window.DanmakuEngine.mode === 'fixed');

        window.DanmakuEngine.list.forEach((dm, idx) => {
            if (dm.visible === false) return;

            const el = document.createElement('div');
            el.className = 'danmaku-item' + (isFixed ? ' is-fixed' : '');
            el.id = 'stage_' + dm.id;
            el.textContent = dm.text;

            const effectiveTop = dm.customTop ? Math.min(92, Math.max(4, Number(dm.top) || 14)) : window.DanmakuEngine.getEffectiveTop(dm.top);
            el.style.top = effectiveTop + '%';
            el.style.color = dm.color || '#ffffff';
            el.style.fontSize = (dm.size || 16) + 'px';

            if (isFixed) {
                el.style.animation = 'none';
                el.style.transform = 'none';
                el.style.left = (dm.left !== undefined ? dm.left : 20) + '%';
            } else {
                const baseDuration = Math.max(2, (dm.speed || 8) / window.DanmakuEngine.speedFactor);
                el.style.animationDuration = baseDuration.toFixed(1) + 's';
                
                // 如果用户拖动定位过，按拖动位置还原；否则使用交错负延时使初次加载分布在屏幕中段
                const staggerDelay = (dm.customProgress !== undefined)
                    ? -(dm.customProgress * baseDuration)
                    : -(((idx + 0.35) * 1.9) % baseDuration);
                el.style.animationDelay = staggerDelay.toFixed(2) + 's';
            }

            bindDanmakuItemInteractions(el, dm, idx);
            danmakuContainer.appendChild(el);
        });

        if (window.DanmakuEngine.isPaused) {
            danmakuContainer.classList.add('is-paused');
        } else {
            danmakuContainer.classList.remove('is-paused');
        }
    }
    window.renderDanmakuStage = renderDanmakuStage;

    /* ==========================================================================
       2. 右侧面板轨道列表可视化卡片
       ========================================================================== */
    function renderDanmakuTracksUI() {
        if (!danmakuTrackList) return;
        danmakuTrackList.innerHTML = '';
        const isFixed = (window.DanmakuEngine.mode === 'fixed');

        window.DanmakuEngine.list.forEach((dm, index) => {
            const card = document.createElement('div');
            card.className = 'dm-track-card';
            card.dataset.id = dm.id;

            card.innerHTML = `
                <div class="dm-track-row1">
                    <input type="text" class="dm-input-text" placeholder="弹幕文字">
                    <button class="dm-track-del" title="删除此条">✕</button>
                </div>
                <div class="dm-track-row2">
                    <label>Y高: <input type="number" class="dm-input-top" value="${dm.top}" min="5" max="92" style="width:38px;">%</label>
                    ${isFixed ? `
                        <label>X位: <input type="number" class="dm-input-left" value="${dm.left !== undefined ? dm.left : 20}" min="2" max="88" style="width:38px;">%</label>
                    ` : `
                        <label>速度: <input type="number" class="dm-input-speed" value="${dm.speed || 8}" min="3" max="25" style="width:36px;">s</label>
                    `}
                    <label>字号: <input type="number" class="dm-input-size" value="${dm.size || 16}" min="11" max="44" style="width:38px;">px</label>
                    <label>色: <input type="color" class="dm-input-color" value="${dm.color || '#ffffff'}"></label>
                    <label style="cursor:pointer; display:flex; align-items:center;">
                        <input type="checkbox" class="dm-input-vis" ${dm.visible !== false ? 'checked' : ''}> 显示
                    </label>
                </div>
            `;

            const dmTextInputEl = card.querySelector('.dm-input-text');
            if (dmTextInputEl) {
                dmTextInputEl.value = dm.text || '';
                dmTextInputEl.addEventListener('input', (e) => {
                    dm.text = e.target.value;
                    const stageEl = document.getElementById('stage_' + dm.id);
                    if (stageEl) stageEl.textContent = e.target.value;
                    if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
                });
            }

            card.querySelector('.dm-input-top').addEventListener('input', (e) => {
                dm.top = Math.min(95, Math.max(5, parseInt(e.target.value) || 20));
                const stageEl = document.getElementById('stage_' + dm.id);
                if (stageEl) stageEl.style.top = window.DanmakuEngine.getEffectiveTop(dm.top) + '%';
                if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            });

            const inputLeft = card.querySelector('.dm-input-left');
            if (inputLeft) {
                inputLeft.addEventListener('input', (e) => {
                    dm.left = Math.min(90, Math.max(2, parseInt(e.target.value) || 10));
                    const stageEl = document.getElementById('stage_' + dm.id);
                    if (stageEl) stageEl.style.left = dm.left + '%';
                    if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
                });
            }

            const inputSpeed = card.querySelector('.dm-input-speed');
            if (inputSpeed) {
                inputSpeed.addEventListener('input', (e) => {
                    dm.speed = Math.min(30, Math.max(3, parseFloat(e.target.value) || 8));
                    const stageEl = document.getElementById('stage_' + dm.id);
                    if (stageEl) {
                        const duration = Math.max(2, dm.speed / window.DanmakuEngine.speedFactor);
                        stageEl.style.animationDuration = duration.toFixed(1) + 's';
                    }
                    if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
                });
            }

            card.querySelector('.dm-input-size').addEventListener('input', (e) => {
                dm.size = Math.min(44, Math.max(11, parseInt(e.target.value) || 16));
                const stageEl = document.getElementById('stage_' + dm.id);
                if (stageEl) stageEl.style.fontSize = dm.size + 'px';
                if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            });

            card.querySelector('.dm-input-color').addEventListener('input', (e) => {
                dm.color = e.target.value;
                const stageEl = document.getElementById('stage_' + dm.id);
                if (stageEl) stageEl.style.color = e.target.value;
                if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            });

            card.querySelector('.dm-input-vis').addEventListener('change', (e) => {
                dm.visible = e.target.checked;
                renderDanmakuStage();
                if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            });

            card.querySelector('.dm-track-del').addEventListener('click', () => {
                window.DanmakuEngine.list.splice(index, 1);
                window.DanmakuEngine.refresh();
                if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
                toast('弹幕已删除');
            });

            danmakuTrackList.appendChild(card);
        });
    }
    window.renderDanmakuTracksUI = renderDanmakuTracksUI;

    /* ==========================================================================
       3. 事件监听绑定
       ========================================================================== */
    if (btnToggleDmMotion) {
        btnToggleDmMotion.addEventListener('click', () => {
            window.DanmakuEngine.togglePause();
        });
    }

    if (inDmGlobalSpeed && txtDmGlobalSpeed) {
        inDmGlobalSpeed.addEventListener('input', (e) => {
            const rawVal = parseInt(e.target.value) || 10;
            const factor = rawVal / 10;
            window.DanmakuEngine.speedFactor = factor;
            txtDmGlobalSpeed.textContent = factor.toFixed(1) + 'X';

            window.DanmakuEngine.list.forEach((dm) => {
                const stageEl = document.getElementById('stage_' + dm.id);
                if (stageEl && window.DanmakuEngine.mode !== 'fixed') {
                    const duration = Math.max(1.5, (dm.speed || 8) / factor);
                    stageEl.style.animationDuration = duration.toFixed(1) + 's';
                }
            });
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        });
    }

    if (selDmMode) {
        selDmMode.addEventListener('change', (e) => {
            window.DanmakuEngine.mode = e.target.value;
            window.DanmakuEngine.refresh();
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            toast(e.target.value === 'fixed' ? '📌 已切换为：定格排布模式 (自由调X/Y位置)' : '🎬 已切换为：动态滚动模式');
        });
    }

    document.querySelectorAll('.btn-preset-load').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.preset;
            window.DanmakuEngine.loadPreset(key);
        });
    });

    function applyGlobalDanmakuFontSize(rawPx, showMsg = false) {
        const clampedPx = Math.min(44, Math.max(10, parseInt(rawPx, 10) || 14));
        const sizeVal = clampedPx + 'px';
        document.documentElement.style.setProperty('--danmaku-size', sizeVal);
        if (inDanmakuSize && parseInt(inDanmakuSize.value, 10) !== clampedPx) {
            inDanmakuSize.value = String(clampedPx);
        }
        if (txtDanmakuSize) txtDanmakuSize.textContent = sizeVal;
        window.DanmakuEngine.list.forEach(dm => {
            dm.size = clampedPx;
            const stageEl = document.getElementById('stage_' + dm.id);
            if (stageEl) {
                stageEl.style.fontSize = sizeVal;
            }
        });
        if (danmakuTrackList) {
            danmakuTrackList.querySelectorAll('.dm-input-size').forEach(inp => {
                inp.value = String(clampedPx);
            });
        }
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        if (showMsg) {
            toast(`🔤 弹幕文字字号已调为：${sizeVal}（弹幕区域与位置保持不变）`);
        }
    }

    if (inDanmakuSize && txtDanmakuSize) {
        inDanmakuSize.addEventListener('input', (e) => {
            applyGlobalDanmakuFontSize(e.target.value, false);
        });
    }
    if (btnDmFontDown) {
        btnDmFontDown.addEventListener('click', () => {
            const cur = parseInt(inDanmakuSize?.value, 10) || 14;
            applyGlobalDanmakuFontSize(cur - 2, true);
        });
    }
    if (btnDmFontUp) {
        btnDmFontUp.addEventListener('click', () => {
            const cur = parseInt(inDanmakuSize?.value, 10) || 14;
            applyGlobalDanmakuFontSize(cur + 2, true);
        });
    }
    if (btnDmFontReset) {
        btnDmFontReset.addEventListener('click', () => {
            applyGlobalDanmakuFontSize(14, true);
        });
    }

    if (btnAddDanmaku) {
        btnAddDanmaku.addEventListener('click', () => {
            const minT = window.DanmakuEngine.portAreaMin || 10;
            const maxT = window.DanmakuEngine.portAreaMax || 24;
            const span = Math.max(6, maxT - minT);
            const idx = window.DanmakuEngine.list.length + 1;
            const calcTop = minT + ((idx * 3) % span);
            const randomLefts = [12, 26, 42, 56, 20];

            window.DanmakuEngine.list.push({
                id: 'dm_custom_' + Date.now(),
                text: '自定義彈幕 ' + idx,
                top: Math.round(calcTop),
                left: randomLefts[idx % randomLefts.length],
                color: '#ffffff',
                size: parseInt(inDanmakuSize?.value) || 14,
                speed: 8 + (idx % 4) * 2,
                visible: true
            });
            window.DanmakuEngine.refresh();
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            toast('已新增 1 条弹幕');
        });
    }

    if (btnParseBatch && inBatchDanmaku) {
        btnParseBatch.addEventListener('click', () => {
            const raw = inBatchDanmaku.value.trim();
            if (!raw) {
                toast('请先粘贴文本内容');
                return;
            }
            const segs = raw.split(/[\n,，;；。]+/).map(s => s.trim()).filter(s => s.length > 0);
            if (segs.length === 0) return;

            const minT = window.DanmakuEngine.portAreaMin || 10;
            const maxT = window.DanmakuEngine.portAreaMax || 24;
            const span = Math.max(6, maxT - minT);
            const newTracks = segs.map((txt, i) => {
                const cleanSeg = typeof window.__sanitizeDanmakuAllowedEmojisOnly === 'function'
                    ? (window.__sanitizeDanmakuAllowedEmojisOnly(txt, false) || txt)
                    : txt;
                return {
                    id: 'dm_b_' + Date.now() + '_' + i,
                    text: cleanSeg,
                    top: Math.round(minT + ((i * 3) % span)),
                    left: 10 + (i % 4) * 18,
                    color: '#ffffff',
                    size: parseInt(inDanmakuSize?.value) || 14,
                    speed: 8 + (i % 4) * 1.5,
                    visible: true
                };
            });

            window.DanmakuEngine.list = [...window.DanmakuEngine.list, ...newTracks];
            window.DanmakuEngine.refresh();
            inBatchDanmaku.value = '';
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            toast(`已导入 ${segs.length} 条弹幕！`);
        });
    }

    // 竖屏模式下弹幕显示区域范围控制 (默认仅占画面上方区域 10% ~ 24%)
    function applyPortRangeChange(redistribute = false) {
        let minVal = parseInt(inDmPortMin?.value);
        let maxVal = parseInt(inDmPortMax?.value);
        if (!Number.isFinite(minVal)) minVal = 10;
        if (!Number.isFinite(maxVal)) maxVal = 24;
        if (minVal > maxVal - 6) {
            minVal = Math.max(5, maxVal - 6);
            if (inDmPortMin) inDmPortMin.value = minVal;
        }
        window.DanmakuEngine.portAreaMin = minVal;
        window.DanmakuEngine.portAreaMax = maxVal;
        if (txtDmPortMin) txtDmPortMin.textContent = minVal + '%';
        if (txtDmPortMax) txtDmPortMax.textContent = maxVal + '%';

        const syncTrackInputsInPlace = () => {
            if (!danmakuTrackList) return;
            const cards = danmakuTrackList.querySelectorAll('.dm-track-card');
            if (cards.length !== window.DanmakuEngine.list.length) {
                renderDanmakuTracksUI();
                return;
            }
            window.DanmakuEngine.list.forEach((dm, idx) => {
                const topInp = cards[idx] && cards[idx].querySelector('.dm-input-top');
                if (topInp && String(topInp.value) !== String(dm.top)) {
                    topInp.value = String(dm.top);
                }
            });
        };

        if (redistribute && window.DanmakuEngine.list.length > 0) {
            const count = window.DanmakuEngine.list.length;
            const step = count > 1 ? (maxVal - minVal) / (count - 1) : 0;
            window.DanmakuEngine.list.forEach((dm, i) => {
                dm.customTop = false;
                dm.top = Math.round(minVal + i * step);
            });
            window.DanmakuEngine.syncStageTopPositions();
            syncTrackInputsInPlace();
        } else {
            window.DanmakuEngine.list.forEach((dm) => {
                if (dm.top < minVal || dm.top > maxVal) {
                    dm.top = Math.min(maxVal, Math.max(minVal, dm.top));
                }
            });
            window.DanmakuEngine.syncStageTopPositions();
            syncTrackInputsInPlace();
        }
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
    }

    function shiftOrScaleDanmakuArea(deltaShiftPct, deltaSpanPct, labelTip) {
        let curMin = parseInt(inDmPortMin?.value, 10);
        let curMax = parseInt(inDmPortMax?.value, 10);
        if (!Number.isFinite(curMin)) curMin = window.DanmakuEngine.portAreaMin || 10;
        if (!Number.isFinite(curMax)) curMax = window.DanmakuEngine.portAreaMax || 24;
        let nextMin = curMin + deltaShiftPct - Math.round(deltaSpanPct / 2);
        let nextMax = curMax + deltaShiftPct + Math.ceil(deltaSpanPct / 2);
        if (nextMax - nextMin < 6) {
            nextMax = nextMin + 6;
        }
        if (nextMin < 4) {
            const diff = 4 - nextMin;
            nextMin = 4;
            nextMax = Math.min(92, nextMax + diff);
        }
        if (nextMax > 92) {
            const diff = nextMax - 92;
            nextMax = 92;
            nextMin = Math.max(4, nextMin - diff);
        }
        if (inDmPortMin) inDmPortMin.value = String(nextMin);
        if (inDmPortMax) inDmPortMax.value = String(nextMax);
        applyPortRangeChange(true);
        toast(`📦 ${labelTip}：${nextMin}% ~ ${nextMax}%（弹幕文字大小保持不变）`);
    }

    if (inDmPortMin) {
        inDmPortMin.addEventListener('input', () => applyPortRangeChange(true));
    }
    if (inDmPortMax) {
        inDmPortMax.addEventListener('input', () => applyPortRangeChange(true));
    }
    if (btnDmAreaUp) {
        btnDmAreaUp.addEventListener('click', () => shiftOrScaleDanmakuArea(-5, 0, '弹幕区域已整体上移'));
    }
    if (btnDmAreaDown) {
        btnDmAreaDown.addEventListener('click', () => shiftOrScaleDanmakuArea(5, 0, '弹幕区域已整体下移'));
    }
    if (btnDmAreaShrink) {
        btnDmAreaShrink.addEventListener('click', () => shiftOrScaleDanmakuArea(0, -4, '弹幕显示区域已缩小'));
    }
    if (btnDmAreaExpand) {
        btnDmAreaExpand.addEventListener('click', () => shiftOrScaleDanmakuArea(0, 6, '弹幕显示区域已放大'));
    }
    if (btnResetDmPortRange) {
        btnResetDmPortRange.addEventListener('click', () => {
            if (inDmPortMin) inDmPortMin.value = 10;
            if (inDmPortMax) inDmPortMax.value = 24;
            applyPortRangeChange(true);
            toast('📱 已恢复竖屏默认弹幕区域：画面上方区域 (10%~24%)');
        });
    }

    // 全局弹幕显隐同步
    function applyDanmakuVisibility(isVisible) {
        if (danmakuContainer) {
            danmakuContainer.style.display = isVisible ? 'block' : 'none';
        }
        if (swDanmaku) {
            swDanmaku.checked = isVisible;
        }
        if (btnQuickDmToggle) {
            btnQuickDmToggle.classList.toggle('active', isVisible);
        }
        if (dyBtnDmToggle) {
            dyBtnDmToggle.classList.toggle('active', isVisible);
        }
        const dyDmBarToggleBtn = document.getElementById('dy-dm-bar-toggle-btn');
        if (dyDmBarToggleBtn) {
            dyDmBarToggleBtn.classList.toggle('active', isVisible);
        }
        const dyBtnDmRound = document.getElementById('dy-btn-dm-round');
        if (dyBtnDmRound) {
            dyBtnDmRound.classList.toggle('dm-off', !isVisible);
        }
    }
    window.applyDanmakuVisibility = applyDanmakuVisibility;

    applyDanmakuVisibility(false);

    if (swDanmaku) {
        swDanmaku.addEventListener('change', (e) => {
            applyDanmakuVisibility(e.target.checked);
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        });
    }

    if (btnQuickDmToggle) {
        btnQuickDmToggle.addEventListener('click', () => {
            const nextState = !swDanmaku.checked;
            applyDanmakuVisibility(nextState);
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            toast(nextState ? '弹幕已开启' : '弹幕已关闭');
        });
    }

    if (dyBtnDmToggle) {
        dyBtnDmToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const nextState = !swDanmaku.checked;
            applyDanmakuVisibility(nextState);
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            toast(nextState ? '彈幕已開啟' : '彈幕已關閉');
        });
    }

    if (btnOpenDmInput) {
        btnOpenDmInput.addEventListener('click', () => {
            const userDm = prompt('请输入你要发射的实时弹幕：', document.getElementById('disp-dm-placeholder').textContent);
            if (userDm && userDm.trim()) {
                window.DanmakuEngine.fireLive(userDm.trim(), '#ffffff');
                applyDanmakuVisibility(true);
                toast(`🚀 弹幕已发射：「${userDm.trim()}」`);
            }
        });
    }

    window.DanmakuEngine.refresh();
})();
