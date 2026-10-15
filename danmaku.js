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

    getActiveList() {
        return this.list.filter(item => item.visible !== false);
    },

    refresh() {
        renderDanmakuStage();
        renderDanmakuTracksUI();
    },

    togglePause(forceState) {
        if (!this.container) return;
        this.isPaused = (forceState !== undefined) ? forceState : !this.isPaused;

        if (this.isPaused) {
            this.container.classList.add('is-paused');
        } else {
            this.container.classList.remove('is-paused');
        }

        syncPauseButtonUI(this.isPaused);

        if (typeof window.showToast === 'function') {
            window.showToast(this.isPaused ? '⏸️ 弹幕已原地定格 (便于预览位置与截图)' : '▶ 弹幕已恢复正常飘动');
        }
    },

    loadPreset(presetKey) {
        if (!presetsDB[presetKey]) return;
        this.list = JSON.parse(JSON.stringify(presetsDB[presetKey]));
        this.refresh();
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        if (typeof window.showToast === 'function') {
            window.showToast(`已载入预设案例：${presetNames[presetKey]}`);
        }
    },

    fireLive(text, color = '#ffffff') {
        if (!text || !text.trim()) return;
        const newTrack = {
            id: 'dm_live_' + Date.now(),
            text: text.trim(),
            top: Math.floor(Math.random() * 55) + 14,
            left: 45,
            color: color,
            size: parseInt(document.getElementById('in-danmaku-size')?.value) || 16,
            speed: 8,
            visible: true
        };
        this.list.unshift(newTrack);
        this.refresh();
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
    }
};

const presetNames = {
    driver: '🔥 老司机身材热评组',
    climax: '💥 剧情高能爆点组',
    traffic: '👑 Laya暗号引流组'
};

const presetsDB = {
    driver: [
        { id: 'd1', text: '這身材太頂了吧！純欲天花板', top: 15, left: 14, color: '#ffffff', size: 17, speed: 9, visible: true },
        { id: 'd2', text: '這腰臀比是真實存在的嗎？我好了', top: 28, left: 45, color: '#f39c12', size: 16, speed: 11, visible: true },
        { id: 'd3', text: '極品尤物，營養快線徹底跟不上了！', top: 46, left: 10, color: '#fe2c55', size: 19, speed: 8, visible: true },
        { id: 'd4', text: '4K 無碼原畫就是香，毛孔都看得清', top: 62, left: 52, color: '#00d2d3', size: 16, speed: 12, visible: true },
        { id: 'd5', text: '已截圖珍藏，感謝樓主好人一生平安！', top: 78, left: 22, color: '#2ecc71', size: 15, speed: 10, visible: true }
    ],
    climax: [
        { id: 'c1', text: '前方高能！3分20秒直接起飛預警！', top: 16, left: 20, color: '#fe2c55', size: 20, speed: 7, visible: true },
        { id: 'c2', text: '衛生紙已經用掉半包了，這誰頂得住', top: 32, left: 48, color: '#ff7675', size: 17, speed: 9, visible: true },
        { id: 'c3', text: '兄弟們我先衝為敬，後面跟上！', top: 52, left: 12, color: '#f1c40f', size: 18, speed: 8, visible: true },
        { id: 'c4', text: '求女主番號！這聲音聽得骨頭都酥了', top: 68, left: 58, color: '#ffffff', size: 16, speed: 10, visible: true },
        { id: 'c5', text: '刺激！這劇情反轉直接戳中XP了', top: 82, left: 28, color: '#a29bfe', size: 16, speed: 12, visible: true }
    ],
    traffic: [
        { id: 't1', text: 'Laya 暗號 1896 真的能看！已解鎖未刪減版', top: 16, left: 15, color: '#f39c12', size: 18, speed: 9, visible: true },
        { id: 't2', text: '免費通道竟然一點都不卡，太良心了', top: 30, left: 46, color: '#ffffff', size: 16, speed: 11, visible: true },
        { id: 't3', text: '來 Laya 語音廳，親自演給你看，懂的都懂！', top: 48, left: 8, color: '#2ecc71', size: 19, speed: 8, visible: true },
        { id: 't4', text: '私密群已上車，高清完整無水印爽翻', top: 66, left: 52, color: '#00d2d3', size: 16, speed: 10, visible: true },
        { id: 't5', text: '原畫質連線就是爽，今晚不用睡了', top: 80, left: 20, color: '#ff9ff3', size: 16, speed: 12, visible: true }
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

    window.DanmakuEngine.container = danmakuContainer;
    window.DanmakuEngine.trackListUI = danmakuTrackList;
    window.DanmakuEngine.list = JSON.parse(JSON.stringify(presetsDB.driver));

    const toast = (msg) => {
        if (typeof window.showToast === 'function') window.showToast(msg);
    };

    /* ==========================================================================
       1. 舞台弹幕渲染 (首屏负延时预分布技术，开启即见全屏飘字)
       ========================================================================== */
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
            el.style.top = dm.top + '%';
            el.style.color = dm.color;
            el.style.fontSize = (dm.size || 16) + 'px';

            if (isFixed) {
                el.style.animation = 'none';
                el.style.transform = 'none';
                el.style.left = (dm.left !== undefined ? dm.left : 20) + '%';
            } else {
                const baseDuration = Math.max(2, (dm.speed || 8) / window.DanmakuEngine.speedFactor);
                el.style.animationDuration = baseDuration.toFixed(1) + 's';
                
                // 交错负延时，使弹幕在初次加载时直接处于屏幕中途位置
                const staggerDelay = -((idx * 1.9) % baseDuration);
                el.style.animationDelay = staggerDelay.toFixed(1) + 's';
            }

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
                    <input type="text" class="dm-input-text" value="${dm.text}" placeholder="弹幕文字">
                    <button class="dm-track-del" title="删除此条">✕</button>
                </div>
                <div class="dm-track-row2">
                    <label>Y高: <input type="number" class="dm-input-top" value="${dm.top}" min="5" max="92" style="width:38px;">%</label>
                    ${isFixed ? `
                        <label>X位: <input type="number" class="dm-input-left" value="${dm.left !== undefined ? dm.left : 20}" min="2" max="88" style="width:38px;">%</label>
                    ` : `
                        <label>速度: <input type="number" class="dm-input-speed" value="${dm.speed || 8}" min="3" max="25" style="width:36px;">s</label>
                    `}
                    <label>字号: <input type="number" class="dm-input-size" value="${dm.size || 16}" min="12" max="36" style="width:38px;">px</label>
                    <label>色: <input type="color" class="dm-input-color" value="${dm.color}"></label>
                    <label style="cursor:pointer; display:flex; align-items:center;">
                        <input type="checkbox" class="dm-input-vis" ${dm.visible !== false ? 'checked' : ''}> 显示
                    </label>
                </div>
            `;

            card.querySelector('.dm-input-text').addEventListener('input', (e) => {
                dm.text = e.target.value;
                const stageEl = document.getElementById('stage_' + dm.id);
                if (stageEl) stageEl.textContent = e.target.value;
                if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            });

            card.querySelector('.dm-input-top').addEventListener('input', (e) => {
                dm.top = Math.min(95, Math.max(5, parseInt(e.target.value) || 20));
                const stageEl = document.getElementById('stage_' + dm.id);
                if (stageEl) stageEl.style.top = dm.top + '%';
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
                    dm.speed = Math.min(30, Math.max(3, parseInt(e.target.value) || 8));
                    const stageEl = document.getElementById('stage_' + dm.id);
                    if (stageEl) {
                        const duration = Math.max(2, dm.speed / window.DanmakuEngine.speedFactor);
                        stageEl.style.animationDuration = duration.toFixed(1) + 's';
                    }
                    if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
                });
            }

            card.querySelector('.dm-input-size').addEventListener('input', (e) => {
                dm.size = Math.min(40, Math.max(12, parseInt(e.target.value) || 16));
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

    if (inDanmakuSize && txtDanmakuSize) {
        inDanmakuSize.addEventListener('input', (e) => {
            const sizeVal = e.target.value + 'px';
            document.documentElement.style.setProperty('--danmaku-size', sizeVal);
            txtDanmakuSize.textContent = sizeVal;
            window.DanmakuEngine.list.forEach(dm => dm.size = parseInt(e.target.value));
            renderDanmakuStage();
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        });
    }

    if (btnAddDanmaku) {
        btnAddDanmaku.addEventListener('click', () => {
            const randomTops = [15, 25, 40, 55, 70, 82];
            const randomLefts = [10, 25, 45, 60, 20];
            const colors = ['#ffffff', '#f39c12', '#fe2c55', '#00d2d3', '#2ecc71', '#ff7675'];
            const idx = window.DanmakuEngine.list.length + 1;

            window.DanmakuEngine.list.push({
                id: 'dm_custom_' + Date.now(),
                text: '自定義彈幕 ' + idx,
                top: randomTops[idx % randomTops.length],
                left: randomLefts[idx % randomLefts.length],
                color: colors[idx % colors.length],
                size: parseInt(inDanmakuSize.value) || 16,
                speed: 8 + (idx % 4) * 2,
                visible: true
            });
            window.DanmakuEngine.refresh();
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            toast('已新增 1 条自定义弹幕');
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

            const colors = ['#ffffff', '#f39c12', '#2ecc71', '#54a0ff', '#fe2c55', '#00d2d3'];
            const newTracks = segs.map((txt, i) => ({
                id: 'dm_b_' + Date.now() + '_' + i,
                text: txt,
                top: 14 + (i % 6) * 12,
                left: 10 + (i % 4) * 18,
                color: colors[i % colors.length],
                size: parseInt(inDanmakuSize.value) || 16,
                speed: 8 + (i % 4) * 1.5,
                visible: true
            }));

            window.DanmakuEngine.list = [...window.DanmakuEngine.list, ...newTracks];
            window.DanmakuEngine.refresh();
            inBatchDanmaku.value = '';
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            toast(`已导入 ${segs.length} 条弹幕！`);
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
    }

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
                window.DanmakuEngine.fireLive(userDm.trim(), '#ff7675');
                applyDanmakuVisibility(true);
                toast(`🚀 弹幕已发射：「${userDm.trim()}」`);
            }
        });
    }

    window.DanmakuEngine.refresh();
})();
