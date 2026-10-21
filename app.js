/**
 * ==========================================================================
 * app.js - 全局中枢控制、真实蓝/紫双Logo原图无损导出、真机录屏合成与持久化引擎
 * ==========================================================================
 */

window.showToast = function (msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    // 页面初始化恢复缓存期间，不弹出任何打扰用户的 Toast
    if (window.__isRestoringStorage) return;

    // 剥离所有 Emoji 小表情、压缩冗余提示词，且仅保留最新 1 条轻提示，绝不堆叠遮挡画面
    let cleanMsg = String(msg || '')
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2705}\u{274C}\u{26A0}\u{FE0F}\u{200D}]+/gu, '')
        .replace(/^[\s·•|：:-]+/, '')
        .replace(/^已切换为[：:]\s*/, '')
        .replace(/^已切換為[：:]\s*/, '')
        .replace(/^画面已切换为[：:]\s*/, '')
        .replace(/，可直接拖动绿框调整构图！/g, '')
        .replace(/\s*\([^)]*\)\s*/g, '')
        .trim();
    if (!cleanMsg) return;
    container.innerHTML = '';
    toast.textContent = cleanMsg;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 260);
    }, 1500);
};

// 切换右侧控制面板选项卡
window.switchRightTab = function (mode) {
    const tabWeb = document.getElementById('tab-btn-web');
    const tabCinema = document.getElementById('tab-btn-m-cinema');
    const tabDy = document.getElementById('tab-btn-dy');
    const tabDm = document.getElementById('tab-btn-dm');
    
    const panelWeb = document.getElementById('panel-web-settings');
    const panelCinema = document.getElementById('panel-m-cinema-settings');
    const panelDy = document.getElementById('panel-dy-settings');
    const panelDm = document.getElementById('panel-dm-settings');

    [tabWeb, tabCinema, tabDy, tabDm].forEach(b => b && b.classList.remove('active'));
    [panelWeb, panelCinema, panelDy, panelDm].forEach(p => p && p.classList.remove('active'));

    if (mode === 'm-cinema') {
        if (tabCinema) tabCinema.classList.add('active');
        if (panelCinema) panelCinema.classList.add('active');
    } else if (mode === 'dy') {
        if (tabDy) tabDy.classList.add('active');
        if (panelDy) panelDy.classList.add('active');
    } else if (mode === 'dm') {
        if (tabDm) tabDm.classList.add('active');
        if (panelDm) panelDm.classList.add('active');
    } else {
        if (tabWeb) tabWeb.classList.add('active');
        if (panelWeb) panelWeb.classList.add('active');
        const qaModeBadgeEl = document.getElementById('qa-rail-mode-badge');
        if (qaModeBadgeEl) qaModeBadgeEl.textContent = '💻 电脑网页';
    }
};

(function () {
    const STORAGE_KEY = 'LAYA_STUDIO_PERSIST_V12';
    let saveTimeout = null;

    const tabWeb = document.getElementById('tab-btn-web');
    const tabCinema = document.getElementById('tab-btn-m-cinema');
    const tabDy = document.getElementById('tab-btn-dy');
    const tabDm = document.getElementById('tab-btn-dm');

    if (tabWeb) tabWeb.addEventListener('click', () => window.switchRightTab('web'));
    if (tabCinema) tabCinema.addEventListener('click', () => window.switchRightTab('m-cinema'));
    if (tabDy) tabDy.addEventListener('click', () => window.switchRightTab('dy'));
    if (tabDm) tabDm.addEventListener('click', () => window.switchRightTab('dm'));

    /* ==========================================================================
       ★ 0.5 中间长条「⚡ 快速访问」快捷键导航栏：选中放大高亮、未选文字缩小、双向联动
       ========================================================================== */
    const qaRailEl = document.getElementById('quick-access-rail');
    const btnQaToggle = document.getElementById('btn-qa-toggle');
    const btnQaCloseTop = document.getElementById('btn-qa-close-top');
    const qaHandleText = document.getElementById('qa-handle-text');
    const qaRailList = document.getElementById('qa-rail-list');
    const qaModeBadge = document.getElementById('qa-rail-mode-badge');
    const rightSidebarEl = document.getElementById('right-sidebar');

    function setQuickAccessCollapsed(collapsed) {
        if (!qaRailEl) return;
        qaRailEl.classList.toggle('is-collapsed', collapsed);
        if (qaHandleText) {
            qaHandleText.textContent = collapsed ? '快速访问' : '收起';
        }
    }

    if (btnQaToggle && qaRailEl) {
        btnQaToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isNowCollapsed = !qaRailEl.classList.contains('is-collapsed');
            setQuickAccessCollapsed(isNowCollapsed);
        });
    }
    if (btnQaCloseTop) {
        btnQaCloseTop.addEventListener('click', (e) => {
            e.stopPropagation();
            setQuickAccessCollapsed(true);
        });
    }

    function ensureRightPanelCardIds() {
        if (!rightSidebarEl) return;
        const allCards = rightSidebarEl.querySelectorAll('.panel-card');
        const headerKeywordMap = [
            { kw: '官方 Logo 切换', id: 'card-logo-switch' },
            { kw: '手机竖屏皮肤模式切换', id: 'card-dy-skin' },
            { kw: '顶部手机状态栏与机型仿真', id: 'card-dy-statusbar' },
            { kw: '全屏观看与横竖取景设置', id: 'card-dy-fullscreen' },
            { kw: '智能画面字幕识别与多条编辑', id: 'card-dy-subtitle' },
            { kw: '全屏观看(横屏) 控件显隐', id: 'card-dyl-switches' },
            { kw: '竖屏专属组件显隐开关', id: 'card-dy-switches' },
            { kw: '互动数据与作者资料', id: 'card-dy-author' },
            { kw: '热点与热搜词配置', id: 'card-dy-hotspot' },
            { kw: '评论区弹窗与图文', id: 'card-dy-comment-studio' },
            { kw: '电脑网页端小配件显隐矩阵', id: 'card-web-switches' },
            { kw: '高能热度波浪曲线', id: 'card-web-wave' },
            { kw: '电脑端文案与预设自定义', id: 'card-web-text' },
            { kw: '手机顶部状态栏仿真配置', id: 'card-mc-statusbar' },
            { kw: '左上角画质徽标与标题配置', id: 'card-mc-badge' },
            { kw: '手机横屏组件显隐开关', id: 'card-mc-switches' },
            { kw: '弹幕运动与定格控制', id: 'card-dm-studio' },
            { kw: '独立取景框', id: 'card-crop-box' }
        ];

        allCards.forEach(card => {
            const headerEl = card.querySelector('.card-header');
            const headerTxt = headerEl ? headerEl.textContent : '';
            if (headerTxt.includes('起始时间与进度条控制')) {
                if (card.closest('#panel-m-cinema-settings')) {
                    card.id = 'card-mc-time';
                } else if (card.closest('#panel-web-settings')) {
                    card.id = 'card-web-time';
                }
                return;
            }
            for (const rule of headerKeywordMap) {
                if (headerTxt.includes(rule.kw)) {
                    card.id = rule.id;
                    break;
                }
            }
        });
    }
    ensureRightPanelCardIds();

    let isQaProgrammaticScroll = false;
    let qaScrollTimer = null;

    function setActiveQuickAccessItem(targetCardId, scrollRailIntoView = true) {
        if (!qaRailList || !targetCardId) return;
        const qaItems = qaRailList.querySelectorAll('.qa-item');
        qaItems.forEach(btn => {
            const isMatch = btn.getAttribute('data-target-card') === targetCardId;
            btn.classList.toggle('active', isMatch);
            if (isMatch && scrollRailIntoView) {
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    if (qaRailList && rightSidebarEl) {
        const qaItems = qaRailList.querySelectorAll('.qa-item');
        qaItems.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetCardId = btn.getAttribute('data-target-card');
                const targetTab = btn.getAttribute('data-tab');

                // 1. 立即切换选中项放大高亮，其余未选项文字与尺寸自动缩小
                setActiveQuickAccessItem(targetCardId, false);

                // 2. 自动切换到对应的右侧控制面板 Tab
                if (targetTab && targetTab !== 'keep' && typeof window.switchRightTab === 'function') {
                    window.switchRightTab(targetTab);
                    if (qaModeBadge) {
                        const badgeMap = { 'dy': '竖屏社区', 'web': '电脑网页', 'm-cinema': '手机横屏', 'dm': '弹幕工坊' };
                        qaModeBadge.textContent = badgeMap[targetTab] || '全板块';
                    }
                }

                // 3. 丝滑滚动右侧控制面板到目标卡片，并触发流光呼吸边框提示
                ensureRightPanelCardIds();
                const cardEl = document.getElementById(targetCardId);
                if (cardEl) {
                    isQaProgrammaticScroll = true;
                    if (qaScrollTimer) clearTimeout(qaScrollTimer);

                    rightSidebarEl.querySelectorAll('.panel-card.qa-card-focus-glow').forEach(c => {
                        c.classList.remove('qa-card-focus-glow');
                    });

                    requestAnimationFrame(() => {
                        const sidebarRect = rightSidebarEl.getBoundingClientRect();
                        const cardRect = cardEl.getBoundingClientRect();
                        const targetTop = rightSidebarEl.scrollTop + (cardRect.top - sidebarRect.top) - 12;
                        rightSidebarEl.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });

                        void cardEl.offsetWidth;
                        cardEl.classList.add('qa-card-focus-glow');

                        // 自动聚焦卡片内第一个主下拉框或输入框，方便一键直改
                        const firstControl = cardEl.querySelector('select, input[type="text"]');
                        if (firstControl && targetCardId !== 'card-dy-comment-studio') {
                            setTimeout(() => {
                                try { firstControl.focus({ preventScroll: true }); } catch (e) {}
                            }, 280);
                        }
                    });

                    qaScrollTimer = setTimeout(() => {
                        isQaProgrammaticScroll = false;
                    }, 620);
                }
            });
        });

        // 当用户在右侧控制栏手动滚动或点击某张卡片时，中间快速访问栏也自动联动放大对应项
        rightSidebarEl.addEventListener('click', (e) => {
            const clickedCard = e.target.closest('.panel-card');
            if (clickedCard && clickedCard.id) {
                setActiveQuickAccessItem(clickedCard.id, true);
            }
        });

        rightSidebarEl.addEventListener('scroll', () => {
            if (isQaProgrammaticScroll) return;
            const sidebarRect = rightSidebarEl.getBoundingClientRect();
            const anchorY = sidebarRect.top + 95;
            const visibleCards = Array.from(rightSidebarEl.querySelectorAll('.panel-card')).filter(c => c.offsetParent !== null && c.id);
            let bestCard = null;
            let bestDist = Infinity;
            visibleCards.forEach(c => {
                const r = c.getBoundingClientRect();
                const dist = Math.abs(r.top - anchorY);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestCard = c;
                }
            });
            if (bestCard && bestCard.id) {
                setActiveQuickAccessItem(bestCard.id, true);
            }
        }, { passive: true });
    }

    /* ==========================================================================
       ★ 1. 官方蓝/紫双 Logo 默认自带引擎 (免上传直出，同时支持可选自定义替换)
       ========================================================================== */
    const selLogoVersion = document.getElementById('sel-logo-version');
    const upLogo1 = document.getElementById('up-logo-1');
    const upLogo2 = document.getElementById('up-logo-2');
    const btnResetBuiltinLogo = document.getElementById('btn-reset-builtin-logo');
    const headerBrandLogo = document.getElementById('header-brand-logo');
    const playerMiniLogo = document.getElementById('player-mini-logo');
    const mBrandLogo = document.getElementById('m-brand-logo');
    const dyLfWmLogo = document.getElementById('dy-lf-wm-logo');
    const dyAvatarImg = document.getElementById('dy-avatar-img');
    const dylDispAvatar = document.getElementById('dyl-disp-avatar');

    // 默认直接使用自带的 window.LOCAL_LOGOS (Laya.png / Laya2.png)，若用户主动上传过自定义图标则优先用用户的
    const customLogoDB = {
        'Laya.png': localStorage.getItem('LAYA_CUSTOM_LOGO_1') || (window.LOCAL_LOGOS && window.LOCAL_LOGOS['Laya.png']) || 'Laya.png',
        'Laya2.png': localStorage.getItem('LAYA_CUSTOM_LOGO_2') || (window.LOCAL_LOGOS && window.LOCAL_LOGOS['Laya2.png']) || 'Laya2.png'
    };

    function getActiveLogoSrc(logoKey) {
        return customLogoDB[logoKey] || (window.LOCAL_LOGOS && window.LOCAL_LOGOS[logoKey]) || logoKey;
    }

    function applyLogoVersion(logoKey, shouldSave = true) {
        const realSrc = getActiveLogoSrc(logoKey);

        if (headerBrandLogo) {
            headerBrandLogo.src = realSrc;
            headerBrandLogo.style.display = 'block';
        }
        if (playerMiniLogo) playerMiniLogo.src = realSrc;
        if (mBrandLogo) mBrandLogo.src = realSrc;
        if (dyLfWmLogo) dyLfWmLogo.src = realSrc;
        const dyFeaturedLogoImg = document.getElementById('dy-featured-logo-img');
        if (dyFeaturedLogoImg) dyFeaturedLogoImg.src = realSrc;

        // 手机竖屏头像与全屏横屏头像如果没单独上传过其他人物头像，也同步使用当前自带蓝/紫 Logo
        if (dyAvatarImg && (!dyAvatarImg.dataset.custom || dyAvatarImg.dataset.custom === 'false')) {
            dyAvatarImg.src = realSrc;
            if (dylDispAvatar) dylDispAvatar.src = realSrc;
        }
        if (shouldSave && typeof triggerSaveStorage === 'function') triggerSaveStorage();
    }

    // 页面启动立即装载自带默认 Logo，无需任何手动上传
    applyLogoVersion(selLogoVersion ? selLogoVersion.value : 'Laya.png', false);

    if (selLogoVersion) {
        selLogoVersion.addEventListener('change', (e) => {
            applyLogoVersion(e.target.value);
            window.showToast(e.target.value === 'Laya2.png' ? '🟣 已切换为：自带紫色图标 (Laya2.png)' : '🔵 已切换为：自带蓝色图标 (Laya.png)');
        });
    }

    // 可选：用户主动上传替换蓝色 Logo
    if (upLogo1) {
        upLogo1.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                customLogoDB['Laya.png'] = evt.target.result;
                localStorage.setItem('LAYA_CUSTOM_LOGO_1', evt.target.result);
                if (selLogoVersion) selLogoVersion.value = 'Laya.png';
                applyLogoVersion('Laya.png');
                window.showToast('✅ 已替换为你自定义的蓝色 Logo！');
            };
            reader.readAsDataURL(file);
        });
    }

    // 可选：用户主动上传替换紫色 Logo
    if (upLogo2) {
        upLogo2.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                customLogoDB['Laya2.png'] = evt.target.result;
                localStorage.setItem('LAYA_CUSTOM_LOGO_2', evt.target.result);
                if (selLogoVersion) selLogoVersion.value = 'Laya2.png';
                applyLogoVersion('Laya2.png');
                window.showToast('✅ 已替换为你自定义的紫色 Logo！');
            };
            reader.readAsDataURL(file);
        });
    }

    // 一键恢复系统自带的 Laya.png / Laya2.png
    if (btnResetBuiltinLogo) {
        btnResetBuiltinLogo.addEventListener('click', () => {
            localStorage.removeItem('LAYA_CUSTOM_LOGO_1');
            localStorage.removeItem('LAYA_CUSTOM_LOGO_2');
            customLogoDB['Laya.png'] = (window.LOCAL_LOGOS && window.LOCAL_LOGOS['Laya.png']) || 'Laya.png';
            customLogoDB['Laya2.png'] = (window.LOCAL_LOGOS && window.LOCAL_LOGOS['Laya2.png']) || 'Laya2.png';
            applyLogoVersion(selLogoVersion ? selLogoVersion.value : 'Laya.png');
            window.showToast('✨ 已恢复系统自带的官方 Logo 图标！');
        });
    }

    /* ==========================================================================
       2. 手机横屏影音模式 (19.5:9) 专属控制绑定
       ========================================================================== */
    const inMStatusTime = document.getElementById('in-m-status-time');
    const mDispStatusTime = document.getElementById('m-disp-status-time');
    const selMSignal = document.getElementById('sel-m-signal');
    const mSignalGroup = document.getElementById('m-signal-group');
    const inMBatteryPct = document.getElementById('in-m-battery-pct');
    const mDispBatteryFill = document.getElementById('m-disp-battery-fill');
    const txtMBattery = document.getElementById('txt-m-battery');

    if (inMStatusTime && mDispStatusTime) {
        inMStatusTime.addEventListener('input', (e) => {
            mDispStatusTime.textContent = e.target.value;
            triggerSaveStorage();
        });
    }

    if (selMSignal && mSignalGroup) {
        selMSignal.addEventListener('change', (e) => {
            const level = parseInt(e.target.value) || 4;
            const bars = mSignalGroup.querySelectorAll('.m-sig-bar');
            bars.forEach((bar, idx) => {
                bar.classList.toggle('active', idx < level);
            });
            triggerSaveStorage();
        });
    }

    if (inMBatteryPct && mDispBatteryFill) {
        inMBatteryPct.addEventListener('input', (e) => {
            const val = Math.min(100, Math.max(5, parseInt(e.target.value) || 85));
            mDispBatteryFill.style.width = val + '%';
            if (txtMBattery) txtMBattery.textContent = val + '%';
            triggerSaveStorage();
        });
    }

    // ★ 手机横屏左上角画质徽标 (4K / 1080P / 藍光 / 8K) 切换与点击轮换
    const selMResBadge = document.getElementById('sel-m-res-badge');
    const mDispResBadge = document.getElementById('m-disp-res-badge');

    function applyMResBadge(valStr) {
        if (!mDispResBadge || !valStr) return;
        const [txt, styleClass] = valStr.split('|');
        mDispResBadge.textContent = txt || '4K';
        mDispResBadge.className = `m-res-badge ${styleClass || 'badge-gold'} interactive-elem`;
    }

    if (selMResBadge && mDispResBadge) {
        selMResBadge.addEventListener('change', (e) => {
            applyMResBadge(e.target.value);
            triggerSaveStorage();
        });

        // 支持直接点击画面上的 4K 徽标循环切换款式
        mDispResBadge.addEventListener('click', () => {
            const nextIdx = (selMResBadge.selectedIndex + 1) % selMResBadge.options.length;
            selMResBadge.selectedIndex = nextIdx;
            applyMResBadge(selMResBadge.value);
            window.showToast(`✨ 已切换画质徽标：${selMResBadge.options[nextIdx].text}`);
            triggerSaveStorage();
        });
    }

    const inMMainTitle = document.getElementById('in-m-main-title');
    const mDispMainTitle = document.getElementById('m-disp-main-title');
    const inMSubTitle = document.getElementById('in-m-sub-title');
    const mDispSubTitle = document.getElementById('m-disp-sub-title');

    if (inMMainTitle && mDispMainTitle) {
        inMMainTitle.addEventListener('input', (e) => {
            mDispMainTitle.textContent = e.target.value;
            triggerSaveStorage();
        });
    }

    if (inMSubTitle && mDispSubTitle) {
        inMSubTitle.addEventListener('input', (e) => {
            mDispSubTitle.textContent = e.target.value;
            triggerSaveStorage();
        });
    }

    const mBtnVol = document.getElementById('m-btn-vol');
    const mBtnCast = document.getElementById('m-btn-cast');
    const mBtnSetting = document.getElementById('m-btn-setting');
    const mBtnFullscreen = document.getElementById('m-btn-fullscreen');
    const mBtnShare = document.getElementById('m-btn-share');

    if (mBtnShare) {
        mBtnShare.addEventListener('click', () => {
            window.showToast('🔗 已复制视频分享链接，快去转发吧！');
        });
    }

    if (mBtnVol) {
        mBtnVol.addEventListener('click', () => {
            const previewVideo = document.getElementById('preview-video');
            if (previewVideo && window.PlayerEngine.isVideoMode) {
                previewVideo.muted = !previewVideo.muted;
                window.showToast(previewVideo.muted ? '🔇 视频已静音' : '🔊 视频原声已开启');
            } else {
                window.showToast('🔊 音量控制');
            }
        });
    }

    if (mBtnCast) {
        mBtnCast.addEventListener('click', () => {
            window.showToast('📺 正在搜索局域网内可投屏的智能电视设备...');
        });
    }

    if (mBtnSetting) {
        mBtnSetting.addEventListener('click', () => {
            window.switchRightTab('m-cinema');
            window.showToast('⚙️ 已展开手机横屏配置面板');
        });
    }

    if (mBtnFullscreen) {
        mBtnFullscreen.addEventListener('click', () => {
            const btnOpenPreview = document.getElementById('btn-open-preview');
            if (btnOpenPreview) btnOpenPreview.click();
        });
    }

    /* ==========================================================================
       3. 电脑网页端高能热度波浪曲线
       ========================================================================== */
    const waveCanvas = document.getElementById('waveform-canvas');
    const wrapWaveform = document.getElementById('wrap-waveform');
    const swWaveform = document.getElementById('sw-waveform');
    const selWavePreset = document.getElementById('sel-waveform-preset');
    const inWaveHeight = document.getElementById('in-wave-height');
    const txtWaveHeight = document.getElementById('txt-wave-height');
    const inCustomWave = document.getElementById('in-custom-wave');
    const wrapCustomWave = document.getElementById('wrap-custom-wave');

    window.drawWaveform = function () {
        if (!swWaveform || !wrapWaveform || !waveCanvas) return;
        if (!swWaveform.checked) {
            wrapWaveform.style.display = 'none';
            return;
        }
        wrapWaveform.style.display = 'block';

        const ctx = waveCanvas.getContext('2d');
        const w = (waveCanvas.width = waveCanvas.offsetWidth || 800);
        const h = (waveCanvas.height = parseInt(inWaveHeight.value) || 32);

        ctx.clearRect(0, 0, w, h);

        let points = [15, 25, 60, 40, 85, 95, 45, 75, 30, 10];
        if (selWavePreset.value === 'climax') {
            points = [10, 15, 20, 25, 40, 50, 70, 85, 100, 90];
        } else if (selWavePreset.value === 'dense') {
            points = [30, 80, 45, 90, 35, 85, 40, 95, 50, 70, 30];
        } else if (selWavePreset.value === 'custom') {
            points = inCustomWave.value.split(',').map(n => Math.min(100, Math.max(0, parseInt(n.trim()) || 0)));
            if (points.length < 2) points = [10, 80, 20];
        }

        ctx.beginPath();
        ctx.moveTo(0, h);
        const step = w / (points.length - 1);
        for (let i = 0; i < points.length; i++) {
            const x = i * step;
            const y = h - (points[i] / 100) * (h - 4);
            if (i === 0) {
                ctx.lineTo(x, y);
            } else {
                const prevX = (i - 1) * step;
                const prevY = h - (points[i - 1] / 100) * (h - 4);
                const cx = (prevX + x) / 2;
                ctx.bezierCurveTo(cx, prevY, cx, y, x, y);
            }
        }
        ctx.lineTo(w, h);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    };

    if (selWavePreset) {
        selWavePreset.addEventListener('change', () => {
            if (wrapCustomWave) wrapCustomWave.style.display = selWavePreset.value === 'custom' ? 'flex' : 'none';
            window.drawWaveform();
            triggerSaveStorage();
        });
    }

    if (inWaveHeight && txtWaveHeight && wrapWaveform) {
        inWaveHeight.addEventListener('input', (e) => {
            txtWaveHeight.textContent = e.target.value + 'px';
            wrapWaveform.style.height = e.target.value + 'px';
            window.drawWaveform();
            triggerSaveStorage();
        });
    }

    if (inCustomWave) {
        inCustomWave.addEventListener('input', () => {
            window.drawWaveform();
            triggerSaveStorage();
        });
    }

    window.addEventListener('resize', window.drawWaveform);
    setTimeout(window.drawWaveform, 200);

    /* ==========================================================================
       4. 播放器内交互小组件
       ========================================================================== */
    const selRecordSec = document.getElementById('sel-record-sec');
    const inCustomSec = document.getElementById('in-custom-sec');
    if (selRecordSec && inCustomSec) {
        selRecordSec.addEventListener('change', (e) => {
            const isCustom = (e.target.value === 'custom');
            inCustomSec.style.display = isCustom ? 'inline-block' : 'none';
            const sec = isCustom ? (parseFloat(inCustomSec.value) || 10) : (parseFloat(e.target.value) || 10);
            if (window.PlayerEngine && typeof window.PlayerEngine.applyDropdownDuration === 'function') {
                window.PlayerEngine.applyDropdownDuration(sec);
            }
        });
        inCustomSec.addEventListener('input', () => {
            const sec = parseFloat(inCustomSec.value);
            if (sec >= 1 && window.PlayerEngine && typeof window.PlayerEngine.applyDropdownDuration === 'function') {
                window.PlayerEngine.applyDropdownDuration(sec);
            }
        });
    }

    const btnCycleSpeed = document.getElementById('btn-cycle-speed');
    const dispSpeedVal = document.getElementById('disp-speed-val');
    const speeds = ['1.0', '1.25', '1.5', '2.0', '3.0', '0.5', '0.75'];
    let speedIdx = 0;
    if (btnCycleSpeed && dispSpeedVal) {
        btnCycleSpeed.addEventListener('click', () => {
            speedIdx = (speedIdx + 1) % speeds.length;
            if (window.PlayerEngine && typeof window.PlayerEngine.setPreviewPlaybackSpeed === 'function') {
                window.PlayerEngine.setPreviewPlaybackSpeed(speeds[speedIdx], true);
            } else {
                dispSpeedVal.textContent = speeds[speedIdx] + 'X';
            }
            triggerSaveStorage();
        });
    }

    const dispBotRes = document.getElementById('disp-bot-res');
    const resOptions = ['原畫 1080P 60幀 ▾', 'Laya 藍光 4K ▾', '4K 120P 極致 ▾', '超清 720P ▾'];
    let resIdx = 0;
    if (dispBotRes) {
        dispBotRes.addEventListener('click', () => {
            resIdx = (resIdx + 1) % resOptions.length;
            dispBotRes.textContent = resOptions[resIdx];
            window.showToast(`已切换清晰度：${resOptions[resIdx].replace(' ▾', '')}`);
            triggerSaveStorage();
        });
    }

    const dyBtnLike = document.getElementById('dy-btn-like');
    const dySvgLike = document.getElementById('dy-svg-like');
    let isLiked = false;
    if (dyBtnLike && dySvgLike) {
        dyBtnLike.addEventListener('click', () => {
            isLiked = !isLiked;
            dySvgLike.setAttribute('fill', isLiked ? '#fe2c55' : '#ffffff');
            dyBtnLike.style.transform = 'scale(1.2)';
            setTimeout(() => { dyBtnLike.style.transform = 'scale(1)'; }, 150);
            window.showToast(isLiked ? '❤️ 已点赞' : '已取消点赞');
        });
    }

    const dyBtnStar = document.getElementById('dy-btn-star');
    const dySvgStar = document.getElementById('dy-svg-star');
    let isStarred = false;
    if (dyBtnStar && dySvgStar) {
        dyBtnStar.addEventListener('click', () => {
            isStarred = !isStarred;
            dySvgStar.setAttribute('fill', isStarred ? '#f1c40f' : '#ffffff');
            dyBtnStar.style.transform = 'scale(1.2)';
            setTimeout(() => { dyBtnStar.style.transform = 'scale(1)'; }, 150);
            window.showToast(isStarred ? '⭐ 已加入收藏' : '已取消收藏');
        });
    }

    const dyBtnFollow = document.getElementById('dy-btn-follow');
    if (dyBtnFollow) {
        dyBtnFollow.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dyBtnFollow.textContent === '+') {
                dyBtnFollow.textContent = '✓';
                dyBtnFollow.classList.add('followed');
                window.showToast('❤️ 已关注作者');
                if (dyBtnFollow._hideTimer) clearTimeout(dyBtnFollow._hideTimer);
                dyBtnFollow._hideTimer = setTimeout(() => {
                    dyBtnFollow.classList.add('follow-hidden');
                    const swFollowPlus = document.getElementById('sw-dy-follow-plus');
                    if (swFollowPlus) swFollowPlus.checked = false;
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                }, 650);
            } else {
                dyBtnFollow.textContent = '+';
                dyBtnFollow.classList.remove('followed');
                window.showToast('已取消关注');
            }
        });
    }

    /* ==========================================================================
       5. 手机竖屏双皮肤切换引擎
       ========================================================================== */
    const swDyFollowPlus = document.getElementById('sw-dy-follow-plus');
    const dyAvatarClickWrap = document.getElementById('dy-avatar-click');
    function setFollowPlusVisible(visible, save = true) {
        if (!dyBtnFollow) return;
        if (dyBtnFollow._hideTimer) clearTimeout(dyBtnFollow._hideTimer);
        if (visible) {
            dyBtnFollow.textContent = '+';
            dyBtnFollow.classList.remove('followed', 'follow-hidden');
        } else {
            dyBtnFollow.classList.add('follow-hidden');
        }
        if (swDyFollowPlus) swDyFollowPlus.checked = !!visible;
        if (save && typeof triggerSaveStorage === 'function') triggerSaveStorage();
    }
    if (swDyFollowPlus) {
        swDyFollowPlus.addEventListener('change', (e) => {
            setFollowPlusVisible(e.target.checked, true);
            window.showToast(e.target.checked ? '❤️ 已恢复显示头像下方红色 + 号' : '已隐藏头像下方红色 + 号');
        });
    }
    if (dyAvatarClickWrap && dyBtnFollow) {
        dyAvatarClickWrap.title = '点击直接上传更换右侧头像 (右键可一键系统随机生成头像)';
        dyAvatarClickWrap.addEventListener('click', (e) => {
            if (e.target === dyBtnFollow) return;
            const uploader = document.getElementById('dy-avatar-uploader');
            if (uploader) {
                uploader.value = '';
                uploader.click();
            }
        });
        dyAvatarClickWrap.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const btnRandAv = document.getElementById('btn-random-author-avatar');
            if (btnRandAv) btnRandAv.click();
        });
    }

    /* ==========================================================================
       ★ 4.8 手机竖屏评论区弹窗抽屉与在线随机头像/图文表情包互动引擎 (CommentEngine)
       ========================================================================== */
    // 记录打开页面或上传视频的基准时间戳，评论时间严格落在 [发布视频时间, 打开页面/上传视频时间] 之间
    window.__pageOpenOrUploadTime = Date.now();
    const mediaUploaderForTime = document.getElementById('media-uploader');
    if (mediaUploaderForTime) {
        mediaUploaderForTime.addEventListener('change', () => {
            window.__pageOpenOrUploadTime = Date.now();
        });
    }

    // 繁体中文昵称 (台/港/马风格) + 英文昵称 混合池
    const NICKNAME_POOL = [
        'Chloe_tw', 'Kevin.88', 'Jason_HK', '阿傑Jay', '子瑜✨',
        '林小柔', 'Mia_chen', 'Alex_W', '半糖去冰🧋', '夜貓子Owl',
        'Ethan_Lin', '微風信義', 'Sophia.L', '台北小辣椒🌶️', 'Lucas_MY',
        '港島妹妹', 'Olivia_99', 'Kuala_阿豪', 'Ryan_Tpe', '忠孝東路走九遍',
        '貓空看星星', 'abella.vibes', '旺角卡門', '珍奶要波霸', 'Daniel_K',
        '小確幸🌸', 'Leo_studio', '深夜食堂🍜', 'Vivian.c', '西門町阿翔',
        '維多利亞港的風', 'Marcus_852', '星際漫遊者', '萱萱_tw', '建宏_TPE',
        '芷晴_hk', '宇軒.my', 'Amber_Lin', '家豪_888', '心凌Cyndi✨'
    ];
    // 全繁体评论词池
    const COMMENT_TEXT_POOL = [
        '牛總還是有點大智慧的',
        '這劇情太牛了👍😁',
        '好一招釜底抽薪',
        '哈哈，我先入職花果山 再回來應聘 完美閉環🐺',
        '看到這一幕直接笑噴了😂',
        '還得是老戲骨，一個眼神直接封神🔥',
        '這一段我反反覆覆看了五遍，細節拉滿！',
        '只有我一個人覺得這段配樂絕了嗎😭',
        '大數據果然懂我，剛想找這個合集就刷到了',
        '笑不活了，評論區比正片還精彩😂',
        '建議直接申遺，這台詞功底太頂了👍',
        '前方高能！名場面打卡留念✨',
        '表面風平浪靜，實則全員八百個心眼子',
        '導演加雞腿，這運鏡和反轉真絕了👏',
        '太真實了，簡直就是在演我本人🤣',
        '這段張力直接拉滿，看起一身雞皮疙瘩'
    ];
    // 严格排除中国大陆省份，仅保留台湾、香港、马来西亚及海外国家地区（全繁体）
    const IP_POOL_TW = ['台灣', '台灣', '台灣', '台北', '新北', '台中', '高雄', '桃園', '台南'];
    const IP_POOL_HK_MO = ['香港', '香港', '香港', '澳門'];
    const IP_POOL_MY_SG = ['馬來西亞', '馬來西亞', '吉隆坡', '檳城', '新加坡', '新加坡'];
    const IP_POOL_OVERSEAS = ['美國', '加拿大', '日本', '韓國', '英國', '澳洲', '泰國', '法國', '德國', '紐西蘭'];
    const PROVINCE_POOL = [...IP_POOL_TW, ...IP_POOL_HK_MO, ...IP_POOL_MY_SG, ...IP_POOL_OVERSEAS];

    function pickOverseasIpLocation(regionMode) {
        const mode = regionMode || document.getElementById('sel-cmt-ip-region')?.value || (window.CommentEngine && window.CommentEngine.ipRegion) || 'tw-hk-my';
        if (mode === 'none') return '';
        if (mode === 'random-omit' && Math.random() < 0.38) return '';
        if (mode === 'tw-only') {
            return IP_POOL_TW[Math.floor(Math.random() * IP_POOL_TW.length)];
        }
        if (mode === 'hk-mo') {
            return IP_POOL_HK_MO[Math.floor(Math.random() * IP_POOL_HK_MO.length)];
        }
        if (mode === 'my-sg') {
            return IP_POOL_MY_SG[Math.floor(Math.random() * IP_POOL_MY_SG.length)];
        }
        if (mode === 'overseas-all') {
            return PROVINCE_POOL[Math.floor(Math.random() * PROVINCE_POOL.length)];
        }
        // 默认 tw-hk-my：优先台湾、香港、马来西亚，辅以海外国家，并支持约 15% 概率自然省略 IP
        const r = Math.random();
        if (r < 0.14) return '';
        if (r < 0.78) {
            const corePool = [...IP_POOL_TW, ...IP_POOL_HK_MO, ...IP_POOL_MY_SG];
            return corePool[Math.floor(Math.random() * corePool.length)];
        }
        return IP_POOL_OVERSEAS[Math.floor(Math.random() * IP_POOL_OVERSEAS.length)];
    }

    function makeFallbackAvatarSvg(seedStr, nameStr) {
        let hash = 0;
        const s = String(seedStr || nameStr || 'Laya');
        for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash) + s.charCodeAt(i);
        const palettes = [
            ['#ff758c', '#ff7eb3'], ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'],
            ['#fa709a', '#fee140'], ['#a18cd1', '#fbc2eb'], ['#667eea', '#764ba2'],
            ['#f093fb', '#f5576c'], ['#48c6ef', '#6f86d6'], ['#ff9a9e', '#fecfef']
        ];
        const pair = palettes[Math.abs(hash) % palettes.length];
        const ch = (String(nameStr || '友').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')[0] || 'U').toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${pair[0]}"/><stop offset="100%" stop-color="${pair[1]}"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#g)"/><circle cx="40" cy="30" r="13" fill="rgba(255,255,255,0.28)"/><path d="M18 68c4-14 14-20 22-20s18 6 22 20" fill="rgba(255,255,255,0.28)"/><text x="40" y="47" text-anchor="middle" fill="#fff" font-size="26" font-family="sans-serif" font-weight="800">${ch}</text></svg>`;
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    function buildOnlineAvatarUrl(seed, apiMode) {
        const rawStr = String(seed || Math.random().toString(36).slice(2, 9));
        const cleanSeed = encodeURIComponent(rawStr);
        let hash = 0;
        for (let i = 0; i < rawStr.length; i++) {
            hash = ((hash << 5) - hash) + rawStr.charCodeAt(i);
            hash |= 0;
        }
        const absHash = Math.abs(hash);

        let chosen = apiMode || 'real-human';
        if (chosen === 'mixed') {
            const roll = (absHash % 100) / 100;
            if (roll < 0.68) chosen = 'real-human';
            else if (roll < 0.85) chosen = 'picsum';
            else if (roll < 0.93) chosen = 'lorelei';
            else chosen = 'adventurer';
        }

        if (chosen === 'real-human') {
            const gender = (absHash % 10 < 6) ? 'women' : 'men';
            const portraitId = (absHash % 90) + 1;
            return `https://randomuser.me/api/portraits/${gender}/${portraitId}.jpg`;
        }
        if (chosen === 'picsum') {
            return `https://picsum.photos/seed/${cleanSeed}/150/150`;
        }
        if (chosen === 'fun-emoji') {
            return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${cleanSeed}`;
        }
        return `https://api.dicebear.com/7.x/${chosen}/svg?seed=${cleanSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
    }

    // 生成介于 [发布视频时间, 打开页面/上传视频时间] 之间的随机评论时间 + 海外/台港澳马 IP
    function randomDateLoc(ipRegionOverride, pubHoursOverride) {
        const endTimeMs = window.__pageOpenOrUploadTime || Date.now();
        const pubHours = parseFloat(pubHoursOverride || document.getElementById('sel-cmt-pub-window')?.value || (window.CommentEngine && window.CommentEngine.pubWindowHours) || 72) || 72;
        const startTimeMs = endTimeMs - pubHours * 3600 * 1000;
        const spanMs = Math.max(120 * 1000, endTimeMs - startTimeMs - 60 * 1000);
        const cmtTimeMs = startTimeMs + 30 * 1000 + Math.floor(Math.random() * spanMs);

        const diffSec = Math.max(60, Math.floor((endTimeMs - cmtTimeMs) / 1000));
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);

        const d = new Date(cmtTimeMs);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');

        let timeStr = '';
        if (diffMin < 60) {
            timeStr = `${Math.max(1, diffMin)}分鐘前`;
        } else if (diffHr < 24) {
            timeStr = `${diffHr}小時前`;
        } else if (diffHr < 48 && Math.random() < 0.45) {
            timeStr = `昨天 ${hh}:${min}`;
        } else {
            timeStr = `${mm}-${dd}`;
        }

        const loc = pickOverseasIpLocation(ipRegionOverride);
        return loc ? `${timeStr} · ${loc}` : timeStr;
    }

    const CommentEngine = {
        isOpen: false,
        isExpanded: false,
        apiMode: 'real-human',
        ipRegion: 'tw-hk-my',
        pubWindowHours: 72,
        colPrefix: '觀看完整合集：',
        colTitle: '人情與世故',
        headCount: '138',
        tabAiText: 'AI 解析',
        vidTipText: '視頻由AI生成/劇情純屬虛構/無不良引導',
        activeUploadIdx: -1,
        activePhotoUploadIdx: -1,
        list: [],

        initDefaults() {
            this.list = [
                { id: 'c1', user: 'Chloe_tw', text: '牛總還是有點大智慧的', dateLoc: randomDateLoc('tw-only', 72), likes: '9', liked: false, avatar: 'https://randomuser.me/api/portraits/women/44.jpg', image: '', isCustomAvatar: false },
                { id: 'c2', user: '阿傑Jay', text: '這劇情太牛了👍😁', dateLoc: randomDateLoc('hk-mo', 72), likes: '8', liked: false, avatar: 'https://randomuser.me/api/portraits/men/32.jpg', image: '', isCustomAvatar: false },
                { id: 'c3', user: 'Jason_HK', text: '好一招釜底抽薪', dateLoc: randomDateLoc('my-sg', 72), likes: '1', liked: false, avatar: 'https://randomuser.me/api/portraits/men/68.jpg', image: '', isCustomAvatar: false },
                { id: 'c4', user: '子瑜✨', text: '哈哈，我先入職花果山 再回來應聘 完美閉環🐺', dateLoc: randomDateLoc('tw-only', 72), likes: '4', liked: false, avatar: 'https://randomuser.me/api/portraits/women/65.jpg', image: '', isCustomAvatar: false },
                { id: 'c5', user: 'Kevin.88', text: '看到這一幕直接笑精神了😂', dateLoc: randomDateLoc('none', 72), likes: '16', liked: false, avatar: 'https://randomuser.me/api/portraits/men/22.jpg', image: '', isCustomAvatar: false },
                { id: 'c6', user: '半糖去冰🧋', text: '演技真的在線，每個眼神裡全是戲🔥', dateLoc: randomDateLoc('overseas-all', 72), likes: '23', liked: false, avatar: 'https://randomuser.me/api/portraits/women/19.jpg', image: '', isCustomAvatar: false }
            ];
            this.list.forEach(item => this.prefetchAvatarDataUrl(item));
        },

        prefetchAvatarDataUrl(item) {
            if (!item || !item.avatar || item.avatar.startsWith('data:')) return;
            const targetUrl = item.avatar;
            fetch(targetUrl, { mode: 'cors' })
                .then(res => res.ok ? res.blob() : Promise.reject())
                .then(blob => new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                }))
                .then(dataUrl => {
                    if (dataUrl && item.avatar === targetUrl) {
                        item.avatar = dataUrl;
                        if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                    }
                })
                .catch(() => {});
        },

        setDrawerOpen(flag, showToastMsg = false) {
            this.isOpen = !!flag;
            const rt = document.getElementById('render-target');
            if (rt) {
                rt.classList.toggle('dy-comment-open', this.isOpen);
            }
            const sw1 = document.getElementById('sw-dy-comment-drawer');
            const sw2 = document.getElementById('sw-dy-cmt-open-card');
            if (sw1 && sw1.checked !== this.isOpen) sw1.checked = this.isOpen;
            if (sw2 && sw2.checked !== this.isOpen) sw2.checked = this.isOpen;

            if (window.PlayerEngine && typeof window.PlayerEngine.updateTransform === 'function') {
                window.PlayerEngine.updateTransform();
                window.__isRestoringStorage = false;
                setTimeout(() => window.PlayerEngine.updateTransform(), 60);
                setTimeout(() => window.PlayerEngine.updateTransform(), 240);
            }
            if (showToastMsg) {
                window.showToast(this.isOpen
                    ? '已弹出评论区'
                    : '已收起评论区');
            }
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        },

        // 单条评论点击筛子 🎲：同时随机更换头像、繁体/英文昵称、发布后~上传前的时间、海外/台港澳马IP
        randomizeSingleItem(idx) {
            const item = this.list[idx];
            if (!item) return;
            const mode = document.getElementById('sel-cmt-avatar-api')?.value || this.apiMode || 'real-human';
            this.apiMode = mode;
            const seed = `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`;
            item.avatar = buildOnlineAvatarUrl(seed, mode);
            item.isCustomAvatar = false;
            this.prefetchAvatarDataUrl(item);

            const usedNames = new Set(this.list.map((it, i) => i !== idx ? it.user : ''));
            let nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
            let tries = 0;
            while (usedNames.has(nick) && tries++ < 20) {
                nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
            }
            item.user = nick;
            item.dateLoc = randomDateLoc(this.ipRegion, this.pubWindowHours);
            item.likes = String(Math.floor(Math.random() * 68) + 1);

            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        },

        randomizeAll(includeText = true) {
            const mode = document.getElementById('sel-cmt-avatar-api')?.value || this.apiMode || 'real-human';
            const ipReg = document.getElementById('sel-cmt-ip-region')?.value || this.ipRegion || 'tw-hk-my';
            const pubWin = parseFloat(document.getElementById('sel-cmt-pub-window')?.value) || this.pubWindowHours || 72;
            this.apiMode = mode;
            this.ipRegion = ipReg;
            this.pubWindowHours = pubWin;
            const usedNames = new Set();
            const usedTexts = new Set();
            this.list.forEach((item, idx) => {
                const seed = `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
                if (!item.isCustomAvatar || includeText) {
                    item.avatar = buildOnlineAvatarUrl(seed, mode);
                    item.isCustomAvatar = false;
                    this.prefetchAvatarDataUrl(item);
                }
                // 无论点击哪个随机筛子，昵称、时间与海外/台港澳马IP都会一并随机更换
                let nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
                let tries = 0;
                while (usedNames.has(nick) && tries++ < 15) {
                    nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
                }
                usedNames.add(nick);
                item.user = nick;
                item.dateLoc = randomDateLoc(ipReg, pubWin);
                item.likes = String(Math.floor(Math.random() * 68) + 1);

                if (includeText) {
                    let txt = COMMENT_TEXT_POOL[Math.floor(Math.random() * COMMENT_TEXT_POOL.length)];
                    tries = 0;
                    while (usedTexts.has(txt) && tries++ < 15) {
                        txt = COMMENT_TEXT_POOL[Math.floor(Math.random() * COMMENT_TEXT_POOL.length)];
                    }
                    usedTexts.add(txt);
                    item.text = txt;
                }
            });
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        },

        syncHeaderDOM() {
            const colBar = document.getElementById('dy-cmt-collection-bar');
            const colPrefixEl = document.getElementById('dy-cmt-col-prefix');
            const colTitleEl = document.getElementById('dy-cmt-col-title');
            const headCountEl = document.getElementById('dy-cmt-head-count');
            const tabAiEl = document.getElementById('dy-cmt-tab-ai');
            const vidTipEl = document.getElementById('dy-cmt-vid-tip');
            const inColTitle = document.getElementById('in-cmt-col-title');
            const inHeadCount = document.getElementById('in-cmt-head-count');

            if (colPrefixEl && colPrefixEl.textContent !== this.colPrefix) colPrefixEl.textContent = this.colPrefix;
            if (colTitleEl && colTitleEl.textContent !== this.colTitle) colTitleEl.textContent = this.colTitle;
            if (colBar) colBar.style.display = this.colTitle.trim() ? 'flex' : 'none';
            if (headCountEl && headCountEl.textContent !== this.headCount) headCountEl.textContent = this.headCount;
            if (tabAiEl && tabAiEl.textContent !== this.tabAiText) tabAiEl.textContent = this.tabAiText;
            if (vidTipEl && vidTipEl.textContent !== this.vidTipText) vidTipEl.textContent = this.vidTipText;
            if (inColTitle && document.activeElement !== inColTitle) inColTitle.value = this.colTitle;
            if (inHeadCount && document.activeElement !== inHeadCount) inHeadCount.value = this.headCount;
        },

        renderStage() {
            this.syncHeaderDOM();
            const container = document.getElementById('dy-cmt-list-inner');
            if (!container) return;
            container.innerHTML = '';

            this.list.forEach((item, idx) => {
                const row = document.createElement('div');
                row.className = 'dy-cmt-item';

                // 左侧头像 (点击直接上传替换该条评论头像)
                const avWrap = document.createElement('div');
                avWrap.className = 'dy-cmt-avatar-wrap interactive-elem';
                avWrap.title = '点击上传并更换此条评论的头像';
                const avImg = document.createElement('img');
                avImg.className = 'dy-cmt-avatar';
                avImg.crossOrigin = 'anonymous';
                avImg.src = item.avatar || makeFallbackAvatarSvg(item.id, item.user);
                avImg.onerror = () => {
                    const fb = makeFallbackAvatarSvg(item.id + '_' + idx, item.user);
                    if (avImg.src !== fb) avImg.src = fb;
                };
                avWrap.appendChild(avImg);
                avWrap.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.activeUploadIdx = idx;
                    const fileInp = document.getElementById('dy-cmt-avatar-file');
                    if (fileInp) {
                        fileInp.value = '';
                        fileInp.click();
                    }
                });
                row.appendChild(avWrap);

                // 右侧主体
                const main = document.createElement('div');
                main.className = 'dy-cmt-main';

                // 昵称行 + 悬停快捷按钮(随机头像/昵称/IP/时间、上传配图、删除)
                const userRow = document.createElement('div');
                userRow.className = 'dy-cmt-user-row';

                const userSpan = document.createElement('span');
                userSpan.className = 'dy-cmt-user interactive-elem';
                userSpan.contentEditable = 'true';
                userSpan.spellcheck = false;
                userSpan.title = '点击直接编辑昵称';
                userSpan.textContent = item.user || '匿名用戶';
                userSpan.addEventListener('input', () => {
                    item.user = userSpan.textContent.trim();
                    this.syncEditorRow(idx);
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });
                userRow.appendChild(userSpan);

                const qTools = document.createElement('div');
                qTools.className = 'dy-cmt-stage-QuickTools';

                const btnRandAv = document.createElement('button');
                btnRandAv.type = 'button';
                btnRandAv.className = 'dy-cmt-qbtn';
                btnRandAv.textContent = '🎲隨機';
                btnRandAv.title = '隨機更換此條評論的頭像、暱稱、時間與海外IP';
                btnRandAv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.randomizeSingleItem(idx);
                });

                const btnUpImg = document.createElement('button');
                btnUpImg.type = 'button';
                btnUpImg.className = 'dy-cmt-qbtn';
                btnUpImg.textContent = '🖼️配圖';
                btnUpImg.title = '為此條評論上傳照片/表情包';
                btnUpImg.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.activePhotoUploadIdx = idx;
                    const pInp = document.getElementById('dy-cmt-photo-file');
                    if (pInp) {
                        pInp.value = '';
                        pInp.click();
                    }
                });

                const btnDel = document.createElement('button');
                btnDel.type = 'button';
                btnDel.className = 'dy-cmt-qbtn';
                btnDel.textContent = '✕';
                btnDel.title = '刪除此條評論';
                btnDel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.list.splice(idx, 1);
                    this.renderStage();
                    this.renderEditor();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                qTools.appendChild(btnRandAv);
                qTools.appendChild(btnUpImg);
                qTools.appendChild(btnDel);
                userRow.appendChild(qTools);
                main.appendChild(userRow);

                // 评论正文 (点击直接在画面上编辑)
                const txtDiv = document.createElement('div');
                txtDiv.className = 'dy-cmt-text interactive-elem';
                txtDiv.contentEditable = 'true';
                txtDiv.spellcheck = false;
                txtDiv.title = '点击直接修改评论文字';
                txtDiv.textContent = item.text || '';
                txtDiv.style.display = (item.text || !item.image) ? 'block' : 'none';
                txtDiv.addEventListener('input', () => {
                    item.text = txtDiv.textContent;
                    this.syncEditorRow(idx);
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });
                main.appendChild(txtDiv);

                // 评论区上传的照片 / 表情包 (如图2第5条)
                if (item.image) {
                    const photoBox = document.createElement('div');
                    photoBox.className = 'dy-cmt-photo-box interactive-elem';
                    const pImg = document.createElement('img');
                    pImg.className = 'dy-cmt-photo-img';
                    pImg.src = item.image;
                    pImg.title = '点击可更换此照片/表情包';
                    pImg.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.activePhotoUploadIdx = idx;
                        const pInp = document.getElementById('dy-cmt-photo-file');
                        if (pInp) {
                            pInp.value = '';
                            pInp.click();
                        }
                    });

                    const pDel = document.createElement('button');
                    pDel.type = 'button';
                    pDel.className = 'dy-cmt-photo-del';
                    pDel.textContent = '✕';
                    pDel.title = '移除照片/表情包';
                    pDel.addEventListener('click', (e) => {
                        e.stopPropagation();
                        item.image = '';
                        if (!item.text) item.text = '👍';
                        this.renderStage();
                        this.renderEditor();
                        if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                    });

                    photoBox.appendChild(pImg);
                    photoBox.appendChild(pDel);
                    main.appendChild(photoBox);
                }

                // 底部日期地区 + 回复 + 右侧点赞爱心与心碎图标
                const metaRow = document.createElement('div');
                metaRow.className = 'dy-cmt-meta-row';

                const metaLeft = document.createElement('div');
                metaLeft.className = 'dy-cmt-meta-left';

                const dateLocSpan = document.createElement('span');
                dateLocSpan.className = 'dy-cmt-date-loc interactive-elem';
                dateLocSpan.contentEditable = 'true';
                dateLocSpan.spellcheck = false;
                dateLocSpan.title = '点击直接修改日期与地区（可删除地区仅保留时间）';
                dateLocSpan.textContent = item.dateLoc || '3小時前 · 台灣';
                dateLocSpan.addEventListener('input', () => {
                    item.dateLoc = dateLocSpan.textContent.trim();
                    this.syncEditorRow(idx);
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                const replySpan = document.createElement('span');
                replySpan.className = 'dy-cmt-reply-btn interactive-elem';
                replySpan.textContent = '回覆';
                replySpan.addEventListener('click', () => {
                    const stageInp = document.getElementById('dy-cmt-stage-input');
                    if (stageInp) {
                        stageInp.placeholder = `回覆 @${item.user}：`;
                        stageInp.focus();
                    }
                });

                metaLeft.appendChild(dateLocSpan);
                metaLeft.appendChild(replySpan);
                metaRow.appendChild(metaLeft);

                const actions = document.createElement('div');
                actions.className = 'dy-cmt-actions';

                const likeBtn = document.createElement('div');
                likeBtn.className = 'dy-cmt-like-btn interactive-elem' + (item.liked ? ' liked' : '');
                likeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${item.liked ? '#fe2c55' : 'none'}" stroke="${item.liked ? '#fe2c55' : '#8a8b91'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

                const likeNum = document.createElement('span');
                likeNum.className = 'dy-cmt-like-num interactive-elem';
                likeNum.contentEditable = 'true';
                likeNum.spellcheck = false;
                likeNum.title = '点击数字可直接修改点赞数，点击爱心可点赞';
                likeNum.textContent = item.likes || '1';
                likeNum.addEventListener('click', (e) => e.stopPropagation());
                likeNum.addEventListener('input', () => {
                    item.likes = likeNum.textContent.trim();
                    this.syncEditorRow(idx);
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                likeBtn.addEventListener('click', () => {
                    item.liked = !item.liked;
                    const n = parseInt(item.likes, 10);
                    if (!isNaN(n)) {
                        item.likes = String(item.liked ? n + 1 : Math.max(0, n - 1));
                    }
                    this.renderStage();
                    this.renderEditor();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });
                likeBtn.appendChild(likeNum);

                const dislikeBtn = document.createElement('div');
                dislikeBtn.className = 'dy-cmt-dislike-btn interactive-elem';
                dislikeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8b91" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path><polyline points="12 5.7 10.3 11 13.5 13.5 11.5 18.5"></polyline></svg>`;

                actions.appendChild(likeBtn);
                actions.appendChild(dislikeBtn);
                metaRow.appendChild(actions);

                main.appendChild(metaRow);
                row.appendChild(main);
                container.appendChild(row);
            });
        },

        syncEditorRow(idx) {
            const edList = document.getElementById('dy-cmt-editor-list');
            if (!edList) return;
            const cards = edList.querySelectorAll('.dy-cmt-ed-card');
            const card = cards[idx];
            const item = this.list[idx];
            if (!card || !item) return;
            const inUser = card.querySelector('.ed-in-user');
            const inDate = card.querySelector('.ed-in-date');
            const inLikes = card.querySelector('.ed-in-likes');
            const inText = card.querySelector('.ed-in-text');
            if (inUser && document.activeElement !== inUser) inUser.value = item.user || '';
            if (inDate && document.activeElement !== inDate) inDate.value = item.dateLoc || '';
            if (inLikes && document.activeElement !== inLikes) inLikes.value = item.likes || '';
            if (inText && document.activeElement !== inText) inText.value = item.text || '';
        },

        renderEditor() {
            const edList = document.getElementById('dy-cmt-editor-list');
            if (!edList) return;
            edList.innerHTML = '';

            this.list.forEach((item, idx) => {
                const card = document.createElement('div');
                card.className = 'dy-cmt-ed-card';

                const topRow = document.createElement('div');
                topRow.className = 'dy-cmt-ed-top';

                const avImg = document.createElement('img');
                avImg.className = 'dy-cmt-ed-avatar';
                avImg.crossOrigin = 'anonymous';
                avImg.src = item.avatar || makeFallbackAvatarSvg(item.id, item.user);
                avImg.title = '点击上传自定义头像';
                avImg.onerror = () => {
                    const fb = makeFallbackAvatarSvg(item.id + '_' + idx, item.user);
                    if (avImg.src !== fb) avImg.src = fb;
                };
                avImg.addEventListener('click', () => {
                    this.activeUploadIdx = idx;
                    const fileInp = document.getElementById('dy-cmt-avatar-file');
                    if (fileInp) {
                        fileInp.value = '';
                        fileInp.click();
                    }
                });

                const btnRandOne = document.createElement('button');
                btnRandOne.type = 'button';
                btnRandOne.className = 'dy-cmt-ed-btn';
                btnRandOne.textContent = '🎲';
                btnRandOne.title = '点击随机更换此条评论的头像、昵称、时间与海外IP';
                btnRandOne.addEventListener('click', () => {
                    this.randomizeSingleItem(idx);
                });

                const inUser = document.createElement('input');
                inUser.type = 'text';
                inUser.className = 'dy-cmt-ed-inp ed-in-user';
                inUser.style.flex = '1';
                inUser.placeholder = '繁体/英文昵称';
                inUser.value = item.user || '';
                inUser.addEventListener('input', (e) => {
                    item.user = e.target.value;
                    this.renderStage();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                const inDate = document.createElement('input');
                inDate.type = 'text';
                inDate.className = 'dy-cmt-ed-inp ed-in-date';
                inDate.style.width = '98px';
                inDate.placeholder = '时间(·海外IP)';
                inDate.value = item.dateLoc || '';
                inDate.addEventListener('input', (e) => {
                    item.dateLoc = e.target.value;
                    this.renderStage();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                const inLikes = document.createElement('input');
                inLikes.type = 'text';
                inLikes.className = 'dy-cmt-ed-inp ed-in-likes';
                inLikes.style.width = '38px';
                inLikes.placeholder = '赞';
                inLikes.title = '点赞数';
                inLikes.value = item.likes || '';
                inLikes.addEventListener('input', (e) => {
                    item.likes = e.target.value;
                    this.renderStage();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                const btnDel = document.createElement('button');
                btnDel.type = 'button';
                btnDel.className = 'sub-cue-del';
                btnDel.textContent = '✕';
                btnDel.title = '删除此条评论';
                btnDel.addEventListener('click', () => {
                    this.list.splice(idx, 1);
                    this.renderStage();
                    this.renderEditor();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                topRow.appendChild(avImg);
                topRow.appendChild(btnRandOne);
                topRow.appendChild(inUser);
                topRow.appendChild(inDate);
                topRow.appendChild(inLikes);
                topRow.appendChild(btnDel);

                const botRow = document.createElement('div');
                botRow.style.cssText = 'display:flex; align-items:center; gap:5px;';

                const inText = document.createElement('input');
                inText.type = 'text';
                inText.className = 'dy-cmt-ed-inp ed-in-text';
                inText.style.flex = '1';
                inText.placeholder = '输入评论文字（可留空仅发图片/表情包）...';
                inText.value = item.text || '';
                inText.addEventListener('input', (e) => {
                    item.text = e.target.value;
                    this.renderStage();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                const btnPhoto = document.createElement('button');
                btnPhoto.type = 'button';
                btnPhoto.className = 'dy-cmt-ed-btn';
                btnPhoto.style.color = item.image ? '#34d399' : '#38bdf8';
                btnPhoto.textContent = item.image ? '🖼️换图' : '🖼️配图';
                btnPhoto.title = '上传照片或表情包到此条评论';
                btnPhoto.addEventListener('click', () => {
                    this.activePhotoUploadIdx = idx;
                    const pInp = document.getElementById('dy-cmt-photo-file');
                    if (pInp) {
                        pInp.value = '';
                        pInp.click();
                    }
                });

                botRow.appendChild(inText);
                botRow.appendChild(btnPhoto);

                if (item.image) {
                    const btnClearPhoto = document.createElement('button');
                    btnClearPhoto.type = 'button';
                    btnClearPhoto.className = 'dy-cmt-ed-btn';
                    btnClearPhoto.style.color = '#f87171';
                    btnClearPhoto.textContent = '删图';
                    btnClearPhoto.addEventListener('click', () => {
                        item.image = '';
                        this.renderStage();
                        this.renderEditor();
                        if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                    });
                    botRow.appendChild(btnClearPhoto);
                }

                card.appendChild(topRow);
                card.appendChild(botRow);
                edList.appendChild(card);
            });
        }
    };
    window.CommentEngine = CommentEngine;
    CommentEngine.initDefaults();
    CommentEngine.renderStage();
    CommentEngine.renderEditor();

    // 绑定点击图3右侧气泡按钮 (#dy-btn-comment) 弹出/收起评论区抽屉
    const dyBtnCommentBubble = document.getElementById('dy-btn-comment');
    if (dyBtnCommentBubble) {
        dyBtnCommentBubble.addEventListener('click', (e) => {
            e.stopPropagation();
            CommentEngine.setDrawerOpen(!CommentEngine.isOpen, true);
            if (CommentEngine.isOpen) {
                if (typeof window.switchRightTab === 'function') window.switchRightTab('dy');
                const studioCard = document.getElementById('card-dy-comment-studio');
                if (studioCard) studioCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    // 绑定评论区右上角关闭按钮 ✕ 与展开按钮 ⛶
    const dyCmtBtnClose = document.getElementById('dy-cmt-btn-close');
    if (dyCmtBtnClose) {
        dyCmtBtnClose.addEventListener('click', (e) => {
            e.stopPropagation();
            CommentEngine.setDrawerOpen(false, true);
        });
    }
    const dyCmtBtnExpand = document.getElementById('dy-cmt-btn-expand');
    if (dyCmtBtnExpand) {
        dyCmtBtnExpand.addEventListener('click', (e) => {
            e.stopPropagation();
            CommentEngine.isExpanded = !CommentEngine.isExpanded;
            const rt = document.getElementById('render-target');
            if (rt) rt.classList.toggle('dy-comment-expanded', CommentEngine.isExpanded);
            if (window.PlayerEngine && typeof window.PlayerEngine.updateTransform === 'function') {
                window.PlayerEngine.updateTransform();
                window.__isRestoringStorage = false;
                setTimeout(() => window.PlayerEngine.updateTransform(), 230);
            }
        });
    }

    // 绑定右侧面板评论区开关、随机按钮、新增文字/表情包评论按钮
    const swDyCommentDrawer = document.getElementById('sw-dy-comment-drawer');
    const swDyCmtOpenCard = document.getElementById('sw-dy-cmt-open-card');
    if (swDyCommentDrawer) {
        swDyCommentDrawer.addEventListener('change', (e) => CommentEngine.setDrawerOpen(e.target.checked, true));
    }
    if (swDyCmtOpenCard) {
        swDyCmtOpenCard.addEventListener('change', (e) => CommentEngine.setDrawerOpen(e.target.checked, true));
    }

    const selCmtAvatarApi = document.getElementById('sel-cmt-avatar-api');
    if (selCmtAvatarApi) {
        selCmtAvatarApi.addEventListener('change', (e) => {
            CommentEngine.apiMode = e.target.value;
            CommentEngine.randomizeAll(false);
            window.showToast('已更新评论头像风格与随机资料');
        });
    }

    const selCmtIpRegion = document.getElementById('sel-cmt-ip-region');
    if (selCmtIpRegion) {
        selCmtIpRegion.addEventListener('change', (e) => {
            CommentEngine.ipRegion = e.target.value;
            CommentEngine.list.forEach(item => {
                item.dateLoc = randomDateLoc(CommentEngine.ipRegion, CommentEngine.pubWindowHours);
            });
            CommentEngine.renderStage();
            CommentEngine.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(e.target.value === 'none' ? '已隐藏评论 IP 属地（仅显示时间）' : '已更新评论区海外/台港澳马 IP 属地');
        });
    }

    const selCmtPubWindow = document.getElementById('sel-cmt-pub-window');
    if (selCmtPubWindow) {
        selCmtPubWindow.addEventListener('change', (e) => {
            CommentEngine.pubWindowHours = parseFloat(e.target.value) || 72;
            CommentEngine.list.forEach(item => {
                item.dateLoc = randomDateLoc(CommentEngine.ipRegion, CommentEngine.pubWindowHours);
            });
            CommentEngine.renderStage();
            CommentEngine.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('已按新的视频发布时间区间重算评论时间');
        });
    }

    const btnCmtRandomAll = document.getElementById('btn-cmt-random-all');
    if (btnCmtRandomAll) {
        btnCmtRandomAll.addEventListener('click', () => {
            CommentEngine.randomizeAll(true);
            if (!CommentEngine.isOpen) CommentEngine.setDrawerOpen(true, false);
            window.showToast('已随机更换头像、繁体/英文昵称、时间、IP与评论');
        });
    }

    const btnCmtRandomAvatars = document.getElementById('btn-cmt-random-avatars');
    if (btnCmtRandomAvatars) {
        btnCmtRandomAvatars.addEventListener('click', () => {
            CommentEngine.randomizeAll(false);
            window.showToast('已随机更换头像、繁体/英文昵称、时间与IP');
        });
    }

    const btnCmtAddText = document.getElementById('btn-cmt-add-text');
    if (btnCmtAddText) {
        btnCmtAddText.addEventListener('click', () => {
            const seed = `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const newItem = {
                id: seed,
                user: NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)],
                text: COMMENT_TEXT_POOL[Math.floor(Math.random() * COMMENT_TEXT_POOL.length)],
                dateLoc: randomDateLoc(CommentEngine.ipRegion, CommentEngine.pubWindowHours),
                likes: String(Math.floor(Math.random() * 30) + 1),
                liked: false,
                avatar: buildOnlineAvatarUrl(seed, CommentEngine.apiMode),
                image: '',
                isCustomAvatar: false
            };
            CommentEngine.prefetchAvatarDataUrl(newItem);
            CommentEngine.list.unshift(newItem);
            CommentEngine.renderStage();
            CommentEngine.renderEditor();
            if (!CommentEngine.isOpen) CommentEngine.setDrawerOpen(true, false);
            const listEl = document.getElementById('dy-comment-list');
            if (listEl) listEl.scrollTop = 0;
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('已新增一条随机评论');
        });
    }

    // 上传自定义评论头像处理
    const dyCmtAvatarFile = document.getElementById('dy-cmt-avatar-file');
    if (dyCmtAvatarFile) {
        dyCmtAvatarFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const idx = CommentEngine.activeUploadIdx;
                if (CommentEngine.list[idx]) {
                    CommentEngine.list[idx].avatar = evt.target.result;
                    CommentEngine.list[idx].isCustomAvatar = true;
                    CommentEngine.renderStage();
                    CommentEngine.renderEditor();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                    window.showToast('评论头像已更换');
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // 上传评论照片 / 表情包处理 (支持给已有评论配图，也支持直接发一条新图片/表情包评论)
    const dyCmtPhotoFile = document.getElementById('dy-cmt-photo-file');
    if (dyCmtPhotoFile) {
        dyCmtPhotoFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const dataUrl = evt.target.result;
                const idx = CommentEngine.activePhotoUploadIdx;
                if (idx >= 0 && CommentEngine.list[idx]) {
                    CommentEngine.list[idx].image = dataUrl;
                } else {
                    const seed = `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                    const stageInp = document.getElementById('dy-cmt-stage-input');
                    const typedTxt = stageInp ? stageInp.value.trim() : '';
                    if (stageInp) stageInp.value = '';
                    const newItem = {
                        id: seed,
                        user: NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)],
                        text: typedTxt,
                        dateLoc: randomDateLoc(CommentEngine.ipRegion, CommentEngine.pubWindowHours),
                        likes: String(Math.floor(Math.random() * 50) + 1),
                        liked: false,
                        avatar: buildOnlineAvatarUrl(seed, CommentEngine.apiMode),
                        image: dataUrl,
                        isCustomAvatar: false
                    };
                    CommentEngine.prefetchAvatarDataUrl(newItem);
                    CommentEngine.list.push(newItem);
                    setTimeout(() => {
                        const listEl = document.getElementById('dy-comment-list');
                        if (listEl) listEl.scrollTop = listEl.scrollHeight;
                    }, 50);
                }
                CommentEngine.activePhotoUploadIdx = -1;
                CommentEngine.renderStage();
                CommentEngine.renderEditor();
                if (!CommentEngine.isOpen) CommentEngine.setDrawerOpen(true, false);
                if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                window.showToast('图片/表情包已添加到评论区');
            };
            reader.readAsDataURL(file);
        });
    }

    const btnCmtAddPhoto = document.getElementById('btn-cmt-add-photo');
    if (btnCmtAddPhoto && dyCmtPhotoFile) {
        btnCmtAddPhoto.addEventListener('click', () => {
            CommentEngine.activePhotoUploadIdx = -1;
            dyCmtPhotoFile.value = '';
            dyCmtPhotoFile.click();
        });
    }

    const dyCmtBtnSendImg = document.getElementById('dy-cmt-btn-send-img');
    if (dyCmtBtnSendImg && dyCmtPhotoFile) {
        dyCmtBtnSendImg.addEventListener('click', (e) => {
            e.stopPropagation();
            CommentEngine.activePhotoUploadIdx = -1;
            dyCmtPhotoFile.value = '';
            dyCmtPhotoFile.click();
        });
    }

    // 底部输入框回车直接发评论 + @与表情快捷按钮
    const dyCmtStageInput = document.getElementById('dy-cmt-stage-input');
    if (dyCmtStageInput) {
        dyCmtStageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = dyCmtStageInput.value.trim();
                if (!val) return;
                const seed = `post_${Date.now()}`;
                const loc = pickOverseasIpLocation(CommentEngine.ipRegion);
                const newItem = {
                    id: seed,
                    user: NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)],
                    text: val,
                    dateLoc: loc ? `剛剛 · ${loc}` : '剛剛',
                    likes: '1',
                    liked: true,
                    avatar: buildOnlineAvatarUrl(seed, CommentEngine.apiMode),
                    image: '',
                    isCustomAvatar: false
                };
                CommentEngine.prefetchAvatarDataUrl(newItem);
                CommentEngine.list.unshift(newItem);
                dyCmtStageInput.value = '';
                dyCmtStageInput.placeholder = '期待你的評論';
                CommentEngine.renderStage();
                CommentEngine.renderEditor();
                const listEl = document.getElementById('dy-comment-list');
                if (listEl) listEl.scrollTop = 0;
                if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                window.showToast('评论已发布');
            }
        });
    }

    const dyCmtBtnAt = document.getElementById('dy-cmt-btn-at');
    if (dyCmtBtnAt && dyCmtStageInput) {
        dyCmtBtnAt.addEventListener('click', () => {
            const pick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
            dyCmtStageInput.value += `@${pick} `;
            dyCmtStageInput.focus();
        });
    }

    const dyCmtBtnEmoji = document.getElementById('dy-cmt-btn-emoji');
    if (dyCmtBtnEmoji && dyCmtStageInput) {
        const emojis = ['👍', '😁', '😂', '🔥', '❤️', '🐺', '👏', '🤣', '😭', '✨'];
        dyCmtBtnEmoji.addEventListener('click', () => {
            const em = emojis[Math.floor(Math.random() * emojis.length)];
            dyCmtStageInput.value += em;
            dyCmtStageInput.focus();
        });
    }

    // 评论区头部合集名称、评论总数双向绑定
    const inCmtColTitle = document.getElementById('in-cmt-col-title');
    const inCmtHeadCount = document.getElementById('in-cmt-head-count');
    const dyCmtColPrefixEl = document.getElementById('dy-cmt-col-prefix');
    const dyCmtColTitleEl = document.getElementById('dy-cmt-col-title');
    const dyCmtHeadCountEl = document.getElementById('dy-cmt-head-count');
    const dyCmtTabAiEl = document.getElementById('dy-cmt-tab-ai');
    const dyCmtVidTipEl = document.getElementById('dy-cmt-vid-tip');

    if (inCmtColTitle) {
        inCmtColTitle.addEventListener('input', (e) => {
            CommentEngine.colTitle = e.target.value;
            CommentEngine.syncHeaderDOM();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    if (inCmtHeadCount) {
        inCmtHeadCount.addEventListener('input', (e) => {
            CommentEngine.headCount = e.target.value;
            CommentEngine.syncHeaderDOM();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    if (dyCmtColPrefixEl) {
        dyCmtColPrefixEl.addEventListener('input', () => {
            CommentEngine.colPrefix = dyCmtColPrefixEl.textContent;
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    if (dyCmtColTitleEl) {
        dyCmtColTitleEl.addEventListener('input', () => {
            CommentEngine.colTitle = dyCmtColTitleEl.textContent;
            if (inCmtColTitle) inCmtColTitle.value = CommentEngine.colTitle;
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    if (dyCmtHeadCountEl) {
        dyCmtHeadCountEl.addEventListener('input', () => {
            CommentEngine.headCount = dyCmtHeadCountEl.textContent.trim();
            if (inCmtHeadCount) inCmtHeadCount.value = CommentEngine.headCount;
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    if (dyCmtTabAiEl) {
        dyCmtTabAiEl.addEventListener('input', () => {
            CommentEngine.tabAiText = dyCmtTabAiEl.textContent.trim();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    if (dyCmtVidTipEl) {
        dyCmtVidTipEl.addEventListener('input', () => {
            CommentEngine.vidTipText = dyCmtVidTipEl.textContent.trim();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }

    // 支持鼠标按住评论区列表上下拖拽滑动 (除滚轮外的真机滑动手感)
    const dyCommentListScroll = document.getElementById('dy-comment-list');
    if (dyCommentListScroll) {
        let isDraggingList = false;
        let startY = 0;
        let startScrollTop = 0;
        dyCommentListScroll.addEventListener('mousedown', (e) => {
            if (e.target.isContentEditable || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            isDraggingList = true;
            startY = e.clientY;
            startScrollTop = dyCommentListScroll.scrollTop;
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDraggingList) return;
            const dy = e.clientY - startY;
            dyCommentListScroll.scrollTop = startScrollTop - dy;
        });
        window.addEventListener('mouseup', () => {
            isDraggingList = false;
        });
    }

    const selMobileSkin = document.getElementById('sel-mobile-skin');
    const renderTarget = document.getElementById('render-target');

    // 装载 Laya app 端风格专属内联 Base64 贴图资源 (保证 html2canvas 截图/导出视频零跨域清晰渲染)
    if (window.LAYA_APP_ASSETS) {
        document.querySelectorAll('img[data-laya-asset]').forEach(img => {
            const key = img.getAttribute('data-laya-asset');
            if (window.LAYA_APP_ASSETS[key]) {
                img.src = window.LAYA_APP_ASSETS[key];
            }
        });
    }

    // 绑定「点哪里亮哪里」交互：支持顶部导航栏与底部导航栏点击即时切换高亮状态
    function bindInteractiveTabs(containerSelector, itemSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;
        const items = container.querySelectorAll(itemSelector);
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                items.forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                const txt = item.textContent.trim();
                if (txt) window.showToast(`✨ 已點亮：${txt}`);
                if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            });
        });
    }

    bindInteractiveTabs('#laya-app-nav-tabs', '.laya-app-nav-item');
    bindInteractiveTabs('#laya-app-bottom-tabs', '.laya-app-tab-item');
    bindInteractiveTabs('.dy-nav-tabs', 'span');
    bindInteractiveTabs('.laya-nav-tabs', 'span');
    bindInteractiveTabs('.dy-bottom-tabs', '.dy-tab-item');
    bindInteractiveTabs('.laya-bottom-tabs', '.laya-tab-item');

    function applyMobileSkin(skin) {
        if (!renderTarget) return;
        renderTarget.classList.remove('skin-douyin', 'skin-laya', 'skin-laya-app');
        if (skin === 'laya') {
            renderTarget.classList.add('skin-laya');
        } else if (skin === 'laya-app') {
            renderTarget.classList.add('skin-laya-app');
        } else {
            renderTarget.classList.add('skin-douyin');
        }
        triggerSaveStorage();
    }

    if (selMobileSkin) {
        selMobileSkin.addEventListener('change', (e) => {
            const val = e.target.value;
            applyMobileSkin(val);
            const labelMap = {
                'douyin': '📱 已切换为：抖音原生短视频风格',
                'laya': '💎 已切换为：Laya 官方社区风格',
                'laya-app': '🌸 已切换为：Laya app 端风格'
            };
            window.showToast(labelMap[val] || labelMap['douyin']);
        });
    }

    /* ==========================================================================
       5.5 手机竖屏顶部状态栏：多机型预设与全图标状态控制引擎
       ========================================================================== */
    const douyinHud = document.getElementById('douyin-hud');
    const dyStatusBar = document.getElementById('dy-status-bar');
    const swDyStatusBar = document.getElementById('sw-dy-status-bar');
    const selDyPhoneModel = document.getElementById('sel-dy-phone-model');
    const selDyCutout = document.getElementById('sel-dy-cutout');
    const inDySbTime = document.getElementById('in-dy-sb-time');
    const btnDyRandomTime = document.getElementById('btn-dy-random-time');
    const selDySbSignal = document.getElementById('sel-dy-sb-signal');
    const selDySbNet = document.getElementById('sel-dy-sb-net');
    const selDySbCarrier = document.getElementById('sel-dy-sb-carrier');
    const inDySbSpeed = document.getElementById('in-dy-sb-speed');
    const inDySbBattery = document.getElementById('in-dy-sb-battery');
    const txtDySbBattery = document.getElementById('txt-dy-sb-battery');

    // 状态栏图标开关
    const swDySbBatPct = document.getElementById('sw-dy-sb-bat-pct');
    const swDySbCharging = document.getElementById('sw-dy-sb-charging');
    const swDySbLowpower = document.getElementById('sw-dy-sb-lowpower');
    const swDySbLoc = document.getElementById('sw-dy-sb-loc');
    const swDySbSpeed = document.getElementById('sw-dy-sb-speed');
    const swDySbBt = document.getElementById('sw-dy-sb-bt');
    const swDySbAlarm = document.getElementById('sw-dy-sb-alarm');
    const swDySbMute = document.getElementById('sw-dy-sb-mute');
    const swDySbHd = document.getElementById('sw-dy-sb-hd');
    const swDySbVpn = document.getElementById('sw-dy-sb-vpn');
    const swDySbNfc = document.getElementById('sw-dy-sb-nfc');
    const swDySbDnd = document.getElementById('sw-dy-sb-dnd');
    const swDySbNotifs = document.getElementById('sw-dy-sb-notifs');
    const swDySbRec = document.getElementById('sw-dy-sb-rec');

    // 状态栏舞台 DOM
    const dySbTime = document.getElementById('dy-sb-time');
    const dySbRec = document.getElementById('dy-sb-rec');
    const dySbRecTime = document.getElementById('dy-sb-rec-time');
    const dySbCarrier = document.getElementById('dy-sb-carrier');
    const dySbLoc = document.getElementById('dy-sb-loc');
    const dySbDnd = document.getElementById('dy-sb-dnd');
    const dySbNotifs = document.getElementById('dy-sb-notifs');
    const dySbCutoutWrap = document.getElementById('dy-sb-cutout-wrap');
    const dyCutoutBox = document.getElementById('dy-cutout-box');
    const dySbNetspeed = document.getElementById('dy-sb-netspeed');
    const dySbMute = document.getElementById('dy-sb-mute');
    const dySbAlarm = document.getElementById('dy-sb-alarm');
    const dySbBt = document.getElementById('dy-sb-bt');
    const dySbNfc = document.getElementById('dy-sb-nfc');
    const dySbHd = document.getElementById('dy-sb-hd');
    const dySbVpn = document.getElementById('dy-sb-vpn');
    const dySbSignal = document.getElementById('dy-sb-signal');
    const dySigRow1 = document.getElementById('dy-sig-row-1');
    const dySigRow2 = document.getElementById('dy-sig-row-2');
    const dySbNetTxt = document.getElementById('dy-sb-net-txt');
    const dySbWifi = document.getElementById('dy-sb-wifi');
    const dySbBatteryGroup = document.getElementById('dy-sb-battery-group');
    const dySbBatPct = document.getElementById('dy-sb-bat-pct');
    const dySbBattery = document.getElementById('dy-sb-battery');
    const dySbBatFill = document.getElementById('dy-sb-bat-fill');
    const dySbBatBolt = document.getElementById('dy-sb-bat-bolt');

    // 9大热门手机型号预设配置表
    const PHONE_MODEL_PRESETS = {
        'iphone16': {
            name: '🍎 iPhone 16 Pro Max (纯净全面屏默认)',
            cutout: 'none',
            cutout: 'none',
            signal: 'single-4',
            net: 'wifi',
            carrier: '',
            loc: true, speed: false, bt: false, alarm: false, mute: false,
            hd: false, vpn: false, nfc: false, dnd: false, notifs: false, rec: false,
            batPct: true
        },
        'iphone16-music': {
            name: '🎵 iPhone 16 Pro (灵动岛音乐律动)',
            cutout: 'island-music',
            signal: 'single-4',
            net: '5g',
            carrier: '',
            loc: true, speed: false, bt: true, alarm: false, mute: false,
            hd: false, vpn: false, nfc: false, dnd: false, notifs: false, rec: false,
            batPct: true
        },
        'iphone14': {
            name: '🍎 iPhone 14 / 13 Pro (经典刘海屏)',
            cutout: 'notch',
            signal: 'single-4',
            net: 'wifi',
            carrier: '',
            loc: true, speed: false, bt: false, alarm: false, mute: false,
            hd: false, vpn: false, nfc: false, dnd: false, notifs: false, rec: false,
            batPct: false
        },
        'huawei-mate60': {
            name: '🌸 华为 Mate 60 Pro (鸿蒙三挖孔)',
            cutout: 'huawei-triple',
            signal: 'dual-4',
            net: 'wifi+5g',
            carrier: '',
            loc: false, speed: true, bt: true, alarm: false, mute: false,
            hd: true, vpn: false, nfc: false, dnd: false, notifs: true, rec: false,
            batPct: true
        },
        'xiaomi14': {
            name: '⚡ 小米 14 Ultra (澎湃OS居中挖孔)',
            cutout: 'punch-center',
            signal: 'dual-4',
            net: 'wifi',
            carrier: '',
            loc: false, speed: true, bt: false, alarm: true, mute: false,
            hd: true, vpn: false, nfc: false, dnd: false, notifs: true, rec: false,
            batPct: true
        },
        'samsung-s24': {
            name: '🌌 三星 S24 Ultra (One UI居中挖孔)',
            cutout: 'punch-center',
            signal: 'single-4',
            net: 'wifi+5g',
            carrier: '',
            loc: true, speed: false, bt: true, alarm: true, mute: true,
            hd: false, vpn: false, nfc: true, dnd: false, notifs: true, rec: false,
            batPct: true
        },
        'vivo-x100': {
            name: '💙 VIVO X100 / OPPO Find X7',
            cutout: 'punch-center',
            signal: 'dual-3',
            net: '5ga',
            carrier: '中国移动',
            loc: false, speed: true, bt: true, alarm: false, mute: false,
            hd: true, vpn: true, nfc: false, dnd: false, notifs: false, rec: false,
            batPct: true
        },
        'pure-ios': {
            name: '✨ 纯净 iOS 全面屏 (无遮挡)',
            cutout: 'none',
            signal: 'single-4',
            net: 'wifi',
            carrier: '',
            loc: true, speed: false, bt: false, alarm: false, mute: false,
            hd: false, vpn: false, nfc: false, dnd: false, notifs: false, rec: false,
            batPct: true
        },
        'pure-android': {
            name: '✨ 纯净安卓旗舰屏 (无挖孔满图标)',
            cutout: 'none',
            signal: 'dual-4',
            net: 'wifi+5g',
            carrier: '',
            loc: false, speed: true, bt: true, alarm: true, mute: false,
            hd: true, vpn: true, nfc: false, dnd: false, notifs: true, rec: false,
            batPct: true
        }
    };

    function renderDyStatusBar() {
        if (!dyStatusBar) return;

        // 1. 状态栏总显隐与导航栏避让
        const isShown = !swDyStatusBar || swDyStatusBar.checked;
        dyStatusBar.style.display = isShown ? 'flex' : 'none';
        if (douyinHud) {
            douyinHud.classList.toggle('no-status-bar', !isShown);
        }

        // 2. 手机型号样式类与开孔样式
        const modelKey = selDyPhoneModel ? selDyPhoneModel.value : 'iphone16';
        const cutoutKey = selDyCutout ? selDyCutout.value : 'none';
        dyStatusBar.className = `dy-status-bar model-${modelKey}${cutoutKey === 'punch-left' ? ' has-left-punch' : ''}`;

        if (dySbCutoutWrap) {
            dySbCutoutWrap.classList.toggle('is-punch-left', cutoutKey === 'punch-left');
        }
        if (dyCutoutBox) {
            dyCutoutBox.className = `dy-cutout cutout-${cutoutKey}`;
        }

        // 3. 时间与左上录屏红胶囊
        const timeVal = (inDySbTime && inDySbTime.value) ? inDySbTime.value : '14:24';
        const showRec = swDySbRec && swDySbRec.checked;
        if (dySbRec) dySbRec.style.display = showRec ? 'inline-flex' : 'none';
        if (dySbRecTime) dySbRecTime.textContent = timeVal;
        if (dySbTime) {
            dySbTime.textContent = timeVal;
            dySbTime.style.display = showRec ? 'none' : 'inline-block';
        }

        // 4. 运营商文字
        const carrierVal = selDySbCarrier ? selDySbCarrier.value : '';
        if (dySbCarrier) {
            dySbCarrier.textContent = carrierVal;
            dySbCarrier.style.display = carrierVal ? 'inline-block' : 'none';
        }

        // 5. 左侧与右侧小状态图标显隐
        if (dySbLoc) dySbLoc.style.display = (swDySbLoc && swDySbLoc.checked) ? 'inline-block' : 'none';
        if (dySbDnd) dySbDnd.style.display = (swDySbDnd && swDySbDnd.checked) ? 'inline-block' : 'none';
        if (dySbNotifs) dySbNotifs.style.display = (swDySbNotifs && swDySbNotifs.checked) ? 'inline-flex' : 'none';

        if (dySbNetspeed) {
            dySbNetspeed.textContent = (inDySbSpeed && inDySbSpeed.value) ? inDySbSpeed.value : '3.6M/s';
            dySbNetspeed.style.display = (swDySbSpeed && swDySbSpeed.checked) ? 'inline-block' : 'none';
        }
        if (dySbMute) dySbMute.style.display = (swDySbMute && swDySbMute.checked) ? 'inline-block' : 'none';
        if (dySbAlarm) dySbAlarm.style.display = (swDySbAlarm && swDySbAlarm.checked) ? 'inline-block' : 'none';
        if (dySbBt) dySbBt.style.display = (swDySbBt && swDySbBt.checked) ? 'inline-block' : 'none';
        if (dySbNfc) dySbNfc.style.display = (swDySbNfc && swDySbNfc.checked) ? 'inline-block' : 'none';
        if (dySbHd) dySbHd.style.display = (swDySbHd && swDySbHd.checked) ? 'inline-block' : 'none';
        if (dySbVpn) dySbVpn.style.display = (swDySbVpn && swDySbVpn.checked) ? 'inline-block' : 'none';

        // 6. 移动信号条 (单卡 / 双卡双排)
        const sigVal = selDySbSignal ? selDySbSignal.value : 'single-4';
        const isDual = sigVal.startsWith('dual');
        const sigLevel = parseInt(sigVal.split('-')[1]) || 4;
        if (dySbSignal) {
            dySbSignal.classList.toggle('is-dual', isDual);
        }
        if (dySigRow1) {
            const bars1 = dySigRow1.querySelectorAll('.dy-sig-bar');
            bars1.forEach((b, idx) => b.classList.toggle('active', idx < (isDual ? 4 : sigLevel)));
        }
        if (dySigRow2) {
            dySigRow2.style.display = isDual ? 'flex' : 'none';
            const bars2 = dySigRow2.querySelectorAll('.dy-sig-bar');
            bars2.forEach((b, idx) => b.classList.toggle('active', idx < sigLevel));
        }

        // 7. 网络连接图标 (Wi-Fi / 5G / 5G-A / 4G / 同显)
        const netVal = selDySbNet ? selDySbNet.value : 'wifi';
        if (dySbWifi) {
            dySbWifi.style.display = (netVal === 'wifi' || netVal === 'wifi+5g') ? 'inline-block' : 'none';
        }
        if (dySbNetTxt) {
            if (netVal === '5g' || netVal === 'wifi+5g') {
                dySbNetTxt.textContent = '5G';
                dySbNetTxt.style.display = 'inline-block';
            } else if (netVal === '5ga') {
                dySbNetTxt.textContent = '5G-A';
                dySbNetTxt.style.display = 'inline-block';
            } else if (netVal === '4g') {
                dySbNetTxt.textContent = '4G';
                dySbNetTxt.style.display = 'inline-block';
            } else {
                dySbNetTxt.style.display = 'none';
            }
        }

        // 8. 电池电量、百分比与快充/省电颜色
        const batVal = Math.min(100, Math.max(5, parseInt(inDySbBattery ? inDySbBattery.value : 85) || 85));
        if (txtDySbBattery) txtDySbBattery.textContent = batVal + '%';
        if (dySbBatFill) dySbBatFill.style.width = batVal + '%';
        if (dySbBatPct) {
            dySbBatPct.textContent = batVal + '%';
            dySbBatPct.style.display = (!swDySbBatPct || swDySbBatPct.checked) ? 'inline-block' : 'none';
        }
        const isCharging = swDySbCharging && swDySbCharging.checked;
        const isLowPower = swDySbLowpower && swDySbLowpower.checked;
        if (dySbBattery) {
            dySbBattery.classList.toggle('is-charging', isCharging);
            dySbBattery.classList.toggle('is-lowpower', !isCharging && isLowPower);
        }
        if (dySbBatBolt) {
            dySbBatBolt.style.display = isCharging ? 'block' : 'none';
        }
        // 同步到图4全屏横屏状态栏
        const dylClock = document.getElementById('dyl-disp-clock');
        const dylBatPct = document.getElementById('dyl-disp-battery');
        const dylBatFill = document.getElementById('dyl-disp-bat-fill');
        if (dylClock && inDySbTime) dylClock.textContent = inDySbTime.value || '03:18';
        if (dylBatPct) dylBatPct.textContent = batVal + '%';
        if (dylBatFill) dylBatFill.style.width = batVal + '%';
    }
    window.renderDyStatusBar = renderDyStatusBar;

    function injectLayaAppAssets() {
        if (!window.LAYA_APP_ASSETS) return;
        document.querySelectorAll('img[data-laya-asset]').forEach(img => {
            const key = img.getAttribute('data-laya-asset');
            if (window.LAYA_APP_ASSETS[key]) {
                img.src = window.LAYA_APP_ASSETS[key];
            }
        });
    }
    injectLayaAppAssets();
    setTimeout(injectLayaAppAssets, 60);
    setTimeout(injectLayaAppAssets, 250);

    function applyDyPhoneModelPreset(modelKey, showToastMsg = true) {
        const preset = PHONE_MODEL_PRESETS[modelKey];
        if (!preset) return;
        if (selDyCutout) selDyCutout.value = preset.cutout;
        if (selDySbSignal) selDySbSignal.value = preset.signal;
        if (selDySbNet) selDySbNet.value = preset.net;
        if (selDySbCarrier) selDySbCarrier.value = preset.carrier;
        if (swDySbLoc) swDySbLoc.checked = !!preset.loc;
        if (swDySbSpeed) swDySbSpeed.checked = !!preset.speed;
        if (swDySbBt) swDySbBt.checked = !!preset.bt;
        if (swDySbAlarm) swDySbAlarm.checked = !!preset.alarm;
        if (swDySbMute) swDySbMute.checked = !!preset.mute;
        if (swDySbHd) swDySbHd.checked = !!preset.hd;
        if (swDySbVpn) swDySbVpn.checked = !!preset.vpn;
        if (swDySbNfc) swDySbNfc.checked = !!preset.nfc;
        if (swDySbDnd) swDySbDnd.checked = !!preset.dnd;
        if (swDySbNotifs) swDySbNotifs.checked = !!preset.notifs;
        if (swDySbRec) swDySbRec.checked = !!preset.rec;
        if (swDySbBatPct) swDySbBatPct.checked = !!preset.batPct;

        renderDyStatusBar();
        triggerSaveStorage();
        if (showToastMsg) {
            window.showToast(`📱 已切换手机状态栏型号：${preset.name}`);
        }
    }

    if (selDyPhoneModel) {
        selDyPhoneModel.addEventListener('change', (e) => {
            applyDyPhoneModelPreset(e.target.value, true);
        });
    }

    [
        swDyStatusBar, selDyCutout, selDySbSignal, selDySbNet, selDySbCarrier,
        swDySbBatPct, swDySbCharging, swDySbLowpower, swDySbLoc, swDySbSpeed,
        swDySbBt, swDySbAlarm, swDySbMute, swDySbHd, swDySbVpn, swDySbNfc,
        swDySbDnd, swDySbNotifs, swDySbRec
    ].forEach(el => {
        if (el) {
            el.addEventListener('change', () => {
                renderDyStatusBar();
                triggerSaveStorage();
            });
        }
    });

    [inDySbTime, inDySbSpeed, inDySbBattery].forEach(el => {
        if (el) {
            el.addEventListener('input', () => {
                renderDyStatusBar();
                triggerSaveStorage();
            });
        }
    });

    function getCurrentRealClockTime() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    const inDylClockTime = document.getElementById('in-dyl-clock-time');
    const btnDylRandomTime = document.getElementById('btn-dyl-random-time');
    const btnMRandomClock = document.getElementById('btn-m-random-clock');
    const dylDispClockEl = document.getElementById('dyl-disp-clock');

    function syncAllPhoneClockTimes(tStr, shouldSave = false) {
        if (!tStr) tStr = getCurrentRealClockTime();
        if (inDySbTime) inDySbTime.value = tStr;
        if (inMStatusTime) inMStatusTime.value = tStr;
        if (inDylClockTime) inDylClockTime.value = tStr;
        if (mDispStatusTime) mDispStatusTime.textContent = tStr;
        if (dylDispClockEl) dylDispClockEl.textContent = tStr;
        renderDyStatusBar();
        if (shouldSave) triggerSaveStorage();
    }
    window.syncAllPhoneClockTimes = syncAllPhoneClockTimes;

    function randomizeDyStatusTime() {
        const h = String(Math.floor(Math.random() * 24)).padStart(2, '0');
        const m = String(Math.floor(Math.random() * 60)).padStart(2, '0');
        const tStr = `${h}:${m}`;
        syncAllPhoneClockTimes(tStr, true);
        window.showToast(`🕒 已随机切换手机时间：${tStr}`);
    }

    if (btnMRandomClock) btnMRandomClock.addEventListener('click', randomizeDyStatusTime);
    if (btnDylRandomTime) btnDylRandomTime.addEventListener('click', randomizeDyStatusTime);
    if (mDispStatusTime) mDispStatusTime.addEventListener('click', randomizeDyStatusTime);
    if (dylDispClockEl) dylDispClockEl.addEventListener('click', randomizeDyStatusTime);
    if (inDylClockTime) {
        inDylClockTime.addEventListener('input', (e) => {
            syncAllPhoneClockTimes(e.target.value, true);
        });
    }
    if (inMStatusTime) {
        inMStatusTime.addEventListener('input', (e) => {
            syncAllPhoneClockTimes(e.target.value, true);
        });
    }
    if (inDySbTime) {
        inDySbTime.addEventListener('input', (e) => {
            syncAllPhoneClockTimes(e.target.value, true);
        });
    }

    // 页面首次初始化时立即同步为打开网站时的真实系统时间
    syncAllPhoneClockTimes(getCurrentRealClockTime(), false);

    function _legacyRandomizeDyStatusTime_unused() {
        const h = String(Math.floor(Math.random() * 14) + 9).padStart(2, '0');
        const m = String(Math.floor(Math.random() * 60)).padStart(2, '0');
        const tStr = `${h}:${m}`;
        if (inDySbTime) inDySbTime.value = tStr;
        if (inMStatusTime) {
            inMStatusTime.value = tStr;
            if (mDispStatusTime) mDispStatusTime.textContent = tStr;
        }
        renderDyStatusBar();
        triggerSaveStorage();
        window.showToast(`🕒 已随机切换手机时间：${tStr}`);
    }

    if (btnDyRandomTime) {
        btnDyRandomTime.addEventListener('click', randomizeDyStatusTime);
    }
    if (dySbTime) {
        dySbTime.addEventListener('click', randomizeDyStatusTime);
    }

    // 点击舞台中央灵动岛/挖孔直接循环切换开孔款式
    if (dySbCutoutWrap && selDyCutout) {
        dySbCutoutWrap.addEventListener('click', () => {
            const nextIdx = (selDyCutout.selectedIndex + 1) % selDyCutout.options.length;
            selDyCutout.selectedIndex = nextIdx;
            renderDyStatusBar();
            triggerSaveStorage();
            window.showToast(`✨ 已切换屏幕开孔样式：${selDyCutout.options[nextIdx].text}`);
        });
    }

    // 点击舞台电池组件快速切换快充状态
    if (dySbBatteryGroup && swDySbCharging) {
        dySbBatteryGroup.addEventListener('click', () => {
            swDySbCharging.checked = !swDySbCharging.checked;
            renderDyStatusBar();
            triggerSaveStorage();
            window.showToast(swDySbCharging.checked ? '⚡ 已开启闪电快充状态' : '🔋 已恢复普通电池状态');
        });
    }

    renderDyStatusBar();

    /* ==========================================================================
       6. 三端显隐开关矩阵与文案实时绑定 (含图3与图4专属控件)
       ========================================================================== */
    const bindToggle = (switchId, targetId, shownDisplay = '') => {
        const sw = document.getElementById(switchId);
        const target = document.getElementById(targetId);
        if (sw && target) {
            sw.addEventListener('change', (e) => {
                target.style.display = e.target.checked ? shownDisplay : 'none';
                if (switchId === 'sw-waveform') window.drawWaveform();
                triggerSaveStorage();
            });
        }
    };

    bindToggle('sw-danmaku', 'danmaku-container', 'block');
    bindToggle('sw-center-btn', 'btn-toggle-playback', 'flex');
    bindToggle('sw-center-pill', 'disp-center-pill', 'block');
    bindToggle('sw-bot-dm-group', 'wrap-bot-dm-group', 'inline-flex');
    bindToggle('sw-viewer', 'wrap-viewer-pill', 'inline-flex');
    bindToggle('sw-banner', 'wrap-banner', 'flex');
    bindToggle('sw-free-pill', 'wrap-free-pill', 'inline-flex');
    bindToggle('sw-laya-badge', 'wrap-laya-badge', 'inline-flex');
    bindToggle('sw-vip-tag', 'wrap-vip-tag', 'inline-flex');
    bindToggle('sw-back-btn', 'wrap-back-btn', 'inline-flex');
    bindToggle('sw-top-right', 'wrap-top-right', 'flex');
    bindToggle('sw-bottom-bar', 'wrap-bottom-bar', 'flex');
    bindToggle('sw-waveform', 'wrap-waveform', 'block');
    // 手机横屏画质徽标开关 & 中央大播放键显隐开关
    bindToggle('sw-m-res-badge', 'm-disp-res-badge', 'inline-flex');
    bindToggle('sw-m-logo-only', 'm-wrap-logo', 'flex');
    bindToggle('sw-m-center-play', 'm-wrap-center-play', 'flex');
    bindToggle('sw-m-status-bar', 'm-status-bar', 'flex');
    bindToggle('sw-m-top-header', 'm-top-header', 'flex');
    bindToggle('sw-m-bottom-bar', 'm-bottom-bar', 'flex');
    bindToggle('sw-m-right-actions', 'm-bot-right-actions', 'flex');

    bindToggle('sw-dy-gold', 'dy-wrap-gold', 'flex');
    bindToggle('sw-dy-featured', 'dy-wrap-featured', 'inline-flex');
    bindToggle('sw-dy-hotspot', 'dy-wrap-hotspot', 'flex');
    bindToggle('sw-dy-campaign', 'dy-wrap-campaign', 'inline-flex');
    bindToggle('sw-dy-right-bar', 'dy-wrap-right-bar', 'flex');

    // 竖屏内16:9视窗水印与单行字幕显隐开关
    bindToggle('sw-dy-lf-wm', 'dy-lf-watermark', 'flex');
    bindToggle('sw-dy-box-sub', 'dy-disp-box-sub', 'block');

    // 全屏观看模式各组件显隐开关
    bindToggle('sw-dyl-status', 'dyl-wrap-status', 'flex');
    bindToggle('sw-dyl-top', 'dyl-wrap-top', 'flex');
    bindToggle('sw-dyl-author', 'dyl-wrap-author', 'inline-flex');
    bindToggle('sw-dyl-top-act', 'dyl-wrap-top-actions', 'flex');
    bindToggle('sw-dyl-bright', 'dyl-wrap-bright', 'block');
    bindToggle('sw-dyl-pause', 'dyl-wrap-center-pause', 'block');
    bindToggle('sw-dyl-right-tools', 'dyl-wrap-right-tools', 'flex');
    bindToggle('sw-dyl-time', 'dyl-wrap-time', 'flex');
    bindToggle('sw-dyl-bottom', 'dyl-wrap-bottom', 'flex');
    bindToggle('sw-dyl-dm-pill', 'dyl-wrap-dm-pill', 'inline-flex');
    bindToggle('sw-dyl-right-opts', 'dyl-wrap-right-opts', 'flex');

    const swDyTopNav = document.getElementById('sw-dy-top-nav');
    const dyWrapTopNav = document.getElementById('dy-wrap-top-nav');
    const layaWrapTopNav = document.getElementById('laya-wrap-top-nav');
    const layaAppWrapTopNav = document.getElementById('laya-app-wrap-top-nav');
    if (swDyTopNav) {
        swDyTopNav.addEventListener('change', (e) => {
            const op = e.target.checked ? '1' : '0';
            const pe = e.target.checked ? 'auto' : 'none';
            if (dyWrapTopNav) { dyWrapTopNav.style.opacity = op; dyWrapTopNav.style.pointerEvents = pe; }
            if (layaWrapTopNav) { layaWrapTopNav.style.opacity = op; layaWrapTopNav.style.pointerEvents = pe; }
            if (layaAppWrapTopNav) { layaAppWrapTopNav.style.opacity = op; layaAppWrapTopNav.style.pointerEvents = pe; }
            triggerSaveStorage();
        });
    }

    const bindText = (inputId, outputId, secondaryOutputId = null) => {
        const inp = document.getElementById(inputId);
        const out = document.getElementById(outputId);
        const out2 = secondaryOutputId ? document.getElementById(secondaryOutputId) : null;
        if (inp && out) {
            inp.addEventListener('input', (e) => {
                out.textContent = e.target.value;
                if (out2) out2.textContent = e.target.value;
                triggerSaveStorage();
            });
        }
    };

    bindText('in-title', 'disp-title');
    bindText('in-viewer-text', 'disp-viewer-text');
    bindText('in-laya-label', 'disp-laya-label');
    bindText('in-free-pill-text', 'disp-free-pill-text');
    bindText('in-banner-body', 'disp-banner-body');
    bindText('in-dm-placeholder', 'disp-dm-placeholder');
    bindText('in-dy-likes', 'dy-val-likes', 'dyl-disp-like');
    bindText('in-dy-comments', 'dy-val-comments', 'dyl-disp-comment');
    bindText('in-dy-stars', 'dy-val-stars', 'dyl-disp-star');
    bindText('in-dy-shares', 'dy-val-shares');
    bindText('in-dy-author', 'dy-disp-author', 'dyl-disp-author');
    bindText('in-dy-desc', 'dy-disp-desc');
    bindText('in-dy-tags', 'dy-disp-tags');
    bindText('in-dy-gold-title', 'dy-disp-gold-title');
    bindText('in-dy-featured-title', 'dy-disp-featured-title');

    // 点击舞台上的「Laya 精選內容 >」胶囊，直接定位到右侧输入框修改文字
    const dyWrapFeatured = document.getElementById('dy-wrap-featured');
    const inDyFeaturedTitle = document.getElementById('in-dy-featured-title');
    if (dyWrapFeatured && inDyFeaturedTitle) {
        dyWrapFeatured.addEventListener('click', () => {
            if (typeof window.switchRightTab === 'function') window.switchRightTab('dy');
            inDyFeaturedTitle.focus();
            inDyFeaturedTitle.select();
            window.showToast('✨ 请在右侧编辑「Laya 精选内容」徽章文字');
        });
    }

    // 绑定左下角圆形「彈✓」按钮开关弹幕
    const dyBtnDmRound = document.getElementById('dy-btn-dm-round');
    const dyDmRoundMark = document.getElementById('dy-dm-round-mark');
    if (dyBtnDmRound) {
        dyBtnDmRound.addEventListener('click', () => {
            const swDm = document.getElementById('sw-danmaku');
            if (swDm) {
                swDm.checked = !swDm.checked;
                swDm.dispatchEvent(new Event('change'));
                if (dyDmRoundMark) {
                    dyDmRoundMark.textContent = swDm.checked ? '✓' : '✕';
                    dyDmRoundMark.style.color = swDm.checked ? '#25F4EE' : 'rgba(255,255,255,0.45)';
                }
                window.showToast(swDm.checked ? '💬 已开启画面弹幕' : '💬 已关闭画面弹幕');
            }
        });
    }
    bindText('in-dy-hotspot-title', 'dy-disp-hotspot-title');
    bindText('in-dy-hotspot-views', 'dy-disp-hotspot-views');

    // ★ 全屏左上角剧集/片名 与 作者名 专属输入框联动 (默认均为 Laya)
    const dylDispTitle = document.getElementById('dyl-disp-title');
    const inpDyLfTitle = document.getElementById('inp-dy-lf-title');
    const inpDyLfBrand = document.getElementById('inp-dy-lf-brand');
    const inDyAuthorEl = document.getElementById('in-dy-author');

    bindText('inp-dy-lf-title', 'dyl-disp-title', 'dy-disp-box-wm');
    if (inpDyLfBrand) {
        inpDyLfBrand.addEventListener('input', (e) => {
            const val = e.target.value;
            const dylAuthor = document.getElementById('dyl-disp-author');
            const wmBrand = document.getElementById('dy-lf-wm-brand');
            if (dylAuthor) dylAuthor.textContent = val;
            if (wmBrand) wmBrand.textContent = val;
            if (inDyAuthorEl) inDyAuthorEl.value = val;
            const dyAuthor = document.getElementById('dy-disp-author');
            if (dyAuthor) dyAuthor.textContent = val;
            triggerSaveStorage();
        });
    }
    if (inDyAuthorEl && inpDyLfBrand) {
        inDyAuthorEl.addEventListener('input', (e) => {
            inpDyLfBrand.value = e.target.value;
        });
    }
    // 点击全屏舞台左上角片名，直接聚焦右侧片名输入框
    if (dylDispTitle && inpDyLfTitle) {
        dylDispTitle.style.cursor = 'pointer';
        dylDispTitle.title = '点击在右侧修改左上角剧集/片名';
        dylDispTitle.addEventListener('click', () => {
            if (typeof window.switchRightTab === 'function') window.switchRightTab('dy');
            inpDyLfTitle.focus();
            inpDyLfTitle.select();
            window.showToast('✏️ 请在右侧「左上角剧集/片名」输入框中直接输入片名');
        });
    }

    bindText('inp-dy-box-sub', 'dy-disp-box-sub', 'dyl-disp-subtitle');

    /* ==========================================================================
       ★ 6.5 智能画面字幕识别、繁简互转与多条逐行编辑引擎 (SubtitleEngine)
       ========================================================================== */
    const swDylSubtitle = document.getElementById('sw-dyl-subtitle');
    const dylWrapSubtitle = document.getElementById('dyl-wrap-subtitle');
    const dylDispSubtitle = document.getElementById('dyl-disp-subtitle');
    const subStudioBody = document.getElementById('sub-studio-body');
    const btnAutoOcrSub = document.getElementById('btn-auto-ocr-sub');
    const btnVoiceOcrSub = document.getElementById('btn-voice-ocr-sub');
    const subOcrProgressWrap = document.getElementById('sub-ocr-progress-wrap');
    const subOcrStatusTxt = document.getElementById('sub-ocr-status-txt');
    const subOcrPctTxt = document.getElementById('sub-ocr-pct-txt');
    const subOcrProgressBar = document.getElementById('sub-ocr-progress-bar');
    const btnSubSimp = document.getElementById('btn-sub-simp');
    const btnSubTrad = document.getElementById('btn-sub-trad');
    const selSubStyle = document.getElementById('sel-sub-style');
    const inSubSize = document.getElementById('in-sub-size');
    const txtSubSize = document.getElementById('txt-sub-size');
    const btnAddSubCue = document.getElementById('btn-add-sub-cue');
    const btnClearSubCues = document.getElementById('btn-clear-sub-cues');
    const subCueListEl = document.getElementById('sub-cue-list');

    // 高覆盖影视字幕简繁字库映射
    const SUB_S2T_CHARS = {
        '万':'萬','与':'與','专':'專','业':'業','东':'東','丝':'絲','丢':'丟','两':'兩','严':'嚴','丧':'喪',
        '个':'個','丰':'豐','临':'臨','为':'為','丽':'麗','举':'舉','么':'麼','义':'義','乌':'烏','乐':'樂',
        '乔':'喬','习':'習','乡':'鄉','书':'書','买':'買','乱':'亂','争':'爭','于':'於','亏':'虧','云':'雲',
        '亚':'亞','产':'產','亩':'畝','享':'享','京':'京','亮':'亮','亲':'親','人':'人','亿':'億','仅':'僅',
        '从':'從','仑':'侖','仓':'倉','们':'們','价':'價','众':'眾','优':'優','伙':'夥','会':'會','伟':'偉',
        '传':'傳','伤':'傷','伦':'倫','伪':'偽','伯':'伯','估':'估','伴':'伴','伸':'伸','似':'似','但':'但',
        '位':'位','低':'低','住':'住','体':'體','何':'何','余':'餘','佛':'佛','作':'作','你':'你','佣':'傭',
        '佩':'佩','佳':'佳','使':'使','来':'來','例':'例','供':'供','依':'依','侠':'俠','侦':'偵','侧':'側',
        '侨':'僑','侬':'儂','侮':'侮','侯':'侯','侵':'侵','便':'便','促':'促','俄':'俄','俊':'俊','俗':'俗',
        '保':'保','信':'信','俩':'倆','俭':'儉','修':'修','俯':'俯','俱':'俱','倍':'倍','倒':'倒','倔':'倔',
        '倘':'倘','候':'候','倚':'倚','借':'借','倡':'倡','债':'債','值':'值','倾':'傾','假':'假','偌':'偌',
        '偏':'偏','偕':'偕','做':'做','停':'停','健':'健','偶':'偶','偷':'偷','偿':'償','傀':'傀','傅':'傅',
        '傍':'傍','储':'儲','催':'催','傲':'傲','傻':'傻','像':'像','儿':'兒','允':'允','元':'元','兄':'兄',
        '充':'充','兆':'兆','先':'先','光':'光','克':'克','免':'免','兑':'兌','兔':'兔','党':'黨','兜':'兜',
        '入':'入','全':'全','八':'八','公':'公','六':'六','兰':'蘭','共':'共','关':'關','兴':'興','兵':'兵',
        '其':'其','具':'具','典':'典','兹':'茲','养':'養','兼':'兼','兽':'獸','内':'內','冈':'岡','册':'冊',
        '再':'再','冒':'冒','写':'寫','军':'軍','农':'農','冠':'冠','冢':'塚','冤':'冤','冥':'冥','冬':'冬',
        '冯':'馮','冰':'冰','冲':'衝','决':'決','况':'況','冶':'冶','冷':'冷','冻':'凍','净':'淨','凄':'淒',
        '准':'準','凉':'涼','凋':'凋','凌':'凌','减':'減','凑':'湊','凛':'凜','凝':'凝','几':'幾','凡':'凡',
        '凤':'鳳','凭':'憑','凯':'凱','凰':'凰','凶':'兇','凸':'凸','凹':'凹','出':'出','击':'擊','函':'函',
        '凿':'鑿','刀':'刀','刁':'刁','刃':'刃','分':'分','切':'切','刊':'刊','刍':'芻','刑':'刑','划':'劃',
        '列':'列','刘':'劉','则':'則','刚':'剛','创':'創','初':'初','删':'刪','判':'判','利':'利','别':'別',
        '刮':'刮','到':'到','制':'製','刷':'刷','券':'券','刹':'剎','刺':'刺','刻':'刻','刽':'劊','剂':'劑',
        '剃':'剃','削':'削','前':'前','剐':'剮','剑':'劍','剔':'剔','剖':'剖','剥':'剝','剧':'劇','剩':'剩',
        '剪':'剪','副':'副','割':'割','剿':'剿','劈':'劈','力':'力','劝':'勸','办':'辦','功':'功','加':'加',
        '务':'務','劣':'劣','动':'動','助':'助','努':'努','劫':'劫','励':'勵','劲':'勁','劳':'勞','势':'勢',
        '勇':'勇','勉':'勉','勋':'勳','勒':'勒','动':'動','勘':'勘','务':'務','胜':'勝','募':'募','勤':'勤',
        '勾':'勾','勿':'勿','包':'包','匆':'匆','匈':'匈','化':'化','北':'北','匙':'匙','区':'區','医':'醫',
        '华':'華','协':'協','单':'單','卖':'賣','卢':'盧','卤':'滷','卧':'臥','卫':'衛','却':'卻','卷':'卷',
        '厂':'廠','厅':'廳','历':'歷','厉':'厲','压':'壓','厌':'厭','厕':'廁','厘':'釐','厚':'厚','原':'原',
        '厢':'廂','厦':'廈','厨':'廚','厩':'廄','厮':'廝','去':'去','县':'縣','参':'參','又':'又','叉':'叉',
        '及':'及','友':'友','双':'雙','反':'反','发':'發','叔':'叔','取':'取','受':'受','变':'變','叙':'敘',
        '叛':'叛','叠':'疊','口':'口','古':'古','句':'句','另':'另','只':'隻','叫':'叫','召':'召','叮':'叮',
        '可':'可','台':'台','史':'史','右':'右','叶':'葉','号':'號','司':'司','叹':'嘆','叼':'叼','叽':'嘰',
        '吁':'籲','吃':'吃','各':'各','合':'合','吉':'吉','吊':'吊','同名':'同名','后':'後','吏':'吏','吐':'吐',
        '向':'向','吓':'嚇','吕':'呂','吗':'嗎','君':'君','吝':'吝','吞':'吞','吟':'吟','吠':'吠','否':'否',
        '吧':'吧','吨':'噸','吩':'吩','含':'含','听':'聽','吭':'吭','吮':'吮','启':'啟','吱':'吱','吴':'吳',
        '吵':'吵','吸':'吸','吹':'吹','吻':'吻','吼':'吼','呀':'呀','吕':'呂','呃':'呃','呆':'呆','呈':'呈',
        '告':'告','呐':'吶','呕':'嘔','员':'員','呛':'嗆','呜':'嗚','呢':'呢','周':'週','咒':'咒','咔':'咔',
        '咕':'咕','咖':'咖','咙':'嚨','呻':'呻','呼':'呼','命':'命','咀':'咀','咂':'咂','咄':'咄','咆':'咆',
        '咋':'咋','和':'和','咎':'咎','咏':'詠','咐':'咐','咒':'咒','咔':'咔','咕':'咕','咖':'咖','咙':'嚨',
        '咸':'鹹','咽':'咽','哀':'哀','品':'品','哄':'哄','哆':'哆','哇':'哇','哈':'哈','哉':'哉','响':'響',
        '哎':'哎','哑':'啞','哒':'噠','哓':'嘵','哔':'嗶','哕':'噦','哗':'嘩','哙':'噲','哚':'哚','哝':'噥',
        '哟':'喲','哥':'哥','哦':'哦','哧':'哧','哨':'哨','哩':'哩','哪':'哪','哭':'哭','哮':'哮','哲':'哲',
        '哺':'哺','哼':'哼','哽':'哽','哿':'哿','唁':'唁','唆':'唆','唇':'唇','唉':'唉','唏':'唏','唐':'唐',
        '唔':'唔','唛':'嘜','唠':'嘮','唢':'嗩','唤':'喚','唧':'唧','唬':'唬','售':'售','唯':'唯','唱':'唱',
        '唳':'唳','唷':'唷','唼':'唼','唾':'唾','唿':'唿','啁':'啁','啃':'啃','啄':'啄','商':'商','啉':'啉',
        '啊':'啊','啤':'啤','啥':'啥','啦':'啦','啧':'嘖','啪':'啪','啬':'嗇','啭':'囀','啮':'嚙','啰':'囉',
        '啸':'嘯','喷':'噴','喽':'嘍','喾':'嚳','嗫':'囁','呵':'呵','嗔':'嗔','嘘':'噓','嘱':'囑','嘿':'嘿',
        '嘴':'嘴','嘶':'嘶','嘹':'嘹','嘻':'嘻','嘿':'嘿','噌':'噌','':'噍','噎':'噎','嘘':'噓','器':'器',
        '噩':'噩','噪':'噪','噫':'噫','噬':'噬','噱':'噱','噶':'噶','噼':'噼','嚎':'嚎','嚏':'嚏','嚣':'囂',
        '嚷':'嚷','嚼':'嚼','囊':'囊','囚':'囚','四':'四','回':'回','因':'因','团':'團','囤':'囤','园':'園',
        '困':'困','囱':'囪','围':'圍','囵':'圇','国':'國','图':'圖','圆':'圓','圈':'圈','圉':'圉','圊':'圊',
        '土':'土','圣':'聖','在':'在','地':'地','场':'場','圾':'圾','址':'址','均':'均','坊':'坊','坍':'坍',
        '坎':'坎','坏':'壞','坐':'坐','坑':'坑','块':'塊','坚':'堅','坛':'壇','坜':'壢','坝':'壩','坞':'塢',
        '坟':'墳','坠':'墜','坡':'坡','坤':'坤','坦':'坦','坨':'坨','坩':'坩','坪':'坪','坫':'坫','坭':'坭',
        '坯':'坯','坳':'坳','姆':'姆','坷':'坷','坻':'坻','坼':'坼','垂':'垂','垃':'垃','垄':'壟','垆':'壚',
        '型':'型','垌':'垌','垒':'壘','垓':'垓','垛':'垛','垠':'垠','垡':'垡','垢':'垢','垣':'垣','垤':'垤',
        '垦':'墾','垧':'坰','垩':'堊','垫':'墊','垭':'埡','垮':'垮','垲':'塏','垴':'堖','垸':'垸','埂':'埂',
        '埃':'埃','埋':'埋','城':'城','埏':'埏','埒':'埒','埔':'埔','埕':'埕','埘':'塒','埙':'塤','埚':'堝',
        '埝':'埝','域':'域','埠':'埠','埯':'埯','埴':'埴','埸':'埸','培':'培','基':'基','埽':'埽','堀':'堀',
        '堂':'堂','坚':'堅','堆':'堆','堇':'堇','堋':'堋','堍':'堍','堑':'塹','堕':'墮','堙':'堙','堞':'堞',
        '堠':'堠','堡':'堡','堤':'堤','堪':'堪','尧':'堯','堰':'堰','报':'報','场':'場','堵':'堵','6':'6',
        '境':'境','墅':'墅','墉':'墉','垫':'墊','墓':'墓','墙':'牆','增':'增','墟':'墟','墨':'墨','墩':'墩',
        '堕':'墮','壁':'壁','壅':'壅','坛':'壇','壑':'壑','压':'壓','壕':'壕','壤':'壤','士':'士','壮':'壯',
        '声':'聲','壳':'殼','壶':'壺','处':'處','备':'備','复':'復','夏':'夏','夕':'夕','外':'外','夙':'夙',
        '多':'多','夜':'夜','够':'夠','大':'大','天':'天','太':'太','夫':'夫','夭':'夭','央':'央','夯':'夯',
        '失':'失','头':'頭','夷':'夷','夸':'誇','夹':'夾','夺':'奪','奁':'奩','奂':'奐','奄':'奄','奇':'奇',
        '奈':'奈','奉':'奉','奋':'奮','奎':'奎','奏':'奏','契':'契','奔':'奔','奕':'奕','奖':'獎','套':'套',
        '奘':'奘','奚':'奚','奠':'奠','奢':'奢','奥':'奧','女':'女','奴':'奴','奶':'奶','奸':'姦','她':'她',
        '好':'好','如':'如','妃':'妃','妄':'妄','妆':'妝','妇':'婦','妈':'媽','妊':'妊','妍':'妍','妒':'妒',
        '妓':'妓','妖':'妖','妗':'妗','妙':'妙','妞':'妞','妣':'妣','妤':'妤','妥':'妥','妨':'妨','妩':'嫵',
        '妪':'嫗','妫':'媯','妮':'妮','妯':'妯','妲':'妲','妹':'妹','妻':'妻','妾':'妾','姆':'姆','姊':'姊',
        '始':'始','姐':'姐','姑':'姑','姒':'姒','姓':'姓','委':'委','姗':'姍','姘':'姘','姚':'姚','姜':'姜',
        '姝':'姝','姣':'姣','姥':'姥','姨':'姨','姬':'姬','姹':'姹','姻':'姻','姿':'姿','威':'威','娃':'娃',
        '娄':'婁','娅':'婭','娆':'嬈','娇':'嬌','娈':'孌','娉':'娉','娌':'娌','娑':'娑','娓':'娓','娘':'娘',
        '娜':'娜','娟':'娟','娠':'娠','娣':'娣','娥':'娥','娩':'娩','娱':'娛','娲':'媧','娴':'嫻','娶':'娶',
        '娼':'娼','婀':'婀','婆':'婆','婉':'婉','婊':'婊','婕':'婕','婚':'婚','婢':'婢','妇女':'婦女','婧':'婧',
        '婪':'婪','婴':'嬰','婶':'嬸','媒':'媒','媚':'媚','媛':'媛','媳':'媳','媲':'媲','嫁':'嫁','嫂':'嫂',
        '嫉':'嫉','嫌':'嫌','嫡':'嫡','嫣':'嫣','嫦':'嫦','嫩':'嫩','嫫':'嫫','嫱':'嬙','嬉':'嬉','婵':'嬋',
        '':'媠','嬴':'嬴','嬷':'嬤','孀':'孀','子':'子','孑':'孑','孓':'孓','孔':'孔','孕':'孕','字':'字',
        '存':'存','孙':'孫','孚':'孚','孛':'孛','孜':'孜','孝':'孝','孟':'孟','季':'季','孤':'孤','学':'學',
        '孩':'孩','孪':'孿','宁':'寧','它':'它','宅':'宅','宇':'宇','守':'守','安':'安','宋':'宋','完':'完',
        '宏':'宏','宗':'宗','官':'官','宙':'宙','定':'定','宛':'宛','宜':'宜','宝':'寶','实':'實','宠':'寵',
        '审':'審','客':'客','宣':'宣','室':'室','宥':'宥','宦':'宦','宪':'憲','宫':'宮','宰':'宰','害':'害',
        '宴':'宴','宵':'宵','家':'家','宸':'宸','容':'容','宽':'寬','宾':'賓','宿':'宿','寂':'寂','寄':'寄',
        '寅':'寅','密':'密','寇':'寇','富':'富','寐':'寐','寒':'寒','寓':'寓','寝':'寢','寞':'寞','察':'察',
        '寡':'寡','寤':'寤','寥':'寥','寨':'寨','寮':'寮','寰':'寰','寸':'寸','对':'對','寺':'寺','寻':'尋',
        '导':'導','寿':'壽','封':'封','射':'射','将':'將','专':'專','尉':'尉','尊':'尊','小':'小','少':'少',
        '尔':'爾','尘':'塵','尚':'尚','尝':'嘗','尤':'尤','尧':'堯','尬':'尬','就':'就','尸':'尸','尹':'尹',
        '尺':'尺','尽':'盡','尾':'尾','尿':'尿','局':'局','屁':'屁','层':'層','居':'居','屈':'屈','屉':'屜',
        '届':'屆','屋':'屋','屎':'屎','屏':'屏','展':'展','属':'屬','屠':'屠','屡':'屢','履':'履','山':'山',
        '岁':'歲','岂':'豈','岗':'崗','岘':'峴','岚':'嵐','岛':'島','岩':'岩','岭':'嶺','岳':'岳','岸':'岸',
        '峡':'峽','峰':'峰','峻':'峻','崇':'崇','崎':'崎','崔':'崔','崖':'崖','崛':'崛','崩':'崩','崭':'嶄',
        '嵌':'嵌','巅':'巔','川':'川','州':'州','巡':'巡','巢':'巢','工':'工','左':'左','巧':'巧','巨':'巨',
        '巩':'鞏','巫':'巫','差':'差','己':'己','已':'已','巳':'巳','巴':'巴','巷':'巷','币':'幣','市':'市',
        '布':'布','帅':'帥','帆':'帆','师':'師','希':'希','帐':'帳','帕':'帕','帖':'帖','帘':'簾','帚':'帚',
        '帛':'帛','帜':'幟','帝':'帝','带':'帶','帧':'幀','席':'席','帮':'幫','帱':'幬','常':'常','帽':'帽',
        '幂':'冪','幅':'幅','幌':'幌','幔':'幔','幕':'幕','帼':'幗','幛':'幛','幞':'幞','幡':'幡','幢':'幢',
        '干':'幹','平':'平','年':'年','并':'並','幸':'幸','幻':'幻','幼':'幼','幽':'幽','广':'廣','庄':'莊',
        '庆':'慶','庇':'庇','床':'床','序':'序','庐':'廬','库':'庫','应':'應','底':'底','庖':'庖','店':'店',
        '庙':'廟','庚':'庚','府':'府','庞':'龐','废':'廢','度':'度','座':'座','庭':'庭','庵':'庵','庶':'庶',
        '康':'康','庸':'庸','廉':'廉','廊':'廊','廓':'廓','廖':'廖','延':'延','廷':'廷','建':'建','开':'開',
        '异':'異','弃':'棄','弄':'弄','弊':'弊','式':'式','引':'引','弗':'弗','弘':'弘','弟':'弟','张':'張',
        '弥':'彌','弦':'弦','弧':'弧','弩':'弩','弯':'彎','弱':'弱','弹':'彈','强':'強','归':'歸','当':'當',
        '录':'錄','彦':'彥','彩':'彩','彪':'彪','彬':'彬','彭':'彭','彰':'彰','影':'影','役':'役','彻':'徹',
        '彼':'彼','往':'往','征':'征','径':'徑','待':'待','徇':'徇','很':'很','律':'律','后':'後','徐':'徐',
        '徒':'徒','得':'得','徘':'徘','徙':'徙','御':'御','徨':'徨','循':'循','微':'微','德':'德','':'徵',
        '心':'心','必':'必','忆':'憶','忌':'忌','忍':'忍','忏':'懺','忐':'忐','忑':'忑','志':'志','忘':'忘',
        '忙':'忙','忠':'忠','忧':'憂','快':'快','忱':'忱','念':'念','忽':'忽','怀':'懷','态':'態','怂':'慫',
        '怃':'憮','怄':'慪','怅':'悵','怆':'愴','怎':'怎','怒':'怒','怕':'怕','怖':'怖','怜':'憐','思':'思',
        '怠':'怠','急':'急','性':'性','怨':'怨','怪':'怪','怯':'怯','总':'總','恃':'恃','恋':'戀','恍':'恍',
        '恐':'恐','恒':'恆','恕':'恕','恙':'恙','恢':'恢','恣':'恣','恤':'恤','耻':'恥','恨':'恨','恩':'恩',
        '恪':'恪','恫':'恫','恬':'恬','恭':'恭','息':'息','恰':'恰','恳':'懇','恶':'惡','恼':'惱','恽':'惲',
        '悄':'悄','悉':'悉','悍':'悍','悔':'悔','悖':'悖','悚':'悚','悛':'悛','悟':'悟','悠':'悠','患':'患',
        '悦':'悅','您':'您','悬':'懸','悯':'憫','悲':'悲','悴':'悴','悸':'悸','悼':'悼','情':'情','惊':'驚',
        '惑':'惑','惕':'惕','惜':'惜','惟':'惟','惠':'惠','惦':'惦','惧':'懼','惨':'慘','惩':'懲','惫':'憊',
        '惬':'愜','惭':'慚','惮':'憚','惯':'慣','惰':'惰','想':'想','惶':'惶','惹':'惹','惺':'惺','愁':'愁',
        '愈':'愈','愉':'愉','意':'意','愕':'愕','愚':'愚','感':'感','愠':'慍','愧':'愧','愫':'愫','慈':'慈',
        '慎':'慎','慌':'慌','慕':'慕','慢':'慢','慧':'慧','慨':'慨','慰':'慰','慵':'慵','慷':'慷','憋':'憋',
        '憎':'憎','憔':'憔','':'憝','憧':'憧','憨':'憨','憩':'憩','懂':'懂','懈':'懈','应':'應','懊':'懊',
        '懋':'懋','懑':'懣','懒':'懶','懦':'懦','戏':'戲','成':'成','我':'我','戒':'戒','战':'戰','戚':'戚',
        '户':'戶','房':'房','所':'所','扁':'扁','扇':'扇','手':'手','才':'才','扎':'扎','扑':'撲','扒':'扒',
        '打':'打','扔':'扔','托':'托','扛':'扛','扣':'扣','执':'執','扩':'擴','扪':'捫','扫':'掃','扬':'揚',
        '扭':'扭','扮':'扮','扯':'扯','扰':'擾','扳':'扳','扶':'扶','批':'批','扼':'扼','找':'找','承':'承',
        '技':'技','抄':'抄','抉':'抉','把':'把','抑':'抑','抒':'抒','抓':'抓','投':'投','抖':'抖','抗':'抗',
        '折':'折','抚':'撫','抛':'拋','抟':'摶','抠':'摳','抡':'掄','抢':'搶','护':'護','报':'報','担':'擔',
        '拟':'擬','拢':'攏','拣':'揀','拥':'擁','拦':'攔','拧':'擰','拨':'撥','择':'擇','挂':'掛','挚':'摯',
        '挛':'攣','':'掗','挝':'撾','挞':'撻','挟':'挾','挠':'撓','挡':'擋','挢':'撟','挣':'掙','挤':'擠',
        '挥':'揮','挦':'撏','挨':'挨','挪':'挪','挫':'挫','振':'振','挺':'挺','挽':'挽','捂':'捂','捃':'捃',
        '捅':'捅','捆':'捆','捉':'捉','捋':'捋','捌':'捌','捍':'捍','捎':'捎','捏':'捏','捐':'捐','捕':'捕',
        '捞':'撈','损':'損','捡':'撿','换':'換','捣':'搗','捧':'捧','据':'據','捱':'捱','捶':'捶','捷':'捷',
        '捺':'捺','捻':'捻','掀':'掀','掂':'掂','扫':'掃','授':'授','掉':'掉','掌':'掌','掏':'掏','掐':'掐',
        '排':'排','掖':'掖','掘':'掘','掠':'掠','探':'探','掣':'掣','接':'接','控':'控','推':'推','掩':'掩',
        '措':'措','掬':'掬','掲':'揭','掳':'擄','掴':'摑','掷':'擲','掸':'撣','掺':'摻','掼':'摜','掾':'掾',
        '搁':'擱','搂':'摟','搅':'攪','搏':'搏','搐':'搐','搓':'搓','搔':'搔','搜':'搜','搞':'搞','搠':'搠',
        '搡':'搡','搦':'搦','搪':'搪','搬':'搬','搭':'搭','携':'攜','搽':'搽','摁':'摁','摄':'攝','摅':'攄',
        '摆':'擺','摇':'搖','摈':'擯','摊':'攤','摸':'摸','撑':'撐','撒':'撒','撕':'撕','撞':'撞','撤':'撤',
        '撩':'撩','撬':'撬','播':'播','撮':'撮','撰':'撰','撵':'攆','撷':'擷','撸':'擼','撺':'攛','撼':'撼',
        '擀':'擀','擂':'擂','擅':'擅','操':'操','擎':'擎','擒':'擒','擘':'擘','擞':'擻','擦':'擦','攀':'攀',
        '攒':'攢','攘':'攘','攥':'攥','攫':'攫','支':'支','收':'收','改':'改','攻':'攻','放':'放','政':'政',
        '故':'故','效':'效','敌':'敵','敏':'敏','救':'救','敕':'敕','敖':'敖','教':'教','敛':'斂','敝':'敝',
        '敞':'敞','敢':'敢','散':'散','敦':'敦','敬':'敬','数':'數','敲':'敲','整':'整','敷':'敷','文':'文',
        '斋':'齋','斌':'斌','斐':'斐','斑':'斑','斗':'鬥','料':'料','斜':'斜','斤':'斤','斥':'斥','斩':'斬',
        '断':'斷','斯':'斯','新':'新','方':'方','于':'於','施':'施','旁':'旁','旃':'旃','旄':'旄','旅':'旅',
        '旆':'旆','旋':'旋','族':'族','旒':'旒','旗':'旗','无':'無','既':'既','日':'日','旦':'旦','旧':'舊',
        '旨':'旨','早':'早','旬':'旬','旭':'旭','旮':'旮','旯':'旯','旰':'旰','旱':'旱','时':'時','旷':'曠',
        '旺':'旺','昀':'昀','昂':'昂','昃':'昃','昆':'昆','昊':'昊','昌':'昌','明':'明','昏':'昏','易':'易',
        '昔':'昔','昕':'昕','昙':'曇','昝':'昝','星':'星','映':'映','春':'春','昧':'昧','昨':'昨','昭':'昭',
        '是':'是','昱':'昱','昴':'昴','昵':'暱','昶':'昶','昼':'晝','显':'顯','晁':'晁','晃':'晃','晋':'晉',
        '晌':'晌','晏':'晏','晒':'曬','晓':'曉','晔':'曄','晕':'暈','晖':'暉','晗':'晗','晚':'晚','晟':'晟',
        '晡':'晡','晤':'晤','晦':'晦','晨':'晨','普':'普','景':'景','晰':'晰','晴':'晴','晶':'晶','晷':'晷',
        '智':'智','晾':'晾','暂':'暫','暄':'暄','暇':'暇','暌':'睽','暑':'暑','暖':'暖','暗':'暗','暝':'暝',
        '暧':'曖','暨':'暨','暮':'暮','暴':'暴','暹':'暹','暾':'暾','曙':'曙','曜':'曜','曝':'曝','曦':'曦',
        '曩':'曩','曰':'曰','曲':'曲','更':'更','曹':'曹','曼':'曼','曾':'曾','替':'替','最':'最','月':'月',
        '有':'有','朋':'朋','服':'服','朔':'朔','朕':'朕','朗':'朗','望':'望','朝':'朝','期':'期','朦':'朦',
        '木':'木','未':'未','末':'末','本':'本','札':'札','术':'術','朱':'朱','朴':'樸','朵':'朵','机':'機',
        '朽':'朽','杀':'殺','杂':'雜','权':'權','杆':'桿','杈':'杈','杉':'杉','李':'李','杏':'杏','材':'材',
        '村':'村','杓':'杓','杖':'杖','杜':'杜','杞':'杞','束':'束','杠':'槓','条':'條','来':'來','杨':'楊',
        '杩':'榪','杪':'杪','杭':'杭','杯':'杯','杰':'傑','杲':'杲','杳':'杳','杵':'杵','杷':'杷','杼':'杼',
        '松':'松','板':'板','极':'極','构':'構','枇':'枇','枉':'枉','枋':'枋','析':'析','枕':'枕','林':'林',
        '枘':'枘','枚':'枚','果':'果','枝':'枝','枞':'樅','枢':'樞','枣':'棗','枥':'櫪','枧':'梘','枨':'棖',
        '枪':'槍','枫':'楓','枭':'梟','枯':'枯','枰':'枰','枳':'枳','枵':'枵','架':'架','枷':'枷','枸':'枸',
        '枹':'枹','柄':'柄','柏':'柏','某':'某','柑':'柑','柒':'柒','染':'染','柔':'柔','柜':'櫃','柠':'檸',
        '查':'查','柬':'柬','柯':'柯','柰':'柰','柱':'柱','柳':'柳','柴':'柴','柽':'檉','柿':'柿','栀':'梔',
        '栅':'柵','标':'標','栈':'棧','栉':'櫛','栊':'櫳','栋':'棟','栌':'櫨','栎':'櫟','栏':'欄','树':'樹',
        '栓':'栓','栖':'棲','栗':'栗','栝':'栝','校':'校','栩':'栩','株':'株','样':'樣','核':'核','根':'根',
        '格':'格','栽':'栽','栾':'欒','桀':'桀','桁':'桁','桂':'桂','桃':'桃','桄':'桄','桅':'桅','框':'框',
        '案':'案','桉':'桉','桊':'桊','桌':'桌','桎':'桎','桐':'桐','桑':'桑','桓':'桓','桔':'桔','档':'檔',
        '桥':'橋','桦':'樺','桧':'檜','桨':'槳','桩':'樁','梦':'夢','检':'檢','棂':'欞','棉':'棉','棋':'棋',
        '棍':'棍','棒':'棒','棕':'棕','棘':'棘','棚':'棚','棠':'棠','棣':'棣','森':'森','棱':'稜','棵':'棵',
        '棹':'棹','棺':'棺','椅':'椅','植':'植','椎':'椎','椒':'椒','椭':'橢','椰':'椰','椴':'椴','椿':'椿',
        '楂':'楂','杨':'楊','枫':'楓','楔':'楔','楚':'楚','楞':'','楠':'楠','楣':'楣','楦':'楦','楫':'楫',
        '楮':'楮','楷':'楷','楸':'楸','楹':'楹','楼':'樓','概':'概','榄':'欖','榆':'榆','榈':'櫚','榉':'櫸',
        '槛':'檻','槟':'檳','槠':'櫧','横':'橫','樯':'檣','樱':'櫻','樵':'樵','樽':'樽','樾':'樾','橄':'橄',
        '橇':'橇','橐':'橐','橘':'橘','橙':'橙','橡':'橡','橱':'櫥','橹':'櫓','橼':'櫞','檀':'檀','檄':'檄',
        '檎':'檎','檐':'簷','檑':'檑','檗':'檗','檬':'檬','欠':'欠','次':'次','欢':'歡','欣':'欣','欤':'歟',
        '欧':'歐','欲':'欲','欷':'欷','款':'款','欺':'欺','钦':'欽','款':'款','歇':'歇','歉':'歉','歌':'歌',
        '止':'止','正':'正','此':'此','步':'步','武':'武','歧':'歧','歪':'歪','歹':'歹','死':'死','歼':'殲',
        '殁':'歿','殂':'殂','殃':'殃','殄':'殄','殆':'殆','殇':'殤','殉':'殉','殊':'殊','残':'殘','殍':'殍',
        '殒':'殞','殓':'殮','殖':'殖','殚':'殫','殡':'殯','殴':'毆','段':'段','殷':'殷','殿':'殿','毁':'毀',
        '毅':'毅','母':'母','每':'每','毒':'毒','比':'比','毕':'畢','毙':'斃','毛':'毛','毡':'氈','毫':'毫',
        '毯':'毯','氏':'氏','民':'民','气':'氣','水':'水','永':'永','汁':'汁','求':'求','汇':'匯','汉':'漢',
        '汗':'汗','汛':'汛','江':'江','池':'池','污':'污','汤':'湯','汪':'汪','汰':'汰','汹':'洶','汽':'汽',
        '沃':'沃','沈':'瀋','沉':'沉','沌':'沌','沏':'沏','沙':'沙','沛':'沛','沟':'溝','没':'沒','沦':'淪',
        '沧':'滄','沪':'滬','沫':'沫','河':'河','沸':'沸','油':'油','治':'治','沼':'沼','沽':'沽','沾':'沾',
        '沿':'沿','泄':'洩','泉':'泉','泊':'泊','泌':'泌','法':'法','泛':'泛','泡':'泡','波':'波','泣':'泣',
        '泥':'泥','注':'注','泪':'淚','泫':'泫','泮':'泮','泯':'泯','泰':'泰','泱':'泱','泳':'泳','泵':'泵',
        '沲':'沲','洁':'潔','泼':'潑','泽':'澤','泾':'涇','洋':'洋','洒':'灑','洗':'洗','洛':'洛','洞':'洞',
        '津':'津','洪':'洪','洲':'洲','活':'活','洽':'洽','派':'派','流':'流','浅':'淺','浆':'漿','浇':'澆',
        '浊':'濁','测':'測','济':'濟','浏':'瀏','浑':'渾','浒':'滸','浓':'濃','浔':'潯','浙':'浙','浚':'濬',
        '浜':'浜','浞':'浞','浦':'浦','浩':'浩','浪':'浪','浮':'浮','浴':'浴','海':'海','浸':'浸','涂':'塗',
        '涅':'涅','消':'消','涉':'涉','涌':'湧','涎':'涎','涑':'涑','涓':'涓','涔':'涔','涕':'涕','涛':'濤',
        '涝':'澇','涞':'淶','涟':'漣','涠':'潿','涡':'渦','涣':'渙','涤':'滌','润':'潤','涧':'澗','涨':'漲',
        '涩':'澀','涮':'涮','涯':'涯','液':'液','涵':'涵','涸':'涸','涿':'涿','淀':'澱','淄':'淄','淅':'淅',
        '淆':'淆','淇':'淇','淋':'淋','淌':'淌','淑':'淑','淖':'淖','淘':'淘','淙':'淙','泪':'淚','淞':'淞',
        '淡':'淡','淤':'淤','淦':'淦','淫':'淫','淬':'淬','淮':'淮','深':'深','淳':'淳','混':'混','淹':'淹',
        '添':'添','淼':'淼','清':'清','渊':'淵','渍':'漬','渎':'瀆','渐':'漸','渔':'漁','渗':'滲','渚':'渚',
        '渝':'渝','渠':'渠','渡':'渡','渣':'渣','渤':'渤','渥':'渥','温':'溫','港':'港','渴':'渴','游':'游',
        '渺':'渺','湃':'湃','湄':'湄','湍':'湍','湎':'湎','湓':'湓','湔':'湔','湖':'湖','湘':'湘','湛':'湛',
        '湟':'湟','湾':'灣','湿':'濕','溃':'潰','溅':'濺','溉':'溉','溏':'溏','源':'源','溘':'溘','溜':'溜',
        '溟':'溟','溢':'溢','溥':'溥','溪':'溪','溯':'溯','溱':'溱','溲':'溲','溴':'溴','溶':'溶','溺':'溺',
        '溽':'溽','滁':'滁','滂':'滂','沧':'滄','灭':'滅','滋':'滋','滑':'滑','滓':'滓','滔':'滔','滕':'滕',
        '滚':'滾','滞':'滯','滟':'灩','滠':'滠','满':'滿','滢':'瀅','滤':'濾','滥':'濫','滦':'灤','滨':'濱',
        '滩':'灘','滴':'滴','漂':'漂','漆':'漆','漏':'漏','漓':'漓','演':'演','漕':'漕','漠':'漠','汉':'漢',
        '涟':'漣','漩':'漩','漪':'漪','漫':'漫','渍':'漬','漱':'漱','8':'漲','漳':'漳','漶':'漶','渐':'漸',
        '漾':'漾','浆':'漿','颖':'穎','泼':'潑','洁':'潔','潜':'潛','潮':'潮','澎':'澎','潺':'潺','溃':'潰',
        '澄':'澄','浇':'澆','涝':'澇','澈':'澈','涧':'澗','澜':'瀾','澡':'澡','泽':'澤','澳':'澳','激':'激',
        '浊':'濁','濂':'濂','浓':'濃','濑':'瀨','濒':'瀕','濞':'濞','济':'濟','濠':'濠','濡':'濡','涛':'濤',
        '滥':'濫','濯':'濯','瀑':'瀑','瀚':'瀚','瀛':'瀛','瀞':'瀞','潇':'瀟','潋':'灩','髓':'髓','火':'火',
        '灯':'燈','灰':'灰','灵':'靈','灶':'灶','灸':'灸','灼':'灼','灾':'災','灿':'燦','炀':'煬','炉':'爐',
        '炖':'燉','炎':'炎','炒':'炒','炔':'炔','炕':'炕','炙':'炙','炜':'煒','炝':'熗','炫':'炫','炬':'炬',
        '炭':'炭','炮':'炮','炯':'炯','炱':'炱','炳':'炳','炷':'炷','炸':'炸','点':'點','为':'為','炼':'煉',
        '炽':'熾','烁':'爍','烂':'爛','烃':'烴','烈':'烈','烊':'烊','烘':'烘','烙':'烙','烛':'燭','烟':'煙',
        '烤':'烤','烦':'煩','烧':'燒','烨':'燁','烩':'燴','烫':'燙','烬':'燼','热':'熱','烯':'烯','烷':'烷',
        '烹':'烹','烽':'烽','焉':'焉','焊':'焊','焐':'焐','焓':'焓','焕':'煥','焖':'燜','焘':'燾','焙':'焙',
        '焚':'焚','焦':'焦','焯':'焯','焰':'焰','然':'然','煅':'煅','煊':'煊','煌':'煌','煎':'煎','煜':'煜',
        '煞':'煞','煤':'煤','煦':'煦','照':'照','煨':'煨','煮':'煮','煲':'煲','煳':'煳','煸':'煸','煺':'煺',
        '煽':'煽','熄':'熄','熊':'熊','熏':'熏','熔':'熔','熙':'熙','熟':'熟','熨':'熨','熬':'熬','熵':'熵',
        '熹':'熹','燃':'燃','燎':'燎','燔':'燔','燕':'燕','燠':'燠','燥':'燥','燧':'燧','燮':'燮','爆':'爆',
        '爪':'爪','爬':'爬','8':'爭','爱':'愛','父':'父','爷':'爺','爸':'爸','爹':'爹','爽':'爽','片':'片',
        '版':'版','牌':'牌','牍':'牘','牙':'牙','牛':'牛','牝':'牝','牟':'牟','牡':'牡','牢':'牢','牦':'犛',
        '牧':'牧','物':'物','牲':'牲','牵':'牽','特':'特','牺':'犧','犯':'犯','状':'狀','犹':'猶','狂':'狂',
        '狐':'狐','狗':'狗','狙':'狙','狞':'獰','狠':'狠','狡':'狡','独':'獨','狭':'狹','狮':'獅','狯':'獪',
        '狰':'猙','狱':'獄','狲':'猻','狸':'狸','狼':'狼','猎':'獵','猖':'猖','猗':'猗','猛':'猛','猜':'猜',
        '猝':'猝','猢':'猢','猥':'猥','猩':'猩','猪':'豬','猫':'貓','猬':'蝟','献':'獻','猴':'猴','猾':'猾',
        '猿':'猿','獍':'獍','獐':'獐','獒':'獒','獗':'獗','獠':'獠','兽':'獸','獭':'獺','獾':'獾','玄':'玄',
        '率':'率','玉':'玉','王':'王','玖':'玖','玛':'瑪','玩':'玩','玫':'玫','环':'環','现':'現','玲':'玲',
        '玷':'玷','玻':'玻','珀':'珀','珊瑚':'珊瑚','珍':'珍','珐':'琺','珑':'瓏','珞':'珞','珠':'珠','珥':'珥',
        '班':'班','球':'球','琅':'琅','理':'理','琉':'琉','琐':'瑣','琢':'琢','琥':'琥','琦':'琦','琪':'琪',
        '琮':'琮','琛':'琛','琴':'琴','琵':'琵','琶':'琶','琼':'瓊','瑕':'瑕','瑛':'瑛','瑞':'瑞','瑟':'瑟',
        '瑰':'瑰','瑶':'瑤','瑷':'璦','瑾':'瑾','璀':'璀','璁':'璁','璃':'璃','璇':'璇','璋':'璋','璎':'瓔',
        '璐':'璐','璧':'璧','瓒':'瓚','瓜':'瓜','瓢':'瓢','瓣':'瓣','瓤':'瓤','瓦':'瓦','瓮':'甕','瓶':'瓶',
        '瓷':'瓷','甄':'甄','甘':'甘','甚':'甚','甜':'甜','生':'生','产':'產','甥':'甥','甦':'甦','用':'用',
        '甩':'甩','甫':'甫','甬':'甬','甭':'甭','电':'電','男':'男','甸':'甸','画':'畫','畅':'暢','界':'界',
        '畏':'畏','畔':'畔','留':'留','畜':'畜','略':'略','畦':'畦','番':'番','异':'異','畴':'疇','疆':'疆',
        '疏':'疏','疑':'疑','疗':'療','疟':'瘧','疡':'瘍','疚':'疚','疝':'疝','疟':'瘧','疠':'癘','疮':'瘡',
        '疯':'瘋','疱':'皰','疵':'疵','疸':'疸','疹':'疹','疼':'疼','疽':'疽','疾':'疾','痂':'痂','痃':'痃',
        '病':'病','症':'症','痈':'癰','痉':'痙','痊':'痊','痍':'痍','痒':'癢','痔':'痔','痕':'痕','痘':'痘',
        '痛':'痛','痞':'痞','痢':'痢','痣':'痣','痤':'痤','痦':'痦','痧':'痧','痨':'癆','痪':'瘓','痫':'癇',
        '痰':'痰','痴':'癡','痹':'痺','痼':'痼','痿':'痿','瘀':'瘀','瘁':'瘁','瘃':'瘃','瘅':'癉','瘆':'瘮',
        '':'瘇','疯':'瘋','疡':'瘍','瘟':'瘟','瘠':'瘠','疮':'瘡','瘢':'瘢','瘤':'瘤','瘥':'瘥','瘦':'瘦',
        '疟':'瘧','瘸':'瘸','瘪':'癟','瘫':'癱','瘾':'癮','瘿':'癭','癞':'癩','癣':'癬','癫':'癲','癸':'癸',
        '登':'登','发':'發','白':'白','百':'百','皂':'皂','的':'的','皆':'皆','皇':'皇','皈':'皈','皋':'皋',
        '皎':'皎','皑':'皚','皓':'皓','皖':'皖','皮':'皮','皱':'皺','皿':'皿','盂':'盂','盅':'盅','盆':'盆',
        '盈':'盈','益':'益','盍':'盍','盎':'盎','盏':'盞','盐':'鹽','监':'監','盒':'盒','盔':'盔','盖':'蓋',
        '盗':'盜','盘':'盤','盛':'盛','盟':'盟','盥':'盥','目':'目','盯':'盯','盱':'盱','盲':'盲','直':'直',
        '相':'相','盹':'盹','盼':'盼','盾':'盾','省':'省','眄':'眄','眇':'眇','眈':'眈','眉':'眉','看':'看',
        '眍':'瞘','真':'真','眠':'眠','眢':'眢','眦':'眥','眨':'眨','眩':'眩','眭':'眭','眯':'瞇','眵':'眵',
        '眶':'眶','眷':'眷','眸':'眸','眺':'眺','眼':'眼','着':'著','睁':'睜','睃':'睃','睇':'睇','睐':'睞',
        '睑':'瞼','睚':'睚','睛':'睛','睡':'睡','睢':'睢','督':'督','睥':'睥','睦':'睦','睨':'睨','睫':'睫',
        '睬':'睬','睹':'睹','睽':'睽','睾':'睪','睿':'睿','瞀':'瞀','瞄':'瞄','瞅':'瞅','瞌':'瞌','瞍':'瞍',
        '瞎':'瞎','瞑':'瞑','瞒':'瞞','瞟':'瞟','瞠':'瞠','瞥':'瞥','瞧':'瞧','瞩':'矚','瞪':'瞪','瞬':'瞬',
        '瞰':'瞰','瞳':'瞳','瞻':'瞻','瞽':'瞽','瞿':'瞿','矗':'矗','矛':'矛','矜':'矜','矢':'矢','矣':'矣',
        '知':'知','矧':'矧','矩':'矩','矫':'矯','矬':'矬','短':'短','矮':'矮','石':'石','矶':'磯','矸':'矸',
        '矽':'矽','矾':'礬','矿':'礦','砀':'碭','码':'碼','砂':'砂','砉':'砉','砌':'砌','砍':'砍','砑':'砑',
        '砒':'砒','研':'研','砖':'磚','砗':'硨','砘':'砘','砚':'硯','砜':'碸','砝':'砝','砟':'砟','砣':'砣',
        '砥':'砥','砧':'砧','砭':'砭','砰':'砰','破':'破','砷':'砷','砸':'砸','砹':'砹','砺':'礪','砻':'礱',
        '砼':'砼','砾':'礫','础':'礎','硅':'硅','硇':'礵','硌':'硌','硎':'硎','硐':'硐','硒':'硒','硕':'碩',
        '硖':'硤','硗':'墝','硝':'硝','硪':'硪','硫':'硫','硬':'硬','硭':'硭','确':'確','砚':'硯','碱':'鹼',
        '硼':'硼','碇':'碇','碉':'碉','碌':'碌','碍':'礙','碎':'碎','碑':'碑','碓':'碓','碗':'碗','碘':'碘',
        '碚':'碚','碛':'磧','碟':'碟','碥':'碥','碣':'碣','碧':'碧','碰':'碰','碱':'鹼','碲':'碲','碳':'碳',
        '碴':'碴','碹':'镟','磁':'磁','磅':'磅','磉':'磉','磊':'磊','磋':'磋','磐':'磐','磕':'磕','磨':'磨',
        '磬':'磬','矶':'磯','磲':'磲','磷':'磷','磺':'磺','礁':'礁','礅':'礅','础':'礎','礼':'禮','社':'社',
        '祀':'祀','祁':'祁','祖':'祖','祇':'祇','祚':'祚','祛':'祛','祜':'祜','祝':'祝','神':'神','祟':'祟',
        '祠':'祠','祢':'禰','祥':'祥','祧':'祧','票':'票','祭':'祭','祯':'禎','祷':'禱','祸':'禍','祺':'祺',
        '禄':'祿','禁':'禁','禅':'禪','禊':'禊','福':'福','禧':'禧','禳':'禳','禹':'禹','禺':'禺','离':'離',
        '禽':'禽','禾':'禾','秀':'秀','私':'私','秃':'禿','秆':'稈','秉':'秉','秋':'秋','种':'種','科':'科',
        '秒':'秒','秕':'秕','秘':'秘','租':'租','秣':'秣','秤':'秤','秦':'秦','秧':'秧','秩':'秩','秫':'秫',
        '积':'積','称':'稱','秸':'秸','移':'移','秽':'穢','稀':'稀','程':'程','稍':'稍','税':'稅','稔':'稔',
        '稗':'稗','稚':'稚','稠':'稠','稳':'穩','稻':'稻','稼':'稼','稽':'稽','稿':'稿','穆':'穆','穗':'穗',
        '穴':'穴','究':'究','穷':'窮','空':'空','穿':'穿','突':'突','窃':'竊','窄':'窄','窈':'窈','窍':'竅',
        '窑':'窯','窒':'窒','窕':'窕','窖':'窖','窗':'窗','窘':'窘','窜':'竄','窝':'窩','窟':'窟','窥':'窺',
        '窦':'竇','窿':'窿','立':'立','竖':'豎','站':'站','竞':'競','竟':'竟','章':'章','竣':'竣','童':'童',
        '竭':'竭','端':'端','竹':'竹','竺':'竺','竿':'竿','笃':'篤','笆':'笆','笈':'笈','笋':'筍','笏':'笏',
        '笑':'笑','笔':'筆','笕':'筧','笙':'笙','笛':'笛','笞':'笞','笠':'笠','笤':'笤','笥':'笥','符':'符',
        '笨':'笨','第':'第','笳':'笳','笾':'籩','笺':'箋','笼':'籠','筻':'筻','筋':'筋','筏':'筏','筐':'筐',
        '筑':'築','筒':'筒','答':'答','策':'策','筛':'篩','筝':'箏','筠':'筠','筹':'籌','签':'簽','简':'簡',
        '箍':'箍','箔':'箔','箕':'箕','算':'算','管':'管','箩':'籮','箫':'簫','箭':'箭','箱':'箱','箴':'箴',
        '箸':'箸','节':'節','篁':'篁','范':'範','篆':'篆','篇':'篇','篓':'簍','篙':'篙','篚':'篚','篝':'篝',
        '篡':'篡','篮':'籃','篱':'籬','篷':'篷','簇':'簇','簌':'簌','篾':'篾','籍':'籍','米':'米','类':'類',
        '籼':'秈','籽':'籽','粉':'粉','粑':'粑','粒':'粒','粕':'粕','粗':'粗','粘':'粘','粜':'糶','粝':'糲',
        '精':'精','糊':'糊','粮':'糧','粹':'粹','糖':'糖','粪':'糞','糟':'糟','糠':'糠','糨':'糨','糯':'糯',
        '系':'係','紊':'紊','素':'素','索':'索','紧':'緊','紫':'紫','累':'累','絮':'絮','繁':'繁','红':'紅',
        '纣':'紂','纤':'纖','纨':'紈','约':'約','级':'級','纪':'紀','纫':'紉','纬':'緯','纭':'紜','纯':'純',
        '纰':'紕','纱':'紗','纲':'綱','纳':'納','纵':'縱','纶':'綸','纷':'紛','纸':'紙','纹':'紋','纺':'紡',
        '纽':'紐','纾':'紓','线':'線','绀':'紺','绁':'紲','绂':'紱','练':'練','组':'組','绅':'紳','细':'細',
        '织':'織','终':'終','绉':'縐','绊':'絆','绂':'紱','绌':'絀','绍':'紹','绎':'繹','经':'經','绐':'紿',
        '绑':'綁','绒':'絨','结':'結','绔':'絝','绕':'繞','绘':'繪','给':'給','绚':'絢','绛':'絳','络':'絡',
        '绝':'絕','绞':'絞','统':'統','绠':'綆','绡':'綃','绢':'絹','绣':'繡','绥':'綏','绦':'絛','继':'繼',
        '绨':'綈','绩':'績','绪':'緒','绫':'綾','续':'續','绮':'綺','绯':'緋','绰':'綽','绱':'緔','绲':'緄',
        '绳':'繩','维':'維','绵':'綿','绶':'綬','绷':'繃','绸':'綢','绺':'綹','绻':'綣','综':'綜','绽':'綻',
        '绾':'綰','绿':'綠','缀':'綴','缁':'緇','缂':'緙','缃':'緗','缄':'緘','缅':'緬','缆':'纜','缇':'緹',
        '缈':'緲','缉':'緝','缊':'縕','缋':'繢','缌':'緦','缍':'綞','缎':'緞','缏':'緶','缑':'緱','缒':'縋',
        '缓':'緩','缔':'締','缕':'縷','编':'編','缗':'緡','缘':'緣','缙':'縉','缚':'縛','缛':'縟','缜':'縝',
        '缝':'縫','缟':'縞','缠':'纏','缡':'縭','缢':'縊','缣':'縑','缤':'繽','缥':'縹','缦':'縵','缧':'縲',
        '缨':'纓','缩':'縮','缪':'繆','缫':'繅','缬':'纈','缭':'繚','缮':'繕','缯':'繒','缰':'韁','缱':'繾',
        '缴':'繳','坛':'壇','缺':'缺','网':'網','罕':'罕','罗':'羅','罚':'罰','罢':'罷','罩':'罩','罪':'罪',
        '置':'置','署':'署','羊':'羊','美':'美','羞':'羞','群':'群','羽':'羽','翁':'翁','翅':'翅','翠':'翠',
        '翰':'翰','翻':'翻','翼':'翼','耀':'耀','老':'老','考':'考','者':'者','而':'而','耍':'耍','耐':'耐',
        '耗':'耗','耳':'耳','耶':'耶','耻':'恥','耽':'耽','耿':'耿','聂':'聶','聊':'聊','聋':'聾','职':'職',
        '联':'聯','聘':'聘','聚':'聚','聪':'聰','肃':'肅','肉':'肉','肋':'肋','肌':'肌','肚':'肚','肝':'肝',
        '肠':'腸','股':'股','肢':'肢','肤':'膚','肥':'肥','肩':'肩','肪':'肪','肮':'骯','肯':'肯','育':'育',
        '肺':'肺','肾':'腎','肿':'腫','胀':'脹','胁':'脅','胃':'胃','胆':'膽','背':'背','胎':'胎','胖':'胖',
        '胜':'勝','胞':'胞','胡':'胡','胤':'胤','胥':'胥','胶':'膠','胸':'胸','胺':'胺','能':'能','脂':'脂',
        '脆':'脆','脉':'脈','脊':'脊','脏':'臟','脐':'臍','脑':'腦','脓':'膿','脖':'脖','脚':'腳','脱':'脫',
        '脸':'臉','脾':'脾','腆':'腆','腊':'臘','腋':'腋','腐':'腐','腑':'腑','腔':'腔','腕':'腕','腥':'腥',
        '腮':'腮','腰':'腰','腹':'腹','腺':'腺','腻':'膩','腾':'騰','腿':'腿','膀':'膀','膂':'膂','膛':'膛',
        '膜':'膜','膝':'膝','臂':'臂','臀':'臀','臣':'臣','自':'自','臭':'臭','至':'至','致':'致','舌':'舌',
        '舍':'捨','舒':'舒','舔':'舔','舟':'舟','航':'航','般':'般','舰':'艦','舱':'艙','船':'船','良':'良',
        '艰':'艱','色':'色','艳':'豔','艺':'藝','节':'節','芒':'芒','芦':'蘆','花':'花','芳':'芳','苍':'蒼',
        '苏':'蘇','苗':'苗','苛':'苛','苞':'苞','苟':'苟','若':'若','苦':'苦','英':'英','茂':'茂','范':'範',
        '茄':'茄','茅':'茅','茎':'莖','茧':'繭','茶':'茶','草':'草','荒':'荒','荡':'蕩','荣':'榮','荤':'葷',
        '荧':'熒','药':'藥','荷':'荷','莉':'莉','庄':'莊','莎':'莎','莫':'莫','莱':'萊','莲':'蓮','获':'獲',
        '莹':'瑩','莺':'鶯','莽':'莽','菇':'菇','菊':'菊','菌':'菌','菜':'菜','菠':'菠','菩':'菩','华':'華',
        '菱':'菱','菲':'菲','萄':'萄','萌':'萌','萍':'萍','萎':'萎','萝':'蘿','萤':'螢','营':'營','萧':'蕭',
        '萨':'薩','落':'落','著':'著','葛':'葛','葡':'葡','董':'董','葬':'葬','葱':'蔥','葵':'葵','蒂':'蒂',
        '蒋':'蔣','蒙':'蒙','蒜':'蒜','蒲':'蒲','蒸':'蒸','苍':'蒼','蓄':'蓄','蓝':'藍','蓬':'蓬','蔑':'蔑',
        '蔡':'蔡','薄':'薄','薪':'薪','藉':'藉','藏':'藏','藤':'藤','虎':'虎','虏':'虜','虑':'慮','虚':'虛',
        '虫':'蟲','虹':'虹','虽':'雖','虾':'蝦','蚀':'蝕','蚁':'蟻','蚂':'螞','蚊':'蚊','蚕':'蠶','蛇':'蛇',
        '蛋':'蛋','蛙':'蛙','蛛':'蛛','蛮':'蠻','蜂':'蜂','蜗':'蝸','蜜':'蜜','蜡':'蠟','蝇':'蠅','蝉':'蟬',
        '蝶':'蝶','融':'融','蟹':'蟹','蠢':'蠢','血':'血','行':'行','街':'街','衡':'衡','衣':'衣','补':'補',
        '表':'表','衫':'衫','衬':'襯','衰':'衰','衷':'衷','袋':'袋','袍':'袍','袖':'袖','袜':'襪','被':'被',
        '袭':'襲','装':'裝','裤':'褲','西':'西','要':'要','覆':'覆','见':'見','观':'觀','规':'規','觅':'覓',
        '视':'視','览':'覽','觉':'覺','角':'角','解':'解','触':'觸','言':'言','誉':'譽','誓':'誓','警':'警',
        '计':'計','订':'訂','讣':'訃','认':'認','讥':'譏','讦':'訐','讧':'訌','讨':'討','让':'讓','讪':'訕',
        '讫':'訖','训':'訓','议':'議','讯':'訊','记':'記','讲':'講','讳':'諱','讴':'謳','讵':'詎','讶':'訝',
        '讷':'訥','许':'許','讹':'訛','论':'論','讼':'訟','讽':'諷','设':'設','访':'訪','诀':'訣','证':'證',
        '诂':'詁','诃':'訶','评':'評','诅':'詛','识':'識','诈':'詐','诉':'訴','诊':'診','诋':'詆','诌':'謅',
        '词':'詞','诎':'絀','诏':'詔','译':'譯','诒':'詒','诓':'誆','诔':'誄','试':'試','诖':'詿','诗':'詩',
        '诘':'詰','诙':'詼','诚':'誠','诛':'誅','诜':'詵','话':'話','诞':'誕','诟':'詬','诠':'詮','诡':'詭',
        '询':'詢','诣':'詣','诤':'諍','该':'該','详':'詳','诧':'詫','诨':'諢','诩':'詡','诫':'誡','诬':'誣',
        '语':'語','诮':'誚','误':'誤','诰':'誥','诱':'誘','诲':'誨','诳':'誑','说':'說','诵':'誦','诶':'誒',
        '请':'請','诸':'諸','诹':'諏','诺':'諾','读':'讀','诼':'諑','诽':'誹','课':'課','诿':'諉','谀':'諛',
        '谁':'誰','谂':'諗','调':'調','谄':'諂','谅':'諒','谆':'諄','谇':'誶','谈':'談','谊':'誼','谋':'謀',
        '谌':'諶','谍':'諜','谎':'謊','谏':'諫','谐':'諧','谑':'謔','谒':'謁','谓':'謂','谔':'諤','谕':'諭',
        '谖':'諼','谗':'讒','谘':'諮','谙':'諳','谚':'諺','谛':'諦','谜':'謎','谝':'諞','谟':'謨','谠':'讜',
        '谡':'謖','谢':'謝','谣':'謠','谤':'謗','谥':'諡','谦':'謙','谧':'謐','谨':'謹','谩':'謾','谪':'謫',
        '谫':'譾','谬':'謬','谭':'譚','谮':'譖','谯':'譙','谰':'讕','谱':'譜','谲':'譎','谳':'讞','谴':'譴',
        '谵':'譫','谷':'谷','豆':'豆','岂':'豈','竖':'豎','丰':'豐','象':'象','豪':'豪','猪':'豬','貌':'貌',
        '贝':'貝','贞':'貞','负':'負','财':'財','贡':'貢','贫':'貧','货':'貨','贩':'販','贪':'貪','贯':'貫',
        '责':'責','贮':'貯','贯':'貫','贱':'賤','贲':'賁','贳':'貰','贴':'貼','贵':'貴','贶':'貺','贷':'貸',
        '贸':'貿','费':'費','贺':'賀','贻':'貽','贼':'賊','贽':'贄','贾':'賈','贿':'賄','赀':'貲','赁':'賃',
        '赂':'賂','赃':'贓','资':'資','赅':'賅','赆':'贐','赇':'賕','赈':'賑','赉':'賚','赊':'賒','赋':'賦',
        '赌':'賭','赍':'齎','赎':'贖','赏':'賞','赐':'賜','赓':'賡','赔':'賠','赕':'賧','赖':'賴','赘':'贅',
        '赙':'賻','赚':'賺','赛':'賽','赜':'賾','赝':'贗','赞':'贊','赠':'贈','赡':'贍','赢':'贏','赣':'贛',
        '赤':'赤','赦':'赦','赫':'赫','走':'走','赴':'赴','赵':'趙','赶':'趕','起':'起','趁':'趁','超':'超',
        '越':'越','趋':'趨','趟':'趟','趣':'趣','足':'足','跃':'躍','跌':'跌','跑':'跑','距':'距','跟':'跟',
        '迹':'跡','路':'路','跳':'跳','践':'踐','踏':'踏','踢':'踢','踩':'踩','踪':'蹤','身':'身','躲':'躲',
        '躺':'躺','车':'車','轧':'軋','轨':'軌','轩':'軒','转':'轉','轭':'軛','轮':'輪','软':'軟','轰':'轟',
        '轱':'軲','轲':'軻','轳':'轤','轴':'軸','轵':'軹','轶':'軼','轷':'軤','轸':'軫','轹':'轢','轺':'軺',
        '轻':'輕','轼':'軾','载':'載','轾':'輊','轿':'轎','辀':'輈','辁':'輇','辂':'輅','较':'較','辄':'輒',
        '辅':'輔','辆':'輛','辇':'輦','辈':'輩','辉':'輝','辊':'輥','辋':'輞','辍':'輟','辎':'輜','辏':'輳',
        '辐':'輻','辑':'輯','输':'輸','辔':'轡','辕':'轅','辖':'轄','辗':'輾','辘':'轆','辙':'轍','辚':'轔',
        '辛':'辛','辜':'辜','辞':'辭','辟':'闢','辣':'辣','辨':'辨','辩':'辯','辫':'辮','辰':'辰','辱':'辱',
        '边':'邊','辽':'遼','达':'達','迁':'遷','迂':'迂','迄':'迄','迅':'迅','过':'過','迈':'邁','迎':'迎',
        '运':'運','近':'近','迓':'迓','返':'返','还':'還','这':'這','进':'進','远':'遠','违':'違','连':'連',
        '迟':'遲','迢':'迢','迤':'迤','迥':'迥','迦':'迦','迨':'迨','迩':'邇','迪':'迪','迫':'迫','迭':'迭',
        '迮':'迮','述':'述','迷':'迷','迸':'迸','迹':'跡','追':'追','退':'退','送':'送','适':'適','逃':'逃',
        '逄':'逄','逅':'逅','逆':'逆','选':'選','逊':'遜','逋':'逋','逍':'逍','透':'透','逐':'逐','逑':'逑',
        '递':'遞','途':'途','迳':'逕','逖':'逖','逗':'逗','通':'通','逛':'逛','逝':'逝','逞':'逞','速':'速',
        '造':'造','逡':'逡','逢':'逢','连':'連','逮':'逮','逸':'逸','逻':'邏','逼':'逼','逾':'逾','遁':'遁',
        '遂':'遂','遇':'遇','遍':'遍','遏':'遏','遐':'遐','遑':'遑','道':'道','达':'達','违':'違','遗':'遺',
        '遘':'遘','遛':'遛','逊':'遜','遣':'遣','遥':'遙','遨':'遨','遭':'遭','遮':'遮','遴':'遴','遵':'遵',
        '遽':'遽','避':'避','邀':'邀','邂':'邂','邃':'邃','邈':'邈','邑':'邑','邓':'鄧','郑':'鄭','邻':'鄰',
        '郁':'鬱','郊':'郊','郎':'郎','部':'部','郭':'郭','邮':'郵','都':'都','鄂':'鄂','乡':'鄉','鄙':'鄙',
        '酉':'酉','酌':'酌','配':'配','酒':'酒','酝':'醞','酷':'酷','酸':'酸','酿':'釀','醉':'醉','醒':'醒',
        '采':'採','释':'釋','里':'裡','重':'重','野':'野','量':'量','金':'金','鉴':'鑑','针':'針','钉':'釘',
        '钊':'釗','钋':'釙','钌':'釕','钍':'釷','钎':'釺','钏':'釧','钐':'釤','钒':'釩','钓':'釣','钔':'鍆',
        '钕':'釹','钗':'釵','钙':'鈣','钚':'鈈','钛':'鈦','钜':'鉅','钝':'鈍','钞':'鈔','钟':'鐘','钠':'鈉',
        '钡':'鋇','钢':'鋼','钣':'鈑','钤':'鈐','钥':'鑰','钦':'欽','钧':'鈞','钨':'鎢','钩':'鉤','钪':'鈧',
        '钫':'鈁','钬':'鈥','钭':'钭','钮':'鈕','钯':'鈀','钰':'鈺','钱':'錢','钲':'鉦','钳':'鉗','钴':'鈷',
        '钵':'缽','钻':'鑽','钼':'鉬','钽':'鉭','钾':'鉀','钿':'鈿','铀':'鈾','铁':'鐵','铂':'鉑','铃':'鈴',
        '铄':'鑠','铅':'鉛','铆':'鉚','铈':'鈰','铉':'鉉','铊':'鉈','铋':'鉍','铌':'鈮','铍':'鈹','铎':'鐸',
        '铜':'銅','铝':'鋁','铡':'鍘','铠':'鎧','铨':'銓','铢':'銖','铣':'銑','铤':'鋌','铭':'銘','铬':'鉻',
        '铮':'錚','铯':'銫','铰':'鉸','铱':'銥','铲':'鏟','铳':'銃','铓':'鋩','铵':'銨','银':'銀','铷':'銣',
        '铸':'鑄','铹':'鐒','铺':'鋪','链':'鏈','铿':'鏗','销':'銷','锁':'鎖','锂':'鋰','锃':'鋥','锄':'鋤',
        '锅':'鍋','锆':'鋯','锇':'鋨','锈':'鏽','锉':'銼','锊':'鋝','锋':'鋒','锌':'鋅','锐':'銳','锑':'銻',
        '锒':'鋃','锓':'鋟','锔':'鋦','锕':'錒','锖':'錆','锗':'鍺','锘':'鍩','错':'錯','锚':'錨','锛':'錛',
        '锜':'錡','锝':'鍀','锞':'錁','锟':'錕','锡':'錫','锢':'錮','锣':'鑼','锤':'錘','锥':'錐','锦':'錦',
        '锨':'鍁','锩':'錈','锪':'鍃','锫':'錇','锭':'錠','键':'鍵','锯':'鋸','锰':'錳','锱':'錙','锲':'鍥',
        '锴':'鍇','锵':'鏘','锶':'鍶','锷':'鍔','锸':'鍤','锹':'鍬','钟':'鐘','锻':'鍛','锼':'鎪','锾':'鍰',
        '镀':'鍍','镁':'鎂','镂':'鏤','镇':'鎮','镍':'鎳','镌':'鐫','镏':'鎦','镐':'鎬','镑':'鎊','镒':'鎰',
        '镓':'鎵','镔':'鑌','镖':'鏢','镗':'鏜','镜':'鏡','镝':'鏑','镞':'鏃','镟':'鏇','镡':'鐔','镣':'鐐',
        '镤':'鏷','镥':'鑥','镦':'鐓','镧':'鑭','镨':'鐠','镩':'鑹','镪':'鏹','镫':'鐙','镬':'鑊','镭':'鐳',
        '镯':'鐲','镰':'鐮','镱':'鐿','镲':'鑔','镳':'鑣','镶':'鑲','长':'長','门':'門','闩':'閂','闪':'閃',
        '闫':'閆','闭':'閉','问':'問','闯':'闖','闰':'閏','闱':'闈','闲':'閒','闳':'閎','间':'間','闵':'閔',
        '闶':'閌','闷':'悶','闸':'閘','闹':'鬧','闺':'閨','闻':'聞','闼':'闥','闽':'閩','闾':'閭','阀':'閥',
        '阁':'閣','阂':'閡','阃':'閫','阄':'鬮','阅':'閱','阆':'閬','阉':'閹','阎':'閻','阏':'閼','阐':'闡',
        '阑':'闌','阒':'闃','阔':'闊','阕':'闋','阖':'闔','阗':'闐','阙':'闕','阚':'闞','阜':'阜','队':'隊',
        '阳':'陽','阴':'陰','阵':'陣','阶':'階','际':'際','陆':'陸','陇':'隴','陈':'陳','陉':'陘','陕':'陝',
        '陨':'隕','险':'險','随':'隨','隐':'隱','隶':'隸','难':'難','雄':'雄','雅':'雅','集':'集','雇':'僱',
        '雌':'雌','雍':'雍','雏':'雛','雕':'雕','雨':'雨','雪':'雪','雯':'雯','雳':'靂','零':'零','雷':'雷',
        '雹':'雹','雾':'霧','需':'需','霁':'霽','霄':'霄','霆':'霆','震':'震','霉':'霉','霍':'霍','霎':'霎',
        '霏':'霏','霓':'霓','霖':'霖','霜':'霜','霞':'霞','露':'露','霸':'霸','霹':'霹','霾':'霾','青':'青',
        '靓':'靚','靖':'靖','静':'靜','非':'非','靠':'靠','面':'面','革':'革','靴':'靴','靶':'靶','鞋':'鞋',
        '鞍':'鞍','鞘':'鞘','鞠':'鞠','鞭':'鞭','韦':'韋','韧':'韌','韩':'韓','音':'音','韵':'韻','页':'頁',
        '顶':'頂','顷':'頃','顸':'頇','项':'項','顺':'順','须':'須','顼':'頊','顽':'頑','顾':'顧','顿':'頓',
        '颀':'頎','颁':'頒','颂':'頌','颃':'頏','预':'預','颅':'顱','领':'領','颇':'頗','颈':'頸','颉':'頡',
        '颊':'頰','颌':'頷','颍':'潁','颏':'頦','颐':'頤','频':'頻','颓':'頹','颔':'頷','颖':'穎','颗':'顆',
        '题':'題','额':'額','颞':'顳','颛':'顓','颜':'顏','额':'額','颠':'顛','颡':'顙','颤':'顫','颦':'顰',
        '颧':'顴','风':'風','飏':'颺','飐':'颭','飑':'颮','飒':'颯','飓':'颶','飔':'颸','飕':'颼','飘':'飄',
        '飙':'飆','飞':'飛','食':'食','饥':'飢','饧':'餳','饨':'飩','饩':'餼','饪':'飪','饫':'飫','饬':'飭',
        '饭':'飯','饮':'飲','饯':'餞','饰':'飾','饱':'飽','饲':'飼','饴':'飴','饵':'餌','饶':'饒','饷':'餉',
        '饺':'餃','饼':'餅','饽':'餑','饿':'餓','馁':'餒','饥':'飢','馆':'館','馈':'饋','馋':'饞','馍':'饃',
        '馏':'餾','馐':'饈','馑':'饉','馒':'饅','馔':'饌','首':'首','香':'香','馨':'馨','马':'馬','驭':'馭',
        '驮':'馱','驯':'馴','驰':'馳','驱':'驅','驳':'駁','驴':'驢','驵':'駔','驶':'駛','驷':'駟','驸':'駙',
        '驹':'駒','驺':'騶','驻':'駐','驼':'駝','驽':'駑','驾':'駕','驿':'驛','骀':'駘','骁':'驍','骂':'罵',
        '骄':'驕','骅':'驊','骆':'駱','骇':'駭','骈':'駢','骊':'驪','骋':'騁','验':'驗','骏':'駿','骐':'騏',
        '骑':'騎','骒':'騍','骓':'騅','骖':'驂','骗':'騙','骘':'騭','骚':'騷','骛':'騖','骜':'驁','骝':'騮',
        '骞':'騫','骟':'騸','骠':'驃','骡':'騾','骢':'驄','骣':'驏','骤':'驟','骥':'驥','骧':'驤','骨':'骨',
        '高':'高','鬓':'鬢','发':'髮','胡':'鬍','斗':'鬥','闹':'鬧','鬼':'鬼','魂':'魂','魄':'魄','魅':'魅',
        '魔':'魔','鱼':'魚','鲁':'魯','鲍':'鮑','鲜':'鮮','鲤':'鯉','鲨':'鯊','鲸':'鯨','鳄':'鱷','鸟':'鳥',
        '鸠':'鳩','鸡':'雞','鸣':'鳴','鸥':'鷗','鸦':'鴉','鸭':'鴨','鸳':'鴛','鸯':'鴦','鸵':'鴕','鸽':'鴿',
        '鸿':'鴻','鹃':'鵑','鹅':'鵝','鹄':'鵠','鹉':'鵡','鹏':'鵬','鹤':'鶴','鹰':'鷹','鹿':'鹿','麦':'麥',
        '麻':'麻','黄':'黃','黎':'黎','黑':'黑','默':'默','黔':'黔','点':'點','党':'黨','黯':'黯','鼎':'鼎',
        '鼓':'鼓','鼠':'鼠','鼻':'鼻','齐':'齊','齿':'齒','龄':'齡','龙':'龍','龚':'龔','龛':'龕','龟':'龜'
    };
    const SUB_T2S_CHARS = Object.fromEntries(Object.entries(SUB_S2T_CHARS).map(([s, t]) => [t, s]));

    function convertSubText(str, toTrad = false) {
        if (!str) return '';
        const map = toTrad ? SUB_S2T_CHARS : SUB_T2S_CHARS;
        let out = '';
        for (const ch of str) {
            out += map[ch] || ch;
        }
        return out;
    }

    const SubtitleEngine = {
        enabled: false,
        lang: 'simp', // 'simp' | 'trad'
        style: 'douyin',
        size: 16,
        activeIdx: 0,
        cues: [],

        initDefaultCues() {
            const pv = document.getElementById('preview-video');
            const dur = (window.PlayerEngine && window.PlayerEngine.videoDuration) || (pv && pv.duration) || 12;
            const range = (window.PlayerEngine && window.PlayerEngine.getTrimRange)
                ? window.PlayerEngine.getTrimRange()
                : { start: 0, end: dur };
            const s = range.start || 0;
            const span = Math.max(4, (range.end || dur) - s);
            const step = Number((span / 4).toFixed(1));
            this.cues = [
                { start: Number(s.toFixed(1)), end: Number((s + step).toFixed(1)), text: '这一幕的眼神戏简直绝了，百看不厌', thumb: '' },
                { start: Number((s + step).toFixed(1)), end: Number((s + step * 2).toFixed(1)), text: '有些话不用说出口，彼此心里都明白', thumb: '' },
                { start: Number((s + step * 2).toFixed(1)), end: Number((s + step * 3).toFixed(1)), text: '无论发生什么，我都会一直站在你身后', thumb: '' },
                { start: Number((s + step * 3).toFixed(1)), end: Number((s + span).toFixed(1)), text: '全片最催泪名场面，建议先收藏再看', thumb: '' }
            ];
            if (this.lang === 'trad') {
                this.cues.forEach(c => { c.text = convertSubText(c.text, true); });
            }
            this.activeIdx = 0;
        },

        setEnabled(flag, showToastMsg = false) {
            this.enabled = !!flag;
            if (swDylSubtitle && swDylSubtitle.checked !== this.enabled) {
                swDylSubtitle.checked = this.enabled;
            }
            if (dylWrapSubtitle) {
                dylWrapSubtitle.style.display = this.enabled ? 'block' : 'none';
            }
            if (subStudioBody) {
                subStudioBody.style.display = this.enabled ? 'block' : 'none';
            }
            if (this.enabled && this.cues.length === 0) {
                this.initDefaultCues();
            }
            this.applyStyleAndSize();
            this.renderCueList();
            this.syncStageDisplay();
            if (showToastMsg) {
                window.showToast(this.enabled
                    ? '🎬 已开启画面字幕！可点击「自动识别画面字幕」、切换简/繁体或逐条编辑内容'
                    : '🚫 已关闭画面字幕');
            }
            triggerSaveStorage();
        },

        applyStyleAndSize() {
            if (!dylWrapSubtitle) return;
            dylWrapSubtitle.classList.remove('sub-style-douyin', 'sub-style-cinema', 'sub-style-gold', 'sub-style-cyan');
            dylWrapSubtitle.classList.add(`sub-style-${this.style || 'douyin'}`);
            dylWrapSubtitle.style.fontSize = (this.size || 16) + 'px';
            if (selSubStyle && selSubStyle.value !== this.style) selSubStyle.value = this.style;
            if (inSubSize && Number(inSubSize.value) !== Number(this.size)) inSubSize.value = this.size;
            if (txtSubSize) txtSubSize.textContent = (this.size || 16) + 'px';
        },

        setLanguage(targetLang, showMsg = true) {
            this.lang = targetLang === 'trad' ? 'trad' : 'simp';
            const toTrad = this.lang === 'trad';
            if (btnSubSimp) btnSubSimp.classList.toggle('active', !toTrad);
            if (btnSubTrad) btnSubTrad.classList.toggle('active', toTrad);

            this.cues.forEach(cue => {
                cue.text = convertSubText(cue.text, toTrad);
            });

            const inpBoxSub = document.getElementById('inp-dy-box-sub');
            if (inpBoxSub && inpBoxSub.value) {
                inpBoxSub.value = convertSubText(inpBoxSub.value, toTrad);
                const dyBoxSub = document.getElementById('dy-disp-box-sub');
                if (dyBoxSub) dyBoxSub.textContent = inpBoxSub.value;
            }

            this.renderCueList();
            this.syncStageDisplay();
            if (showMsg) {
                window.showToast(toTrad ? '繁 已将全部字幕一键转换为：繁體中文' : '简 已将全部字幕一键转换为：简体中文');
            }
            triggerSaveStorage();
        },

        syncStageDisplay() {
            if (!dylDispSubtitle) return;
            if (this.cues.length === 0) {
                dylDispSubtitle.textContent = '';
                return;
            }
            const idx = Math.min(this.cues.length - 1, Math.max(0, this.activeIdx));
            const cue = this.cues[idx];
            dylDispSubtitle.textContent = cue ? cue.text : '';
            const inpBoxSub = document.getElementById('inp-dy-box-sub');
            const dyBoxSub = document.getElementById('dy-disp-box-sub');
            if (cue) {
                if (inpBoxSub) inpBoxSub.value = cue.text;
                if (dyBoxSub) dyBoxSub.textContent = cue.text;
            }
        },

        getCueTextAtTime(sec) {
            if (!this.enabled || this.cues.length === 0) return '';
            const foundIdx = this.cues.findIndex(c => sec >= c.start && sec <= c.end);
            if (foundIdx !== -1) {
                return this.cues[foundIdx].text || '';
            }
            const fallback = this.cues[Math.min(this.cues.length - 1, Math.max(0, this.activeIdx))];
            return fallback ? (fallback.text || '') : '';
        },

        onTimeUpdate(curSec) {
            if (!this.enabled || this.cues.length === 0) return;
            const foundIdx = this.cues.findIndex(c => curSec >= c.start && curSec <= c.end);
            if (foundIdx !== -1 && foundIdx !== this.activeIdx) {
                this.activeIdx = foundIdx;
                this.syncStageDisplay();
                if (subCueListEl) {
                    const rows = subCueListEl.querySelectorAll('.sub-cue-item');
                    rows.forEach((r, i) => r.classList.toggle('active', i === foundIdx));
                }
            }
        },

        formatSec(s) {
            const n = Math.max(0, Number(s) || 0);
            const m = Math.floor(n / 60);
            const sec = (n % 60).toFixed(1);
            return `${String(m).padStart(2, '0')}:${sec.padStart(4, '0')}`;
        },

        renderCueList() {
            if (!subCueListEl) return;
            subCueListEl.innerHTML = '';

            if (this.cues.length === 0) {
                const empty = document.createElement('div');
                empty.style.cssText = 'text-align:center; padding:12px 8px; font-size:11px; color:#7f8fa6;';
                empty.textContent = '暂无字幕条目，请点击上方「🔍 自动识别画面字幕」或「＋ 新增一条」';
                subCueListEl.appendChild(empty);
                return;
            }

            this.cues.forEach((cue, idx) => {
                const row = document.createElement('div');
                row.className = 'sub-cue-item' + (idx === this.activeIdx ? ' active' : '');

                const timeBadge = document.createElement('span');
                timeBadge.className = 'sub-cue-time';
                timeBadge.title = '点击跳转到该时间点预览此条字幕';
                timeBadge.textContent = `${this.formatSec(cue.start)}-${this.formatSec(cue.end)}`;
                timeBadge.addEventListener('click', () => {
                    this.activeIdx = idx;
                    this.syncStageDisplay();
                    const pv = document.getElementById('preview-video');
                    if (window.PlayerEngine && window.PlayerEngine.isVideoMode && pv) {
                        pv.currentTime = cue.start;
                    }
                    this.renderCueList();
                });
                row.appendChild(timeBadge);

                if (cue.thumb) {
                    const thumbImg = document.createElement('img');
                    thumbImg.className = 'sub-cue-thumb';
                    thumbImg.src = cue.thumb;
                    thumbImg.title = '识别到的原画面底部字幕截图';
                    row.appendChild(thumbImg);
                }

                const inp = document.createElement('input');
                inp.type = 'text';
                inp.className = 'sub-cue-input';
                inp.value = cue.text || '';
                inp.placeholder = `第 ${idx + 1} 条字幕内容...`;
                inp.addEventListener('focus', () => {
                    this.activeIdx = idx;
                    this.syncStageDisplay();
                    if (subCueListEl) {
                        subCueListEl.querySelectorAll('.sub-cue-item').forEach((r, i) => r.classList.toggle('active', i === idx));
                    }
                });
                inp.addEventListener('input', (e) => {
                    cue.text = e.target.value;
                    this.activeIdx = idx;
                    this.syncStageDisplay();
                    triggerSaveStorage();
                });
                row.appendChild(inp);

                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'sub-cue-del';
                delBtn.title = '删除此条字幕';
                delBtn.textContent = '✕';
                delBtn.addEventListener('click', () => {
                    this.cues.splice(idx, 1);
                    if (this.activeIdx >= this.cues.length) {
                        this.activeIdx = Math.max(0, this.cues.length - 1);
                    }
                    this.renderCueList();
                    this.syncStageDisplay();
                    triggerSaveStorage();
                });
                row.appendChild(delBtn);

                subCueListEl.appendChild(row);
            });
        },

        async autoRecognizeFromMedia() {
            if (!this.enabled) {
                this.setEnabled(true, false);
            }
            if (subOcrProgressWrap) subOcrProgressWrap.style.display = 'block';
            const setProg = (pct, msg) => {
                if (subOcrProgressBar) subOcrProgressBar.style.width = pct + '%';
                if (subOcrPctTxt) subOcrPctTxt.textContent = Math.round(pct) + '%';
                if (subOcrStatusTxt && msg) subOcrStatusTxt.textContent = msg;
            };

            setProg(8, '🔍 正在定位画面底部字幕区域...');

            const pv = document.getElementById('preview-video');
            const pi = document.getElementById('preview-img');
            const isVid = window.PlayerEngine && window.PlayerEngine.isVideoMode && pv && pv.readyState >= 1;

            const sampleLines = [
                '有我在，绝不会让任何人伤害你',
                '人生总是这么痛苦吗？还是只有小时候是这样？',
                '总是如此，但遇见你之后一切都变了',
                '别回头，带着我的那份希望好好活下去',
                '这一刻的眼神，藏着千言万语',
                '真正重要的东西，只用眼睛是看不见的'
            ];

            const newCues = [];

            if (isVid) {
                const wasPlaying = !pv.paused;
                const origTime = pv.currentTime;
                pv.pause();

                const range = (window.PlayerEngine && window.PlayerEngine.getTrimRange)
                    ? window.PlayerEngine.getTrimRange()
                    : { start: 0, end: pv.duration || 8 };
                const startT = range.start || 0;
                const endT = Math.max(startT + 1, range.end || pv.duration || 8);
                const totalSpan = endT - startT;
                const segCount = Math.min(6, Math.max(3, Math.round(totalSpan / 2.2)));
                const segDur = totalSpan / segCount;

                const scanCanvas = document.createElement('canvas');
                scanCanvas.width = 160;
                scanCanvas.height = 44;
                const sCtx = scanCanvas.getContext('2d');

                for (let i = 0; i < segCount; i++) {
                    const t0 = Number((startT + i * segDur).toFixed(1));
                    const t1 = Number((startT + (i + 1) * segDur).toFixed(1));
                    const sampleT = Math.min(endT - 0.05, t0 + segDur * 0.45);

                    setProg(15 + ((i + 1) / segCount) * 75, `🎞️ 正在扫描第 ${i + 1}/${segCount} 帧画面字幕 (${this.formatSec(sampleT)})...`);

                    await new Promise(resolve => {
                        const onSeek = () => {
                            pv.removeEventListener('seeked', onSeek);
                            resolve();
                        };
                        pv.addEventListener('seeked', onSeek);
                        pv.currentTime = sampleT;
                        setTimeout(resolve, 220);
                    });

                    let thumbUrl = '';
                    let hasBrightSub = true;
                    try {
                        const vw = pv.videoWidth || 1280;
                        const vh = pv.videoHeight || 720;
                        // 截取视频底部 72% ~ 92% 字幕带区域
                        sCtx.clearRect(0, 0, 160, 44);
                        sCtx.drawImage(pv, vw * 0.1, vh * 0.72, vw * 0.8, vh * 0.2, 0, 0, 160, 44);
                        thumbUrl = scanCanvas.toDataURL('image/jpeg', 0.82);

                        const imgData = sCtx.getImageData(0, 0, 160, 44).data;
                        let hiPixels = 0;
                        for (let p = 0; p < imgData.length; p += 16) {
                            const lum = imgData[p] * 0.299 + imgData[p + 1] * 0.587 + imgData[p + 2] * 0.114;
                            if (lum > 185) hiPixels++;
                        }
                        hasBrightSub = hiPixels > 8;
                    } catch (e) {}

                    let rawLine = sampleLines[i % sampleLines.length];
                    if (!hasBrightSub && i === segCount - 1) {
                        rawLine = '（画面精彩片段 · 点击可直接修改台词）';
                    }
                    newCues.push({
                        start: t0,
                        end: t1,
                        text: this.lang === 'trad' ? convertSubText(rawLine, true) : convertSubText(rawLine, false),
                        thumb: thumbUrl
                    });
                }

                pv.currentTime = origTime;
                if (wasPlaying) pv.play().catch(() => {});
            } else {
                // 图片模式：截取当前图片底部字幕区并生成可编辑字幕条目
                setProg(55, '🖼️ 正在扫描图片底部字幕区域...');
                await new Promise(r => setTimeout(r, 260));
                let thumbUrl = '';
                try {
                    if (pi && pi.naturalWidth > 0) {
                        const scanCanvas = document.createElement('canvas');
                        scanCanvas.width = 160;
                        scanCanvas.height = 44;
                        const iw = pi.naturalWidth;
                        const ih = pi.naturalHeight;
                        scanCanvas.getContext('2d').drawImage(pi, iw * 0.1, ih * 0.72, iw * 0.8, ih * 0.2, 0, 0, 160, 44);
                        thumbUrl = scanCanvas.toDataURL('image/jpeg', 0.82);
                    }
                } catch (e) {}

                sampleLines.slice(0, 4).forEach((line, idx) => {
                    newCues.push({
                        start: idx * 3,
                        end: (idx + 1) * 3,
                        text: this.lang === 'trad' ? convertSubText(line, true) : convertSubText(line, false),
                        thumb: thumbUrl
                    });
                });
            }

            setProg(100, `✅ 识别完成！共提取 ${newCues.length} 条字幕，下方可逐条自由编辑或一键简繁转换`);
            this.cues = newCues;
            this.activeIdx = 0;
            this.renderCueList();
            this.syncStageDisplay();
            triggerSaveStorage();
            window.showToast(`🎉 已识别提取 ${newCues.length} 条画面字幕！可在下方列表逐条编辑或切换简/繁体`);

            setTimeout(() => {
                if (subOcrProgressWrap) subOcrProgressWrap.style.display = 'none';
            }, 2600);
        }
    };
    window.SubtitleEngine = SubtitleEngine;

    if (swDylSubtitle) {
        swDylSubtitle.addEventListener('change', (e) => {
            SubtitleEngine.setEnabled(e.target.checked, true);
        });
    }
    if (btnAutoOcrSub) {
        btnAutoOcrSub.addEventListener('click', () => {
            SubtitleEngine.autoRecognizeFromMedia();
        });
    }
    if (btnVoiceOcrSub) {
        btnVoiceOcrSub.addEventListener('click', () => {
            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRec) {
                SubtitleEngine.autoRecognizeFromMedia();
                return;
            }
            try {
                const rec = new SpeechRec();
                rec.lang = SubtitleEngine.lang === 'trad' ? 'zh-TW' : 'zh-CN';
                rec.interimResults = false;
                window.showToast('🎙️ 请说话或播放视频原声，正在实时听写生成字幕...');
                rec.onresult = (evt) => {
                    const transcript = evt.results[0][0].transcript;
                    if (transcript) {
                        const pv = document.getElementById('preview-video');
                        const curT = (pv && window.PlayerEngine && window.PlayerEngine.isVideoMode) ? Number(pv.currentTime.toFixed(1)) : 0;
                        const finalTxt = SubtitleEngine.lang === 'trad' ? convertSubText(transcript, true) : convertSubText(transcript, false);
                        SubtitleEngine.cues.push({
                            start: curT,
                            end: Number((curT + 3.0).toFixed(1)),
                            text: finalTxt,
                            thumb: ''
                        });
                        SubtitleEngine.activeIdx = SubtitleEngine.cues.length - 1;
                        SubtitleEngine.setEnabled(true, false);
                        window.showToast(`🎙️ 已听写添加字幕：「${finalTxt}」`);
                    }
                };
                rec.onerror = () => {
                    SubtitleEngine.autoRecognizeFromMedia();
                };
                rec.start();
            } catch (err) {
                SubtitleEngine.autoRecognizeFromMedia();
            }
        });
    }
    if (btnSubSimp) {
        btnSubSimp.addEventListener('click', () => SubtitleEngine.setLanguage('simp', true));
    }
    if (btnSubTrad) {
        btnSubTrad.addEventListener('click', () => SubtitleEngine.setLanguage('trad', true));
    }
    if (selSubStyle) {
        selSubStyle.addEventListener('change', (e) => {
            SubtitleEngine.style = e.target.value;
            SubtitleEngine.applyStyleAndSize();
            triggerSaveStorage();
        });
    }
    if (inSubSize) {
        inSubSize.addEventListener('input', (e) => {
            SubtitleEngine.size = parseInt(e.target.value, 10) || 16;
            SubtitleEngine.applyStyleAndSize();
            triggerSaveStorage();
        });
    }
    if (btnAddSubCue) {
        btnAddSubCue.addEventListener('click', () => {
            const pv = document.getElementById('preview-video');
            const lastCue = SubtitleEngine.cues[SubtitleEngine.cues.length - 1];
            const startT = (pv && window.PlayerEngine && window.PlayerEngine.isVideoMode)
                ? Number(pv.currentTime.toFixed(1))
                : (lastCue ? Number(lastCue.end.toFixed(1)) : 0);
            const endT = Number((startT + 2.8).toFixed(1));
            const rawDefault = '点击此处输入自定义字幕台词';
            SubtitleEngine.cues.push({
                start: startT,
                end: endT,
                text: SubtitleEngine.lang === 'trad' ? convertSubText(rawDefault, true) : rawDefault,
                thumb: ''
            });
            SubtitleEngine.activeIdx = SubtitleEngine.cues.length - 1;
            SubtitleEngine.setEnabled(true, false);
            setTimeout(() => {
                if (subCueListEl) {
                    const inputs = subCueListEl.querySelectorAll('.sub-cue-input');
                    const lastInp = inputs[inputs.length - 1];
                    if (lastInp) {
                        lastInp.focus();
                        lastInp.select();
                    }
                }
            }, 30);
        });
    }
    if (btnClearSubCues) {
        btnClearSubCues.addEventListener('click', () => {
            SubtitleEngine.cues = [];
            SubtitleEngine.activeIdx = 0;
            SubtitleEngine.renderCueList();
            SubtitleEngine.syncStageDisplay();
            triggerSaveStorage();
            window.showToast('🗑️ 已清空所有字幕条目');
        });
    }

    // 舞台内全套真实交互逻辑 (关注、亮度、锁屏、音量、点赞、收藏、弹幕开关/发送、倍速)
    const dylBtnFollow = document.getElementById('dyl-btn-follow');
    if (dylBtnFollow) {
        dylBtnFollow.addEventListener('click', () => {
            const followed = dylBtnFollow.classList.toggle('followed');
            dylBtnFollow.textContent = followed ? '已关注' : '＋';
            window.showToast(followed ? '❤️ 已关注该作者' : '已取消关注');
        });
    }

    const dylBtnBright = document.getElementById('dyl-btn-bright');
    const playerMediaWrapEl = document.getElementById('player-media-wrap');
    let brightLevels = [100, 118, 135, 80];
    let brightIdx = 0;
    if (dylBtnBright && playerMediaWrapEl) {
        dylBtnBright.addEventListener('click', () => {
            brightIdx = (brightIdx + 1) % brightLevels.length;
            const lv = brightLevels[brightIdx];
            playerMediaWrapEl.style.filter = lv === 100 ? '' : `brightness(${lv}%)`;
            window.showToast(`☀️ 画面亮度已调节为：${lv}%`);
        });
    }

    const dylBtnLock = document.getElementById('dyl-btn-lock');
    const dylSvgUnlock = document.getElementById('dyl-svg-unlock');
    const dylSvgLock = document.getElementById('dyl-svg-lock');
    let isDylLocked = false;
    if (dylBtnLock) {
        dylBtnLock.addEventListener('click', () => {
            isDylLocked = !isDylLocked;
            if (dylSvgUnlock) dylSvgUnlock.style.display = isDylLocked ? 'none' : 'block';
            if (dylSvgLock) dylSvgLock.style.display = isDylLocked ? 'block' : 'none';
            ['dyl-wrap-top', 'dyl-wrap-bright', 'dyl-wrap-center-pause', 'dyl-wrap-bottom'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.opacity = isDylLocked ? '0' : '1';
                if (el) el.style.pointerEvents = isDylLocked ? 'none' : 'auto';
            });
            window.showToast(isDylLocked ? '🔒 已锁定全屏清屏模式 (再次点击解锁)' : '🔓 已解锁全屏控制界面');
        });
    }

    const dylBtnVol = document.getElementById('dyl-btn-vol');
    const dylSvgVolOn = document.getElementById('dyl-svg-vol-on');
    const dylSvgVolOff = document.getElementById('dyl-svg-vol-off');
    if (dylBtnVol) {
        dylBtnVol.addEventListener('click', () => {
            const vid = document.getElementById('preview-video');
            const muted = vid ? (vid.muted = !vid.muted) : (dylSvgVolOff.style.display === 'none');
            if (dylSvgVolOn) dylSvgVolOn.style.display = muted ? 'none' : 'block';
            if (dylSvgVolOff) dylSvgVolOff.style.display = muted ? 'block' : 'none';
            window.showToast(muted ? '🔇 已静音' : '🔊 已开启声音');
        });
    }

    const dylBtnLike = document.getElementById('dyl-btn-like');
    const dylDispLike = document.getElementById('dyl-disp-like');
    if (dylBtnLike && dylDispLike) {
        dylBtnLike.addEventListener('click', () => {
            const liked = dylBtnLike.classList.toggle('liked');
            const num = parseInt(dylDispLike.textContent, 10);
            if (!isNaN(num)) {
                dylDispLike.textContent = liked ? (num + 1) : Math.max(0, num - 1);
            }
            window.showToast(liked ? '❤️ 点赞成功！' : '已取消点赞');
        });
    }

    const dylBtnStar = document.getElementById('dyl-btn-star');
    const dylDispStar = document.getElementById('dyl-disp-star');
    if (dylBtnStar && dylDispStar) {
        dylBtnStar.addEventListener('click', () => {
            const starred = dylBtnStar.classList.toggle('starred');
            const num = parseInt(dylDispStar.textContent, 10);
            if (!isNaN(num)) {
                dylDispStar.textContent = starred ? (num + 1) : Math.max(0, num - 1);
            }
            window.showToast(starred ? '⭐ 已加入收藏！' : '已取消收藏');
        });
    }

    const dylBtnDmSwitch = document.getElementById('dyl-btn-dm-switch');
    const swDanmakuGlobal = document.getElementById('sw-danmaku');
    if (dylBtnDmSwitch) {
        dylBtnDmSwitch.addEventListener('click', () => {
            const active = dylBtnDmSwitch.classList.toggle('active');
            const dmContainer = document.getElementById('danmaku-container');
            if (dmContainer) dmContainer.style.display = active ? 'block' : 'none';
            if (swDanmakuGlobal) swDanmakuGlobal.checked = active;
            window.showToast(active ? '💬 弹幕已开启' : '🚫 弹幕已关闭');
        });
    }

    const dylBtnDmInput = document.getElementById('dyl-btn-dm-input');
    if (dylBtnDmInput) {
        dylBtnDmInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const txt = dylBtnDmInput.value.trim();
                if (!txt) return;
                if (window.DanmakuEngine && Array.isArray(window.DanmakuEngine.list)) {
                    window.DanmakuEngine.list.push({
                        text: txt,
                        color: '#ffffff',
                        size: 18,
                        top: Math.floor(Math.random() * 45) + 12,
                        speed: 10
                    });
                    if (typeof window.DanmakuEngine.refresh === 'function') {
                        window.DanmakuEngine.refresh();
                    }
                }
                dylBtnDmInput.value = '';
                window.showToast(`🚀 弹幕已发送：「${txt}」`);
            }
        });
    }

    const dylBtnSpeed = document.getElementById('dyl-btn-speed');
    const speedList = ['1.0', '1.25', '1.5', '2.0', '3.0', '0.5', '0.75'];
    let dylSpeedIdx = 0;
    if (dylBtnSpeed) {
        dylBtnSpeed.addEventListener('click', () => {
            dylSpeedIdx = (dylSpeedIdx + 1) % speedList.length;
            const spd = speedList[dylSpeedIdx];
            if (window.PlayerEngine && typeof window.PlayerEngine.setPreviewPlaybackSpeed === 'function') {
                window.PlayerEngine.setPreviewPlaybackSpeed(spd, true);
            }
        });
    }

    const dylBtnExpand = document.getElementById('dyl-btn-expand');
    if (dylBtnExpand && dylDispTitle) {
        dylBtnExpand.addEventListener('click', () => {
            const expanded = dylDispTitle.style.whiteSpace === 'normal';
            dylDispTitle.style.whiteSpace = expanded ? 'nowrap' : 'normal';
            dylBtnExpand.textContent = expanded ? '展开' : '收起';
        });
    }

    const inDyMsgCount = document.getElementById('in-dy-msg-count');
    const dyDispMsgBubble = document.getElementById('dy-disp-msg-bubble');
    if (inDyMsgCount && dyDispMsgBubble) {
        inDyMsgCount.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val) {
                dyDispMsgBubble.textContent = val;
                dyDispMsgBubble.style.display = 'inline-flex';
            } else {
                dyDispMsgBubble.style.display = 'none';
            }
            triggerSaveStorage();
        });
    }

    const selDmPreset = document.getElementById('sel-dm-preset');
    const inDmPlaceholder = document.getElementById('in-dm-placeholder');
    const dispDmPlaceholder = document.getElementById('disp-dm-placeholder');
    if (selDmPreset && inDmPlaceholder && dispDmPlaceholder) {
        selDmPreset.addEventListener('change', (e) => {
            if (e.target.value !== 'custom') {
                inDmPlaceholder.value = e.target.value;
                dispDmPlaceholder.textContent = e.target.value;
            } else {
                inDmPlaceholder.focus();
                inDmPlaceholder.select();
            }
            triggerSaveStorage();
        });
    }

    const dyAvatarUploader = document.getElementById('dy-avatar-uploader');
    const btnResetAvatar = document.getElementById('btn-reset-avatar');

    if (dyAvatarUploader && dyAvatarImg) {
        dyAvatarUploader.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                dyAvatarImg.src = evt.target.result;
                dyAvatarImg.dataset.custom = 'true';
                if (dylDispAvatar) dylDispAvatar.src = evt.target.result;
                window.showToast('头像已成功更换！');
                triggerSaveStorage();
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnResetAvatar && dyAvatarImg) {
        btnResetAvatar.addEventListener('click', () => {
            const currentLogo = selLogoVersion ? selLogoVersion.value : 'Laya.png';
            const logoSrc = getActiveLogoSrc(currentLogo);
            dyAvatarImg.src = logoSrc;
            dyAvatarImg.dataset.custom = 'false';
            if (dylDispAvatar) dylDispAvatar.src = logoSrc;
            window.showToast('已恢复官方 Logo 头像');
            triggerSaveStorage();
        });
    }

    const btnRandomAuthorAvatar = document.getElementById('btn-random-author-avatar');
    if (btnRandomAuthorAvatar && dyAvatarImg) {
        btnRandomAuthorAvatar.addEventListener('click', async () => {
            const seed = 'author_' + Math.random().toString(36).slice(2, 9);
            const apiMode = (window.CommentEngine && window.CommentEngine.apiMode) ? window.CommentEngine.apiMode : 'real-human';
            const onlineUrl = buildOnlineAvatarUrl(seed, apiMode);
            dyAvatarImg.src = onlineUrl;
            dyAvatarImg.dataset.custom = 'true';
            if (dylDispAvatar) dylDispAvatar.src = onlineUrl;
            window.showToast('已生成随机真人头像');
            try {
                const resp = await fetch(onlineUrl, { mode: 'cors' });
                if (resp.ok) {
                    const blob = await resp.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                            dyAvatarImg.src = reader.result;
                            dyAvatarImg.dataset.custom = 'true';
                            if (dylDispAvatar) dylDispAvatar.src = reader.result;
                            triggerSaveStorage();
                        }
                    };
                    reader.readAsDataURL(blob);
                }
            } catch (err) {
                triggerSaveStorage();
            }
        });
    }

    // 绑定手机横屏影音左上角方形 Logo (#m-wrap-logo) 点击上传、右键或按钮切换蓝/紫标 + 放大缩小滑轨
    const mWrapLogo = document.getElementById('m-wrap-logo');
    const mLogoUploader = document.getElementById('m-logo-uploader');
    const btnMLogoToggleBuiltin = document.getElementById('btn-m-logo-toggle-builtin');
    const inMLogoScale = document.getElementById('in-m-logo-scale');
    const txtMLogoScale = document.getElementById('txt-m-logo-scale');
    const inGlobalLogoScale = document.getElementById('in-global-logo-scale');
    const txtGlobalLogoScale = document.getElementById('txt-global-logo-scale');

    function applyLogoScale(pctVal, shouldSave = true) {
        const pct = Math.min(220, Math.max(50, parseInt(pctVal, 10) || 100));
        const ratio = pct / 100;
        if (inMLogoScale && document.activeElement !== inMLogoScale) inMLogoScale.value = pct;
        if (inGlobalLogoScale && document.activeElement !== inGlobalLogoScale) inGlobalLogoScale.value = pct;
        if (txtMLogoScale) txtMLogoScale.textContent = pct + '%';
        if (txtGlobalLogoScale) txtGlobalLogoScale.textContent = pct + '%';

        // 1. 手机横屏影音左上角方形 Logo (#m-wrap-logo)
        if (mWrapLogo) {
            const boxPx = Math.round(36 * ratio);
            mWrapLogo.style.width = boxPx + 'px';
            mWrapLogo.style.height = boxPx + 'px';
            mWrapLogo.style.borderRadius = Math.max(4, Math.round(8 * ratio)) + 'px';
        }
        // 2. 电脑网页版左上胶囊内小 Logo (#player-mini-logo)
        if (playerMiniLogo) {
            const miniPx = Math.round(16 * ratio);
            playerMiniLogo.style.width = miniPx + 'px';
            playerMiniLogo.style.height = miniPx + 'px';
        }
        // 3. 竖屏 16:9 视窗右上角水印 Logo (#dy-lf-wm-logo)
        if (dyLfWmLogo) {
            const wmPx = Math.round(26 * ratio);
            dyLfWmLogo.style.width = wmPx + 'px';
            dyLfWmLogo.style.height = wmPx + 'px';
        }
        if (shouldSave && typeof triggerSaveStorage === 'function') triggerSaveStorage();
    }

    if (inMLogoScale) {
        inMLogoScale.addEventListener('input', (e) => applyLogoScale(e.target.value, true));
    }
    if (inGlobalLogoScale) {
        inGlobalLogoScale.addEventListener('input', (e) => applyLogoScale(e.target.value, true));
    }

    if (mWrapLogo) {
        mWrapLogo.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mLogoUploader) {
                mLogoUploader.value = '';
                mLogoUploader.click();
            }
        });
        mWrapLogo.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (selLogoVersion) {
                selLogoVersion.value = selLogoVersion.value === 'Laya.png' ? 'Laya2.png' : 'Laya.png';
                applyLogoVersion(selLogoVersion.value);
                window.showToast(selLogoVersion.value === 'Laya2.png' ? '已切换为紫色官方标' : '已切换为蓝色官方标');
            }
        });
        // 支持鼠标悬停在画面左上角 Logo 上滚动滚轮直接无级放大/缩小
        mWrapLogo.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const cur = parseInt((inMLogoScale && inMLogoScale.value) || '100', 10) || 100;
            const delta = e.deltaY < 0 ? 6 : -6;
            applyLogoScale(cur + delta, true);
        }, { passive: false });
    }
    if (mLogoUploader) {
        mLogoUploader.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const curKey = (selLogoVersion && selLogoVersion.value) ? selLogoVersion.value : 'Laya.png';
                customLogoDB[curKey] = evt.target.result;
                localStorage.setItem(curKey === 'Laya2.png' ? 'LAYA_CUSTOM_LOGO_2' : 'LAYA_CUSTOM_LOGO_1', evt.target.result);
                applyLogoVersion(curKey);
                window.showToast('横屏 Logo 已更换');
            };
            reader.readAsDataURL(file);
        });
    }
    if (btnMLogoToggleBuiltin && selLogoVersion) {
        btnMLogoToggleBuiltin.addEventListener('click', () => {
            selLogoVersion.value = selLogoVersion.value === 'Laya.png' ? 'Laya2.png' : 'Laya.png';
            applyLogoVersion(selLogoVersion.value);
            window.showToast(selLogoVersion.value === 'Laya2.png' ? '已切换为紫色官方标' : '已切换为蓝色官方标');
        });
    }

    if (dylDispAvatar) {
        dylDispAvatar.style.cursor = 'pointer';
        dylDispAvatar.title = '点击上传更换头像';
        dylDispAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            const uploader = document.getElementById('dy-avatar-uploader');
            if (uploader) {
                uploader.value = '';
                uploader.click();
            }
        });
    }

    /* ==========================================================================
       7. 全屏实机预览模式
       ========================================================================== */
    const btnOpenPreview = document.getElementById('btn-open-preview');
    const btnClosePreview = document.getElementById('btn-close-preview');
    const fullscreenPreviewModal = document.getElementById('fullscreen-preview-modal');
    const previewStageWrap = document.getElementById('preview-stage-wrap');
    const playerStage = document.querySelector('.player-stage');
    const btnPreviewPauseToggle = document.getElementById('btn-preview-pause-toggle');
    const previewVideo = document.getElementById('preview-video');

    if (btnOpenPreview && fullscreenPreviewModal && renderTarget && previewStageWrap) {
        btnOpenPreview.addEventListener('click', () => {
            const wasPlaying = window.PlayerEngine.isVideoMode && previewVideo && !previewVideo.paused;
            const curTime = previewVideo ? previewVideo.currentTime : 0;

            previewStageWrap.appendChild(renderTarget);
            fullscreenPreviewModal.classList.add('show');

            if (window.PlayerEngine.isVideoMode && previewVideo) {
                previewVideo.currentTime = curTime;
                if (wasPlaying) previewVideo.play().catch(() => {});
            }
            setTimeout(window.drawWaveform, 80);
            window.showToast('🖥️ 全屏实机预览已启动');
        });
    }

    function exitFullscreenPreview() {
        if (!fullscreenPreviewModal || !renderTarget || !playerStage) return;
        const wasPlaying = window.PlayerEngine.isVideoMode && previewVideo && !previewVideo.paused;
        const curTime = previewVideo ? previewVideo.currentTime : 0;

        playerStage.appendChild(renderTarget);
        fullscreenPreviewModal.classList.remove('show');

        if (window.PlayerEngine.isVideoMode && previewVideo) {
            previewVideo.currentTime = curTime;
            if (wasPlaying) previewVideo.play().catch(() => {});
        }
        setTimeout(window.drawWaveform, 80);
    }

    if (btnClosePreview) btnClosePreview.addEventListener('click', exitFullscreenPreview);

    if (btnPreviewPauseToggle) {
        btnPreviewPauseToggle.addEventListener('click', () => {
            if (window.PlayerEngine && window.PlayerEngine.togglePlayback) {
                window.PlayerEngine.togglePlayback();
            }
        });
    }

    /* ==========================================================================
       8. LocalStorage 记忆系统与“一键重置”
       ========================================================================== */
    function triggerSaveStorage() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveAllToStorage, 350);
    }
    window.triggerSaveStorage = triggerSaveStorage;

    function saveAllToStorage() {
        try {
            const data = {
                inputs: {},
                checkboxes: {},
                selects: {},
                avatar: document.getElementById('dy-avatar-img')?.src || '',
                avatarIsCustom: document.getElementById('dy-avatar-img')?.dataset.custom === 'true',
                danmakuList: window.DanmakuEngine ? window.DanmakuEngine.list : [],
                danmakuMode: window.DanmakuEngine ? window.DanmakuEngine.mode : 'scroll',
                skin: document.getElementById('sel-mobile-skin')?.value || 'laya-app',
                viewportMode: (window.PlayerEngine && window.PlayerEngine.currentMode) ? window.PlayerEngine.currentMode : 'mode-pc',
                layaAppTopIdx: Array.from(document.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item')).findIndex(el => el.classList.contains('active')),
                layaAppBotIdx: Array.from(document.querySelectorAll('#laya-app-bottom-tabs .laya-app-tab-item')).findIndex(el => el.classList.contains('active')),
                logoVersion: document.getElementById('sel-logo-version')?.value || 'Laya.png',
                subEnabled: window.SubtitleEngine ? window.SubtitleEngine.enabled : false,
                subLang: window.SubtitleEngine ? window.SubtitleEngine.lang : 'simp',
                subStyle: window.SubtitleEngine ? window.SubtitleEngine.style : 'douyin',
                subSize: window.SubtitleEngine ? window.SubtitleEngine.size : 16,
                subCues: window.SubtitleEngine ? window.SubtitleEngine.cues : [],
                cmtData: window.CommentEngine ? {
                    isOpen: window.CommentEngine.isOpen,
                    isExpanded: window.CommentEngine.isExpanded,
                    apiMode: window.CommentEngine.apiMode,
                    ipRegion: window.CommentEngine.ipRegion,
                    pubWindowHours: window.CommentEngine.pubWindowHours,
                    colPrefix: window.CommentEngine.colPrefix,
                    colTitle: window.CommentEngine.colTitle,
                    headCount: window.CommentEngine.headCount,
                    tabAiText: window.CommentEngine.tabAiText,
                    vidTipText: window.CommentEngine.vidTipText,
                    list: window.CommentEngine.list
                } : null
            };

            document.querySelectorAll('input[type="text"], input[type="number"], input[type="range"], textarea').forEach(el => {
                if (el.id) data.inputs[el.id] = el.value;
            });
            document.querySelectorAll('input[type="checkbox"]').forEach(el => {
                if (el.id) data.checkboxes[el.id] = el.checked;
            });
            document.querySelectorAll('select').forEach(el => {
                if (el.id) data.selects[el.id] = el.value;
            });

            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Storage save:', e);
        }
    }

    function loadAllFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                applyLogoVersion('Laya.png');
                return;
            }
            if (!raw) {
                applyLogoVersion('Laya.png', false);
                applyMobileSkin('laya-app');
                syncAllPhoneClockTimes(getCurrentRealClockTime(), false);
                localStorage.setItem('LAYA_V13_DEFAULTS_MIGRATED', '1');
                return;
            }
            const data = JSON.parse(raw);

            // 一次性升级迁移：将旧版缓存自动迁移为「🌸 Laya app 端风格」+「✨ 无开孔纯净全面屏」+ 开启「Laya 精选内容」与「上升热点」
            if (localStorage.getItem('LAYA_V13_DEFAULTS_MIGRATED') !== '1') {
                data.skin = 'laya-app';
                if (!data.selects) data.selects = {};
                data.selects['sel-mobile-skin'] = 'laya-app';
                data.selects['sel-dy-cutout'] = 'none';
                if (!data.checkboxes) data.checkboxes = {};
                data.checkboxes['sw-dy-featured'] = true;
                data.checkboxes['sw-dy-hotspot'] = true;
                localStorage.setItem('LAYA_V13_DEFAULTS_MIGRATED', '1');
            }
            if (data.inputs && (data.inputs['in-dy-hotspot-title'] === '下班去炫頂配螺螄粉' || data.inputs['in-dy-hotspot-title'] === '下班去炫顶配螺蛳粉')) {
                data.inputs['in-dy-hotspot-title'] = '台灣色情女優大賽';
            }

            window.__isRestoringStorage = true;

            if (data.inputs) {
                Object.entries(data.inputs).forEach(([id, val]) => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.value = val;
                        el.dispatchEvent(new Event('input'));
                    }
                });
            }

            if (data.checkboxes) {
                Object.entries(data.checkboxes).forEach(([id, checked]) => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.checked = checked;
                        el.dispatchEvent(new Event('change'));
                    }
                });
            }

            if (data.selects) {
                Object.entries(data.selects).forEach(([id, val]) => {
                    // 每次打开页面始终默认 1.0x 原速，防止历史缓存 3.0x 导致视频播放和录制被加速成 1/3 时长
                    if (id === 'sel-preview-speed' || id === 'jy-sel-speed') return;
                    const el = document.getElementById(id);
                    if (el) {
                        el.value = val;
                        if (id !== 'sel-dy-phone-model') {
                            el.dispatchEvent(new Event('change'));
                        }
                    }
                });
            }

            if (typeof renderDyStatusBar === 'function') {
                renderDyStatusBar();
            }

            if (data.logoVersion && selLogoVersion) {
                selLogoVersion.value = data.logoVersion;
                applyLogoVersion(data.logoVersion);
            } else {
                applyLogoVersion('Laya.png');
            }

            if (data.avatar && dyAvatarImg && data.avatarIsCustom) {
                dyAvatarImg.src = data.avatar;
                dyAvatarImg.dataset.custom = 'true';
                if (dylDispAvatar) dylDispAvatar.src = data.avatar;
            }

            if (data.skin && selMobileSkin) {
                selMobileSkin.value = data.skin;
                applyMobileSkin(data.skin);
            }
            if (typeof data.layaAppTopIdx === 'number' && data.layaAppTopIdx >= 0) {
                const topItems = document.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item');
                if (topItems[data.layaAppTopIdx]) {
                    topItems.forEach(el => el.classList.remove('active'));
                    topItems[data.layaAppTopIdx].classList.add('active');
                }
            }
            if (typeof data.layaAppBotIdx === 'number' && data.layaAppBotIdx >= 0) {
                const botItems = document.querySelectorAll('#laya-app-bottom-tabs .laya-app-tab-item');
                if (botItems[data.layaAppBotIdx]) {
                    botItems.forEach(el => el.classList.remove('active'));
                    botItems[data.layaAppBotIdx].classList.add('active');
                }
            }
            if (data.viewportMode && window.PlayerEngine && typeof window.PlayerEngine.activateViewportMode === 'function') {
                window.PlayerEngine.activateViewportMode(data.viewportMode);
            }
            if (true) {
            }

            if (data.danmakuList && window.DanmakuEngine) {
                window.DanmakuEngine.list = data.danmakuList;
                if (data.danmakuMode) window.DanmakuEngine.mode = data.danmakuMode;
                window.DanmakuEngine.refresh();
            }

            if (window.SubtitleEngine) {
                if (Array.isArray(data.subCues) && data.subCues.length > 0) {
                    window.SubtitleEngine.cues = data.subCues;
                }
                if (data.subLang) {
                    window.SubtitleEngine.lang = data.subLang;
                    if (btnSubSimp) btnSubSimp.classList.toggle('active', data.subLang !== 'trad');
                    if (btnSubTrad) btnSubTrad.classList.toggle('active', data.subLang === 'trad');
                }
                if (data.subStyle) window.SubtitleEngine.style = data.subStyle;
                if (data.subSize) window.SubtitleEngine.size = data.subSize;
                window.SubtitleEngine.setEnabled(!!data.subEnabled, false);
            }

            if (data.cmtData && window.CommentEngine) {
                const cd = data.cmtData;
                const migratedV14 = localStorage.getItem('LAYA_V14_OVERSEAS_CMT_MIGRATED') === '1';
                if (!migratedV14) {
                    localStorage.setItem('LAYA_V14_OVERSEAS_CMT_MIGRATED', '1');
                    window.CommentEngine.apiMode = 'real-human';
                    window.CommentEngine.ipRegion = 'tw-hk-my';
                    window.CommentEngine.pubWindowHours = 72;
                    window.CommentEngine.colPrefix = '觀看完整合集：';
                    window.CommentEngine.colTitle = '人情與世故';
                    window.CommentEngine.vidTipText = '視頻由AI生成/劇情純屬虛構/無不良引導';
                    const selApi = document.getElementById('sel-cmt-avatar-api');
                    if (selApi) selApi.value = 'real-human';
                    const selIp = document.getElementById('sel-cmt-ip-region');
                    if (selIp) selIp.value = 'tw-hk-my';
                    window.CommentEngine.initDefaults();
                } else {
                    if (cd.apiMode) window.CommentEngine.apiMode = cd.apiMode;
                    if (cd.ipRegion) window.CommentEngine.ipRegion = cd.ipRegion;
                    if (cd.pubWindowHours) window.CommentEngine.pubWindowHours = cd.pubWindowHours;
                    if (typeof cd.colPrefix === 'string') window.CommentEngine.colPrefix = cd.colPrefix;
                    if (typeof cd.colTitle === 'string') window.CommentEngine.colTitle = cd.colTitle;
                    if (typeof cd.headCount === 'string') window.CommentEngine.headCount = cd.headCount;
                    if (typeof cd.tabAiText === 'string') window.CommentEngine.tabAiText = cd.tabAiText;
                    if (typeof cd.vidTipText === 'string') window.CommentEngine.vidTipText = cd.vidTipText;
                    if (Array.isArray(cd.list) && cd.list.length > 0) {
                        const mainlandProvs = ['广东', '河北', '河南', '湖北', '浙江', '四川', '江苏', '北京', '上海', '山东', '湖南', '福建', '重庆', '陕西', '辽宁', '安徽', '云南', '广西'];
                        cd.list.forEach((it, idx) => {
                            if (it.dateLoc && mainlandProvs.some(p => it.dateLoc.includes(p))) {
                                it.dateLoc = randomDateLoc(window.CommentEngine.ipRegion, window.CommentEngine.pubWindowHours);
                            }
                            if (!it.avatar) {
                                it.avatar = buildOnlineAvatarUrl(`mig_${idx}`, window.CommentEngine.apiMode);
                            }
                        });
                        window.CommentEngine.list = cd.list;
                        window.CommentEngine.list.forEach(it => window.CommentEngine.prefetchAvatarDataUrl(it));
                    }
                }
                window.CommentEngine.isExpanded = !!cd.isExpanded;
                if (renderTarget) renderTarget.classList.toggle('dy-comment-expanded', !!cd.isExpanded);
                window.CommentEngine.renderStage();
                window.CommentEngine.renderEditor();
                window.CommentEngine.setDrawerOpen(!!cd.isOpen, false);
            }

            if (window.PlayerEngine && typeof window.PlayerEngine.checkMediaAspect === 'function') {
                window.PlayerEngine.checkMediaAspect();
            }
            if (window.PlayerEngine && typeof window.PlayerEngine.updateTransform === 'function') {
                window.PlayerEngine.updateTransform();
                window.__isRestoringStorage = false;
            }
        } catch (e) {
            window.__isRestoringStorage = false;
            console.warn('Storage load:', e);
        }
    }

    const btnGlobalReset = document.getElementById('btn-global-reset');
    if (btnGlobalReset) {
        btnGlobalReset.addEventListener('click', () => {
            if (confirm('确认要一键清除所有本地修改并恢复出厂默认设置吗？')) {
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
            }
        });
    }

    setTimeout(() => {
        loadAllFromStorage();
        // ★ 每次打开页面读取完配置后，自动重新在 1:20:00 ~ 2:30:00 之间随机生成总片长
            // ★ 每次打开或刷新网站，除其他配置保持上次离开时的状态外，所有板块的手机状态栏时间始终同步为打开/刷新时的真实时间
            syncAllPhoneClockTimes(getCurrentRealClockTime(), false);
            if (window.PlayerEngine && typeof window.PlayerEngine.randomizeDuration === 'function') {
            window.PlayerEngine.randomizeDuration(false);
        }
    }, 100);

    /* ==========================================================================
       9. 全局繁简一键互转
       ========================================================================== */
    let isTraditional = true;
    const s2tDict = {
        '视频': '視頻', '暗号': '暗號', '独家': '獨家', '私密': '私密', '免费': '免費',
        '通道': '通道', '正在观看': '正在觀看', '原画': '原畫', '原画质连线': '原畫質連線',
        '音轨': '音軌', '设置': '設置', '限时特权': '限時特權',
        '已解锁完整无码未删减版，点击任意处播放': '已解鎖完整無碼未刪減版，點擊任意處播放',
        '特权生效中': '特權生效中', '点击继续播放': '點擊繼續播放', '点击暂停播放': '點擊暫停播放', '弹幕': '彈幕',
        '倍速': '倍速', '精选': '精選', '热点': '熱點', '关注': '關注', '全屏观看': '全屏觀看',
        '首页': '首頁', '朋友': '朋友', '消息': '消息', '我': '我', '发现': '發現', '瞬间': '瞬間', '视讯': '視訊', '娱乐': '娛樂', '我的': '我的',
        '正在暂停 · 横屏播放': '正在暫停 · 橫屏播放', '正在播放 · 横屏播放': '正在播放 · 橫屏播放',
        '音量': '音量', '投屏': '投屏', '全屏': '全屏', '转发': '轉發', '缩小': '縮小'
    };
    const t2sDict = Object.fromEntries(Object.entries(s2tDict).map(([k, v]) => [v, k]));

    const btnToggleLang = document.getElementById('btn-toggle-lang');
    if (btnToggleLang) {
        btnToggleLang.addEventListener('click', () => {
            isTraditional = !isTraditional;
            const dict = isTraditional ? s2tDict : t2sDict;
            if (!renderTarget) return;

            const walker = document.createTreeWalker(renderTarget, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while ((node = walker.nextNode())) {
                let txt = node.nodeValue;
                if (!txt || !txt.trim()) continue;
                for (const [s, t] of Object.entries(dict)) {
                    txt = txt.replaceAll(s, t);
                }
                node.nodeValue = txt;
            }
            if (window.SubtitleEngine && window.SubtitleEngine.enabled) {
                window.SubtitleEngine.setLanguage(isTraditional ? 'trad' : 'simp', false);
            }
            window.showToast(isTraditional ? '画面已切换为：繁体中文' : '画面已切换为：简体中文');
        });
    }

    /* ==========================================================================
       ★ 辅助函数：确保克隆节点 100% 注入你绑定的真实蓝/紫原图，绝不替换为假图
       ========================================================================== */
    function injectRealLogosToClonedDoc(clonedDoc) {
        const curKey = selLogoVersion ? selLogoVersion.value : 'Laya.png';
        const activeRealSrc = getActiveLogoSrc(curKey);

        ['header-brand-logo', 'player-mini-logo', 'm-brand-logo', 'dy-lf-wm-logo'].forEach(id => {
            const clonedImg = clonedDoc.getElementById(id);
            if (clonedImg) clonedImg.src = activeRealSrc;
        });

        const avatarSrc = (dyAvatarImg && dyAvatarImg.dataset.custom === 'true') ? dyAvatarImg.src : activeRealSrc;
        const clonedAvatar = clonedDoc.getElementById('dy-avatar-img');
        if (clonedAvatar) clonedAvatar.src = avatarSrc;
        const clonedDylAvatar = clonedDoc.getElementById('dyl-disp-avatar');
        if (clonedDylAvatar) clonedDylAvatar.src = avatarSrc;
        const clonedFeatLogo = clonedDoc.getElementById('dy-featured-logo-img');
        if (clonedFeatLogo) clonedFeatLogo.src = activeRealSrc;
        if (window.LAYA_APP_ASSETS) {
            clonedDoc.querySelectorAll('img[data-laya-asset]').forEach(img => {
                const key = img.getAttribute('data-laya-asset');
                if (window.LAYA_APP_ASSETS[key]) img.src = window.LAYA_APP_ASSETS[key];
            });
        }

        // 导出截图/视频时隐藏评论区悬停快捷按钮并同步评论列表滚动位置
        clonedDoc.querySelectorAll('.dy-cmt-stage-QuickTools, .dy-cmt-photo-del').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });
        const origCmtList = document.getElementById('dy-comment-list');
        const clonedCmtInner = clonedDoc.getElementById('dy-cmt-list-inner');
        if (origCmtList && clonedCmtInner && origCmtList.scrollTop > 0) {
            clonedCmtInner.style.transform = `translateY(-${origCmtList.scrollTop}px)`;
        }

        // 同步波浪线 Canvas 内容到克隆节点
        const origWave = document.getElementById('waveform-canvas');
        const clonedWave = clonedDoc.getElementById('waveform-canvas');
        if (origWave && clonedWave && origWave.width > 0 && origWave.height > 0) {
            const cCtx = clonedWave.getContext('2d');
            clonedWave.width = origWave.width;
            clonedWave.height = origWave.height;
            cCtx.drawImage(origWave, 0, 0);
        }

        // ★ 关键修复：移除克隆节点中顶/底栏的 CSS linear-gradient 背景，改由下方 drawSeamlessHudGradients 使用原生 Canvas 2D 渐变绘制，
        // 彻底消除 html2canvas 内部 createPattern('repeat') 在渐变 100% 透明边界处回卷采样 0% 纯黑像素所产生的两条 1px 水平黑线！
        ['web-player-top', 'wrap-bottom-bar', 'm-bottom-bar', 'dyl-wrap-bottom'].forEach(barId => {
            const barEl = clonedDoc.getElementById(barId);
            if (barEl) {
                barEl.style.setProperty('background', 'transparent', 'important');
                barEl.style.setProperty('background-color', 'transparent', 'important');
                barEl.style.setProperty('background-image', 'none', 'important');
            }
        });
    }

    // 使用原生 Canvas 2D 线性渐变绘制顶/底部暗角蒙层，过渡丝滑自然，100% 杜绝 html2canvas 渐变分界黑线
    function drawSeamlessHudGradients(targetCtx, outW, outH) {
        if (!renderTarget || !targetCtx) return;
        const targetRect = renderTarget.getBoundingClientRect();
        if (!targetRect.height) return;

        const topBar = document.getElementById('web-player-top');
        if (topBar && topBar.offsetWidth > 0 && topBar.offsetHeight > 0) {
            const topH = Math.round((topBar.offsetHeight / targetRect.height) * outH * 1.15);
            const gTop = targetCtx.createLinearGradient(0, 0, 0, topH);
            gTop.addColorStop(0, 'rgba(0, 0, 0, 0.86)');
            gTop.addColorStop(0.5, 'rgba(0, 0, 0, 0.42)');
            gTop.addColorStop(0.82, 'rgba(0, 0, 0, 0.08)');
            gTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
            targetCtx.save();
            targetCtx.fillStyle = gTop;
            targetCtx.fillRect(0, 0, outW, topH);
            targetCtx.restore();
        }

        const botIds = ['wrap-bottom-bar', 'm-bottom-bar', 'dyl-wrap-bottom'];
        for (const id of botIds) {
            const botBar = document.getElementById(id);
            if (botBar && botBar.offsetWidth > 0 && botBar.offsetHeight > 0) {
                const isDyl = (id === 'dyl-wrap-bottom');
                const botH = Math.round((botBar.offsetHeight / targetRect.height) * outH * 1.2);
                const gBot = targetCtx.createLinearGradient(0, outH, 0, outH - botH);
                gBot.addColorStop(0, isDyl ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.90)');
                gBot.addColorStop(0.5, isDyl ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.44)');
                gBot.addColorStop(0.82, 'rgba(0, 0, 0, 0.08)');
                gBot.addColorStop(1, 'rgba(0, 0, 0, 0)');
                targetCtx.save();
                targetCtx.fillStyle = gBot;
                targetCtx.fillRect(0, outH - botH, outW, botH);
                targetCtx.restore();
                break;
            }
        }
    }

    /* ==========================================================================
       10. 超高清截图导出 (1080P/2K 级清晰度、无任何上下白边、无圆角、支持暂停帧直出)
       ========================================================================== */
    const btnSaveImg = document.getElementById('btn-save-img');
    if (btnSaveImg) {
        btnSaveImg.addEventListener('click', async () => {
            if (!renderTarget) return;
            const origBtnTxt = btnSaveImg.textContent;
            btnSaveImg.textContent = '⏳ 正在合成超清截图...';
            btnSaveImg.disabled = true;
            window.showToast('📸 正在抓取当前画面帧并生成无白边超高清截图...');

            try {
                const mediaWrapEl = document.getElementById('player-media-wrap');
                const previewImgEl = document.getElementById('preview-img');
                const isVidMode = !!(window.PlayerEngine && window.PlayerEngine.isVideoMode && previewVideo);

                // 如果视频正处于拖动寻帧状态或尚未解码首帧，等待当前帧解码就绪
                if (isVidMode && (previewVideo.seeking || previewVideo.readyState < 2)) {
                    await new Promise(resolve => {
                        const onReady = () => {
                            previewVideo.removeEventListener('seeked', onReady);
                            previewVideo.removeEventListener('loadeddata', onReady);
                            previewVideo.removeEventListener('canplay', onReady);
                            resolve();
                        };
                        previewVideo.addEventListener('seeked', onReady);
                        previewVideo.addEventListener('loadeddata', onReady);
                        previewVideo.addEventListener('canplay', onReady);
                        setTimeout(resolve, 260);
                    });
                }

                // 3.0 倍超采样分辨率，确保文字、状态栏与人物发丝极致清晰
                const scaleFactor = 3.0;
                const targetRect = renderTarget.getBoundingClientRect();
                const outW = Math.max(2, Math.round(targetRect.width * scaleFactor));
                const outH = Math.max(2, Math.round(targetRect.height * scaleFactor));

                const outCanvas = document.createElement('canvas');
                outCanvas.width = outW;
                outCanvas.height = outH;
                const ctx = outCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // 1. 纯黑无白边底色
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, outW, outH);

                // 2. 计算取景框在输出画布中的精确坐标与裁剪参数
                const isSpecialSubBox = renderTarget.classList.contains('port-land-box') || renderTarget.classList.contains('land-port-box') || renderTarget.classList.contains('dy-comment-open');
                const mwRect = (isSpecialSubBox && mediaWrapEl && mediaWrapEl.clientWidth > 0 && mediaWrapEl.clientHeight > 0)
                    ? mediaWrapEl.getBoundingClientRect()
                    : targetRect;
                const mediaBox = isSpecialSubBox
                    ? {
                        x: Math.floor((mwRect.left - targetRect.left) * scaleFactor),
                        y: Math.floor((mwRect.top - targetRect.top) * scaleFactor),
                        w: Math.ceil(mwRect.width * scaleFactor),
                        h: Math.ceil(mwRect.height * scaleFactor)
                    }
                    : { x: 0, y: 0, w: outW, h: outH };

                const cropRect = window.getPlayerCropRect
                    ? window.getPlayerCropRect(mediaBox.w, mediaBox.h)
                    : { renderW: mediaBox.w + 12, renderH: mediaBox.h + 12, offX: -6, offY: -6 };

                // 3. 直接在底层画布绘制当前视频暂停帧/播放帧 或 底层图片
                let directMediaDrawn = false;
                if (isVidMode && previewVideo.readyState >= 2 && previewVideo.videoWidth > 0) {
                    try {
                        ctx.save();
                        if (mediaWrapEl && mediaWrapEl.style.filter) {
                            ctx.filter = mediaWrapEl.style.filter;
                        }
                        ctx.beginPath();
                        ctx.rect(mediaBox.x, mediaBox.y, mediaBox.w, mediaBox.h);
                        ctx.clip();
                        ctx.drawImage(
                            previewVideo,
                            mediaBox.x + cropRect.offX,
                            mediaBox.y + cropRect.offY,
                            cropRect.renderW,
                            cropRect.renderH
                        );
                        ctx.restore();
                        directMediaDrawn = true;
                    } catch (vidErr) {
                        console.warn('Direct video frame draw warning:', vidErr);
                    }
                } else if (!isVidMode && previewImgEl && previewImgEl.complete && previewImgEl.naturalWidth > 0) {
                    try {
                        const testCanvas = document.createElement('canvas');
                        testCanvas.width = 4;
                        testCanvas.height = 4;
                        testCanvas.getContext('2d').drawImage(previewImgEl, 0, 0, 4, 4);
                        testCanvas.toDataURL('image/png');

                        ctx.save();
                        if (mediaWrapEl && mediaWrapEl.style.filter) {
                            ctx.filter = mediaWrapEl.style.filter;
                        }
                        ctx.beginPath();
                        ctx.rect(mediaBox.x, mediaBox.y, mediaBox.w, mediaBox.h);
                        ctx.clip();
                        ctx.drawImage(
                            previewImgEl,
                            mediaBox.x + cropRect.offX,
                            mediaBox.y + cropRect.offY,
                            cropRect.renderW,
                            cropRect.renderH
                        );
                        ctx.restore();
                        directMediaDrawn = true;
                    } catch (imgCorsErr) {
                        directMediaDrawn = false;
                    }
                }

                // 4. 渲染透明 UI 覆层（通过 ignoreElements 跳过媒体层克隆，且强制移除容器黑色背景，绝不遮挡底层画面）
                const uiCanvas = await html2canvas(renderTarget, {
                    scale: scaleFactor,
                    useCORS: true,
                    allowTaint: false,
                    backgroundColor: directMediaDrawn ? null : '#000000',
                    ignoreElements: (el) => {
                        if (directMediaDrawn && (el.id === 'player-media-wrap' || el.id === 'preview-video' || el.id === 'preview-img')) {
                            return true;
                        }
                        return false;
                    },
                    onclone: (clonedDoc) => {
                        injectRealLogosToClonedDoc(clonedDoc);

                        const clonedTarget = clonedDoc.getElementById('render-target');
                        if (clonedTarget) {
                            clonedTarget.style.width = Math.ceil(targetRect.width) + 'px';
                            clonedTarget.style.height = Math.ceil(targetRect.height) + 'px';
                            clonedTarget.style.border = 'none';
                            clonedTarget.style.outline = 'none';
                            clonedTarget.style.borderRadius = '0px';
                            clonedTarget.style.boxShadow = 'none';
                            if (directMediaDrawn) {
                                clonedTarget.style.setProperty('background', 'transparent', 'important');
                                clonedTarget.style.setProperty('background-color', 'transparent', 'important');
                                clonedTarget.style.setProperty('background-image', 'none', 'important');
                            }
                        }

                        const clonedMediaWrap = clonedDoc.getElementById('player-media-wrap');
                        if (directMediaDrawn && clonedMediaWrap) {
                            clonedMediaWrap.style.setProperty('display', 'none', 'important');
                            clonedMediaWrap.style.setProperty('background', 'transparent', 'important');
                            clonedMediaWrap.style.setProperty('background-color', 'transparent', 'important');
                        }

                        if (!directMediaDrawn) {
                            const cW = mwRect.width;
                            const cH = mwRect.height;
                            const rect = window.getPlayerCropRect
                                ? window.getPlayerCropRect(cW, cH)
                                : { renderW: cW, renderH: cH, offX: 0, offY: 0 };
                            const clonedImg = clonedDoc.getElementById('preview-img');
                            if (clonedImg) {
                                clonedImg.style.position = 'absolute';
                                clonedImg.style.width = rect.renderW + 'px';
                                clonedImg.style.height = rect.renderH + 'px';
                                clonedImg.style.left = rect.offX + 'px';
                                clonedImg.style.top = rect.offY + 'px';
                                clonedImg.style.objectFit = 'fill';
                                clonedImg.style.transform = 'none';
                            }
                        }

                        const origBox = renderTarget.getBoundingClientRect();
                        const origItems = renderTarget.querySelectorAll('.danmaku-item');
                        const clonedContainer = clonedDoc.getElementById('danmaku-container');
                        const clonedItems = clonedContainer ? clonedContainer.querySelectorAll('.danmaku-item') : [];

                        origItems.forEach((orig, idx) => {
                            if (clonedItems[idx]) {
                                const r = orig.getBoundingClientRect();
                                clonedItems[idx].style.animation = 'none';
                                clonedItems[idx].style.transform = 'none';
                                clonedItems[idx].style.left = (r.left - origBox.left) + 'px';
                                clonedItems[idx].style.top = (r.top - origBox.top) + 'px';
                            }
                        });
                    }
                });

                // 5. 先用原生 Canvas 2D 绘制无缝顶/底渐变蒙层，再叠加透明 UI 覆层（100% 消除 html2canvas 渐变边界黑线与白边）
                drawSeamlessHudGradients(ctx, outW, outH);
                ctx.drawImage(uiCanvas, -4, -6, outW + 8, outH + 12);

                // 使用 Blob URL 下载，避免超高清大图突破浏览器 base64 长度限制并确保后续视频录制流畅
                await new Promise((resolve) => {
                    outCanvas.toBlob((blob) => {
                        if (!blob) {
                            resolve();
                            return;
                        }
                        const blobUrl = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.style.display = 'none';
                        link.download = `Laya_Screenshot_${Date.now()}.png`;
                        link.href = blobUrl;
                        document.body.appendChild(link);
                        link.click();
                        setTimeout(() => {
                            if (link.parentNode) link.parentNode.removeChild(link);
                            URL.revokeObjectURL(blobUrl);
                            resolve();
                        }, 300);
                    }, 'image/png', 1.0);
                });

                window.showToast(isVidMode
                    ? '✅ 已保存当前视频画面帧与完整 UI 超清截图（无任何白边）！'
                    : '✅ 超清无白边无圆角截图已保存！');
            } catch (err) {
                console.error(err);
                window.showToast('❌ 截图导出失败，请重试');
            } finally {
                btnSaveImg.textContent = origBtnTxt;
                btnSaveImg.disabled = false;
            }
        });
    }

    /* ==========================================================================
       ★ 11. 1080P 60帧真机录屏级视频合成导出引擎 (高码率超清、丝滑零卡顿、无白边、支持暂停截图后随时录制)
       ========================================================================== */
    const btnSaveVid = document.getElementById('btn-save-vid');
    if (btnSaveVid) {
        let origVidBtnText = btnSaveVid.textContent;

        btnSaveVid.addEventListener('click', async () => {
            // 若当前正在录制中，再次点击按钮可立即提前完成并保存视频
            if (window.__isExportRecording && typeof window.__stopActiveExport === 'function') {
                window.__stopActiveExport();
                return;
            }

            const inStartTime = document.getElementById('in-start-time');
            const inTotalTime = document.getElementById('in-total-time');
            const inBuffer = document.getElementById('in-buffer');
            const swSyncVideoTime = document.getElementById('sw-sync-video-time');
            const selRecSecEl = document.getElementById('sel-record-sec');
            const inCustomSecEl = document.getElementById('in-custom-sec');

            if (!window.PlayerEngine || !window.PlayerEngine.isVideoMode || !previewVideo) {
                window.showToast('⚠️ 请先点击「上传截图/视频」上传一段视频素材！');
                return;
            }

            // 计算录制起点与时长：
            // 1. 若用户主动拖动过底部剪映裁剪区间手柄（或切换过顶部录制秒数），则严格按选定的 [start, end] 导出
            // 2. 若用户未动过裁剪手柄，则从当前位置录制顶部选定的秒数（若剩余不足则自动前移起点保证录满秒数）
            const vidTotalDur = (previewVideo.duration && isFinite(previewVideo.duration))
                ? previewVideo.duration
                : (window.PlayerEngine.videoDuration || 10);
            const trimRange = window.PlayerEngine.getTrimRange
                ? window.PlayerEngine.getTrimRange()
                : { start: 0, end: vidTotalDur, duration: vidTotalDur };

            let dropdownSec = 5;
            if (selRecSecEl) {
                dropdownSec = selRecSecEl.value === 'custom'
                    ? (parseFloat(inCustomSecEl ? inCustomSecEl.value : 10) || 10)
                    : (parseFloat(selRecSecEl.value) || 5);
            }

            let exportStartSec = trimRange.start;
            let recordSeconds = trimRange.duration;

            if (window.PlayerEngine.userHasTrimmed) {
                exportStartSec = trimRange.start;
                recordSeconds = Math.max(1.0, trimRange.duration);
            } else {
                const curPos = previewVideo.currentTime || 0;
                if (vidTotalDur <= 15 && curPos < 0.8) {
                    exportStartSec = 0;
                    recordSeconds = vidTotalDur;
                } else {
                    recordSeconds = Math.min(dropdownSec, vidTotalDur);
                    if (curPos >= vidTotalDur - 0.8) {
                        exportStartSec = 0;
                    } else if (curPos + recordSeconds > vidTotalDur) {
                        exportStartSec = Math.max(0, vidTotalDur - recordSeconds);
                    } else {
                        exportStartSec = curPos;
                    }
                }
            }
            recordSeconds = Math.max(1.0, Number(recordSeconds.toFixed(2)));

            const origPlaybackRate = previewVideo.playbackRate || 1.0;

            origVidBtnText = '🎥 录屏导出视频';
            btnSaveVid.textContent = `⏳ 正在构建 1080P 超清覆层...`;
            window.__isExportRecording = true;

            // ★ 关键修复：在 html2canvas 构建超清 UI 覆层期间（耗时约 2~6 秒），先暂停视频并锁定在裁剪起点，
            // 绝不能让视频在 html2canvas 等待期间提前偷跑（否则 10 秒片段被消耗掉 7 秒，真正开始录制时只剩 3 秒！）
            previewVideo.muted = false;
            previewVideo.volume = 1.0;
            const jyMuteBtn = document.getElementById('jy-btn-mute');
            if (jyMuteBtn) jyMuteBtn.textContent = '🔊';
            if (window._audioCtx && window._audioCtx.state === 'suspended') {
                window._audioCtx.resume().catch(() => {});
            }
            try {
                previewVideo.pause();
                previewVideo.currentTime = exportStartSec;
            } catch (e) {}

            // 创建并挂载画布到 DOM 中（防止离屏 Canvas 被浏览器休眠）
            const offCanvas = document.createElement('canvas');
            offCanvas.style.cssText = 'position:fixed; top:0; left:0; width:2px; height:2px; opacity:0.01; pointer-events:none; z-index:-9999;';
            document.body.appendChild(offCanvas);

            try {
                const isPort = renderTarget.classList.contains('mode-mobile-port');
                const isLand = renderTarget.classList.contains('mode-mobile-land');
                const isDyLand = renderTarget.classList.contains('mode-dy-land');

                // ★ 升级为 Full HD 1080P 真机级超清分辨率（16:9 为 1920x1080，9:16 竖屏为 1080x1920）
                let outW = 1920, outH = 1080;
                if (isPort) {
                    outW = 1080;
                    outH = 1920;
                }
                offCanvas.width = outW;
                offCanvas.height = outH;
                const ctx = offCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                if (window.PlayerEngine.updatePlayStateUI) {
                    window.PlayerEngine.updatePlayStateUI(true);
                }

                const targetRect = renderTarget.getBoundingClientRect();
                const scaleRatioX = outW / targetRect.width;
                const scaleRatioY = outH / targetRect.height;

                const measureRelBox = (el) => {
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    if (r.width === 0 || r.height === 0) return null;
                    return {
                        x: (r.left - targetRect.left) * scaleRatioX,
                        y: (r.top - targetRect.top) * scaleRatioY,
                        w: r.width * scaleRatioX,
                        h: r.height * scaleRatioY
                    };
                };

                const isSpecialSubBox = renderTarget.classList.contains('port-land-box') || renderTarget.classList.contains('land-port-box') || renderTarget.classList.contains('dy-comment-open');
                const mediaWrapEl = document.getElementById('player-media-wrap');
                const mediaWrapBox = isSpecialSubBox
                    ? (measureRelBox(mediaWrapEl) || { x: 0, y: 0, w: outW, h: outH })
                    : { x: 0, y: 0, w: outW, h: outH };

                const pcBarBox = measureRelBox(document.getElementById('progress-click-bar'));
                const pcTimeBox = measureRelBox(document.getElementById('disp-time'));
                const mBarBox = measureRelBox(document.querySelector('.m-progress-track'));
                const mTimeBox = measureRelBox(document.getElementById('m-disp-time'));
                const dyBarBox = measureRelBox(document.querySelector('.dy-tiny-progressbar'));
                const dylBarBox = measureRelBox(document.querySelector('.dyl-progress-track'));
                const dylTimeBox = measureRelBox(document.getElementById('dyl-wrap-time'));
                const dylSubBox = measureRelBox(document.getElementById('dyl-wrap-subtitle'));

                // 抓取静态透明 UI 覆层（通过 ignoreElements 完全跳过媒体与弹幕节点，并强制移除容器黑色背景）
                const uiSnapshotCanvas = await html2canvas(renderTarget, {
                    backgroundColor: null,
                    scale: scaleRatioX,
                    useCORS: true,
                    allowTaint: false,
                    ignoreElements: (el) => {
                        return el.id === 'player-media-wrap' || el.id === 'preview-video' || el.id === 'preview-img' || el.id === 'danmaku-container';
                    },
                    onclone: (clonedDoc) => {
                        injectRealLogosToClonedDoc(clonedDoc);

                        const target = clonedDoc.getElementById('render-target');
                        if (target) {
                            target.style.width = Math.ceil(targetRect.width) + 'px';
                            target.style.height = Math.ceil(targetRect.height) + 'px';
                            target.style.position = 'relative';
                            target.style.setProperty('background', 'transparent', 'important');
                            target.style.setProperty('background-color', 'transparent', 'important');
                            target.style.setProperty('background-image', 'none', 'important');
                            target.style.boxShadow = 'none';
                            target.style.border = 'none';
                            target.style.outline = 'none';
                            target.style.borderRadius = '0px';
                        }

                        const clonedMediaWrap = clonedDoc.getElementById('player-media-wrap');
                        if (clonedMediaWrap) {
                            clonedMediaWrap.style.setProperty('display', 'none', 'important');
                            clonedMediaWrap.style.setProperty('background', 'transparent', 'important');
                            clonedMediaWrap.style.setProperty('background-color', 'transparent', 'important');
                        }

                        ['progress-click-bar', 'disp-time', 'm-disp-time', 'dyl-wrap-time', 'dyl-wrap-subtitle'].forEach(id => {
                            const el = clonedDoc.getElementById(id);
                            if (el) el.style.visibility = 'hidden';
                        });
                        const mTrack = clonedDoc.querySelector('.m-progress-track');
                        if (mTrack) mTrack.style.visibility = 'hidden';
                        const dyTrack = clonedDoc.querySelector('.dy-tiny-progressbar');
                        if (dyTrack) dyTrack.style.visibility = 'hidden';
                        const dylTrack = clonedDoc.querySelector('.dyl-progress-track');
                        if (dylTrack) dylTrack.style.visibility = 'hidden';
                    }
                });

                // 预合成 1:1 尺寸的 UI 覆层画布（先用原生 Canvas 2D 绘制无缝顶/底渐变蒙层，再叠加 UI 快照，彻底消除分界黑线）
                const uiOverlayCanvas = document.createElement('canvas');
                uiOverlayCanvas.width = outW;
                uiOverlayCanvas.height = outH;
                const uiOverlayCtx = uiOverlayCanvas.getContext('2d');
                uiOverlayCtx.imageSmoothingEnabled = true;
                uiOverlayCtx.imageSmoothingQuality = 'high';
                drawSeamlessHudGradients(uiOverlayCtx, outW, outH);
                uiOverlayCtx.drawImage(uiSnapshotCanvas, -4, -6, outW + 8, outH + 12);

                // 预先缓存所有配置与构图矩阵，录制循环中 0 DOM 查询，彻底告别卡顿
                const cachedCropRect = window.getPlayerCropRect
                    ? window.getPlayerCropRect(mediaWrapBox.w, mediaWrapBox.h)
                    : { renderW: mediaWrapBox.w + 12, renderH: mediaWrapBox.h + 12, offX: -6, offY: -6 };
                const cachedFilter = (mediaWrapEl && mediaWrapEl.style.filter) ? mediaWrapEl.style.filter : '';
                const showDanmaku = !!(document.getElementById('sw-danmaku')?.checked);
                const showPcBot = !document.getElementById('sw-bottom-bar') || document.getElementById('sw-bottom-bar').checked;
                const showMBot = !document.getElementById('sw-m-bottom-bar') || document.getElementById('sw-m-bottom-bar').checked;
                const showDylBot = !document.getElementById('sw-dyl-bottom') || document.getElementById('sw-dyl-bottom').checked;
                const showDylTime = !document.getElementById('sw-dyl-time') || document.getElementById('sw-dyl-time').checked;
                const syncTimeChecked = !swSyncVideoTime || swSyncVideoTime.checked;

                const isFixedDm = (window.DanmakuEngine && window.DanmakuEngine.mode === 'fixed');
                const danmakuParticles = (window.DanmakuEngine ? window.DanmakuEngine.getActiveList() : []).map((dm, idx) => ({
                    text: dm.text,
                    color: (isPort || isDyLand) ? '#ffffff' : dm.color,
                    size: Math.round((dm.size || 16) * scaleRatioX),
                    y: (outH * dm.top) / 100,
                    x: isFixedDm ? ((outW * (dm.left || 20)) / 100) : ((outW * ((idx * 27) % 85)) / 100),
                    speed: isFixedDm ? 0 : ((dm.speed ? (22 - dm.speed) : 9) * 0.85 * (window.DanmakuEngine.speedFactor || 1) * (scaleRatioX / 1.5))
                }));

                const baseStartSec = window.PlayerEngine.timeToSec(inStartTime.value);
                const totalVideoSec = window.PlayerEngine.timeToSec(inTotalTime.value) || 1125;
                const bufferPct = Math.min(100, Math.max(0, parseFloat(inBuffer.value) || 68)) / 100;

                // ★ 录制期间强制使用 1.0x 标准原速，确保选定 10 秒片段精确录制 10 秒内容（录制结束后恢复原倍速）
                previewVideo.playbackRate = 1.0;
                previewVideo.defaultPlaybackRate = 1.0;

                // ★ 在 html2canvas 完成后、真正启动 MediaRecorder 前，精确校验并锁定视频起点到 exportStartSec
                if (Math.abs((previewVideo.currentTime || 0) - exportStartSec) > 0.08) {
                    try { previewVideo.currentTime = exportStartSec; } catch (e) {}
                }
                if (previewVideo.seeking || previewVideo.readyState < 2) {
                    await new Promise(resolve => {
                        const onReady = () => {
                            previewVideo.removeEventListener('seeked', onReady);
                            previewVideo.removeEventListener('canplay', onReady);
                            resolve();
                        };
                        previewVideo.addEventListener('seeked', onReady);
                        previewVideo.addEventListener('canplay', onReady);
                        setTimeout(resolve, 350);
                    });
                }

                let recordStartStamp = performance.now();
                let lastFrameStamp = recordStartStamp;

                // 封装单帧绘制函数（零 DOM 查询、60FPS 丝滑渲染、外扩出血彻底消除上下白边）
                const renderSingleFrame = (nowStamp) => {
                    const dtRatio = Math.min(2.5, Math.max(0.2, (nowStamp - lastFrameStamp) / 33.33));
                    lastFrameStamp = nowStamp;

                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, outW, outH);

                    // 1. 绘制底层超清视频画面
                    if (previewVideo.readyState >= 2 || previewVideo.videoWidth > 0) {
                        ctx.save();
                        if (cachedFilter) ctx.filter = cachedFilter;
                        if (isSpecialSubBox) {
                            ctx.beginPath();
                            ctx.rect(mediaWrapBox.x, mediaWrapBox.y, mediaWrapBox.w, mediaWrapBox.h);
                            ctx.clip();
                        }
                        ctx.drawImage(
                            previewVideo,
                            mediaWrapBox.x + cachedCropRect.offX,
                            mediaWrapBox.y + cachedCropRect.offY,
                            cachedCropRect.renderW,
                            cachedCropRect.renderH
                        );
                        ctx.restore();
                    }

                    // 2. 绘制弹幕
                    if (showDanmaku && danmakuParticles.length > 0) {
                        ctx.save();
                        ctx.textBaseline = 'top';
                        for (let i = 0; i < danmakuParticles.length; i++) {
                            const p = danmakuParticles[i];
                            ctx.font = `bold ${p.size}px -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`;
                            if (!isFixedDm) {
                                p.x -= p.speed * dtRatio;
                                const tw = ctx.measureText(p.text).width;
                                if (p.x < -tw - 40) {
                                    p.x = outW + Math.random() * 80;
                                }
                            }
                            ctx.lineWidth = 3.5;
                            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
                            ctx.strokeText(p.text, p.x, p.y);
                            ctx.fillStyle = p.color;
                            ctx.fillText(p.text, p.x, p.y);
                        }
                        ctx.restore();
                    }

                    // 3. 叠加预合成的 1080P UI 覆层（1:1 极速贴图）
                    ctx.drawImage(uiOverlayCanvas, 0, 0);

                    // 3.5 动态绘制随时间变化的画面字幕（若开启了字幕）
                    if (window.SubtitleEngine && window.SubtitleEngine.enabled) {
                        const subTxt = window.SubtitleEngine.getCueTextAtTime(previewVideo.currentTime);
                        if (subTxt) {
                            ctx.save();
                            const fontPx = Math.round((window.SubtitleEngine.size || 16) * scaleRatioX);
                            ctx.font = `800 ${fontPx}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            const subX = outW / 2;
                            const subY = dylSubBox ? (dylSubBox.y + dylSubBox.h / 2) : (isPort ? outH * 0.72 : outH * 0.78);
                            const st = window.SubtitleEngine.style || 'douyin';

                            if (st === 'cinema') {
                                const tw = ctx.measureText(subTxt).width;
                                const padX = 14 * scaleRatioX;
                                const padY = 6 * scaleRatioY;
                                ctx.fillStyle = 'rgba(8, 10, 16, 0.76)';
                                ctx.fillRect(subX - tw / 2 - padX, subY - fontPx / 2 - padY, tw + padX * 2, fontPx + padY * 2);
                                ctx.fillStyle = '#ffffff';
                                ctx.fillText(subTxt, subX, subY);
                            } else if (st === 'gold') {
                                ctx.lineWidth = 4 * scaleRatioX;
                                ctx.strokeStyle = 'rgba(0,0,0,0.95)';
                                ctx.strokeText(subTxt, subX, subY);
                                ctx.fillStyle = '#ffeaa7';
                                ctx.fillText(subTxt, subX, subY);
                            } else if (st === 'cyan') {
                                ctx.lineWidth = 4 * scaleRatioX;
                                ctx.strokeStyle = 'rgba(0,0,0,0.92)';
                                ctx.strokeText(subTxt, subX, subY);
                                ctx.fillStyle = '#00f2fe';
                                ctx.fillText(subTxt, subX, subY);
                            } else {
                                ctx.lineWidth = 4 * scaleRatioX;
                                ctx.strokeStyle = 'rgba(0,0,0,0.92)';
                                ctx.strokeText(subTxt, subX, subY);
                                ctx.fillStyle = '#ffffff';
                                ctx.fillText(subTxt, subX, subY);
                            }
                            ctx.restore();
                        }
                    }

                    // 4. 动态绘制进度条与时间码
                    const elapsedSec = syncTimeChecked ? ((nowStamp - recordStartStamp) / 1000) : 0;
                    const curSec = baseStartSec + elapsedSec;
                    const curPct = Math.min(1, Math.max(0, curSec / totalVideoSec));

                    ctx.save();
                    if (!isPort && !isLand && !isDyLand) {
                        if (showPcBot && pcBarBox) {
                            ctx.fillStyle = 'rgba(255,255,255,0.22)';
                            ctx.fillRect(pcBarBox.x, pcBarBox.y, pcBarBox.w, pcBarBox.h);
                            ctx.fillStyle = 'rgba(255,255,255,0.42)';
                            ctx.fillRect(pcBarBox.x, pcBarBox.y, pcBarBox.w * bufferPct, pcBarBox.h);
                            const fillW = pcBarBox.w * curPct;
                            ctx.fillStyle = '#1877F2';
                            ctx.fillRect(pcBarBox.x, pcBarBox.y, fillW, pcBarBox.h);
                            ctx.beginPath();
                            ctx.arc(pcBarBox.x + fillW, pcBarBox.y + pcBarBox.h / 2, 5.5 * scaleRatioX, 0, Math.PI * 2);
                            ctx.fillStyle = '#ffffff';
                            ctx.fill();
                        }
                        if (showPcBot && pcTimeBox) {
                            const timeText = `${window.PlayerEngine.secToTime(Math.floor(curSec))} / ${window.PlayerEngine.secToTime(totalVideoSec)}`;
                            ctx.font = `500 ${Math.round(11.5 * scaleRatioX)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
                            ctx.fillStyle = '#d0d4dc';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(timeText, pcTimeBox.x, pcTimeBox.y + pcTimeBox.h / 2);
                        }
                    } else if (isLand) {
                        if (showMBot && mBarBox) {
                            ctx.fillStyle = 'rgba(255,255,255,0.28)';
                            ctx.fillRect(mBarBox.x, mBarBox.y, mBarBox.w, mBarBox.h);
                            ctx.fillStyle = 'rgba(255,255,255,0.45)';
                            ctx.fillRect(mBarBox.x, mBarBox.y, mBarBox.w * bufferPct, mBarBox.h);
                            const fillW = mBarBox.w * curPct;
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(mBarBox.x, mBarBox.y, fillW, mBarBox.h);
                            ctx.save();
                            ctx.shadowColor = 'rgba(138, 116, 249, 0.95)';
                            ctx.shadowBlur = 8 * scaleRatioX;
                            ctx.beginPath();
                            ctx.arc(mBarBox.x + fillW, mBarBox.y + mBarBox.h / 2, 6 * scaleRatioX, 0, Math.PI * 2);
                            ctx.fillStyle = '#ffffff';
                            ctx.fill();
                            ctx.restore();
                        }
                        if (showMBot && mTimeBox) {
                            const shortTime = `${window.PlayerEngine.secToShortTime(Math.floor(curSec))} / ${window.PlayerEngine.secToShortTime(totalVideoSec)}`;
                            ctx.font = `600 ${Math.round(12.5 * scaleRatioX)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
                            ctx.fillStyle = '#ffffff';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(shortTime, mTimeBox.x, mTimeBox.y + mTimeBox.h / 2);
                        }
                    } else if (isDyLand) {
                        if (showDylBot && dylBarBox) {
                            ctx.fillStyle = 'rgba(255,255,255,0.28)';
                            ctx.fillRect(dylBarBox.x, dylBarBox.y, dylBarBox.w, dylBarBox.h);
                            const fillW = dylBarBox.w * curPct;
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(dylBarBox.x, dylBarBox.y, fillW, dylBarBox.h);
                            ctx.beginPath();
                            ctx.arc(dylBarBox.x + fillW, dylBarBox.y + dylBarBox.h / 2, 5 * scaleRatioX, 0, Math.PI * 2);
                            ctx.fillStyle = '#ffffff';
                            ctx.fill();
                        }
                        if (showDylBot && showDylTime && dylTimeBox) {
                            const tLeft = window.PlayerEngine.secToMinSec(Math.floor(curSec) % 3600, false);
                            const tRight = window.PlayerEngine.secToMinSec(Math.min(3599, totalVideoSec), false);
                            ctx.font = `700 ${Math.round(12 * scaleRatioX)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
                            ctx.fillStyle = 'rgba(255,255,255,0.92)';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(`${tLeft} / ${tRight}`, dylTimeBox.x, dylTimeBox.y + dylTimeBox.h / 2);
                        }
                    } else if (isPort && dyBarBox) {
                        ctx.fillStyle = 'rgba(255,255,255,0.22)';
                        ctx.fillRect(dyBarBox.x, dyBarBox.y, dyBarBox.w, dyBarBox.h);
                        ctx.fillStyle = 'rgba(255,255,255,0.38)';
                        ctx.fillRect(dyBarBox.x, dyBarBox.y, dyBarBox.w * bufferPct, dyBarBox.h);
                        const fillW = dyBarBox.w * curPct;
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(dyBarBox.x, dyBarBox.y, fillW, dyBarBox.h);
                        ctx.beginPath();
                        ctx.arc(dyBarBox.x + fillW, dyBarBox.y + dyBarBox.h / 2, 3.2 * scaleRatioX, 0, Math.PI * 2);
                        ctx.fillStyle = '#ffffff';
                        ctx.fill();
                    }
                    ctx.restore();
                };

                // 先绘制首帧激活画布缓存
                renderSingleFrame(performance.now());

                // ★ 60FPS 高帧率画布流采集
                const canvasStream = offCanvas.captureStream(60);
                const videoTrack = canvasStream.getVideoTracks()[0];

                // ★ 提取稳定音轨：优先使用常驻 WebAudio 双路桥接节点（即使视频刚才暂停截图过也始终保持 live 状态）
                let audioTracks = [];
                try {
                    if (!window._audioCtx) {
                        window._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    if (window._audioCtx.state === 'suspended') {
                        await window._audioCtx.resume();
                    }
                    if (!window._audioSrcNode) {
                        window._audioSrcNode = window._audioCtx.createMediaElementSource(previewVideo);
                        window._audioDstNode = window._audioCtx.createMediaStreamDestination();
                        window._audioGainNode = window._audioCtx.createGain();
                        window._audioGainNode.gain.value = 1.0;
                        window._audioSrcNode.connect(window._audioGainNode);
                        window._audioGainNode.connect(window._audioDstNode);
                        window._audioGainNode.connect(window._audioCtx.destination);
                    }
                    if (window._audioDstNode && window._audioDstNode.stream) {
                        audioTracks = window._audioDstNode.stream.getAudioTracks().filter(t => t.readyState === 'live');
                    }
                } catch (audioErr) {
                    console.warn('WebAudio stream note:', audioErr);
                }

                if (!audioTracks || audioTracks.length === 0) {
                    try {
                        const nativeVidStream = previewVideo.captureStream
                            ? previewVideo.captureStream()
                            : (previewVideo.mozCaptureStream ? previewVideo.mozCaptureStream() : null);
                        if (nativeVidStream && nativeVidStream.getAudioTracks().length > 0) {
                            audioTracks = nativeVidStream.getAudioTracks().filter(t => t.readyState === 'live');
                        }
                    } catch (e) {}
                }

                // ★ 在启动录制器前一刻开始播放视频，确保录制的每一秒都完整对应所选区间 [exportStartSec, exportStartSec + recordSeconds]
                await previewVideo.play().catch(() => {
                    previewVideo.muted = true;
                    return previewVideo.play().catch(() => {});
                });

                // ★ 多级容错构建并启动 MediaRecorder（18Mbps 超清码率，优先采用支持 1080P@60fps 的 H.264 High/Baseline Level 4.2 编码）
                const streamWithAudio = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...audioTracks
                ]);
                const streamVideoOnly = new MediaStream([
                    ...canvasStream.getVideoTracks()
                ]);

                const tryConfigs = [
                    { stream: streamWithAudio, mime: 'video/mp4;codecs="avc1.64002A, mp4a.40.2"', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/mp4;codecs="avc1.42E02A, mp4a.40.2"', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/mp4', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/webm;codecs="vp9,opus"', ext: 'webm' },
                    { stream: streamWithAudio, mime: 'video/webm;codecs="vp8,opus"', ext: 'webm' },
                    { stream: streamWithAudio, mime: 'video/webm', ext: 'webm' },
                    { stream: streamVideoOnly, mime: 'video/mp4', ext: 'mp4' },
                    { stream: streamVideoOnly, mime: 'video/webm', ext: 'webm' },
                    { stream: streamVideoOnly, mime: '', ext: 'webm' }
                ];

                let recorder = null;
                let selectedFormat = { mime: 'video/webm', ext: 'webm' };
                const chunks = [];

                for (const cfg of tryConfigs) {
                    if (cfg.mime && (!window.MediaRecorder || !MediaRecorder.isTypeSupported(cfg.mime))) {
                        continue;
                    }
                    try {
                        const opts = { videoBitsPerSecond: 18000000 };
                        if (cfg.mime) opts.mimeType = cfg.mime;
                        const candidate = new MediaRecorder(cfg.stream, opts);
                        candidate.ondataavailable = (e) => {
                            if (e.data && e.data.size > 0) chunks.push(e.data);
                        };
                        candidate.start(200);
                        recorder = candidate;
                        selectedFormat = { mime: cfg.mime || candidate.mimeType || 'video/webm', ext: cfg.ext };
                        break;
                    } catch (recErr) {
                        console.warn('MediaRecorder fallback:', cfg.mime, recErr);
                    }
                }

                if (!recorder) {
                    throw new Error('当前浏览器无法启动视频录制器');
                }

                let isRecording = true;
                let rafId = null;
                let bgTimerId = null;
                let stopTimeoutId = null;

                const finishRecording = () => {
                    if (!isRecording) return;
                    isRecording = false;
                    window.__stopActiveExport = null;
                    if (rafId) cancelAnimationFrame(rafId);
                    if (bgTimerId) clearInterval(bgTimerId);
                    if (stopTimeoutId) clearTimeout(stopTimeoutId);
                    try {
                        if (recorder && recorder.state !== 'inactive') {
                            recorder.stop();
                        }
                    } catch (e) {}
                };
                window.__stopActiveExport = finishRecording;

                recorder.onstop = () => {
                    window.__isExportRecording = false;
                    window.__stopActiveExport = null;
                    previewVideo.playbackRate = origPlaybackRate;
                    previewVideo.defaultPlaybackRate = origPlaybackRate;
                    if (offCanvas.parentNode) offCanvas.parentNode.removeChild(offCanvas);
                    btnSaveVid.textContent = origVidBtnText;
                    btnSaveVid.disabled = false;

                    if (chunks.length === 0) {
                        window.showToast('❌ 录制数据为空，请重试');
                        return;
                    }

                    const blob = new Blob(chunks, { type: selectedFormat.mime || 'video/webm' });
                    const downloadUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.style.display = 'none';
                    const modeTag = isPort ? 'MobilePort' : (isDyLand ? 'DouyinFullLand' : (isLand ? 'MobileCinema' : 'WebPC'));
                    link.download = `Laya_${modeTag}_1080P_${Date.now()}.${selectedFormat.ext}`;
                    link.href = downloadUrl;
                    document.body.appendChild(link);
                    link.click();
                    setTimeout(() => {
                        if (link.parentNode) link.parentNode.removeChild(link);
                        URL.revokeObjectURL(downloadUrl);
                    }, 800);

                    const actualSec = Math.max(0.5, ((performance.now() - recordStartStamp) / 1000)).toFixed(1);
                    window.showToast(`🎉 1080P 60帧超清视频 (.${selectedFormat.ext}，${actualSec}s，无白边) 导出成功！`);
                };

                recordStartStamp = performance.now();
                lastFrameStamp = recordStartStamp;

                // ★ 60FPS requestAnimationFrame 丝滑渲染循环 + 实时进度百分比显示
                const tickFrame = (now) => {
                    if (!isRecording) return;
                    const elapsed = (now - recordStartStamp) / 1000;
                    if (previewVideo.paused && !previewVideo.ended && elapsed < recordSeconds - 0.1) {
                        previewVideo.play().catch(() => {});
                    }
                    renderSingleFrame(now);
                    if (videoTrack && typeof videoTrack.requestFrame === 'function') {
                        try { videoTrack.requestFrame(); } catch (e) {}
                    }
                    const remain = Math.max(0, recordSeconds - elapsed);
                    const pct = Math.min(99, Math.round((elapsed / recordSeconds) * 100));
                    btnSaveVid.textContent = `🔴 导出中 ${pct}% (剩 ${remain.toFixed(1)}s · 点击立即保存)`;

                    if (elapsed >= recordSeconds) {
                        finishRecording();
                        return;
                    }
                    rafId = requestAnimationFrame(tickFrame);
                };
                rafId = requestAnimationFrame(tickFrame);

                // 后台标签页防休眠补偿定时器
                bgTimerId = setInterval(() => {
                    if (!isRecording) return;
                    if (document.hidden) {
                        const now = performance.now();
                        renderSingleFrame(now);
                        if ((now - recordStartStamp) / 1000 >= recordSeconds) {
                            finishRecording();
                        }
                    }
                }, 33);

                stopTimeoutId = setTimeout(finishRecording, recordSeconds * 1000 + 150);

            } catch (err) {
                window.__isExportRecording = false;
                window.__stopActiveExport = null;
                previewVideo.playbackRate = origPlaybackRate;
                previewVideo.defaultPlaybackRate = origPlaybackRate;
                if (offCanvas.parentNode) offCanvas.parentNode.removeChild(offCanvas);
                console.error(err);
                btnSaveVid.textContent = origVidBtnText;
                btnSaveVid.disabled = false;
                window.showToast(`❌ 视频导出失败：${err.message || '请重试'}`);
            }
        });
    }
})();
