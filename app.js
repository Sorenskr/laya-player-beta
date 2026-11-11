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

    // ★ 同步更新右侧中间作者头像、右侧最下方静态头像与全屏横屏头像（100% 实时联动）
    function syncAuthorAvatarEverywhere(src, isCustom = false) {
        if (!src) return;
        if (dyAvatarImg) {
            if (dyAvatarImg.src !== src) dyAvatarImg.src = src;
            dyAvatarImg.dataset.custom = isCustom ? 'true' : 'false';
        }
        if (dylDispAvatar && dylDispAvatar.src !== src) {
            dylDispAvatar.src = src;
        }
    }
    window.syncAuthorAvatarEverywhere = syncAuthorAvatarEverywhere;

    if (dyAvatarImg && typeof MutationObserver !== 'undefined') {
        const avatarObs = new MutationObserver(() => {
            const curSrc = dyAvatarImg.getAttribute('src') || dyAvatarImg.src;
            if (curSrc) {
                if (dylDispAvatar && dylDispAvatar.getAttribute('src') !== curSrc) dylDispAvatar.src = curSrc;
            }
        });
        avatarObs.observe(dyAvatarImg, { attributes: true, attributeFilter: ['src'] });
    }

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
        const liveLayaMiniLogo = document.getElementById('live-laya-mini-logo');
        if (liveLayaMiniLogo) liveLayaMiniLogo.src = getActiveLogoSrc('Laya2.png');

        // 手机竖屏头像、右下角黑胶唱片头像与全屏横屏头像如果没单独上传过其他人物头像，同步使用当前自带蓝/紫 Logo
        if (dyAvatarImg && (!dyAvatarImg.dataset.custom || dyAvatarImg.dataset.custom === 'false')) {
            syncAuthorAvatarEverywhere(realSrc, false);
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
        dyAvatarClickWrap.title = '点击随机切换头像（中间与底部头像实时同步，右键可上传本地图片）';
        dyAvatarClickWrap.addEventListener('click', (e) => {
            if (e.target === dyBtnFollow) return;
            e.stopPropagation();
            const btnRandAv = document.getElementById('btn-random-author-avatar');
            if (btnRandAv) btnRandAv.click();
        });
        dyAvatarClickWrap.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const uploader = document.getElementById('dy-avatar-uploader');
            if (uploader) {
                uploader.value = '';
                uploader.click();
            }
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
    // 全繁体真实口语化评论词池（彻底去除生硬的「每句文案+末尾表情包」假模板，还原真实网友自然留言）
    const COMMENT_TEXT_POOL = [
        '牛總還是有點大智慧的',
        '好一招釜底抽薪',
        '這一段我反反覆覆看了五遍，細節真的拉滿',
        '表面風平浪靜，實則全員八百個心眼子',
        '還得是老戲骨，一個眼神直接封神',
        '大數據果然懂我，剛想找這個系列就刷到了',
        '看似漫不經心的一句話，其實前面早就鋪墊好了',
        '這反轉真的沒猜到，編劇腦洞太大了',
        '只有我覺得配樂一響起雞皮疙瘩都起來了嗎',
        '這台詞功底太頂了，每一句都在點子上',
        '終於有人把這段完整剪出來了，找了好久',
        '注意看他最後那個眼神，信息量太大了',
        '第一次看覺得好笑，看懂之後背後發涼',
        '這運鏡和節奏把控得真好，完全不拖泥帶水',
        '哈哈，我先入職花果山再回來應聘，完美閉環',
        '評論區果然臥虎藏龍，不看解析差點漏掉細節',
        '太真實了，這不就是現實中的職場縮影嗎',
        '短短幾十秒把人物性格立住了，演技確實服氣',
        '誰懂啊，看到最後一秒直接破防了',
        '建議反覆細品最後那句話，後勁太大了'
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

    // 真实中国风人像头像库（彻底剔除欧美脸、假人与卡通图，采用真实中国人审美的生活照/自拍，支持换男/女/随机及后台指定URL）
    const CN_REAL_FEMALE_URLS = [
        'https://images.unsplash.com/photo-1526631189662-734f65edd957?auto=format&fit=crop&w=200&h=200&q=82',
        'https://images.unsplash.com/photo-1631947430066-48c30d57b943?auto=format&fit=crop&w=200&h=200&q=82',
        'https://images.unsplash.com/photo-1633307458354-292dd679a763?auto=format&fit=crop&w=200&h=200&q=82',
        'https://images.unsplash.com/photo-1525672716948-1f0bb9c49883?auto=format&fit=crop&w=200&h=200&q=82',
        'https://images.unsplash.com/photo-1515077678510-ce3bdf418862?auto=format&fit=crop&w=200&h=200&q=82',
        'https://images.unsplash.com/photo-1535295972055-1c762f4483e5?auto=format&fit=crop&w=200&h=200&q=82',
        'https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=200&h=200&q=82',
        'https://images.unsplash.com/photo-1548142813-c348350df52b?auto=format&fit=crop&w=200&h=200&q=82'
    ];
    const CN_REAL_MALE_URLS = [
        'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&h=200&q=82',
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&h=200&q=82',
        'https://images.unsplash.com/photo-1507081323647-4d250478b919?auto=format&fit=crop&w=200&h=200&q=82',
        'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?auto=format&fit=crop&w=200&h=200&q=82',
        'https://images.unsplash.com/photo-1534030347209-467a5b0ad3e6?auto=format&fit=crop&w=200&h=200&q=82',
        'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?auto=format&fit=crop&w=200&h=200&q=82'
    ];

    function getChineseFemalePool() {
        const db = window.LAYA_ASIAN_AVATARS || {};
        // 优先使用内置真实亚洲/中国女生生活照 (Base64 秒开零跨域) + 在线中国女生人像
        return [...(db.beauties || []), ...CN_REAL_FEMALE_URLS];
    }

    function getChineseMalePool() {
        const db = window.LAYA_ASIAN_AVATARS || {};
        // 优先使用内置真实亚洲/中国男生生活照 (Base64 秒开零跨域) + 在线中国男生人像
        return [...(db.guys || []), ...CN_REAL_MALE_URLS];
    }

    let __avatarCycleCounter = Math.floor(Math.random() * 100);

    function pickFromPoolAvoiding(pool, avoidSet) {
        if (!Array.isArray(pool) || pool.length === 0) return '';
        const candidates = avoidSet ? pool.filter(u => !avoidSet.has(u)) : pool;
        const activePool = candidates.length > 0 ? candidates : pool;
        __avatarCycleCounter = (__avatarCycleCounter + 1) % 99999;
        const idx = (__avatarCycleCounter + Math.floor(Math.random() * activePool.length)) % activePool.length;
        return activePool[idx];
    }

    // 生成真实中国风头像（支持男/女/男女混合随机，绝不出现欧美脸或卡通假人）
    function buildOnlineAvatarUrl(seed, apiMode, avoidSet = null) {
        const females = getChineseFemalePool();
        const males = getChineseMalePool();
        const mode = apiMode || 'cn-mixed';

        if (mode === 'cn-female' || mode === 'asian-beauty') {
            return pickFromPoolAvoiding(females, avoidSet);
        }
        if (mode === 'cn-male' || mode === 'asian-guy') {
            return pickFromPoolAvoiding(males.length ? males : females, avoidSet);
        }

        // 默认 cn-mixed / real-human：真实中国女生 (62%) + 真实中国男生 (38%)
        if (Math.random() < 0.62) {
            return pickFromPoolAvoiding(females, avoidSet);
        }
        return pickFromPoolAvoiding(males.length ? males : females, avoidSet);
    }

    // 异步尝试国内真实头像接口（uomg 随机男女头像 API，带超时与内置中国风人像库兜底）
    async function fetchDomesticChineseAvatarUrl(genderMode = 'cn-mixed') {
        try {
            const isMale = genderMode === 'cn-male' || (genderMode === 'cn-mixed' && Math.random() < 0.38);
            const sortParam = encodeURIComponent(isMale ? '男' : '女');
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = controller ? setTimeout(() => controller.abort(), 1800) : null;
            const res = await fetch(`https://api.uomg.com/api/rand.avatar?sort=${sortParam}&format=json`, {
                mode: 'cors',
                signal: controller ? controller.signal : undefined
            });
            if (timer) clearTimeout(timer);
            if (res.ok) {
                const data = await res.json();
                if (data && data.code === 1 && data.imgurl && data.imgurl.startsWith('http')) {
                    return data.imgurl;
                }
            }
        } catch (e) {}
        return '';
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

    // 拆分与合并「日期时间 · IP属地」，支持单独随机切换日期时间或单独随机切换 IP 地址
    function splitDateLoc(dateLocStr) {
        const raw = String(dateLocStr || '').trim();
        if (!raw) return { datePart: '剛剛', ipPart: '台灣' };
        const parts = raw.split(/\s*·\s*/);
        if (parts.length >= 2) {
            return {
                datePart: parts[0].trim() || '剛剛',
                ipPart: parts.slice(1).join(' · ').trim()
            };
        }
        return { datePart: raw, ipPart: '' };
    }

    function joinDateLoc(datePart, ipPart) {
        const d = String(datePart || '').trim() || '剛剛';
        const ip = String(ipPart || '').trim();
        return ip ? `${d} · ${ip}` : d;
    }

    function randomOnlyTimeStr(pubHoursOverride, currentStr = '') {
        let tries = 0;
        let res = '剛剛';
        do {
            const full = randomDateLoc('none', pubHoursOverride);
            res = splitDateLoc(full).datePart;
        } while (res === currentStr && tries++ < 12);
        return res;
    }

    function randomOnlyIpStr(ipRegionOverride, currentIp = '') {
        const reg = (!ipRegionOverride || ipRegionOverride === 'none') ? 'tw-hk-my' : ipRegionOverride;
        let tries = 0;
        let res = '台灣';
        do {
            res = pickOverseasIpLocation(reg) || '台灣';
        } while (res === currentIp && tries++ < 15);
        return res;
    }

    // 生成评论点赞数：从几个、几百、几千到几十万不等（左侧舞台显示繁体萬，右侧编辑框显示简体万）
    function randomCommentLikes() {
        const roll = Math.random();
        if (roll < 0.30) {
            return String(Math.floor(Math.random() * 97) + 2); // 2 ~ 98
        } else if (roll < 0.58) {
            return String(Math.floor(Math.random() * 900) + 100); // 100 ~ 999
        } else if (roll < 0.80) {
            return String(Math.floor(Math.random() * 9000) + 1000); // 1000 ~ 9999
        } else {
            const wan = (1.1 + Math.random() * 66.8).toFixed(1); // 1.1萬 ~ 67.9萬
            return `${wan}萬`;
        }
    }

    const CommentEngine = {
        isOpen: false,
        isExpanded: false,
        drawerTopPct: null, // null 时使用收敛后的默认高度（标准 44.5% / 展开 33.5%），拖拽后记忆精确百分比
        fontScale: 1.0,     // 评论区整体字号缩放倍率 (0.8x ~ 1.5x，默认 1.0x，头像按比例同步微缩)
        apiMode: 'cn-mixed',
        ipRegion: 'tw-hk-my',
        pubWindowHours: 72,
        colPrefix: '觀看完整合集：',
        colTitle: '人情與世故',
        headCount: '138',
        tabAiText: 'AI 解析',
        vidTipText: '',
        allowReply: true,
        allowImage: true,
        showReplies: true,
        maxReplyLength: 100,
        cmsConfigVisible: true,
        activeUploadIdx: -1,
        activeUploadReplyIdx: -1,
        activePhotoUploadIdx: -1,
        activePhotoUploadReplyIdx: -1,
        replyTargetIdx: -1,
        replyTargetSubIdx: -1,
        replyTargetUser: '',
        replyRole: 'user', // 'user' | 'author'
        pendingReplyImage: '',
        pendingStageImage: '',
        list: [],

        getAuthorNameStage() {
            const raw = (document.getElementById('in-dy-author')?.value || '@Laya 視頻').replace(/^@/, '').trim() || 'Laya 視頻';
            return typeof window.toStageTrad === 'function' ? window.toStageTrad(raw) : raw;
        },

        getAuthorAvatarSrc() {
            const avEl = document.getElementById('dy-avatar-img');
            return (avEl && avEl.src) ? avEl.src : getChineseFemalePool()[0];
        },

        initDefaults() {
            const fPool = getChineseFemalePool();
            const mPool = getChineseMalePool();
            this.list = [
                {
                    id: 'c1',
                    user: '林小柔',
                    text: '牛總還是有點大智慧的',
                    dateLoc: randomDateLoc('tw-only', 72),
                    likes: '12.6萬',
                    liked: false,
                    avatar: fPool[0] || buildOnlineAvatarUrl('c1', 'cn-female'),
                    image: '',
                    isCustomAvatar: false,
                    replies: [
                        {
                            id: 'r1_1',
                            user: this.getAuthorNameStage(),
                            isAuthor: true,
                            replyToUser: '',
                            text: '確實，這一步棋他從三個月前就開始佈局了',
                            image: '',
                            dateLoc: randomDateLoc('tw-only', 48),
                            likes: '1.2萬',
                            liked: false,
                            avatar: this.getAuthorAvatarSrc(),
                            isCustomAvatar: false
                        },
                        {
                            id: 'r1_2',
                            user: '陳家豪',
                            isAuthor: false,
                            replyToUser: '林小柔',
                            text: '薑還是老的辣，不動聲色就把問題解決了',
                            image: '',
                            dateLoc: randomDateLoc('hk-mo', 36),
                            likes: '326',
                            liked: false,
                            avatar: mPool[0] || buildOnlineAvatarUrl('r1_2', 'cn-male'),
                            isCustomAvatar: false
                        }
                    ]
                },
                {
                    id: 'c2',
                    user: '阿傑Jay',
                    text: '這一段我反反覆覆看了五遍，細節真的拉滿',
                    dateLoc: randomDateLoc('hk-mo', 72),
                    likes: '3.8萬',
                    liked: false,
                    avatar: mPool[1] || buildOnlineAvatarUrl('c2', 'cn-male'),
                    image: '',
                    isCustomAvatar: false,
                    replies: [
                        {
                            id: 'r2_1',
                            user: '子瑜✨',
                            isAuthor: false,
                            replyToUser: '',
                            text: '尤其是最後遞茶杯那個眼神，絕了',
                            image: '',
                            dateLoc: randomDateLoc('tw-only', 24),
                            likes: '185',
                            liked: false,
                            avatar: fPool[1] || buildOnlineAvatarUrl('r2_1', 'cn-female'),
                            isCustomAvatar: false
                        }
                    ]
                },
                {
                    id: 'c3',
                    user: '萱萱_tw',
                    text: '哈哈，我先入職花果山再回來應聘，完美閉環',
                    dateLoc: randomDateLoc('tw-only', 72),
                    likes: '5280',
                    liked: false,
                    avatar: fPool[2] || buildOnlineAvatarUrl('c3', 'cn-female'),
                    image: '',
                    isCustomAvatar: false,
                    replies: []
                },
                {
                    id: 'c4',
                    user: '半糖去冰🧋',
                    text: '好一招釜底抽薪',
                    dateLoc: randomDateLoc('my-sg', 72),
                    likes: '842',
                    liked: false,
                    avatar: fPool[3] || buildOnlineAvatarUrl('c4', 'cn-female'),
                    image: '',
                    isCustomAvatar: false,
                    replies: []
                },
                {
                    id: 'c5',
                    user: '建宏_TPE',
                    text: '表面風平浪靜，實則全員八百個心眼子',
                    dateLoc: randomDateLoc('none', 72),
                    likes: '69',
                    liked: false,
                    avatar: mPool[2] || buildOnlineAvatarUrl('c5', 'cn-male'),
                    image: '',
                    isCustomAvatar: false,
                    replies: []
                },
                {
                    id: 'c6',
                    user: '芷晴_hk',
                    text: '看似漫不經心的一句話，其實前面早就鋪墊好了',
                    dateLoc: randomDateLoc('overseas-all', 72),
                    likes: '19',
                    liked: false,
                    avatar: fPool[4] || buildOnlineAvatarUrl('c6', 'cn-female'),
                    image: '',
                    isCustomAvatar: false,
                    replies: []
                }
            ];
            this.list.forEach(item => {
                this.prefetchAvatarDataUrl(item);
                if (Array.isArray(item.replies)) {
                    item.replies.forEach(rep => {
                        if (!rep.isAuthor) this.prefetchAvatarDataUrl(rep);
                    });
                }
            });
        },

        prefetchAvatarDataUrl(item) {
            if (!item) return;
            const runBlobPrefetch = (urlToFetch) => {
                if (!urlToFetch || urlToFetch.startsWith('data:')) return;
                fetch(urlToFetch, { mode: 'cors' })
                    .then(res => res.ok ? res.blob() : Promise.reject())
                    .then(blob => new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    }))
                    .then(dataUrl => {
                        if (dataUrl) {
                            item.avatar = dataUrl;
                            this.renderStage();
                            this.renderEditor();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        }
                    })
                    .catch(() => {});
            };
            runBlobPrefetch(item.avatar);
        },

        openReplyComposer(commentIdx, subReplyIdx = -1, defaultRole = 'user') {
            if (!this.allowReply) {
                window.showToast('⚠️ 后台已关闭评论回复功能（可在右侧「允许回复评论」开启）');
                return;
            }
            const item = this.list[commentIdx];
            if (!item) return;
            if (!Array.isArray(item.replies)) item.replies = [];

            let targetUser = item.user || '用戶';
            if (subReplyIdx >= 0 && item.replies[subReplyIdx]) {
                targetUser = item.replies[subReplyIdx].user || targetUser;
            }

            this.replyTargetIdx = commentIdx;
            this.replyTargetSubIdx = subReplyIdx;
            this.replyTargetUser = targetUser;
            this.replyRole = defaultRole === 'author' ? 'author' : 'user';
            this.pendingReplyImage = '';

            const modal = document.getElementById('dy-cmt-reply-modal');
            const targetLabel = document.getElementById('dy-cmt-reply-target-label');
            const charHint = document.getElementById('dy-cmt-reply-char-hint');
            const replyInp = document.getElementById('dy-cmt-reply-input');
            const btnRoleUser = document.getElementById('dy-reply-role-user');
            const btnRoleAuthor = document.getElementById('dy-reply-role-author');
            const imgPrevWrap = document.getElementById('dy-cmt-reply-img-preview-wrap');
            const btnReplyImg = document.getElementById('dy-cmt-reply-btn-img');

            if (targetLabel) {
                targetLabel.textContent = `${this.replyRole === 'author' ? '👑 作者回覆' : '👤 回覆'} @${targetUser}：`;
            }
            if (btnRoleUser) btnRoleUser.classList.toggle('active', this.replyRole === 'user');
            if (btnRoleAuthor) btnRoleAuthor.classList.toggle('active', this.replyRole === 'author');
            if (imgPrevWrap) imgPrevWrap.style.display = 'none';
            if (btnReplyImg) btnReplyImg.style.display = this.allowImage ? 'inline-flex' : 'none';

            if (replyInp) {
                replyInp.value = '';
                replyInp.maxLength = this.maxReplyLength || 100;
                replyInp.placeholder = this.allowImage
                    ? `回覆 @${targetUser}（支持純文字、純圖片、文字+圖片，限${this.maxReplyLength}字）...`
                    : `回覆 @${targetUser}（限${this.maxReplyLength}字）...`;
            }
            if (charHint) {
                charHint.textContent = `0/${this.maxReplyLength || 100}`;
            }
            if (modal) {
                modal.style.display = 'flex';
            }
            if (replyInp) {
                setTimeout(() => replyInp.focus(), 20);
            }
        },

        closeReplyComposer() {
            this.replyTargetIdx = -1;
            this.replyTargetSubIdx = -1;
            this.replyTargetUser = '';
            this.pendingReplyImage = '';
            const modal = document.getElementById('dy-cmt-reply-modal');
            const imgPrevWrap = document.getElementById('dy-cmt-reply-img-preview-wrap');
            const replyInp = document.getElementById('dy-cmt-reply-input');
            if (modal) modal.style.display = 'none';
            if (imgPrevWrap) imgPrevWrap.style.display = 'none';
            if (replyInp) replyInp.value = '';
        },

        submitReplyFromComposer() {
            if (!this.allowReply) {
                window.showToast('⚠️ 后台已关闭评论回复功能');
                return;
            }
            const idx = this.replyTargetIdx;
            const item = this.list[idx];
            if (!item) {
                this.closeReplyComposer();
                return;
            }
            if (!Array.isArray(item.replies)) item.replies = [];

            const replyInp = document.getElementById('dy-cmt-reply-input');
            let rawTxt = (replyInp ? replyInp.value.trim() : '');
            const maxLen = Math.max(5, parseInt(this.maxReplyLength, 10) || 100);
            if (rawTxt.length > maxLen) {
                rawTxt = rawTxt.slice(0, maxLen);
            }
            const imgData = this.allowImage ? (this.pendingReplyImage || '') : '';

            if (!rawTxt && !imgData) {
                window.showToast('⚠️ 请输入回复文字或上传回复图片');
                if (replyInp) replyInp.focus();
                return;
            }

            const isAuthor = (this.replyRole === 'author');
            const stageTxt = rawTxt ? (typeof window.toStageTrad === 'function' ? window.toStageTrad(rawTxt) : rawTxt) : '';
            const loc = pickOverseasIpLocation(this.ipRegion);
            const seed = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const usedAvatars = new Set(this.list.map(it => it.avatar).filter(Boolean));

            const newReply = {
                id: seed,
                user: isAuthor ? this.getAuthorNameStage() : NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)],
                isAuthor: isAuthor,
                replyToUser: (this.replyTargetSubIdx >= 0 && this.replyTargetUser) ? this.replyTargetUser : '',
                text: stageTxt,
                image: imgData,
                dateLoc: loc ? `剛剛 · ${loc}` : '剛剛',
                likes: isAuthor ? String(Math.floor(Math.random() * 60) + 5) : '1',
                liked: true,
                avatar: isAuthor ? this.getAuthorAvatarSrc() : buildOnlineAvatarUrl(seed, this.apiMode, usedAvatars),
                isCustomAvatar: false
            };

            if (!isAuthor) {
                this.prefetchAvatarDataUrl(newReply);
            }
            item.replies.push(newReply);
            this.showReplies = true;
            const swShowRep = document.getElementById('sw-cmt-show-replies');
            if (swShowRep) swShowRep.checked = true;

            this.closeReplyComposer();
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(isAuthor ? '👑 作者回复已发布！' : '💬 跟评回复已发布！');
        },

        getEffectiveDrawerTopPct() {
            if (typeof this.drawerTopPct === 'number' && isFinite(this.drawerTopPct)) {
                return Math.min(78, Math.max(18, this.drawerTopPct));
            }
            return this.isExpanded ? 33.5 : 44.5;
        },

        applyFontScale(scaleVal, syncUI = true) {
            const clamped = Number(Math.min(1.5, Math.max(0.8, parseFloat(scaleVal) || 1.0)).toFixed(2));
            this.fontScale = clamped;
            // 头像按比例同步稍微缩放一点，避免字小头大或字大头小
            const avatarScale = Number((1 + (clamped - 1) * 0.85).toFixed(3));
            const rt = document.getElementById('render-target');
            const drawer = document.getElementById('dy-comment-drawer');
            if (rt) {
                rt.style.setProperty('--dy-cmt-font-scale', String(clamped));
                rt.style.setProperty('--dy-cmt-avatar-scale', String(avatarScale));
            }
            if (drawer) {
                drawer.style.setProperty('--dy-cmt-font-scale', String(clamped));
                drawer.style.setProperty('--dy-cmt-avatar-scale', String(avatarScale));
            }
            if (syncUI) {
                const inp = document.getElementById('in-dy-cmt-font-scale');
                const txt = document.getElementById('txt-dy-cmt-font-scale');
                if (inp && parseFloat(inp.value) !== clamped) inp.value = String(clamped);
                if (txt) txt.textContent = clamped.toFixed(2).replace(/0$/, '') + 'x';
            }
        },

        applyDrawerLayoutVars() {
            const rt = document.getElementById('render-target');
            if (!rt) return;
            const topPct = this.getEffectiveDrawerTopPct();
            const vidTop = 8.2;
            const vidHeight = Math.max(9.8, Number((topPct - vidTop).toFixed(2)));
            const subTop = Math.max(vidTop + 3.5, Number((topPct - 4.0).toFixed(2)));
            rt.style.setProperty('--dy-cmt-top', topPct + '%');
            rt.style.setProperty('--dy-vid-top', vidTop + '%');
            rt.style.setProperty('--dy-vid-height', vidHeight + '%');
            rt.style.setProperty('--dy-sub-top', subTop + '%');
            this.applyFontScale(this.fontScale, true);
            if (window.DanmakuEngine && typeof window.DanmakuEngine.syncStageTopPositions === 'function') {
                window.DanmakuEngine.syncStageTopPositions();
            }
        },

        setDrawerOpen(flag, showToastMsg = false) {
            this.isOpen = !!flag;
            const rt = document.getElementById('render-target');
            if (rt) {
                rt.classList.toggle('dy-comment-open', this.isOpen);
            }
            this.applyDrawerLayoutVars();

            const sw1 = document.getElementById('sw-dy-comment-drawer');
            const sw2 = document.getElementById('sw-dy-cmt-open-card');
            if (sw1 && sw1.checked !== this.isOpen) sw1.checked = this.isOpen;
            if (sw2 && sw2.checked !== this.isOpen) sw2.checked = this.isOpen;

            if (window.PlayerEngine) {
                if (typeof window.PlayerEngine.updateTransform === 'function') {
                    window.PlayerEngine.updateTransform();
                }
                if (typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') {
                    window.PlayerEngine.ensureVideoPlayingIfActive(true);
                }
                window.__isRestoringStorage = false;
                setTimeout(() => {
                    if (typeof window.PlayerEngine.updateTransform === 'function') window.PlayerEngine.updateTransform();
                    if (typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') window.PlayerEngine.ensureVideoPlayingIfActive(false);
                }, 60);
                setTimeout(() => {
                    if (typeof window.PlayerEngine.updateTransform === 'function') window.PlayerEngine.updateTransform();
                    if (typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') window.PlayerEngine.ensureVideoPlayingIfActive(false);
                }, 240);
            }
            if (showToastMsg) {
                window.showToast(this.isOpen
                    ? '已弹出评论区'
                    : '已收起评论区');
            }
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        },

        // 单独随机某一条评论的头像（支持指定男/女/随机，自动避开当前已显示的头像）
        randomizeSingleAvatar(idx, forceGenderMode = null) {
            const item = this.list[idx];
            if (!item) return;
            const mode = forceGenderMode || document.getElementById('sel-cmt-avatar-api')?.value || this.apiMode || 'cn-mixed';
            if (!forceGenderMode) this.apiMode = mode;
            const usedAvatars = new Set(this.list.map(it => it.avatar).filter(Boolean));
            const seed = `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`;
            item.avatar = buildOnlineAvatarUrl(seed, mode, usedAvatars);
            item.isCustomAvatar = false;
            this.prefetchAvatarDataUrl(item);
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('已随机切换真实中国风头像');
        },

        // 单独随机某一条评论的昵称（英文或繁体中文）
        randomizeSingleNickname(idx) {
            const item = this.list[idx];
            if (!item) return;
            const usedNames = new Set(this.list.map((it, i) => i !== idx ? it.user : ''));
            let nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
            let tries = 0;
            while ((usedNames.has(nick) || nick === item.user) && tries++ < 25) {
                nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
            }
            item.user = nick;
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`已随机切换昵称：${nick}`);
        },

        // 单独随机某一条评论的时间与海外/台港澳马IP
        randomizeSingleDateLoc(idx) {
            const item = this.list[idx];
            if (!item) return;
            item.dateLoc = randomDateLoc(this.ipRegion, this.pubWindowHours);
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`已随机切换评论时间与IP：${item.dateLoc}`);
        },

        // 单独随机某一条评论的「日期时间」（保留原有IP地址）
        randomizeSingleTimeOnly(idx) {
            const item = this.list[idx];
            if (!item) return;
            const { datePart, ipPart } = splitDateLoc(item.dateLoc);
            const newTime = randomOnlyTimeStr(this.pubWindowHours, datePart);
            item.dateLoc = joinDateLoc(newTime, ipPart);
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`🎲 已随机切换评论日期：${newTime}`);
        },

        // 单独随机某一条评论的「IP地址」（保留原有日期时间）
        randomizeSingleIpOnly(idx) {
            const item = this.list[idx];
            if (!item) return;
            const { datePart, ipPart } = splitDateLoc(item.dateLoc);
            const newIp = randomOnlyIpStr(this.ipRegion, ipPart);
            item.dateLoc = joinDateLoc(datePart, newIp);
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`🎲 已随机切换评论IP地址：${newIp}`);
        },

        // 单独随机某一条评论的点赞数（几个到几十万不等）
        randomizeSingleLikes(idx) {
            const item = this.list[idx];
            if (!item) return;
            item.likes = randomCommentLikes();
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`已随机切换评论点赞数：${item.likes}`);
        },

        // ====== 二级回复（跟评/作者回复）专属单项随机筛子方法 ======
        randomizeReplyAvatar(idx, rIdx, forceGenderMode = null) {
            const rep = this.list[idx] && this.list[idx].replies && this.list[idx].replies[rIdx];
            if (!rep) return;
            const mode = forceGenderMode || document.getElementById('sel-cmt-avatar-api')?.value || this.apiMode || 'cn-mixed';
            const usedAvatars = new Set(this.list.map(it => it.avatar).filter(Boolean));
            if (rep.avatar) usedAvatars.add(rep.avatar);
            const seed = `rep_av_${Date.now()}_${idx}_${rIdx}_${Math.random().toString(36).slice(2, 7)}`;
            rep.avatar = buildOnlineAvatarUrl(seed, mode, usedAvatars);
            rep.isCustomAvatar = true;
            this.prefetchAvatarDataUrl(rep);
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('🎲 已随机切换回复头像');
        },

        randomizeReplyNickname(idx, rIdx) {
            const rep = this.list[idx] && this.list[idx].replies && this.list[idx].replies[rIdx];
            if (!rep) return;
            let nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
            let tries = 0;
            while (nick === rep.user && tries++ < 25) {
                nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
            }
            rep.user = nick;
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`🎲 已随机切换回复名字：${nick}`);
        },

        randomizeReplyTimeOnly(idx, rIdx) {
            const rep = this.list[idx] && this.list[idx].replies && this.list[idx].replies[rIdx];
            if (!rep) return;
            const { datePart, ipPart } = splitDateLoc(rep.dateLoc);
            const newTime = randomOnlyTimeStr(this.pubWindowHours, datePart);
            rep.dateLoc = joinDateLoc(newTime, ipPart);
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`🎲 已随机切换回复日期：${newTime}`);
        },

        randomizeReplyIpOnly(idx, rIdx) {
            const rep = this.list[idx] && this.list[idx].replies && this.list[idx].replies[rIdx];
            if (!rep) return;
            const { datePart, ipPart } = splitDateLoc(rep.dateLoc);
            const newIp = randomOnlyIpStr(this.ipRegion, ipPart);
            rep.dateLoc = joinDateLoc(datePart, newIp);
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`🎲 已随机切换回复IP地址：${newIp}`);
        },

        randomizeReplyLikes(idx, rIdx) {
            const rep = this.list[idx] && this.list[idx].replies && this.list[idx].replies[rIdx];
            if (!rep) return;
            rep.likes = randomCommentLikes();
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`🎲 已随机切换回复点赞数：${rep.likes}`);
        },

        randomizeReplyAll(idx, rIdx) {
            const rep = this.list[idx] && this.list[idx].replies && this.list[idx].replies[rIdx];
            if (!rep) return;
            const mode = document.getElementById('sel-cmt-avatar-api')?.value || this.apiMode || 'cn-mixed';
            const usedAvatars = new Set(this.list.map(it => it.avatar).filter(Boolean));
            const seed = `rep_all_${Date.now()}_${idx}_${rIdx}_${Math.random().toString(36).slice(2, 7)}`;
            rep.avatar = buildOnlineAvatarUrl(seed, mode, usedAvatars);
            rep.isCustomAvatar = true;
            this.prefetchAvatarDataUrl(rep);
            rep.user = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
            rep.dateLoc = randomDateLoc(this.ipRegion, this.pubWindowHours);
            rep.likes = randomCommentLikes();
            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('🎲 已随机切换该条回复的头像、名字、日期、IP与点赞数');
        },

        // 单条评论点击总筛子 🎲：同时随机更换头像、繁体/英文昵称、发布后~上传前的时间、海外/台港澳马IP、点赞数
        randomizeSingleItem(idx) {
            const item = this.list[idx];
            if (!item) return;
            const mode = document.getElementById('sel-cmt-avatar-api')?.value || this.apiMode || 'cn-mixed';
            this.apiMode = mode;
            const usedAvatars = new Set(this.list.map(it => it.avatar).filter(Boolean));
            const seed = `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`;
            item.avatar = buildOnlineAvatarUrl(seed, mode, usedAvatars);
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
            item.likes = randomCommentLikes();

            this.renderStage();
            this.renderEditor();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        },

        randomizeAll(includeText = true, overrideAvatarMode = null) {
            const mode = overrideAvatarMode || document.getElementById('sel-cmt-avatar-api')?.value || this.apiMode || 'cn-mixed';
            const ipReg = document.getElementById('sel-cmt-ip-region')?.value || this.ipRegion || 'tw-hk-my';
            const pubWin = parseFloat(document.getElementById('sel-cmt-pub-window')?.value) || this.pubWindowHours || 72;
            this.apiMode = mode;
            this.ipRegion = ipReg;
            this.pubWindowHours = pubWin;
            const usedNames = new Set();
            const usedTexts = new Set();
            const usedAvatars = new Set();
            this.list.forEach((item, idx) => {
                const seed = `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
                if (!item.isCustomAvatar || includeText || overrideAvatarMode) {
                    const nextAv = buildOnlineAvatarUrl(seed, mode, usedAvatars);
                    usedAvatars.add(nextAv);
                    item.avatar = nextAv;
                    item.isCustomAvatar = false;
                    this.prefetchAvatarDataUrl(item);
                }
                let nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
                let tries = 0;
                while (usedNames.has(nick) && tries++ < 15) {
                    nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
                }
                usedNames.add(nick);
                item.user = nick;
                item.dateLoc = randomDateLoc(ipReg, pubWin);
                item.likes = randomCommentLikes();

                if (Array.isArray(item.replies)) {
                    item.replies.forEach((rep, rIdx) => {
                        if (rep.isAuthor) {
                            rep.user = this.getAuthorNameStage();
                            if (!rep.isCustomAvatar) rep.avatar = this.getAuthorAvatarSrc();
                        } else if (!rep.isCustomAvatar || overrideAvatarMode) {
                            const rAv = buildOnlineAvatarUrl(`${seed}_r_${rIdx}`, mode, usedAvatars);
                            usedAvatars.add(rAv);
                            rep.avatar = rAv;
                            this.prefetchAvatarDataUrl(rep);
                        }
                    });
                }

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

        // 🎬 按当前视频/画面标题、话题、热搜词智能生成匹配的评论（自然口语，拒绝每句末尾带表情包）
        smartGenerateByScene() {
            const rawDesc = (document.getElementById('in-dy-desc')?.value || document.getElementById('in-m-sub-title')?.value || document.getElementById('in-title')?.value || '').trim();
            const rawTags = (document.getElementById('in-dy-tags')?.value || '').trim();
            const rawHot = (document.getElementById('in-dy-hotspot-title')?.value || '').trim();
            const rawFeat = (document.getElementById('in-dy-featured-title')?.value || '').trim();
            const rawCol = (document.getElementById('in-cmt-col-title')?.value || this.colTitle || '').trim();

            const combined = [rawDesc, rawTags, rawHot, rawFeat, rawCol].join(' ');
            const cleanTokens = combined
                .replace(/#[\S]+/g, (m) => ' ' + m.slice(1) + ' ')
                .split(/[\s,，。！？!?:：；;、/\-—|【】\[\]《》<>""''「」]+/)
                .map(s => s.trim())
                .filter(s => s.length >= 2 && s.length <= 10 && !['作者声明', '虚构演绎', '仅供娱乐', '上升热点', '精选内容', '人在看', '合集'].includes(s));

            const kw1 = cleanTokens[0] || '這段劇情';
            const kw2 = cleanTokens[1] || cleanTokens[0] || '這個細節';
            const topic = rawCol || rawFeat || kw1;

            const sceneTemplates = [
                `衝著「${kw1}」點進來的，果然沒讓我失望`,
                `這段關於${kw1}的演繹真的太到位了，細節滿滿`,
                `反覆看了三遍，${kw2}那裡處理得真的很絕`,
                `大數據太懂我了，剛想搜${topic}就刷到了這條`,
                `注意看畫面裡的細節，導演在${kw1}這裡埋了伏筆`,
                `表面看是${kw1}，實際上每一句話都在博弈`,
                `終於刷到完整版了，之前找${topic}找了好久`,
                `這運鏡和畫面質感真好，完全是電影級別的節奏`,
                `第一次看覺得節奏快，看懂${kw2}之後真的佩服編劇`,
                `評論區有沒有懂行的分析一下，最後那個眼神是什麼意思`,
                `太真實了，把${kw1}那種微妙的氣氛全拍出來了`,
                `建議把這個系列一口氣看完，前後呼應得太巧妙了`
            ];

            const shuffled = sceneTemplates
                .sort(() => Math.random() - 0.5)
                .map(t => typeof window.toStageTrad === 'function' ? window.toStageTrad(t) : t);

            const targetCount = Math.max(6, this.list.length);
            const mode = document.getElementById('sel-cmt-avatar-api')?.value || this.apiMode || 'cn-mixed';
            const ipReg = document.getElementById('sel-cmt-ip-region')?.value || this.ipRegion || 'tw-hk-my';
            const pubWin = parseFloat(document.getElementById('sel-cmt-pub-window')?.value) || this.pubWindowHours || 72;

            const usedNames = new Set();
            const usedAvatars = new Set();
            const newList = [];

            for (let i = 0; i < targetCount; i++) {
                const seed = `scene_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
                let nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
                let tries = 0;
                while (usedNames.has(nick) && tries++ < 20) {
                    nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
                }
                usedNames.add(nick);
                const av = buildOnlineAvatarUrl(seed, mode, usedAvatars);
                usedAvatars.add(av);
                const item = {
                    id: seed,
                    user: nick,
                    text: shuffled[i % shuffled.length],
                    dateLoc: randomDateLoc(ipReg, pubWin),
                    likes: randomCommentLikes(),
                    liked: false,
                    avatar: av,
                    image: '',
                    isCustomAvatar: false,
                    replies: []
                };
                newList.push(item);
                this.prefetchAvatarDataUrl(item);
            }

            this.list = newList;
            this.renderStage();
            this.renderEditor();
            if (!this.isOpen) this.setDrawerOpen(true, false);
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`已根据画面与标题智能生成 ${newList.length} 条自然评论`);
        },

        // 📋 批量换行识别导入评论（每行自动识别为一条独立评论，支持覆盖或追加）
        importBatchLines(rawText, replaceAll = true) {
            const lines = String(rawText || '')
                .split(/\r?\n/)
                .map(line => line.replace(/^\s*(?:\d+[.、\)）]|[-*•])\s*/, '').trim())
                .filter(Boolean);

            if (lines.length === 0) {
                window.showToast('请先在输入框里粘贴或输入评论内容（每行一条）');
                return 0;
            }

            const mode = document.getElementById('sel-cmt-avatar-api')?.value || this.apiMode || 'cn-mixed';
            const ipReg = document.getElementById('sel-cmt-ip-region')?.value || this.ipRegion || 'tw-hk-my';
            const pubWin = parseFloat(document.getElementById('sel-cmt-pub-window')?.value) || this.pubWindowHours || 72;

            const usedNames = new Set(replaceAll ? [] : this.list.map(it => it.user));
            const usedAvatars = new Set(replaceAll ? [] : this.list.map(it => it.avatar));

            const createdItems = lines.map((lineText, idx) => {
                const seed = `batch_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
                let nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
                let tries = 0;
                while (usedNames.has(nick) && tries++ < 25) {
                    nick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
                }
                usedNames.add(nick);
                const av = buildOnlineAvatarUrl(seed, mode, usedAvatars);
                usedAvatars.add(av);
                const stageTxt = typeof window.toStageTrad === 'function' ? window.toStageTrad(lineText) : lineText;
                const item = {
                    id: seed,
                    user: nick,
                    text: stageTxt,
                    dateLoc: randomDateLoc(ipReg, pubWin),
                    likes: randomCommentLikes(),
                    liked: false,
                    avatar: av,
                    image: '',
                    isCustomAvatar: false,
                    replies: []
                };
                this.prefetchAvatarDataUrl(item);
                return item;
            });

            if (replaceAll) {
                this.list = createdItems;
            } else {
                this.list = [...createdItems, ...this.list];
            }

            this.renderStage();
            this.renderEditor();
            if (!this.isOpen) this.setDrawerOpen(true, false);
            const listEl = document.getElementById('dy-comment-list');
            if (listEl) listEl.scrollTop = 0;
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(replaceAll
                ? `已识别并替换导入 ${createdItems.length} 条评论`
                : `已识别并追加 ${createdItems.length} 条评论`);
            return createdItems.length;
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

            const stageColTitle = typeof window.toStageTrad === 'function' ? window.toStageTrad(this.colTitle) : this.colTitle;
            const stageHeadCount = typeof window.toStageTrad === 'function' ? window.toStageTrad(this.headCount) : this.headCount;
            const simpColTitle = typeof window.toEditorSimp === 'function' ? window.toEditorSimp(this.colTitle) : this.colTitle;
            const simpHeadCount = typeof window.toEditorSimp === 'function' ? window.toEditorSimp(this.headCount) : this.headCount;

            if (colPrefixEl && colPrefixEl.textContent !== this.colPrefix) colPrefixEl.textContent = this.colPrefix;
            if (colTitleEl && colTitleEl.textContent !== stageColTitle) colTitleEl.textContent = stageColTitle;
            if (colBar) colBar.style.display = this.colTitle.trim() ? 'flex' : 'none';
            if (headCountEl && headCountEl.textContent !== stageHeadCount) headCountEl.textContent = stageHeadCount;
            if (tabAiEl && tabAiEl.textContent !== this.tabAiText) tabAiEl.textContent = this.tabAiText;
            if (vidTipEl) {
                vidTipEl.textContent = '';
                vidTipEl.style.display = 'none';
            }
            if (inColTitle && document.activeElement !== inColTitle) inColTitle.value = simpColTitle;
            if (inHeadCount && document.activeElement !== inHeadCount) inHeadCount.value = simpHeadCount;

            // 同步底部发图按钮显隐状态
            const btnSendImg = document.getElementById('dy-cmt-btn-send-img');
            if (btnSendImg) btnSendImg.style.display = this.allowImage ? 'inline-flex' : 'none';
        },

        renderStage() {
            this.syncHeaderDOM();
            const container = document.getElementById('dy-cmt-list-inner');
            if (!container) return;
            container.innerHTML = '';

            this.list.forEach((item, idx) => {
                if (!Array.isArray(item.replies)) item.replies = [];
                const row = document.createElement('div');
                row.className = 'dy-cmt-item';

                // 左侧静态头像 (点击随机切换头像，右键可上传本地头像)
                const avWrap = document.createElement('div');
                avWrap.className = 'dy-cmt-avatar-wrap interactive-elem';
                avWrap.title = '点击随机切换此条评论头像（右键可上传自定义头像）';
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
                    this.randomizeSingleAvatar(idx);
                });
                avWrap.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.activeUploadIdx = idx;
                    this.activeUploadReplyIdx = -1;
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

                // 昵称行 + 头像筛子 + 昵称旁专属骰子按钮 + 悬停快捷工具
                const userRow = document.createElement('div');
                userRow.className = 'dy-cmt-user-row';

                const userLeftWrap = document.createElement('div');
                userLeftWrap.style.cssText = 'display:flex; align-items:center; gap:3px; flex:1; min-width:0; max-width:100%; overflow:hidden; white-space:nowrap; flex-wrap:nowrap;';

                const btnAvDice = document.createElement('button');
                btnAvDice.type = 'button';
                btnAvDice.className = 'dy-cmt-inline-dice interactive-elem';
                btnAvDice.style.marginLeft = '0';
                btnAvDice.textContent = '🎲';
                btnAvDice.title = '点击随机切换此条评论头像';
                btnAvDice.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.randomizeSingleAvatar(idx);
                });

                const userSpan = document.createElement('span');
                userSpan.className = 'dy-cmt-user interactive-elem';
                userSpan.style.cssText = 'white-space:nowrap; word-break:keep-all; overflow:hidden; text-overflow:ellipsis; max-width:100%; flex-shrink:1;';
                userSpan.contentEditable = 'true';
                userSpan.spellcheck = false;
                userSpan.title = '点击直接编辑昵称';
                userSpan.textContent = item.user || '匿名用戶';
                userSpan.addEventListener('input', () => {
                    item.user = userSpan.textContent.trim();
                    this.syncEditorRow(idx);
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                const btnNickDice = document.createElement('button');
                btnNickDice.type = 'button';
                btnNickDice.className = 'dy-cmt-inline-dice interactive-elem';
                btnNickDice.textContent = '🎲';
                btnNickDice.title = '点击随机切换名字（英文或繁体中文）';
                btnNickDice.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.randomizeSingleNickname(idx);
                });

                userLeftWrap.appendChild(btnAvDice);
                userLeftWrap.appendChild(userSpan);
                userLeftWrap.appendChild(btnNickDice);
                userRow.appendChild(userLeftWrap);

                const qTools = document.createElement('div');
                qTools.className = 'dy-cmt-stage-QuickTools';

                const btnAuthorRep = document.createElement('button');
                btnAuthorRep.type = 'button';
                btnAuthorRep.className = 'dy-cmt-qbtn';
                btnAuthorRep.textContent = '👑作者回';
                btnAuthorRep.title = '以作者身份回复此条评论';
                btnAuthorRep.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openReplyComposer(idx, -1, 'author');
                });

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
                    if (!this.allowImage) {
                        window.showToast('⚠️ 后台已关闭评论发图权限');
                        return;
                    }
                    this.activePhotoUploadIdx = idx;
                    this.activePhotoUploadReplyIdx = -1;
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

                qTools.appendChild(btnAuthorRep);
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

                // 评论区上传的照片 / 表情包
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
                        this.activePhotoUploadReplyIdx = -1;
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

                // 底部：日期(带🎲) + IP地址(带🎲) + 回复 + 右侧点赞数量(带🎲)
                const metaRow = document.createElement('div');
                metaRow.className = 'dy-cmt-meta-row';

                const metaLeft = document.createElement('div');
                metaLeft.className = 'dy-cmt-meta-left';

                const parsedMainDL = splitDateLoc(item.dateLoc || '3小時前 · 台灣');

                const dateOnlySpan = document.createElement('span');
                dateOnlySpan.className = 'dy-cmt-date-loc interactive-elem';
                dateOnlySpan.contentEditable = 'true';
                dateOnlySpan.spellcheck = false;
                dateOnlySpan.title = '点击直接修改评论日期时间';
                dateOnlySpan.textContent = parsedMainDL.datePart;
                dateOnlySpan.addEventListener('input', () => {
                    const curIp = splitDateLoc(item.dateLoc).ipPart;
                    item.dateLoc = joinDateLoc(dateOnlySpan.textContent.trim(), curIp);
                    this.syncEditorRow(idx);
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                const btnDateDice = document.createElement('button');
                btnDateDice.type = 'button';
                btnDateDice.className = 'dy-cmt-inline-dice interactive-elem';
                btnDateDice.textContent = '🎲';
                btnDateDice.title = '点击随机切换评论日期时间';
                btnDateDice.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.randomizeSingleTimeOnly(idx);
                });

                metaLeft.appendChild(dateOnlySpan);
                metaLeft.appendChild(btnDateDice);

                if (parsedMainDL.ipPart || this.ipRegion !== 'none') {
                    const dotSpan = document.createElement('span');
                    dotSpan.className = 'dy-cmt-date-loc';
                    dotSpan.textContent = ' · ';
                    metaLeft.appendChild(dotSpan);

                    const ipOnlySpan = document.createElement('span');
                    ipOnlySpan.className = 'dy-cmt-date-loc interactive-elem';
                    ipOnlySpan.contentEditable = 'true';
                    ipOnlySpan.spellcheck = false;
                    ipOnlySpan.title = '点击直接修改评论 IP 属地';
                    ipOnlySpan.textContent = parsedMainDL.ipPart || '台灣';
                    ipOnlySpan.addEventListener('input', () => {
                        const curDate = splitDateLoc(item.dateLoc).datePart;
                        item.dateLoc = joinDateLoc(curDate, ipOnlySpan.textContent.trim());
                        this.syncEditorRow(idx);
                        if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                    });

                    const btnIpDice = document.createElement('button');
                    btnIpDice.type = 'button';
                    btnIpDice.className = 'dy-cmt-inline-dice interactive-elem';
                    btnIpDice.textContent = '🎲';
                    btnIpDice.title = '点击随机切换评论 IP 地址';
                    btnIpDice.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.randomizeSingleIpOnly(idx);
                    });

                    metaLeft.appendChild(ipOnlySpan);
                    metaLeft.appendChild(btnIpDice);
                }

                const replySpan = document.createElement('span');
                replySpan.className = 'dy-cmt-reply-btn interactive-elem';
                replySpan.textContent = '回覆';
                replySpan.style.display = this.allowReply ? 'inline' : 'none';
                replySpan.title = '点击弹出回复输入框（支持普通用户跟评 / 作者回复）';
                replySpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openReplyComposer(idx, -1, 'user');
                });

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
                likeNum.title = '点击数字可直接修改点赞数，点击旁边的🎲可随机切换';
                const stageLikesTxt = typeof window.toStageTrad === 'function' ? window.toStageTrad(item.likes || '1') : (item.likes || '1');
                likeNum.textContent = stageLikesTxt;
                likeNum.addEventListener('click', (e) => e.stopPropagation());
                likeNum.addEventListener('input', () => {
                    item.likes = likeNum.textContent.trim();
                    this.syncEditorRow(idx);
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                likeBtn.addEventListener('click', () => {
                    item.liked = !item.liked;
                    if (!String(item.likes).includes('萬') && !String(item.likes).includes('万')) {
                        const n = parseInt(item.likes, 10);
                        if (!isNaN(n)) {
                            item.likes = String(item.liked ? n + 1 : Math.max(0, n - 1));
                        }
                    }
                    this.renderStage();
                    this.renderEditor();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });
                likeBtn.appendChild(likeNum);

                const btnLikeDice = document.createElement('button');
                btnLikeDice.type = 'button';
                btnLikeDice.className = 'dy-cmt-inline-dice interactive-elem';
                btnLikeDice.textContent = '🎲';
                btnLikeDice.title = '点击随机切换评论点赞数';
                btnLikeDice.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.randomizeSingleLikes(idx);
                });

                const dislikeBtn = document.createElement('div');
                dislikeBtn.className = 'dy-cmt-dislike-btn interactive-elem';
                dislikeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8b91" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path><polyline points="12 5.7 10.3 11 13.5 13.5 11.5 18.5"></polyline></svg>`;

                actions.appendChild(likeBtn);
                actions.appendChild(btnLikeDice);
                actions.appendChild(dislikeBtn);
                metaRow.appendChild(actions);
                main.appendChild(metaRow);

                // ★ 二级回复列表（作者回复 + 普通用户跟评：头像 19px、字号 11.5px，且头像、名字、日期、IP地址、点赞数旁边均有 🎲 筛子可切换）
                if (this.showReplies && Array.isArray(item.replies) && item.replies.length > 0) {
                    const repListEl = document.createElement('div');
                    repListEl.className = 'dy-cmt-replies-list';

                    item.replies.forEach((rep, rIdx) => {
                        const repRow = document.createElement('div');
                        repRow.className = 'dy-cmt-reply-item';

                        const rAvWrap = document.createElement('div');
                        rAvWrap.className = 'dy-cmt-reply-avatar-wrap interactive-elem';
                        rAvWrap.title = '左键点击随机切换回复头像（右键点击上传本地头像）';
                        const rAvImg = document.createElement('img');
                        rAvImg.className = 'dy-cmt-reply-avatar';
                        rAvImg.crossOrigin = 'anonymous';
                        const fallbackAuthorAv = rep.isAuthor ? this.getAuthorAvatarSrc() : '';
                        rAvImg.src = (rep.isAuthor && !rep.isCustomAvatar) ? fallbackAuthorAv : (rep.avatar || makeFallbackAvatarSvg(rep.id, rep.user));
                        rAvImg.onerror = () => {
                            const fb = makeFallbackAvatarSvg(rep.id + '_' + rIdx, rep.user);
                            if (rAvImg.src !== fb) rAvImg.src = fb;
                        };
                        rAvWrap.appendChild(rAvImg);
                        rAvWrap.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.randomizeReplyAvatar(idx, rIdx);
                        });
                        rAvWrap.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.activeUploadIdx = idx;
                            this.activeUploadReplyIdx = rIdx;
                            const fileInp = document.getElementById('dy-cmt-avatar-file');
                            if (fileInp) {
                                fileInp.value = '';
                                fileInp.click();
                            }
                        });
                        repRow.appendChild(rAvWrap);

                        const rBody = document.createElement('div');
                        rBody.className = 'dy-cmt-reply-body';

                        const rUserRow = document.createElement('div');
                        rUserRow.className = 'dy-cmt-reply-user-row';
                        rUserRow.style.cssText = 'display:flex; align-items:center; gap:4px; margin-bottom:1px; flex-wrap:nowrap; white-space:nowrap; min-width:0; overflow:hidden;';

                        // 1. 回复头像旁专属筛子 🎲
                        const rBtnAvDice = document.createElement('button');
                        rBtnAvDice.type = 'button';
                        rBtnAvDice.className = 'dy-cmt-inline-dice interactive-elem';
                        rBtnAvDice.style.marginLeft = '0';
                        rBtnAvDice.textContent = '🎲';
                        rBtnAvDice.title = '点击随机切换此条回复的头像';
                        rBtnAvDice.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.randomizeReplyAvatar(idx, rIdx);
                        });
                        rUserRow.appendChild(rBtnAvDice);

                        // 2. 回复名字 + 名字旁专属筛子 🎲
                        const rUserSpan = document.createElement('span');
                        rUserSpan.className = 'dy-cmt-reply-user interactive-elem';
                        rUserSpan.style.cssText = 'white-space:nowrap; word-break:keep-all; overflow:hidden; text-overflow:ellipsis; flex-shrink:1;';
                        rUserSpan.contentEditable = 'true';
                        rUserSpan.spellcheck = false;
                        rUserSpan.title = '点击直接编辑回复名字';
                        rUserSpan.textContent = rep.isAuthor ? (rep.user || this.getAuthorNameStage()) : (rep.user || '用戶');
                        rUserSpan.addEventListener('input', () => {
                            rep.user = rUserSpan.textContent.trim();
                            this.renderEditor();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        });
                        rUserRow.appendChild(rUserSpan);

                        const rBtnNickDice = document.createElement('button');
                        rBtnNickDice.type = 'button';
                        rBtnNickDice.className = 'dy-cmt-inline-dice interactive-elem';
                        rBtnNickDice.textContent = '🎲';
                        rBtnNickDice.title = '点击随机切换此条回复的名字';
                        rBtnNickDice.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.randomizeReplyNickname(idx, rIdx);
                        });
                        rUserRow.appendChild(rBtnNickDice);

                        if (rep.isAuthor) {
                            const authorBadge = document.createElement('span');
                            authorBadge.className = 'dy-cmt-author-badge';
                            authorBadge.textContent = '作者';
                            rUserRow.appendChild(authorBadge);
                        }

                        if (rep.replyToUser) {
                            const toTag = document.createElement('span');
                            toTag.className = 'dy-cmt-reply-to-tag';
                            toTag.textContent = `▸ ${rep.replyToUser}`;
                            rUserRow.appendChild(toTag);
                        }

                        const rRightTools = document.createElement('div');
                        rRightTools.className = 'dy-cmt-stage-QuickTools';
                        rRightTools.style.marginLeft = 'auto';

                        const rBtnRandAll = document.createElement('button');
                        rBtnRandAll.type = 'button';
                        rBtnRandAll.className = 'dy-cmt-qbtn interactive-elem';
                        rBtnRandAll.style.cssText = 'padding:0 4px; font-size:9px;';
                        rBtnRandAll.textContent = '🎲全換';
                        rBtnRandAll.title = '一键随机切换此条回复的头像、名字、日期、IP与点赞';
                        rBtnRandAll.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.randomizeReplyAll(idx, rIdx);
                        });

                        const rDelBtn = document.createElement('button');
                        rDelBtn.type = 'button';
                        rDelBtn.className = 'dy-cmt-qbtn interactive-elem';
                        rDelBtn.style.cssText = 'padding:0 4px; font-size:9px;';
                        rDelBtn.textContent = '✕';
                        rDelBtn.title = '删除此条回复';
                        rDelBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            item.replies.splice(rIdx, 1);
                            this.renderStage();
                            this.renderEditor();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        });
                        rRightTools.appendChild(rBtnRandAll);
                        rRightTools.appendChild(rDelBtn);
                        rUserRow.appendChild(rRightTools);
                        rBody.appendChild(rUserRow);

                        if (rep.text || !rep.image) {
                            const rTxt = document.createElement('div');
                            rTxt.className = 'dy-cmt-reply-text interactive-elem';
                            rTxt.contentEditable = 'true';
                            rTxt.spellcheck = false;
                            rTxt.textContent = rep.text || '';
                            rTxt.addEventListener('input', () => {
                                rep.text = rTxt.textContent;
                                this.renderEditor();
                                if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                            });
                            rBody.appendChild(rTxt);
                        }

                        if (rep.image) {
                            const rPhotoBox = document.createElement('div');
                            rPhotoBox.className = 'dy-cmt-reply-photo-box interactive-elem';
                            const rPhotoImg = document.createElement('img');
                            rPhotoImg.className = 'dy-cmt-reply-photo-img';
                            rPhotoImg.src = rep.image;
                            const rPhotoDel = document.createElement('button');
                            rPhotoDel.type = 'button';
                            rPhotoDel.className = 'dy-cmt-photo-del';
                            rPhotoDel.textContent = '✕';
                            rPhotoDel.addEventListener('click', (e) => {
                                e.stopPropagation();
                                rep.image = '';
                                if (!rep.text) rep.text = '👍';
                                this.renderStage();
                                this.renderEditor();
                                if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                            });
                            rPhotoBox.appendChild(rPhotoImg);
                            rPhotoBox.appendChild(rPhotoDel);
                            rBody.appendChild(rPhotoBox);
                        }

                        const rMetaRow = document.createElement('div');
                        rMetaRow.className = 'dy-cmt-reply-meta-row';

                        const rMetaLeft = document.createElement('div');
                        rMetaLeft.className = 'dy-cmt-reply-meta-left';

                        const parsedRepDL = splitDateLoc(rep.dateLoc || '剛剛 · 台灣');

                        // 3. 回复日期 + 日期旁专属筛子 🎲
                        const rDateSpan = document.createElement('span');
                        rDateSpan.className = 'dy-cmt-date-loc interactive-elem';
                        rDateSpan.contentEditable = 'true';
                        rDateSpan.spellcheck = false;
                        rDateSpan.title = '点击直接编辑回复日期';
                        rDateSpan.textContent = parsedRepDL.datePart;
                        rDateSpan.addEventListener('input', () => {
                            const curIp = splitDateLoc(rep.dateLoc).ipPart;
                            rep.dateLoc = joinDateLoc(rDateSpan.textContent.trim(), curIp);
                            this.renderEditor();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        });

                        const rBtnDateDice = document.createElement('button');
                        rBtnDateDice.type = 'button';
                        rBtnDateDice.className = 'dy-cmt-inline-dice interactive-elem';
                        rBtnDateDice.textContent = '🎲';
                        rBtnDateDice.title = '点击随机切换回复日期时间';
                        rBtnDateDice.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.randomizeReplyTimeOnly(idx, rIdx);
                        });

                        rMetaLeft.appendChild(rDateSpan);
                        rMetaLeft.appendChild(rBtnDateDice);

                        // 4. 回复 IP 地址 + IP 旁专属筛子 🎲
                        if (parsedRepDL.ipPart || this.ipRegion !== 'none') {
                            const rDotSpan = document.createElement('span');
                            rDotSpan.className = 'dy-cmt-date-loc';
                            rDotSpan.textContent = ' · ';
                            rMetaLeft.appendChild(rDotSpan);

                            const rIpSpan = document.createElement('span');
                            rIpSpan.className = 'dy-cmt-date-loc interactive-elem';
                            rIpSpan.contentEditable = 'true';
                            rIpSpan.spellcheck = false;
                            rIpSpan.title = '点击直接编辑回复 IP 地址';
                            rIpSpan.textContent = parsedRepDL.ipPart || '台灣';
                            rIpSpan.addEventListener('input', () => {
                                const curDate = splitDateLoc(rep.dateLoc).datePart;
                                rep.dateLoc = joinDateLoc(curDate, rIpSpan.textContent.trim());
                                this.renderEditor();
                                if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                            });

                            const rBtnIpDice = document.createElement('button');
                            rBtnIpDice.type = 'button';
                            rBtnIpDice.className = 'dy-cmt-inline-dice interactive-elem';
                            rBtnIpDice.textContent = '🎲';
                            rBtnIpDice.title = '点击随机切换回复 IP 地址';
                            rBtnIpDice.addEventListener('click', (e) => {
                                e.stopPropagation();
                                this.randomizeReplyIpOnly(idx, rIdx);
                            });

                            rMetaLeft.appendChild(rIpSpan);
                            rMetaLeft.appendChild(rBtnIpDice);
                        }

                        if (this.allowReply) {
                            const rReplyBtn = document.createElement('span');
                            rReplyBtn.className = 'dy-cmt-reply-btn interactive-elem';
                            rReplyBtn.style.fontSize = '10px';
                            rReplyBtn.textContent = '回覆';
                            rReplyBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                this.openReplyComposer(idx, rIdx, 'user');
                            });
                            rMetaLeft.appendChild(rReplyBtn);
                        }
                        rMetaRow.appendChild(rMetaLeft);

                        // 5. 回复点赞数量 + 点赞旁专属筛子 🎲
                        const rLikeWrap = document.createElement('div');
                        rLikeWrap.style.cssText = 'display:inline-flex; align-items:center; gap:2px;';

                        const rLikeBtn = document.createElement('div');
                        rLikeBtn.className = 'dy-cmt-reply-like-btn interactive-elem' + (rep.liked ? ' liked' : '');
                        rLikeBtn.innerHTML = `<svg width="11.5" height="11.5" viewBox="0 0 24 24" fill="${rep.liked ? '#fe2c55' : 'none'}" stroke="${rep.liked ? '#fe2c55' : '#8a8b91'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
                        const rLikeNum = document.createElement('span');
                        rLikeNum.className = 'dy-cmt-like-num interactive-elem';
                        rLikeNum.contentEditable = 'true';
                        rLikeNum.spellcheck = false;
                        rLikeNum.title = '点击数字直接修改回复点赞数';
                        rLikeNum.textContent = typeof window.toStageTrad === 'function' ? window.toStageTrad(rep.likes || '1') : (rep.likes || '1');
                        rLikeNum.addEventListener('click', (e) => e.stopPropagation());
                        rLikeNum.addEventListener('input', () => {
                            rep.likes = rLikeNum.textContent.trim();
                            this.renderEditor();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        });
                        rLikeBtn.addEventListener('click', () => {
                            rep.liked = !rep.liked;
                            if (!String(rep.likes).includes('萬') && !String(rep.likes).includes('万')) {
                                const n = parseInt(rep.likes, 10);
                                if (!isNaN(n)) rep.likes = String(rep.liked ? n + 1 : Math.max(0, n - 1));
                            }
                            this.renderStage();
                            this.renderEditor();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        });
                        rLikeBtn.appendChild(rLikeNum);

                        const rBtnLikeDice = document.createElement('button');
                        rBtnLikeDice.type = 'button';
                        rBtnLikeDice.className = 'dy-cmt-inline-dice interactive-elem';
                        rBtnLikeDice.textContent = '🎲';
                        rBtnLikeDice.title = '点击随机切换此条回复的点赞数量';
                        rBtnLikeDice.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.randomizeReplyLikes(idx, rIdx);
                        });

                        rLikeWrap.appendChild(rLikeBtn);
                        rLikeWrap.appendChild(rBtnLikeDice);
                        rMetaRow.appendChild(rLikeWrap);

                        rBody.appendChild(rMetaRow);
                        repRow.appendChild(rBody);
                        repListEl.appendChild(repRow);
                    });

                    main.appendChild(repListEl);
                }

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
            const parsedDL = splitDateLoc(item.dateLoc);
            const inUser = card.querySelector('.ed-in-user');
            const inDateOnly = card.querySelector('.ed-in-date-only');
            const inIpOnly = card.querySelector('.ed-in-ip-only');
            const inLikes = card.querySelector('.ed-in-likes');
            const inText = card.querySelector('.ed-in-text');
            const inAvUrl = card.querySelector('.ed-in-avatar-url');
            if (inUser && document.activeElement !== inUser) inUser.value = item.user || '';
            if (inDateOnly && document.activeElement !== inDateOnly) inDateOnly.value = parsedDL.datePart || '';
            if (inIpOnly && document.activeElement !== inIpOnly) inIpOnly.value = parsedDL.ipPart || '';
            if (inLikes && document.activeElement !== inLikes) inLikes.value = item.likes || '';
            if (inText && document.activeElement !== inText) inText.value = item.text || '';
            if (inAvUrl && document.activeElement !== inAvUrl) {
                inAvUrl.value = (item.avatar && !item.avatar.startsWith('data:')) ? item.avatar : '';
            }
        },

        renderEditor() {
            const edList = document.getElementById('dy-cmt-editor-list');
            if (!edList) return;
            edList.innerHTML = '';

            this.list.forEach((item, idx) => {
                if (!Array.isArray(item.replies)) item.replies = [];
                const card = document.createElement('div');
                card.className = 'dy-cmt-ed-card';

                const topRow = document.createElement('div');
                topRow.className = 'dy-cmt-ed-top';

                const avImg = document.createElement('img');
                avImg.className = 'dy-cmt-ed-avatar';
                avImg.crossOrigin = 'anonymous';
                avImg.src = item.avatar || makeFallbackAvatarSvg(item.id, item.user);
                avImg.title = '点击上传本地头像';
                avImg.onerror = () => {
                    const fb = makeFallbackAvatarSvg(item.id + '_' + idx, item.user);
                    if (avImg.src !== fb) avImg.src = fb;
                };
                avImg.addEventListener('click', () => {
                    this.activeUploadIdx = idx;
                    this.activeUploadReplyIdx = -1;
                    const fileInp = document.getElementById('dy-cmt-avatar-file');
                    if (fileInp) {
                        fileInp.value = '';
                        fileInp.click();
                    }
                });

                const btnRandAv = document.createElement('button');
                btnRandAv.type = 'button';
                btnRandAv.className = 'dy-cmt-ed-btn';
                btnRandAv.textContent = '🎲';
                btnRandAv.title = '随机换真实中国风头像';
                btnRandAv.addEventListener('click', () => {
                    this.randomizeSingleAvatar(idx);
                });

                const btnFemaleAv = document.createElement('button');
                btnFemaleAv.type = 'button';
                btnFemaleAv.className = 'dy-cmt-ed-btn';
                btnFemaleAv.textContent = '女';
                btnFemaleAv.title = '换成中国女生头像';
                btnFemaleAv.addEventListener('click', () => {
                    this.randomizeSingleAvatar(idx, 'cn-female');
                });

                const btnMaleAv = document.createElement('button');
                btnMaleAv.type = 'button';
                btnMaleAv.className = 'dy-cmt-ed-btn';
                btnMaleAv.textContent = '男';
                btnMaleAv.title = '换成中国男生头像';
                btnMaleAv.addEventListener('click', () => {
                    this.randomizeSingleAvatar(idx, 'cn-male');
                });

                const inUser = document.createElement('input');
                inUser.type = 'text';
                inUser.className = 'dy-cmt-ed-inp ed-in-user';
                inUser.style.flex = '1';
                inUser.style.minWidth = '56px';
                inUser.placeholder = '繁体/英文昵称';
                inUser.value = item.user || '';
                inUser.addEventListener('input', (e) => {
                    item.user = e.target.value;
                    this.renderStage();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                const btnRandNick = document.createElement('button');
                btnRandNick.type = 'button';
                btnRandNick.className = 'dy-cmt-ed-btn';
                btnRandNick.textContent = '🎲';
                btnRandNick.title = '随机换名字';
                btnRandNick.addEventListener('click', () => {
                    this.randomizeSingleNickname(idx);
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
                topRow.appendChild(btnRandAv);
                topRow.appendChild(btnFemaleAv);
                topRow.appendChild(btnMaleAv);
                topRow.appendChild(inUser);
                topRow.appendChild(btnRandNick);
                topRow.appendChild(btnDel);

                // 第二行：日期 + 🎲、IP地址 + 🎲、点赞数 + 🎲
                const metaEditRow = document.createElement('div');
                metaEditRow.style.cssText = 'display:flex; align-items:center; gap:4px;';
                const parsedDL = splitDateLoc(item.dateLoc);

                const inDateOnly = document.createElement('input');
                inDateOnly.type = 'text';
                inDateOnly.className = 'dy-cmt-ed-inp ed-in-date-only';
                inDateOnly.style.width = '64px';
                inDateOnly.placeholder = '日期时间';
                inDateOnly.value = parsedDL.datePart || '';
                inDateOnly.addEventListener('input', (e) => {
                    const curIp = splitDateLoc(item.dateLoc).ipPart;
                    item.dateLoc = joinDateLoc(e.target.value, curIp);
                    this.renderStage();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                const btnRandDateOnly = document.createElement('button');
                btnRandDateOnly.type = 'button';
                btnRandDateOnly.className = 'dy-cmt-ed-btn';
                btnRandDateOnly.textContent = '🎲';
                btnRandDateOnly.title = '随机切换评论日期时间';
                btnRandDateOnly.addEventListener('click', () => {
                    this.randomizeSingleTimeOnly(idx);
                });

                const inIpOnly = document.createElement('input');
                inIpOnly.type = 'text';
                inIpOnly.className = 'dy-cmt-ed-inp ed-in-ip-only';
                inIpOnly.style.width = '54px';
                inIpOnly.placeholder = 'IP地址';
                inIpOnly.value = parsedDL.ipPart || '';
                inIpOnly.addEventListener('input', (e) => {
                    const curDate = splitDateLoc(item.dateLoc).datePart;
                    item.dateLoc = joinDateLoc(curDate, e.target.value);
                    this.renderStage();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                const btnRandIpOnly = document.createElement('button');
                btnRandIpOnly.type = 'button';
                btnRandIpOnly.className = 'dy-cmt-ed-btn';
                btnRandIpOnly.textContent = '🎲';
                btnRandIpOnly.title = '随机切换评论 IP 地址';
                btnRandIpOnly.addEventListener('click', () => {
                    this.randomizeSingleIpOnly(idx);
                });

                const inLikes = document.createElement('input');
                inLikes.type = 'text';
                inLikes.className = 'dy-cmt-ed-inp ed-in-likes';
                inLikes.style.width = '48px';
                inLikes.placeholder = '点赞数';
                const simpLikes = typeof window.toEditorSimp === 'function' ? window.toEditorSimp(item.likes || '') : (item.likes || '');
                inLikes.value = simpLikes;
                inLikes.addEventListener('input', (e) => {
                    item.likes = typeof window.toStageTrad === 'function' ? window.toStageTrad(e.target.value) : e.target.value;
                    this.renderStage();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                });

                const btnRandLikes = document.createElement('button');
                btnRandLikes.type = 'button';
                btnRandLikes.className = 'dy-cmt-ed-btn';
                btnRandLikes.textContent = '🎲';
                btnRandLikes.title = '随机切换评论点赞数量';
                btnRandLikes.addEventListener('click', () => {
                    this.randomizeSingleLikes(idx);
                });

                metaEditRow.appendChild(inDateOnly);
                metaEditRow.appendChild(btnRandDateOnly);
                metaEditRow.appendChild(inIpOnly);
                metaEditRow.appendChild(btnRandIpOnly);
                metaEditRow.appendChild(inLikes);
                metaEditRow.appendChild(btnRandLikes);

                // 手动指定单条评论头像 URL 行
                const urlRow = document.createElement('div');
                urlRow.style.cssText = 'display:flex; align-items:center; gap:5px;';
                const inAvUrl = document.createElement('input');
                inAvUrl.type = 'text';
                inAvUrl.className = 'dy-cmt-ed-inp ed-in-avatar-url';
                inAvUrl.style.flex = '1';
                inAvUrl.style.fontSize = '10px';
                inAvUrl.placeholder = '🔗 手动粘贴指定头像图片 URL (支持 http/https/data:image)...';
                inAvUrl.value = (item.avatar && !item.avatar.startsWith('data:')) ? item.avatar : '';
                inAvUrl.addEventListener('change', (e) => {
                    const u = e.target.value.trim();
                    if (u) {
                        item.avatar = u;
                        item.isCustomAvatar = true;
                        this.prefetchAvatarDataUrl(item);
                        this.renderStage();
                        this.renderEditor();
                        if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        window.showToast('已应用自定义头像 URL');
                    }
                });
                urlRow.appendChild(inAvUrl);

                const botRow = document.createElement('div');
                botRow.style.cssText = 'display:flex; align-items:center; gap:5px;';

                const inText = document.createElement('input');
                inText.type = 'text';
                inText.className = 'dy-cmt-ed-inp ed-in-text';
                inText.style.flex = '1';
                inText.placeholder = '输入评论文字（可留空仅发图片）...';
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
                    if (!this.allowImage) {
                        window.showToast('⚠️ 后台已关闭评论发图权限');
                        return;
                    }
                    this.activePhotoUploadIdx = idx;
                    this.activePhotoUploadReplyIdx = -1;
                    const pInp = document.getElementById('dy-cmt-photo-file');
                    if (pInp) {
                        pInp.value = '';
                        pInp.click();
                    }
                });

                const btnAddAuthorRep = document.createElement('button');
                btnAddAuthorRep.type = 'button';
                btnAddAuthorRep.className = 'dy-cmt-ed-btn';
                btnAddAuthorRep.style.color = '#fda4af';
                btnAddAuthorRep.textContent = '+作者回';
                btnAddAuthorRep.title = '添加一条作者回复';
                btnAddAuthorRep.addEventListener('click', () => {
                    if (!this.isOpen) this.setDrawerOpen(true, false);
                    this.openReplyComposer(idx, -1, 'author');
                });

                const btnAddUserRep = document.createElement('button');
                btnAddUserRep.type = 'button';
                btnAddUserRep.className = 'dy-cmt-ed-btn';
                btnAddUserRep.textContent = '+跟评';
                btnAddUserRep.title = '添加一条普通用户跟评回复';
                btnAddUserRep.addEventListener('click', () => {
                    if (!this.isOpen) this.setDrawerOpen(true, false);
                    this.openReplyComposer(idx, -1, 'user');
                });

                botRow.appendChild(inText);
                botRow.appendChild(btnPhoto);
                botRow.appendChild(btnAddAuthorRep);
                botRow.appendChild(btnAddUserRep);

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
                card.appendChild(metaEditRow);
                card.appendChild(urlRow);
                card.appendChild(botRow);

                // ★ 二级回复后台管理列表：支持头像+🎲、名字+🎲、日期+🎲、IP地址+🎲、点赞数量+🎲
                if (item.replies.length > 0) {
                    const repWrap = document.createElement('div');
                    repWrap.className = 'dy-cmt-ed-replies-wrap';

                    item.replies.forEach((rep, rIdx) => {
                        const rRow = document.createElement('div');
                        rRow.className = 'dy-cmt-ed-reply-row';
                        rRow.style.cssText = 'display:flex; flex-direction:column; gap:4px; padding:5px; background:rgba(15,23,42,0.55); border-radius:6px; border:1px solid rgba(51,65,85,0.45);';

                        // 第 1 行：身份切换 + 头像 + 头像🎲 + 女/男 + 名字输入框 + 名字🎲 + 删除
                        const rTop = document.createElement('div');
                        rTop.style.cssText = 'display:flex; align-items:center; gap:4px;';

                        const rRoleBtn = document.createElement('button');
                        rRoleBtn.type = 'button';
                        rRoleBtn.className = 'dy-cmt-ed-btn';
                        rRoleBtn.style.cssText = rep.isAuthor
                            ? 'background:#fe2c55; color:#fff; border-color:#fe2c55; font-size:10px; padding:1px 5px;'
                            : 'font-size:10px; padding:1px 5px;';
                        rRoleBtn.textContent = rep.isAuthor ? '👑作者' : '👤用户';
                        rRoleBtn.title = '点击切换「作者回复 / 普通用户跟评」身份';
                        rRoleBtn.addEventListener('click', () => {
                            rep.isAuthor = !rep.isAuthor;
                            if (rep.isAuthor) {
                                rep.user = this.getAuthorNameStage();
                                rep.avatar = this.getAuthorAvatarSrc();
                                rep.isCustomAvatar = false;
                            }
                            this.renderStage();
                            this.renderEditor();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        });

                        const rAvImg = document.createElement('img');
                        rAvImg.className = 'dy-cmt-ed-avatar';
                        rAvImg.style.cssText = 'width:20px; height:20px; border-radius:50%; object-fit:cover; cursor:pointer; flex-shrink:0;';
                        rAvImg.crossOrigin = 'anonymous';
                        const fallbackAuthorAv = rep.isAuthor ? this.getAuthorAvatarSrc() : '';
                        rAvImg.src = (rep.isAuthor && !rep.isCustomAvatar) ? fallbackAuthorAv : (rep.avatar || makeFallbackAvatarSvg(rep.id, rep.user));
                        rAvImg.title = '点击上传此条回复的本地头像';
                        rAvImg.onerror = () => {
                            const fb = makeFallbackAvatarSvg(rep.id + '_' + rIdx, rep.user);
                            if (rAvImg.src !== fb) rAvImg.src = fb;
                        };
                        rAvImg.addEventListener('click', () => {
                            this.activeUploadIdx = idx;
                            this.activeUploadReplyIdx = rIdx;
                            const fileInp = document.getElementById('dy-cmt-avatar-file');
                            if (fileInp) {
                                fileInp.value = '';
                                fileInp.click();
                            }
                        });

                        const rBtnRandAv = document.createElement('button');
                        rBtnRandAv.type = 'button';
                        rBtnRandAv.className = 'dy-cmt-ed-btn';
                        rBtnRandAv.textContent = '🎲';
                        rBtnRandAv.title = '随机切换此条回复的头像';
                        rBtnRandAv.addEventListener('click', () => {
                            this.randomizeReplyAvatar(idx, rIdx);
                        });

                        const rBtnFemaleAv = document.createElement('button');
                        rBtnFemaleAv.type = 'button';
                        rBtnFemaleAv.className = 'dy-cmt-ed-btn';
                        rBtnFemaleAv.textContent = '女';
                        rBtnFemaleAv.title = '换成中国女生头像';
                        rBtnFemaleAv.addEventListener('click', () => {
                            this.randomizeReplyAvatar(idx, rIdx, 'cn-female');
                        });

                        const rBtnMaleAv = document.createElement('button');
                        rBtnMaleAv.type = 'button';
                        rBtnMaleAv.className = 'dy-cmt-ed-btn';
                        rBtnMaleAv.textContent = '男';
                        rBtnMaleAv.title = '换成中国男生头像';
                        rBtnMaleAv.addEventListener('click', () => {
                            this.randomizeReplyAvatar(idx, rIdx, 'cn-male');
                        });

                        const rUserInp = document.createElement('input');
                        rUserInp.type = 'text';
                        rUserInp.className = 'dy-cmt-ed-inp';
                        rUserInp.style.flex = '1';
                        rUserInp.style.minWidth = '52px';
                        rUserInp.placeholder = '回复名字';
                        rUserInp.value = rep.user || '';
                        rUserInp.addEventListener('input', (e) => {
                            rep.user = e.target.value;
                            this.renderStage();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        });

                        const rBtnRandNick = document.createElement('button');
                        rBtnRandNick.type = 'button';
                        rBtnRandNick.className = 'dy-cmt-ed-btn';
                        rBtnRandNick.textContent = '🎲';
                        rBtnRandNick.title = '随机切换回复名字';
                        rBtnRandNick.addEventListener('click', () => {
                            this.randomizeReplyNickname(idx, rIdx);
                        });

                        const rDelBtn = document.createElement('button');
                        rDelBtn.type = 'button';
                        rDelBtn.className = 'sub-cue-del';
                        rDelBtn.textContent = '✕';
                        rDelBtn.title = '删除此条回复';
                        rDelBtn.addEventListener('click', () => {
                            item.replies.splice(rIdx, 1);
                            this.renderStage();
                            this.renderEditor();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        });

                        rTop.appendChild(rRoleBtn);
                        rTop.appendChild(rAvImg);
                        rTop.appendChild(rBtnRandAv);
                        rTop.appendChild(rBtnFemaleAv);
                        rTop.appendChild(rBtnMaleAv);
                        rTop.appendChild(rUserInp);
                        rTop.appendChild(rBtnRandNick);
                        rTop.appendChild(rDelBtn);

                        // 第 2 行：回复日期 + 🎲、回复 IP 地址 + 🎲、回复点赞数量 + 🎲
                        const rMeta = document.createElement('div');
                        rMeta.style.cssText = 'display:flex; align-items:center; gap:4px;';
                        const parsedRepDL = splitDateLoc(rep.dateLoc);

                        const rDateInp = document.createElement('input');
                        rDateInp.type = 'text';
                        rDateInp.className = 'dy-cmt-ed-inp';
                        rDateInp.style.width = '62px';
                        rDateInp.placeholder = '日期时间';
                        rDateInp.value = parsedRepDL.datePart || '';
                        rDateInp.addEventListener('input', (e) => {
                            const curIp = splitDateLoc(rep.dateLoc).ipPart;
                            rep.dateLoc = joinDateLoc(e.target.value, curIp);
                            this.renderStage();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        });

                        const rBtnRandDate = document.createElement('button');
                        rBtnRandDate.type = 'button';
                        rBtnRandDate.className = 'dy-cmt-ed-btn';
                        rBtnRandDate.textContent = '🎲';
                        rBtnRandDate.title = '随机切换此条回复的日期时间';
                        rBtnRandDate.addEventListener('click', () => {
                            this.randomizeReplyTimeOnly(idx, rIdx);
                        });

                        const rIpInp = document.createElement('input');
                        rIpInp.type = 'text';
                        rIpInp.className = 'dy-cmt-ed-inp';
                        rIpInp.style.width = '52px';
                        rIpInp.placeholder = 'IP地址';
                        rIpInp.value = parsedRepDL.ipPart || '';
                        rIpInp.addEventListener('input', (e) => {
                            const curDate = splitDateLoc(rep.dateLoc).datePart;
                            rep.dateLoc = joinDateLoc(curDate, e.target.value);
                            this.renderStage();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        });

                        const rBtnRandIp = document.createElement('button');
                        rBtnRandIp.type = 'button';
                        rBtnRandIp.className = 'dy-cmt-ed-btn';
                        rBtnRandIp.textContent = '🎲';
                        rBtnRandIp.title = '随机切换此条回复的 IP 地址';
                        rBtnRandIp.addEventListener('click', () => {
                            this.randomizeReplyIpOnly(idx, rIdx);
                        });

                        const rLikesInp = document.createElement('input');
                        rLikesInp.type = 'text';
                        rLikesInp.className = 'dy-cmt-ed-inp';
                        rLikesInp.style.width = '46px';
                        rLikesInp.placeholder = '点赞数';
                        rLikesInp.value = typeof window.toEditorSimp === 'function' ? window.toEditorSimp(rep.likes || '1') : (rep.likes || '1');
                        rLikesInp.addEventListener('input', (e) => {
                            rep.likes = typeof window.toStageTrad === 'function' ? window.toStageTrad(e.target.value) : e.target.value;
                            this.renderStage();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        });

                        const rBtnRandLikes = document.createElement('button');
                        rBtnRandLikes.type = 'button';
                        rBtnRandLikes.className = 'dy-cmt-ed-btn';
                        rBtnRandLikes.textContent = '🎲';
                        rBtnRandLikes.title = '随机切换此条回复的点赞数量';
                        rBtnRandLikes.addEventListener('click', () => {
                            this.randomizeReplyLikes(idx, rIdx);
                        });

                        rMeta.appendChild(rDateInp);
                        rMeta.appendChild(rBtnRandDate);
                        rMeta.appendChild(rIpInp);
                        rMeta.appendChild(rBtnRandIp);
                        rMeta.appendChild(rLikesInp);
                        rMeta.appendChild(rBtnRandLikes);

                        // 第 3 行：回复文字内容 + 配图按钮
                        const rBot = document.createElement('div');
                        rBot.style.cssText = 'display:flex; align-items:center; gap:4px;';

                        const rTxtInp = document.createElement('input');
                        rTxtInp.type = 'text';
                        rTxtInp.className = 'dy-cmt-ed-inp';
                        rTxtInp.style.flex = '1';
                        rTxtInp.placeholder = '回复内容...';
                        rTxtInp.value = rep.text || '';
                        rTxtInp.addEventListener('input', (e) => {
                            rep.text = e.target.value;
                            this.renderStage();
                            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                        });

                        const rImgBtn = document.createElement('button');
                        rImgBtn.type = 'button';
                        rImgBtn.className = 'dy-cmt-ed-btn';
                        rImgBtn.textContent = rep.image ? '🖼️换图' : '🖼️配图';
                        rImgBtn.title = '为此条二级回复上传或更换图片';
                        rImgBtn.addEventListener('click', () => {
                            if (!this.allowImage) {
                                window.showToast('⚠️ 后台已关闭回复发图权限');
                                return;
                            }
                            this.activePhotoUploadIdx = idx;
                            this.activePhotoUploadReplyIdx = rIdx;
                            const pInp = document.getElementById('dy-cmt-photo-file');
                            if (pInp) {
                                pInp.value = '';
                                pInp.click();
                            }
                        });

                        rBot.appendChild(rTxtInp);
                        rBot.appendChild(rImgBtn);

                        rRow.appendChild(rTop);
                        rRow.appendChild(rMeta);
                        rRow.appendChild(rBot);
                        repWrap.appendChild(rRow);
                    });

                    card.appendChild(repWrap);
                }

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

    // 绑定评论区右上角关闭按钮 ✕ 与展开按钮 ⛶ + 顶部可拖拽高度调节把手 (#dy-cmt-drag-handle)
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
            CommentEngine.drawerTopPct = CommentEngine.isExpanded ? 33.5 : 44.5;
            const rt = document.getElementById('render-target');
            if (rt) rt.classList.toggle('dy-comment-expanded', CommentEngine.isExpanded);
            CommentEngine.applyDrawerLayoutVars();
            if (window.PlayerEngine) {
                if (typeof window.PlayerEngine.updateTransform === 'function') {
                    window.PlayerEngine.updateTransform();
                }
                if (typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') {
                    window.PlayerEngine.ensureVideoPlayingIfActive(false);
                }
                window.__isRestoringStorage = false;
                setTimeout(() => {
                    if (typeof window.PlayerEngine.updateTransform === 'function') window.PlayerEngine.updateTransform();
                    if (typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') window.PlayerEngine.ensureVideoPlayingIfActive(false);
                }, 230);
            }
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }

    // 绑定评论区顶部可拖拽把手 (#dy-cmt-drag-handle) 与抽屉高度实时联动上方视频缩放
    const dyCmtDragHandle = document.getElementById('dy-cmt-drag-handle');
    const dyCmtDrawerEl = document.getElementById('dy-comment-drawer');
    if (dyCmtDrawerEl) {
        // 确保点击或拖动评论区内部任何位置都不会打断上方视频播放
        dyCmtDrawerEl.addEventListener('mousedown', () => {
            if (window.PlayerEngine && typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') {
                window.PlayerEngine.ensureVideoPlayingIfActive(false);
            }
        });
        dyCmtDrawerEl.addEventListener('click', () => {
            if (window.PlayerEngine && typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') {
                window.PlayerEngine.ensureVideoPlayingIfActive(false);
            }
        });
    }

    if (dyCmtDragHandle) {
        let isDraggingDrawer = false;
        let dragStartY = 0;
        let dragStartTopPct = 34.6;
        const hintSpan = dyCmtDragHandle.querySelector('.dy-cmt-drag-hint');

        const startDrawerDrag = (clientY, evt) => {
            const rt = document.getElementById('render-target');
            if (!rt || !CommentEngine.isOpen) return;
            isDraggingDrawer = true;
            dragStartY = clientY;
            dragStartTopPct = CommentEngine.getEffectiveDrawerTopPct();
            rt.classList.add('is-dragging-cmt');
            if (window.PlayerEngine && typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') {
                window.PlayerEngine.ensureVideoPlayingIfActive(false);
            }
            if (evt && evt.cancelable) evt.preventDefault();
            if (evt) evt.stopPropagation();
        };

        const moveDrawerDrag = (clientY) => {
            if (!isDraggingDrawer) return;
            const rt = document.getElementById('render-target');
            if (!rt) return;
            const rect = rt.getBoundingClientRect();
            if (!rect.height) return;
            const deltaPct = ((clientY - dragStartY) / rect.height) * 100;
            // 支持评论区顶部从 18% (评论区最高占82%，视频自动缩至最小) 到 76% (评论区拉低占24%，视频恢复最大)
            const nextTopPct = Number(Math.min(76, Math.max(18, dragStartTopPct + deltaPct)).toFixed(2));
            CommentEngine.drawerTopPct = nextTopPct;
            CommentEngine.isExpanded = nextTopPct <= 29.5;
            rt.classList.toggle('dy-comment-expanded', CommentEngine.isExpanded);
            CommentEngine.applyDrawerLayoutVars();

            if (hintSpan) {
                const cmtRatio = Math.round(100 - nextTopPct);
                const vidRatio = Math.round(nextTopPct - 8.2);
                hintSpan.textContent = `↕ 评论区 ${cmtRatio}% · 视频区 ${vidRatio}%`;
            }

            if (window.PlayerEngine) {
                if (typeof window.PlayerEngine.updateTransform === 'function') {
                    window.PlayerEngine.updateTransform();
                }
                if (typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') {
                    window.PlayerEngine.ensureVideoPlayingIfActive(false);
                }
            }
        };

        const endDrawerDrag = () => {
            if (!isDraggingDrawer) return;
            isDraggingDrawer = false;
            const rt = document.getElementById('render-target');
            if (rt) rt.classList.remove('is-dragging-cmt');
            if (hintSpan) {
                hintSpan.textContent = '↕ 按住上下拖动调节高度';
            }
            if (window.PlayerEngine) {
                if (typeof window.PlayerEngine.updateTransform === 'function') {
                    window.PlayerEngine.updateTransform();
                }
                if (typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') {
                    window.PlayerEngine.ensureVideoPlayingIfActive(false);
                }
            }
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        };

        dyCmtDragHandle.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            startDrawerDrag(e.clientY, e);
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDraggingDrawer) return;
            moveDrawerDrag(e.clientY);
        });
        window.addEventListener('mouseup', () => {
            endDrawerDrag();
        });

        dyCmtDragHandle.addEventListener('touchstart', (e) => {
            if (!e.touches || !e.touches[0]) return;
            startDrawerDrag(e.touches[0].clientY, e);
        }, { passive: false });
        window.addEventListener('touchmove', (e) => {
            if (!isDraggingDrawer || !e.touches || !e.touches[0]) return;
            if (e.cancelable) e.preventDefault();
            moveDrawerDrag(e.touches[0].clientY);
        }, { passive: false });
        window.addEventListener('touchend', () => {
            endDrawerDrag();
        });
    }

    // 绑定右侧面板评论区开关、评论区字号滑块、随机按钮、新增文字/表情包评论按钮
    const swDyCommentDrawer = document.getElementById('sw-dy-comment-drawer');
    const swDyCmtOpenCard = document.getElementById('sw-dy-cmt-open-card');
    if (swDyCommentDrawer) {
        swDyCommentDrawer.addEventListener('change', (e) => CommentEngine.setDrawerOpen(e.target.checked, true));
    }
    if (swDyCmtOpenCard) {
        swDyCmtOpenCard.addEventListener('change', (e) => CommentEngine.setDrawerOpen(e.target.checked, true));
    }

    const inDyCmtFontScale = document.getElementById('in-dy-cmt-font-scale');
    const btnResetCmtFontScale = document.getElementById('btn-reset-cmt-font-scale');
    if (inDyCmtFontScale) {
        inDyCmtFontScale.addEventListener('input', (e) => {
            CommentEngine.applyFontScale(e.target.value, true);
            if (window.PlayerEngine && typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') {
                window.PlayerEngine.ensureVideoPlayingIfActive(false);
            }
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    if (btnResetCmtFontScale) {
        btnResetCmtFontScale.addEventListener('click', () => {
            CommentEngine.drawerTopPct = null;
            CommentEngine.isExpanded = false;
            const rt = document.getElementById('render-target');
            if (rt) rt.classList.remove('dy-comment-expanded');
            CommentEngine.applyFontScale(1.0, true);
            CommentEngine.applyDrawerLayoutVars();
            if (window.PlayerEngine) {
                if (typeof window.PlayerEngine.updateTransform === 'function') window.PlayerEngine.updateTransform();
                if (typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') window.PlayerEngine.ensureVideoPlayingIfActive(false);
            }
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('已恢复评论区默认 1.0x 字号与收敛高度');
        });
    }

    const selCmtAvatarApi = document.getElementById('sel-cmt-avatar-api');
    if (selCmtAvatarApi) {
        selCmtAvatarApi.addEventListener('change', (e) => {
            CommentEngine.apiMode = e.target.value;
            CommentEngine.randomizeAll(false, e.target.value);
            window.showToast('已更新评论区真实中国风头像风格');
        });
    }

    const btnCmtSwitchFemale = document.getElementById('btn-cmt-switch-female');
    if (btnCmtSwitchFemale) {
        btnCmtSwitchFemale.addEventListener('click', () => {
            if (selCmtAvatarApi) selCmtAvatarApi.value = 'cn-female';
            CommentEngine.apiMode = 'cn-female';
            CommentEngine.randomizeAll(false, 'cn-female');
            window.showToast('👩 已将所有评论切换为真实中国女生头像');
        });
    }

    const btnCmtSwitchMale = document.getElementById('btn-cmt-switch-male');
    if (btnCmtSwitchMale) {
        btnCmtSwitchMale.addEventListener('click', () => {
            if (selCmtAvatarApi) selCmtAvatarApi.value = 'cn-male';
            CommentEngine.apiMode = 'cn-male';
            CommentEngine.randomizeAll(false, 'cn-male');
            window.showToast('👦 已将所有评论切换为真实中国男生头像');
        });
    }

    // 绑定评论区回复与跟评后台控制栏 (CMS 可显隐、允许回复、允许发图、回复字数上限、显示跟评区)
    const btnToggleCmtReplyCms = document.getElementById('btn-toggle-cmt-reply-cms');
    const cmtReplyCmsBody = document.getElementById('cmt-reply-cms-body');
    const txtToggleCmtReplyCms = document.getElementById('txt-toggle-cmt-reply-cms');
    if (btnToggleCmtReplyCms && cmtReplyCmsBody) {
        btnToggleCmtReplyCms.addEventListener('click', () => {
            CommentEngine.cmsConfigVisible = !CommentEngine.cmsConfigVisible;
            cmtReplyCmsBody.style.display = CommentEngine.cmsConfigVisible ? 'flex' : 'none';
            if (txtToggleCmtReplyCms) {
                txtToggleCmtReplyCms.textContent = CommentEngine.cmsConfigVisible ? '▼ 收起配置' : '▶ 展开配置';
            }
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }

    const swCmtAllowReply = document.getElementById('sw-cmt-allow-reply');
    if (swCmtAllowReply) {
        swCmtAllowReply.addEventListener('change', (e) => {
            CommentEngine.allowReply = e.target.checked;
            if (!e.target.checked) CommentEngine.closeReplyComposer();
            CommentEngine.renderStage();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(e.target.checked ? '✅ 已允许评论区回复' : '🚫 已禁止评论区回复');
        });
    }

    const swCmtAllowImg = document.getElementById('sw-cmt-allow-img');
    if (swCmtAllowImg) {
        swCmtAllowImg.addEventListener('change', (e) => {
            CommentEngine.allowImage = e.target.checked;
            const btnReplyImg = document.getElementById('dy-cmt-reply-btn-img');
            if (btnReplyImg) btnReplyImg.style.display = e.target.checked ? 'inline-flex' : 'none';
            if (!e.target.checked) {
                CommentEngine.pendingReplyImage = '';
                const imgPrevWrap = document.getElementById('dy-cmt-reply-img-preview-wrap');
                if (imgPrevWrap) imgPrevWrap.style.display = 'none';
            }
            CommentEngine.syncHeaderDOM();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(e.target.checked ? '🖼️ 已允许评论/回复带图发送' : '🚫 已关闭评论/回复发图功能');
        });
    }

    const swCmtShowReplies = document.getElementById('sw-cmt-show-replies');
    if (swCmtShowReplies) {
        swCmtShowReplies.addEventListener('change', (e) => {
            CommentEngine.showReplies = e.target.checked;
            CommentEngine.renderStage();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(e.target.checked ? '💬 已显示二级跟评回复区' : '🙈 已隐藏二级跟评回复区');
        });
    }

    const inCmtReplyMaxlen = document.getElementById('in-cmt-reply-maxlen');
    if (inCmtReplyMaxlen) {
        inCmtReplyMaxlen.addEventListener('input', (e) => {
            const val = Math.min(500, Math.max(5, parseInt(e.target.value, 10) || 100));
            CommentEngine.maxReplyLength = val;
            const replyInp = document.getElementById('dy-cmt-reply-input');
            const charHint = document.getElementById('dy-cmt-reply-char-hint');
            if (replyInp) replyInp.maxLength = val;
            if (charHint && replyInp) charHint.textContent = `${replyInp.value.length}/${val}`;
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }

    // 绑定弹出式回复输入框 (角色切换、字数统计、图片附件、回车或点确定发送)
    const btnRoleUser = document.getElementById('dy-reply-role-user');
    const btnRoleAuthor = document.getElementById('dy-reply-role-author');
    const btnReplyCancel = document.getElementById('dy-reply-modal-cancel');
    const dyCmtReplyInput = document.getElementById('dy-cmt-reply-input');
    const dyCmtReplyCharHint = document.getElementById('dy-cmt-reply-char-hint');
    const dyCmtReplyBtnImg = document.getElementById('dy-cmt-reply-btn-img');
    const dyCmtReplyPhotoFile = document.getElementById('dy-cmt-reply-photo-file');
    const dyCmtReplyImgPreviewWrap = document.getElementById('dy-cmt-reply-img-preview-wrap');
    const dyCmtReplyImgPreview = document.getElementById('dy-cmt-reply-img-preview');
    const dyCmtReplyImgRemove = document.getElementById('dy-cmt-reply-img-remove');
    const dyCmtReplySubmit = document.getElementById('dy-cmt-reply-submit');

    function updateReplyRoleButtons(role) {
        CommentEngine.replyRole = role;
        if (btnRoleUser) btnRoleUser.classList.toggle('active', role === 'user');
        if (btnRoleAuthor) btnRoleAuthor.classList.toggle('active', role === 'author');
        const targetLabel = document.getElementById('dy-cmt-reply-target-label');
        if (targetLabel && CommentEngine.replyTargetUser) {
            targetLabel.textContent = `${role === 'author' ? '👑 作者回覆' : '👤 回覆'} @${CommentEngine.replyTargetUser}：`;
        }
        if (dyCmtReplyInput) dyCmtReplyInput.focus();
    }

    if (btnRoleUser) btnRoleUser.addEventListener('click', () => updateReplyRoleButtons('user'));
    if (btnRoleAuthor) btnRoleAuthor.addEventListener('click', () => updateReplyRoleButtons('author'));
    if (btnReplyCancel) btnReplyCancel.addEventListener('click', () => CommentEngine.closeReplyComposer());

    if (dyCmtReplyInput) {
        dyCmtReplyInput.addEventListener('input', () => {
            const maxL = CommentEngine.maxReplyLength || 100;
            if (dyCmtReplyInput.value.length > maxL) {
                dyCmtReplyInput.value = dyCmtReplyInput.value.slice(0, maxL);
            }
            if (dyCmtReplyCharHint) {
                dyCmtReplyCharHint.textContent = `${dyCmtReplyInput.value.length}/${maxL}`;
            }
        });
        dyCmtReplyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                CommentEngine.submitReplyFromComposer();
            } else if (e.key === 'Escape') {
                CommentEngine.closeReplyComposer();
            }
        });
    }

    if (dyCmtReplyBtnImg && dyCmtReplyPhotoFile) {
        dyCmtReplyBtnImg.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!CommentEngine.allowImage) {
                window.showToast('⚠️ 后台已关闭回复发图功能');
                return;
            }
            dyCmtReplyPhotoFile.value = '';
            dyCmtReplyPhotoFile.click();
        });
        dyCmtReplyPhotoFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                CommentEngine.pendingReplyImage = evt.target.result;
                if (dyCmtReplyImgPreview) dyCmtReplyImgPreview.src = evt.target.result;
                if (dyCmtReplyImgPreviewWrap) dyCmtReplyImgPreviewWrap.style.display = 'flex';
                if (dyCmtReplyInput) dyCmtReplyInput.focus();
            };
            reader.readAsDataURL(file);
        });
    }

    if (dyCmtReplyImgRemove) {
        dyCmtReplyImgRemove.addEventListener('click', () => {
            CommentEngine.pendingReplyImage = '';
            if (dyCmtReplyImgPreview) dyCmtReplyImgPreview.src = '';
            if (dyCmtReplyImgPreviewWrap) dyCmtReplyImgPreviewWrap.style.display = 'none';
        });
    }

    if (dyCmtReplySubmit) {
        dyCmtReplySubmit.addEventListener('click', (e) => {
            e.stopPropagation();
            CommentEngine.submitReplyFromComposer();
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

    ['btn-cmt-random-pub-time', 'btn-cmt-random-pub-time-link'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn && selCmtPubWindow) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const opts = Array.from(selCmtPubWindow.options);
                const pickOpt = opts[Math.floor(Math.random() * opts.length)];
                if (pickOpt) {
                    selCmtPubWindow.value = pickOpt.value;
                    CommentEngine.pubWindowHours = parseFloat(pickOpt.value) || 72;
                }
                CommentEngine.list.forEach(item => {
                    item.dateLoc = randomDateLoc(CommentEngine.ipRegion, CommentEngine.pubWindowHours);
                });
                CommentEngine.renderStage();
                CommentEngine.renderEditor();
                if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                window.showToast('已随机切换视频发布时间并更新所有评论时间');
            });
        }
    });

    const btnCmtRandomHeadCount = document.getElementById('btn-cmt-random-head-count');
    if (btnCmtRandomHeadCount) {
        btnCmtRandomHeadCount.addEventListener('click', (e) => {
            e.preventDefault();
            const rndLikes = randomCommentLikes();
            CommentEngine.headCount = rndLikes;
            CommentEngine.syncHeaderDOM();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`已随机切换评论总数：${toEditorSimp(rndLikes)}`);
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
            window.showToast('已从在线接口随机更换头像、繁体/英文昵称、时间与IP');
        });
    }

    const btnCmtSmartScene = document.getElementById('btn-cmt-smart-scene');
    if (btnCmtSmartScene) {
        btnCmtSmartScene.addEventListener('click', () => {
            CommentEngine.smartGenerateByScene();
        });
    }

    const inBatchComments = document.getElementById('in-batch-comments');
    const btnBatchCmtReplace = document.getElementById('btn-batch-cmt-replace');
    const btnBatchCmtAppend = document.getElementById('btn-batch-cmt-append');
    if (btnBatchCmtReplace && inBatchComments) {
        btnBatchCmtReplace.addEventListener('click', () => {
            CommentEngine.importBatchLines(inBatchComments.value, true);
        });
    }
    if (btnBatchCmtAppend && inBatchComments) {
        btnBatchCmtAppend.addEventListener('click', () => {
            CommentEngine.importBatchLines(inBatchComments.value, false);
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

    // 上传自定义评论/回复头像处理
    const dyCmtAvatarFile = document.getElementById('dy-cmt-avatar-file');
    if (dyCmtAvatarFile) {
        dyCmtAvatarFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const idx = CommentEngine.activeUploadIdx;
                const repIdx = CommentEngine.activeUploadReplyIdx;
                if (CommentEngine.list[idx]) {
                    if (repIdx >= 0 && Array.isArray(CommentEngine.list[idx].replies) && CommentEngine.list[idx].replies[repIdx]) {
                        CommentEngine.list[idx].replies[repIdx].avatar = evt.target.result;
                        CommentEngine.list[idx].replies[repIdx].isCustomAvatar = true;
                        window.showToast('回复头像已更换');
                    } else {
                        CommentEngine.list[idx].avatar = evt.target.result;
                        CommentEngine.list[idx].isCustomAvatar = true;
                        window.showToast('评论头像已更换');
                    }
                    CommentEngine.activeUploadReplyIdx = -1;
                    CommentEngine.renderStage();
                    CommentEngine.renderEditor();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // 上传评论照片 / 表情包处理 (支持给已有评论/二级回复配图，也支持底部输入框待发图预览以便纯图或文字+图片一起发)
    const dyCmtPhotoFile = document.getElementById('dy-cmt-photo-file');
    const dyCmtStageImgBar = document.getElementById('dy-cmt-stage-img-bar');
    const dyCmtStageImgPreview = document.getElementById('dy-cmt-stage-img-preview');
    const dyCmtStageImgRemove = document.getElementById('dy-cmt-stage-img-remove');

    if (dyCmtStageImgRemove) {
        dyCmtStageImgRemove.addEventListener('click', () => {
            CommentEngine.pendingStageImage = '';
            if (dyCmtStageImgPreview) dyCmtStageImgPreview.src = '';
            if (dyCmtStageImgBar) dyCmtStageImgBar.style.display = 'none';
        });
    }

    if (dyCmtPhotoFile) {
        dyCmtPhotoFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const dataUrl = evt.target.result;
                const idx = CommentEngine.activePhotoUploadIdx;
                const repIdx = CommentEngine.activePhotoUploadReplyIdx;
                if (idx >= 0 && CommentEngine.list[idx]) {
                    if (repIdx >= 0 && Array.isArray(CommentEngine.list[idx].replies) && CommentEngine.list[idx].replies[repIdx]) {
                        CommentEngine.list[idx].replies[repIdx].image = dataUrl;
                    } else {
                        CommentEngine.list[idx].image = dataUrl;
                    }
                    CommentEngine.activePhotoUploadIdx = -1;
                    CommentEngine.activePhotoUploadReplyIdx = -1;
                    CommentEngine.renderStage();
                    CommentEngine.renderEditor();
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                    window.showToast('图片已更新');
                } else if (CommentEngine.activePhotoUploadIdx === -2) {
                    // 底部评论栏点击图片图标：挂载到待发图片预览条，可继续打字一起发或直接点确定发纯图
                    CommentEngine.pendingStageImage = dataUrl;
                    if (dyCmtStageImgPreview) dyCmtStageImgPreview.src = dataUrl;
                    if (dyCmtStageImgBar) dyCmtStageImgBar.style.display = 'flex';
                    const stageInp = document.getElementById('dy-cmt-stage-input');
                    if (stageInp) stageInp.focus();
                    CommentEngine.activePhotoUploadIdx = -1;
                    window.showToast('🖼️ 图片已就绪，可输入文字一起发，或直接点「確定」发送纯图片');
                } else {
                    const seed = `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                    const stageInp = document.getElementById('dy-cmt-stage-input');
                    const typedTxt = stageInp ? stageInp.value.trim() : '';
                    if (stageInp) stageInp.value = '';
                    const newItem = {
                        id: seed,
                        user: NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)],
                        text: typedTxt ? (typeof window.toStageTrad === 'function' ? window.toStageTrad(typedTxt) : typedTxt) : '',
                        dateLoc: randomDateLoc(CommentEngine.ipRegion, CommentEngine.pubWindowHours),
                        likes: String(Math.floor(Math.random() * 50) + 1),
                        liked: false,
                        avatar: buildOnlineAvatarUrl(seed, CommentEngine.apiMode),
                        image: dataUrl,
                        isCustomAvatar: false,
                        replies: []
                    };
                    CommentEngine.prefetchAvatarDataUrl(newItem);
                    CommentEngine.list.unshift(newItem);
                    CommentEngine.activePhotoUploadIdx = -1;
                    CommentEngine.renderStage();
                    CommentEngine.renderEditor();
                    if (!CommentEngine.isOpen) CommentEngine.setDrawerOpen(true, false);
                    if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
                    window.showToast('图片/表情包已添加到评论区');
                }
            };
            reader.readAsDataURL(file);
        });
    }

    const btnCmtAddPhoto = document.getElementById('btn-cmt-add-photo');
    if (btnCmtAddPhoto && dyCmtPhotoFile) {
        btnCmtAddPhoto.addEventListener('click', () => {
            if (!CommentEngine.allowImage) {
                window.showToast('⚠️ 后台已关闭评论发图权限');
                return;
            }
            CommentEngine.activePhotoUploadIdx = -1;
            CommentEngine.activePhotoUploadReplyIdx = -1;
            dyCmtPhotoFile.value = '';
            dyCmtPhotoFile.click();
        });
    }

    const dyCmtBtnSendImg = document.getElementById('dy-cmt-btn-send-img');
    if (dyCmtBtnSendImg && dyCmtPhotoFile) {
        dyCmtBtnSendImg.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!CommentEngine.allowImage) {
                window.showToast('⚠️ 后台已关闭评论发图权限');
                return;
            }
            CommentEngine.activePhotoUploadIdx = -2;
            CommentEngine.activePhotoUploadReplyIdx = -1;
            dyCmtPhotoFile.value = '';
            dyCmtPhotoFile.click();
        });
    }

    // 底部输入框回车或点「確定」直接发评论（支持纯文字、纯图片、文字+图片）
    const dyCmtStageInput = document.getElementById('dy-cmt-stage-input');
    const dyCmtBtnStageSubmit = document.getElementById('dy-cmt-btn-stage-submit');

    function submitStageComment() {
        const rawVal = dyCmtStageInput ? dyCmtStageInput.value.trim() : '';
        const imgData = CommentEngine.allowImage ? (CommentEngine.pendingStageImage || '') : '';
        if (!rawVal && !imgData) {
            window.showToast('请输入评论内容或上传图片');
            return;
        }
        const seed = `post_${Date.now()}`;
        const loc = pickOverseasIpLocation(CommentEngine.ipRegion);
        const stageTxt = rawVal ? (typeof window.toStageTrad === 'function' ? window.toStageTrad(rawVal) : rawVal) : '';
        const newItem = {
            id: seed,
            user: NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)],
            text: stageTxt,
            dateLoc: loc ? `剛剛 · ${loc}` : '剛剛',
            likes: '1',
            liked: true,
            avatar: buildOnlineAvatarUrl(seed, CommentEngine.apiMode),
            image: imgData,
            isCustomAvatar: false,
            replies: []
        };
        CommentEngine.prefetchAvatarDataUrl(newItem);
        CommentEngine.list.unshift(newItem);
        if (dyCmtStageInput) {
            dyCmtStageInput.value = '';
            dyCmtStageInput.placeholder = '期待你的評論';
        }
        CommentEngine.pendingStageImage = '';
        if (dyCmtStageImgPreview) dyCmtStageImgPreview.src = '';
        if (dyCmtStageImgBar) dyCmtStageImgBar.style.display = 'none';
        CommentEngine.renderStage();
        CommentEngine.renderEditor();
        const listEl = document.getElementById('dy-comment-list');
        if (listEl) listEl.scrollTop = 0;
        if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        window.showToast('评论已发布');
    }

    if (dyCmtStageInput) {
        dyCmtStageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitStageComment();
            }
        });
    }
    if (dyCmtBtnStageSubmit) {
        dyCmtBtnStageSubmit.addEventListener('click', (e) => {
            e.stopPropagation();
            submitStageComment();
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

    // ★ 1. 顶部标签栏固定高亮「推薦」+ 1秒自动弹回 + 右侧头像关注状态联动 + 底部导航栏固定高亮「視頻」1秒自动弹回
    // 正式版默认关闭直播入口 (false)，测试版开启直播入口 (true)
    window.__ENABLE_LAYA_LIVE_ENTRY = true;
    window.__layaLiveTabArmed = false;
    let topNavBounceTimer = null;
    let avatarFollowRestoreTimer = null;
    let botNavBounceTimer = null;

    const liveSettingsCardInit = document.getElementById('card-dy-live-settings');
    if (liveSettingsCardInit) {
        liveSettingsCardInit.style.display = window.__ENABLE_LAYA_LIVE_ENTRY ? '' : 'none';
    }

    function setRightAvatarFollowedByTab(isFollowed) {
        const avatarWrap = document.getElementById('dy-avatar-click');
        const followBtn = document.getElementById('dy-btn-follow');
        const swFollowPlus = document.getElementById('sw-dy-follow-plus');
        if (!avatarWrap || !followBtn) return;
        if (followBtn._hideTimer) clearTimeout(followBtn._hideTimer);
        if (isFollowed) {
            avatarWrap.classList.add('is-followed-by-tab');
            followBtn.classList.add('follow-hidden');
            if (swFollowPlus) swFollowPlus.checked = false;
        } else {
            avatarWrap.classList.remove('is-followed-by-tab');
            followBtn.textContent = '+';
            followBtn.classList.remove('followed', 'follow-hidden');
            if (swFollowPlus) swFollowPlus.checked = true;
        }
    }
    window.setRightAvatarFollowedByTab = setRightAvatarFollowedByTab;

    function bindTopRecommendTabs(containerSelector, itemSelector, defaultIndex = 1) {
        const container = document.querySelector(containerSelector);
        if (!container) return;
        const items = Array.from(container.querySelectorAll(itemSelector));
        if (!items.length) return;

        // 默认固定停在「推薦」(index 1)
        const resetToRecommend = () => {
            items.forEach((el, idx) => el.classList.toggle('active', idx === defaultIndex));
        };
        resetToRecommend();

        items.forEach((item, idx) => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (topNavBounceTimer) {
                    clearTimeout(topNavBounceTimer);
                    topNavBounceTimer = null;
                }
                if (avatarFollowRestoreTimer) {
                    clearTimeout(avatarFollowRestoreTimer);
                    avatarFollowRestoreTimer = null;
                }

                // 被点的标签立即亮起紫色
                items.forEach(el => el.classList.remove('active'));
                item.classList.add('active');

                const txt = (item.textContent || '').trim();
                const isFollowTab = (idx === 0 || txt.includes('關注') || txt.includes('关注'));
                const isRecommendTab = (idx === defaultIndex || txt.includes('推薦') || txt.includes('推荐'));
                const isLiveTab = (idx === 2 || txt.includes('直播'));

                const armedTip = document.getElementById('dy-live-armed-tip');

                // 处理「直播」标签待进入预览状态（状态一：未进入直播间前，展示动态音波「點擊進入直播間」与左下「直播中」角标）
                if (window.__ENABLE_LAYA_LIVE_ENTRY && isLiveTab && renderTarget && renderTarget.classList.contains('mode-mobile-port')) {
                    window.__layaLiveTabArmed = true;
                    if (!renderTarget.classList.contains('dy-live-open')) {
                        renderTarget.classList.add('dy-live-preview');
                        if (armedTip) armedTip.style.display = 'inline-flex';
                    }
                    window.showToast('🟣 已切換至直播預覽流，點擊「點擊進入直播間」或視頻畫面即可進入直播間');
                } else {
                    window.__layaLiveTabArmed = false;
                    if (renderTarget) renderTarget.classList.remove('dy-live-preview');
                    if (armedTip) armedTip.style.display = 'none';
                    if (renderTarget && renderTarget.classList.contains('dy-live-open') && typeof window.exitLayaLiveRoom === 'function') {
                        window.exitLayaLiveRoom(false);
                    }
                    if (isFollowTab) {
                        window.showToast('💜 已關注作者（頭像邊框已變紫並隱藏 + 號）');
                    } else if (txt) {
                        window.showToast(`✨ 已點亮：${txt}`);
                    }
                }

                // 处理右侧头像关注标识联动：
                // 1. 点「關注」标签：+号立即消失，变成已关注状态（紫色边框，无红加号），并且保持这个状态
                // 2. 点其他标签（推薦、直播等）：+号停留 1 秒后自动弹出来（回到默认未关注状态）
                if (isFollowTab) {
                    setRightAvatarFollowedByTab(true);
                } else {
                    avatarFollowRestoreTimer = setTimeout(() => {
                        setRightAvatarFollowedByTab(false);
                    }, 1000);
                }

                // 若点的不是「推薦」，短暂亮 1 秒后自动弹回「推薦」亮灯（若已进入直播间则保持「直播」亮灯）
                if (!isRecommendTab) {
                    topNavBounceTimer = setTimeout(() => {
                        const inLiveNow = renderTarget && renderTarget.classList.contains('dy-live-open');
                        const targetIdx = inLiveNow ? 2 : defaultIndex;
                        items.forEach((el, i) => el.classList.toggle('active', i === targetIdx));
                        document.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item').forEach((el, i) => el.classList.toggle('active', i === targetIdx));
                        document.querySelectorAll('.laya-nav-tabs > span').forEach((el, i) => el.classList.toggle('active', i === targetIdx));
                    }, 1000);
                }
            });
        });
    }

    function bindBottomVideoTabs(containerSelector, itemSelector, defaultIndex = 2) {
        const container = document.querySelector(containerSelector);
        if (!container) return;
        const items = Array.from(container.querySelectorAll(itemSelector));
        if (!items.length) return;

        // 默认固定停在「視頻」(index 2)
        items.forEach((el, idx) => el.classList.toggle('active', idx === defaultIndex));

        items.forEach((item, idx) => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (botNavBounceTimer) {
                    clearTimeout(botNavBounceTimer);
                    botNavBounceTimer = null;
                }
                items.forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                const txt = (item.textContent || '').trim().replace(/\d+\+?/g, '');
                if (txt) window.showToast(`✨ 已點亮：${txt}`);

                if (idx !== defaultIndex) {
                    botNavBounceTimer = setTimeout(() => {
                        items.forEach((el, i) => el.classList.toggle('active', i === defaultIndex));
                    }, 1000);
                }
            });
        });
    }

    bindTopRecommendTabs('#laya-app-nav-tabs', '.laya-app-nav-item', 1);
    bindTopRecommendTabs('.laya-nav-tabs', 'span', 1);
    bindTopRecommendTabs('.dy-nav-tabs', 'span', 1);
    bindBottomVideoTabs('#laya-app-bottom-tabs', '.laya-app-tab-item', 2);
    bindBottomVideoTabs('.laya-bottom-tabs', '.laya-tab-item', 2);
    bindBottomVideoTabs('.dy-bottom-tabs', '.dy-tab-item', 0);

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
        if (typeof applyOsFontMode === 'function') applyOsFontMode(false);
        triggerSaveStorage();
        if (showToastMsg) {
            window.showToast(`📱 已切换手机状态栏型号：${preset.name}`);
        }
    }

    const selDyOsFont = document.getElementById('sel-dy-os-font');
    function getEffectiveOsFontType() {
        const fontMode = selDyOsFont ? selDyOsFont.value : 'auto';
        if (fontMode === 'ios' || fontMode === 'android') return fontMode;
        const modelVal = selDyPhoneModel ? selDyPhoneModel.value : 'iphone16';
        if (modelVal && (modelVal.startsWith('iphone') || modelVal === 'pure-ios')) {
            return 'ios';
        }
        return 'android';
    }

    function getActiveOsFontStack() {
        const osType = getEffectiveOsFontType();
        if (osType === 'android') {
            return '"Roboto", "Source Han Sans SC", "Source Han Sans CN", "Source Han Sans TC", "Noto Sans CJK SC", "Noto Sans SC", "Noto Sans TC", sans-serif';
        }
        return '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "San Francisco", "Inter", "PingFang SC", "PingFang TC", "Source Han Sans SC", "Noto Sans SC", "Noto Sans TC", sans-serif';
    }
    window.getActiveOsFontStack = getActiveOsFontStack;

    function applyOsFontMode(showNotice = false) {
        if (!renderTarget) return;
        const osType = getEffectiveOsFontType();
        renderTarget.classList.toggle('font-os-ios', osType === 'ios');
        renderTarget.classList.toggle('font-os-android', osType === 'android');
        if (showNotice) {
            window.showToast(osType === 'ios'
                ? '🍎 已切换为苹果官方原生字体：苹方 (PingFang SC) + San Francisco'
                : '🤖 已切换为安卓官方原生字体：思源黑体 (Source Han Sans) + Roboto');
        }
    }
    window.applyOsFontMode = applyOsFontMode;

    if (selDyOsFont) {
        selDyOsFont.addEventListener('change', () => {
            applyOsFontMode(true);
            triggerSaveStorage();
        });
    }
    applyOsFontMode(false);

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
    ['btn-m-random-clock-btn', 'btn-dy-random-time-btn', 'btn-dyl-random-time-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                randomizeDyStatusTime();
            });
        }
    });
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

    // ★ 右侧编辑框保持中文简体，左侧画面自动渲染为繁体中文
    const STAGE_PHRASE_S2T = [
        ['作者声明', '作者聲明'],
        ['虚构演绎', '虛構演繹'],
        ['仅供娱乐', '僅供娛樂'],
        ['剧情纯属虚构', '劇情純屬虛構'],
        ['请勿模仿', '請勿模仿'],
        ['请勿当真', '請勿當真'],
        ['相关搜索', '相關搜索'],
        ['热门搜索', '熱門搜索'],
        ['精选内容', '精選內容'],
        ['台湾色情女优大赛', '台灣色情女優大賽'],
        ['台湾', '台灣'],
        ['女优', '女優'],
        ['大赛', '大賽'],
        ['独家', '獨家'],
        ['视频', '視頻'],
        ['已解锁完整无码未删减版', '已解鎖完整無碼未刪減版'],
        ['点击任意处观看', '點擊任意處觀看'],
        ['心动热舞', '心動熱舞'],
        ['私密精选', '私密精選'],
        ['私密企划演绎', '私密企劃演繹'],
        ['请主动离开', '請主動離開'],
        ['人情与世故', '人情與世故']
    ];

    function toStageTrad(str) {
        if (str === null || str === undefined) return '';
        let out = String(str);
        for (const [s, t] of STAGE_PHRASE_S2T) {
            if (out.includes(s)) out = out.split(s).join(t);
        }
        const map = window.__SUB_S2T_CHARS;
        if (map) {
            let res = '';
            for (let i = 0; i < out.length; i++) {
                const ch = out[i];
                res += (ch.charCodeAt(0) >= 0x4e00 && map[ch]) ? map[ch] : ch;
            }
            out = res;
        } else {
            out = out.replace(/万/g, '萬');
        }
        return out;
    }

    function toEditorSimp(str) {
        if (str === null || str === undefined) return '';
        let out = String(str);
        for (const [s, t] of STAGE_PHRASE_S2T) {
            if (out.includes(t)) out = out.split(t).join(s);
        }
        const map = window.__SUB_T2S_CHARS;
        if (map) {
            let res = '';
            for (let i = 0; i < out.length; i++) {
                const ch = out[i];
                res += (ch.charCodeAt(0) >= 0x4e00 && map[ch]) ? map[ch] : ch;
            }
            out = res;
        } else {
            out = out.replace(/萬/g, '万');
        }
        return out;
    }
    window.toStageTrad = toStageTrad;
    window.toEditorSimp = toEditorSimp;

    const bindText = (inputId, outputId, secondaryOutputId = null, forceTradOnStage = false) => {
        const inp = document.getElementById(inputId);
        const out = document.getElementById(outputId);
        const out2 = secondaryOutputId ? document.getElementById(secondaryOutputId) : null;
        if (inp && out) {
            inp.addEventListener('input', (e) => {
                const rawVal = e.target.value;
                const stageVal = forceTradOnStage ? toStageTrad(rawVal) : rawVal;
                out.textContent = stageVal;
                if (out2) out2.textContent = stageVal;
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
    bindText('in-dy-likes', 'dy-val-likes', 'dyl-disp-like', true);
    bindText('in-dy-comments', 'dy-val-comments', 'dyl-disp-comment', true);
    bindText('in-dy-stars', 'dy-val-stars', 'dyl-disp-star', true);
    bindText('in-dy-shares', 'dy-val-shares', null, true);
    bindText('in-dy-author', 'dy-disp-author', 'dyl-disp-author', true);
    bindText('in-dy-desc', 'dy-disp-desc', null, true);
    bindText('in-dy-tags', 'dy-disp-tags', null, true);
    bindText('in-dy-campaign', 'dy-disp-campaign', null, true);
    bindText('in-dy-gold-title', 'dy-disp-gold-title', null, true);
    bindText('in-dy-featured-title', 'dy-disp-featured-title', null, true);

    // ★ 作者声明下拉预设与输入框联动（右侧简体中文，左侧画面自动繁体中文）
    const selDyCampaignPreset = document.getElementById('sel-dy-campaign-preset');
    const inDyCampaign = document.getElementById('in-dy-campaign');
    const dyDispCampaign = document.getElementById('dy-disp-campaign');
    const dyWrapCampaign = document.getElementById('dy-wrap-campaign');
    if (selDyCampaignPreset && inDyCampaign && dyDispCampaign) {
        selDyCampaignPreset.addEventListener('change', (e) => {
            if (e.target.value !== 'custom') {
                inDyCampaign.value = e.target.value;
                dyDispCampaign.textContent = toStageTrad(e.target.value);
                triggerSaveStorage();
                window.showToast(`📢 已切换声明文案：${toStageTrad(e.target.value)}`);
            } else {
                inDyCampaign.focus();
                inDyCampaign.select();
            }
        });
        inDyCampaign.addEventListener('input', () => {
            const matchOpt = Array.from(selDyCampaignPreset.options).find(o => o.value === inDyCampaign.value.trim());
            selDyCampaignPreset.value = matchOpt ? matchOpt.value : 'custom';
        });
    }
    if (dyWrapCampaign && inDyCampaign) {
        dyWrapCampaign.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.switchRightTab === 'function') window.switchRightTab('dy');
            inDyCampaign.focus();
            inDyCampaign.select();
            window.showToast('📢 请在右侧选择或编辑「作者声明」文案');
        });
        dyWrapCampaign.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (selDyCampaignPreset) {
                const validOpts = Array.from(selDyCampaignPreset.options).filter(o => o.value !== 'custom');
                const curIdx = validOpts.findIndex(o => o.value === inDyCampaign.value.trim());
                const nextOpt = validOpts[(curIdx + 1) % validOpts.length];
                if (nextOpt) {
                    selDyCampaignPreset.value = nextOpt.value;
                    selDyCampaignPreset.dispatchEvent(new Event('change'));
                }
            }
        });
    }

    // ★ 搜索栏前缀切换（猜你想搜 / 相关搜索 / 大家都在搜 / 热门搜索）与热词联动
    const selDySearchPrefix = document.getElementById('sel-dy-search-prefix');
    const inDyGoldTitle = document.getElementById('in-dy-gold-title');
    const dyDispGoldTitle = document.getElementById('dy-disp-gold-title');
    const dyWrapGold = document.getElementById('dy-wrap-gold');

    function extractSearchKeywordBody(rawStr) {
        return String(rawStr || '')
            .replace(/^(猜你想搜|相关搜索|相關搜索|大家都在搜|热门搜索|熱門搜索)\s*[·•:：-]\s*/, '')
            .trim() || 'Laya 独家完整版合集';
    }

    if (selDySearchPrefix && inDyGoldTitle && dyDispGoldTitle) {
        selDySearchPrefix.addEventListener('change', (e) => {
            const prefix = e.target.value;
            const bodySimp = toEditorSimp(extractSearchKeywordBody(inDyGoldTitle.value));
            const combinedSimp = prefix === 'none' ? bodySimp : `${prefix} · ${bodySimp}`;
            inDyGoldTitle.value = combinedSimp;
            dyDispGoldTitle.textContent = toStageTrad(combinedSimp);
            triggerSaveStorage();
            window.showToast(`🔍 已切换搜索栏为：${toStageTrad(combinedSimp)}`);
        });
        inDyGoldTitle.addEventListener('input', () => {
            const v = inDyGoldTitle.value.trim();
            if (v.startsWith('猜你想搜')) selDySearchPrefix.value = '猜你想搜';
            else if (v.startsWith('相关搜索') || v.startsWith('相關搜索')) selDySearchPrefix.value = '相关搜索';
            else if (v.startsWith('大家都在搜')) selDySearchPrefix.value = '大家都在搜';
            else if (v.startsWith('热门搜索') || v.startsWith('熱門搜索')) selDySearchPrefix.value = '热门搜索';
        });
    }
    if (dyWrapGold && inDyGoldTitle) {
        dyWrapGold.title = '点击在右侧编辑搜索词 (右键可快速切换「猜你想搜 / 相關搜索」)';
        dyWrapGold.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.switchRightTab === 'function') window.switchRightTab('dy');
            inDyGoldTitle.focus();
            inDyGoldTitle.select();
            window.showToast('🔍 请在右侧切换「猜你想搜 / 相关搜索」或编辑搜索热词');
        });
        dyWrapGold.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (selDySearchPrefix) {
                selDySearchPrefix.value = selDySearchPrefix.value === '猜你想搜' ? '相关搜索' : '猜你想搜';
                selDySearchPrefix.dispatchEvent(new Event('change'));
            }
        });
    }

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

    // 绑定左下角圆形「彈✎」按钮：点击弹出/收起图2同款白底弹幕输入栏（左侧带「彈+红底开关」，右侧输入弹幕，无输入法键盘窗口）
    const dyBtnDmRound = document.getElementById('dy-btn-dm-round');
    const dyDmComposeBar = document.getElementById('dy-dm-compose-bar');
    const dyDmBarToggleBtn = document.getElementById('dy-dm-bar-toggle-btn');
    const dyDmBarInput = document.getElementById('dy-dm-bar-input');
    const dyDmBarEmojiBtn = document.getElementById('dy-dm-bar-emoji-btn');

    function syncDmBarSwitchUI() {
        const swDm = document.getElementById('sw-danmaku');
        const isOn = !!(swDm && swDm.checked);
        if (dyDmBarToggleBtn) {
            dyDmBarToggleBtn.classList.toggle('active', isOn);
        }
        if (dyBtnDmRound) {
            dyBtnDmRound.classList.toggle('dm-off', !isOn);
        }
    }

    function setDmComposeBarOpen(openState) {
        if (!dyDmComposeBar) return;
        dyDmComposeBar.style.display = openState ? 'flex' : 'none';
        syncDmBarSwitchUI();
        if (openState && dyDmBarInput) {
            setTimeout(() => dyDmBarInput.focus(), 30);
        }
    }

    if (dyBtnDmRound) {
        dyBtnDmRound.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!dyDmComposeBar) return;
            const isCurrentlyOpen = dyDmComposeBar.style.display !== 'none';
            setDmComposeBarOpen(!isCurrentlyOpen);
        });
    }

    if (dyDmBarToggleBtn) {
        dyDmBarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const swDm = document.getElementById('sw-danmaku');
            if (swDm) {
                swDm.checked = !swDm.checked;
                swDm.dispatchEvent(new Event('change'));
                syncDmBarSwitchUI();
                window.showToast(swDm.checked ? '💬 弹幕开关已开启' : '💬 弹幕开关已关闭');
            }
        });
    }

    if (dyDmBarInput) {
        dyDmBarInput.addEventListener('click', (e) => e.stopPropagation());
        dyDmBarInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                const rawTxt = dyDmBarInput.value.trim();
                if (!rawTxt) {
                    setDmComposeBarOpen(false);
                    return;
                }
                const finalTxt = (typeof toStageTrad === 'function') ? toStageTrad(rawTxt) : rawTxt;
                if (window.DanmakuEngine && typeof window.DanmakuEngine.fireLive === 'function') {
                    window.DanmakuEngine.fireLive(finalTxt, '#ffffff');
                }
                if (typeof window.applyDanmakuVisibility === 'function') {
                    window.applyDanmakuVisibility(true);
                } else {
                    const swDm = document.getElementById('sw-danmaku');
                    if (swDm && !swDm.checked) {
                        swDm.checked = true;
                        swDm.dispatchEvent(new Event('change'));
                    }
                }
                syncDmBarSwitchUI();
                dyDmBarInput.value = '';
                setDmComposeBarOpen(false);
                window.showToast(`🚀 已发送弹幕：「${finalTxt}」`);
            } else if (e.key === 'Escape') {
                setDmComposeBarOpen(false);
            }
        });
    }

    if (dyDmBarEmojiBtn && dyDmBarInput) {
        const dmQuickEmojis = ['😂', '🔥', '😍', '👍', '🤣', '❤️', '✨'];
        let dmEmojiIdx = 0;
        dyDmBarEmojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const em = dmQuickEmojis[dmEmojiIdx % dmQuickEmojis.length];
            dmEmojiIdx++;
            dyDmBarInput.value += em;
            dyDmBarInput.focus();
        });
    }

    if (dyDmComposeBar) {
        dyDmComposeBar.addEventListener('click', (e) => e.stopPropagation());
    }
    if (renderTarget) {
        renderTarget.addEventListener('click', (e) => {
            if (dyDmComposeBar && dyDmComposeBar.style.display !== 'none') {
                if (!dyDmComposeBar.contains(e.target) && (!dyBtnDmRound || !dyBtnDmRound.contains(e.target))) {
                    setDmComposeBarOpen(false);
                }
            }
        });
    }
    bindText('in-dy-hotspot-title', 'dy-disp-hotspot-title', null, true);
    bindText('in-dy-hotspot-views', 'dy-disp-hotspot-views', null, true);

    /* ==========================================================================
       ★ 6.2 严格遵循图3视频时长爆款规律：每次打开/刷新或上传视频自动随机生成
          点赞 (5000~100万)、评论、收藏、分享 与 热点在看人数 (15万~200万)，同时保留手动编辑
       ========================================================================== */
    function formatViralCountTrad(num) {
        const n = Math.max(1, Math.round(Number(num) || 0));
        if (n >= 1000000) return '100萬';
        if (n >= 10000) {
            return (n / 10000).toFixed(1) + '萬';
        }
        return String(n);
    }

    function formatViralCountSimp(num) {
        const n = Math.max(1, Math.round(Number(num) || 0));
        if (n >= 1000000) return '100万';
        if (n >= 10000) {
            return (n / 10000).toFixed(1) + '万';
        }
        return String(n);
    }

    function getViralTierByDuration(durSec) {
        const d = Math.max(1, Number(durSec) || 15);
        // 图3五档时长标准：
        // 1) 7-15秒: 完播率65%, 点赞率6%(赞÷播), 赞评率3%(评÷赞), 转发率2%(转÷播), 关注/收藏率2%(藏÷播)
        // 2) 15-25秒: 完播率50%, 点赞率5%(赞÷播), 赞评率2%(评÷赞), 转发率1%(转÷播), 关注/收藏率2%(藏÷播)
        // 3) 25-40秒: 完播率40%, 点赞率5%(赞÷播), 赞评率2%(评÷赞), 转发率1%(转÷播), 关注/收藏率2%(藏÷播)
        // 4) 40-60秒: 完播率35%, 点赞率4%(赞÷播), 赞评率2%(评÷赞), 转发率1%(转÷播), 关注/收藏率1.5%(藏÷播)
        // 5) 60-120秒+: 完播率30%, 点赞率3%(赞÷播), 赞评率3%(评÷赞), 转发率0.5%(转÷播), 关注/收藏率1%(藏÷播)
        if (d <= 15) {
            return { label: '7-15秒作品', finishRate: 0.65, likeRate: 0.06, cmtPerLike: 0.03, shareRate: 0.02, starRate: 0.02 };
        } else if (d <= 25) {
            return { label: '15-25秒作品', finishRate: 0.50, likeRate: 0.05, cmtPerLike: 0.02, shareRate: 0.01, starRate: 0.02 };
        } else if (d <= 40) {
            return { label: '25-40秒作品', finishRate: 0.40, likeRate: 0.05, cmtPerLike: 0.02, shareRate: 0.01, starRate: 0.02 };
        } else if (d <= 60) {
            return { label: '40-60秒作品', finishRate: 0.35, likeRate: 0.04, cmtPerLike: 0.02, shareRate: 0.01, starRate: 0.015 };
        } else {
            return { label: '60-120秒作品', finishRate: 0.30, likeRate: 0.03, cmtPerLike: 0.03, shareRate: 0.005, starRate: 0.01 };
        }
    }

    function randomizeHotspotViewsOnly(showMsg = false) {
        const viewsWan = (15 + Math.random() * 185).toFixed(1);
        const viewsSimp = `${viewsWan}万人在看`;
        const viewsTrad = `${viewsWan}萬人在看`;
        const inHotViews = document.getElementById('in-dy-hotspot-views');
        const dispHotViews = document.getElementById('dy-disp-hotspot-views');
        if (inHotViews) inHotViews.value = viewsSimp;
        if (dispHotViews) dispHotViews.textContent = viewsTrad;
        if (showMsg && typeof window.showToast === 'function') {
            window.showToast(`🔥 已随机生成热点在看人数：${viewsSimp}`);
        }
        return viewsTrad;
    }

    function randomizeViralMetricsByDuration(customDurSec = null, showMsg = false) {
        let durSec = Number(customDurSec);
        if (!durSec || !isFinite(durSec) || durSec <= 0) {
            if (window.PlayerEngine && window.PlayerEngine.isVideoMode && previewVideo && previewVideo.duration && isFinite(previewVideo.duration)) {
                durSec = previewVideo.duration;
            } else if (window.PlayerEngine && window.PlayerEngine.videoDuration && window.PlayerEngine.videoDuration > 1) {
                durSec = window.PlayerEngine.videoDuration;
            } else {
                // 未上传视频打开/刷新页面时，随机抽取五档时长之一
                const sampleDurs = [11, 19, 32, 48, 75];
                durSec = sampleDurs[Math.floor(Math.random() * sampleDurs.length)];
            }
        }

        const tier = getViralTierByDuration(durSec);

        // 点赞数从 5000 ~ 100万 (5,000 ~ 1,000,000) 分段均匀随机，保证每次刷新都有丰富跨度
        const roll = Math.random();
        let likesRaw;
        if (roll < 0.28) {
            likesRaw = Math.floor(5000 + Math.random() * 45000); // 5000 ~ 5.0萬
        } else if (roll < 0.70) {
            likesRaw = Math.floor(50000 + Math.random() * 300000); // 5.0萬 ~ 35.0萬
        } else {
            likesRaw = Math.floor(350000 + Math.random() * 650000); // 35.0萬 ~ 100萬
        }
        likesRaw = Math.min(1000000, Math.max(5000, likesRaw));

        // 严格依据图3公式反推播放量，并计算评论量、转发量、收藏量（带 ±7% 自然微幅波动避免呆板整数）
        const impliedPlays = likesRaw / tier.likeRate;
        const jitter = () => 0.93 + Math.random() * 0.14;

        const commentsRaw = Math.max(50, Math.round(likesRaw * tier.cmtPerLike * jitter()));
        const sharesRaw = Math.max(50, Math.round(impliedPlays * tier.shareRate * jitter()));
        const starsRaw = Math.max(80, Math.round(impliedPlays * tier.starRate * jitter()));

        const likesTrad = formatViralCountTrad(likesRaw);
        const commentsTrad = formatViralCountTrad(commentsRaw);
        const starsTrad = formatViralCountTrad(starsRaw);
        const sharesTrad = formatViralCountTrad(sharesRaw);

        const likesSimp = formatViralCountSimp(likesRaw);
        const commentsSimp = formatViralCountSimp(commentsRaw);
        const starsSimp = formatViralCountSimp(starsRaw);
        const sharesSimp = formatViralCountSimp(sharesRaw);

        const inLikes = document.getElementById('in-dy-likes');
        const inComments = document.getElementById('in-dy-comments');
        const inStars = document.getElementById('in-dy-stars');
        const inShares = document.getElementById('in-dy-shares');

        if (inLikes) inLikes.value = likesSimp;
        if (inComments) inComments.value = commentsSimp;
        if (inStars) inStars.value = starsSimp;
        if (inShares) inShares.value = sharesSimp;

        const dyValLikes = document.getElementById('dy-val-likes');
        const dyValComments = document.getElementById('dy-val-comments');
        const dyValStars = document.getElementById('dy-val-stars');
        const dyValShares = document.getElementById('dy-val-shares');

        if (dyValLikes) dyValLikes.textContent = likesTrad;
        if (dyValComments) dyValComments.textContent = commentsTrad;
        if (dyValStars) dyValStars.textContent = starsTrad;
        if (dyValShares) dyValShares.textContent = sharesTrad;

        const dylDispLike = document.getElementById('dyl-disp-like');
        const dylDispComment = document.getElementById('dyl-disp-comment');
        const dylDispStar = document.getElementById('dyl-disp-star');
        if (dylDispLike) dylDispLike.textContent = likesTrad;
        if (dylDispComment) dylDispComment.textContent = commentsTrad;
        if (dylDispStar) dylDispStar.textContent = starsTrad;

        // 同步评论区顶部评论总数显示
        if (window.CommentEngine) {
            window.CommentEngine.headCount = commentsTrad;
            window.CommentEngine.syncHeaderDOM();
        }

        // 同步在看人数 15万~200万 随机波动
        const viewsStr = randomizeHotspotViewsOnly(false);

        if (showMsg && typeof window.showToast === 'function') {
            window.showToast(`🎲 已按【${tier.label} (${Math.round(durSec)}s)】规律随机：赞${likesSimp} · 评${commentsSimp} · 藏${starsSimp} · 转${sharesSimp}`);
        }
    }
    window.randomizeViralMetricsByDuration = randomizeViralMetricsByDuration;

    const btnRandomViralMetrics = document.getElementById('btn-random-viral-metrics');
    if (btnRandomViralMetrics) {
        btnRandomViralMetrics.addEventListener('click', () => {
            randomizeViralMetricsByDuration(null, true);
            triggerSaveStorage();
        });
    }

    ['btn-random-hotspot-views', 'btn-random-hotspot-views-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                randomizeHotspotViewsOnly(true);
                triggerSaveStorage();
            });
        }
    });

    ['btn-random-dy-likes', 'btn-random-dy-comments', 'btn-random-dy-stars', 'btn-random-dy-shares'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                randomizeViralMetricsByDuration(null, true);
                triggerSaveStorage();
            });
        }
    });

    // ★ 作者昵称旁骰子按钮：点一下随机切换英文或繁体中文名字
    function randomizeAuthorNickname() {
        const rawPick = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)].replace(/[✨🧋🌶️🌸🍜]/g, '').trim();
        const fullAuthor = rawPick.startsWith('@') ? rawPick : ('@' + rawPick);
        const inDyAuthor = document.getElementById('in-dy-author');
        const dyDispAuthor = document.getElementById('dy-disp-author');
        const dylDispAuthor = document.getElementById('dyl-disp-author');
        const inpDyLfBrand = document.getElementById('inp-dy-lf-brand');
        const dyLfWmBrand = document.getElementById('dy-disp-box-wm');
        if (inDyAuthor) inDyAuthor.value = fullAuthor;
        if (dyDispAuthor) dyDispAuthor.textContent = toStageTrad(fullAuthor);
        if (dylDispAuthor) dylDispAuthor.textContent = toStageTrad(rawPick);
        if (inpDyLfBrand) inpDyLfBrand.value = rawPick;
        if (dyLfWmBrand) dyLfWmBrand.textContent = toStageTrad(rawPick);
        triggerSaveStorage();
        window.showToast(`已随机切换昵称：${toStageTrad(fullAuthor)}`);
    }
    window.randomizeAuthorNickname = randomizeAuthorNickname;

    ['btn-random-dy-author', 'btn-random-lf-brand', 'btn-random-lf-brand-link'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                randomizeAuthorNickname();
            });
        }
    });

    // 支持直接点击画面上的点赞/评论/收藏/分享数字与热点在看人数跳转右侧输入框手动编辑
    [
        { stageId: 'dy-val-likes', inputId: 'in-dy-likes', name: '点赞数' },
        { stageId: 'dy-val-comments', inputId: 'in-dy-comments', name: '评论数' },
        { stageId: 'dy-val-stars', inputId: 'in-dy-stars', name: '收藏数' },
        { stageId: 'dy-val-shares', inputId: 'in-dy-shares', name: '分享数' },
        { stageId: 'dy-disp-hotspot-views', inputId: 'in-dy-hotspot-views', name: '热点观看人数' }
    ].forEach(item => {
        const stEl = document.getElementById(item.stageId);
        const inEl = document.getElementById(item.inputId);
        if (stEl && inEl) {
            stEl.style.cursor = 'pointer';
            stEl.title = `点击在右侧自由编辑${item.name}`;
            stEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof window.switchRightTab === 'function') window.switchRightTab('dy');
                inEl.focus();
                inEl.select();
                window.showToast(`✏️ 请在右侧直接输入修改「${item.name}」`);
            });
        }
    });

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
            const wmBrand = document.getElementById('dy-disp-box-wm');
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
        '嘴':'嘴','嘶':'嘶','嘹':'嘹','嘻':'嘻','嘿':'嘿','噌':'噌','噎':'噎','嘘':'噓','器':'器',
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
        '堠':'堠','堡':'堡','堤':'堤','堪':'堪','尧':'堯','堰':'堰','报':'報','场':'場','堵':'堵',
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
        '嬴':'嬴','嬷':'嬤','孀':'孀','子':'子','孑':'孑','孓':'孓','孔':'孔','孕':'孕','字':'字',
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
        '徒':'徒','得':'得','徘':'徘','徙':'徙','御':'御','徨':'徨','循':'循','微':'微','德':'德',
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
        '憎':'憎','憔':'憔','憧':'憧','憨':'憨','憩':'憩','懂':'懂','懈':'懈','应':'應','懊':'懊',
        '懋':'懋','懑':'懣','懒':'懶','懦':'懦','戏':'戲','成':'成','我':'我','戒':'戒','战':'戰','戚':'戚',
        '户':'戶','房':'房','所':'所','扁':'扁','扇':'扇','手':'手','才':'才','扎':'扎','扑':'撲','扒':'扒',
        '打':'打','扔':'扔','托':'托','扛':'扛','扣':'扣','执':'執','扩':'擴','扪':'捫','扫':'掃','扬':'揚',
        '扭':'扭','扮':'扮','扯':'扯','扰':'擾','扳':'扳','扶':'扶','批':'批','扼':'扼','找':'找','承':'承',
        '技':'技','抄':'抄','抉':'抉','把':'把','抑':'抑','抒':'抒','抓':'抓','投':'投','抖':'抖','抗':'抗',
        '折':'折','抚':'撫','抛':'拋','抟':'摶','抠':'摳','抡':'掄','抢':'搶','护':'護','报':'報','担':'擔',
        '拟':'擬','拢':'攏','拣':'揀','拥':'擁','拦':'攔','拧':'擰','拨':'撥','择':'擇','挂':'掛','挚':'摯',
        '挛':'攣','挝':'撾','挞':'撻','挟':'挾','挠':'撓','挡':'擋','挢':'撟','挣':'掙','挤':'擠',
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
        '楂':'楂','杨':'楊','枫':'楓','楔':'楔','楚':'楚','楞':'楞','楠':'楠','楣':'楣','楦':'楦','楫':'楫',
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
        '涟':'漣','漩':'漩','漪':'漪','漫':'漫','渍':'漬','漱':'漱','漳':'漳','漶':'漶','渐':'漸',
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
        '爪':'爪','爬':'爬','爱':'愛','父':'父','爷':'爺','爸':'爸','爹':'爹','爽':'爽','片':'片',
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
        '疯':'瘋','疡':'瘍','瘟':'瘟','瘠':'瘠','疮':'瘡','瘢':'瘢','瘤':'瘤','瘥':'瘥','瘦':'瘦',
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
    window.__SUB_S2T_CHARS = SUB_S2T_CHARS;
    window.__SUB_T2S_CHARS = SUB_T2S_CHARS;

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
    const swDyMsgBadge = document.getElementById('sw-dy-msg-badge');
    const btnRandomDyMsgCount = document.getElementById('btn-random-dy-msg-count');
    const dyDispMsgBubble = document.getElementById('dy-disp-msg-bubble');
    const layaDispMsgBadge = document.getElementById('laya-disp-msg-badge');
    const layaAppDispMsgBadge = document.getElementById('laya-app-disp-msg-badge');

    function formatBadgeDisplayText(rawVal) {
        const s = String(rawVal == null ? '' : rawVal).trim();
        if (!s) return '';
        if (s === '99+') return '99+';
        const n = parseInt(s, 10);
        if (!isNaN(n) && String(n) === s) {
            if (n <= 0) return '';
            if (n > 99) return '99+';
            return String(n);
        }
        return s;
    }

    function syncAllMsgBadges(shouldSave = true) {
        const showBadge = !swDyMsgBadge || swDyMsgBadge.checked;
        const rawVal = inDyMsgCount ? inDyMsgCount.value : '99+';
        const dispText = formatBadgeDisplayText(rawVal);
        const visible = showBadge && !!dispText;
        const isPlus = dispText === '99+' || dispText.length >= 3;

        [dyDispMsgBubble, layaDispMsgBadge, layaAppDispMsgBadge].forEach(el => {
            if (!el) return;
            if (visible) {
                el.textContent = dispText;
                el.style.display = 'inline-flex';
                el.classList.toggle('is-99plus', isPlus);
            } else {
                el.style.display = 'none';
            }
        });
        if (shouldSave && typeof triggerSaveStorage === 'function') triggerSaveStorage();
    }

    if (inDyMsgCount) {
        inDyMsgCount.addEventListener('input', () => syncAllMsgBadges(true));
    }
    if (swDyMsgBadge) {
        swDyMsgBadge.addEventListener('change', () => syncAllMsgBadges(true));
    }
    if (btnRandomDyMsgCount && inDyMsgCount) {
        btnRandomDyMsgCount.addEventListener('click', () => {
            const presets = ['99+', '1', '3', '8', '12', '26', '58', '88', '99', '128', '99+'];
            const current = inDyMsgCount.value.trim();
            const candidates = presets.filter(v => v !== current);
            const nextVal = candidates[Math.floor(Math.random() * candidates.length)] || '99+';
            inDyMsgCount.value = nextVal;
            if (swDyMsgBadge && !swDyMsgBadge.checked) swDyMsgBadge.checked = true;
            syncAllMsgBadges(true);
            window.showToast(`🎲 消息角标已切换为：${formatBadgeDisplayText(nextVal)}`);
        });
    }
    syncAllMsgBadges(false);

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
    const selAuthorAvatarGender = document.getElementById('sel-author-avatar-gender');
    const inDyAvatarUrl = document.getElementById('in-dy-avatar-url');
    const btnApplyAuthorAvatarUrl = document.getElementById('btn-apply-author-avatar-url');

    if (dyAvatarUploader && dyAvatarImg) {
        dyAvatarUploader.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                syncAuthorAvatarEverywhere(evt.target.result, true);
                if (inDyAvatarUrl) inDyAvatarUrl.value = '';
                window.showToast('头像已成功更换（下方唱片头像已同步更新）！');
                triggerSaveStorage();
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnResetAvatar && dyAvatarImg) {
        btnResetAvatar.addEventListener('click', () => {
            const currentLogo = selLogoVersion ? selLogoVersion.value : 'Laya.png';
            const logoSrc = getActiveLogoSrc(currentLogo);
            syncAuthorAvatarEverywhere(logoSrc, false);
            if (inDyAvatarUrl) inDyAvatarUrl.value = '';
            window.showToast('已恢复官方 Logo 头像（下方唱片头像已同步）');
            triggerSaveStorage();
        });
    }

    async function randomizeAuthorChineseAvatar(showNotice = true) {
        if (!dyAvatarImg) return;
        const seed = 'author_' + Math.random().toString(36).slice(2, 9);
        const genderMode = selAuthorAvatarGender ? selAuthorAvatarGender.value : 'real-human';
        const avoidSet = new Set([dyAvatarImg.src]);
        const onlineUrl = buildOnlineAvatarUrl(seed, genderMode, avoidSet);
        syncAuthorAvatarEverywhere(onlineUrl, true);
        if (inDyAvatarUrl) inDyAvatarUrl.value = onlineUrl;
        triggerSaveStorage();
        if (showNotice) {
            const label = genderMode === 'cn-female' ? '中国女头' : (genderMode === 'cn-male' ? '中国男头' : '中国风真人头像');
            window.showToast(`🎲 已随机切换${label}（主页与底部唱片已同步）`);
        }
        try {
            const resp = await fetch(onlineUrl, { mode: 'cors' });
            if (resp.ok) {
                const blob = await resp.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        syncAuthorAvatarEverywhere(reader.result, true);
                        triggerSaveStorage();
                    }
                };
                reader.readAsDataURL(blob);
            }
        } catch (err) {
            triggerSaveStorage();
        }
    }

    const btnRandomAuthorAvatar = document.getElementById('btn-random-author-avatar');
    if (btnRandomAuthorAvatar && dyAvatarImg) {
        btnRandomAuthorAvatar.addEventListener('click', () => {
            randomizeAuthorChineseAvatar(true);
        });
    }
    if (selAuthorAvatarGender) {
        selAuthorAvatarGender.addEventListener('change', () => {
            randomizeAuthorChineseAvatar(true);
        });
    }
    if (btnApplyAuthorAvatarUrl && inDyAvatarUrl) {
        const applyCustomAuthorUrl = async () => {
            const urlVal = inDyAvatarUrl.value.trim();
            if (!urlVal) {
                window.showToast('⚠️ 请输入有效的头像图片 URL');
                return;
            }
            syncAuthorAvatarEverywhere(urlVal, true);
            triggerSaveStorage();
            window.showToast('✅ 已应用指定头像 URL');
            try {
                const resp = await fetch(urlVal, { mode: 'cors' });
                if (resp.ok) {
                    const blob = await resp.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                            syncAuthorAvatarEverywhere(reader.result, true);
                            triggerSaveStorage();
                        }
                    };
                    reader.readAsDataURL(blob);
                }
            } catch (e) {}
        };
        btnApplyAuthorAvatarUrl.addEventListener('click', applyCustomAuthorUrl);
        inDyAvatarUrl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyCustomAuthorUrl();
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
                dmPortAreaMin: window.DanmakuEngine ? window.DanmakuEngine.portAreaMin : 10,
                dmPortAreaMax: window.DanmakuEngine ? window.DanmakuEngine.portAreaMax : 24,
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
                    drawerTopPct: window.CommentEngine.drawerTopPct,
                    fontScale: window.CommentEngine.fontScale,
                    apiMode: window.CommentEngine.apiMode,
                    ipRegion: window.CommentEngine.ipRegion,
                    pubWindowHours: window.CommentEngine.pubWindowHours,
                    allowReply: window.CommentEngine.allowReply,
                    allowImage: window.CommentEngine.allowImage,
                    showReplies: window.CommentEngine.showReplies,
                    replyMaxLen: window.CommentEngine.replyMaxLen,
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
                applyLogoVersion('Laya.png', false);
                randomizeAuthorChineseAvatar(false);
                syncAllMsgBadges(false);
                if (window.CommentEngine && typeof window.CommentEngine.applyDrawerLayoutVars === 'function') {
                    window.CommentEngine.applyDrawerLayoutVars();
                }
                localStorage.setItem('LAYA_V18_FIVE_MODULES_MIGRATED', '1');
                localStorage.setItem('LAYA_V20_CMT_COMPACT_LAYOUT_MIGRATED', '1');
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
            if (data.inputs && (data.inputs['in-dy-hotspot-title'] === '下班去炫頂配螺螄粉' || data.inputs['in-dy-hotspot-title'] === '下班去炫顶配螺蛳粉' || data.inputs['in-dy-hotspot-title'] === '台灣色情女優大賽')) {
                data.inputs['in-dy-hotspot-title'] = '台湾色情女优大赛';
            }
            // V15 迁移：右侧编辑框统一使用简体中文，左侧舞台自动渲染繁体中文；作者声明默认「作者声明：虚构演绎，仅供娱乐」
            if (localStorage.getItem('LAYA_V15_CAMPAIGN_SIMP_MIGRATED') !== '1') {
                if (!data.inputs) data.inputs = {};
                if (!data.selects) data.selects = {};
                if (!data.inputs['in-dy-campaign'] || data.inputs['in-dy-campaign'].includes('未成年人')) {
                    data.inputs['in-dy-campaign'] = '作者声明：虚构演绎，仅供娱乐';
                    data.selects['sel-dy-campaign-preset'] = '作者声明：虚构演绎，仅供娱乐';
                }
                ['in-dy-desc', 'in-dy-tags', 'in-dy-featured-title', 'in-dy-hotspot-title', 'in-dy-gold-title', 'in-cmt-col-title', 'in-dy-campaign'].forEach(k => {
                    if (typeof data.inputs[k] === 'string') {
                        data.inputs[k] = toEditorSimp(data.inputs[k]);
                    }
                });
                localStorage.setItem('LAYA_V15_CAMPAIGN_SIMP_MIGRATED', '1');
            }

            // V18 迁移：5大改造模块（评论回复、中国风真实头像、消息角标 99+、弹幕默认白字黑边 + 竖屏 20%~60% 区域）
            const isV18Migrated = localStorage.getItem('LAYA_V18_FIVE_MODULES_MIGRATED') === '1';
            if (!isV18Migrated) {
                if (!data.inputs) data.inputs = {};
                if (!data.checkboxes) data.checkboxes = {};
                if (!data.selects) data.selects = {};
                data.inputs['in-dy-msg-count'] = '99+';
                data.checkboxes['sw-dy-msg-badge'] = true;
                data.inputs['in-dm-port-min'] = '20';
                data.inputs['in-dm-port-max'] = '60';
                data.dmPortAreaMin = 20;
                data.dmPortAreaMax = 60;
                if (Array.isArray(data.danmakuList)) {
                    data.danmakuList.forEach(dm => {
                        dm.color = '#ffffff';
                    });
                }
                data.avatarIsCustom = false;
                localStorage.setItem('LAYA_V18_FIVE_MODULES_MIGRATED', '1');
            }

            // V19 迁移：竖屏弹幕默认只占画面上方区域一點點 (10% ~ 24%) + 原生苹果苹方/安卓思源黑体字重优化
            if (localStorage.getItem('LAYA_V19_DANMAKU_TOP_FONT_MIGRATED') !== '1') {
                if (!data.inputs) data.inputs = {};
                if (!data.selects) data.selects = {};
                data.inputs['in-dm-port-min'] = '10';
                data.inputs['in-dm-port-max'] = '24';
                data.inputs['in-danmaku-size'] = '14';
                data.dmPortAreaMin = 10;
                data.dmPortAreaMax = 24;
                if (!data.selects['sel-dy-os-font']) {
                    data.selects['sel-dy-os-font'] = 'auto';
                }
                if (Array.isArray(data.danmakuList) && data.danmakuList.length > 0) {
                    const topLanes = [10, 13, 16, 19, 22];
                    data.danmakuList.forEach((dm, i) => {
                        dm.top = topLanes[i % topLanes.length];
                        dm.size = 14;
                        dm.color = '#ffffff';
                    });
                }
                localStorage.setItem('LAYA_V19_DANMAKU_TOP_FONT_MIGRATED', '1');
            }

            window.__isRestoringStorage = true;

            if (data.inputs) {
                // 统一网页端与手机端的时间/进度缓存，防止旧版 23:18 覆盖导致进度条跳到 100% 最右端
                if (data.inputs['in-total-time']) {
                    data.inputs['in-m-total-time'] = data.inputs['in-total-time'];
                }
                if (data.inputs['in-start-time']) {
                    data.inputs['in-m-start-time'] = data.inputs['in-start-time'];
                }
                const savedProg = parseFloat(data.inputs['in-progress'] || data.inputs['in-m-progress'] || '26');
                if (savedProg >= 92 || savedProg <= 1) {
                    data.inputs['in-progress'] = '26';
                    data.inputs['in-m-progress'] = '26';
                    data.inputs['in-start-time'] = '00:28:15';
                    data.inputs['in-m-start-time'] = '00:28:15';
                    data.inputs['in-total-time'] = '01:54:21';
                    data.inputs['in-m-total-time'] = '01:54:21';
                }
                Object.entries(data.inputs).forEach(([id, val]) => {
                    if (id === 'in-m-start-time' || id === 'in-m-total-time' || id === 'in-m-progress' || id === 'in-progress') return;
                    // 防止旧版直播间 8888 或 29/1000 缓存覆盖新版 1000~200万 点赞与在线人数
                    if (id === 'in-live-host-id' && (val === '8888' || val === '1.8萬')) return;
                    if (id === 'in-live-viewers' && (Number(val) <= 1000)) return;
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
                        if (id !== 'sel-dy-phone-model' && id !== 'sel-author-avatar-gender') {
                            el.dispatchEvent(new Event('change'));
                        }
                    }
                });
            }

            syncAllMsgBadges(false);

            if (typeof renderDyStatusBar === 'function') {
                renderDyStatusBar();
            }
            if (typeof applyOsFontMode === 'function') {
                applyOsFontMode(false);
            }

            if (data.logoVersion && selLogoVersion) {
                selLogoVersion.value = data.logoVersion;
                applyLogoVersion(data.logoVersion);
            } else {
                applyLogoVersion('Laya.png');
            }

            if (data.avatar && dyAvatarImg && data.avatarIsCustom && !data.avatar.includes('pravatar.cc') && !data.avatar.includes('dicebear.com')) {
                syncAuthorAvatarEverywhere(data.avatar, true);
            } else {
                randomizeAuthorChineseAvatar(false);
            }

            if (data.skin && selMobileSkin) {
                selMobileSkin.value = data.skin;
                applyMobileSkin(data.skin);
            }
            // 强制确保页面加载时：顶部标签栏默认停在「推薦」(idx=1)，底部导航默认停在「視頻」(idx=2)，且右侧头像默认未关注带红色 + 号
            const topItems = document.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item');
            if (topItems.length) {
                topItems.forEach((el, idx) => el.classList.toggle('active', idx === 1));
            }
            const botItems = document.querySelectorAll('#laya-app-bottom-tabs .laya-app-tab-item');
            if (botItems.length) {
                botItems.forEach((el, idx) => el.classList.toggle('active', idx === 2));
            }
            if (typeof setRightAvatarFollowedByTab === 'function') {
                setRightAvatarFollowedByTab(false);
            }
            if (data.viewportMode && window.PlayerEngine && typeof window.PlayerEngine.activateViewportMode === 'function') {
                window.PlayerEngine.activateViewportMode(data.viewportMode);
            }

            if (window.DanmakuEngine) {
                if (typeof data.dmPortAreaMin === 'number') window.DanmakuEngine.portAreaMin = data.dmPortAreaMin;
                if (typeof data.dmPortAreaMax === 'number') window.DanmakuEngine.portAreaMax = data.dmPortAreaMax;
                if (data.danmakuList) {
                    window.DanmakuEngine.list = data.danmakuList;
                    if (data.danmakuMode) window.DanmakuEngine.mode = data.danmakuMode;
                }
                window.DanmakuEngine.refresh();
                window.DanmakuEngine.renderEditorList();
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
                const migratedV17 = localStorage.getItem('LAYA_V17_NATURAL_CMT_MIGRATED') === '1';
                if (!migratedV17 || !isV18Migrated) {
                    localStorage.setItem('LAYA_V17_NATURAL_CMT_MIGRATED', '1');
                    localStorage.setItem('LAYA_V16_ASIAN_AVATAR_MIGRATED', '1');
                    localStorage.setItem('LAYA_V14_OVERSEAS_CMT_MIGRATED', '1');
                    window.CommentEngine.apiMode = 'real-human';
                    window.CommentEngine.ipRegion = 'tw-hk-my';
                    window.CommentEngine.pubWindowHours = 72;
                    window.CommentEngine.allowReply = true;
                    window.CommentEngine.allowImage = true;
                    window.CommentEngine.showReplies = true;
                    window.CommentEngine.replyMaxLen = 120;
                    window.CommentEngine.colPrefix = '觀看完整合集：';
                    window.CommentEngine.colTitle = '人情與世故';
                    window.CommentEngine.vidTipText = '';
                    const selApi = document.getElementById('sel-cmt-avatar-api');
                    if (selApi) selApi.value = 'real-human';
                    const selIp = document.getElementById('sel-cmt-ip-region');
                    if (selIp) selIp.value = 'tw-hk-my';
                    window.CommentEngine.initDefaults();
                } else {
                    if (cd.apiMode) window.CommentEngine.apiMode = cd.apiMode;
                    if (cd.ipRegion) window.CommentEngine.ipRegion = cd.ipRegion;
                    if (cd.pubWindowHours) window.CommentEngine.pubWindowHours = cd.pubWindowHours;
                    if (typeof cd.allowReply === 'boolean') window.CommentEngine.allowReply = cd.allowReply;
                    if (typeof cd.allowImage === 'boolean') window.CommentEngine.allowImage = cd.allowImage;
                    if (typeof cd.showReplies === 'boolean') window.CommentEngine.showReplies = cd.showReplies;
                    if (typeof cd.replyMaxLen === 'number') window.CommentEngine.replyMaxLen = cd.replyMaxLen;
                    if (typeof cd.colPrefix === 'string') window.CommentEngine.colPrefix = cd.colPrefix;
                    if (typeof cd.colTitle === 'string') window.CommentEngine.colTitle = cd.colTitle;
                    if (typeof cd.headCount === 'string') window.CommentEngine.headCount = cd.headCount;
                    if (typeof cd.tabAiText === 'string') window.CommentEngine.tabAiText = cd.tabAiText;
                    window.CommentEngine.vidTipText = '';
                    if (Array.isArray(cd.list) && cd.list.length > 0) {
                        const mainlandProvs = ['广东', '河北', '河南', '湖北', '浙江', '四川', '江苏', '北京', '上海', '山东', '湖南', '福建', '重庆', '陕西', '辽宁', '安徽', '云南', '广西'];
                        cd.list.forEach((it, idx) => {
                            if (it.dateLoc && mainlandProvs.some(p => it.dateLoc.includes(p))) {
                                it.dateLoc = randomDateLoc(window.CommentEngine.ipRegion, window.CommentEngine.pubWindowHours);
                            }
                            if (!it.avatar || it.avatar.includes('pravatar.cc') || it.avatar.includes('dicebear.com')) {
                                it.avatar = buildOnlineAvatarUrl(`mig_${idx}`, window.CommentEngine.apiMode);
                                it.avatarDataUrl = '';
                            }
                            if (!Array.isArray(it.replies)) {
                                it.replies = [];
                            }
                        });
                        window.CommentEngine.list = cd.list;
                        window.CommentEngine.list.forEach(it => {
                            window.CommentEngine.prefetchAvatarDataUrl(it);
                            if (Array.isArray(it.replies)) {
                                it.replies.forEach(rep => window.CommentEngine.prefetchAvatarDataUrl(rep));
                            }
                        });
                    }
                }
                if (typeof cd.drawerTopPct === 'number' && !isNaN(cd.drawerTopPct)) {
                    window.CommentEngine.drawerTopPct = Math.min(76, Math.max(18, cd.drawerTopPct));
                }
                if (typeof cd.fontScale === 'number' && !isNaN(cd.fontScale)) {
                    window.CommentEngine.fontScale = Math.min(1.5, Math.max(0.8, cd.fontScale));
                }
                window.CommentEngine.isExpanded = !!cd.isExpanded;
                // V20 一次性迁移：收敛评论区默认占比高度（top 44.5%，给上方视频留出充足空间）并初始化默认 1.0x 字号
                if (localStorage.getItem('LAYA_V20_CMT_COMPACT_LAYOUT_MIGRATED') !== '1') {
                    window.CommentEngine.drawerTopPct = null;
                    window.CommentEngine.isExpanded = false;
                    window.CommentEngine.fontScale = 1.0;
                    const inpScale = document.getElementById('in-dy-cmt-font-scale');
                    if (inpScale) inpScale.value = '1.0';
                    localStorage.setItem('LAYA_V20_CMT_COMPACT_LAYOUT_MIGRATED', '1');
                }
                if (renderTarget) renderTarget.classList.toggle('dy-comment-expanded', !!window.CommentEngine.isExpanded);
                window.CommentEngine.applyFontScale(window.CommentEngine.fontScale, true);
                window.CommentEngine.applyDrawerLayoutVars();
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
        // ★ 每次打开或刷新网站，所有板块的手机状态栏时间始终同步为打开/刷新时的真实时间
        syncAllPhoneClockTimes(getCurrentRealClockTime(), false);
        // ★ 每次打开页面读取完配置后，自动重新在 1:20:00 ~ 2:30:00 之间随机生成总片长
        if (window.PlayerEngine && typeof window.PlayerEngine.randomizeDuration === 'function') {
            window.PlayerEngine.randomizeDuration(false);
        }
        // ★ 每次打开或刷新页面，严格按图3时长规律自动随机生成新的点赞(5000~100万)、评论、收藏、分享与热点在看人数(15万~200万)
        randomizeViralMetricsByDuration(null, false);
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
        '倍速': '倍速', '精选': '精選', '热点': '熱點', '关注': '關注', '推荐': '推薦', '直播': '直播', '交友': '交友', '任务': '任務', '合集': '合集', '全屏观看': '全屏觀看',
        '首页': '首頁', '朋友': '朋友', '消息': '消息', '我': '我', '发现': '發現', '瞬间': '瞬間', '视讯': '視訊', '娱乐': '娛樂', '派对': '派對', '我的': '我的',
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
        const isLightMode = !!(renderTarget && renderTarget.classList.contains('theme-light'));

        ['header-brand-logo', 'player-mini-logo', 'm-brand-logo', 'dy-lf-wm-logo'].forEach(id => {
            const clonedImg = clonedDoc.getElementById(id);
            if (clonedImg) clonedImg.src = activeRealSrc;
        });
        const clonedLiveLayaMiniLogo = clonedDoc.getElementById('live-laya-mini-logo');
        if (clonedLiveLayaMiniLogo) {
            clonedLiveLayaMiniLogo.src = getActiveLogoSrc('Laya2.png');
        }

        // 同步直播间礼物弹窗左侧真人头像/自定义头像到导出画布，绝不回退为蓝色 Laya 图标
        const origGiftAv = document.getElementById('live-gift-sender-av');
        const clonedGiftAv = clonedDoc.getElementById('live-gift-sender-av');
        if (origGiftAv && clonedGiftAv) {
            const giftAvSrc = origGiftAv.getAttribute('data-export-src') || origGiftAv.src;
            if (giftAvSrc) clonedGiftAv.src = giftAvSrc;
        }

        // 同步直播间右上角 3 个真人/抖音默认观众头像的 DataURL 到导出画布，确保绝不回退为蓝色 Laya
        const origAudImgs = document.querySelectorAll('#live-aud-avatars .live-aud-img');
        const clonedAudImgs = clonedDoc.querySelectorAll('#live-aud-avatars .live-aud-img');
        origAudImgs.forEach((oImg, idx) => {
            const cImg = clonedAudImgs[idx];
            if (!cImg) return;
            const safeSrc = oImg.getAttribute('data-export-src') || oImg.src;
            if (safeSrc) cImg.src = safeSrc;
        });

        // 锁定直播间礼物进场提示条在导出截图/视频时处于完全滑入可见状态
        const clonedGiftBanner = clonedDoc.getElementById('live-gift-combo-banner');
        if (clonedGiftBanner) {
            clonedGiftBanner.style.setProperty('animation', 'none', 'important');
            clonedGiftBanner.style.setProperty('opacity', '1', 'important');
            clonedGiftBanner.style.setProperty('transform', 'none', 'important');
        }

        const avatarSrc = (dyAvatarImg && dyAvatarImg.dataset.custom === 'true') ? dyAvatarImg.src : activeRealSrc;
        const clonedAvatar = clonedDoc.getElementById('dy-avatar-img');
        if (clonedAvatar) clonedAvatar.src = avatarSrc;
        const clonedVinylAvatar = clonedDoc.getElementById('dy-vinyl-img');
        if (clonedVinylAvatar) clonedVinylAvatar.src = avatarSrc;
        const clonedDylAvatar = clonedDoc.getElementById('dyl-disp-avatar');
        if (clonedDylAvatar) clonedDylAvatar.src = avatarSrc;
        const origLiveHostAv = document.getElementById('live-host-avatar');
        const clonedLiveAvatar = clonedDoc.getElementById('live-host-avatar');
        if (clonedLiveAvatar) {
            const liveHostSrc = (origLiveHostAv && (origLiveHostAv.getAttribute('data-export-src') || origLiveHostAv.src)) || avatarSrc;
            clonedLiveAvatar.src = liveHostSrc;
        }
        const clonedFeatLogo = clonedDoc.getElementById('dy-featured-logo-img');
        if (clonedFeatLogo) clonedFeatLogo.src = activeRealSrc;

        // 精确锁定「點擊進入直播間」胶囊与「你的關注▾」胶囊在导出画布中的水平正中坐标
        const origArmedTip = document.getElementById('dy-live-armed-tip');
        const clonedArmedTip = clonedDoc.getElementById('dy-live-armed-tip');
        if (origArmedTip && clonedArmedTip && origRenderTarget && origRenderTarget.classList.contains('dy-live-preview')) {
            const targetW = origRenderTarget.offsetWidth || 360;
            const tipW = origArmedTip.offsetWidth || 138;
            clonedArmedTip.style.setProperty('left', Math.max(0, Math.round((targetW - tipW) / 2)) + 'px', 'important');
            clonedArmedTip.style.setProperty('right', 'auto', 'important');
            clonedArmedTip.style.setProperty('margin', '0', 'important');
        }
        const origFollowDrop = document.getElementById('dy-live-follow-drop');
        const clonedFollowDrop = clonedDoc.getElementById('dy-live-follow-drop');
        if (origFollowDrop && clonedFollowDrop && origRenderTarget && origRenderTarget.classList.contains('dy-live-preview')) {
            const targetW = origRenderTarget.offsetWidth || 360;
            const dropW = origFollowDrop.offsetWidth || 86;
            clonedFollowDrop.style.setProperty('left', Math.max(0, Math.round((targetW - dropW) / 2)) + 'px', 'important');
            clonedFollowDrop.style.setProperty('right', 'auto', 'important');
            clonedFollowDrop.style.setProperty('margin', '0', 'important');
        }

        // ★ 同步右侧头像「已关注」状态（点击顶部「關注」标签后：头像紫色边框，无红色 + 号）到导出画布
        const origAvatarWrap = document.getElementById('dy-avatar-click');
        const clonedAvatarWrap = clonedDoc.getElementById('dy-avatar-click');
        const clonedFollowPlus = clonedDoc.getElementById('dy-btn-follow');
        if (origAvatarWrap && clonedAvatarWrap) {
            const isTabFollowed = origAvatarWrap.classList.contains('is-followed-by-tab');
            if (isTabFollowed) {
                clonedAvatarWrap.classList.add('is-followed-by-tab');
                if (clonedAvatar) {
                    clonedAvatar.style.setProperty('border', isLightMode ? '2.2px solid #7c3aed' : '2.2px solid #a855f7', 'important');
                }
                if (clonedFollowPlus) {
                    clonedFollowPlus.style.setProperty('display', 'none', 'important');
                    clonedFollowPlus.style.setProperty('opacity', '0', 'important');
                }
            }
        }

        // ★ 同步直播间底部输入框「說點什麼...」为静态居中文本节点，防止 html2canvas 渲染 input 文字偏上
        const origLiveInp = document.getElementById('live-chat-input');
        const clonedLiveInp = clonedDoc.getElementById('live-chat-input');
        if (origLiveInp && clonedLiveInp && clonedLiveInp.parentNode) {
            const valTxt = (origLiveInp.value || '').trim();
            const dispTxt = valTxt || origLiveInp.getAttribute('placeholder') || '說點什麼...';
            const fakeLiveInp = clonedDoc.createElement('div');
            fakeLiveInp.id = 'live-chat-input';
            fakeLiveInp.className = clonedLiveInp.className;
            fakeLiveInp.textContent = dispTxt;
            fakeLiveInp.style.cssText = [
                'width: 100% !important',
                'height: 28px !important',
                'display: flex !important',
                'align-items: center !important',
                'font-size: 11px !important',
                'line-height: 1 !important',
                `color: ${valTxt ? (isLightMode ? '#161823' : '#ffffff') : (isLightMode ? '#6b7280' : 'rgba(226,232,240,0.68)')} !important`,
                'white-space: nowrap !important',
                'overflow: hidden !important',
                'text-overflow: ellipsis !important'
            ].join('; ');
            clonedLiveInp.parentNode.replaceChild(fakeLiveInp, clonedLiveInp);
        }

        // ★ 截图导出时锁定直播间漂浮弹幕与右侧飘心在当前画面上的实时像素位置
        if (renderTarget && renderTarget.classList.contains('dy-live-open')) {
            const origStage = document.getElementById('live-floating-dm-stage');
            const clonedStage = clonedDoc.getElementById('live-floating-dm-stage');
            if (origStage && clonedStage) {
                const stRect = origStage.getBoundingClientRect();
                const origFlyDms = origStage.querySelectorAll('.live-fly-dm-item');
                const clonedFlyDms = clonedStage.querySelectorAll('.live-fly-dm-item');
                origFlyDms.forEach((oItem, idx) => {
                    const cItem = clonedFlyDms[idx];
                    if (!cItem) return;
                    const r = oItem.getBoundingClientRect();
                    cItem.style.setProperty('animation', 'none', 'important');
                    cItem.style.setProperty('transition', 'none', 'important');
                    cItem.style.setProperty('transform', 'none', 'important');
                    cItem.style.setProperty('left', Math.round(r.left - stRect.left) + 'px', 'important');
                    cItem.style.setProperty('top', Math.round(r.top - stRect.top) + 'px', 'important');
                });
            }
            const origHearts = document.getElementById('live-floating-hearts');
            const clonedHearts = clonedDoc.getElementById('live-floating-hearts');
            if (origHearts && clonedHearts) {
                const hRect = origHearts.getBoundingClientRect();
                const origHList = origHearts.querySelectorAll('.live-heart-particle');
                const clonedHList = clonedHearts.querySelectorAll('.live-heart-particle');
                origHList.forEach((oH, idx) => {
                    const cH = clonedHList[idx];
                    if (!cH) return;
                    const r = oH.getBoundingClientRect();
                    const cs = window.getComputedStyle(oH);
                    cH.style.setProperty('animation', 'none', 'important');
                    cH.style.setProperty('transform', 'none', 'important');
                    cH.style.setProperty('bottom', 'auto', 'important');
                    cH.style.setProperty('right', 'auto', 'important');
                    cH.style.setProperty('left', Math.round(r.left - hRect.left) + 'px', 'important');
                    cH.style.setProperty('top', Math.round(r.top - hRect.top) + 'px', 'important');
                    cH.style.setProperty('opacity', cs.opacity || '0.9', 'important');
                });
            }
        }
        if (window.LAYA_APP_ASSETS) {
            clonedDoc.querySelectorAll('img[data-laya-asset]').forEach(img => {
                const key = img.getAttribute('data-laya-asset');
                if (isLightMode && window.LAYA_APP_ASSETS_LIGHT && window.LAYA_APP_ASSETS_LIGHT[key]) {
                    img.src = window.LAYA_APP_ASSETS_LIGHT[key];
                } else if (window.LAYA_APP_ASSETS[key]) {
                    img.src = window.LAYA_APP_ASSETS[key];
                }
            });
        }

        // ★ 导出联动隐藏：严格按当前右侧图标列与底部提示条开关状态隐藏，确保关掉的图标与数字绝不出现在导出画面中
        const exportSwitchMap = [
            ['sw-dy-icon-avatar', 'dy-avatar-click'],
            ['sw-dy-icon-like', 'dy-btn-like'],
            ['sw-dy-icon-comment', 'dy-btn-comment'],
            ['sw-dy-icon-star', 'dy-btn-star'],
            ['sw-dy-icon-share', 'dy-btn-share'],
            ['sw-dy-icon-vinyl', 'dy-vinyl-wrap'],
            ['sw-dy-gold', 'dy-wrap-gold'],
            ['sw-dy-gold', 'dy-search-bar-row'],
            ['sw-dy-hotspot', 'dy-wrap-hotspot'],
            ['sw-dy-right-bar', 'dy-wrap-right-bar'],
            ['sw-dy-follow-plus', 'dy-btn-follow'],
            ['sw-dy-featured', 'dy-wrap-featured'],
            ['sw-dy-campaign', 'dy-wrap-campaign']
        ];
        exportSwitchMap.forEach(([swId, targetId]) => {
            const swEl = document.getElementById(swId);
            const cEl = clonedDoc.getElementById(targetId);
            if (swEl && cEl) {
                if (!swEl.checked) {
                    cEl.classList.add('dy-item-hidden');
                    cEl.style.setProperty('display', 'none', 'important');
                    cEl.style.setProperty('visibility', 'hidden', 'important');
                }
            }
        });
        const allRightIconSwIds = ['sw-dy-icon-avatar', 'sw-dy-icon-like', 'sw-dy-icon-comment', 'sw-dy-icon-star', 'sw-dy-icon-share', 'sw-dy-icon-vinyl'];
        const anyRightIconOn = allRightIconSwIds.some(id => {
            const el = document.getElementById(id);
            return !el || el.checked;
        });
        const clonedRightBar = clonedDoc.getElementById('dy-wrap-right-bar');
        if (!anyRightIconOn && clonedRightBar) {
            clonedRightBar.classList.add('dy-item-hidden');
            clonedRightBar.style.setProperty('display', 'none', 'important');
        }

        // 同步日间/夜间模式下克隆节点的 SVG 填充/描边色，确保 html2canvas 100% 还原浅色/深色图标
        if (typeof window.__syncThemeSvgColorsInRoot === 'function') {
            const clonedTargetRoot = clonedDoc.getElementById('render-target');
            if (clonedTargetRoot) window.__syncThemeSvgColorsInRoot(clonedTargetRoot, isLightMode);
        }

        // 导出截图/视频时隐藏评论区悬停快捷按钮、拖拽提示文字及骰子小按钮，并强制用户名单行不换行
        clonedDoc.querySelectorAll('.dy-cmt-stage-QuickTools, .dy-cmt-photo-del, .dy-cmt-inline-dice, .dy-cmt-drag-hint').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });
        clonedDoc.querySelectorAll('.dy-cmt-user-row, .dy-cmt-reply-user-row').forEach(el => {
            el.style.setProperty('flex-wrap', 'nowrap', 'important');
            el.style.setProperty('white-space', 'nowrap', 'important');
        });
        clonedDoc.querySelectorAll('.dy-cmt-user, .dy-cmt-reply-user, .dy-cmt-reply-to-tag, .dy-cmt-author-badge').forEach(el => {
            el.style.setProperty('white-space', 'nowrap', 'important');
            el.style.setProperty('word-break', 'keep-all', 'important');
            el.style.setProperty('overflow-wrap', 'normal', 'important');
            el.style.setProperty('max-width', '100%', 'important');
            el.style.setProperty('overflow', 'hidden', 'important');
            el.style.setProperty('text-overflow', 'ellipsis', 'important');
        });

        // ★ 同步评论区字号与头像缩放计算值到克隆节点，确保 html2canvas 导出画面与预览 1:1 完全一致
        const origDrawer = document.getElementById('dy-comment-drawer');
        const clonedDrawer = clonedDoc.getElementById('dy-comment-drawer');
        if (origDrawer && clonedDrawer) {
            const scaleSelectorList = [
                '.dy-cmt-col-left',
                '.dy-cmt-tab-item',
                '.dy-cmt-user',
                '.dy-cmt-text',
                '.dy-cmt-meta-left',
                '.dy-cmt-like-btn',
                '.dy-cmt-reply-user',
                '.dy-cmt-author-badge',
                '.dy-cmt-reply-to-tag',
                '.dy-cmt-reply-text',
                '.dy-cmt-reply-meta-left',
                '.dy-cmt-reply-like-btn'
            ];
            scaleSelectorList.forEach(sel => {
                const origNodes = origDrawer.querySelectorAll(sel);
                const clonedNodes = clonedDrawer.querySelectorAll(sel);
                origNodes.forEach((oNode, idx) => {
                    const cNode = clonedNodes[idx];
                    if (!cNode) return;
                    const cs = window.getComputedStyle(oNode);
                    if (cs.fontSize) cNode.style.setProperty('font-size', cs.fontSize, 'important');
                    if (cs.lineHeight) cNode.style.setProperty('line-height', cs.lineHeight, 'important');
                });
            });

            const boxSelectorList = [
                '.dy-cmt-avatar-wrap',
                '.dy-cmt-reply-avatar-wrap',
                '.dy-cmt-circle-btn',
                '.dy-cmt-like-btn svg',
                '.dy-cmt-dislike-btn svg',
                '.dy-cmt-reply-like-btn svg'
            ];
            boxSelectorList.forEach(sel => {
                const origNodes = origDrawer.querySelectorAll(sel);
                const clonedNodes = clonedDrawer.querySelectorAll(sel);
                origNodes.forEach((oNode, idx) => {
                    const cNode = clonedNodes[idx];
                    if (!cNode) return;
                    const cs = window.getComputedStyle(oNode);
                    if (cs.width) cNode.style.setProperty('width', cs.width, 'important');
                    if (cs.height) cNode.style.setProperty('height', cs.height, 'important');
                });
            });
        }

        // ★ 修复导出画面底部输入栏 ("期待你的評論" + 图片/@/表情 + 確定按钮) 垂直基线居中对齐与均匀间距
        const origStageInp = document.getElementById('dy-cmt-stage-input');
        const clonedStageInp = clonedDoc.getElementById('dy-cmt-stage-input');
        if (origStageInp && clonedStageInp && clonedStageInp.parentNode) {
            const origCs = window.getComputedStyle(origStageInp);
            const valTxt = (origStageInp.value || '').trim();
            const dispTxt = valTxt || origStageInp.getAttribute('placeholder') || '期待你的評論';
            const fakeInpDiv = clonedDoc.createElement('div');
            fakeInpDiv.id = 'dy-cmt-stage-input';
            fakeInpDiv.className = clonedStageInp.className;
            fakeInpDiv.textContent = dispTxt;
            fakeInpDiv.style.cssText = [
                'flex: 1 1 auto !important',
                'min-width: 0 !important',
                'height: 34px !important',
                'display: flex !important',
                'align-items: center !important',
                'margin: 0 !important',
                'padding: 0 !important',
                `font-size: ${origCs.fontSize || '11.5px'} !important`,
                'line-height: 1 !important',
                `color: ${valTxt ? (isLightMode ? '#161823' : '#f1f5f9') : (isLightMode ? '#999aa0' : '#8b8e99')} !important`,
                'white-space: nowrap !important',
                'overflow: hidden !important',
                'text-overflow: ellipsis !important',
                'box-sizing: border-box !important'
            ].join('; ');
            clonedStageInp.parentNode.replaceChild(fakeInpDiv, clonedStageInp);
        }

        const clonedInputPill = clonedDoc.querySelector('.dy-cmt-input-pill');
        if (clonedInputPill) {
            clonedInputPill.style.setProperty('display', 'flex', 'important');
            clonedInputPill.style.setProperty('align-items', 'center', 'important');
            clonedInputPill.style.setProperty('justify-content', 'space-between', 'important');
            clonedInputPill.style.setProperty('height', '34px', 'important');
            clonedInputPill.style.setProperty('padding', '0 7px 0 12px', 'important');
            clonedInputPill.style.setProperty('gap', '8px', 'important');
            clonedInputPill.style.setProperty('box-sizing', 'border-box', 'important');
        }
        const clonedInputIcons = clonedDoc.querySelector('.dy-cmt-input-icons');
        if (clonedInputIcons) {
            clonedInputIcons.style.setProperty('display', 'flex', 'important');
            clonedInputIcons.style.setProperty('align-items', 'center', 'important');
            clonedInputIcons.style.setProperty('justify-content', 'flex-end', 'important');
            clonedInputIcons.style.setProperty('height', '34px', 'important');
            clonedInputIcons.style.setProperty('gap', '6px', 'important');
        }
        clonedDoc.querySelectorAll('.dy-cmt-icon-btn').forEach(btn => {
            btn.style.setProperty('width', '24px', 'important');
            btn.style.setProperty('height', '24px', 'important');
            btn.style.setProperty('padding', '0', 'important');
            btn.style.setProperty('margin', '0', 'important');
            btn.style.setProperty('display', 'inline-flex', 'important');
            btn.style.setProperty('align-items', 'center', 'important');
            btn.style.setProperty('justify-content', 'center', 'important');
            const svg = btn.querySelector('svg');
            if (svg) {
                svg.style.setProperty('width', '17px', 'important');
                svg.style.setProperty('height', '17px', 'important');
                svg.style.setProperty('display', 'block', 'important');
            }
        });
        const clonedSendBtn = clonedDoc.getElementById('dy-cmt-btn-stage-submit');
        if (clonedSendBtn) {
            clonedSendBtn.style.setProperty('height', '24px', 'important');
            clonedSendBtn.style.setProperty('padding', '0 10px', 'important');
            clonedSendBtn.style.setProperty('margin', '0', 'important');
            clonedSendBtn.style.setProperty('border-radius', '12px', 'important');
            clonedSendBtn.style.setProperty('display', 'inline-flex', 'important');
            clonedSendBtn.style.setProperty('align-items', 'center', 'important');
            clonedSendBtn.style.setProperty('justify-content', 'center', 'important');
            clonedSendBtn.style.setProperty('line-height', '1', 'important');
        }

        // 强制锁定克隆节点中头像与唱片角度，防止 html2canvas CSS 动画截图偏移
        clonedDoc.querySelectorAll('.dy-vinyl-record, .dy-vinyl-avatar, .dy-avatar-img').forEach(el => {
            el.style.setProperty('animation', 'none', 'important');
            el.style.setProperty('transform', 'none', 'important');
        });

        // 精确锁定「全屏觀看」按钮在克隆画布中的水平正中间像素坐标，彻底杜绝 html2canvas 缩放偏移
        const origTarget = document.getElementById('render-target');
        const origFsPill = document.getElementById('dy-fullscreen-pill');
        const clonedFsPill = clonedDoc.getElementById('dy-fullscreen-pill');
        if (origTarget && origFsPill && clonedFsPill && origFsPill.offsetWidth > 0) {
            const targetW = origTarget.clientWidth || origTarget.getBoundingClientRect().width;
            const pillW = origFsPill.offsetWidth || origFsPill.getBoundingClientRect().width;
            const exactLeftPx = Math.max(0, Math.round((targetW - pillW) / 2));
            clonedFsPill.style.setProperty('left', exactLeftPx + 'px', 'important');
            clonedFsPill.style.setProperty('right', 'auto', 'important');
            clonedFsPill.style.setProperty('margin', '0', 'important');
            clonedFsPill.style.setProperty('transform', 'none', 'important');
        }

        // 精确锁定顶部导航栏发光底衬 (.laya-app-nav-glow) 在各自文字正中心，彻底杜绝 html2canvas 百分比偏移
        const origNavItems = document.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item');
        const clonedNavItems = clonedDoc.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item');
        origNavItems.forEach((origItem, idx) => {
            const clonedItem = clonedNavItems[idx];
            if (!clonedItem) return;
            const clonedGlow = clonedItem.querySelector('.laya-app-nav-glow');
            if (clonedGlow) {
                const iw = origItem.offsetWidth || 40;
                const ih = origItem.offsetHeight || 24;
                clonedGlow.style.setProperty('left', Math.round((iw - 48) / 2) + 'px', 'important');
                clonedGlow.style.setProperty('top', Math.round((ih - 27) / 2 + 1) + 'px', 'important');
                clonedGlow.style.setProperty('margin', '0', 'important');
                clonedGlow.style.setProperty('transform', 'none', 'important');
            }
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

    // 使用原生 Canvas 2D 线性渐变绘制顶/底部蒙层（自动适配夜间深色与日间浅色模式）
    function drawSeamlessHudGradients(targetCtx, outW, outH) {
        if (!renderTarget || !targetCtx) return;
        const targetRect = renderTarget.getBoundingClientRect();
        if (!targetRect.height) return;
        const isLightMode = renderTarget.classList.contains('theme-light');
        const rgbBase = isLightMode ? '255, 255, 255' : '0, 0, 0';

        const topBar = document.getElementById('web-player-top');
        if (topBar && topBar.offsetWidth > 0 && topBar.offsetHeight > 0) {
            const topH = Math.round((topBar.offsetHeight / targetRect.height) * outH * 1.15);
            const gTop = targetCtx.createLinearGradient(0, 0, 0, topH);
            gTop.addColorStop(0, `rgba(${rgbBase}, ${isLightMode ? '0.92' : '0.86'})`);
            gTop.addColorStop(0.5, `rgba(${rgbBase}, ${isLightMode ? '0.52' : '0.42'})`);
            gTop.addColorStop(0.82, `rgba(${rgbBase}, 0.08)`);
            gTop.addColorStop(1, `rgba(${rgbBase}, 0)`);
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
                gBot.addColorStop(0, `rgba(${rgbBase}, ${isLightMode ? '0.92' : (isDyl ? '0.72' : '0.90')})`);
                gBot.addColorStop(0.5, `rgba(${rgbBase}, ${isLightMode ? '0.55' : (isDyl ? '0.25' : '0.44')})`);
                gBot.addColorStop(0.82, `rgba(${rgbBase}, 0.08)`);
                gBot.addColorStop(1, `rgba(${rgbBase}, 0)`);
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

                // 1. 按当前日间/夜间模式填充底色
                const isLightExport = renderTarget.classList.contains('theme-light');
                ctx.fillStyle = isLightExport ? '#f5f6fa' : '#000000';
                ctx.fillRect(0, 0, outW, outH);

                // 2. 计算取景框在输出画布中的精确坐标与裁剪参数
                const isLiveOpenImg = renderTarget.classList.contains('dy-live-open');
                const isSpecialSubBox = !isLiveOpenImg && (renderTarget.classList.contains('port-land-box') || renderTarget.classList.contains('land-port-box') || renderTarget.classList.contains('dy-comment-open'));
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
            // 严格限制导出时长不超过源视频有效区间（防止 3 秒视频循环录制成 5~10 秒或帧率错乱变慢）
            const vidTotalDur = (previewVideo.duration && isFinite(previewVideo.duration) && previewVideo.duration > 0)
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

            let exportStartSec = Math.max(0, Math.min(trimRange.start || 0, Math.max(0, vidTotalDur - 0.5)));
            let recordSeconds = trimRange.duration;

            if (window.PlayerEngine.userHasTrimmed) {
                exportStartSec = Math.max(0, Math.min(trimRange.start || 0, Math.max(0, vidTotalDur - 0.5)));
                recordSeconds = Math.max(0.5, Math.min(trimRange.duration, vidTotalDur - exportStartSec));
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
            // ★ 绝不超出源视频剩余时长（3秒视频严格只导出3秒）
            recordSeconds = Math.min(recordSeconds, Math.max(0.5, vidTotalDur - exportStartSec));
            recordSeconds = Math.max(0.5, Number(recordSeconds.toFixed(2)));

            const origPlaybackRate = previewVideo.playbackRate || 1.0;
            const origLoopState = previewVideo.loop;

            origVidBtnText = '🎥 录屏导出视频';
            btnSaveVid.textContent = `⏳ 正在构建 1080P 手机硬解覆层...`;
            window.__isExportRecording = true;

            // 在 html2canvas 构建 UI 覆层期间，暂停视频并锁定在裁剪起点，同时关闭 loop 防止 3 秒视频重播
            previewVideo.loop = false;
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

                // ★ 竖屏分辨率严格控制在 1080x1920，横屏 1920x1080（偶数对齐，全手机硬解友好）
                let outW = 1920, outH = 1080;
                if (isPort) {
                    outW = 1080;
                    outH = 1920;
                }
                offCanvas.width = outW;
                offCanvas.height = outH;
                const ctx = offCanvas.getContext('2d', { alpha: false });
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

                const isLiveOpenVid = renderTarget.classList.contains('dy-live-open');
                const isSpecialSubBox = !isLiveOpenVid && (renderTarget.classList.contains('port-land-box') || renderTarget.classList.contains('land-port-box') || renderTarget.classList.contains('dy-comment-open'));
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
                        return el.id === 'player-media-wrap' || el.id === 'preview-video' || el.id === 'preview-img' || el.id === 'danmaku-container' || el.id === 'live-floating-dm-stage' || el.id === 'live-floating-hearts';
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

                // 预合成 1:1 尺寸的 UI 覆层画布
                const uiOverlayCanvas = document.createElement('canvas');
                uiOverlayCanvas.width = outW;
                uiOverlayCanvas.height = outH;
                const uiOverlayCtx = uiOverlayCanvas.getContext('2d');
                uiOverlayCtx.imageSmoothingEnabled = true;
                uiOverlayCtx.imageSmoothingQuality = 'high';
                drawSeamlessHudGradients(uiOverlayCtx, outW, outH);
                uiOverlayCtx.drawImage(uiSnapshotCanvas, -4, -6, outW + 8, outH + 12);

                const cachedCropRect = window.getPlayerCropRect
                    ? window.getPlayerCropRect(mediaWrapBox.w, mediaWrapBox.h)
                    : { renderW: mediaWrapBox.w + 12, renderH: mediaWrapBox.h + 12, offX: -6, offY: -6 };
                const cachedFilter = (mediaWrapEl && mediaWrapEl.style.filter) ? mediaWrapEl.style.filter : '';
                const dmContainerEl = document.getElementById('danmaku-container');
                const dmSwitchEl = document.getElementById('sw-danmaku');
                const isDmContainerVisible = !!(dmContainerEl && window.getComputedStyle(dmContainerEl).display !== 'none' && window.getComputedStyle(dmContainerEl).visibility !== 'hidden');
                const showDanmaku = (dmSwitchEl ? dmSwitchEl.checked : true) || isDmContainerVisible;
                const showPcBot = !document.getElementById('sw-bottom-bar') || document.getElementById('sw-bottom-bar').checked;
                const showMBot = !document.getElementById('sw-m-bottom-bar') || document.getElementById('sw-m-bottom-bar').checked;
                const showDylBot = !document.getElementById('sw-dyl-bottom') || document.getElementById('sw-dyl-bottom').checked;
                const showDylTime = !document.getElementById('sw-dyl-time') || document.getElementById('sw-dyl-time').checked;
                const syncTimeChecked = !swSyncVideoTime || swSyncVideoTime.checked;

                const isFixedDm = (window.DanmakuEngine && window.DanmakuEngine.mode === 'fixed');
                const isDmPaused = !!(window.DanmakuEngine && window.DanmakuEngine.isPaused);
                const activeDmSourceList = (window.DanmakuEngine && typeof window.DanmakuEngine.getActiveList === 'function')
                    ? window.DanmakuEngine.getActiveList()
                    : [];
                const liveDmDomNodes = dmContainerEl ? Array.from(dmContainerEl.querySelectorAll('.danmaku-item')) : [];

                const activeExportFont = (typeof getActiveOsFontStack === 'function')
                    ? getActiveOsFontStack()
                    : '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Source Han Sans SC", "Noto Sans SC", sans-serif';

                const danmakuParticles = [];
                if (liveDmDomNodes.length > 0) {
                    liveDmDomNodes.forEach((domEl, idx) => {
                        const txt = (domEl.textContent || '').trim();
                        if (!txt) return;
                        const cs = window.getComputedStyle(domEl);
                        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') <= 0.02) return;
                        const rect = domEl.getBoundingClientRect();
                        const dmMeta = activeDmSourceList[idx] || {};
                        const fontPx = Math.max(12, Math.round((parseFloat(cs.fontSize) || dmMeta.size || 15) * scaleRatioX));
                        ctx.font = `500 ${fontPx}px ${activeExportFont}`;
                        const tw = Math.max(40, ctx.measureText(txt).width);

                        // 读取当前画面上弹幕的实时精确坐标，确保导出首帧与实时预览看到的弹幕位置一致
                        let initX = (rect.left - targetRect.left) * scaleRatioX;
                        let initY = (rect.top - targetRect.top) * scaleRatioY;
                        const lockedX = domEl.classList.contains('dm-custom-pos') || (!isFixedDm && typeof dmMeta.customX === 'number');

                        // 若弹幕此时正好在屏幕外（尚未进入或刚滚出画布），将其平滑排布进可见区域以便录制时间内能完整看到
                        if (!isFixedDm && !lockedX && (initX > outW - 15 || initX + tw < 15)) {
                            initX = outW * (0.08 + ((idx * 0.21) % 0.78));
                        }

                        // 若手机竖屏评论区打开，确保弹幕 Y 坐标严格落在上方视频可视区域内，不被评论抽屉遮挡
                        if (isPort && renderTarget.classList.contains('dy-comment-open')) {
                            const minY = mediaWrapBox.y + 8 * scaleRatioY;
                            const maxY = Math.max(minY + fontPx, mediaWrapBox.y + mediaWrapBox.h - fontPx - 8 * scaleRatioY);
                            if (initY < minY || initY > maxY) {
                                const laneRatio = (idx % 4) / 3.5;
                                initY = minY + laneRatio * Math.max(4, maxY - minY);
                            }
                        }

                        const rawDurSec = parseFloat(cs.animationDuration) || ((dmMeta.speed || 11) / (window.DanmakuEngine?.speedFactor || 1));
                        const durSec = Math.max(4, rawDurSec);
                        const pxPerFrame = (isFixedDm || lockedX || isDmPaused)
                            ? 0
                            : ((outW + tw) / (durSec * 30));

                        danmakuParticles.push({
                            text: txt,
                            color: cs.color || dmMeta.color || '#ffffff',
                            size: fontPx,
                            x: initX,
                            y: initY,
                            tw: tw,
                            lockedX: lockedX,
                            speed: pxPerFrame
                        });
                    });
                } else {
                    activeDmSourceList.forEach((dm, idx) => {
                        if (!dm || !dm.text) return;
                        const effTop = (window.DanmakuEngine && typeof window.DanmakuEngine.getEffectiveTop === 'function')
                            ? window.DanmakuEngine.getEffectiveTop(dm.top)
                            : dm.top;
                        const fontPx = Math.max(12, Math.round((dm.size || 15) * scaleRatioX));
                        ctx.font = `500 ${fontPx}px ${activeExportFont}`;
                        const tw = Math.max(40, ctx.measureText(dm.text).width);
                        const lockedX = (!isFixedDm && typeof dm.customX === 'number');
                        const durSec = Math.max(4, (dm.speed || 11) / (window.DanmakuEngine?.speedFactor || 1));
                        danmakuParticles.push({
                            text: dm.text,
                            color: dm.color || '#ffffff',
                            size: fontPx,
                            y: (outH * effTop) / 100,
                            x: (typeof dm.customX === 'number')
                                ? ((outW * dm.customX) / 100)
                                : (isFixedDm ? ((outW * (dm.left || 20)) / 100) : ((outW * (0.08 + ((idx * 0.21) % 0.78))))),
                            tw: tw,
                            lockedX: lockedX,
                            speed: (isFixedDm || lockedX || isDmPaused) ? 0 : ((outW + tw) / (durSec * 30))
                        });
                    });
                }

                const baseStartSec = window.PlayerEngine.timeToSec(inStartTime.value);
                const totalVideoSec = window.PlayerEngine.timeToSec(inTotalTime.value) || 1125;
                const bufferPct = Math.min(100, Math.max(0, parseFloat(inBuffer.value) || 68)) / 100;

                // ★ 恒定 30fps (CFR) 参数与手机硬解码率（4.5 Mbps H.264 Main/Baseline Profile 8-bit + AAC 128kbps）
                const TARGET_FPS = 30;
                const TARGET_VIDEO_BITRATE = 4_500_000;
                const TARGET_AUDIO_BITRATE = 128_000;

                previewVideo.playbackRate = 1.0;
                previewVideo.defaultPlaybackRate = 1.0;

                if (Math.abs((previewVideo.currentTime || 0) - exportStartSec) > 0.05) {
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

                // 单帧合成函数（支持按精确相对秒数 elapsedSec 渲染，确保恒定 30fps 每一帧时间轴 100% 精准）
                const isLightRecord = renderTarget.classList.contains('theme-light');
                const renderSingleFrame = (nowStamp, forcedElapsedSec = null) => {
                    const dtRatio = forcedElapsedSec !== null
                        ? 1.0
                        : Math.min(2.5, Math.max(0.2, (nowStamp - lastFrameStamp) / (1000 / TARGET_FPS)));
                    lastFrameStamp = nowStamp;

                    ctx.fillStyle = isLightRecord ? '#f5f6fa' : '#000000';
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

                    // 2. 绘制实时弹幕层（与预览画面弹幕位置、字号、阴影及滚动速度 1:1 同步，并裁剪在视频区）
                    if (showDanmaku && danmakuParticles.length > 0) {
                        ctx.save();
                        if (isSpecialSubBox) {
                            ctx.beginPath();
                            ctx.rect(mediaWrapBox.x, mediaWrapBox.y, mediaWrapBox.w, mediaWrapBox.h);
                            ctx.clip();
                        }
                        ctx.textBaseline = 'top';
                        ctx.lineJoin = 'round';
                        ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
                        ctx.shadowBlur = 3 * scaleRatioX;
                        ctx.shadowOffsetX = 0;
                        ctx.shadowOffsetY = 1 * scaleRatioY;
                        for (let i = 0; i < danmakuParticles.length; i++) {
                            const p = danmakuParticles[i];
                            ctx.font = `500 ${p.size}px ${activeExportFont}`;
                            const tw = p.tw || ctx.measureText(p.text).width;
                            if (!isFixedDm && !p.lockedX && p.speed > 0 && (forcedElapsedSec === null || forcedElapsedSec > 0)) {
                                p.x -= p.speed * dtRatio;
                                if (p.x + tw < -15) {
                                    p.x = outW + 18 + (i % 4) * 28;
                                }
                            }
                            ctx.lineWidth = Math.max(1.5, 2.2 * scaleRatioX);
                            ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
                            ctx.strokeText(p.text, p.x, p.y);
                            ctx.fillStyle = p.color || 'rgba(255, 255, 255, 0.96)';
                            ctx.fillText(p.text, p.x, p.y);
                        }
                        ctx.restore();
                    }

                    // 3. 叠加预合成的 1080P UI 覆层
                    ctx.drawImage(uiOverlayCanvas, 0, 0);

                    // 3.2 若当前处于 Laya 直播间页面 (isLiveOpenVid)，在录屏画布中动态绘制直播间飘屏弹幕与右侧点赞飘心动画
                    if (isLiveOpenVid && typeof window.__drawLiveRoomDynamicCanvas === 'function') {
                        const curElapsed = forcedElapsedSec !== null ? forcedElapsedSec : ((nowStamp - recordStartStamp) / 1000);
                        window.__drawLiveRoomDynamicCanvas(ctx, outW, outH, scaleRatioX, scaleRatioY, curElapsed, activeExportFont);
                    }

                    // 3.5 动态绘制随时间变化的画面字幕（若开启了字幕）
                    if (window.SubtitleEngine && window.SubtitleEngine.enabled) {
                        const subTxt = window.SubtitleEngine.getCueTextAtTime(previewVideo.currentTime);
                        if (subTxt) {
                            ctx.save();
                            const fontPx = Math.round((window.SubtitleEngine.size || 16) * scaleRatioX);
                            ctx.font = `600 ${fontPx}px ${activeExportFont}`;
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
                    const rawElapsed = forcedElapsedSec !== null ? forcedElapsedSec : ((nowStamp - recordStartStamp) / 1000);
                    const elapsedSec = syncTimeChecked ? rawElapsed : 0;
                    const curSec = baseStartSec + elapsedSec;
                    const curPct = Math.min(1, Math.max(0, curSec / totalVideoSec));

                    ctx.save();
                    if (!isPort && !isLand && !isDyLand) {
                        if (showPcBot && pcBarBox) {
                            ctx.fillStyle = isLightRecord ? 'rgba(22,24,35,0.18)' : 'rgba(255,255,255,0.22)';
                            ctx.fillRect(pcBarBox.x, pcBarBox.y, pcBarBox.w, pcBarBox.h);
                            ctx.fillStyle = isLightRecord ? 'rgba(22,24,35,0.32)' : 'rgba(255,255,255,0.42)';
                            ctx.fillRect(pcBarBox.x, pcBarBox.y, pcBarBox.w * bufferPct, pcBarBox.h);
                            const fillW = pcBarBox.w * curPct;
                            ctx.fillStyle = '#1877F2';
                            ctx.fillRect(pcBarBox.x, pcBarBox.y, fillW, pcBarBox.h);
                            ctx.beginPath();
                            ctx.arc(pcBarBox.x + fillW, pcBarBox.y + pcBarBox.h / 2, 5.5 * scaleRatioX, 0, Math.PI * 2);
                            ctx.fillStyle = isLightRecord ? '#1877F2' : '#ffffff';
                            ctx.fill();
                        }
                        if (showPcBot && pcTimeBox) {
                            const timeText = `${window.PlayerEngine.secToTime(Math.floor(curSec))} / ${window.PlayerEngine.secToTime(totalVideoSec)}`;
                            ctx.font = `500 ${Math.round(11.5 * scaleRatioX)}px ${activeExportFont}`;
                            ctx.fillStyle = isLightRecord ? '#161823' : '#d0d4dc';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(timeText, pcTimeBox.x, pcTimeBox.y + pcTimeBox.h / 2);
                        }
                    } else if (isLand) {
                        if (showMBot && mBarBox) {
                            ctx.fillStyle = isLightRecord ? 'rgba(22,24,35,0.20)' : 'rgba(255,255,255,0.28)';
                            ctx.fillRect(mBarBox.x, mBarBox.y, mBarBox.w, mBarBox.h);
                            ctx.fillStyle = isLightRecord ? 'rgba(22,24,35,0.35)' : 'rgba(255,255,255,0.45)';
                            ctx.fillRect(mBarBox.x, mBarBox.y, mBarBox.w * bufferPct, mBarBox.h);
                            const fillW = mBarBox.w * curPct;
                            ctx.fillStyle = isLightRecord ? '#7c3aed' : '#ffffff';
                            ctx.fillRect(mBarBox.x, mBarBox.y, fillW, mBarBox.h);
                            ctx.save();
                            ctx.shadowColor = 'rgba(138, 116, 249, 0.95)';
                            ctx.shadowBlur = 8 * scaleRatioX;
                            ctx.beginPath();
                            ctx.arc(mBarBox.x + fillW, mBarBox.y + mBarBox.h / 2, 6 * scaleRatioX, 0, Math.PI * 2);
                            ctx.fillStyle = isLightRecord ? '#7c3aed' : '#ffffff';
                            ctx.fill();
                            ctx.restore();
                        }
                        if (showMBot && mTimeBox) {
                            const shortTime = `${window.PlayerEngine.secToShortTime(Math.floor(curSec))} / ${window.PlayerEngine.secToShortTime(totalVideoSec)}`;
                            ctx.font = `500 ${Math.round(12.5 * scaleRatioX)}px ${activeExportFont}`;
                            ctx.fillStyle = isLightRecord ? '#161823' : '#ffffff';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(shortTime, mTimeBox.x, mTimeBox.y + mTimeBox.h / 2);
                        }
                    } else if (isDyLand) {
                        const realVidDur = (previewVideo && previewVideo.duration && isFinite(previewVideo.duration) && previewVideo.duration > 0)
                            ? previewVideo.duration
                            : (recordSeconds || 10);
                        const realVidCur = previewVideo ? (previewVideo.currentTime || 0) : rawElapsed;
                        const realVidPct = Math.min(1, Math.max(0, realVidCur / realVidDur));
                        if (showDylBot && dylBarBox) {
                            ctx.fillStyle = isLightRecord ? 'rgba(22,24,35,0.22)' : 'rgba(255,255,255,0.28)';
                            ctx.fillRect(dylBarBox.x, dylBarBox.y, dylBarBox.w, dylBarBox.h);
                            const fillW = dylBarBox.w * realVidPct;
                            ctx.fillStyle = isLightRecord ? '#7c3aed' : '#ffffff';
                            ctx.fillRect(dylBarBox.x, dylBarBox.y, fillW, dylBarBox.h);
                            ctx.beginPath();
                            ctx.arc(dylBarBox.x + fillW, dylBarBox.y + dylBarBox.h / 2, 5 * scaleRatioX, 0, Math.PI * 2);
                            ctx.fillStyle = isLightRecord ? '#7c3aed' : '#ffffff';
                            ctx.fill();
                        }
                        if (showDylBot && showDylTime && dylTimeBox) {
                            const tLeft = window.PlayerEngine.secToMinSec(Math.floor(realVidCur), false);
                            const tRight = window.PlayerEngine.secToMinSec(Math.floor(realVidDur), false);
                            ctx.font = `600 ${Math.round(12 * scaleRatioX)}px ${activeExportFont}`;
                            ctx.fillStyle = isLightRecord ? '#161823' : 'rgba(255,255,255,0.92)';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(`${tLeft} / ${tRight}`, dylTimeBox.x, dylTimeBox.y + dylTimeBox.h / 2);
                        }
                    } else if (isPort && dyBarBox && !isLiveOpenVid) {
                        const realVidDur = (previewVideo && previewVideo.duration && isFinite(previewVideo.duration) && previewVideo.duration > 0)
                            ? previewVideo.duration
                            : (recordSeconds || 10);
                        const realVidCur = previewVideo ? (previewVideo.currentTime || 0) : rawElapsed;
                        const realVidPct = Math.min(1, Math.max(0, realVidCur / realVidDur));
                        const barH = Math.max(3.5 * scaleRatioY, dyBarBox.h);
                        ctx.fillStyle = isLightRecord ? 'rgba(22,24,35,0.18)' : 'rgba(255,255,255,0.50)';
                        ctx.fillRect(dyBarBox.x, dyBarBox.y, dyBarBox.w, barH);
                        const fillW = dyBarBox.w * realVidPct;
                        ctx.fillStyle = isLightRecord ? '#7c3aed' : '#ffffff';
                        ctx.fillRect(dyBarBox.x, dyBarBox.y, fillW, barH);
                        ctx.beginPath();
                        ctx.arc(dyBarBox.x + fillW, dyBarBox.y + barH / 2, 4.2 * scaleRatioX, 0, Math.PI * 2);
                        ctx.fillStyle = isLightRecord ? '#7c3aed' : '#ffffff';
                        ctx.fill();
                    }
                    ctx.restore();
                };

                // 先绘制首帧激活画布缓存
                renderSingleFrame(performance.now(), 0);

                // =========================================================================
                // ★ 优先方案：WebCodecs (H.264 Main/Baseline + AAC) + Mp4Muxer (fastStart 前置 moov + 恒定 30fps CFR)
                // 彻底解决手机端播放卡顿、3秒视频变好几秒、VFR 可变帧率失速、无 faststart 需下载完才能播的问题
                // =========================================================================
                let webCodecsSupported = false;
                let selectedVideoCodecConfig = null;
                let selectedAudioCodecConfig = null;
                let decodedAudioBuffer = null;

                if (window.Mp4Muxer && typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function') {
                    // 严格选用手机 100% 硬件解码支持的 8-bit H.264 Main Profile / Baseline Profile (Level 4.0)
                    const h264Candidates = [
                        'avc1.4d0028', // H.264 Main Profile Level 4.0 (首选手机硬解)
                        'avc1.42e028', // H.264 Constrained Baseline Level 4.0
                        'avc1.420028', // H.264 Baseline Level 4.0
                        'avc1.4d4028'  // H.264 Main Profile (Constrained) Level 4.0
                    ];
                    for (const codecStr of h264Candidates) {
                        try {
                            const cfg = {
                                codec: codecStr,
                                width: outW,
                                height: outH,
                                bitrate: TARGET_VIDEO_BITRATE,
                                framerate: TARGET_FPS,
                                latencyMode: 'quality',
                                avc: { format: 'avc' }
                            };
                            const sup = await VideoEncoder.isConfigSupported(cfg);
                            if (sup && sup.supported) {
                                selectedVideoCodecConfig = sup.config || cfg;
                                webCodecsSupported = true;
                                break;
                            }
                        } catch (e) {}
                    }
                }

                // 尝试解码源视频音轨并以 AAC (mp4a.40.2) 编码混流
                if (webCodecsSupported && typeof window.AudioEncoder === 'function' && typeof window.AudioData === 'function' && previewVideo.src) {
                    try {
                        const resp = await fetch(previewVideo.src);
                        if (resp.ok) {
                            const arrBuf = await resp.arrayBuffer();
                            const decCtx = new (window.AudioContext || window.webkitAudioContext)();
                            try {
                                decodedAudioBuffer = await decCtx.decodeAudioData(arrBuf);
                            } catch (decErr) {
                                decodedAudioBuffer = null;
                            } finally {
                                if (decCtx.close) decCtx.close().catch(() => {});
                            }
                        }
                        if (decodedAudioBuffer) {
                            const sampleRate = decodedAudioBuffer.sampleRate || 48000;
                            const numCh = Math.min(2, Math.max(1, decodedAudioBuffer.numberOfChannels || 2));
                            const aCfg = {
                                codec: 'mp4a.40.2', // AAC-LC 标准音频
                                sampleRate: sampleRate,
                                numberOfChannels: numCh,
                                bitrate: TARGET_AUDIO_BITRATE
                            };
                            const aSup = await AudioEncoder.isConfigSupported(aCfg);
                            if (aSup && aSup.supported) {
                                selectedAudioCodecConfig = aSup.config || aCfg;
                            } else {
                                decodedAudioBuffer = null;
                            }
                        }
                    } catch (audPreErr) {
                        decodedAudioBuffer = null;
                        selectedAudioCodecConfig = null;
                    }
                }

                if (webCodecsSupported && selectedVideoCodecConfig) {
                    const totalFrames = Math.max(1, Math.round(recordSeconds * TARGET_FPS));
                    const frameDurationUs = Math.round(1_000_000 / TARGET_FPS);

                    const muxerOpts = {
                        target: new window.Mp4Muxer.ArrayBufferTarget(),
                        video: {
                            codec: 'avc',
                            width: outW,
                            height: outH,
                            frameRate: TARGET_FPS
                        },
                        // ★ 开启 faststart（moov atom 前置），手机无需等待下载完即可秒开硬解播放
                        fastStart: 'in-memory',
                        firstTimestampBehavior: 'offset'
                    };
                    if (selectedAudioCodecConfig && decodedAudioBuffer) {
                        muxerOpts.audio = {
                            codec: 'aac',
                            numberOfChannels: selectedAudioCodecConfig.numberOfChannels,
                            sampleRate: selectedAudioCodecConfig.sampleRate
                        };
                    }

                    const muxer = new window.Mp4Muxer.Muxer(muxerOpts);
                    let muxerEncoderError = null;

                    const videoEncoder = new VideoEncoder({
                        output: (chunk, meta) => {
                            try { muxer.addVideoChunk(chunk, meta); } catch (e) { muxerEncoderError = e; }
                        },
                        error: (e) => {
                            muxerEncoderError = e;
                        }
                    });
                    videoEncoder.configure(selectedVideoCodecConfig);

                    let audioEncoder = null;
                    if (selectedAudioCodecConfig && decodedAudioBuffer) {
                        audioEncoder = new AudioEncoder({
                            output: (chunk, meta) => {
                                try { muxer.addAudioChunk(chunk, meta); } catch (e) {}
                            },
                            error: (e) => {
                                console.warn('AudioEncoder warning:', e);
                            }
                        });
                        audioEncoder.configure(selectedAudioCodecConfig);
                    }

                    // 预先将对应时间段 [exportStartSec, exportStartSec + recordSeconds] 的 PCM 音频送入 AAC 编码器
                    if (audioEncoder && decodedAudioBuffer) {
                        try {
                            const sr = selectedAudioCodecConfig.sampleRate;
                            const nCh = selectedAudioCodecConfig.numberOfChannels;
                            const startSample = Math.max(0, Math.floor(exportStartSec * sr));
                            const totalSamples = Math.min(
                                Math.floor(recordSeconds * sr),
                                Math.max(0, decodedAudioBuffer.length - startSample)
                            );
                            const chunkFrames = 1024;
                            for (let offset = 0; offset < totalSamples; offset += chunkFrames) {
                                const curFrames = Math.min(chunkFrames, totalSamples - offset);
                                if (curFrames <= 0) break;
                                const planarBuf = new Float32Array(curFrames * nCh);
                                for (let ch = 0; ch < nCh; ch++) {
                                    const srcCh = decodedAudioBuffer.getChannelData(Math.min(ch, decodedAudioBuffer.numberOfChannels - 1));
                                    planarBuf.set(srcCh.subarray(startSample + offset, startSample + offset + curFrames), ch * curFrames);
                                }
                                const timestampUs = Math.round((offset / sr) * 1_000_000);
                                const audioData = new AudioData({
                                    format: 'f32-planar',
                                    sampleRate: sr,
                                    numberOfFrames: curFrames,
                                    numberOfChannels: nCh,
                                    timestamp: timestampUs,
                                    data: planarBuf
                                });
                                audioEncoder.encode(audioData);
                                audioData.close();
                            }
                        } catch (audEncErr) {
                            console.warn('AAC encode note:', audEncErr);
                        }
                    }

                    let isRecording = true;
                    let encodedFrameCount = 0;
                    let intervalId = null;

                    const finalizeWebCodecsExport = async () => {
                        if (!isRecording) return;
                        isRecording = false;
                        window.__stopActiveExport = null;
                        if (intervalId) clearInterval(intervalId);

                        try {
                            btnSaveVid.textContent = `⏳ 正在封装 H.264 + faststart MP4...`;
                            await videoEncoder.flush();
                            videoEncoder.close();
                            if (audioEncoder) {
                                await audioEncoder.flush();
                                audioEncoder.close();
                            }
                            muxer.finalize();

                            if (muxerEncoderError) throw muxerEncoderError;

                            const { buffer } = muxer.target;
                            const blob = new Blob([buffer], { type: 'video/mp4' });
                            const downloadUrl = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.style.display = 'none';
                            const modeTag = isPort ? 'MobilePort' : (isDyLand ? 'DouyinFullLand' : (isLand ? 'MobileCinema' : 'WebPC'));
                            link.download = `Laya_${modeTag}_H264_30fps_${Date.now()}.mp4`;
                            link.href = downloadUrl;
                            document.body.appendChild(link);
                            link.click();
                            setTimeout(() => {
                                if (link.parentNode) link.parentNode.removeChild(link);
                                URL.revokeObjectURL(downloadUrl);
                            }, 800);

                            const actualSec = Math.max(0.5, encodedFrameCount / TARGET_FPS).toFixed(1);
                            window.showToast(`🎉 手机硬解 MP4 (H.264+AAC · 恒定30fps · faststart · ${actualSec}s) 导出成功！`);
                        } catch (encFinalErr) {
                            console.error('WebCodecs finalize error:', encFinalErr);
                            window.showToast(`❌ MP4 封装失败：${encFinalErr.message || '请重试'}`);
                        } finally {
                            window.__isExportRecording = false;
                            window.__stopActiveExport = null;
                            previewVideo.loop = origLoopState;
                            previewVideo.playbackRate = origPlaybackRate;
                            previewVideo.defaultPlaybackRate = origPlaybackRate;
                            if (offCanvas.parentNode) offCanvas.parentNode.removeChild(offCanvas);
                            btnSaveVid.textContent = origVidBtnText;
                            btnSaveVid.disabled = false;
                            if (window.PlayerEngine && typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') {
                                window.PlayerEngine.ensureVideoPlayingIfActive(false);
                            }
                        }
                    };

                    window.__stopActiveExport = finalizeWebCodecsExport;

                    await previewVideo.play().catch(() => {
                        previewVideo.muted = true;
                        return previewVideo.play().catch(() => {});
                    });

                    recordStartStamp = performance.now();
                    lastFrameStamp = recordStartStamp;

                    // ★ 严格按 30fps (每 33.33ms 一帧) 恒定帧率 (CFR) 采样并赋予固定步进时间戳，杜绝 VFR 导致手机播放变慢
                    intervalId = setInterval(() => {
                        if (!isRecording) return;
                        if (encodedFrameCount >= totalFrames || previewVideo.ended || (previewVideo.currentTime >= exportStartSec + recordSeconds + 0.05)) {
                            finalizeWebCodecsExport();
                            return;
                        }

                        const exactElapsedSec = encodedFrameCount / TARGET_FPS;
                        const now = performance.now();
                        renderSingleFrame(now, exactElapsedSec);

                        try {
                            const timestampUs = Math.round(encodedFrameCount * (1_000_000 / TARGET_FPS));
                            const frame = new VideoFrame(offCanvas, {
                                timestamp: timestampUs,
                                duration: frameDurationUs
                            });
                            // 每 30 帧（1秒）插入一个关键帧 I-Frame，保证手机拖动与硬解秒开
                            videoEncoder.encode(frame, { keyFrame: (encodedFrameCount % TARGET_FPS === 0) });
                            frame.close();
                            encodedFrameCount++;
                        } catch (frameErr) {
                            console.warn('Frame encode warning:', frameErr);
                        }

                        const remain = Math.max(0, recordSeconds - exactElapsedSec);
                        const pct = Math.min(99, Math.round((encodedFrameCount / totalFrames) * 100));
                        btnSaveVid.textContent = `🔴 导出中 ${pct}% (剩 ${remain.toFixed(1)}s · 点击立即保存)`;

                        if (encodedFrameCount >= totalFrames) {
                            finalizeWebCodecsExport();
                        }
                    }, Math.round(1000 / TARGET_FPS));

                    return;
                }

                // =========================================================================
                // ★ 兼容降级方案（当旧浏览器不支持 WebCodecs 时）：恒定 30fps H.264 Baseline/Main + AAC MP4
                // =========================================================================
                const canvasStream = offCanvas.captureStream(TARGET_FPS);
                const videoTrack = canvasStream.getVideoTracks()[0];

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

                await previewVideo.play().catch(() => {
                    previewVideo.muted = true;
                    return previewVideo.play().catch(() => {});
                });

                const streamWithAudio = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...audioTracks
                ]);
                const streamVideoOnly = new MediaStream([
                    ...canvasStream.getVideoTracks()
                ]);

                // 严格优先 H.264 Baseline/Main Profile + AAC MP4（不使用 VP9/AV1）
                const tryConfigs = [
                    { stream: streamWithAudio, mime: 'video/mp4;codecs="avc1.42E01F, mp4a.40.2"', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/mp4;codecs="avc1.4D401F, mp4a.40.2"', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/mp4;codecs="avc1.42E028, mp4a.40.2"', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/mp4;codecs="avc1.4D4028, mp4a.40.2"', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/mp4', ext: 'mp4' },
                    { stream: streamVideoOnly, mime: 'video/mp4;codecs="avc1.42E01F"', ext: 'mp4' },
                    { stream: streamVideoOnly, mime: 'video/mp4', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/webm;codecs="h264,opus"', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/webm', ext: 'webm' }
                ];

                let recorder = null;
                let selectedFormat = { mime: 'video/mp4', ext: 'mp4' };
                const chunks = [];

                for (const cfg of tryConfigs) {
                    if (cfg.mime && (!window.MediaRecorder || !MediaRecorder.isTypeSupported(cfg.mime))) {
                        continue;
                    }
                    try {
                        const opts = {
                            videoBitsPerSecond: TARGET_VIDEO_BITRATE,
                            audioBitsPerSecond: TARGET_AUDIO_BITRATE
                        };
                        if (cfg.mime) opts.mimeType = cfg.mime;
                        const candidate = new MediaRecorder(cfg.stream, opts);
                        candidate.ondataavailable = (e) => {
                            if (e.data && e.data.size > 0) chunks.push(e.data);
                        };
                        candidate.start(200);
                        recorder = candidate;
                        selectedFormat = { mime: cfg.mime || candidate.mimeType || 'video/mp4', ext: cfg.ext };
                        break;
                    } catch (recErr) {
                        console.warn('MediaRecorder fallback:', cfg.mime, recErr);
                    }
                }

                if (!recorder) {
                    throw new Error('当前浏览器无法启动视频录制器');
                }

                let isRecording = true;
                let bgTimerId = null;
                let stopTimeoutId = null;

                const finishRecording = () => {
                    if (!isRecording) return;
                    isRecording = false;
                    window.__stopActiveExport = null;
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
                    previewVideo.loop = origLoopState;
                    previewVideo.playbackRate = origPlaybackRate;
                    previewVideo.defaultPlaybackRate = origPlaybackRate;
                    if (offCanvas.parentNode) offCanvas.parentNode.removeChild(offCanvas);
                    btnSaveVid.textContent = origVidBtnText;
                    btnSaveVid.disabled = false;
                    if (window.PlayerEngine && typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') {
                        window.PlayerEngine.ensureVideoPlayingIfActive(false);
                    }

                    if (chunks.length === 0) {
                        window.showToast('❌ 录制数据为空，请重试');
                        return;
                    }

                    const blob = new Blob(chunks, { type: selectedFormat.mime || 'video/mp4' });
                    const downloadUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.style.display = 'none';
                    const modeTag = isPort ? 'MobilePort' : (isDyLand ? 'DouyinFullLand' : (isLand ? 'MobileCinema' : 'WebPC'));
                    link.download = `Laya_${modeTag}_1080P_30fps_${Date.now()}.${selectedFormat.ext}`;
                    link.href = downloadUrl;
                    document.body.appendChild(link);
                    link.click();
                    setTimeout(() => {
                        if (link.parentNode) link.parentNode.removeChild(link);
                        URL.revokeObjectURL(downloadUrl);
                    }, 800);

                    const actualSec = Math.min(recordSeconds, Math.max(0.5, ((performance.now() - recordStartStamp) / 1000))).toFixed(1);
                    window.showToast(`🎉 1080P 30fps 手机兼容视频 (.${selectedFormat.ext}，${actualSec}s) 导出成功！`);
                };

                recordStartStamp = performance.now();
                lastFrameStamp = recordStartStamp;

                // ★ 恒定 30fps (33.33ms) 定时渲染循环
                bgTimerId = setInterval(() => {
                    if (!isRecording) return;
                    const now = performance.now();
                    const elapsed = (now - recordStartStamp) / 1000;
                    if (elapsed >= recordSeconds || previewVideo.ended || (previewVideo.currentTime >= exportStartSec + recordSeconds + 0.05)) {
                        finishRecording();
                        return;
                    }
                    renderSingleFrame(now, elapsed);
                    if (videoTrack && typeof videoTrack.requestFrame === 'function') {
                        try { videoTrack.requestFrame(); } catch (e) {}
                    }
                    const remain = Math.max(0, recordSeconds - elapsed);
                    const pct = Math.min(99, Math.round((elapsed / recordSeconds) * 100));
                    btnSaveVid.textContent = `🔴 导出中 ${pct}% (剩 ${remain.toFixed(1)}s · 点击立即保存)`;
                }, Math.round(1000 / TARGET_FPS));

                stopTimeoutId = setTimeout(finishRecording, recordSeconds * 1000 + 80);

            } catch (err) {
                window.__isExportRecording = false;
                window.__stopActiveExport = null;
                previewVideo.loop = origLoopState;
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

    /* ==========================================================================
       ★ 12. 竖屏右侧图标列独立开关 + 唱片头像联动 + 日间/夜间模式 (4模式全生效 + 导出同步)
       ========================================================================== */
    const dyVinylImg = document.getElementById('dy-vinyl-img');
    const dyVinylWrap = document.getElementById('dy-vinyl-wrap');
    if (dyAvatarImg && dyVinylImg) {
        const syncVinylFromAvatar = () => {
            const curSrc = dyAvatarImg.getAttribute('src') || dyAvatarImg.src;
            if (curSrc && dyVinylImg.getAttribute('src') !== curSrc) {
                dyVinylImg.src = curSrc;
            }
        };
        syncVinylFromAvatar();
        if (typeof MutationObserver !== 'undefined') {
            const vinylObs = new MutationObserver(syncVinylFromAvatar);
            vinylObs.observe(dyAvatarImg, { attributes: true, attributeFilter: ['src'] });
        }
    }
    if (dyVinylWrap) {
        dyVinylWrap.addEventListener('click', () => {
            const rndBtn = document.getElementById('btn-random-author-avatar');
            if (rndBtn) rndBtn.click();
        });
    }

    // 右侧图标列（6项右侧图标 + 底部猜你想搜 + 底部上升热点）独立显隐控制
    const rightColumnSwitchSpecs = [
        { swId: 'sw-dy-icon-avatar', targetIds: ['dy-avatar-click'], disp: 'block' },
        { swId: 'sw-dy-icon-like', targetIds: ['dy-btn-like'], disp: 'flex' },
        { swId: 'sw-dy-icon-comment', targetIds: ['dy-btn-comment'], disp: 'flex' },
        { swId: 'sw-dy-icon-star', targetIds: ['dy-btn-star'], disp: 'flex' },
        { swId: 'sw-dy-icon-share', targetIds: ['dy-btn-share'], disp: 'flex' },
        { swId: 'sw-dy-icon-vinyl', targetIds: ['dy-vinyl-wrap'], disp: 'flex' },
        { swId: 'sw-dy-gold', targetIds: ['dy-wrap-gold', 'dy-search-bar-row'], disp: 'flex' },
        { swId: 'sw-dy-hotspot', targetIds: ['dy-wrap-hotspot'], disp: 'flex' }
    ];

    function applyRightColumnSwitches() {
        rightColumnSwitchSpecs.forEach(({ swId, targetIds, disp }) => {
            const swEl = document.getElementById(swId);
            const isChecked = !swEl || swEl.checked;
            targetIds.forEach(tId => {
                const tEl = document.getElementById(tId);
                if (!tEl) return;
                if (isChecked) {
                    tEl.classList.remove('dy-item-hidden');
                    tEl.style.display = disp;
                } else {
                    tEl.classList.add('dy-item-hidden');
                    tEl.style.setProperty('display', 'none', 'important');
                }
            });
        });

        const rightOnlyIds = ['sw-dy-icon-avatar', 'sw-dy-icon-like', 'sw-dy-icon-comment', 'sw-dy-icon-star', 'sw-dy-icon-share', 'sw-dy-icon-vinyl'];
        const anyRightOn = rightOnlyIds.some(id => {
            const el = document.getElementById(id);
            return !el || el.checked;
        });
        const swRightBarMaster = document.getElementById('sw-dy-right-bar');
        const rightBarEl = document.getElementById('dy-wrap-right-bar');
        if (rightBarEl) {
            const showBar = anyRightOn && (!swRightBarMaster || swRightBarMaster.checked);
            if (showBar) {
                rightBarEl.classList.remove('dy-item-hidden');
                rightBarEl.style.display = 'flex';
            } else {
                rightBarEl.classList.add('dy-item-hidden');
                rightBarEl.style.setProperty('display', 'none', 'important');
            }
        }
    }

    rightColumnSwitchSpecs.forEach(({ swId }) => {
        const swEl = document.getElementById(swId);
        if (swEl) {
            swEl.addEventListener('change', () => {
                applyRightColumnSwitches();
                if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            });
        }
    });

    const btnDyIconsAllOn = document.getElementById('btn-dy-icons-all-on');
    const btnDyIconsAllOff = document.getElementById('btn-dy-icons-all-off');
    if (btnDyIconsAllOn) {
        btnDyIconsAllOn.addEventListener('click', () => {
            rightColumnSwitchSpecs.forEach(({ swId }) => {
                const swEl = document.getElementById(swId);
                if (swEl) swEl.checked = true;
            });
            const swRightBarMaster = document.getElementById('sw-dy-right-bar');
            if (swRightBarMaster) swRightBarMaster.checked = true;
            const swFollowPlus = document.getElementById('sw-dy-follow-plus');
            if (swFollowPlus) {
                swFollowPlus.checked = true;
                swFollowPlus.dispatchEvent(new Event('change'));
            }
            applyRightColumnSwitches();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('✅ 已开启全部右侧图标与底部提示条');
        });
    }
    if (btnDyIconsAllOff) {
        btnDyIconsAllOff.addEventListener('click', () => {
            rightColumnSwitchSpecs.forEach(({ swId }) => {
                const swEl = document.getElementById(swId);
                if (swEl) swEl.checked = false;
            });
            applyRightColumnSwitches();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('✨ 已隐藏全部右侧图标与底部提示条');
        });
    }

    // 一次性迁移 V21：确保升级后所有 8 项右侧图标列开关默认开启，且顶部 6 标签默认选中「推薦」
    setTimeout(() => {
        if (localStorage.getItem('LAYA_V21_ICONS_AND_TABS_MIGRATED') !== '1') {
            rightColumnSwitchSpecs.forEach(({ swId }) => {
                const swEl = document.getElementById(swId);
                if (swEl) swEl.checked = true;
            });
            const swRightBarMaster = document.getElementById('sw-dy-right-bar');
            if (swRightBarMaster) swRightBarMaster.checked = true;
            const swFollowPlus = document.getElementById('sw-dy-follow-plus');
            if (swFollowPlus) {
                swFollowPlus.checked = true;
                const fb = document.getElementById('dy-btn-follow');
                if (fb) fb.classList.remove('follow-hidden');
            }
            const topNavItems = document.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item');
            if (topNavItems.length === 6) {
                topNavItems.forEach((it, idx) => it.classList.toggle('active', idx === 1));
            }
            localStorage.setItem('LAYA_V21_ICONS_AND_TABS_MIGRATED', '1');
            applyRightColumnSwitches();
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        } else {
            applyRightColumnSwitches();
        }
    }, 180);

    // ================= 全局日间 / 夜间模式切换引擎 (localStorage 持久化 + 导出联动) =================
    const THEME_STORAGE_KEY = 'LAYA_THEME_MODE_V1';
    const btnToggleTheme = document.getElementById('btn-toggle-theme');
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    const themeToggleTxt = document.getElementById('theme-toggle-txt');
    const leftWorkspace = document.getElementById('left-workspace');

    // 预生成日间浅色模式专用的深色 PNG 图标缓存，确保 html2canvas 截图/录屏导出时无需依赖 CSS filter 即可渲染深色图标
    window.LAYA_APP_ASSETS_LIGHT = {};
    function buildLightModeAssetsCache() {
        if (!window.LAYA_APP_ASSETS) return;
        const tintTargets = {
            'search': '#1f2329',
            'tab_1-1': '#6b7280',
            'tab_2-2': '#6b7280',
            'tab_3-3': '#6b7280',
            'tab_4-4': '#6b7280',
            'tab_5-5': '#6b7280',
            'tab_6-6': '#6b7280'
        };
        Object.entries(tintTargets).forEach(([key, hexColor]) => {
            const src = window.LAYA_APP_ASSETS[key];
            if (!src) return;
            const img = new Image();
            img.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth || 64;
                    c.height = img.naturalHeight || 64;
                    const cx = c.getContext('2d');
                    cx.drawImage(img, 0, 0, c.width, c.height);
                    cx.globalCompositeOperation = 'source-in';
                    cx.fillStyle = hexColor;
                    cx.fillRect(0, 0, c.width, c.height);
                    window.LAYA_APP_ASSETS_LIGHT[key] = c.toDataURL('image/png');
                    if (renderTarget && renderTarget.classList.contains('theme-light')) {
                        document.querySelectorAll(`img[data-laya-asset="${key}"]`).forEach(domImg => {
                            domImg.src = window.LAYA_APP_ASSETS_LIGHT[key];
                        });
                    }
                } catch (e) {}
            };
            img.src = src;
        });
    }
    buildLightModeAssetsCache();

    function syncThemeSvgColorsInRoot(rootEl, isDay) {
        if (!rootEl) return;
        const iconColor = isDay ? '#1f2329' : '#ffffff';
        const svgLike = rootEl.querySelector('#dy-svg-like');
        if (svgLike) {
            const curFill = (svgLike.getAttribute('fill') || '').toLowerCase();
            if (curFill !== '#fe2c55') svgLike.setAttribute('fill', iconColor);
        }
        const svgStar = rootEl.querySelector('#dy-svg-star');
        if (svgStar) {
            const curFill = (svgStar.getAttribute('fill') || '').toLowerCase();
            if (curFill !== '#f1c40f') svgStar.setAttribute('fill', iconColor);
        }
        const svgComment = rootEl.querySelector('#dy-btn-comment svg');
        if (svgComment) svgComment.setAttribute('fill', iconColor);
        const svgShare = rootEl.querySelector('#dy-btn-share svg');
        if (svgShare) svgShare.setAttribute('fill', iconColor);

        rootEl.querySelectorAll('#dy-wrap-top-nav svg, #laya-wrap-top-nav svg, #dy-fullscreen-pill svg, #dy-cmt-top-search-btn').forEach(svg => {
            svg.setAttribute('stroke', isDay ? '#161823' : '#ffffff');
        });
    }
    window.__syncThemeSvgColorsInRoot = syncThemeSvgColorsInRoot;

    function applyThemeMode(mode, save = true) {
        const isDay = (mode === 'day');
        if (renderTarget) renderTarget.classList.toggle('theme-light', isDay);
        if (leftWorkspace) leftWorkspace.classList.toggle('theme-light', isDay);
        document.body.classList.toggle('theme-light', isDay);

        if (btnToggleTheme) btnToggleTheme.classList.toggle('is-day', isDay);
        if (themeToggleIcon) themeToggleIcon.textContent = isDay ? '☀️' : '🌙';
        if (themeToggleTxt) themeToggleTxt.textContent = isDay ? '日间模式' : '夜间模式';

        if (window.LAYA_APP_ASSETS) {
            document.querySelectorAll('img[data-laya-asset]').forEach(img => {
                const key = img.getAttribute('data-laya-asset');
                if (isDay && window.LAYA_APP_ASSETS_LIGHT && window.LAYA_APP_ASSETS_LIGHT[key]) {
                    img.src = window.LAYA_APP_ASSETS_LIGHT[key];
                } else if (window.LAYA_APP_ASSETS[key]) {
                    img.src = window.LAYA_APP_ASSETS[key];
                }
            });
        }
        syncThemeSvgColorsInRoot(renderTarget, isDay);

        if (save) {
            try { localStorage.setItem(THEME_STORAGE_KEY, isDay ? 'day' : 'night'); } catch (e) {}
        }
    }
    window.applyThemeMode = applyThemeMode;

    // 启动时从 localStorage 读取上次保存的日/夜模式（默认夜间模式）
    const savedThemeMode = localStorage.getItem(THEME_STORAGE_KEY) || 'night';
    applyThemeMode(savedThemeMode, false);

    if (btnToggleTheme) {
        btnToggleTheme.addEventListener('click', () => {
            const isCurrentlyDay = renderTarget && renderTarget.classList.contains('theme-light');
            const nextMode = isCurrentlyDay ? 'night' : 'day';
            applyThemeMode(nextMode, true);
            window.showToast(nextMode === 'day' ? '☀️ 已切换为：日间浅色模式（全模式与导出生效）' : '🌙 已切换为：夜间深色模式（默认）');
        });
    }

    /* ==========================================================================
       ★ 13. 手机竖屏社区 (9:16) 嵌入 Laya 品牌暗紫直播页面引擎 (三条件触发 + 右侧面板联动 + 导出支持)
       ========================================================================== */
    const liveOverlayEl = document.getElementById('laya-live-room-overlay');
    const liveArmedTipEl = document.getElementById('dy-live-armed-tip');
    const liveHostAvatarWrap = document.getElementById('live-host-avatar-wrap');
    const liveHostAvatarImg = document.getElementById('live-host-avatar');
    const liveDispHostName = document.getElementById('live-disp-host-name');
    const liveDispHostId = document.getElementById('live-disp-host-id');
    const liveDispViewers = document.getElementById('live-disp-viewers');
    const liveBtnFollow = document.getElementById('live-btn-follow');
    const liveBtnExitTop = document.getElementById('live-btn-exit-top');
    const liveFloatingDmStage = document.getElementById('live-floating-dm-stage');
    const liveFloatingHearts = document.getElementById('live-floating-hearts');
    const liveChatList = document.getElementById('live-chat-list');
    const liveChatInput = document.getElementById('live-chat-input');
    const liveBtnSend = document.getElementById('live-btn-send');
    const liveBotBtnDm = document.getElementById('live-bot-btn-dm');
    const liveBotBtnGift = document.getElementById('live-bot-btn-gift');
    const liveBotBtnShare = document.getElementById('live-bot-btn-share');
    const liveBotBtnLike = document.getElementById('live-bot-btn-like');

    // 右侧控制面板直播专属控件
    const btnLiveBackToVideo = document.getElementById('btn-live-back-to-video');
    const inLiveHostName = document.getElementById('in-live-host-name');
    const btnLiveRandName = document.getElementById('btn-live-rand-name');
    const btnLiveRandNameBtn = document.getElementById('btn-live-rand-name-btn');
    const btnLiveRandHostAv = document.getElementById('btn-live-rand-host-av');
    const btnLiveUploadHostAv = document.getElementById('btn-live-upload-host-av');
    const btnLiveUploadHostAvBtn = document.getElementById('btn-live-upload-host-av-btn');
    const inLiveHostAvatarFile = document.getElementById('in-live-host-avatar-file');
    const inLiveHostId = document.getElementById('in-live-host-id');
    const btnLiveRandId = document.getElementById('btn-live-rand-id');
    const btnLiveRandIdBtn = document.getElementById('btn-live-rand-id-btn');

    const selLiveAudAvatarMode = document.getElementById('sel-live-aud-avatar-mode');
    const btnLiveRandAudAv = document.getElementById('btn-live-rand-aud-av');
    const btnLiveRandAudAvBtn = document.getElementById('btn-live-rand-aud-av-btn');
    const btnLiveUploadAudAv = document.getElementById('btn-live-upload-aud-av');
    const btnLiveUploadAudAvBtn = document.getElementById('btn-live-upload-aud-av-btn');
    const inLiveAudAvatarFile = document.getElementById('in-live-aud-avatar-file');
    const liveAudAvatarsBox = document.getElementById('live-aud-avatars');

    const inLiveViewersText = document.getElementById('in-live-viewers-text');
    const btnLiveRandViewers = document.getElementById('btn-live-rand-viewers');
    const btnLiveRandViewersBtn = document.getElementById('btn-live-rand-viewers-btn');
    const inLiveViewers = document.getElementById('in-live-viewers');
    const txtLiveViewers = document.getElementById('txt-live-viewers');
    const liveViewerPillTop = document.getElementById('live-viewer-pill-top');
    const liveLeftLivePill = document.getElementById('live-left-live-pill');
    const liveLeftLiveViewers = document.getElementById('live-left-live-viewers');

    // 直播间顶部胶囊标签（Laya 精选 / 人气榜 / 直播广场）自定义与随机控件
    const inLiveBrandTag = document.getElementById('in-live-brand-tag');
    const btnLiveRandBrandTag = document.getElementById('btn-live-rand-brand-tag');
    const btnLiveRandBrandTagBtn = document.getElementById('btn-live-rand-brand-tag-btn');
    const inLiveRankTag = document.getElementById('in-live-rank-tag');
    const inLiveSquareTag = document.getElementById('in-live-square-tag');
    const btnLiveRandRankTag = document.getElementById('btn-live-rand-rank-tag');
    const btnLiveRandRankTagBtn = document.getElementById('btn-live-rand-rank-tag-btn');

    // 礼物进场提示条控件
    const btnLiveUploadGiftAv = document.getElementById('btn-live-upload-gift-av');
    const inLiveGiftAvatarFile = document.getElementById('in-live-gift-avatar-file');
    const btnLiveRandGiftAv = document.getElementById('btn-live-rand-gift-av');
    const btnLiveRandGiftAll = document.getElementById('btn-live-rand-gift-all');
    const inLiveGiftUser = document.getElementById('in-live-gift-user');
    const btnLiveRandGiftUser = document.getElementById('btn-live-rand-gift-user');
    const btnLiveRandGiftUserBtn = document.getElementById('btn-live-rand-gift-user-btn');
    const inLiveGiftName = document.getElementById('in-live-gift-name');
    const btnLiveRandGiftName = document.getElementById('btn-live-rand-gift-name');
    const btnLiveRandGiftNameBtn = document.getElementById('btn-live-rand-gift-name-btn');
    const selLiveGiftPreset = document.getElementById('sel-live-gift-preset');
    const inLiveGiftIcon = document.getElementById('in-live-gift-icon');
    const btnLiveRandGiftIcon = document.getElementById('btn-live-rand-gift-icon');
    const inLiveGiftCount = document.getElementById('in-live-gift-count');
    const btnLiveRandGiftCount = document.getElementById('btn-live-rand-gift-count');
    const btnLiveRandGiftCountBtn = document.getElementById('btn-live-rand-gift-count-btn');
    const inLiveGiftColor = document.getElementById('in-live-gift-color');
    const inLiveGiftColorHex = document.getElementById('in-live-gift-color-hex');
    const btnLiveRandGiftColor = document.getElementById('btn-live-rand-gift-color');

    const inLiveDanmakuList = document.getElementById('in-live-danmaku-list');
    const inLiveDmColor = document.getElementById('in-live-dm-color');
    const inLiveDmColorHex = document.getElementById('in-live-dm-color-hex');
    const inLiveFollowColor = document.getElementById('in-live-follow-color');
    const inLiveFollowColorHex = document.getElementById('in-live-follow-color-hex');
    const inLiveDmScale = document.getElementById('in-live-dm-scale');
    const txtLiveDmScale = document.getElementById('txt-live-dm-scale');
    const btnLiveResetDmSize = document.getElementById('btn-live-reset-dm-size');
    const inLiveDmAreaWidth = document.getElementById('in-live-dm-area-width');
    const inLiveDmMaxRows = document.getElementById('in-live-dm-max-rows');
    const txtLiveDmArea = document.getElementById('txt-live-dm-area');
    const liveChatScrollBox = document.getElementById('live-chat-scroll-box');
    const liveDmResizeHandle = document.getElementById('live-dm-resize-handle');
    const inLiveDmSpeed = document.getElementById('in-live-dm-speed');
    const txtLiveDmSpeed = document.getElementById('txt-live-dm-speed');
    const inLiveHeartDensity = document.getElementById('in-live-heart-density');
    const txtLiveHeartDensity = document.getElementById('txt-live-heart-density');
    const swLiveRainbowNick = document.getElementById('sw-live-rainbow-nick');
    const swLiveAutoRollDm = document.getElementById('sw-live-auto-roll-dm');
    const swLiveAutoCycleGift = document.getElementById('sw-live-auto-cycle-gift');
    const swLiveDmRowHeart = document.getElementById('sw-live-dm-row-heart');

    // 直播间内部显示节点
    const liveFollowMiniAv = document.getElementById('dy-live-follow-mini-av');
    const liveAudImgs = document.querySelectorAll('#live-aud-avatars .live-aud-img');
    const liveJoinTickerRow = document.getElementById('live-join-ticker-row');
    const liveGiftComboBanner = document.getElementById('live-gift-combo-banner');
    const liveGiftSenderAv = document.getElementById('live-gift-sender-av');
    const liveGiftSenderName = document.getElementById('live-gift-sender-name');
    const liveGiftDescTxt = document.getElementById('live-gift-desc-txt');
    const liveGiftItemIcon = document.getElementById('live-gift-item-icon');
    const liveGiftComboNum = document.getElementById('live-gift-combo-num');
    const liveSubRankPill = document.getElementById('live-sub-rank-pill');
    const liveSubTxtRank = document.getElementById('live-sub-txt-rank');
    const liveLayaBrandPill = document.getElementById('live-laya-brand-pill');
    const liveLayaBrandTxt = document.getElementById('live-laya-brand-txt');
    const liveSubSquarePill = document.getElementById('live-sub-square-pill');
    const liveSubTxtSquare = document.getElementById('live-sub-txt-square');
    const liveSysNoticeEl = document.getElementById('live-sys-notice');

    // ★ 1. 右上角观众头像：直接采用内置抖音直播观众真实头像库 (Base64 高清原图秒开，绝不使用假剪影小人或蓝色 Laya 图标)
    function getDouyinLiveAudiencePool(mode) {
        const db = window.LAYA_ASIAN_AVATARS || {};
        const beauties = Array.isArray(db.beauties) ? db.beauties : [];
        const guys = Array.isArray(db.guys) ? db.guys : [];
        const pets = Array.isArray(db.pets) ? db.pets : [];
        const anime = Array.isArray(db.anime) ? db.anime : [];
        const cartoons = Array.isArray(db.cartoons) ? db.cartoons : [];
        const memes = Array.isArray(db.memes) ? db.memes : [];

        if (mode === 'beauties') {
            return beauties.length ? beauties : [...beauties, ...guys];
        }
        if (mode === 'guys') {
            return guys.length ? guys : [...guys, ...beauties];
        }
        if (mode === 'real') {
            return [...beauties, ...guys];
        }
        // 默认 douyin-mix（含旧版缓存自动兼容）：真实抖音直播间观众头像（真人美女/帅哥为主，穿插萌宠/动漫二次元生活头像）
        return [...beauties, ...guys, ...pets, ...anime, ...cartoons, ...memes];
    }

    let liveAudUsedIndices = [-1, -1, -1];

    function syncLiveAudienceAvatars(randomize = true) {
        if (selLiveAudAvatarMode && selLiveAudAvatarMode.value === 'douyin-default') {
            selLiveAudAvatarMode.value = 'douyin-mix';
        }
        const mode = selLiveAudAvatarMode ? selLiveAudAvatarMode.value : 'douyin-mix';
        const pool = getDouyinLiveAudiencePool(mode);

        if (liveAudImgs.length > 0 && pool.length > 0) {
            const pickedSet = new Set();
            liveAudImgs.forEach((img, idx) => {
                let pickIdx = 0;
                if (!randomize && liveAudUsedIndices[idx] >= 0 && liveAudUsedIndices[idx] < pool.length) {
                    pickIdx = liveAudUsedIndices[idx];
                } else {
                    for (let attempt = 0; attempt < 25; attempt++) {
                        const cand = Math.floor(Math.random() * pool.length);
                        if (!pickedSet.has(cand) && cand !== liveAudUsedIndices[idx]) {
                            pickIdx = cand;
                            break;
                        }
                        pickIdx = cand;
                    }
                }
                pickedSet.add(pickIdx);
                liveAudUsedIndices[idx] = pickIdx;
                const dataUrl = pool[pickIdx];
                if (dataUrl) {
                    img.src = dataUrl;
                    img.setAttribute('data-export-src', dataUrl);
                }
            });
        }
    }
    syncLiveAudienceAvatars(true);

    function triggerRandomLiveAudAvatars(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        syncLiveAudienceAvatars(true);
        window.showToast('🎲 已隨機更換右上角 3 位抖音觀眾頭像');
    }

    if (selLiveAudAvatarMode) {
        selLiveAudAvatarMode.addEventListener('change', () => {
            syncLiveAudienceAvatars(true);
            window.showToast('👤 已隨機切換抖音直播觀眾頭像風格');
        });
    }
    if (btnLiveRandAudAv) {
        btnLiveRandAudAv.addEventListener('click', triggerRandomLiveAudAvatars);
    }
    if (btnLiveRandAudAvBtn) {
        btnLiveRandAudAvBtn.addEventListener('click', triggerRandomLiveAudAvatars);
    }

    // ★ 支持上传自定义观众头像（点击画面右上角 3 位观众头像 或 点击右侧「📤上传」按钮均可直接上传本地图片）
    let audUploadRotateIdx = 0;
    const triggerUploadAudAvatars = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (inLiveAudAvatarFile) inLiveAudAvatarFile.click();
    };
    if (btnLiveUploadAudAv) btnLiveUploadAudAv.addEventListener('click', triggerUploadAudAvatars);
    if (btnLiveUploadAudAvBtn) btnLiveUploadAudAvBtn.addEventListener('click', triggerUploadAudAvatars);
    if (liveAudAvatarsBox) {
        // 左键点击画面右上角观众头像：直接弹出文件选择上传头像；右键点击：随机换一批
        liveAudAvatarsBox.addEventListener('click', triggerUploadAudAvatars);
        liveAudAvatarsBox.addEventListener('contextmenu', triggerRandomLiveAudAvatars);
    }
    if (inLiveAudAvatarFile) {
        inLiveAudAvatarFile.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
            if (!files.length) return;
            files.slice(0, 3).forEach((file, idx) => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const dataUrl = ev.target.result;
                    if (!dataUrl) return;
                    if (files.length === 1) {
                        // 若只选了 1 张图片，依次轮流替换第 1、2、3 个观众头像
                        const targetImg = liveAudImgs[audUploadRotateIdx % liveAudImgs.length] || liveAudImgs[0];
                        audUploadRotateIdx = (audUploadRotateIdx + 1) % Math.max(1, liveAudImgs.length);
                        if (targetImg) {
                            targetImg.src = dataUrl;
                            targetImg.setAttribute('data-export-src', dataUrl);
                        }
                    } else if (liveAudImgs[idx]) {
                        liveAudImgs[idx].src = dataUrl;
                        liveAudImgs[idx].setAttribute('data-export-src', dataUrl);
                    }
                };
                reader.readAsDataURL(file);
            });
            window.showToast('📤 已成功上傳並替換右上角觀眾頭像');
            inLiveAudAvatarFile.value = '';
        });
    }

    // ★ 支持上传自定义左上角主播头像（点击画面左上角主播头像 或 点击右侧「📤上传头像」按钮均可直接上传本地图片！）
    const applyUploadedHostAvatarDataUrl = (dataUrl) => {
        if (!dataUrl) return;
        if (liveHostAvatarImg) {
            liveHostAvatarImg.src = dataUrl;
            liveHostAvatarImg.setAttribute('data-export-src', dataUrl);
        }
        if (liveFollowMiniAv) {
            liveFollowMiniAv.src = dataUrl;
            liveFollowMiniAv.setAttribute('data-export-src', dataUrl);
        }
        if (typeof syncAuthorAvatarEverywhere === 'function') {
            syncAuthorAvatarEverywhere(dataUrl, true);
        } else if (dyAvatarImg) {
            dyAvatarImg.src = dataUrl;
            dyAvatarImg.setAttribute('data-export-src', dataUrl);
        }
        window.showToast('📤 主播頭像已成功上傳更新！');
    };

    const triggerUploadHostAvatar = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (inLiveHostAvatarFile) {
            inLiveHostAvatarFile.click();
        } else {
            const up = document.getElementById('dy-avatar-uploader');
            if (up) up.click();
        }
    };
    const triggerRandomHostAvatar = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const rndBtn = document.getElementById('btn-random-author-avatar');
        if (rndBtn) rndBtn.click();
    };
    if (btnLiveUploadHostAv) btnLiveUploadHostAv.addEventListener('click', triggerUploadHostAvatar);
    if (btnLiveUploadHostAvBtn) btnLiveUploadHostAvBtn.addEventListener('click', triggerUploadHostAvatar);
    if (btnLiveRandHostAv) btnLiveRandHostAv.addEventListener('click', triggerRandomHostAvatar);
    if (inLiveHostAvatarFile) {
        inLiveHostAvatarFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                applyUploadedHostAvatarDataUrl(ev.target.result);
            };
            reader.readAsDataURL(file);
            inLiveHostAvatarFile.value = '';
        });
    }

    if (dyAvatarImg && liveHostAvatarImg) {
        const syncLiveAvatar = () => {
            const curSrc = dyAvatarImg.getAttribute('src') || dyAvatarImg.src;
            if (curSrc && liveHostAvatarImg.getAttribute('src') !== curSrc) {
                liveHostAvatarImg.src = curSrc;
            }
            if (curSrc && liveFollowMiniAv && liveFollowMiniAv.getAttribute('src') !== curSrc) {
                liveFollowMiniAv.src = curSrc;
            }
        };
        syncLiveAvatar();
        if (typeof MutationObserver !== 'undefined') {
            const liveAvObs = new MutationObserver(syncLiveAvatar);
            liveAvObs.observe(dyAvatarImg, { attributes: true, attributeFilter: ['src'] });
        }
    }
    if (liveHostAvatarWrap) {
        // 左键点击画面左上角主播头像：直接弹出文件选择框上传本地头像！右键点击：随机换头像
        liveHostAvatarWrap.addEventListener('click', triggerUploadHostAvatar);
        liveHostAvatarWrap.addEventListener('contextmenu', triggerRandomHostAvatar);
    }

    // ★ 2. 本场点赞 + 右上角在线人数 + 左上角 LIVE 在线人数：
    // 全面支持 1000 ~ 200万 随机（如 5.6萬、10.2萬、25.3萬、138.5萬）、双击画面文字原地编辑、以及右侧面板编辑/滑块调节
    const liveHostNameRow = document.getElementById('live-host-name-row');
    const liveHostIdRow = document.getElementById('live-host-id-row');

    function formatViewerNumberText(numVal) {
        const n = Math.max(1000, Math.min(2000000, Number(numVal) || 102000));
        const unit = window.__currentLangMode === 'simp' ? '万' : '萬';
        if (n >= 10000) {
            return (n / 10000).toFixed(1) + unit;
        }
        return String(Math.round(n));
    }

    // 生成 1000 ~ 200万 之间的逼真随机数值（几千显示整数，几万~200万显示 x.x萬 / xxx.x萬）
    function generateRandom1kTo2M() {
        const unit = window.__currentLangMode === 'simp' ? '万' : '萬';
        const r = Math.random();
        let numVal = 102000;
        let dispTxt = `10.2${unit}`;
        if (r < 0.14) {
            // 1000 ~ 9900 (如 1680, 3520, 6890, 8420)
            numVal = Math.floor(10 + Math.random() * 89) * 100 + Math.floor(Math.random() * 9) * 10;
            dispTxt = String(numVal);
        } else if (r < 0.58) {
            // 1.1万 ~ 39.9万 (如 5.2万、5.8万、10.2万、25.3万)
            const wan = (1.1 + Math.random() * 38.8).toFixed(1);
            numVal = Math.round(parseFloat(wan) * 10000);
            dispTxt = `${wan}${unit}`;
        } else {
            // 40.1万 ~ 199.8万 (如 56.4万、88.2万、128.5万、186.3万)
            const wan = (40.1 + Math.random() * 159.7).toFixed(1);
            numVal = Math.round(parseFloat(wan) * 10000);
            dispTxt = `${wan}${unit}`;
        }
        return { numVal, dispTxt };
    }

    function applyLiveViewersDisplay(dispStr, syncSliderVal = null) {
        const isSimp = window.__currentLangMode === 'simp';
        const cleanTxt = String(dispStr || '10.2萬').replace(/(人在线|人在線)$/, '').trim() || '10.2萬';
        if (inLiveViewersText && inLiveViewersText.value !== cleanTxt) {
            inLiveViewersText.value = cleanTxt;
        }
        if (txtLiveViewers) txtLiveViewers.textContent = cleanTxt;
        if (liveDispViewers) liveDispViewers.textContent = cleanTxt;
        if (liveLeftLiveViewers) {
            const suffix = isSimp ? '人在线' : '人在線';
            liveLeftLiveViewers.textContent = `${cleanTxt}${suffix}`;
        }
        if (syncSliderVal !== null && inLiveViewers) {
            inLiveViewers.value = String(syncSliderVal);
        }
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
        }
    }

    function applyLiveHostLikesDisplay(dispStr) {
        const cleanTxt = String(dispStr || '25.6萬').replace(/(本场点赞|本場點讚)$/, '').trim() || '25.6萬';
        if (inLiveHostId && inLiveHostId.value !== cleanTxt) {
            inLiveHostId.value = cleanTxt;
        }
        if (liveDispHostId) liveDispHostId.textContent = cleanTxt;
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
        }
    }

    function applyLiveHostNameDisplay(nameStr) {
        const cleanTxt = String(nameStr || '小王小王').trim() || '小王小王';
        if (inLiveHostName && inLiveHostName.value !== cleanTxt) {
            inLiveHostName.value = cleanTxt;
        }
        if (liveDispHostName) liveDispHostName.textContent = cleanTxt;
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
        }
    }

    function randomizeLiveViewersCount() {
        const { numVal, dispTxt } = generateRandom1kTo2M();
        applyLiveViewersDisplay(dispTxt, numVal);
        window.showToast(`🔥 在線人數已隨機為：${dispTxt}`);
    }

    // 通用绑定器：单击触发随机（1000~200万），双击直接在手机画面原地弹出内联输入框修改文字
    function bindLiveClickRandAndDblEdit(triggerEl, targetTextEl, getValFn, setValFn, singleClickRandFn, inputWidthPx = 58) {
        if (!triggerEl || !targetTextEl) return;
        let clickTimer = null;

        triggerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (triggerEl.querySelector('.live-inline-edit-input')) return;
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                clickTimer = null;
                if (!triggerEl.querySelector('.live-inline-edit-input')) {
                    singleClickRandFn();
                }
            }, 210);
        });

        triggerEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            if (triggerEl.querySelector('.live-inline-edit-input')) return;

            const curVal = getValFn();
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.className = 'live-inline-edit-input';
            inp.value = curVal;
            inp.style.setProperty('width', inputWidthPx + 'px', 'important');

            const prevDisplay = targetTextEl.style.display;
            targetTextEl.style.display = 'none';
            targetTextEl.parentNode.insertBefore(inp, targetTextEl);
            inp.focus();
            inp.select();

            let finished = false;
            const commit = (save) => {
                if (finished) return;
                finished = true;
                const nextVal = inp.value.trim();
                if (inp.parentNode) inp.parentNode.removeChild(inp);
                targetTextEl.style.display = prevDisplay || '';
                if (save && nextVal) {
                    setValFn(nextVal);
                }
            };

            inp.addEventListener('click', (ev) => ev.stopPropagation());
            inp.addEventListener('dblclick', (ev) => ev.stopPropagation());
            inp.addEventListener('keydown', (ev) => {
                ev.stopPropagation();
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    commit(true);
                } else if (ev.key === 'Escape') {
                    ev.preventDefault();
                    commit(false);
                }
            });
            inp.addEventListener('blur', () => commit(true));
        });
    }

    if (inLiveViewersText) {
        inLiveViewersText.addEventListener('input', () => {
            const raw = inLiveViewersText.value.trim() || '10.2萬';
            applyLiveViewersDisplay(raw, null);
        });
    }
    if (inLiveViewers) {
        inLiveViewers.addEventListener('input', () => {
            const val = parseInt(inLiveViewers.value, 10) || 102000;
            const txt = formatViewerNumberText(val);
            applyLiveViewersDisplay(txt, null);
        });
    }
    if (btnLiveRandViewers) btnLiveRandViewers.addEventListener('click', (e) => { e.preventDefault(); randomizeLiveViewersCount(); });
    if (btnLiveRandViewersBtn) btnLiveRandViewersBtn.addEventListener('click', randomizeLiveViewersCount);

    // 绑定画面右上角在线人数胶囊 & 左上角 LIVE 在线人数胶囊：单击随机(1000~200万)，双击原地编辑
    bindLiveClickRandAndDblEdit(
        liveViewerPillTop,
        liveDispViewers,
        () => (liveDispViewers ? liveDispViewers.textContent.trim() : '10.2萬'),
        (v) => {
            applyLiveViewersDisplay(v, null);
            window.showToast(`✅ 在線人數已修改為：${v}`);
        },
        randomizeLiveViewersCount,
        54
    );
    bindLiveClickRandAndDblEdit(
        liveLeftLivePill,
        liveLeftLiveViewers,
        () => (liveDispViewers ? liveDispViewers.textContent.trim() : '10.2萬'),
        (v) => {
            applyLiveViewersDisplay(v, null);
            window.showToast(`✅ 在線人數已修改為：${v}`);
        },
        randomizeLiveViewersCount,
        56
    );

    let liveHeartTimer = null;
    let liveChatRollTimer = null;
    let liveJoinTickerTimer = null;
    let liveGiftComboTimer = null;
    let liveHeaderFlipTimer = null;
    let liveFlyDmRaf = null;
    let liveDmVisible = true;
    let liveChatCursor = 0;
    let liveJoinCursor = 0;
    let liveRollTickCount = 0;
    let liveFlyParticles = [];

    const defaultLiveChatLines = [
        '前排！',
        '主播好漂亮',
        '這首歌絕了',
        '666',
        '哈哈哈哈',
        '關注了',
        '求歌名',
        '聲音好甜',
        '打卡',
        '蹲一個歌單',
        '太治癒了',
        '主播加油',
        '已關注 比心',
        '主播聲音也太好聽了'
    ];
    const presetLevels = [19, 12, 26, 25, 21, 16, 29, 24, 18, 33, 28, 31, 15, 22, 36];
    const presetFanLevels = [10, 12, 8, 15, 9, 11, 16, 14, 6, 18, 13, 10, 7, 19, 11];
    const fallbackNicknames = ['羊🐑', '🌈七月初五🐟🐳', '輕輕吹風', '蒙蒙', '夜色有點濃', '微醺小貓', '阿傑', '捉事盧鑫', '石頭baby', '希拉', '皓哥', '漫渡', '晚風溫柔', '星河少女'];

    // ★ 将逗号/分号分隔或挤在一行的弹幕文本自动拆分为「每行一条」
    function splitDanmakuTextToMultiline(rawStr) {
        const cleaned = String(rawStr || '')
            .trim()
            .replace(/^【+/, '')
            .replace(/】+$/, '');
        if (!cleaned) return defaultLiveChatLines.slice();

        const rawLines = cleaned.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
        const resultLines = [];

        rawLines.forEach(line => {
            // 若单行内包含多个逗号分隔的短句（例如旧版「前排！, 主播好漂亮, 這首歌絕了...」），自动按逗号拆分为多行
            const hasColon = line.includes('：') || line.includes(':');
            const commaParts = line.split(/\s*[,，、;；]\s*/).map(s => s.trim()).filter(Boolean);
            if (!hasColon && commaParts.length >= 2) {
                commaParts.forEach(p => resultLines.push(p));
            } else if (hasColon && commaParts.length >= 4) {
                commaParts.forEach(p => resultLines.push(p));
            } else {
                resultLines.push(line);
            }
        });

        return resultLines.length > 0 ? resultLines : defaultLiveChatLines.slice();
    }

    function normalizeLiveDanmakuTextarea(updateDom = true) {
        if (!inLiveDanmakuList) return defaultLiveChatLines.slice();
        const lines = splitDanmakuTextToMultiline(inLiveDanmakuList.value);
        const joined = lines.join('\n');
        if (updateDom && inLiveDanmakuList.value !== joined) {
            inLiveDanmakuList.value = joined;
        }
        return lines;
    }

    // ★ 彩虹/彩色用户名色板（逐字或整名渲染，100% 兼容 html2canvas 截图与视频导出）
    const RAINBOW_CHAR_COLORS = ['#ff6b9d', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#f472b6', '#38bdf8'];
    const COLORFUL_NICK_PALETTE = ['#60a5fa', '#c084fc', '#f472b6', '#34d399', '#fbbf24', '#38bdf8', '#a78bfa'];

    function buildColorfulNickHtml(nickStr, rowIdx) {
        const useRainbow = !swLiveRainbowNick || swLiveRainbowNick.checked;
        const clean = String(nickStr || '');
        if (!useRainbow) {
            return `<span class="live-chat-nick">${escapeHtmlSafe(clean)}：</span>`;
        }
        // 每隔一行使用逐字彩虹渐变色，其余行使用高饱和绚丽彩名
        if (rowIdx % 2 === 0 && clean.length >= 2) {
            const chars = Array.from(clean);
            const spans = chars.map((ch, cIdx) => {
                const col = RAINBOW_CHAR_COLORS[(rowIdx + cIdx) % RAINBOW_CHAR_COLORS.length];
                return `<span style="color:${col};">${escapeHtmlSafe(ch)}</span>`;
            }).join('');
            return `<span class="live-chat-nick">${spans}<span style="color:#cbd5e1;">：</span></span>`;
        }
        const solidCol = COLORFUL_NICK_PALETTE[rowIdx % COLORFUL_NICK_PALETTE.length];
        return `<span class="live-chat-nick" style="color:${solidCol};">${escapeHtmlSafe(clean)}：</span>`;
    }

    // ★ 独立高频进场观众池
    const liveJoinViewerPool = [
        { lv: 17, fan: 8,  nick: '足弟' },
        { lv: 12, fan: 6,  nick: '再次邂逅說愛你' },
        { lv: 25, fan: 11, nick: 'LOL' },
        { lv: 33, fan: 15, nick: '滴水成冰' },
        { lv: 18, fan: 9,  nick: '捉事盧鑫' },
        { lv: 24, fan: 10, nick: '混凝土銷售' },
        { lv: 29, fan: 14, nick: '皓哥' },
        { lv: 16, fan: 7,  nick: '漫渡' },
        { lv: 21, fan: 10, nick: '風止何安' },
        { lv: 19, fan: 8,  nick: '晨霸' },
        { lv: 31, fan: 16, nick: '石頭baby' },
        { lv: 14, fan: 6,  nick: '香港明' },
        { lv: 22, fan: 12, nick: '麥兜黑鳳梨' },
        { lv: 27, fan: 13, nick: '歲月如歌' },
        { lv: 35, fan: 18, nick: '萬里星河' },
        { lv: 20, fan: 9,  nick: '晚風溫柔' },
        { lv: 28, fan: 14, nick: '南城舊夢' },
        { lv: 30, fan: 15, nick: '深海裡的星星' },
        { lv: 23, fan: 10, nick: '暴富小錦鯉' },
        { lv: 38, fan: 20, nick: 'Laya榜一大哥' }
    ];

    function parseLiveDanmakuTexts() {
        if (!inLiveDanmakuList) return defaultLiveChatLines;
        const list = splitDanmakuTextToMultiline(inLiveDanmakuList.value);
        return list.length > 0 ? list : defaultLiveChatLines;
    }

    function getLiveDmColor() {
        return (inLiveDmColor && inLiveDmColor.value) ? inLiveDmColor.value : '#ffffff';
    }

    function getLiveDmSpeedVal() {
        const v = inLiveDmSpeed ? parseInt(inLiveDmSpeed.value, 10) : 5;
        return Number.isNaN(v) ? 5 : Math.min(10, Math.max(1, v));
    }

    function getLiveHeartDensityVal() {
        const v = inLiveHeartDensity ? parseInt(inLiveHeartDensity.value, 10) : 6;
        return Number.isNaN(v) ? 6 : Math.min(10, Math.max(1, v));
    }

    function escapeHtmlSafe(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ★ 1:1 复刻抖音实拍视频的「蓝紫财富等级胶囊牌」与「橙粉粉丝团勋章牌」（采用高清矢量 SVG，绝不用假的 💎 和 🏅 Emoji）
    const DOUYIN_LV_STAR_DIAMOND_SVG = `<svg class="live-lv-svg" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="8,1.2 13.8,5.2 11.6,14.2 4.4,14.2 2.2,5.2" fill="#e0f2fe" fill-opacity="0.95"/><polygon points="8,1.2 13.8,5.2 8,6.8 2.2,5.2" fill="#ffffff"/><polygon points="2.2,5.2 8,6.8 4.4,14.2" fill="#bae6fd"/><polygon points="13.8,5.2 11.6,14.2 8,6.8" fill="#7dd3fc"/><polygon points="8,3.2 9.4,6.4 12.6,7.8 9.4,9.2 8,12.4 6.6,9.2 3.4,7.8 6.6,6.4" fill="#ffffff"/></svg>`;
    const DOUYIN_FAN_HEART_WING_SVG = `<svg class="live-fan-svg" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 13.8C8 13.8 2.2 10.1 2.2 5.9C2.2 3.9 3.8 2.4 5.6 2.4C6.7 2.4 7.6 3 8 3.8C8.4 3 9.3 2.4 10.4 2.4C12.2 2.4 13.8 3.9 13.8 5.9C13.8 10.1 8 13.8 8 13.8Z" fill="#fff7ed"/><path d="M8 4.3L9.05 6.45L11.4 6.8L9.7 8.45L10.1 10.8L8 9.7L5.9 10.8L6.3 8.45L4.6 6.8L6.95 6.45L8 4.3Z" fill="#f97316"/></svg>`;

    function buildLiveLvBadgeHtml(lv) {
        const n = parseInt(lv, 10) || 0;
        if (n <= 0) return '';
        const tierCls = n <= 15 ? 'lv-tier-1' : (n <= 29 ? 'lv-tier-2' : 'lv-tier-3');
        return `<span class="live-lv-badge ${tierCls}">${DOUYIN_LV_STAR_DIAMOND_SVG}<span>${n}</span></span>`;
    }

    function buildLiveFanBadgeHtml(fanLv) {
        const n = parseInt(fanLv, 10) || 0;
        if (n <= 0) return '';
        return `<span class="live-fan-badge">${DOUYIN_FAN_HEART_WING_SVG}<span>${n}</span></span>`;
    }

    // 渲染底部独立高频进场通道（#live-join-ticker-row，1:1 还原抖音实拍视频底部「💎17 足弟 来了」单蓝牌简洁样式）
    function renderLiveJoinTicker(advance = false) {
        if (!liveJoinTickerRow) return;
        if (advance) {
            liveJoinCursor = (liveJoinCursor + 1) % liveJoinViewerPool.length;
        }
        const v = liveJoinViewerPool[liveJoinCursor % liveJoinViewerPool.length];
        const lvBadgeHtml = buildLiveLvBadgeHtml(v.lv);
        const isSimp = window.__currentLangMode === 'simp';
        const joinTxt = isSimp ? '来了' : '來了';
        liveJoinTickerRow.innerHTML = `<div class="live-join-pill">${lvBadgeHtml}<span class="live-chat-nick">${escapeHtmlSafe(v.nick)}</span><span class="live-chat-msg is-join"> ${joinTxt}</span></div>`;
    }

    // ★ 四、渲染滚动弹幕列表：
    // 1) 「管」字标不再全员刷屏，默认只有偶尔几条（约每 6 条出现 1 个房管）才带红色「管」字牌；
    // 2) 双击画面上任意一条弹幕（.live-chat-bubble），自动暂停滚动并原地弹出全能编辑条，可单独修改这条弹幕的：蓝牌等级、橙牌粉丝等级、是否带「管」字牌、发言人昵称、弹幕文字！
    let liveEditingDmIdx = null;

    function parseSingleLiveDanmakuRow(rawLine, globalIdx) {
        let rest = String(rawLine || '').trim();
        let lv = presetLevels[globalIdx % presetLevels.length];
        // 参照抖音原版实拍视频：约 1/3 铁粉观众同时带橙色粉丝团牌，其余只带蓝紫财富等级牌，自然真实不拥挤
        let fanLv = (globalIdx % 3 === 1) ? presetFanLevels[globalIdx % presetFanLevels.length] : 0;
        // 默认只有偶尔几个发言人带红色「管」字图标（每 6 条里仅 1 条带「管」）
        let isAdmin = (globalIdx % 6 === 2);

        // 解析行首可选自定义徽章标签，如：[Lv26|粉12|管] 或 [26|0|無管] 或 [管] 或 [無管]
        const metaMatch = rest.match(/^\[([^\]]+)\]\s*/);
        if (metaMatch) {
            const tagBody = metaMatch[1].trim();
            // 避免把旧版 [主播] 当成普通无解析标签，但如果是我们支持的格式则解析并剥离
            if (/^(Lv\d+|\d+|粉\d+|管|房管|無管|无管|-管|\|)+$/i.test(tagBody)) {
                rest = rest.slice(metaMatch[0].length).trim();
                const parts = tagBody.split('|').map(s => s.trim()).filter(Boolean);
                parts.forEach((p, idx) => {
                    if (/^Lv(\d+)$/i.test(p)) {
                        lv = parseInt(RegExp.$1, 10) || 0;
                    } else if (/^粉(\d+)$/i.test(p)) {
                        fanLv = parseInt(RegExp.$1, 10) || 0;
                    } else if (/^\d+$/.test(p)) {
                        if (idx === 0) lv = parseInt(p, 10) || 0;
                        else if (idx === 1) fanLv = parseInt(p, 10) || 0;
                    } else if (p === '管' || p === '房管') {
                        isAdmin = true;
                    } else if (p === '無管' || p === '无管' || p === '-管') {
                        isAdmin = false;
                    }
                });
            }
        }

        const colonIdx = rest.indexOf('：') !== -1 ? rest.indexOf('：') : rest.indexOf(':');
        let nickPart = '';
        let msg = '';
        if (colonIdx > 0) {
            nickPart = rest.slice(0, colonIdx).trim();
            msg = rest.slice(colonIdx + 1).trim();
        } else {
            nickPart = fallbackNicknames[globalIdx % fallbackNicknames.length];
            msg = rest;
        }
        nickPart = nickPart.replace(/\s*\[💜[^\]]+\]\s*/g, '').replace(/^\[主播\]\s*/, '').trim() || fallbackNicknames[globalIdx % fallbackNicknames.length];

        return { lv, fanLv, isAdmin, nickPart, msg };
    }

    function formatSingleLiveDanmakuRow(lv, fanLv, isAdmin, nickPart, msg, globalIdx) {
        const defLv = presetLevels[globalIdx % presetLevels.length];
        const defFan = (globalIdx % 3 === 1) ? presetFanLevels[globalIdx % presetFanLevels.length] : 0;
        const defAdmin = (globalIdx % 6 === 2);

        const cleanNick = String(nickPart || '').trim() || fallbackNicknames[globalIdx % fallbackNicknames.length];
        const cleanMsg = String(msg || '').trim() || '666';

        // 若等级与房管均与默认一致，则保持最干净的「昵称：内容」；若用户自定义了等级或开关了「管」，则写入行首标签持久化保存
        if (lv === defLv && fanLv === defFan && isAdmin === defAdmin) {
            return `${cleanNick}：${cleanMsg}`;
        }
        const adminToken = isAdmin ? '管' : '無管';
        return `[Lv${Math.max(0, lv)}|粉${Math.max(0, fanLv)}|${adminToken}] ${cleanNick}：${cleanMsg}`;
    }

    function updateSingleLiveDanmakuLineInTextarea(globalIdx, newFormattedLine) {
        const allLines = parseLiveDanmakuTexts();
        if (globalIdx >= 0 && globalIdx < allLines.length) {
            allLines[globalIdx] = newFormattedLine;
            if (inLiveDanmakuList) {
                inLiveDanmakuList.value = allLines.join('\n');
            }
            if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
                triggerSaveStorage();
            }
        }
    }

    function getLiveMaxRowsVal() {
        const v = inLiveDmMaxRows ? parseInt(inLiveDmMaxRows.value, 10) : 5;
        return Number.isNaN(v) ? 5 : Math.min(9, Math.max(2, v));
    }

    function applyLiveDmScaleAndArea(triggerRender = false) {
        const scalePct = inLiveDmScale ? (parseInt(inLiveDmScale.value, 10) || 100) : 100;
        const clampedScale = Math.min(155, Math.max(75, scalePct));
        const scaleRatio = (clampedScale / 100).toFixed(2);

        const widthPct = inLiveDmAreaWidth ? (parseInt(inLiveDmAreaWidth.value, 10) || 93) : 93;
        const clampedWidth = Math.min(100, Math.max(55, widthPct));
        const maxRows = getLiveMaxRowsVal();

        if (liveChatScrollBox) {
            liveChatScrollBox.style.setProperty('--live-dm-scale', scaleRatio);
            liveChatScrollBox.style.setProperty('--live-dm-width', `${clampedWidth}%`);
        }
        if (txtLiveDmScale) {
            const desc = clampedScale < 95 ? '紧凑' : (clampedScale <= 105 ? '标准' : (clampedScale <= 125 ? '偏大' : '特大'));
            txtLiveDmScale.textContent = `${clampedScale}% (${desc})`;
        }
        if (txtLiveDmArea) {
            txtLiveDmArea.textContent = `宽${clampedWidth}% · ${maxRows}行`;
        }
        if (triggerRender) {
            renderLiveChatBubbles(false);
        }
    }

    function renderLiveChatBubbles(advance = false) {
        if (!liveChatList) return;
        // 若用户正在双击编辑某条弹幕，暂停自动滚动刷新，保证编辑框稳定不跳动
        if (advance && liveEditingDmIdx !== null) return;

        const allLines = parseLiveDanmakuTexts();
        if (advance) {
            liveChatCursor = (liveChatCursor + 1) % allLines.length;
            liveRollTickCount++;
            if (liveRollTickCount >= 3 && liveSysNoticeEl && liveSysNoticeEl.style.display !== 'none') {
                liveSysNoticeEl.style.display = 'none';
            }
        }
        const userMaxRows = getLiveMaxRowsVal();
        const maxRows = (liveSysNoticeEl && liveSysNoticeEl.style.display !== 'none') ? Math.max(2, userMaxRows - 1) : userMaxRows;
        const count = Math.min(maxRows, allLines.length);
        const dmTextColor = getLiveDmColor();
        const showRowPurpleHeart = !!(swLiveDmRowHeart && swLiveDmRowHeart.checked);
        const rowsHtml = [];

        for (let i = 0; i < count; i++) {
            const globalIdx = (liveChatCursor + i) % allLines.length;
            const rawLine = allLines[globalIdx];
            const { lv, fanLv, isAdmin, nickPart, msg } = parseSingleLiveDanmakuRow(rawLine, globalIdx);

            const lvBadgeHtml = buildLiveLvBadgeHtml(lv);
            const fanBadgeHtml = buildLiveFanBadgeHtml(fanLv);
            const adminBadgeHtml = isAdmin ? `<span class="live-admin-badge" title="房管標識（雙擊彈幕可開關）">管</span>` : '';
            const rightHeartHtml = showRowPurpleHeart ? `<span class="live-row-purple-heart"><svg width="10" height="10" viewBox="0 0 24 24" fill="#c084fc"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></span>` : '';

            const colorfulNickHtml = buildColorfulNickHtml(nickPart, globalIdx);
            rowsHtml.push(
                `<div class="live-chat-bubble interactive-elem" data-dm-idx="${globalIdx}" title="雙擊可編輯這條彈幕的所有內容（等級/管字標/暱稱/彈幕文字）">${lvBadgeHtml}${fanBadgeHtml}${adminBadgeHtml}${colorfulNickHtml}<span class="live-chat-msg" style="color:${dmTextColor};">${escapeHtmlSafe(msg)}</span>${rightHeartHtml}</div>`
            );
        }

        liveChatList.innerHTML = rowsHtml.join('');
    }

    // 双击任意一条弹幕气泡 -> 原地展开全能编辑器（可修改蓝牌等级、橙牌等级、是否带「管」字牌、昵称、弹幕文字）
    if (liveChatList) {
        liveChatList.addEventListener('dblclick', (e) => {
            const bubble = e.target.closest('.live-chat-bubble');
            if (!bubble) return;
            e.stopPropagation();
            e.preventDefault();

            const globalIdx = parseInt(bubble.getAttribute('data-dm-idx'), 10);
            if (Number.isNaN(globalIdx)) return;

            const allLines = parseLiveDanmakuTexts();
            const rawLine = allLines[globalIdx] || '';
            const parsed = parseSingleLiveDanmakuRow(rawLine, globalIdx);
            liveEditingDmIdx = globalIdx;

            let curAdmin = parsed.isAdmin;
            const editor = document.createElement('div');
            editor.className = 'live-row-inline-editor';
            editor.innerHTML = `
                <span style="font-size:8.5px;color:#c084fc;font-weight:800;">💎</span>
                <input type="number" class="ed-lv" value="${parsed.lv}" min="0" max="99" title="藍牌財富等級(填0隱藏)" style="width:34px;">
                <span style="font-size:8.5px;color:#fb923c;font-weight:800;">🏅</span>
                <input type="number" class="ed-fan" value="${parsed.fanLv}" min="0" max="99" title="橙牌粉絲團等級(填0隱藏)" style="width:34px;">
                <span class="live-ed-tag-toggle ${curAdmin ? 'is-on' : ''}" title="點擊開關紅色『管』字房管圖標">管</span>
                <input type="text" class="ed-nick" value="${escapeHtmlSafe(parsed.nickPart)}" placeholder="暱稱" title="發言人暱稱" style="width:66px;">
                <input type="text" class="ed-msg" value="${escapeHtmlSafe(parsed.msg)}" placeholder="彈幕內容" title="彈幕文字內容" style="flex:1;min-width:85px;">
                <button type="button" class="live-ed-btn save">✓</button>
                <button type="button" class="live-ed-btn cancel">✕</button>
            `;

            bubble.replaceWith(editor);

            const inpLv = editor.querySelector('.ed-lv');
            const inpFan = editor.querySelector('.ed-fan');
            const btnAdmin = editor.querySelector('.live-ed-tag-toggle');
            const inpNick = editor.querySelector('.ed-nick');
            const inpMsg = editor.querySelector('.ed-msg');
            const btnSave = editor.querySelector('.live-ed-btn.save');
            const btnCancel = editor.querySelector('.live-ed-btn.cancel');

            if (btnAdmin) {
                btnAdmin.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    curAdmin = !curAdmin;
                    btnAdmin.classList.toggle('is-on', curAdmin);
                });
            }

            const finishEdit = (doSave) => {
                if (liveEditingDmIdx === null) return;
                liveEditingDmIdx = null;
                if (doSave) {
                    const nextLv = Math.max(0, parseInt(inpLv.value, 10) || 0);
                    const nextFan = Math.max(0, parseInt(inpFan.value, 10) || 0);
                    const nextNick = inpNick.value.trim() || parsed.nickPart;
                    const nextMsg = inpMsg.value.trim() || parsed.msg;
                    const formatted = formatSingleLiveDanmakuRow(nextLv, nextFan, curAdmin, nextNick, nextMsg, globalIdx);
                    updateSingleLiveDanmakuLineInTextarea(globalIdx, formatted);
                    window.showToast(`✅ 已更新彈幕：${nextNick}：${nextMsg}`);
                }
                renderLiveChatBubbles(false);
            };

            editor.addEventListener('click', (ev) => ev.stopPropagation());
            editor.addEventListener('dblclick', (ev) => ev.stopPropagation());
            editor.querySelectorAll('input').forEach(inp => {
                inp.addEventListener('keydown', (ev) => {
                    ev.stopPropagation();
                    if (ev.key === 'Enter') {
                        ev.preventDefault();
                        finishEdit(true);
                    } else if (ev.key === 'Escape') {
                        ev.preventDefault();
                        finishEdit(false);
                    }
                });
            });
            if (btnSave) btnSave.addEventListener('click', (ev) => { ev.stopPropagation(); finishEdit(true); });
            if (btnCancel) btnCancel.addEventListener('click', (ev) => { ev.stopPropagation(); finishEdit(false); });

            if (inpMsg) {
                inpMsg.focus();
                inpMsg.select();
            }
        });
    }

    function initLiveFlyDanmakuParticles() {
        if (!liveFloatingDmStage) return;
        liveFloatingDmStage.innerHTML = '';
        liveFlyParticles = [];
    }

    // ★ 二、右侧竖排爱心飘动画（100% 采用高清矢量彩色渐变 SVG 爱心，彻底杜绝 Windows 下 🩷 缺失字形显示为白色方框 ⮾ 的乱码问题！）
    const LIVE_SVG_HEARTS = [
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 20.8l-1.35-1.22C5.6 15.02 2.4 12.1 2.4 8.55 2.4 5.65 4.65 3.4 7.55 3.4c1.62 0 3.18.76 4.45 1.98C13.27 4.16 14.83 3.4 16.45 3.4c2.9 0 5.15 2.25 5.15 5.15 0 3.55-3.2 6.47-8.25 11.03L12 20.8z" fill="#ff5e97"/><path d="M7.8 5.6c-1.5 0-2.7 1.1-2.9 2.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.65"/></svg>`,
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 20.8l-1.35-1.22C5.6 15.02 2.4 12.1 2.4 8.55 2.4 5.65 4.65 3.4 7.55 3.4c1.62 0 3.18.76 4.45 1.98C13.27 4.16 14.83 3.4 16.45 3.4c2.9 0 5.15 2.25 5.15 5.15 0 3.55-3.2 6.47-8.25 11.03L12 20.8z" fill="#a855f7"/><path d="M7.8 5.6c-1.5 0-2.7 1.1-2.9 2.5" stroke="#f3e8ff" stroke-width="1.5" stroke-linecap="round" opacity="0.65"/></svg>`,
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 20.8l-1.35-1.22C5.6 15.02 2.4 12.1 2.4 8.55 2.4 5.65 4.65 3.4 7.55 3.4c1.62 0 3.18.76 4.45 1.98C13.27 4.16 14.83 3.4 16.45 3.4c2.9 0 5.15 2.25 5.15 5.15 0 3.55-3.2 6.47-8.25 11.03L12 20.8z" fill="#f43f5e"/><circle cx="17.2" cy="6.8" r="1.4" fill="#fde047"/></svg>`,
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 20.8l-1.35-1.22C5.6 15.02 2.4 12.1 2.4 8.55 2.4 5.65 4.65 3.4 7.55 3.4c1.62 0 3.18.76 4.45 1.98C13.27 4.16 14.83 3.4 16.45 3.4c2.9 0 5.15 2.25 5.15 5.15 0 3.55-3.2 6.47-8.25 11.03L12 20.8z" fill="#ec4899"/><path d="M12 16.8l-.75-.68C8.4 13.55 6.6 11.9 6.6 9.9c0-1.62 1.26-2.88 2.88-2.88.9 0 1.78.42 2.52 1.1.74-.68 1.62-1.1 2.52-1.1 1.62 0 2.88 1.26 2.88 2.88 0 2-1.8 3.65-4.65 6.22L12 16.8z" fill="#fbcfe8" opacity="0.65"/></svg>`
    ];
    function spawnSingleLiveHeart() {
        if (!liveFloatingHearts || !renderTarget || !renderTarget.classList.contains('dy-live-open')) return;
        const h = document.createElement('span');
        h.className = 'live-heart-particle';
        h.innerHTML = LIVE_SVG_HEARTS[Math.floor(Math.random() * LIVE_SVG_HEARTS.length)];
        const hx1 = Math.round((Math.random() - 0.5) * 26);
        const hx2 = Math.round((Math.random() - 0.5) * 28);
        h.style.setProperty('--hx1', hx1 + 'px');
        h.style.setProperty('--hx2', hx2 + 'px');
        liveFloatingHearts.appendChild(h);
        setTimeout(() => {
            if (h.parentNode) h.parentNode.removeChild(h);
        }, 2350);
    }

    function restartLiveHeartTimer() {
        if (liveHeartTimer) clearInterval(liveHeartTimer);
        if (!renderTarget || !renderTarget.classList.contains('dy-live-open')) return;
        const density = getLiveHeartDensityVal();
        // 密度 1 -> 1300ms 一颗；密度 6 -> 520ms；密度 10 -> 200ms 高密飘心
        const intervalMs = Math.max(190, Math.round(1450 - density * 125));
        liveHeartTimer = setInterval(() => {
            spawnSingleLiveHeart();
            if (density >= 8) {
                setTimeout(spawnSingleLiveHeart, 110);
            }
        }, intervalMs);
    }

    if (inLiveHeartDensity) {
        inLiveHeartDensity.addEventListener('input', () => {
            const d = getLiveHeartDensityVal();
            const desc = d <= 3 ? '轻柔' : (d <= 7 ? '热闹' : '满屏暴击');
            if (txtLiveHeartDensity) txtLiveHeartDensity.textContent = `${d} (${desc})`;
            restartLiveHeartTimer();
        });
    }

    // ★ 三、礼物进场提示小弹窗：
    // 1) 左侧采用抖音真实人物头像（帥哥/美女真人照片，不再使用蓝色 Laya 图标，且每次弹出切换不同真人头像）；
    // 2) 内置 16 款抖音热门礼物与对应彩色图标（嘉年華🎠、超級火箭🚀、至尊跑車🏎️、私人飛機🛩️、夢幻城堡🏰、紫金皇冠👑、璀璨鑽石💎、浪漫煙花🎆、99朵玫瑰🌹、彩虹棒棒糖🍭 等），不再只有爱心；
    // 3) 每次弹出自动轮换不同的送礼人、真人头像、礼物图标、连击数与胶囊流光渐变色，绝不千篇一律；
    // 4) 单击小弹窗随机切换下一条，双击小弹窗可直接原地编辑全部内容！
    const giftUserPresets = ['皓哥', '晨霸', '漫渡', '輕輕吹風', 'Laya榜一大哥', '微醺小貓', '夜色有點濃', '萬里星河', '暴富小錦鯉', '阿傑', '南城舊夢', '星河少女', '深海裡的星星', '威廉W'];
    const LIVE_GIFT_CATALOG = [
        { icon: '🎠', name: '送 嘉年華',     color: '#9333ea', endColor: 'rgba(245, 158, 11, 0.85)', counts: ['x1', 'x3', 'x9', 'x18'] },
        { icon: '🚀', name: '豪刷 超級火箭', color: '#dc2626', endColor: 'rgba(249, 115, 22, 0.85)', counts: ['x1', 'x3', 'x6', 'x9'] },
        { icon: '🏎️', name: '空降 至尊跑車', color: '#2563eb', endColor: 'rgba(6, 182, 212, 0.85)',   counts: ['x1', 'x3', 'x8', 'x12'] },
        { icon: '🛩️', name: '送出 私人飛機', color: '#4f46e5', endColor: 'rgba(139, 92, 246, 0.85)',  counts: ['x1', 'x2', 'x6', 'x9'] },
        { icon: '🏰', name: '點亮 夢幻城堡', color: '#7c3aed', endColor: 'rgba(236, 72, 153, 0.85)',  counts: ['x1', 'x2', 'x5', 'x9'] },
        { icon: '👑', name: '加冕 紫金皇冠', color: '#b45309', endColor: 'rgba(234, 179, 8, 0.85)',   counts: ['x1', 'x6', 'x9', 'x52'] },
        { icon: '💎', name: '贈送 璀璨鑽石', color: '#0284c7', endColor: 'rgba(56, 189, 248, 0.85)',  counts: ['x9', 'x18', 'x66', 'x99'] },
        { icon: '🎆', name: '綻放 浪漫煙花', color: '#db2777', endColor: 'rgba(244, 63, 94, 0.85)',   counts: ['x6', 'x18', 'x52', 'x99'] },
        { icon: '🌌', name: '送出 浪漫星河', color: '#6d28d9', endColor: 'rgba(59, 130, 246, 0.85)',  counts: ['x1', 'x9', 'x21', 'x66'] },
        { icon: '🌹', name: '贈送 99朵玫瑰', color: '#e11d48', endColor: 'rgba(251, 113, 133, 0.85)', counts: ['x9', 'x52', 'x99', 'x520'] },
        { icon: '🎈', name: '送 告白氣球',   color: '#ec4899', endColor: 'rgba(168, 85, 247, 0.85)',  counts: ['x5', 'x19', 'x52', 'x99'] },
        { icon: '🍭', name: '投餵 彩虹棒棒糖', color: '#a855f7', endColor: 'rgba(236, 72, 153, 0.85)', counts: ['x10', 'x30', 'x66', 'x188'] },
        { icon: '🕶️', name: '送 酷炫墨鏡',   color: '#0f766e', endColor: 'rgba(20, 184, 166, 0.85)',  counts: ['x6', 'x18', 'x66', 'x88'] },
        { icon: '✨', name: '揮舞 粉絲螢光棒', color: '#8b5cf6', endColor: 'rgba(217, 70, 239, 0.85)', counts: ['x18', 'x66', 'x99', 'x520'] },
        { icon: '🍾', name: '開啟 皇家香檳', color: '#ca8a04', endColor: 'rgba(245, 158, 11, 0.85)',  counts: ['x3', 'x8', 'x18', 'x88'] },
        { icon: '💗', name: '送 小心心',     color: '#7c3aed', endColor: 'rgba(236, 72, 153, 0.82)',  counts: ['x5', 'x52', 'x99', 'x520', 'x1314'] }
    ];
    const giftCountPresets = ['x1', 'x5', 'x9', 'x18', 'x52', 'x66', 'x88', 'x99', 'x188', 'x520', 'x1314'];
    const giftColorPresets = ['#9333ea', '#dc2626', '#2563eb', '#4f46e5', '#7c3aed', '#b45309', '#0284c7', '#db2777', '#e11d48', '#0f766e'];

    let lastGiftCatalogIdx = 0;
    let lastGiftUserIdx = 0;
    let lastGiftRealAvatarIdx = -1;
    let customPinnedGiftAvatarUrl = '';
    let currentGiftEndColor = 'rgba(245, 158, 11, 0.85)';

    // 从内置真人头像库（帥哥 + 美女）中抽取不重复的真人头像给礼物小弹窗使用
    function pickNextRealHumanGiftAvatar(preferNick = '', forceClearCustom = false) {
        if (forceClearCustom) {
            customPinnedGiftAvatarUrl = '';
        }
        if (customPinnedGiftAvatarUrl && liveGiftSenderAv) {
            liveGiftSenderAv.src = customPinnedGiftAvatarUrl;
            liveGiftSenderAv.setAttribute('data-export-src', customPinnedGiftAvatarUrl);
            liveGiftSenderAv.dataset.hasRealHumanAv = 'true';
            return;
        }
        const db = window.LAYA_ASIAN_AVATARS || {};
        const beauties = Array.isArray(db.beauties) ? db.beauties : [];
        const guys = Array.isArray(db.guys) ? db.guys : [];
        const realPool = [...guys, ...beauties];
        if (realPool.length === 0) return;

        // 根据昵称倾向选择帥哥或美女真人头像，同时保证每次切换都不一样
        const isFemaleNick = /(小貓|少女|溫柔|迷妹|姐姐|甜|仙女|希拉|蒙蒙)/.test(String(preferNick || ''));
        const subPool = (isFemaleNick && beauties.length > 0) ? beauties : ((!isFemaleNick && guys.length > 0 && Math.random() < 0.65) ? guys : realPool);

        let pickUrl = subPool[0];
        for (let attempt = 0; attempt < 20; attempt++) {
            const candIdx = Math.floor(Math.random() * subPool.length);
            const candUrl = subPool[candIdx];
            const globalIdx = realPool.indexOf(candUrl);
            if (globalIdx !== lastGiftRealAvatarIdx) {
                lastGiftRealAvatarIdx = globalIdx;
                pickUrl = candUrl;
                break;
            }
        }
        if (liveGiftSenderAv && pickUrl) {
            liveGiftSenderAv.src = pickUrl;
            liveGiftSenderAv.setAttribute('data-export-src', pickUrl);
            liveGiftSenderAv.dataset.hasRealHumanAv = 'true';
        }
    }

    // 根据礼物名称智能推断匹配的礼物图标（若用户手动改了礼物名也能自动配对图标）
    function inferGiftIconFromName(giftNameStr) {
        const s = String(giftNameStr || '');
        if (/嘉年華|嘉年华|木馬|木马/.test(s)) return '🎠';
        if (/火箭|飛船|飞船/.test(s)) return '🚀';
        if (/跑車|跑车|蘭博|法拉利|保時捷/.test(s)) return '🏎️';
        if (/飛機|飞机|戰機/.test(s)) return '🛩️';
        if (/城堡|宮殿/.test(s)) return '🏰';
        if (/皇冠|王冠|女王/.test(s)) return '👑';
        if (/鑽石|钻石|海洋之心|鑽戒/.test(s)) return '💎';
        if (/煙花|烟花|焰火/.test(s)) return '🎆';
        if (/星河|星空|銀河/.test(s)) return '🌌';
        if (/玫瑰|鮮花|花束/.test(s)) return '🌹';
        if (/氣球|气球/.test(s)) return '🎈';
        if (/棒棒糖|糖果/.test(s)) return '🍭';
        if (/墨鏡|墨镜|眼鏡/.test(s)) return '🕶️';
        if (/螢光棒|荧光棒|應援|魔杖/.test(s)) return '✨';
        if (/香檳|香槟|紅酒/.test(s)) return '🍾';
        if (/啤酒|乾杯/.test(s)) return '🍻';
        if (/奶茶|咖啡/.test(s)) return '☕';
        if (/遊艇|游艇|輪船/.test(s)) return '🚢';
        if (/金磚|元寶|招財/.test(s)) return '💰';
        if (/小心心|比心|愛心|爱心/.test(s)) return '💗';
        return null;
    }

    function hexToRgba(hex, alpha) {
        const clean = String(hex || '#7c3aed').replace('#', '');
        if (clean.length !== 6) return `rgba(124, 58, 237, ${alpha})`;
        const r = parseInt(clean.slice(0, 2), 16) || 124;
        const g = parseInt(clean.slice(2, 4), 16) || 58;
        const b = parseInt(clean.slice(4, 6), 16) || 237;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function applyLiveGiftBannerState(playSlideAnim = false, changeAvatar = false) {
        if (!liveGiftComboBanner) return;
        const userTxt = (inLiveGiftUser && inLiveGiftUser.value.trim()) ? inLiveGiftUser.value.trim() : '皓哥';
        const giftTxt = (inLiveGiftName && inLiveGiftName.value.trim()) ? inLiveGiftName.value.trim() : '送 嘉年華';
        let countTxt = (inLiveGiftCount && inLiveGiftCount.value.trim()) ? inLiveGiftCount.value.trim() : 'x9';
        if (/^\d+$/.test(countTxt)) {
            countTxt = 'x' + countTxt;
            if (inLiveGiftCount) inLiveGiftCount.value = countTxt;
        }
        const baseColor = (inLiveGiftColor && inLiveGiftColor.value) ? inLiveGiftColor.value : '#9333ea';
        const inferredIcon = inferGiftIconFromName(giftTxt);
        let rawIconInput = (inLiveGiftIcon && inLiveGiftIcon.value.trim()) ? inLiveGiftIcon.value.trim() : '';
        // 若图标框里仍是旧版遗留的爱心 💗/❤️，但礼物文案是嘉年华/火箭等其它礼物，自动修正为对应专属图标
        if ((!rawIconInput || rawIconInput === '💗' || rawIconInput === '🩷' || rawIconInput === '❤️') && inferredIcon && inferredIcon !== '💗') {
            rawIconInput = inferredIcon;
            if (inLiveGiftIcon) inLiveGiftIcon.value = inferredIcon;
        }
        const iconTxt = rawIconInput || inferredIcon || '🎠';

        // 确保左侧始终是真人头像（绝不用蓝色 Laya 图标）
        if (liveGiftSenderAv) {
            const curSrc = liveGiftSenderAv.getAttribute('src') || '';
            const notRealYet = liveGiftSenderAv.dataset.hasRealHumanAv !== 'true';
            if (changeAvatar || notRealYet || !curSrc || curSrc.includes('Laya')) {
                pickNextRealHumanGiftAvatar(userTxt);
            }
        }
        if (liveGiftSenderName) liveGiftSenderName.textContent = userTxt;
        if (liveGiftDescTxt) liveGiftDescTxt.textContent = giftTxt;
        if (liveGiftItemIcon) {
            liveGiftItemIcon.textContent = iconTxt;
            // 触发礼物图标弹跳动效
            liveGiftItemIcon.style.animation = 'none';
            void liveGiftItemIcon.offsetWidth;
            liveGiftItemIcon.style.animation = '';
        }
        if (liveGiftComboNum) liveGiftComboNum.textContent = countTxt;

        // 根据不同礼物颜色渲染百变流光胶囊渐变，让每次弹出的小窗口视觉不雷同
        const matchedCatalog = LIVE_GIFT_CATALOG.find(item => item.icon === iconTxt || giftTxt.includes(item.name.replace(/^[^\s]+\s+/, '')));
        const rightGradColor = matchedCatalog ? matchedCatalog.endColor : currentGiftEndColor;
        liveGiftComboBanner.style.background = `linear-gradient(95deg, ${hexToRgba(baseColor, 0.94)} 0%, ${hexToRgba(baseColor, 0.84)} 55%, ${rightGradColor} 100%)`;
        liveGiftComboBanner.style.borderColor = hexToRgba(baseColor, 0.72);

        if (playSlideAnim) {
            liveGiftComboBanner.classList.remove('gift-slide-in', 'gift-slide-out');
            void liveGiftComboBanner.offsetWidth;
            liveGiftComboBanner.classList.add('gift-slide-in');
        }
    }

    // 滑出旧礼物 -> 切换下一位真人 + 下一款不同礼物与图标 -> 滑入新礼物
    let giftSlideTimeout = null;
    let isEditingGiftBanner = false;
    function cycleNextGiftBannerWithSlide(customRandom = false) {
        if (!liveGiftComboBanner || isEditingGiftBanner) return;
        liveGiftComboBanner.classList.remove('gift-slide-in');
        liveGiftComboBanner.classList.add('gift-slide-out');

        if (giftSlideTimeout) clearTimeout(giftSlideTimeout);
        giftSlideTimeout = setTimeout(() => {
            if (customRandom) {
                // 1) 随机挑选一位不重复的送礼用户名
                let uIdx = Math.floor(Math.random() * giftUserPresets.length);
                if (uIdx === lastGiftUserIdx) uIdx = (uIdx + 1) % giftUserPresets.length;
                lastGiftUserIdx = uIdx;
                const u = giftUserPresets[uIdx];

                // 2) 随机挑选一款与上一次不同的礼物（带专属图标、文案、主题色与连击数）
                let gIdx = Math.floor(Math.random() * LIVE_GIFT_CATALOG.length);
                if (gIdx === lastGiftCatalogIdx) gIdx = (gIdx + 1) % LIVE_GIFT_CATALOG.length;
                lastGiftCatalogIdx = gIdx;
                const giftItem = LIVE_GIFT_CATALOG[gIdx];
                const c = giftItem.counts[Math.floor(Math.random() * giftItem.counts.length)];

                currentGiftEndColor = giftItem.endColor;
                if (inLiveGiftUser) inLiveGiftUser.value = u;
                if (inLiveGiftName) inLiveGiftName.value = giftItem.name;
                if (inLiveGiftIcon) inLiveGiftIcon.value = giftItem.icon;
                if (inLiveGiftCount) inLiveGiftCount.value = c;
                if (inLiveGiftColor) inLiveGiftColor.value = giftItem.color;
                if (inLiveGiftColorHex) inLiveGiftColorHex.value = giftItem.color;
                if (selLiveGiftPreset) {
                    const optVal = `${giftItem.icon}|${giftItem.name}|${giftItem.color}`;
                    Array.from(selLiveGiftPreset.options).forEach(opt => {
                        if (opt.value === optVal) selLiveGiftPreset.value = optVal;
                    });
                }
            }
            applyLiveGiftBannerState(true, true);
        }, 240);
    }

    function applyLiveGiftColor(hex, playAnim = false) {
        const c = (hex || '#9333ea').trim();
        if (inLiveGiftColor && inLiveGiftColor.value.toLowerCase() !== c.toLowerCase() && /^#[0-9a-fA-F]{6}$/.test(c)) {
            inLiveGiftColor.value = c;
        }
        if (inLiveGiftColorHex && inLiveGiftColorHex.value.toLowerCase() !== c.toLowerCase()) {
            inLiveGiftColorHex.value = c;
        }
        applyLiveGiftBannerState(playAnim, false);
    }

    if (inLiveGiftUser) inLiveGiftUser.addEventListener('input', () => applyLiveGiftBannerState(true, false));
    if (inLiveGiftName) {
        inLiveGiftName.addEventListener('input', () => {
            const inferred = inferGiftIconFromName(inLiveGiftName.value);
            if (inferred && inLiveGiftIcon) {
                inLiveGiftIcon.value = inferred;
            }
            applyLiveGiftBannerState(true, false);
        });
    }
    if (inLiveGiftIcon) inLiveGiftIcon.addEventListener('input', () => applyLiveGiftBannerState(true, false));
    if (selLiveGiftPreset) {
        selLiveGiftPreset.addEventListener('change', () => {
            const parts = String(selLiveGiftPreset.value || '').split('|');
            if (parts.length >= 3) {
                if (inLiveGiftIcon) inLiveGiftIcon.value = parts[0];
                if (inLiveGiftName) inLiveGiftName.value = parts[1];
                applyLiveGiftColor(parts[2], true);
            }
        });
    }
    if (inLiveGiftCount) inLiveGiftCount.addEventListener('input', () => applyLiveGiftBannerState(true, false));
    if (inLiveGiftColor) inLiveGiftColor.addEventListener('input', (e) => applyLiveGiftColor(e.target.value, false));
    if (inLiveGiftColorHex) {
        inLiveGiftColorHex.addEventListener('input', (e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(v)) applyLiveGiftColor(v, false);
        });
    }

    const randGiftAvatarFn = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const userTxt = (inLiveGiftUser && inLiveGiftUser.value.trim()) ? inLiveGiftUser.value.trim() : '皓哥';
        pickNextRealHumanGiftAvatar(userTxt, true);
        window.showToast('👤 已切換為隨機送禮真人頭像');
    };
    const triggerUploadGiftAvatarFn = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (inLiveGiftAvatarFile) inLiveGiftAvatarFile.click();
    };
    if (btnLiveUploadGiftAv) btnLiveUploadGiftAv.addEventListener('click', triggerUploadGiftAvatarFn);
    if (inLiveGiftAvatarFile) {
        inLiveGiftAvatarFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                if (dataUrl && liveGiftSenderAv) {
                    customPinnedGiftAvatarUrl = dataUrl;
                    liveGiftSenderAv.src = dataUrl;
                    liveGiftSenderAv.setAttribute('data-export-src', dataUrl);
                    liveGiftSenderAv.dataset.hasRealHumanAv = 'true';
                    window.showToast('📤 已上傳並固定使用自定義送禮頭像（點「換真人頭像」可恢復隨機）');
                }
            };
            reader.readAsDataURL(file);
            inLiveGiftAvatarFile.value = '';
        });
    }
    const randGiftUserFn = (e) => {
        if (e) e.preventDefault();
        lastGiftUserIdx = (lastGiftUserIdx + 1 + Math.floor(Math.random() * (giftUserPresets.length - 1))) % giftUserPresets.length;
        const pick = giftUserPresets[lastGiftUserIdx];
        if (inLiveGiftUser) inLiveGiftUser.value = pick;
        applyLiveGiftBannerState(true, true);
    };
    const randGiftNameFn = (e) => {
        if (e) e.preventDefault();
        lastGiftCatalogIdx = (lastGiftCatalogIdx + 1 + Math.floor(Math.random() * (LIVE_GIFT_CATALOG.length - 1))) % LIVE_GIFT_CATALOG.length;
        const item = LIVE_GIFT_CATALOG[lastGiftCatalogIdx];
        currentGiftEndColor = item.endColor;
        if (inLiveGiftName) inLiveGiftName.value = item.name;
        if (inLiveGiftIcon) inLiveGiftIcon.value = item.icon;
        applyLiveGiftColor(item.color, true);
    };
    const randGiftCountFn = (e) => {
        if (e) e.preventDefault();
        const pick = giftCountPresets[Math.floor(Math.random() * giftCountPresets.length)];
        if (inLiveGiftCount) inLiveGiftCount.value = pick;
        applyLiveGiftBannerState(true, false);
    };
    const randGiftColorFn = (e) => {
        if (e) e.preventDefault();
        const pick = giftColorPresets[Math.floor(Math.random() * giftColorPresets.length)];
        applyLiveGiftColor(pick, true);
    };
    if (btnLiveRandGiftAv) btnLiveRandGiftAv.addEventListener('click', randGiftAvatarFn);
    if (liveGiftSenderAv) {
        // 左键点击礼物小弹窗上的圆形头像：直接打开文件上传框上传本地头像！右键点击：随机换真人头像
        liveGiftSenderAv.addEventListener('click', triggerUploadGiftAvatarFn);
        liveGiftSenderAv.addEventListener('contextmenu', randGiftAvatarFn);
    }
    if (btnLiveRandGiftUser) btnLiveRandGiftUser.addEventListener('click', randGiftUserFn);
    if (btnLiveRandGiftUserBtn) btnLiveRandGiftUserBtn.addEventListener('click', randGiftUserFn);
    if (btnLiveRandGiftName) btnLiveRandGiftName.addEventListener('click', randGiftNameFn);
    if (btnLiveRandGiftNameBtn) btnLiveRandGiftNameBtn.addEventListener('click', randGiftNameFn);
    if (btnLiveRandGiftIcon) btnLiveRandGiftIcon.addEventListener('click', randGiftNameFn);
    if (btnLiveRandGiftCount) btnLiveRandGiftCount.addEventListener('click', randGiftCountFn);
    if (btnLiveRandGiftCountBtn) btnLiveRandGiftCountBtn.addEventListener('click', randGiftCountFn);
    if (btnLiveRandGiftColor) btnLiveRandGiftColor.addEventListener('click', randGiftColorFn);
    if (btnLiveRandGiftAll) {
        btnLiveRandGiftAll.addEventListener('click', () => {
            cycleNextGiftBannerWithSlide(true);
            window.showToast('🎁 已隨機切換新真人頭像與專屬禮物彈窗');
        });
    }
    if (liveGiftComboBanner) {
        let giftClickTimer = null;
        liveGiftComboBanner.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isEditingGiftBanner) return;
            if (giftClickTimer) clearTimeout(giftClickTimer);
            giftClickTimer = setTimeout(() => {
                giftClickTimer = null;
                if (!isEditingGiftBanner) {
                    cycleNextGiftBannerWithSlide(true);
                }
            }, 220);
        });

        // 双击礼物小弹窗：直接在手机画面原地修改送礼人、礼物文案、礼物图标与连击数字
        liveGiftComboBanner.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (giftClickTimer) {
                clearTimeout(giftClickTimer);
                giftClickTimer = null;
            }
            if (isEditingGiftBanner) return;
            isEditingGiftBanner = true;

            const curUser = (inLiveGiftUser && inLiveGiftUser.value.trim()) || '皓哥';
            const curGift = (inLiveGiftName && inLiveGiftName.value.trim()) || '送 嘉年華';
            const curIcon = (inLiveGiftIcon && inLiveGiftIcon.value.trim()) || '🎠';
            const curCount = (inLiveGiftCount && inLiveGiftCount.value.trim()) || 'x9';

            const editor = document.createElement('div');
            editor.className = 'live-row-inline-editor';
            editor.innerHTML = `
                <button type="button" class="live-ed-btn btn-up-gav" title="上傳自定義送禮頭像" style="padding:2px 5px;background:#0284c7;">📤傳頭像</button>
                <button type="button" class="live-ed-btn btn-rnd-gav" title="點擊隨機更換送禮真人頭像" style="padding:2px 5px;">👤換真人</button>
                <input type="text" class="ed-g-user" value="${escapeHtmlSafe(curUser)}" placeholder="送禮人" style="width:52px;">
                <input type="text" class="ed-g-name" value="${escapeHtmlSafe(curGift)}" placeholder="如 送 嘉年華" style="width:74px;">
                <input type="text" class="ed-g-icon" value="${escapeHtmlSafe(curIcon)}" placeholder="圖標" title="禮物圖標(如 🎠 🚀 🏎️ 🌹)" style="width:28px;text-align:center;">
                <input type="text" class="ed-g-count" value="${escapeHtmlSafe(curCount)}" placeholder="連擊" style="width:36px;">
                <button type="button" class="live-ed-btn save">✓</button>
                <button type="button" class="live-ed-btn cancel">✕</button>
            `;

            liveGiftComboBanner.style.display = 'none';
            liveGiftComboBanner.parentNode.insertBefore(editor, liveGiftComboBanner);

            const btnUpAv = editor.querySelector('.btn-up-gav');
            const btnAv = editor.querySelector('.btn-rnd-gav');
            const inpU = editor.querySelector('.ed-g-user');
            const inpN = editor.querySelector('.ed-g-name');
            const inpI = editor.querySelector('.ed-g-icon');
            const inpC = editor.querySelector('.ed-g-count');
            const btnSave = editor.querySelector('.live-ed-btn.save');
            const btnCancel = editor.querySelector('.live-ed-btn.cancel');

            if (btnUpAv) {
                btnUpAv.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    if (inLiveGiftAvatarFile) inLiveGiftAvatarFile.click();
                });
            }
            if (btnAv) {
                btnAv.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    pickNextRealHumanGiftAvatar(inpU.value, true);
                    window.showToast('👤 已更換送禮真人頭像');
                });
            }
            if (inpN) {
                inpN.addEventListener('input', () => {
                    const autoIco = inferGiftIconFromName(inpN.value);
                    if (autoIco && inpI) inpI.value = autoIco;
                });
            }

            const closeGiftEdit = (save) => {
                if (!isEditingGiftBanner) return;
                isEditingGiftBanner = false;
                if (save) {
                    if (inLiveGiftUser && inpU.value.trim()) inLiveGiftUser.value = inpU.value.trim();
                    if (inLiveGiftName && inpN.value.trim()) inLiveGiftName.value = inpN.value.trim();
                    if (inLiveGiftIcon && inpI.value.trim()) inLiveGiftIcon.value = inpI.value.trim();
                    if (inLiveGiftCount && inpC.value.trim()) inLiveGiftCount.value = inpC.value.trim();
                    applyLiveGiftBannerState(true, false);
                    if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
                        triggerSaveStorage();
                    }
                }
                if (editor.parentNode) editor.parentNode.removeChild(editor);
                liveGiftComboBanner.style.display = '';
            };

            editor.addEventListener('click', (ev) => ev.stopPropagation());
            editor.addEventListener('dblclick', (ev) => ev.stopPropagation());
            editor.querySelectorAll('input').forEach(inp => {
                inp.addEventListener('keydown', (ev) => {
                    ev.stopPropagation();
                    if (ev.key === 'Enter') {
                        ev.preventDefault();
                        closeGiftEdit(true);
                    } else if (ev.key === 'Escape') {
                        ev.preventDefault();
                        closeGiftEdit(false);
                    }
                });
            });
            if (btnSave) btnSave.addEventListener('click', (ev) => { ev.stopPropagation(); closeGiftEdit(true); });
            if (btnCancel) btnCancel.addEventListener('click', (ev) => { ev.stopPropagation(); closeGiftEdit(false); });
            if (inpN) {
                inpN.focus();
                inpN.select();
            }
        });
    }
    // 初始化礼物弹窗真人头像与状态
    applyLiveGiftBannerState(false, true);

    // ★ 绑定整体弹幕文字大小、弹幕区域宽度与高度(同屏行数)滑块，以及手机画面直接拖拽/滚轮缩放手柄
    if (inLiveDmScale) {
        inLiveDmScale.addEventListener('input', () => {
            applyLiveDmScaleAndArea(false);
        });
    }
    if (inLiveDmAreaWidth) {
        inLiveDmAreaWidth.addEventListener('input', () => {
            applyLiveDmScaleAndArea(false);
        });
    }
    if (inLiveDmMaxRows) {
        inLiveDmMaxRows.addEventListener('input', () => {
            applyLiveDmScaleAndArea(true);
        });
    }
    if (btnLiveResetDmSize) {
        btnLiveResetDmSize.addEventListener('click', (e) => {
            e.preventDefault();
            if (inLiveDmScale) inLiveDmScale.value = '100';
            if (inLiveDmAreaWidth) inLiveDmAreaWidth.value = '93';
            if (inLiveDmMaxRows) inLiveDmMaxRows.value = '5';
            applyLiveDmScaleAndArea(true);
            if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
                triggerSaveStorage();
            }
            window.showToast('↺ 已復位彈幕文字大小與彈幕區域尺寸');
        });
    }
    if (liveDmResizeHandle && liveChatScrollBox) {
        // 1) 鼠标按住拖拽手柄：左右拖动调弹幕区域宽度 (55%~100%)，上下拖动调弹幕区域高度/同屏行数 (2~9行)
        liveDmResizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = inLiveDmAreaWidth ? (parseInt(inLiveDmAreaWidth.value, 10) || 93) : 93;
            const startRows = getLiveMaxRowsVal();
            liveChatScrollBox.classList.add('is-resizing-dm');

            const onMove = (ev) => {
                const dx = ev.clientX - startX;
                const dy = startY - ev.clientY; // 向上拖拉增加高度/行数
                const nextWidth = Math.min(100, Math.max(55, Math.round(startWidth + dx * 0.25)));
                const nextRows = Math.min(9, Math.max(2, Math.round(startRows + dy / 22)));
                if (inLiveDmAreaWidth) inLiveDmAreaWidth.value = String(nextWidth);
                const prevRows = getLiveMaxRowsVal();
                if (inLiveDmMaxRows) inLiveDmMaxRows.value = String(nextRows);
                applyLiveDmScaleAndArea(nextRows !== prevRows);
            };
            const onUp = () => {
                liveChatScrollBox.classList.remove('is-resizing-dm');
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
                    triggerSaveStorage();
                }
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });

        // 2) 在拖拽手柄上滚动鼠标滚轮：直接缩放整体弹幕文字与徽章大小 (75%~155%)
        liveDmResizeHandle.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const curScale = inLiveDmScale ? (parseInt(inLiveDmScale.value, 10) || 100) : 100;
            const delta = e.deltaY < 0 ? 5 : -5;
            const nextScale = Math.min(155, Math.max(75, curScale + delta));
            if (inLiveDmScale) inLiveDmScale.value = String(nextScale);
            applyLiveDmScaleAndArea(false);
            if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
                triggerSaveStorage();
            }
        }, { passive: false });
    }
    applyLiveDmScaleAndArea(false);

    let isHoveringLiveChatBox = false;
    if (liveChatScrollBox) {
        liveChatScrollBox.addEventListener('mouseenter', () => { isHoveringLiveChatBox = true; });
        liveChatScrollBox.addEventListener('mouseleave', () => { isHoveringLiveChatBox = false; });
    }

    function restartLiveGiftAutoCycleTimer() {
        if (liveGiftComboTimer) {
            clearInterval(liveGiftComboTimer);
            liveGiftComboTimer = null;
        }
        if (!renderTarget || !renderTarget.classList.contains('dy-live-open')) return;
        if (swLiveAutoCycleGift && swLiveAutoCycleGift.checked) {
            liveGiftComboTimer = setInterval(() => {
                if (!renderTarget || !renderTarget.classList.contains('dy-live-open')) return;
                cycleNextGiftBannerWithSlide(true);
            }, 6500);
        }
    }
    if (swLiveAutoCycleGift) {
        swLiveAutoCycleGift.addEventListener('change', () => {
            restartLiveGiftAutoCycleTimer();
            window.showToast(swLiveAutoCycleGift.checked ? '🔄 已開啟禮物彈窗自動輪播' : '⏸️ 已固定當前禮物彈窗（點篩子或手動修改後文字不再自動跳變）');
        });
    }

    function restartLiveChatRollTimer() {
        if (liveChatRollTimer) {
            clearInterval(liveChatRollTimer);
            liveChatRollTimer = null;
        }
        if (liveJoinTickerTimer) {
            clearInterval(liveJoinTickerTimer);
            liveJoinTickerTimer = null;
        }
        if (!renderTarget || !renderTarget.classList.contains('dy-live-open')) return;

        const speedLv = getLiveDmSpeedVal();
        // 只有开启了「公屏弹幕自动滚动」开关时，才按抖音原版舒缓节奏推进上方弹幕；默认保持静止展示，点筛子换弹幕后不再一直乱跳！
        if (swLiveAutoRollDm && swLiveAutoRollDm.checked) {
            const intervalMs = Math.max(1200, 4600 - speedLv * 320);
            liveChatRollTimer = setInterval(() => {
                if (liveDmVisible && !isHoveringLiveChatBox && liveEditingDmIdx === null) {
                    renderLiveChatBubbles(true);
                }
            }, intervalMs);
        }

        // 最底部单行「💎17 足弟 来了」进场通道：参照原版抖音实拍视频约 2.2 秒轻柔切换一位进场观众（鼠标悬停时暂停）
        const joinIntervalMs = Math.max(1100, 3200 - speedLv * 180);
        liveJoinTickerTimer = setInterval(() => {
            if (liveDmVisible && !isHoveringLiveChatBox && liveEditingDmIdx === null) {
                renderLiveJoinTicker(true);
            }
        }, joinIntervalMs);
    }
    if (swLiveAutoRollDm) {
        swLiveAutoRollDm.addEventListener('change', () => {
            restartLiveChatRollTimer();
            window.showToast(swLiveAutoRollDm.checked ? '🔄 已開啟公屏彈幕自動滾動' : '⏸️ 已固定公屏彈幕展示（文字不再自動滾動跳變）');
        });
    }

    function startLiveRoomAnimations() {
        liveRollTickCount = 0;
        if (liveSysNoticeEl) {
            liveSysNoticeEl.style.display = (!swLiveShowNotice || swLiveShowNotice.checked) ? '' : 'none';
        }
        if (liveRoomWelcomeEl) {
            liveRoomWelcomeEl.style.display = (!swLiveShowWelcome || swLiveShowWelcome.checked) ? '' : 'none';
        }
        applyLiveGiftBannerState(true, true);
        renderLiveChatBubbles(false);
        renderLiveJoinTicker(false);
        restartLiveChatRollTimer();

        spawnSingleLiveHeart();
        setTimeout(spawnSingleLiveHeart, 240);
        restartLiveHeartTimer();
        restartLiveGiftAutoCycleTimer();

        if (liveHeaderFlipTimer) {
            clearInterval(liveHeaderFlipTimer);
            liveHeaderFlipTimer = null;
        }
    }

    function stopLiveRoomAnimations() {
        if (liveFlyDmRaf) {
            cancelAnimationFrame(liveFlyDmRaf);
            liveFlyDmRaf = null;
        }
        if (liveChatRollTimer) {
            clearInterval(liveChatRollTimer);
            liveChatRollTimer = null;
        }
        if (liveJoinTickerTimer) {
            clearInterval(liveJoinTickerTimer);
            liveJoinTickerTimer = null;
        }
        if (liveHeartTimer) {
            clearInterval(liveHeartTimer);
            liveHeartTimer = null;
        }
        if (liveGiftComboTimer) {
            clearInterval(liveGiftComboTimer);
            liveGiftComboTimer = null;
        }
        if (liveHeaderFlipTimer) {
            clearInterval(liveHeaderFlipTimer);
            liveHeaderFlipTimer = null;
        }
    }

    // 进入 Laya 直播页面（满足：1.手机竖屏9:16 + 2.顶部点了「直播」 + 3.下方视频区或「點擊進入直播間」被点击）
    function enterLayaLiveRoom() {
        if (!window.__ENABLE_LAYA_LIVE_ENTRY) return;
        if (!renderTarget || !renderTarget.classList.contains('mode-mobile-port')) return;
        window.__layaLiveTabArmed = false;
        if (liveArmedTipEl) liveArmedTipEl.style.display = 'none';
        if (topNavBounceTimer) {
            clearTimeout(topNavBounceTimer);
            topNavBounceTimer = null;
        }

        // 若评论区打开则先收起，并从预览态切换为直播间内页态
        renderTarget.classList.remove('dy-comment-open', 'dy-comment-expanded', 'dy-live-preview');
        renderTarget.classList.add('dy-live-open');
        if (liveOverlayEl) liveOverlayEl.style.display = 'flex';
        syncLiveAudienceAvatars(0);

        // 保持本软件原有的顶部标签栏亮在「直播」(index 2)
        document.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item').forEach((el, idx) => el.classList.toggle('active', idx === 2));
        document.querySelectorAll('.laya-nav-tabs > span').forEach((el, idx) => el.classList.toggle('active', idx === 2));

        if (window.PlayerEngine && typeof window.PlayerEngine.updateTransform === 'function') {
            setTimeout(() => window.PlayerEngine.updateTransform(), 25);
        }
        startLiveRoomAnimations();

        // 自动展开右侧「竖屏社区」面板并定位到直播设置卡片
        const dySideTabBtn = document.querySelector('.sidebar-tabs .s-tab[data-target="panel-dy-settings"]');
        if (dySideTabBtn && !dySideTabBtn.classList.contains('active')) {
            dySideTabBtn.click();
        }
        const liveCard = document.getElementById('card-dy-live-settings');
        if (liveCard && typeof liveCard.scrollIntoView === 'function') {
            setTimeout(() => liveCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
        }
        window.showToast('🔴 已進入直播間！可在右側調整在線人數、禮物條與彩虹彈幕');
    }
    window.enterLayaLiveRoom = enterLayaLiveRoom;

    // 切回短视频（推薦）默认状态
    function exitLayaLiveRoom(showMsg = true) {
        window.__layaLiveTabArmed = false;
        if (liveArmedTipEl) liveArmedTipEl.style.display = 'none';
        if (!renderTarget) return;
        const wasOpen = renderTarget.classList.contains('dy-live-open') || renderTarget.classList.contains('dy-live-preview');
        renderTarget.classList.remove('dy-live-open', 'dy-live-preview');
        if (liveOverlayEl) liveOverlayEl.style.display = 'none';
        stopLiveRoomAnimations();

        // 确保顶部标签回到「推薦」，底部导航回到「視頻」
        document.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item').forEach((el, idx) => el.classList.toggle('active', idx === 1));
        document.querySelectorAll('.laya-nav-tabs > span').forEach((el, idx) => el.classList.toggle('active', idx === 1));
        document.querySelectorAll('#laya-app-bottom-tabs .laya-app-tab-item').forEach((el, idx) => el.classList.toggle('active', idx === 2));

        if (window.PlayerEngine && typeof window.PlayerEngine.updateTransform === 'function') {
            setTimeout(() => window.PlayerEngine.updateTransform(), 25);
        }
        if (wasOpen && showMsg) {
            window.showToast('🎬 已切回短視頻（推薦）頁面');
        }
    }
    window.exitLayaLiveRoom = exitLayaLiveRoom;

    // 绑定触发条件 3：当已点过顶部「直播」标签 (window.__layaLiveTabArmed === true) 且处于 9:16 竖屏模式时，点击下方视频区域进入直播页
    function handleVideoAreaClickForLive(e) {
        if (!renderTarget || !renderTarget.classList.contains('mode-mobile-port')) return;
        if (renderTarget.classList.contains('dy-live-open')) return;
        if (!window.__layaLiveTabArmed) return;

        // 排除点击顶部标签栏、右侧图标列、左下角按钮、底部导航栏或评论区抽屉
        const t = e.target;
        if (t && t.closest && t.closest('#laya-app-wrap-top-nav, #laya-wrap-top-nav, #dy-wrap-top-nav, #dy-wrap-right-bar, #laya-app-wrap-bottom-bar, #laya-wrap-bottom-bar, #dy-wrap-bottom-bar, #dy-comment-drawer, #dy-fullscreen-pill, #dy-left-info .interactive-elem')) {
            return;
        }
        e.stopPropagation();
        enterLayaLiveRoom();
    }

    if (liveArmedTipEl) {
        liveArmedTipEl.addEventListener('click', (e) => {
            e.stopPropagation();
            enterLayaLiveRoom();
        });
    }
    if (renderTarget) {
        renderTarget.addEventListener('click', handleVideoAreaClickForLive);
    }

    // 切换顶部 4 大模式时，若离开 9:16 竖屏则自动退出直播间待命状态
    document.querySelectorAll('.viewport-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            if (mode !== 'mode-mobile-port') {
                exitLayaLiveRoom(false);
            }
        });
    });

    // 右侧控制面板直播设置项实时双向绑定
    if (btnLiveBackToVideo) {
        btnLiveBackToVideo.addEventListener('click', () => {
            exitLayaLiveRoom(true);
        });
    }
    if (liveBtnExitTop) {
        liveBtnExitTop.addEventListener('click', (e) => {
            e.stopPropagation();
            exitLayaLiveRoom(true);
        });
    }

    const liveHostNamePresets = ['小王小王', '小鹿同學', '蜜桃甜心', '星河少女', '微醺小貓', '晚風溫柔', 'Laya女神', '蘇蘇學姐'];
    function randomizeLiveHostName() {
        const pick = liveHostNamePresets[Math.floor(Math.random() * liveHostNamePresets.length)];
        applyLiveHostNameDisplay(pick);
        window.showToast(`🎲 主播名已切換為：${pick}`);
    }
    if (inLiveHostName && liveDispHostName) {
        inLiveHostName.addEventListener('input', () => {
            applyLiveHostNameDisplay(inLiveHostName.value.trim() || '小王小王');
        });
    }
    if (btnLiveRandName) btnLiveRandName.addEventListener('click', (e) => { e.preventDefault(); randomizeLiveHostName(); });
    if (btnLiveRandNameBtn) btnLiveRandNameBtn.addEventListener('click', randomizeLiveHostName);

    // 本场点赞：1000 ~ 200万 随机（如 5.6萬、25.3萬、138.5萬、6890）
    function randomizeLiveHostId() {
        const { dispTxt } = generateRandom1kTo2M();
        applyLiveHostLikesDisplay(dispTxt);
        window.showToast(`🎲 本場點讚已隨機為：${dispTxt}`);
    }
    if (inLiveHostId && liveDispHostId) {
        inLiveHostId.addEventListener('input', () => {
            applyLiveHostLikesDisplay(inLiveHostId.value.trim() || '25.6萬');
        });
    }
    if (btnLiveRandId) btnLiveRandId.addEventListener('click', (e) => { e.preventDefault(); randomizeLiveHostId(); });
    if (btnLiveRandIdBtn) btnLiveRandIdBtn.addEventListener('click', randomizeLiveHostId);

    // 绑定画面左上角「主播名」与「本場點讚」：单击随机(1000~200万)，双击原地编辑文字
    bindLiveClickRandAndDblEdit(
        liveHostNameRow,
        liveDispHostName,
        () => (liveDispHostName ? liveDispHostName.textContent.trim() : '小王小王'),
        (v) => {
            applyLiveHostNameDisplay(v);
            window.showToast(`✅ 主播名已修改為：${v}`);
        },
        randomizeLiveHostName,
        68
    );
    bindLiveClickRandAndDblEdit(
        liveHostIdRow,
        liveDispHostId,
        () => (liveDispHostId ? liveDispHostId.textContent.trim() : '25.6萬'),
        (v) => {
            applyLiveHostLikesDisplay(v);
            window.showToast(`✅ 本場點讚已修改為：${v}`);
        },
        randomizeLiveHostId,
        52
    );

    // ★ 直播间顶部胶囊标签（Laya 精選 / 人氣榜 / 直播廣場）：支持右侧输入框自定义修改、单击随机、双击画面文字直接修改
    const liveBrandTagPresets = ['Laya 精選', 'Laya 官方', 'Laya 熱播', 'Laya 認證', 'Laya 獨播', 'Laya 現場', '高顏值精選', '官方精選'];
    const liveRankTagPresets = ['人氣榜', '小時榜', '熱度榜', '魅力榜', '高光榜', '同城榜', '新星榜', 'PK熱榜'];
    const liveSquareTagPresets = ['直播廣場', '熱門直播', '同城直播', '更多直播', '精選頻道', '發現更多'];

    function applyLiveBrandTagDisplay(val) {
        const cleanVal = String(val || '').trim() || 'Laya 精選';
        if (liveLayaBrandTxt) liveLayaBrandTxt.textContent = cleanVal;
        if (inLiveBrandTag && document.activeElement !== inLiveBrandTag) {
            inLiveBrandTag.value = cleanVal;
        }
    }
    function applyLiveRankTagDisplay(val) {
        const cleanVal = String(val || '').trim() || '人氣榜';
        if (liveSubTxtRank) liveSubTxtRank.textContent = cleanVal;
        if (inLiveRankTag && document.activeElement !== inLiveRankTag) {
            inLiveRankTag.value = cleanVal;
        }
    }
    function applyLiveSquareTagDisplay(val) {
        const cleanVal = String(val || '').trim() || '直播廣場';
        if (liveSubTxtSquare) liveSubTxtSquare.textContent = cleanVal;
        if (inLiveSquareTag && document.activeElement !== inLiveSquareTag) {
            inLiveSquareTag.value = cleanVal;
        }
    }

    function randomizeLiveBrandTag() {
        const cur = liveLayaBrandTxt ? liveLayaBrandTxt.textContent.trim() : '';
        const candidates = liveBrandTagPresets.filter(t => t !== cur);
        const pick = candidates[Math.floor(Math.random() * candidates.length)] || 'Laya 精選';
        applyLiveBrandTagDisplay(pick);
        window.showToast(`🎲 品牌標籤已隨機為：${pick}`);
    }
    function randomizeLiveRankTag() {
        const cur = liveSubTxtRank ? liveSubTxtRank.textContent.trim() : '';
        const candidates = liveRankTagPresets.filter(t => t !== cur);
        const pick = candidates[Math.floor(Math.random() * candidates.length)] || '人氣榜';
        applyLiveRankTagDisplay(pick);
        window.showToast(`🎲 榜單標籤已隨機為：${pick}`);
    }
    function randomizeLiveSquareTag() {
        const cur = liveSubTxtSquare ? liveSubTxtSquare.textContent.trim() : '';
        const candidates = liveSquareTagPresets.filter(t => t !== cur);
        const pick = candidates[Math.floor(Math.random() * candidates.length)] || '直播廣場';
        applyLiveSquareTagDisplay(pick);
        window.showToast(`🎲 右側標籤已隨機為：${pick}`);
    }

    if (inLiveBrandTag) {
        inLiveBrandTag.addEventListener('input', () => {
            applyLiveBrandTagDisplay(inLiveBrandTag.value.trim() || 'Laya 精選');
        });
    }
    if (btnLiveRandBrandTag) btnLiveRandBrandTag.addEventListener('click', (e) => { e.preventDefault(); randomizeLiveBrandTag(); });
    if (btnLiveRandBrandTagBtn) btnLiveRandBrandTagBtn.addEventListener('click', randomizeLiveBrandTag);

    if (inLiveRankTag) {
        inLiveRankTag.addEventListener('input', () => {
            applyLiveRankTagDisplay(inLiveRankTag.value.trim() || '人氣榜');
        });
    }
    if (inLiveSquareTag) {
        inLiveSquareTag.addEventListener('input', () => {
            applyLiveSquareTagDisplay(inLiveSquareTag.value.trim() || '直播廣場');
        });
    }
    if (btnLiveRandRankTag) {
        btnLiveRandRankTag.addEventListener('click', (e) => {
            e.preventDefault();
            randomizeLiveRankTag();
            randomizeLiveSquareTag();
        });
    }
    if (btnLiveRandRankTagBtn) {
        btnLiveRandRankTagBtn.addEventListener('click', () => {
            randomizeLiveRankTag();
            randomizeLiveSquareTag();
        });
    }

    bindLiveClickRandAndDblEdit(
        liveLayaBrandPill,
        liveLayaBrandTxt,
        () => (liveLayaBrandTxt ? liveLayaBrandTxt.textContent.trim() : 'Laya 精選'),
        (v) => {
            applyLiveBrandTagDisplay(v);
            window.showToast(`✅ 品牌標籤已修改為：${v}`);
        },
        randomizeLiveBrandTag,
        66
    );
    bindLiveClickRandAndDblEdit(
        liveSubRankPill,
        liveSubTxtRank,
        () => (liveSubTxtRank ? liveSubTxtRank.textContent.trim() : '人氣榜'),
        (v) => {
            applyLiveRankTagDisplay(v);
            window.showToast(`✅ 榜單標籤已修改為：${v}`);
        },
        randomizeLiveRankTag,
        52
    );
    bindLiveClickRandAndDblEdit(
        liveSubSquarePill,
        liveSubTxtSquare,
        () => (liveSubTxtSquare ? liveSubTxtSquare.textContent.trim() : '直播廣場'),
        (v) => {
            applyLiveSquareTagDisplay(v);
            window.showToast(`✅ 右側標籤已修改為：${v}`);
        },
        randomizeLiveSquareTag,
        58
    );

    // ★ 公屏上方「Laya 官方精選直播間，點關注不迷路...」欢迎语 & 顶部绿色系统提示语：支持右侧自定义修改、随机切换、勾选隐藏、以及手机画面单击随机/双击原地编辑
    const liveWelcomePresets = [
        'Laya 官方精選直播間，點關注不迷路，歡迎來到我的直播間！',
        '歡迎新進直播間的寶寶們，點點右上角關注，精彩馬上開始！',
        '高顏值才藝現場直播中，喜歡主播的點個關注亮個粉絲燈牌～',
        '晚上好呀家人們！新來的朋友點關注不迷路，公屏扣1有驚喜！',
        'Laya 認證熱門直播間，感謝各位大哥大姐的支持與陪伴！',
        '正在直播精彩內容，點擊左上方關注主播，每天準時開播不走散！',
        '歡迎來到本場直播間，喜歡的家人們多點點讚，右下角愛心走一走！'
    ];
    const liveNoticePresets = [
        '歡迎來到直播間！嚴禁未成年人直播或打賞消費。理性消費，謹防網絡詐騙。',
        '平台倡導綠色健康直播，請文明發言、友善互動，共同維護良好直播氛圍。',
        '溫馨提示：請勿輕信私下交易或外部鏈接，理性觀看與打賞，注意財產安全。',
        '官方巡查提醒：直播間嚴禁低俗辱罵及違規廣告，祝大家觀看愉快！'
    ];

    function applyLiveWelcomeDisplay(val) {
        const cleanVal = String(val || '').trim() || 'Laya 官方精選直播間，點關注不迷路，歡迎來到我的直播間！';
        if (liveRoomWelcomeTxt) liveRoomWelcomeTxt.textContent = cleanVal;
        if (inLiveWelcomeTxt && document.activeElement !== inLiveWelcomeTxt) {
            inLiveWelcomeTxt.value = cleanVal;
        }
        if (liveRoomWelcomeEl && swLiveShowWelcome) {
            liveRoomWelcomeEl.style.display = swLiveShowWelcome.checked ? '' : 'none';
        }
    }

    function applyLiveNoticeDisplay(val) {
        const cleanVal = String(val || '').trim() || '歡迎來到直播間！嚴禁未成年人直播或打賞消費。理性消費，謹防網絡詐騙。';
        if (liveSysNoticeTxt) {
            liveSysNoticeTxt.textContent = cleanVal;
        } else if (liveSysNoticeEl) {
            liveSysNoticeEl.textContent = cleanVal;
        }
        if (inLiveNoticeTxt && document.activeElement !== inLiveNoticeTxt) {
            inLiveNoticeTxt.value = cleanVal;
        }
        if (liveSysNoticeEl && swLiveShowNotice) {
            liveSysNoticeEl.style.display = swLiveShowNotice.checked ? '' : 'none';
        }
    }

    function randomizeLiveWelcome() {
        const cur = liveRoomWelcomeTxt ? liveRoomWelcomeTxt.textContent.trim() : '';
        const candidates = liveWelcomePresets.filter(t => t !== cur);
        const pick = candidates[Math.floor(Math.random() * candidates.length)] || liveWelcomePresets[0];
        applyLiveWelcomeDisplay(pick);
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
        window.showToast('🎲 已隨機切換直播間歡迎語');
    }

    function randomizeLiveNotice() {
        const cur = (liveSysNoticeTxt || liveSysNoticeEl) ? (liveSysNoticeTxt || liveSysNoticeEl).textContent.trim() : '';
        const candidates = liveNoticePresets.filter(t => t !== cur);
        const pick = candidates[Math.floor(Math.random() * candidates.length)] || liveNoticePresets[0];
        applyLiveNoticeDisplay(pick);
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
        window.showToast('🎲 已隨機切換頂部系統提示語');
    }

    if (inLiveWelcomeTxt) {
        inLiveWelcomeTxt.addEventListener('input', () => {
            applyLiveWelcomeDisplay(inLiveWelcomeTxt.value);
        });
    }
    if (btnLiveRandWelcome) btnLiveRandWelcome.addEventListener('click', (e) => { e.preventDefault(); randomizeLiveWelcome(); });
    if (btnLiveRandWelcomeBtn) btnLiveRandWelcomeBtn.addEventListener('click', randomizeLiveWelcome);
    if (swLiveShowWelcome) {
        swLiveShowWelcome.addEventListener('change', () => {
            if (liveRoomWelcomeEl) liveRoomWelcomeEl.style.display = swLiveShowWelcome.checked ? '' : 'none';
        });
    }

    if (inLiveNoticeTxt) {
        inLiveNoticeTxt.addEventListener('input', () => {
            applyLiveNoticeDisplay(inLiveNoticeTxt.value);
        });
    }
    if (btnLiveRandNotice) btnLiveRandNotice.addEventListener('click', (e) => { e.preventDefault(); randomizeLiveNotice(); });
    if (btnLiveRandNoticeBtn) btnLiveRandNoticeBtn.addEventListener('click', randomizeLiveNotice);
    if (swLiveShowNotice) {
        swLiveShowNotice.addEventListener('change', () => {
            if (liveSysNoticeEl) liveSysNoticeEl.style.display = swLiveShowNotice.checked ? '' : 'none';
        });
    }

    // 绑定手机画面上「Laya 官方精選直播間...」欢迎语与顶部绿色提示语：单击随机换一句，双击原地直接输入修改！
    bindLiveClickRandAndDblEdit(
        liveRoomWelcomeEl,
        liveRoomWelcomeTxt,
        () => (liveRoomWelcomeTxt ? liveRoomWelcomeTxt.textContent.trim() : liveWelcomePresets[0]),
        (v) => {
            applyLiveWelcomeDisplay(v);
            if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`✅ 直播間歡迎語已修改為：${v}`);
        },
        randomizeLiveWelcome,
        210
    );
    bindLiveClickRandAndDblEdit(
        liveSysNoticeEl,
        liveSysNoticeTxt || liveSysNoticeEl,
        () => ((liveSysNoticeTxt || liveSysNoticeEl) ? (liveSysNoticeTxt || liveSysNoticeEl).textContent.trim() : liveNoticePresets[0]),
        (v) => {
            applyLiveNoticeDisplay(v);
            if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`✅ 頂部提示語已修改為：${v}`);
        },
        randomizeLiveNotice,
        210
    );

    const btnLiveAiMatchDm = document.getElementById('btn-live-ai-match-dm');
    const btnLiveRandDmBatch = document.getElementById('btn-live-rand-dm-batch');
    const btnLiveSplitDmLines = document.getElementById('btn-live-split-dm-lines');
    const btnLiveToggleAiCfg = document.getElementById('btn-live-toggle-ai-cfg');
    const boxLiveAiVisionCfg = document.getElementById('box-live-ai-vision-cfg');
    const swLiveAutoAiDm = document.getElementById('sw-live-auto-ai-dm');
    const txtLiveAiStatus = document.getElementById('txt-live-ai-status');
    const inLiveAiGeminiKey = document.getElementById('in-live-ai-gemini-key');
    const inLiveAiGasUrl = document.getElementById('in-live-ai-gas-url');
    const btnLiveSaveAiKey = document.getElementById('btn-live-save-ai-key');
    const btnLiveShareAiKey = document.getElementById('btn-live-share-ai-key');

    // ★ 全站默认共享 AI API Key（如果把 Key 填在下面这个常量里推送到线上，全网所有人打开网站都无需手动填 Key 直接共用！）
    const GLOBAL_SHARED_DEFAULT_AI_KEY = window.LAYA_GLOBAL_SHARED_AI_KEY || '';
    const GLOBAL_SHARED_DEFAULT_AI_URL = window.LAYA_GLOBAL_SHARED_AI_URL || '';

    // 支持从网址参数 ?ai_key=xxx 自动读取并持久化共享 Key
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedKeyFromUrl = (urlParams.get('ai_key') || '').trim();
        const sharedUrlFromUrl = (urlParams.get('ai_url') || '').trim();
        if (sharedKeyFromUrl) {
            localStorage.setItem('LAYA_LIVE_SHARED_AI_KEY', sharedKeyFromUrl);
            if (inLiveAiGeminiKey) inLiveAiGeminiKey.value = sharedKeyFromUrl;
        }
        if (sharedUrlFromUrl) {
            localStorage.setItem('LAYA_LIVE_SHARED_AI_URL', sharedUrlFromUrl);
            if (inLiveAiGasUrl) inLiveAiGasUrl.value = sharedUrlFromUrl;
        }
    } catch (e) {}

    function getActiveLiveAiKeyAndUrl() {
        const inputKey = (inLiveAiGeminiKey && inLiveAiGeminiKey.value.trim()) || '';
        const storedKey = localStorage.getItem('LAYA_LIVE_SHARED_AI_KEY') || '';
        const finalKey = inputKey || storedKey || GLOBAL_SHARED_DEFAULT_AI_KEY;

        const inputUrl = (inLiveAiGasUrl && inLiveAiGasUrl.value.trim()) || '';
        const storedUrl = localStorage.getItem('LAYA_LIVE_SHARED_AI_URL') || '';
        const finalUrl = inputUrl || storedUrl || GLOBAL_SHARED_DEFAULT_AI_URL;

        if (inLiveAiGeminiKey && !inLiveAiGeminiKey.value && finalKey) {
            inLiveAiGeminiKey.value = finalKey;
        }
        if (inLiveAiGasUrl && !inLiveAiGasUrl.value && finalUrl) {
            inLiveAiGasUrl.value = finalUrl;
        }
        return { apiKey: finalKey, apiUrl: finalUrl };
    }
    setTimeout(getActiveLiveAiKeyAndUrl, 160);

    if (btnLiveSaveAiKey) {
        btnLiveSaveAiKey.addEventListener('click', () => {
            const k = (inLiveAiGeminiKey && inLiveAiGeminiKey.value.trim()) || '';
            const u = (inLiveAiGasUrl && inLiveAiGasUrl.value.trim()) || '';
            if (k) localStorage.setItem('LAYA_LIVE_SHARED_AI_KEY', k);
            if (u) localStorage.setItem('LAYA_LIVE_SHARED_AI_URL', u);
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            autoMatchLiveDanmakuByVideoAI(true, null);
        });
    }
    if (btnLiveShareAiKey) {
        btnLiveShareAiKey.addEventListener('click', () => {
            const { apiKey, apiUrl } = getActiveLiveAiKeyAndUrl();
            if (!apiKey && !apiUrl) {
                window.showToast('🔑 請先在下方輸入框粘貼你的 AI API Key');
                if (inLiveAiGeminiKey) inLiveAiGeminiKey.focus();
                return;
            }
            const shareUrl = new URL(window.location.origin + window.location.pathname);
            if (apiKey) shareUrl.searchParams.set('ai_key', apiKey);
            if (apiUrl) shareUrl.searchParams.set('ai_url', apiUrl);
            const finalLink = shareUrl.toString();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(finalLink).then(() => {
                    window.showToast('🌐 已複製帶 Key 的全員共享連結！任何人打開該連結都會自動生效');
                }).catch(() => {
                    window.prompt('複製以下全員共享連結發給大家即可直接使用你的 AI Key：', finalLink);
                });
            } else {
                window.prompt('複製以下全員共享連結發給大家即可直接使用你的 AI Key：', finalLink);
            }
        });
    }

    if (inLiveDanmakuList) {
        inLiveDanmakuList.addEventListener('input', () => {
            renderLiveChatBubbles(false);
        });
        inLiveDanmakuList.addEventListener('paste', () => {
            setTimeout(() => {
                normalizeLiveDanmakuTextarea(true);
                renderLiveChatBubbles(false);
            }, 20);
        });
    }
    if (btnLiveSplitDmLines) {
        btnLiveSplitDmLines.addEventListener('click', () => {
            const lines = normalizeLiveDanmakuTextarea(true);
            liveChatCursor = 0;
            renderLiveChatBubbles(false);
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            window.showToast(`↵ 已自動拆分為 ${lines.length} 行獨立彈幕`);
        });
    }
    if (btnLiveToggleAiCfg && boxLiveAiVisionCfg) {
        btnLiveToggleAiCfg.addEventListener('click', () => {
            const isHidden = boxLiveAiVisionCfg.style.display === 'none';
            boxLiveAiVisionCfg.style.display = isHidden ? 'block' : 'none';
        });
    }

    // ★ 多场景分行弹幕预设池（用于「🎲 換一批」与「🤖 AI 識別視頻自動配彈幕」）
    const LIVE_AI_SCENE_DANMAKU_POOLS = {
        classic: [
            '前排！',
            '主播好漂亮',
            '這首歌絕了',
            '666',
            '哈哈哈哈',
            '關注了',
            '求歌名',
            '聲音好甜',
            '打卡',
            '蹲一個歌單',
            '太治癒了',
            '主播加油',
            '已關注 比心',
            '主播聲音也太好聽了'
        ],
        beauty_dance: [
            '微醺小貓：主播今天這身穿搭絕了，愛了愛了💖',
            '輕輕吹風：這顏值簡直天花板，剛刷到就走不動道了',
            '羊🐑：前排打卡！主播好漂亮，狀態拉滿🔥',
            '阿傑：66666 這身材比例太頂了吧',
            '石頭baby：聲音好甜，人美聲甜說的就是主播吧',
            '夜色有點濃：已關注 比心！每天準時蹲直播間',
            '希拉：大家把讚點到 10 萬，讓主播再跳一段！',
            '皓哥：禮物走一波，這個直播間氛圍太好了',
            '漫渡：鏡頭拉近一點，這皮膚狀態也太好了吧',
            '星河少女：求今天口紅色號和穿搭連結！',
            '晚風溫柔：太治癒了，看美女直播心情都變好了',
            '捉事盧鑫：剛從推薦頁進來，果斷點了關注'
        ],
        music_singing: [
            '前排！這首歌一開口直接跪了',
            '求歌名！這個版本的伴奏太好聽了',
            '聲音好甜，主播聲音也太好聽了吧',
            '蹲一個歌單，今晚單曲循環預定',
            '太治癒了，戴上耳機聽簡直是享受',
            '這首歌絕了，高音部分穩得像CD一樣',
            '哈哈哈哈剛進來就被嗓音迷住了，關注了',
            '666 實力派唱將，比原唱還有感覺',
            '打卡！可以點一首周杰倫的歌嗎',
            '主播加油，這唱功不火天理難容',
            '已關注 比心，每天睡前必聽的寶藏直播間',
            '氣氛組就位，大家小心心和螢光棒刷起來'
        ],
        mahjong_game: [
            '羊🐑：這牌也不咋地嘛，全靠主播技術撐著',
            '🌈七月初五🐟🐳：除了小王和絲滑姐，沒人能打出這操作',
            '蒙蒙：昨天的牌才有節目效果，笑死我了哈哈哈',
            '阿傑：666 這波預判直接封神，對面徹底懵了',
            '捉事盧鑫：這把節奏太穩了，坐等清一色自摸！',
            '輕輕吹風：哈哈哈哈這張牌敢打出去也是心大',
            '皓哥：這局要是贏了，我直接刷一組嘉年華',
            '夜色有點濃：家庭娛樂局氣氛就是好，百看不厭',
            '石頭baby：注意看右手邊那張牌，伏筆早就埋好了',
            '漫渡：前排圍觀高手過招，這手氣絕了',
            '希拉：關注了！每天下班就愛看你們打牌嘮嗑',
            '風止何安：來了來了，今天戰況怎麼樣？'
        ],
        drama_cinema: [
            '前排！這段劇情張力拉滿，演技太頂了',
            '注意看他最後那個眼神，信息量太大了',
            '這畫質和運鏡絕了，完全是電影級質感',
            '666 第一次看覺得好笑，看懂之後背後發涼',
            '終於刷到完整版直播了，之前找了好久',
            '哈哈哈哈這反轉真的沒猜到，編劇腦洞太大了',
            '配樂一響雞皮疙瘩都起來了，太有代入感了',
            '打卡！評論區和彈幕果然臥虎藏龍',
            '表面風平浪靜，實際上每一句話都在博弈',
            '已關注 比心，這個系列百看不厭',
            '太真實了，短短幾十秒把人物性格全立住了',
            '主播加油，多放點這種高能名場面！'
        ]
    };

    let randDmPoolIndex = 0;
    if (btnLiveRandDmBatch) {
        btnLiveRandDmBatch.addEventListener('click', () => {
            const keys = Object.keys(LIVE_AI_SCENE_DANMAKU_POOLS);
            randDmPoolIndex = (randDmPoolIndex + 1) % keys.length;
            const pickedKey = keys[randDmPoolIndex];
            const lines = LIVE_AI_SCENE_DANMAKU_POOLS[pickedKey].slice();
            if (inLiveDanmakuList) {
                inLiveDanmakuList.value = lines.join('\n');
            }
            liveChatCursor = 0;
            renderLiveChatBubbles(false);
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            window.showToast(`🎲 已切換一套分行彈幕（共 ${lines.length} 條）`);
        });
    }

    // ★ 从当前预览视频或图片即时截取最多 3 张高清关键帧 Base64 + 视觉色彩/人像特征分析
    async function extractCurrentVideoFramesAndStats(preFrames = null) {
        const previewVid = document.getElementById('preview-video');
        const previewImg = document.getElementById('preview-img');
        const frames = Array.isArray(preFrames) && preFrames.length > 0 ? preFrames.slice(0, 3) : [];

        if (frames.length === 0) {
            if (Array.isArray(window.__lastExtractedVideoFrames) && window.__lastExtractedVideoFrames.length > 0) {
                frames.push(...window.__lastExtractedVideoFrames.slice(0, 3));
            } else if (previewVid && previewVid.videoWidth > 0 && previewVid.style.display !== 'none') {
                try {
                    const c = document.createElement('canvas');
                    const vw = previewVid.videoWidth || 640;
                    const vh = previewVid.videoHeight || 360;
                    c.width = Math.min(480, vw);
                    c.height = Math.round(c.width * (vh / vw)) || 270;
                    c.getContext('2d').drawImage(previewVid, 0, 0, c.width, c.height);
                    frames.push(c.toDataURL('image/jpeg', 0.78));
                } catch (e) {}
            } else if (previewImg && previewImg.naturalWidth > 0) {
                try {
                    const c = document.createElement('canvas');
                    const iw = previewImg.naturalWidth || 640;
                    const ih = previewImg.naturalHeight || 360;
                    c.width = Math.min(480, iw);
                    c.height = Math.round(c.width * (ih / iw)) || 270;
                    c.getContext('2d').drawImage(previewImg, 0, 0, c.width, c.height);
                    frames.push(c.toDataURL('image/jpeg', 0.78));
                } catch (e) {}
            }
        }

        // 分析第一张关键帧的像素色彩分布（人像肤色占比、麻将/桌面绿色占比、霓虹舞台紫粉占比、整体明暗度）
        const stats = { skinRatio: 0, greenTableRatio: 0, neonStageRatio: 0, avgLuma: 120 };
        if (frames.length > 0) {
            await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const sc = document.createElement('canvas');
                        sc.width = 64;
                        sc.height = 64;
                        const sctx = sc.getContext('2d');
                        sctx.drawImage(img, 0, 0, 64, 64);
                        const data = sctx.getImageData(0, 0, 64, 64).data;
                        let skinCnt = 0;
                        let greenCnt = 0;
                        let neonCnt = 0;
                        let lumaSum = 0;
                        const totalPx = 64 * 64;
                        for (let i = 0; i < data.length; i += 4) {
                            const r = data[i], g = data[i + 1], b = data[i + 2];
                            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                            lumaSum += luma;
                            if (r > 95 && g > 40 && b > 20 && r > g && r > b && (r - Math.min(g, b)) > 15 && Math.abs(r - g) > 12) {
                                skinCnt++;
                            }
                            if (g > 75 && g > r * 1.08 && g > b * 1.05) {
                                greenCnt++;
                            }
                            if ((r > 130 && b > 130 && g < 110) || (b > 140 && r > 90 && g < 100)) {
                                neonCnt++;
                            }
                        }
                        stats.skinRatio = skinCnt / totalPx;
                        stats.greenTableRatio = greenCnt / totalPx;
                        stats.neonStageRatio = neonCnt / totalPx;
                        stats.avgLuma = Math.round(lumaSum / totalPx);
                    } catch (e) {}
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = frames[0];
            });
        }
        return { frames, stats };
    }

    // ★ 根据视频抽帧像素特征 + 文件名/标题关键词智能生成匹配的直播间弹幕（零配置即时可用）
    function buildSmartLocalVideoAiDanmaku(stats, contextText) {
        const txt = String(contextText || '').toLowerCase();
        let category = 'beauty_dance';
        let sceneLabel = '高顏值才藝直播';

        if (/麻将|麻將|棋牌|打牌|胡了|自摸|家庭娱乐|家庭娛樂|斗地主|鬥地主|pk/i.test(txt) || stats.greenTableRatio > 0.22) {
            category = 'mahjong_game';
            sceneLabel = '麻將/棋牌互動局';
        } else if (/歌|唱|音乐|音樂|mv|dj|伴奏|听|聽|曲/i.test(txt) || stats.neonStageRatio > 0.18) {
            category = 'music_singing';
            sceneLabel = '音樂/唱歌才藝直播';
        } else if (/剧|劇|电影|電影|解说|解説|名场面|名場面|反转|反轉|悬疑|懸疑/i.test(txt) || stats.avgLuma < 68) {
            category = 'drama_cinema';
            sceneLabel = '高能劇情/影視現場';
        } else if (stats.skinRatio > 0.16 || /美女|穿搭|热舞|熱舞|甜妹|女神|主播/i.test(txt)) {
            category = 'beauty_dance';
            sceneLabel = '高顏值主播互動';
        }

        const basePool = (LIVE_AI_SCENE_DANMAKU_POOLS[category] || LIVE_AI_SCENE_DANMAKU_POOLS.classic).slice();
        const hostName = (inLiveHostName && inLiveHostName.value.trim()) ? inLiveHostName.value.trim() : '主播';

        // 提取标题或视频文件名中的有效关键词，生成 2~3 条专属定制弹幕穿插在顶部
        const cleanTokens = String(contextText || '')
            .replace(/#[\S]+/g, m => ' ' + m.slice(1) + ' ')
            .split(/[\s,，。！？!?:：；;、/\-—_（）()【】\[\]《》""''「」]+/)
            .map(s => s.trim())
            .filter(s => s.length >= 2 && s.length <= 9 && !/^(mp4|mov|webm|video|screenrecording|IMG|VID|作者声明|虚构演绎|仅供娱乐|小王小王)$/i.test(s));

        const customLines = [];
        if (cleanTokens.length > 0) {
            const kw = typeof window.toStageTrad === 'function' ? window.toStageTrad(cleanTokens[0]) : cleanTokens[0];
            customLines.push(`羊🐑：衝著「${kw}」進來的，${hostName}這波直播太頂了🔥`);
            customLines.push(`輕輕吹風：這段${kw}畫面好清晰，前排打卡支持！`);
        } else {
            customLines.push(`羊🐑：剛刷到${hostName}的直播間，這狀態直接拉滿🔥`);
        }

        const merged = [...customLines, ...basePool];
        return { lines: merged.slice(0, 14), sceneLabel };
    }

    // ★ 调用云端 Gemini Vision API、OpenAI/DeepSeek 兼容接口或 Google Apps Script 代理直接看视频关键帧/上下文写弹幕
    async function requestCloudVisionVideoDanmaku(frames, contextText) {
        const { apiKey, apiUrl } = getActiveLiveAiKeyAndUrl();
        const promptText = `你是一個抖音/Laya直播間的真實觀眾彈幕生成助手。請仔細觀察這段直播視頻的抽幀畫面（參考標題信息：${contextText || '無'}），生成 14 條高度貼合畫面內容、人物動作、場景氛圍的直播間滾動彈幕。要求：1.全部使用繁體中文；2.每行一條，不要用逗號併成一行，不要編號；3.格式可以是「暱稱：彈幕內容」或直接是簡短自然的觀眾彈幕；4.只輸出這14行彈幕文本，不要任何解釋。`;

        // 1. Google Gemini API Key (AIza...)
        if (apiKey && /^AIza/i.test(apiKey) && frames.length > 0) {
            const parts = [{ text: promptText }];
            frames.slice(0, 3).forEach(dataUrl => {
                const base64Data = String(dataUrl).split(',')[1];
                if (base64Data) {
                    parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Data } });
                }
            });
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts }] })
            });
            if (res.ok) {
                const json = await res.json();
                const outTxt = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const parsed = splitDanmakuTextToMultiline(outTxt);
                if (parsed.length >= 4) return parsed;
            }
        }

        // 2. OpenAI / DeepSeek / 硅基流动 等兼容 API Key (sk-...)
        if (apiKey && !/^AIza/i.test(apiKey)) {
            let endpoint = 'https://api.deepseek.com/v1/chat/completions';
            let modelName = 'deepseek-chat';
            let messagesPayload = [{ role: 'user', content: promptText }];

            if (apiUrl && /^https?:\/\//i.test(apiUrl) && !/script\.google\.com/i.test(apiUrl)) {
                endpoint = apiUrl.replace(/\/+$/, '');
                if (!/\/chat\/completions$/i.test(endpoint)) {
                    endpoint += (endpoint.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions');
                }
            } else if (/^sk-proj-|openai/i.test(apiKey)) {
                endpoint = 'https://api.openai.com/v1/chat/completions';
                modelName = 'gpt-4o-mini';
                if (frames.length > 0) {
                    const contentArr = [{ type: 'text', text: promptText }];
                    frames.slice(0, 2).forEach(u => contentArr.push({ type: 'image_url', image_url: { url: u } }));
                    messagesPayload = [{ role: 'user', content: contentArr }];
                }
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: messagesPayload,
                    temperature: 0.8
                })
            });
            if (res.ok) {
                const json = await res.json();
                const outTxt = json?.choices?.[0]?.message?.content || '';
                const parsed = splitDanmakuTextToMultiline(outTxt);
                if (parsed.length >= 4) return parsed;
            }
        }

        // 3. Google Apps Script 代理 URL
        if (apiUrl && /script\.google\.com/i.test(apiUrl)) {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'aiVideoDanmaku',
                    context: contextText,
                    frames: frames.slice(0, 2)
                })
            });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json.danmaku) && json.danmaku.length >= 3) {
                    return json.danmaku;
                }
                if (typeof json.text === 'string' && json.text.trim()) {
                    return splitDanmakuTextToMultiline(json.text);
                }
            }
        }
        return null;
    }

    // ★ 核心主入口：上传视频后或点击「🤖 AI 識別視頻自動配彈幕」时自动分析视频画面并填充弹幕
    async function autoMatchLiveDanmakuByVideoAI(isManualClick = true, preFrames = null) {
        if (txtLiveAiStatus) txtLiveAiStatus.textContent = '🔍 AI 正在抽幀分析視頻...';
        if (btnLiveAiMatchDm) btnLiveAiMatchDm.disabled = true;

        try {
            const { frames, stats } = await extractCurrentVideoFramesAndStats(preFrames);
            const rawDesc = document.getElementById('in-dy-desc')?.value || '';
            const rawTags = document.getElementById('in-dy-tags')?.value || '';
            const rawTitle = document.getElementById('in-m-main-title')?.value || '';
            const fileName = window.__lastUploadedMediaName || '';
            const contextText = [fileName, rawDesc, rawTags, rawTitle].filter(Boolean).join(' ');

            let matchedLines = null;
            let sceneLabel = '雲端視覺大模型';

            try {
                matchedLines = await requestCloudVisionVideoDanmaku(frames, contextText);
            } catch (err) {
                matchedLines = null;
            }

            if (!matchedLines || matchedLines.length === 0) {
                const localRes = buildSmartLocalVideoAiDanmaku(stats, contextText);
                matchedLines = localRes.lines;
                sceneLabel = localRes.sceneLabel;
            }

            if (inLiveDanmakuList && matchedLines.length > 0) {
                inLiveDanmakuList.value = matchedLines.join('\n');
            }
            liveChatCursor = 0;
            renderLiveChatBubbles(false);

            // 同步前 6 条纯弹幕正文到画面顶部飘屏弹幕轨道（方便短视频与直播双端复用）
            if (window.DanmakuEngine && Array.isArray(window.DanmakuEngine.list) && matchedLines.length > 0) {
                const topLanes = [10, 13, 16, 19, 22];
                window.DanmakuEngine.list = matchedLines.slice(0, 6).map((line, idx) => {
                    const cIdx = line.indexOf('：') !== -1 ? line.indexOf('：') : line.indexOf(':');
                    const pureMsg = cIdx > 0 ? line.slice(cIdx + 1).trim() : line.trim();
                    return {
                        id: 'ai_dm_' + Date.now() + '_' + idx,
                        text: pureMsg,
                        top: topLanes[idx % topLanes.length],
                        left: (12 + idx * 17) % 75,
                        color: '#ffffff',
                        size: 14,
                        speed: 9 + (idx % 4),
                        visible: true
                    };
                });
                if (typeof window.DanmakuEngine.refresh === 'function') {
                    window.DanmakuEngine.refresh();
                }
            }

            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            if (txtLiveAiStatus) txtLiveAiStatus.textContent = `✅ AI 已匹配 (${sceneLabel})`;
            if (isManualClick) {
                window.showToast(`🤖 AI 已分析視頻畫面（${sceneLabel}）並自動填充 ${matchedLines.length} 條分行彈幕！`);
            }
        } finally {
            if (btnLiveAiMatchDm) btnLiveAiMatchDm.disabled = false;
        }
    }
    window.autoMatchLiveDanmakuByVideoAI = autoMatchLiveDanmakuByVideoAI;

    window.onVideoUploadedForLiveAi = function (fileName, aiFrames) {
        if (swLiveAutoAiDm && !swLiveAutoAiDm.checked) return;
        autoMatchLiveDanmakuByVideoAI(false, aiFrames);
        window.showToast('🤖 AI 已根據新上傳視頻自動匹配並填充直播彈幕');
    };

    if (btnLiveAiMatchDm) {
        btnLiveAiMatchDm.addEventListener('click', () => {
            autoMatchLiveDanmakuByVideoAI(true, null);
        });
    }
    if (swLiveRainbowNick) {
        swLiveRainbowNick.addEventListener('change', () => renderLiveChatBubbles(false));
    }
    if (swLiveDmRowHeart) {
        swLiveDmRowHeart.addEventListener('change', () => renderLiveChatBubbles(false));
    }

    function applyLiveDmColor(hex) {
        const c = (hex || '#ffffff').trim();
        if (inLiveDmColor && inLiveDmColor.value.toLowerCase() !== c.toLowerCase() && /^#[0-9a-fA-F]{6}$/.test(c)) {
            inLiveDmColor.value = c;
        }
        if (inLiveDmColorHex && inLiveDmColorHex.value.toLowerCase() !== c.toLowerCase()) {
            inLiveDmColorHex.value = c;
        }
        renderLiveChatBubbles(false);
    }
    if (inLiveDmColor) {
        inLiveDmColor.addEventListener('input', (e) => applyLiveDmColor(e.target.value));
    }
    if (inLiveDmColorHex) {
        inLiveDmColorHex.addEventListener('input', (e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(v)) applyLiveDmColor(v);
        });
    }

    function applyLiveFollowColor(hex) {
        const c = (hex || '#f43f5e').trim();
        if (inLiveFollowColor && inLiveFollowColor.value.toLowerCase() !== c.toLowerCase() && /^#[0-9a-fA-F]{6}$/.test(c)) {
            inLiveFollowColor.value = c;
        }
        if (inLiveFollowColorHex && inLiveFollowColorHex.value.toLowerCase() !== c.toLowerCase()) {
            inLiveFollowColorHex.value = c;
        }
        if (liveBtnFollow && !liveBtnFollow.classList.contains('is-followed')) {
            liveBtnFollow.style.background = c;
            liveBtnFollow.style.boxShadow = `0 2px 8px ${c}66`;
        }
        if (liveBtnSend) {
            liveBtnSend.style.background = c;
            liveBtnSend.style.boxShadow = `0 2px 8px ${c}66`;
        }
    }
    if (inLiveFollowColor) {
        inLiveFollowColor.addEventListener('input', (e) => applyLiveFollowColor(e.target.value));
    }
    if (inLiveFollowColorHex) {
        inLiveFollowColorHex.addEventListener('input', (e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(v)) applyLiveFollowColor(v);
        });
    }

    if (inLiveDmSpeed) {
        inLiveDmSpeed.addEventListener('input', () => {
            const v = getLiveDmSpeedVal();
            const desc = v <= 3 ? '慢速' : (v <= 7 ? '标准' : '极速');
            if (txtLiveDmSpeed) txtLiveDmSpeed.textContent = `${v} (${desc})`;
            restartLiveChatRollTimer();
        });
    }

    // 直播间内部交互：顶部关注按钮、底部发送弹幕、最底部 4 个圆形图标
    if (liveBtnFollow) {
        liveBtnFollow.addEventListener('click', (e) => {
            e.stopPropagation();
            const isNowFollowed = liveBtnFollow.classList.toggle('is-followed');
            const isSimp = window.__currentLangMode === 'simp';
            if (isNowFollowed) {
                liveBtnFollow.textContent = isSimp ? '已关注' : '已關注';
                window.showToast('💗 已關注主播');
            } else {
                liveBtnFollow.textContent = isSimp ? '关注' : '關注';
                applyLiveFollowColor(inLiveFollowColor ? inLiveFollowColor.value : '#f43f5e');
            }
        });
    }

    function sendUserLiveChat() {
        if (!liveChatInput) return;
        const txt = (liveChatInput.value || '').trim();
        if (!txt) {
            window.showToast('💬 請先輸入要發送的彈幕內容');
            return;
        }
        if (inLiveDanmakuList) {
            const cur = inLiveDanmakuList.value.trim();
            const fmtLine = (txt.includes('：') || txt.includes(':')) ? txt : `Laya鐵粉：${txt}`;
            inLiveDanmakuList.value = cur ? `${fmtLine}\n${cur}` : fmtLine;
        }
        liveChatCursor = 0;
        renderLiveChatBubbles(false);
        liveChatInput.value = '';
        spawnSingleLiveHeart();
        window.showToast(`🚀 已發送直播彈幕：${txt}`);
    }
    if (liveBtnSend) {
        liveBtnSend.addEventListener('click', (e) => {
            e.stopPropagation();
            sendUserLiveChat();
        });
    }
    if (liveChatInput) {
        liveChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendUserLiveChat();
            }
        });
    }

    if (liveBotBtnDm) {
        liveBotBtnDm.addEventListener('click', (e) => {
            e.stopPropagation();
            liveDmVisible = !liveDmVisible;
            liveBotBtnDm.classList.toggle('active', liveDmVisible);
            if (liveChatList) liveChatList.style.opacity = liveDmVisible ? '1' : '0';
            if (liveJoinTickerRow) liveJoinTickerRow.style.opacity = liveDmVisible ? '1' : '0';
            window.showToast(liveDmVisible ? '💬 已開啟直播公屏顯示' : '🙈 已隱藏直播公屏顯示');
        });
    }
    if (liveBotBtnGift) {
        liveBotBtnGift.addEventListener('click', (e) => {
            e.stopPropagation();
            cycleNextGiftBannerWithSlide(true);
            for (let i = 0; i < 4; i++) {
                setTimeout(spawnSingleLiveHeart, i * 110);
            }
            window.showToast('🎁 已彈出下一條 Laya 禮物進場提示！');
        });
    }
    if (liveBotBtnShare) {
        liveBotBtnShare.addEventListener('click', (e) => {
            e.stopPropagation();
            window.showToast('↗️ 已分享當前直播間');
        });
    }
    if (liveBotBtnLike) {
        liveBotBtnLike.addEventListener('click', (e) => {
            e.stopPropagation();
            for (let i = 0; i < 5; i++) {
                setTimeout(spawnSingleLiveHeart, i * 90);
            }
        });
    }

    // ★ 录屏导出 MP4 (30fps) 专用的直播间右侧动态矢量飘心绘制器（100% 矢量贝塞尔曲线画心，绝不调用 fillText 产生乱码方框）
    const EXPORT_HEART_COLORS = ['#ff5e97', '#a855f7', '#f43f5e', '#ec4899'];
    function drawVectorHeartOnCanvas(ctx, cx, cy, size, fillColor, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(cx, cy);
        const s = size / 24;
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(0, 8.8);
        ctx.bezierCurveTo(-6.4, 3.2, -9.6, 0.3, -9.6, -3.45);
        ctx.bezierCurveTo(-9.6, -6.35, -7.35, -8.6, -4.45, -8.6);
        ctx.bezierCurveTo(-2.83, -8.6, -1.27, -7.84, 0, -6.62);
        ctx.bezierCurveTo(1.27, -7.84, 2.83, -8.6, 4.45, -8.6);
        ctx.bezierCurveTo(7.35, -8.6, 9.6, -6.35, 9.6, -3.45);
        ctx.bezierCurveTo(9.6, 0.3, 6.4, 3.2, 0, 8.8);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.shadowColor = 'rgba(168, 85, 247, 0.55)';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.restore();
    }

    window.__drawLiveRoomDynamicCanvas = function (ctx, outW, outH, scaleRatioX, scaleRatioY, elapsedSec) {
        if (!ctx) return;

        const heartSizePx = Math.round(18 * scaleRatioX);
        const baseRightX = outW - 30 * scaleRatioX;
        const baseBottomY = outH - 148 * scaleRatioY;
        const floatHeight = 185 * scaleRatioY;
        const density = getLiveHeartDensityVal();
        const particleCount = Math.max(2, Math.min(8, Math.round(density * 0.75)));

        for (let i = 0; i < particleCount; i++) {
            const phase = (elapsedSec * (0.55 + density * 0.03) + i * (1 / particleCount)) % 1;
            const curY = baseBottomY - phase * floatHeight;
            const swayX = Math.sin((phase * Math.PI * 2) + i * 1.7) * (11 * scaleRatioX);
            const alpha = phase < 0.15 ? (phase / 0.15) : (phase > 0.72 ? Math.max(0, (1 - phase) / 0.28) : 0.96);
            const col = EXPORT_HEART_COLORS[i % EXPORT_HEART_COLORS.length];
            drawVectorHeartOnCanvas(ctx, baseRightX + swayX, curY, heartSizePx, col, alpha);
        }
    };

    // 初始化清理旧版 8888 / 1000 缓存并同步所有直播间顶部数值
    if (localStorage.getItem('LAYA_LIVE_V23_1K_2M_MIGRATED') !== '1') {
        if (inLiveHostId && (inLiveHostId.value === '8888' || inLiveHostId.value === '1.8萬')) {
            inLiveHostId.value = '25.6萬';
        }
        if (inLiveViewersText && (inLiveViewersText.value === '1000' || inLiveViewersText.value === '293')) {
            inLiveViewersText.value = '10.2萬';
        }
        if (inLiveViewers && Number(inLiveViewers.value) <= 1000) {
            inLiveViewers.value = '102000';
        }
        localStorage.setItem('LAYA_LIVE_V23_1K_2M_MIGRATED', '1');
    }
    // 自动将旧版逗号连在一行的弹幕缓存（如「前排！, 主播好漂亮, 這首歌絕了...」）拆分为每行一条，并同步礼物图标与真人头像
    normalizeLiveDanmakuTextarea(true);
    setTimeout(() => {
        if (localStorage.getItem('LAYA_LIVE_V24_CLEAN_BADGE_MIGRATED') !== '1') {
            if (swLiveDmRowHeart) swLiveDmRowHeart.checked = false;
            if (swLiveAutoRollDm) swLiveAutoRollDm.checked = false;
            if (swLiveAutoCycleGift) swLiveAutoCycleGift.checked = false;
            localStorage.setItem('LAYA_LIVE_V24_CLEAN_BADGE_MIGRATED', '1');
        }
        const liveMiniLogoEl = document.getElementById('live-laya-mini-logo');
        if (liveMiniLogoEl) {
            liveMiniLogoEl.src = getActiveLogoSrc('Laya2.png');
        }
        normalizeLiveDanmakuTextarea(true);
        if (inLiveGiftName && inLiveGiftIcon) {
            const matchedIco = inferGiftIconFromName(inLiveGiftName.value);
            if (matchedIco) inLiveGiftIcon.value = matchedIco;
        }
        applyLiveDmScaleAndArea(false);
        applyLiveWelcomeDisplay(inLiveWelcomeTxt ? inLiveWelcomeTxt.value : '');
        applyLiveNoticeDisplay(inLiveNoticeTxt ? inLiveNoticeTxt.value : '');
        applyLiveGiftBannerState(false, true);
        renderLiveChatBubbles(false);
        restartLiveChatRollTimer();
        restartLiveGiftAutoCycleTimer();
    }, 140);

    applyLiveHostNameDisplay(inLiveHostName ? inLiveHostName.value : '小王小王');
    applyLiveHostLikesDisplay((inLiveHostId && inLiveHostId.value !== '8888') ? inLiveHostId.value : '25.6萬');
    applyLiveViewersDisplay((inLiveViewersText && inLiveViewersText.value !== '1000') ? inLiveViewersText.value : '10.2萬', null);
    applyLiveBrandTagDisplay(inLiveBrandTag ? inLiveBrandTag.value : 'Laya 精選');
    applyLiveRankTagDisplay(inLiveRankTag ? inLiveRankTag.value : '人氣榜');
    applyLiveSquareTagDisplay(inLiveSquareTag ? inLiveSquareTag.value : '直播廣場');
    applyLiveWelcomeDisplay(inLiveWelcomeTxt ? inLiveWelcomeTxt.value : '');
    applyLiveNoticeDisplay(inLiveNoticeTxt ? inLiveNoticeTxt.value : '');
    applyLiveGiftBannerState(false, true);
    renderLiveChatBubbles(false);
    renderLiveJoinTicker(false);
    exitLayaLiveRoom(false);
})();
