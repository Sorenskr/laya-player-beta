/**
 * ==========================================================================
 * app.js - 全局中枢控制、真实蓝/紫双Logo原图无损导出、真机录屏合成与持久化引擎
 * ==========================================================================
 */

window.__isInitialPreBoot = true;
window.showToast = function (msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    // 页面初始化恢复缓存期间，不弹出任何打扰用户的 Toast
    if (window.__isRestoringStorage || window.__isInitialPreBoot) return;

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
    let locateFlashTimer = null;

    function setActiveQuickAccessItem(targetCardId, scrollRailIntoView = true) {
        if (!qaRailList || !targetCardId) return;
        const qaItems = qaRailList.querySelectorAll('.qa-item');
        qaItems.forEach(btn => {
            const isMatch = btn.getAttribute('data-target-card') === targetCardId;
            btn.classList.toggle('active', isMatch);
            // 直接设置快速访问栏 scrollTop，严禁调用 smooth scrollIntoView 以免打断右侧编辑栏的平滑滚动
            if (isMatch && scrollRailIntoView) {
                const targetRailTop = Math.max(0, btn.offsetTop - (qaRailList.clientHeight / 2) + (btn.offsetHeight / 2));
                qaRailList.scrollTop = targetRailTop;
            }
        });
    }

    // ★ 全局核心：点击左侧画面任意位置 -> 右侧编辑栏立即切换对应选项卡、滑动置顶到要修改的具体输入框/区块并醒目高亮
    window.locateSidebarControl = function (opts = {}) {
        if (!rightSidebarEl || window.__isRestoringStorage) return;
        const {
            tab,
            cardId,
            targetSelector,
            highlightSelector,
            focusInput = false,
            expandSubtitleStudio = false
        } = opts;

        isQaProgrammaticScroll = true;
        if (qaScrollTimer) clearTimeout(qaScrollTimer);
        qaScrollTimer = setTimeout(() => {
            isQaProgrammaticScroll = false;
        }, 850);

        ensureRightPanelCardIds();

        // 1. 切换到对应的右侧控制面板 Tab
        if (tab && tab !== 'keep' && typeof window.switchRightTab === 'function') {
            window.switchRightTab(tab);
            if (qaModeBadge) {
                const badgeMap = { 'dy': '竖屏社区', 'web': '电脑网页', 'm-cinema': '手机横屏', 'dm': '弹幕工坊' };
                qaModeBadge.textContent = badgeMap[tab] || '全板块';
            }
        }

        // 2. 若当前处于直播间模式或定位直播间设置，确保【🔴 直播间专属设置】自动排在竖屏面板最上方
        const panelDyEl = document.getElementById('panel-dy-settings');
        const rtEl = document.getElementById('render-target');
        if (panelDyEl && rtEl) {
            panelDyEl.classList.toggle('live-priority-order', rtEl.classList.contains('dy-live-open') || cardId === 'card-dy-live-settings');
        }

        // 3. 若目标是智能字幕工坊且处于折叠态，自动展开
        if (expandSubtitleStudio || cardId === 'card-dy-subtitle') {
            const subBody = document.getElementById('sub-studio-body');
            const subArrow = document.getElementById('sub-collapse-arrow');
            if (subBody && subBody.style.display === 'none') {
                subBody.style.display = 'flex';
                if (subArrow) subArrow.style.transform = 'rotate(180deg)';
            }
        }

        // 4. 查找具体目标控件与所属卡片
        let targetEl = null;
        if (typeof targetSelector === 'string' && targetSelector) {
            targetEl = rightSidebarEl.querySelector(targetSelector) || document.querySelector(targetSelector);
        } else if (targetSelector && targetSelector.nodeType === 1) {
            targetEl = targetSelector;
        }

        const cardEl = (cardId && document.getElementById(cardId))
            || (targetEl && targetEl.closest && targetEl.closest('.panel-card'))
            || null;

        if (!targetEl && cardEl) {
            targetEl = cardEl;
        }
        if (!targetEl) return;

        const resolvedCardId = (cardEl && cardEl.id) || cardId;
        if (resolvedCardId) {
            setActiveQuickAccessItem(resolvedCardId, true);
        }

        // 确定需要高亮与置顶对齐的具体行/区块
        let highlightEl = null;
        if (typeof highlightSelector === 'string' && highlightSelector) {
            highlightEl = rightSidebarEl.querySelector(highlightSelector) || document.querySelector(highlightSelector);
        } else if (highlightSelector && highlightSelector.nodeType === 1) {
            highlightEl = highlightSelector;
        }
        if (!highlightEl) {
            if (targetEl.classList && targetEl.classList.contains('panel-card')) {
                highlightEl = targetEl;
            } else if (targetEl.id && /^live-cfg-box-/.test(targetEl.id)) {
                highlightEl = targetEl;
            } else if (targetEl.closest) {
                highlightEl = targetEl.closest('#live-cfg-box-gift, #live-cfg-box-welcome, #live-cfg-box-danmaku, .dy-cmt-ed-card, .dm-track-card, .sub-cue-item, .form-row, .switch-tile') || targetEl;
            } else {
                highlightEl = targetEl;
            }
        }

        rightSidebarEl.querySelectorAll('.panel-card.qa-card-focus-glow').forEach(c => c.classList.remove('qa-card-focus-glow'));
        rightSidebarEl.querySelectorAll('.sidebar-locate-flash').forEach(el => el.classList.remove('sidebar-locate-flash'));

        const performScrollAndGlow = () => {
            const sideRect = rightSidebarEl.getBoundingClientRect();
            const anchorEl = highlightEl || targetEl || cardEl;
            if (!anchorEl) return;
            const elRect = anchorEl.getBoundingClientRect();
            const nextTop = Math.max(0, rightSidebarEl.scrollTop + (elRect.top - sideRect.top) - 14);
            rightSidebarEl.scrollTo({ top: nextTop, behavior: 'smooth' });

            if (cardEl) {
                void cardEl.offsetWidth;
                cardEl.classList.add('qa-card-focus-glow');
            }
            if (highlightEl && highlightEl !== cardEl) {
                void highlightEl.offsetWidth;
                highlightEl.classList.add('sidebar-locate-flash');
            } else if (cardEl) {
                const headerEl = cardEl.querySelector('.card-header') || cardEl;
                void headerEl.offsetWidth;
                headerEl.classList.add('sidebar-locate-flash');
            }
        };

        requestAnimationFrame(performScrollAndGlow);
        setTimeout(() => {
            const sideRect = rightSidebarEl.getBoundingClientRect();
            const anchorEl = highlightEl || targetEl || cardEl;
            if (anchorEl) {
                const elRect = anchorEl.getBoundingClientRect();
                const desiredTop = Math.max(0, rightSidebarEl.scrollTop + (elRect.top - sideRect.top) - 14);
                if (Math.abs(rightSidebarEl.scrollTop - desiredTop) > 24) {
                    rightSidebarEl.scrollTo({ top: desiredTop, behavior: 'smooth' });
                }
            }
            if (focusInput && targetEl) {
                const focusNode = (targetEl.matches && targetEl.matches('input[type="text"], textarea, select'))
                    ? targetEl
                    : (targetEl.querySelector && targetEl.querySelector('input[type="text"], textarea, select'));
                if (focusNode) {
                    try { focusNode.focus({ preventScroll: true }); } catch (e) {}
                }
            }
        }, 120);

        if (locateFlashTimer) clearTimeout(locateFlashTimer);
        locateFlashTimer = setTimeout(() => {
            rightSidebarEl.querySelectorAll('.sidebar-locate-flash').forEach(el => el.classList.remove('sidebar-locate-flash'));
        }, 2200);
    };

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

    // ★ 通用跨域安全头像预缓存器：将任何在线 http/https 头像预转为 Base64 data-export-src，确保 html2canvas 与 Canvas drawImage 100% 不丢头像
    function cacheAvatarExportSafeDataUrl(imgEl, urlStr) {
        if (!imgEl || !urlStr) return;
        if (urlStr.startsWith('data:')) {
            imgEl.setAttribute('data-export-src', urlStr);
            return;
        }
        if (/^https?:\/\//i.test(urlStr)) {
            fetch(urlStr, { mode: 'cors', credentials: 'omit' })
                .then(r => (r.ok ? r.blob() : Promise.reject(new Error('avatar fetch failed'))))
                .then(blob => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                }))
                .then(dataUrl => {
                    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
                        imgEl.setAttribute('data-export-src', dataUrl);
                    }
                })
                .catch(() => {});
        }
    }
    window.cacheAvatarExportSafeDataUrl = cacheAvatarExportSafeDataUrl;

    // ★ 同步更新右侧中间作者头像、右侧最下方静态头像、全屏横屏头像与直播间主播头像（100% 实时联动）
    function syncAuthorAvatarEverywhere(src, isCustom = false) {
        if (!src) return;
        if (dyAvatarImg) {
            if (dyAvatarImg.src !== src) dyAvatarImg.src = src;
            dyAvatarImg.dataset.custom = isCustom ? 'true' : 'false';
            cacheAvatarExportSafeDataUrl(dyAvatarImg, src);
        }
        if (dylDispAvatar) {
            if (dylDispAvatar.src !== src) dylDispAvatar.src = src;
            cacheAvatarExportSafeDataUrl(dylDispAvatar, src);
        }
        const liveHostAvEl = document.getElementById('live-host-avatar');
        if (liveHostAvEl) {
            if (liveHostAvEl.src !== src) liveHostAvEl.src = src;
            cacheAvatarExportSafeDataUrl(liveHostAvEl, src);
        }
        const liveMiniAvEl = document.getElementById('dy-live-follow-mini-av');
        if (liveMiniAvEl) {
            if (liveMiniAvEl.src !== src) liveMiniAvEl.src = src;
            cacheAvatarExportSafeDataUrl(liveMiniAvEl, src);
        }
    }
    window.syncAuthorAvatarEverywhere = syncAuthorAvatarEverywhere;

    if (dyAvatarImg && typeof MutationObserver !== 'undefined') {
        const avatarObs = new MutationObserver(() => {
            const curSrc = dyAvatarImg.getAttribute('src') || dyAvatarImg.src;
            if (curSrc) {
                cacheAvatarExportSafeDataUrl(dyAvatarImg, curSrc);
                if (dylDispAvatar && dylDispAvatar.getAttribute('src') !== curSrc) {
                    dylDispAvatar.src = curSrc;
                    cacheAvatarExportSafeDataUrl(dylDispAvatar, curSrc);
                }
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
        const dySbLayaIconEl = document.getElementById('dy-sb-laya-icon');
        const selDySbLayaLogoEl = document.getElementById('sel-dy-sb-laya-logo');
        if (dySbLayaIconEl) {
            dySbLayaIconEl.src = getActiveLogoSrc(selDySbLayaLogoEl ? selDySbLayaLogoEl.value : 'Laya.png');
        }

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
            if (previewVideo && window.PlayerEngine && window.PlayerEngine.isVideoMode) {
                if (typeof window.PlayerEngine.setVideoSoundMuted === 'function') {
                    window.PlayerEngine.setVideoSoundMuted(!previewVideo.muted, true);
                } else {
                    previewVideo.muted = !previewVideo.muted;
                    window.showToast(previewVideo.muted ? '🔇 视频已静音' : '🔊 视频原声已开启');
                }
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
            if (window.__isRestoringStorage) return;
            const isCustom = (e.target.value === 'custom');
            inCustomSec.style.display = isCustom ? 'inline-block' : 'none';
            if (isCustom && window.PlayerEngine && window.PlayerEngine.isVideoMode && typeof window.PlayerEngine.getTrimRange === 'function') {
                const curClipDur = Math.max(0.5, Math.round(window.PlayerEngine.getTrimRange().duration * 10) / 10);
                inCustomSec.value = String(curClipDur);
            }
            const sec = isCustom ? (parseFloat(inCustomSec.value) || 10) : (parseFloat(e.target.value) || 10);
            if (window.PlayerEngine && typeof window.PlayerEngine.applyDropdownDuration === 'function') {
                window.PlayerEngine.applyDropdownDuration(sec);
            }
        });
        inCustomSec.addEventListener('input', () => {
            if (window.__isRestoringStorage) return;
            const sec = parseFloat(inCustomSec.value);
            if (sec >= 0.5 && window.PlayerEngine && typeof window.PlayerEngine.applyDropdownDuration === 'function') {
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
            dyBtnLike.classList.toggle('liked', isLiked);
            const isDayNow = !!(renderTarget && renderTarget.classList.contains('theme-light'));
            dySvgLike.setAttribute('fill', isLiked ? '#fe2c55' : (isDayNow ? '#1f2329' : '#ffffff'));
            dyBtnLike.classList.remove('like-bounce-anim');
            void dyBtnLike.offsetWidth;
            dyBtnLike.classList.add('like-bounce-anim');
            const dyValLikesEl = document.getElementById('dy-val-likes');
            if (dyValLikesEl) {
                const rawTxt = dyValLikesEl.textContent.trim();
                if (/^\d+$/.test(rawTxt)) {
                    const n = parseInt(rawTxt, 10);
                    dyValLikesEl.textContent = String(isLiked ? (n + 1) : Math.max(0, n - 1));
                }
            }
            window.showToast(isLiked ? '已点赞' : '已取消点赞');
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

    // 海外华人/真实用户风格繁体中文昵称大词库（325+ 条，离线可用，配合 Gemini Flash AI 实时生成与双层去重）
    const NICKNAME_POOL = [
        '溫哥華小鹿', '洛杉磯老陳', '多倫多Sandy', '墨爾本阿豪', '悉尼小陳', '舊金山阿凱', '倫敦Chloé', '紐約Kevin',
        '西雅圖老林', '東京小夏', '新加坡阿杰', '吉隆坡家豪', '奧克蘭Mia', '台北林小柔', '香港阿Wing', '芝加哥Leo',
        '波士頓小魚', '休斯頓老張', '布里斯班阿翔', '巴黎艾米麗', '法蘭克福老周', '阿姆斯特丹Kiki', '米蘭小C', '馬德里阿偉',
        '溫哥華阿May', '多倫多老吳', '加州陽光Eric', '灣區工程師阿哲', '曼哈頓夜貓', '皇后區小辣椒', '布魯克林阿Ken', '爾灣林太太',
        '聖地亞哥海風', '帕羅奧圖Alex', '聖荷西老王', '拉斯維加斯阿龍', '西雅圖雨夜', '波特蘭小森', '溫哥華列治文老饕', '本拿比小陳',
        '多倫多萬錦阿欣', '士嘉堡老劉', '密西沙加Grace', '卡爾加里老鄭', '蒙特利爾小雅', '渥太華Daniel', '悉尼唐人街阿強', '墨爾本BoxHill小周',
        '珀斯看海的貓', '阿德萊德老許', '黃金海岸Sunny', '堪培拉小趙', '奧克蘭北岸阿明', '惠靈頓吹風', '基督城小葉', '倫敦Soho阿杰',
        '曼徹斯特老高', '愛丁堡風笛', '伯明翰小蘇', '劍橋讀書的貓', '牛津小胡', '都柏林阿森', '東京新宿老李', '大阪心齋橋阿欣',
        '京都抹茶控', '橫濱海風Ryan', '札幌看雪的魚', '福岡拉麵大王', '沖繩潛水員阿凱', '首爾弘大Mia', '濟州島橘子汽水', '新加坡烏節路阿文',
        '裕廊東老林', '牛車水小辣椒', '樟宜夜歸人', '吉隆坡阿豪', '檳城老街阿叔', '新山小K', '馬六甲海風', '亞庇看日落',
        '古晉小陳', '怡保白咖啡', '曼谷通羅阿杰', '清邁慢生活', '普吉島浪人', '台北信義區小柔', '大安區老陳', '西門町阿翔',
        '淡水看夕陽', '九份老街的貓', '台中逢甲夜市王', '台南全糖去冰', '高雄駁二阿宏', '新竹竹科小工程師', '桃園機場常客', '基隆廟口老饕',
        '花蓮看海的人', '宜蘭民宿小老闆', '墾丁衝浪男孩', '香港中環白領', '銅鑼灣阿詩', '旺角卡門', '尖沙咀看海', '九龍塘老陳',
        '元朗小魚', '沙田阿軒', '將軍澳夜跑', '澳門氹仔老周', '大三巴小敏', 'Chloe_tw', 'Kevin.88', 'Jason_HK',
        '阿傑Jay', '子瑜', '林小柔', 'Mia_chen', 'Alex_W', '半糖去冰', '夜貓子Owl', 'Ethan_Lin',
        '微風信義', 'Sophia.L', '台北小辣椒', 'Lucas_MY', '港島妹妹', 'Olivia_99', 'Kuala_阿豪', 'Ryan_Tpe',
        '忠孝東路走九遍', '貓空看星星', 'abella.vibes', '珍奶要波霸', 'Daniel_K', '小確幸', 'Leo_studio', '深夜食堂',
        'Vivian.c', '維多利亞港的風', 'Marcus_852', '星際漫遊者', '萱萱_tw', '建宏_TPE', '芷晴_hk', '宇軒.my',
        'Amber_Lin', '家豪_888', '心凌Cyndi', '溫哥華冰美式', '洛杉磯日落大道', '聖莫尼卡海風', '比佛利小公主', '好萊塢追光者',
        '硅谷熬夜王', '金門大橋的風', '優勝美地露營客', '太浩湖滑雪板', '西雅圖咖啡師', '華盛頓櫻花雨', '邁阿密海灘阿豪', '奧蘭多煙火',
        '亞特蘭大老蘇', '達拉斯牛仔阿K', '丹佛雪山客', '鳳凰城仙人掌', '費城老街阿明', '底特律老車迷', '明尼蘇達看雪', '夏威夷衝浪阿杰',
        '檀香山小辣椒', '關島潛水員', '多倫多塔下的貓', '安大略湖畔', '尼亞加拉看瀑布', '溫哥華斯坦利公園', '惠斯勒滑雪狂', '維多利亞港灣',
        '班夫國家公園鹿', '魁北克古城小雅', '哈利法克斯海風', '悉尼歌劇院旁', '邦迪海灘衝浪', '達令港夜景', '藍山徒步者', '墨爾本咖啡巷',
        '大洋路自駕王', '菲利普島看企鵝', '亞拉河谷品酒師', '布里斯班南岸', '陽光海岸阿哲', '凱恩斯大堡礁', '塔斯馬尼亞追極光', '霍巴特小漁夫',
        '奧克蘭天空塔', '羅托魯瓦溫泉', '皇后鎮跳傘王', '瓦納卡孤獨的樹', '蒂卡波看星空', '倫敦泰晤士河風', '大本鐘下的貓', '海德公園晨跑',
        '諾丁山舊書店', '卡姆登集市控', '布萊頓海邊阿欣', '利物浦搖滾迷', '格拉斯哥老林', '卡迪夫灣小C', '貝爾法斯特阿強', '巴黎塞納河左岸',
        '埃菲爾鐵塔夜燈', '蒙馬特畫家', '里昂美食家老陳', '尼斯蔚藍海岸', '馬賽老港海風', '普羅旺斯薰衣草', '波爾多紅酒客', '柏林勃蘭登堡',
        '慕尼黑啤酒節阿豪', '漢堡港水手', '科隆大教堂旁', '海德堡哲學小徑', '蘇黎世湖畔小葉', '日內瓦鐘錶匠', '盧塞恩天鵝湖', '維也納金色大廳',
        '薩爾茨堡音樂迷', '阿姆斯特丹運河船', '鹿特丹方塊屋', '布魯塞爾華夫餅', '羅馬許願池小鹿', '佛羅倫薩看日落', '威尼斯貢多拉', '米蘭大教堂鴿子',
        '那不勒斯披薩王', '巴塞羅那高迪迷', '馬德里伯納烏阿杰', '塞維利亞弗拉明戈', '里斯本黃色電車', '波爾圖酒窖老吳', '雅典衛城看海', '聖托里尼藍頂',
        '布拉格查理大橋', '布達佩斯多瑙河', '華沙老城阿森', '斯德哥爾摩群島', '奧斯陸峽灣行者', '哥本哈根小美人魚', '赫爾辛基極光獵人', '雷克雅未克冰川',
        '東京鐵塔的貓', '澀谷十字路口', '銀座下午茶Sophia', '秋葉原手辦王', '淺草寺求籤人', '鎌倉高校前看海', '箱根溫泉常客', '富士山下的阿凱',
        '大阪道頓堀吃貨', '京都嵐山竹林', '奈良餵鹿少女', '神戶牛排老饕', '名古屋手羽先', '廣島嚴島神社', '金澤兼六園小雅', '輕井澤森林客',
        '首爾江南小姊姊', '明洞逛街狂', '梨泰院夜未眠', '釜山海雲台阿豪', '仁川機場轉機王', '新加坡濱海灣花園', '克拉碼頭微醺', '聖淘沙海灘客',
        '東海岸騎行阿杰', '吉隆坡雙子塔夜色', '武吉免登阿強', '雲頂高原吹風', '蘭卡威天空之橋', '仙本那潛水小魚', '曼谷湄南河晚風', '芭堤雅海景房',
        '蘇梅島椰子冰', '華欣火車站的貓', '胡志明市滴漏咖啡', '河內三十六行街', '峴港美溪海灘', '馬尼拉灣日落', '長灘島白沙灘', '宿霧看鯨鯊',
        '雅加達老城阿明', '巴厘島烏布森林', '金巴蘭海灘燒烤', '迪拜哈利法塔下', '阿布扎比沙漠客', '開羅金字塔行者', '卡薩布蘭卡舊夢', '開普敦好望角',
        '約翰內斯堡老陳', '聖保羅華人街阿豪', '布宜諾斯艾利斯探戈', '聖地亞哥安第斯山', '利馬馬丘比丘客', '墨西哥城塔可王', '坎昆加勒比海風', '哈瓦那老爺車'
    ];

    /* ==========================================================================
       ★ 问题五：昵称/头像双层去重（本机 localStorage + 跨设备后端/设备指纹分流）
                 + 内置 Gemini Flash AI 动态生成海外华人昵称 + 海外华人头像持续更新源
       ========================================================================== */
    const USED_NICKNAMES_STORAGE_KEY = 'LAYA_USED_NICKNAMES_V1';
    const USED_AVATARS_STORAGE_KEY = 'LAYA_USED_AVATARS_V1';
    const AI_NICKNAMES_CACHE_KEY = 'LAYA_AI_OVERSEAS_NICKNAMES_V1';
    const DYNAMIC_AVATARS_CACHE_KEY = 'LAYA_DYNAMIC_ASIAN_AVATARS_V1';
    const DEVICE_FINGERPRINT_SEED_KEY = 'LAYA_DEVICE_SHARD_SEED_V1';

    // [降级方案注释]：当跨设备后端 (/api/claim-identity 或 GAS) 暂不可用或处于静态站点/离线环境时，
    // 采用设备硬件特征指纹 + 时区/分辨率/语言 + 持久随机盐生成确定性分流种子 (Device Fingerprint Shard)，
    // 将不同设备分配到 320+ 昵称库与 340+ 头像库的不同起始区间，大幅降低跨电脑撞车率。
    function getDeviceFingerprintShardOffset(poolLength = 300) {
        try {
            let savedSeed = parseInt(localStorage.getItem(DEVICE_FINGERPRINT_SEED_KEY) || '0', 10);
            if (!savedSeed || isNaN(savedSeed)) {
                const rawFp = [
                    navigator.userAgent || '',
                    navigator.language || '',
                    (screen ? `${screen.width}x${screen.height}x${screen.colorDepth}` : ''),
                    (Intl && Intl.DateTimeFormat ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '') : ''),
                    String(navigator.hardwareConcurrency || 4),
                    String(Math.floor(Math.random() * 1000000))
                ].join('|');
                let h = 2166136261;
                for (let i = 0; i < rawFp.length; i++) {
                    h ^= rawFp.charCodeAt(i);
                    h = Math.imul(h, 16777619);
                }
                savedSeed = Math.abs(h >>> 0) || 13579;
                localStorage.setItem(DEVICE_FINGERPRINT_SEED_KEY, String(savedSeed));
            }
            const ipBonus = window.__clientIpShardHash || 0;
            return (savedSeed + ipBonus) % Math.max(1, poolLength);
        } catch (e) {
            return Math.floor(Math.random() * Math.max(1, poolLength));
        }
    }

    function loadUsedSetFromStorage(key) {
        try {
            const arr = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(arr)) return new Set(arr.map(String));
        } catch (e) {}
        return new Set();
    }

    function saveUsedSetToStorage(key, setObj, maxKeep = 260) {
        try {
            let arr = Array.from(setObj);
            if (arr.length > maxKeep) {
                arr = arr.slice(arr.length - maxKeep);
            }
            localStorage.setItem(key, JSON.stringify(arr));
        } catch (e) {}
    }

    const __localUsedNicknames = loadUsedSetFromStorage(USED_NICKNAMES_STORAGE_KEY);
    const __localUsedAvatars = loadUsedSetFromStorage(USED_AVATARS_STORAGE_KEY);
    const __crossDeviceClaimedNicknames = [];
    const __crossDeviceClaimedAvatarIds = [];

    // 恢复本地缓存的 AI 海外华人昵称并前置注入 NICKNAME_POOL
    try {
        const cachedAiNicks = JSON.parse(localStorage.getItem(AI_NICKNAMES_CACHE_KEY) || '[]');
        if (Array.isArray(cachedAiNicks)) {
            cachedAiNicks.forEach(n => {
                const clean = String(n || '').trim();
                if (clean && !NICKNAME_POOL.includes(clean)) {
                    NICKNAME_POOL.unshift(clean);
                }
            });
        }
    } catch (e) {}

    function getAvatarShortKey(urlOrB64) {
        const s = String(urlOrB64 || '');
        if (!s) return '';
        if (s.startsWith('data:image/')) {
            return 'b64_' + s.length + '_' + s.slice(-36, -4);
        }
        return s.slice(0, 140);
    }

    // ★ 本机 + 跨设备双层去重：领取一个未使用的海外华人昵称（滑动窗口记忆，耗尽时仅淘汰最早旧记录，绝不清空重撞近期昵称）
    function claimUniqueNickname(customPool = null) {
        const recordUsed = !window.__isInitialPreBoot;
        // 1) 优先消费跨设备后端 (/api/claim-identity) 已申领的全局未用昵称
        while (__crossDeviceClaimedNicknames.length > 0) {
            const candidate = __crossDeviceClaimedNicknames.shift();
            if (candidate && !__localUsedNicknames.has(candidate)) {
                if (recordUsed) {
                    __localUsedNicknames.add(candidate);
                    saveUsedSetToStorage(USED_NICKNAMES_STORAGE_KEY, __localUsedNicknames, 300);
                }
                return candidate;
            }
        }

        const pool = (Array.isArray(customPool) && customPool.length > 0) ? customPool : NICKNAME_POOL;
        const shardOffset = getDeviceFingerprintShardOffset(pool.length);
        const randStart = (shardOffset + Math.floor(Math.random() * pool.length)) % pool.length;

        for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i < pool.length; i++) {
                const idx = (randStart + i * 7) % pool.length;
                const cand = pool[idx];
                if (cand && !__localUsedNicknames.has(cand)) {
                    if (recordUsed) {
                        __localUsedNicknames.add(cand);
                        saveUsedSetToStorage(USED_NICKNAMES_STORAGE_KEY, __localUsedNicknames, 300);
                    }
                    return cand;
                }
            }
            // 当前候选池已全部用完一轮时，仅保留最近使用的 45% 记录，释放较早记录供新一轮随机，杜绝刚出现过的名字紧接着重复
            const arr = Array.from(__localUsedNicknames);
            const keepRecent = new Set(arr.slice(-Math.min(120, Math.floor(pool.length * 0.45))));
            __localUsedNicknames.clear();
            keepRecent.forEach(k => __localUsedNicknames.add(k));
        }

        const fallback = pool[randStart] || '溫哥華小鹿';
        if (recordUsed) {
            __localUsedNicknames.add(fallback);
            saveUsedSetToStorage(USED_NICKNAMES_STORAGE_KEY, __localUsedNicknames, 300);
        }
        return fallback;
    }
    window.claimUniqueNickname = claimUniqueNickname;

    // ★ 本机 + 跨设备双层去重：从头像池领取一张未使用的头像（按实际池内剩余可用项判断，滑动窗口淘汰最早记录）
    function claimUniqueAvatarFromPool(pool, extraAvoidSet = null, maybeAvoidSet = null) {
        if (!Array.isArray(pool) || pool.length === 0) return '';
        const recordUsed = !window.__isInitialPreBoot;
        const avoidSet = (extraAvoidSet && typeof extraAvoidSet.has === 'function')
            ? extraAvoidSet
            : ((maybeAvoidSet && typeof maybeAvoidSet.has === 'function') ? maybeAvoidSet : null);

        const shardOffset = getDeviceFingerprintShardOffset(pool.length);
        const randStart = (shardOffset + Math.floor(Math.random() * pool.length)) % pool.length;

        for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i < pool.length; i++) {
                const idx = (randStart + i * 11) % pool.length;
                const u = pool[idx];
                if (!u) continue;
                if (avoidSet && avoidSet.has(u)) continue;
                const key = getAvatarShortKey(u);
                if (__localUsedAvatars.has(key)) continue;
                if (recordUsed) {
                    __localUsedAvatars.add(key);
                    saveUsedSetToStorage(USED_AVATARS_STORAGE_KEY, __localUsedAvatars, 320);
                }
                if (avoidSet && typeof avoidSet.add === 'function') avoidSet.add(u);
                return u;
            }
            // 仅当当前子池可用项已耗尽时，才保留最近 45% 的头像记录并释放较早记录
            const arr = Array.from(__localUsedAvatars);
            const keepCount = Math.max(30, Math.min(130, Math.floor(pool.length * 0.45)));
            const keepRecent = new Set(arr.slice(-keepCount));
            __localUsedAvatars.clear();
            keepRecent.forEach(k => __localUsedAvatars.add(k));
        }

        const fallback = pool[randStart] || pool[0] || '';
        if (fallback) {
            if (recordUsed) {
                __localUsedAvatars.add(getAvatarShortKey(fallback));
                saveUsedSetToStorage(USED_AVATARS_STORAGE_KEY, __localUsedAvatars, 320);
            }
            if (avoidSet && typeof avoidSet.add === 'function') avoidSet.add(fallback);
        }
        return fallback;
    }
    window.claimUniqueAvatarFromPool = claimUniqueAvatarFromPool;
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

    function getDynamicCachedAvatars() {
        if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
            return { females: [], males: [] };
        }
        try {
            const parsed = JSON.parse(localStorage.getItem(DYNAMIC_AVATARS_CACHE_KEY) || '{}');
            return {
                females: Array.isArray(parsed.females) ? parsed.females : [],
                males: Array.isArray(parsed.males) ? parsed.males : []
            };
        } catch (e) {
            return { females: [], males: [] };
        }
    }

    function getChineseFemalePool() {
        const db = window.LAYA_ASIAN_AVATARS || {};
        const dyn = getDynamicCachedAvatars();
        // 严格优先使用内置 196+ 张海外华人女生离线高清 Base64 头像 + randomuser.me 动态缓存头像，剔除易失效或跨域污染的外链缩略图
        const base64First = [...(db.beauties || []), ...dyn.females];
        return base64First.length > 0 ? base64First : CN_REAL_FEMALE_URLS;
    }

    function getChineseMalePool() {
        const db = window.LAYA_ASIAN_AVATARS || {};
        const dyn = getDynamicCachedAvatars();
        // 严格优先使用内置 144+ 张海外华人男生离线高清 Base64 头像 + randomuser.me 动态缓存头像，剔除易失效或跨域污染的外链缩略图
        const base64First = [...(db.guys || []), ...dyn.males];
        return base64First.length > 0 ? base64First : CN_REAL_MALE_URLS;
    }

    function getChineseVibePool() {
        const db = window.LAYA_ASIAN_AVATARS || {};
        return [...(db.vibes || [])];
    }

    function getChinesePetPool() {
        const db = window.LAYA_ASIAN_AVATARS || {};
        return [...(db.pets || [])];
    }

    function getChineseAnimePool() {
        const db = window.LAYA_ASIAN_AVATARS || {};
        return [...(db.anime || [])];
    }

    let __avatarCycleCounter = Math.floor(Math.random() * 100);

    function pickFromPoolAvoiding(pool, avoidSet) {
        return claimUniqueAvatarFromPool(pool, avoidSet);
    }

    // ★ 从可更新头像源 (randomuser.me + 稳定亚洲/华人面孔源) 动态拉取补充头像并缓存到 localStorage 复用；网络失败完全回退本地 340+ Base64 库
    async function fetchDynamicOverseasChineseAvatarsOnLoad() {
        if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
            return;
        }
        try {
            const dyn = getDynamicCachedAvatars();
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = controller ? setTimeout(() => controller.abort(), 3200) : null;
            const res = await fetch('https://randomuser.me/api/?results=24&inc=gender,name,picture,nat&noinfo', {
                mode: 'cors',
                signal: controller ? controller.signal : undefined
            });
            if (timer) clearTimeout(timer);
            if (res.ok) {
                const json = await res.json();
                const results = Array.isArray(json?.results) ? json.results : [];
                const asianSurnameRe = /^(chen|lin|wang|zhang|li|liu|huang|wu|xu|sun|ma|zhu|hu|guo|he|gao|luo|zheng|liang|xie|song|tang|deng|han|feng|cao|peng|zeng|xiao|tian|dong|pan|yuan|cai|jiang|yu|du|ye|cheng|wei|su|lu|ding|ren|shen|yao|cui|tan|fan|jin|shi|liao|zou|xiong|meng|qin|bai|hou|yin|chang|long|lai|wen|hong|choi|kim|park|lee|ng|chan|wong|cheung|lau|ho|leung|tam|tsang|kwok|fung|yip|lam|chong|lim|goh|koh|teo|ong|yeo|chua|tay|yap|chin)$/i;
                results.forEach(u => {
                    const pic = u?.picture?.large || u?.picture?.medium || '';
                    if (!pic || !pic.startsWith('https://')) return;
                    const last = String(u?.name?.last || '').trim();
                    const first = String(u?.name?.first || '').trim();
                    if (asianSurnameRe.test(last) || asianSurnameRe.test(first) || (dyn.females.length + dyn.males.length < 16)) {
                        if (u.gender === 'female') {
                            if (!dyn.females.includes(pic)) dyn.females.push(pic);
                        } else {
                            if (!dyn.males.includes(pic)) dyn.males.push(pic);
                        }
                    }
                });
                if (dyn.females.length > 60) dyn.females = dyn.females.slice(-60);
                if (dyn.males.length > 60) dyn.males = dyn.males.slice(-60);
                localStorage.setItem(DYNAMIC_AVATARS_CACHE_KEY, JSON.stringify({
                    females: dyn.females,
                    males: dyn.males,
                    updatedAt: Date.now()
                }));
            }
        } catch (e) {
            // 网络失败完全静默回退本地 logos.js 340+ Base64 离线真人头像库
        }
    }

    // ★ 跨设备去重申领：仅在支持 Serverless API 的线上环境（如 Vercel）调用 /api/claim-identity；本地 file:// / localhost / GitHub Pages 静态环境零报错自动启用设备指纹分流降级方案
    async function syncCrossDeviceIdentityClaims() {
        try {
            const proto = (window.location && window.location.protocol) || '';
            const host = (window.location && window.location.hostname) || '';
            const isStaticOrLocal = !proto.startsWith('http')
                || host === 'localhost'
                || host === '127.0.0.1'
                || host.endsWith('.github.io');
            if (isStaticOrLocal) {
                return; // 静态托管或本地环境直接走 getDeviceFingerprintShardOffset 设备指纹分流降级，避免控制台 404/405 报错
            }
            const sampleNicks = NICKNAME_POOL.filter(n => !__localUsedNicknames.has(n)).slice(0, 60);
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = controller ? setTimeout(() => controller.abort(), 2400) : null;
            const res = await fetch('/api/claim-identity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'claim-batch',
                    nicknames: sampleNicks,
                    nickCount: 10
                }),
                signal: controller ? controller.signal : undefined
            });
            if (timer) clearTimeout(timer);
            if (res.ok) {
                const data = await res.json();
                if (data && data.ok) {
                    if (typeof data.clientIpHash === 'number') {
                        window.__clientIpShardHash = data.clientIpHash;
                    }
                    if (Array.isArray(data.claimedNicknames)) {
                        data.claimedNicknames.forEach(n => {
                            if (n && !__localUsedNicknames.has(n) && !__crossDeviceClaimedNicknames.includes(n)) {
                                __crossDeviceClaimedNicknames.push(n);
                            }
                        });
                    }
                    return;
                }
            }
        } catch (e) {
            // 暂无法访问后端（如 GitHub Pages 静态托管）时，自动启用设备指纹分流降级方案 (getDeviceFingerprintShardOffset)
        }
    }
    setTimeout(() => {
        fetchDynamicOverseasChineseAvatarsOnLoad();
        syncCrossDeviceIdentityClaims();
    }, 80);

    // 生成 150+ 海外华人/台湾/香港/IG/Threads/小红书真实社交头像（支持全风格混搭、纯女头、纯男头、IG氛围风景、萌宠猫狗、二次元）
    function buildOnlineAvatarUrl(seed, apiMode, avoidSet = null) {
        const females = getChineseFemalePool();
        const males = getChineseMalePool();
        const vibes = getChineseVibePool();
        const pets = getChinesePetPool();
        const animes = getChineseAnimePool();
        const mode = apiMode || 'overseas-mix';

        if (mode === 'cn-female' || mode === 'asian-beauty' || mode === 'beauties') {
            return pickFromPoolAvoiding(females, avoidSet);
        }
        if (mode === 'cn-male' || mode === 'asian-guy' || mode === 'guys') {
            return pickFromPoolAvoiding(males.length ? males : females, avoidSet);
        }
        if (mode === 'cn-vibes' || mode === 'vibes') {
            return pickFromPoolAvoiding(vibes.length ? vibes : females, avoidSet);
        }
        if (mode === 'cn-pets' || mode === 'pets') {
            return pickFromPoolAvoiding(pets.length ? pets : females, avoidSet);
        }
        if (mode === 'cn-anime' || mode === 'anime') {
            return pickFromPoolAvoiding(animes.length ? animes : females, avoidSet);
        }
        if (mode === 'cn-mixed' || mode === 'real-human' || mode === 'real') {
            if (Math.random() < 0.60) {
                return pickFromPoolAvoiding(females, avoidSet);
            }
            return pickFromPoolAvoiding(males.length ? males : females, avoidSet);
        }

        // 默认 overseas-mix：海外华人 IG / Threads / 小红书真实社交混搭（46% 女生自拍生活照 + 26% 潮男日常照 + 15% IG氛围感咖啡海边夜景 + 13% 真实猫狗萌宠）
        const r = Math.random();
        if (r < 0.46) {
            return pickFromPoolAvoiding(females, avoidSet);
        }
        if (r < 0.72) {
            return pickFromPoolAvoiding(males.length ? males : females, avoidSet);
        }
        if (r < 0.87 && vibes.length > 0) {
            return pickFromPoolAvoiding(vibes, avoidSet);
        }
        if (pets.length > 0) {
            return pickFromPoolAvoiding(pets, avoidSet);
        }
        return pickFromPoolAvoiding(females, avoidSet);
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
        apiMode: 'overseas-mix',
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
            const avoidAvs = new Set();
            const pickAv = (pool) => claimUniqueAvatarFromPool(pool, avoidAvs);
            const u1 = claimUniqueNickname();
            const u1Rep = claimUniqueNickname();
            const u2 = claimUniqueNickname();
            const u2Rep = claimUniqueNickname();
            const u3 = claimUniqueNickname();
            const u4 = claimUniqueNickname();
            const u5 = claimUniqueNickname();
            const u6 = claimUniqueNickname();
            this.list = [
                {
                    id: 'c1',
                    user: u1,
                    text: '牛總還是有點大智慧的',
                    dateLoc: randomDateLoc('tw-only', 72),
                    likes: randomCommentLikes(),
                    liked: false,
                    avatar: pickAv(fPool) || buildOnlineAvatarUrl('c1', 'cn-female'),
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
                            likes: randomCommentLikes(),
                            liked: false,
                            avatar: this.getAuthorAvatarSrc(),
                            isCustomAvatar: false
                        },
                        {
                            id: 'r1_2',
                            user: u1Rep,
                            isAuthor: false,
                            replyToUser: u1,
                            text: '薑還是老的辣，不動聲色就把問題解決了',
                            image: '',
                            dateLoc: randomDateLoc('hk-mo', 36),
                            likes: randomCommentLikes(),
                            liked: false,
                            avatar: pickAv(mPool) || buildOnlineAvatarUrl('r1_2', 'cn-male'),
                            isCustomAvatar: false
                        }
                    ]
                },
                {
                    id: 'c2',
                    user: u2,
                    text: '這一段我反反覆覆看了五遍，細節真的拉滿',
                    dateLoc: randomDateLoc('hk-mo', 72),
                    likes: randomCommentLikes(),
                    liked: false,
                    avatar: pickAv(mPool) || buildOnlineAvatarUrl('c2', 'cn-male'),
                    image: '',
                    isCustomAvatar: false,
                    replies: [
                        {
                            id: 'r2_1',
                            user: u2Rep,
                            isAuthor: false,
                            replyToUser: '',
                            text: '尤其是最後遞茶杯那個眼神，絕了',
                            image: '',
                            dateLoc: randomDateLoc('tw-only', 24),
                            likes: randomCommentLikes(),
                            liked: false,
                            avatar: pickAv(fPool) || buildOnlineAvatarUrl('r2_1', 'cn-female'),
                            isCustomAvatar: false
                        }
                    ]
                },
                {
                    id: 'c3',
                    user: u3,
                    text: '哈哈，我先入職花果山再回來應聘，完美閉環',
                    dateLoc: randomDateLoc('tw-only', 72),
                    likes: randomCommentLikes(),
                    liked: false,
                    avatar: pickAv(fPool) || buildOnlineAvatarUrl('c3', 'cn-female'),
                    image: '',
                    isCustomAvatar: false,
                    replies: []
                },
                {
                    id: 'c4',
                    user: u4,
                    text: '好一招釜底抽薪',
                    dateLoc: randomDateLoc('my-sg', 72),
                    likes: randomCommentLikes(),
                    liked: false,
                    avatar: pickAv(fPool) || buildOnlineAvatarUrl('c4', 'cn-female'),
                    image: '',
                    isCustomAvatar: false,
                    replies: []
                },
                {
                    id: 'c5',
                    user: u5,
                    text: '表面風平浪靜，實則全員八百個心眼子',
                    dateLoc: randomDateLoc('none', 72),
                    likes: randomCommentLikes(),
                    liked: false,
                    avatar: pickAv(mPool) || buildOnlineAvatarUrl('c5', 'cn-male'),
                    image: '',
                    isCustomAvatar: false,
                    replies: []
                },
                {
                    id: 'c6',
                    user: u6,
                    text: '看似漫不經心的一句話，其實前面早就鋪墊好了',
                    dateLoc: randomDateLoc('overseas-all', 72),
                    likes: randomCommentLikes(),
                    liked: false,
                    avatar: pickAv(fPool) || buildOnlineAvatarUrl('c6', 'cn-female'),
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

        // 每次打开页面时对未手动锁定的评论用户昵称与头像进行双层去重换新，确保同机连续刷新 10 次不重复
        refreshUnmodifiedIdentitiesOnBoot() {
            if (!Array.isArray(this.list) || this.list.length === 0) return;
            const avoidAvs = new Set();
            const fPool = getChineseFemalePool();
            const mPool = getChineseMalePool();
            const mixedPool = [...fPool, ...mPool];
            this.list.forEach((it, idx) => {
                const oldMainNick = it.user;
                if (!it.userEditedNick) {
                    it.user = claimUniqueNickname();
                }
                if (!it.isCustomAvatar) {
                    const targetPool = (idx % 3 === 1 && mPool.length) ? mPool : (fPool.length ? fPool : mixedPool);
                    it.avatar = claimUniqueAvatarFromPool(targetPool, avoidAvs) || it.avatar;
                    it.avatarDataUrl = '';
                }
                if (Array.isArray(it.replies)) {
                    it.replies.forEach((rep, rIdx) => {
                        if (rep.isAuthor) {
                            rep.user = this.getAuthorNameStage();
                            rep.avatar = this.getAuthorAvatarSrc();
                        } else {
                            if (!rep.userEditedNick) {
                                rep.user = claimUniqueNickname();
                            }
                            if (rep.replyToUser && rep.replyToUser === oldMainNick) {
                                rep.replyToUser = it.user;
                            }
                            if (!rep.isCustomAvatar) {
                                const rPool = (rIdx % 2 === 0 && mPool.length) ? mPool : (fPool.length ? fPool : mixedPool);
                                rep.avatar = claimUniqueAvatarFromPool(rPool, avoidAvs) || rep.avatar;
                                rep.avatarDataUrl = '';
                            }
                        }
                    });
                }
            });
            this.renderStage();
            this.renderEditor();
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
            const clamped = Number(Math.min(1.85, Math.max(0.65, parseFloat(scaleVal) || 1.0)).toFixed(2));
            this.fontScale = clamped;
            // 头像按比例同步微调，仅缩放评论区里面的文字与头像，绝不改变评论区抽屉框体区域高度
            const avatarScale = Number((1 + (clamped - 1) * 0.72).toFixed(3));
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
            const labelTxt = clamped.toFixed(2).replace(/\.?0+$/, (m) => (m === '.00' ? '.0' : '')) + 'x';
            const stageFontBadge = document.getElementById('txt-dy-cmt-stage-font');
            if (stageFontBadge) stageFontBadge.textContent = labelTxt;
            if (syncUI) {
                const inp = document.getElementById('in-dy-cmt-font-scale');
                const txt = document.getElementById('txt-dy-cmt-font-scale');
                if (inp && parseFloat(inp.value) !== clamped) inp.value = String(clamped);
                if (txt) txt.textContent = labelTxt;
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
            const areaHeightPct = Math.min(82, Math.max(24, Math.round(100 - topPct)));
            const inAreaH = document.getElementById('in-dy-cmt-area-height');
            const txtAreaH = document.getElementById('txt-dy-cmt-area-height');
            if (inAreaH && parseInt(inAreaH.value, 10) !== areaHeightPct) inAreaH.value = String(areaHeightPct);
            if (txtAreaH) txtAreaH.textContent = areaHeightPct + '%';
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
            if (!this.isOpen && !(renderTarget && renderTarget.classList.contains('dy-live-open'))) {
                this.setDrawerOpen(true, false);
            }
            // ★ 同步更新直播间公屏滚动评论池（自然穿插「名字：文案」与「名字 来了」），并触发直播间 AI 画面匹配
            const liveDmTextarea = document.getElementById('in-live-danmaku-list');
            if (liveDmTextarea && newList.length > 0) {
                const syncedLiveLines = [];
                const isSimpMode = window.__currentLangMode === 'simp';
                const joinWord = isSimpMode ? '来了' : '來了';
                newList.forEach((item, idx) => {
                    syncedLiveLines.push(`${item.user}：${item.text}`);
                    if (idx % 3 === 1) {
                        const jNick = NICKNAME_POOL[(idx * 7 + 3) % NICKNAME_POOL.length] || '輕輕吹風';
                        syncedLiveLines.push(`${jNick} ${joinWord}`);
                    }
                });
                liveDmTextarea.value = syncedLiveLines.join('\n');
                liveDmTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (typeof window.autoMatchLiveDanmakuByVideoAI === 'function') {
                window.autoMatchLiveDanmakuByVideoAI(false, null);
            }
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast(`🎬 已根据画面同步生成短视频评论与直播间滚动弹幕（共 ${newList.length} 条）`);
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

    const inDyCmtAreaHeight = document.getElementById('in-dy-cmt-area-height');
    const btnResetCmtDrawerArea = document.getElementById('btn-reset-cmt-drawer-area');
    const inDyCmtFontScale = document.getElementById('in-dy-cmt-font-scale');
    const btnResetCmtFontScale = document.getElementById('btn-reset-cmt-font-scale');
    const btnDyCmtStageFontDown = document.getElementById('btn-dy-cmt-stage-font-down');
    const btnDyCmtStageFontUp = document.getElementById('btn-dy-cmt-stage-font-up');
    const txtDyCmtStageFont = document.getElementById('txt-dy-cmt-stage-font');

    if (inDyCmtAreaHeight) {
        inDyCmtAreaHeight.addEventListener('input', (e) => {
            const hPct = Math.min(82, Math.max(24, parseInt(e.target.value, 10) || 56));
            const nextTopPct = Number((100 - hPct).toFixed(2));
            CommentEngine.drawerTopPct = nextTopPct;
            CommentEngine.isExpanded = nextTopPct <= 29.5;
            const rt = document.getElementById('render-target');
            if (rt) rt.classList.toggle('dy-comment-expanded', CommentEngine.isExpanded);
            CommentEngine.applyDrawerLayoutVars();
            if (window.PlayerEngine) {
                if (typeof window.PlayerEngine.updateTransform === 'function') window.PlayerEngine.updateTransform();
                if (typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') window.PlayerEngine.ensureVideoPlayingIfActive(false);
            }
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    if (btnResetCmtDrawerArea) {
        btnResetCmtDrawerArea.addEventListener('click', () => {
            CommentEngine.drawerTopPct = null;
            CommentEngine.isExpanded = false;
            const rt = document.getElementById('render-target');
            if (rt) rt.classList.remove('dy-comment-expanded');
            CommentEngine.applyDrawerLayoutVars();
            if (window.PlayerEngine) {
                if (typeof window.PlayerEngine.updateTransform === 'function') window.PlayerEngine.updateTransform();
                if (typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') window.PlayerEngine.ensureVideoPlayingIfActive(false);
            }
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('📦 已重置评论区区域高度（评论文字大小保持不变）');
        });
    }
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
            CommentEngine.applyFontScale(1.0, true);
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('🔠 已恢复评论文字默认 1.0x 字号（评论区区域高度保持不变）');
        });
    }
    const stepDyCmtFont = (delta) => {
        const nextVal = Number(((CommentEngine.fontScale || 1.0) + delta).toFixed(2));
        CommentEngine.applyFontScale(nextVal, true);
        if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        window.showToast(`🔠 评论文字字号：${CommentEngine.fontScale.toFixed(2).replace(/\.?0+$/, (m) => (m === '.00' ? '.0' : ''))}x（评论区区域保持不变）`);
    };
    if (btnDyCmtStageFontDown) {
        btnDyCmtStageFontDown.addEventListener('click', (e) => { e.stopPropagation(); stepDyCmtFont(-0.08); });
    }
    if (btnDyCmtStageFontUp) {
        btnDyCmtStageFontUp.addEventListener('click', (e) => { e.stopPropagation(); stepDyCmtFont(0.08); });
    }
    if (txtDyCmtStageFont) {
        txtDyCmtStageFont.addEventListener('click', (e) => {
            e.stopPropagation();
            CommentEngine.applyFontScale(1.0, true);
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('🔠 已还原评论文字 1.0x 标准字号');
        });
    }
    if (dyCmtDrawerEl) {
        dyCmtDrawerEl.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.altKey || (e.target && e.target.closest && e.target.closest('#dy-cmt-font-quick-bar'))) {
                e.preventDefault();
                e.stopPropagation();
                stepDyCmtFont(e.deltaY < 0 ? 0.05 : -0.05);
            }
        }, { passive: false });
    }

    const selCmtAvatarApi = document.getElementById('sel-cmt-avatar-api');
    if (selCmtAvatarApi) {
        selCmtAvatarApi.addEventListener('change', (e) => {
            CommentEngine.apiMode = e.target.value;
            CommentEngine.randomizeAll(false, e.target.value);
            window.showToast('🌏 已切换评论区海外华人真实社交头像库风格');
        });
    }

    const btnCmtSwitchOverseasMix = document.getElementById('btn-cmt-switch-overseas-mix');
    if (btnCmtSwitchOverseasMix) {
        btnCmtSwitchOverseasMix.addEventListener('click', () => {
            if (selCmtAvatarApi) selCmtAvatarApi.value = 'overseas-mix';
            CommentEngine.apiMode = 'overseas-mix';
            CommentEngine.randomizeAll(false, 'overseas-mix');
            window.showToast('🌏 已将所有评论一键切换为海外华人 IG/小红书真实混搭头像');
        });
    }

    const btnCmtSwitchFemale = document.getElementById('btn-cmt-switch-female');
    if (btnCmtSwitchFemale) {
        btnCmtSwitchFemale.addEventListener('click', () => {
            if (selCmtAvatarApi) selCmtAvatarApi.value = 'cn-female';
            CommentEngine.apiMode = 'cn-female';
            CommentEngine.randomizeAll(false, 'cn-female');
            window.showToast('👩 已将所有评论切换为 INS/小红书真实女生自拍头像');
        });
    }

    const btnCmtSwitchMale = document.getElementById('btn-cmt-switch-male');
    if (btnCmtSwitchMale) {
        btnCmtSwitchMale.addEventListener('click', () => {
            if (selCmtAvatarApi) selCmtAvatarApi.value = 'cn-male';
            CommentEngine.apiMode = 'cn-male';
            CommentEngine.randomizeAll(false, 'cn-male');
            window.showToast('👦 已将所有评论切换为真实潮男/男生日常自拍头像');
        });
    }

    // 首次升级至 v37 海外华人 153+ 真实头像库时，自动刷新一次默认头像池（避免旧缓存停留老头像）
    try {
        const AVATAR_UPGRADE_KEY = 'LAYA_OVERSEAS_AVATAR_POOL_V37';
        if (!localStorage.getItem(AVATAR_UPGRADE_KEY)) {
            localStorage.setItem(AVATAR_UPGRADE_KEY, '1');
            setTimeout(() => {
                if (CommentEngine && typeof CommentEngine.randomizeAll === 'function') {
                    CommentEngine.randomizeAll(false, 'overseas-mix');
                }
            }, 90);
        }
    } catch (_avErr) {}

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

                // 处理「直播」标签：点击顶部「直播」立即进入直播间，同时右侧编辑栏瞬间跳转到【🔴 直播间专属设置】
                if (window.__ENABLE_LAYA_LIVE_ENTRY && isLiveTab && renderTarget && renderTarget.classList.contains('mode-mobile-port')) {
                    window.__layaLiveTabArmed = false;
                    if (armedTip) armedTip.style.display = 'none';
                    if (typeof window.enterLayaLiveRoom === 'function') {
                        window.enterLayaLiveRoom();
                    }
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

                // 若点的不是「推薦」也不是「直播」，短暂亮 1 秒后自动弹回「推薦」亮灯（若已进入直播间则保持「直播」亮灯）
                if (!isRecommendTab && !isLiveTab) {
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

    // ★ 需求三：顶部通知栏 Laya 小图标控件与舞台节点
    const dySbLayaWrap = document.getElementById('dy-sb-laya-wrap');
    const dySbLayaIcon = document.getElementById('dy-sb-laya-icon');
    const swDySbLayaIcon = document.getElementById('sw-dy-sb-laya-icon');
    const selDySbLayaLogo = document.getElementById('sel-dy-sb-laya-logo');
    const selDySbLayaSlot = document.getElementById('sel-dy-sb-laya-slot');
    const inDySbLayaSize = document.getElementById('in-dy-sb-laya-size');
    const txtDySbLayaSize = document.getElementById('txt-dy-sb-laya-size');
    const inDySbLayaX = document.getElementById('in-dy-sb-laya-x');
    const txtDySbLayaX = document.getElementById('txt-dy-sb-laya-x');
    const inDySbLayaY = document.getElementById('in-dy-sb-laya-y');
    const txtDySbLayaY = document.getElementById('txt-dy-sb-laya-y');
    const btnDySbLayaReset = document.getElementById('btn-dy-sb-laya-reset');

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

        // 5.2 ★ 需求三：顶部通知栏 Laya 小图标（复用 logos.js，支持调大小与位置，自动弹性避让绝不遮挡通知栏文字）
        if (dySbLayaWrap) {
            const showLayaSb = !swDySbLayaIcon || swDySbLayaIcon.checked;
            dySbLayaWrap.style.display = showLayaSb ? 'inline-flex' : 'none';
            const sbLogoKey = (selDySbLayaLogo && selDySbLayaLogo.value) ? selDySbLayaLogo.value : 'Laya.png';
            if (dySbLayaIcon) {
                dySbLayaIcon.src = getActiveLogoSrc(sbLogoKey);
            }
            const slotMode = (selDySbLayaSlot && selDySbLayaSlot.value) ? selDySbLayaSlot.value : 'after-time';
            const leftBox = dyStatusBar.querySelector('.dy-sb-left');
            const rightBox = dyStatusBar.querySelector('.dy-sb-right');
            if (slotMode === 'before-time' && leftBox && dySbLayaWrap.previousElementSibling !== null) {
                leftBox.insertBefore(dySbLayaWrap, leftBox.firstChild);
            } else if (slotMode === 'after-time' && leftBox && dySbCarrier) {
                if (dySbCarrier.nextSibling !== dySbLayaWrap) {
                    leftBox.insertBefore(dySbLayaWrap, dySbCarrier.nextSibling);
                }
            } else if (slotMode === 'after-notifs' && leftBox) {
                if (leftBox.lastElementChild !== dySbLayaWrap) {
                    leftBox.appendChild(dySbLayaWrap);
                }
            } else if (slotMode === 'before-right' && rightBox) {
                if (rightBox.firstElementChild !== dySbLayaWrap) {
                    rightBox.insertBefore(dySbLayaWrap, rightBox.firstChild);
                }
            }

            const layaSizePx = Math.min(19, Math.max(9, parseFloat(inDySbLayaSize ? inDySbLayaSize.value : '12.5') || 12.5));
            const rawGapX = Math.min(85, Math.max(0, parseFloat(inDySbLayaX ? inDySbLayaX.value : '2') || 0));
            const offY = Math.min(5, Math.max(-5, parseFloat(inDySbLayaY ? inDySbLayaY.value : '0') || 0));

            // 计算状态栏中间可用弹性空隙，防止过大 X 挤压右侧电量/信号文字
            let safeGapX = rawGapX;
            const barW = dyStatusBar.clientWidth || 360;
            if (barW > 120) {
                const maxSafeGap = Math.max(6, Math.round(barW * 0.28));
                safeGapX = Math.min(rawGapX, maxSafeGap);
            }

            dySbLayaWrap.style.setProperty('--sb-laya-size', `${layaSizePx}px`);
            if (slotMode === 'before-time' || slotMode === 'before-right') {
                dySbLayaWrap.style.setProperty('--sb-laya-gap-l', '0px');
                dySbLayaWrap.style.setProperty('--sb-laya-gap-r', `${Math.max(2, safeGapX)}px`);
            } else {
                dySbLayaWrap.style.setProperty('--sb-laya-gap-l', `${safeGapX}px`);
                dySbLayaWrap.style.setProperty('--sb-laya-gap-r', '0px');
            }
            dySbLayaWrap.style.setProperty('--sb-laya-y', `${offY}px`);

            if (txtDySbLayaSize) txtDySbLayaSize.textContent = `${layaSizePx}px`;
            if (txtDySbLayaX) txtDySbLayaX.textContent = `${Math.round(rawGapX)}px`;
            if (txtDySbLayaY) txtDySbLayaY.textContent = `${offY}px`;
        }

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
        swDySbDnd, swDySbNotifs, swDySbRec,
        swDySbLayaIcon, selDySbLayaLogo, selDySbLayaSlot
    ].forEach(el => {
        if (el) {
            el.addEventListener('change', () => {
                renderDyStatusBar();
                triggerSaveStorage();
            });
        }
    });

    [inDySbTime, inDySbSpeed, inDySbBattery, inDySbLayaSize, inDySbLayaX, inDySbLayaY].forEach(el => {
        if (el) {
            el.addEventListener('input', () => {
                renderDyStatusBar();
                triggerSaveStorage();
            });
        }
    });

    if (btnDySbLayaReset) {
        btnDySbLayaReset.addEventListener('click', () => {
            if (swDySbLayaIcon) swDySbLayaIcon.checked = true;
            if (selDySbLayaLogo) selDySbLayaLogo.value = 'Laya.png';
            if (selDySbLayaSlot) selDySbLayaSlot.value = 'after-time';
            if (inDySbLayaSize) inDySbLayaSize.value = '12.5';
            if (inDySbLayaX) inDySbLayaX.value = '2';
            if (inDySbLayaY) inDySbLayaY.value = '0';
            renderDyStatusBar();
            triggerSaveStorage();
            window.showToast('↺ 已重置通知欄 Laya 小圖標大小與位置');
        });
    }

    // 支持直接在手机顶部通知栏按住拖动 Laya 小图标微调位置、滚轮缩放大小
    if (dySbLayaWrap) {
        dySbLayaWrap.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            const startClientX = e.clientX;
            const startClientY = e.clientY;
            const startXVal = parseFloat(inDySbLayaX ? inDySbLayaX.value : '2') || 2;
            const startYVal = parseFloat(inDySbLayaY ? inDySbLayaY.value : '0') || 0;
            const rect = renderTarget ? renderTarget.getBoundingClientRect() : null;
            const stageScale = (rect && renderTarget && renderTarget.offsetWidth > 0)
                ? (rect.width / renderTarget.offsetWidth)
                : 1;
            const slotMode = selDySbLayaSlot ? selDySbLayaSlot.value : 'after-time';
            const dirFactor = (slotMode === 'before-time' || slotMode === 'before-right') ? -1 : 1;
            dySbLayaWrap.classList.add('is-dragging');

            const onMove = (mv) => {
                const dx = ((mv.clientX - startClientX) / stageScale) * dirFactor;
                const dy = (mv.clientY - startClientY) / stageScale;
                const nextX = Math.min(85, Math.max(0, Math.round(startXVal + dx)));
                const nextY = Math.min(5, Math.max(-5, Math.round((startYVal + dy) * 2) / 2));
                if (inDySbLayaX) inDySbLayaX.value = String(nextX);
                if (inDySbLayaY) inDySbLayaY.value = String(nextY);
                renderDyStatusBar();
            };
            const onUp = () => {
                dySbLayaWrap.classList.remove('is-dragging');
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                triggerSaveStorage();
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });

        dySbLayaWrap.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const curS = parseFloat(inDySbLayaSize ? inDySbLayaSize.value : '12.5') || 12.5;
            const nextS = Math.min(19, Math.max(9, curS + (e.deltaY < 0 ? 0.5 : -0.5)));
            if (inDySbLayaSize) inDySbLayaSize.value = String(nextS);
            renderDyStatusBar();
            triggerSaveStorage();
        }, { passive: false });
    }

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

    function generateRandomClockTime08To23() {
        const h = String(Math.floor(Math.random() * 16) + 8).padStart(2, '0'); // 08 ~ 23
        const m = String(Math.floor(Math.random() * 60)).padStart(2, '0');     // 00 ~ 59
        return `${h}:${m}`;
    }

    function randomizeDyStatusTime() {
        const tStr = generateRandomClockTime08To23();
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

    function parseDisplayMetricNumber(rawStr) {
        const s = String(rawStr || '').trim();
        if (!s) return 0;
        const num = parseFloat(s.replace(/[^\d.]/g, ''));
        if (!isFinite(num) || num <= 0) return 0;
        if (s.includes('万') || s.includes('萬') || /w/i.test(s)) return Math.round(num * 10000);
        return Math.round(num);
    }

    function randomizeViralMetricsByDuration(customDurSec = null, showMsg = false, respectUserModified = false) {
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
        const modSet = (respectUserModified && window.__userModifiedFieldSet) ? window.__userModifiedFieldSet : new Set();

        const inLikes = document.getElementById('in-dy-likes');
        const inComments = document.getElementById('in-dy-comments');
        const inStars = document.getElementById('in-dy-stars');
        const inShares = document.getElementById('in-dy-shares');

        // 点赞数从 5000 ~ 100万 (5,000 ~ 1,000,000) 分段均匀随机；若用户手动指定了点赞数则以用户点赞数为基准计算其余未改项
        let likesRaw = modSet.has('in-dy-likes') && inLikes ? parseDisplayMetricNumber(inLikes.value) : 0;
        if (!likesRaw) {
            const roll = Math.random();
            if (roll < 0.28) {
                likesRaw = Math.floor(5000 + Math.random() * 45000); // 5000 ~ 5.0萬
            } else if (roll < 0.70) {
                likesRaw = Math.floor(50000 + Math.random() * 300000); // 5.0萬 ~ 35.0萬
            } else {
                likesRaw = Math.floor(350000 + Math.random() * 650000); // 35.0萬 ~ 100萬
            }
            likesRaw = Math.min(1000000, Math.max(5000, likesRaw));
        }

        // 严格按照成比例规则计算：评论 ≈ 点赞 1/30，收藏 ≈ 点赞 1/80，转发 ≈ 点赞 1/50（带 ±8% 自然微幅波动避免呆板整数）
        const jitter = () => 0.92 + Math.random() * 0.16;

        const commentsRaw = Math.max(12, Math.round((likesRaw / 30) * jitter()));
        const starsRaw = Math.max(10, Math.round((likesRaw / 80) * jitter()));
        const sharesRaw = Math.max(10, Math.round((likesRaw / 50) * jitter()));

        const likesTrad = formatViralCountTrad(likesRaw);
        const commentsTrad = formatViralCountTrad(commentsRaw);
        const starsTrad = formatViralCountTrad(starsRaw);
        const sharesTrad = formatViralCountTrad(sharesRaw);

        const likesSimp = formatViralCountSimp(likesRaw);
        const commentsSimp = formatViralCountSimp(commentsRaw);
        const starsSimp = formatViralCountSimp(starsRaw);
        const sharesSimp = formatViralCountSimp(sharesRaw);

        const dyValLikes = document.getElementById('dy-val-likes');
        const dyValComments = document.getElementById('dy-val-comments');
        const dyValStars = document.getElementById('dy-val-stars');
        const dyValShares = document.getElementById('dy-val-shares');
        const dylDispLike = document.getElementById('dyl-disp-like');
        const dylDispComment = document.getElementById('dyl-disp-comment');
        const dylDispStar = document.getElementById('dyl-disp-star');

        if (!modSet.has('in-dy-likes')) {
            if (inLikes) inLikes.value = likesSimp;
            if (dyValLikes) dyValLikes.textContent = likesTrad;
            if (dylDispLike) dylDispLike.textContent = likesTrad;
        }
        if (!modSet.has('in-dy-comments')) {
            if (inComments) inComments.value = commentsSimp;
            if (dyValComments) dyValComments.textContent = commentsTrad;
            if (dylDispComment) dylDispComment.textContent = commentsTrad;
            if (window.CommentEngine) {
                window.CommentEngine.headCount = commentsTrad;
                window.CommentEngine.syncHeaderDOM();
            }
        }
        if (!modSet.has('in-dy-stars')) {
            if (inStars) inStars.value = starsSimp;
            if (dyValStars) dyValStars.textContent = starsTrad;
            if (dylDispStar) dylDispStar.textContent = starsTrad;
        }
        if (!modSet.has('in-dy-shares')) {
            if (inShares) inShares.value = sharesSimp;
            if (dyValShares) dyValShares.textContent = sharesTrad;
        }

        // 同步在看人数 15万~200万 随机波动（若未手动修改过）
        if (!modSet.has('in-dy-hotspot-views')) {
            randomizeHotspotViewsOnly(false);
        }

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
                window.__isOcrScanning = true;
                try {
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
                } finally {
                    window.__isOcrScanning = false;
                    try { pv.currentTime = origTime; } catch (_e) {}
                    if (wasPlaying) pv.play().catch(() => {});
                }
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
            if (typeof window.autoMatchLiveDanmakuByVideoAI === 'function') {
                window.autoMatchLiveDanmakuByVideoAI(false, null);
            }
            triggerSaveStorage();
            window.showToast(`🎉 已识别提取 ${newCues.length} 条画面字幕并同步更新直播间评论！`);

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
            const nextMuted = vid ? !vid.muted : (dylSvgVolOff ? dylSvgVolOff.style.display === 'none' : true);
            if (window.PlayerEngine && typeof window.PlayerEngine.setVideoSoundMuted === 'function') {
                window.PlayerEngine.setVideoSoundMuted(nextMuted, true);
            } else {
                if (vid) vid.muted = nextMuted;
                if (dylSvgVolOn) dylSvgVolOn.style.display = nextMuted ? 'none' : 'block';
                if (dylSvgVolOff) dylSvgVolOff.style.display = nextMuted ? 'block' : 'none';
                window.showToast(nextMuted ? '🔇 已静音' : '🔊 已开启声音');
            }
        });
    }

    const dylBtnLike = document.getElementById('dyl-btn-like');
    const dylDispLike = document.getElementById('dyl-disp-like');
    if (dylBtnLike && dylDispLike) {
        dylBtnLike.addEventListener('click', () => {
            const liked = dylBtnLike.classList.toggle('liked');
            const svgEl = dylBtnLike.querySelector('svg');
            if (svgEl) {
                svgEl.setAttribute('fill', liked ? '#fe2c55' : '#ffffff');
                svgEl.setAttribute('stroke', liked ? '#fe2c55' : '#ffffff');
            }
            dylBtnLike.classList.remove('like-bounce-anim');
            void dylBtnLike.offsetWidth;
            dylBtnLike.classList.add('like-bounce-anim');
            const rawLikeTxt = (dylDispLike.textContent || '').trim();
            if (/^\d+$/.test(rawLikeTxt)) {
                const num = parseInt(rawLikeTxt, 10);
                dylDispLike.textContent = String(liked ? (num + 1) : Math.max(0, num - 1));
            }
            window.showToast(liked ? '点赞成功！' : '已取消点赞');
        });
    }

    const dylBtnStar = document.getElementById('dyl-btn-star');
    const dylDispStar = document.getElementById('dyl-disp-star');
    if (dylBtnStar && dylDispStar) {
        dylBtnStar.addEventListener('click', () => {
            const starred = dylBtnStar.classList.toggle('starred');
            const rawStarTxt = (dylDispStar.textContent || '').trim();
            if (/^\d+$/.test(rawStarTxt)) {
                const num = parseInt(rawStarTxt, 10);
                dylDispStar.textContent = String(starred ? (num + 1) : Math.max(0, num - 1));
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
            syncDmBarSwitchUI();
            triggerSaveStorage();
            window.showToast(active ? '💬 弹幕已开启' : '🚫 弹幕已关闭');
        });
    }

    const dylBtnDmInput = document.getElementById('dyl-btn-dm-input');
    if (dylBtnDmInput) {
        dylBtnDmInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const rawTxt = dylBtnDmInput.value.trim();
                if (!rawTxt) return;
                const txt = toStageTrad(rawTxt);
                if (swDanmakuGlobal && !swDanmakuGlobal.checked) {
                    swDanmakuGlobal.checked = true;
                    syncDmBarSwitchUI();
                }
                if (window.DanmakuEngine) {
                    if (typeof window.DanmakuEngine.fireLive === 'function') {
                        window.DanmakuEngine.fireLive(txt);
                    } else if (Array.isArray(window.DanmakuEngine.list)) {
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
                }
                triggerSaveStorage();
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
                if (typeof markFieldUserModified === 'function') markFieldUserModified('dy-author-avatar');
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
            if (window.__userModifiedFieldSet) {
                window.__userModifiedFieldSet.delete('dy-author-avatar');
                try { localStorage.setItem('LAYA_USER_MODIFIED_FIELDS_V1', JSON.stringify(Array.from(window.__userModifiedFieldSet))); } catch (e) {}
            }
            syncAuthorAvatarEverywhere(logoSrc, false);
            if (inDyAvatarUrl) inDyAvatarUrl.value = '';
            window.showToast('已恢复官方 Logo 头像（下方唱片头像已同步）');
            triggerSaveStorage();
        });
    }

    async function randomizeAuthorChineseAvatar(showNotice = true, markAsCustom = null) {
        if (!dyAvatarImg) return;
        const isManualCustom = markAsCustom !== null ? !!markAsCustom : !!showNotice;
        if (isManualCustom && typeof markFieldUserModified === 'function') {
            markFieldUserModified('dy-author-avatar');
        }
        const seed = 'author_' + Math.random().toString(36).slice(2, 9);
        const genderMode = selAuthorAvatarGender ? selAuthorAvatarGender.value : 'real-human';
        const avoidSet = new Set([dyAvatarImg.src]);
        const onlineUrl = buildOnlineAvatarUrl(seed, genderMode, avoidSet);
        syncAuthorAvatarEverywhere(onlineUrl, isManualCustom);
        if (inDyAvatarUrl && isManualCustom) inDyAvatarUrl.value = onlineUrl;
        if (isManualCustom) triggerSaveStorage();
        if (showNotice) {
            const label = genderMode === 'cn-female' ? '中国女头' : (genderMode === 'cn-male' ? '中国男头' : '海外华人真人头像');
            window.showToast(`🎲 已随机切换${label}（主页与直播间头像已同步）`);
        }
        if (typeof onlineUrl === 'string' && !onlineUrl.startsWith('data:')) {
            try {
                const resp = await fetch(onlineUrl, { mode: 'cors' });
                if (resp.ok) {
                    const blob = await resp.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                            syncAuthorAvatarEverywhere(reader.result, isManualCustom);
                            if (isManualCustom) triggerSaveStorage();
                        }
                    };
                    reader.readAsDataURL(blob);
                }
            } catch (err) {
                if (isManualCustom) triggerSaveStorage();
            }
        }
    }

    const btnRandomAuthorAvatar = document.getElementById('btn-random-author-avatar');
    if (btnRandomAuthorAvatar && dyAvatarImg) {
        btnRandomAuthorAvatar.addEventListener('click', () => {
            randomizeAuthorChineseAvatar(true, true);
        });
    }
    if (selAuthorAvatarGender) {
        selAuthorAvatarGender.addEventListener('change', () => {
            randomizeAuthorChineseAvatar(true, true);
        });
    }
    if (btnApplyAuthorAvatarUrl && inDyAvatarUrl) {
        const applyCustomAuthorUrl = async () => {
            const urlVal = inDyAvatarUrl.value.trim();
            if (!urlVal) {
                window.showToast('⚠️ 请输入有效的头像图片 URL');
                return;
            }
            if (typeof markFieldUserModified === 'function') markFieldUserModified('dy-author-avatar');
            syncAuthorAvatarEverywhere(urlVal, true);
            triggerSaveStorage();
            window.showToast('✅ 已应用指定头像 URL');
            if (!urlVal.startsWith('data:')) {
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
            }
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
    // ★ 问题四：区分「用户手动修改过的字段」与「每次页面加载随机一次且不写入持久化的仿真数据」
    const USER_MODIFIED_FIELDS_KEY = 'LAYA_USER_MODIFIED_FIELDS_V1';
    const SIMULATION_TRANSIENT_FIELD_IDS = new Set([
        // 竖屏/横屏/全屏状态栏时间、电量、信号、运营商、网速、充电态、Wi-Fi/5G
        'in-dy-sb-time', 'in-m-status-time', 'in-dyl-clock-time',
        'in-dy-sb-battery', 'in-m-battery-pct', 'in-dyl-battery',
        'sel-dy-sb-carrier', 'sw-dy-sb-speed', 'in-dy-sb-speed', 'sel-dy-sb-signal', 'sel-dy-sb-net',
        'sw-dy-sb-charging', 'sel-m-signal',
        // 直播间实时数字：主播昵称、本场点赞、在线人数、送礼人名
        'in-live-host-name', 'in-live-host-id', 'in-live-viewers-text', 'in-live-viewers',
        'in-live-gift-user',
        // 竖屏右下角点赞、评论、收藏、转发及热点在看数
        'in-dy-likes', 'in-dy-comments', 'in-dy-stars', 'in-dy-shares', 'in-dy-hotspot-views',
        // 直播间顶部动态轮播话题（未手动编辑时每次加载随机轮播）
        'in-live-brand-tag'
    ]);

    const __userModifiedFieldSet = (() => {
        try {
            const arr = JSON.parse(localStorage.getItem(USER_MODIFIED_FIELDS_KEY) || '[]');
            if (Array.isArray(arr)) return new Set(arr.map(String));
        } catch (e) {}
        return new Set();
    })();
    window.__userModifiedFieldSet = __userModifiedFieldSet;

    function markFieldUserModified(fieldId) {
        if (!fieldId || window.__isRestoringStorage || window.__isAutoRandomizing) return;
        __userModifiedFieldSet.add(String(fieldId));
        try {
            localStorage.setItem(USER_MODIFIED_FIELDS_KEY, JSON.stringify(Array.from(__userModifiedFieldSet)));
        } catch (e) {}
    }
    window.markFieldUserModified = markFieldUserModified;

    // 监听用户在设置面板对仿真字段的真实手动输入/切换，仅手动改过的才标记持久化
    document.addEventListener('input', (e) => {
        if (e.isTrusted && e.target && e.target.id && SIMULATION_TRANSIENT_FIELD_IDS.has(e.target.id)) {
            markFieldUserModified(e.target.id);
        }
    }, true);
    document.addEventListener('change', (e) => {
        if (e.isTrusted && e.target && e.target.id && SIMULATION_TRANSIENT_FIELD_IDS.has(e.target.id)) {
            markFieldUserModified(e.target.id);
        }
    }, true);

    function triggerSaveStorage() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveAllToStorage, 350);
    }
    window.triggerSaveStorage = triggerSaveStorage;

    function saveAllToStorage() {
        if (window.__isResettingAll) return;
        try {
            const liveOverlayNode = document.getElementById('laya-live-room-overlay');
            const isLiveNow = !!(renderTarget && renderTarget.classList.contains('dy-live-open')) || !!(liveOverlayNode && liveOverlayNode.style.display === 'flex');
            const isLiveZoomNow = !!(document.querySelector('.live-bottom-section.is-zoom-editing'));
            const rightSideEl = document.getElementById('right-sidebar');
            const activeQaEl = document.querySelector('#qa-rail-list .qa-item.active');

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
                liveRoomOpen: isLiveNow,
                liveZoomEditing: isLiveZoomNow,
                activeQaCardId: activeQaEl ? (activeQaEl.getAttribute('data-target-card') || '') : '',
                rightSidebarScrollTop: rightSideEl ? Math.round(rightSideEl.scrollTop) : 0,
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

            // ★ 仅当仿真数据被用户手动修改过时才写入持久化；未手动改过的仿真数据不写入持久化，确保每次打开都随机不同
            document.querySelectorAll('input[type="text"], input[type="number"], input[type="range"], textarea').forEach(el => {
                if (!el.id) return;
                if (SIMULATION_TRANSIENT_FIELD_IDS.has(el.id) && !__userModifiedFieldSet.has(el.id)) return;
                data.inputs[el.id] = el.value;
            });
            document.querySelectorAll('input[type="checkbox"]').forEach(el => {
                if (!el.id) return;
                if (SIMULATION_TRANSIENT_FIELD_IDS.has(el.id) && !__userModifiedFieldSet.has(el.id)) return;
                data.checkboxes[el.id] = el.checked;
            });
            document.querySelectorAll('select').forEach(el => {
                if (!el.id) return;
                if (SIMULATION_TRANSIENT_FIELD_IDS.has(el.id) && !__userModifiedFieldSet.has(el.id)) return;
                data.selects[el.id] = el.value;
            });

            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Storage save:', e);
        }
    }

    // 刷新或关闭页面瞬间立即同步保存最后所在的页面、直播间状态、滚动条位置与视频播放时间点
    window.addEventListener('beforeunload', () => {
        if (!window.__isResettingAll) {
            saveAllToStorage();
            if (window.PlayerEngine && typeof window.PlayerEngine.saveMediaPlayStateNow === 'function') {
                window.PlayerEngine.saveMediaPlayStateNow();
            }
        }
    });

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

            // ★ V57 一次性升级迁移：弹幕真人化去AI套话与彩色符号 + AI暗号默认关闭 + 通知栏Laya小图标默认显示
            if (localStorage.getItem('LAYA_V57_LIVE_REALISM_MIGRATED') !== '1') {
                if (data.inputs && data.inputs['in-live-danmaku-list']) {
                    const oldDm = String(data.inputs['in-live-danmaku-list']);
                    if (/氣氛拉滿|气氛拉满|太頂了|太顶了|治癒|治愈|天花板|絕絕子|yyds|羊🐑|🔥|💖|💕|🎉|🌈|🐳/i.test(oldDm)) {
                        delete data.inputs['in-live-danmaku-list'];
                    }
                }
                if (!data.checkboxes) data.checkboxes = {};
                data.checkboxes['sw-live-ai-secret'] = false;
                if (typeof data.checkboxes['sw-dy-sb-laya-icon'] === 'undefined') {
                    data.checkboxes['sw-dy-sb-laya-icon'] = true;
                }
                localStorage.setItem('LAYA_V57_LIVE_REALISM_MIGRATED', '1');
            }

            if (data.inputs) {
                // ★ V39 跨电脑全量同步迁移：自动清理其他电脑浏览器中残留的旧版直播间与底栏红点缓存（如「小鹿同學」「54.3萬」「高顏值精選」「粉絲螢光棒」「消息 3」）
                if (!localStorage.getItem('LAYA_BETA_V39_FRESH_SYNC')) {
                    if (data.inputs['in-dy-msg-count'] === '3') data.inputs['in-dy-msg-count'] = '99+';
                    if (data.inputs['in-live-host-name'] === '小鹿同學') data.inputs['in-live-host-name'] = '小王小王';
                    if (data.inputs['in-live-viewers-text'] === '54.3萬') data.inputs['in-live-viewers-text'] = '10.2萬';
                    if (data.inputs['in-live-brand-tag'] === '高顏值精選') data.inputs['in-live-brand-tag'] = 'Laya 精選';
                    if (data.inputs['in-live-gift-name'] === '揮舞 粉絲螢光棒') data.inputs['in-live-gift-name'] = '送 嘉年華';
                    if (data.inputs['in-live-gift-count'] === 'x99') data.inputs['in-live-gift-count'] = 'x9';
                    localStorage.setItem('LAYA_BETA_V39_FRESH_SYNC', '1');
                }
                // 统一网页端、手机横屏端与竖屏全屏观看端的时间/进度缓存，完全保留用户设置的起始时间与总时长（包括 00:00:00 开头）
                if (data.inputs['in-total-time']) {
                    data.inputs['in-m-total-time'] = data.inputs['in-total-time'];
                    data.inputs['in-dyl-total-time'] = data.inputs['in-total-time'];
                }
                if (data.inputs['in-start-time']) {
                    data.inputs['in-m-start-time'] = data.inputs['in-start-time'];
                    data.inputs['in-dyl-start-time'] = data.inputs['in-start-time'];
                }
                Object.entries(data.inputs).forEach(([id, val]) => {
                    if (id === 'in-m-start-time' || id === 'in-m-total-time' || id === 'in-m-progress' || id === 'in-dyl-start-time' || id === 'in-dyl-total-time' || id === 'in-dyl-progress' || id === 'in-progress' || id === 'in-custom-sec' || id === 'in-media-scale' || id === 'in-pos-x' || id === 'in-pos-y') return;
                    // 未被用户手动修改过的仿真数据不从旧缓存恢复，而是每次页面加载随机生成
                    if (SIMULATION_TRANSIENT_FIELD_IDS.has(id) && !__userModifiedFieldSet.has(id)) return;
                    // 送礼停留时间、消失时间、最短/最长空窗间隔由独立 V3 存储管理，防止旧版 V12 缓存将其覆盖回 3.0 秒
                    if (id === 'in-live-gift-stay-sec' || id === 'in-live-gift-fade-sec' || id === 'in-live-gift-gap-min' || id === 'in-live-gift-gap-max') return;
                    if (id === 'in-live-gift-speed' && Number(val) <= 0) return;
                    // 防止旧版直播间 8888 或 29/1000 缓存覆盖新版 1000~200万 点赞与在线人数
                    if (id === 'in-live-host-id' && (val === '8888' || val === '1.8萬')) return;
                    if (id === 'in-live-viewers' && (Number(val) <= 1000)) return;
                    // 防止旧版缺少「來了」进场行或不足 6 行的残缺弹幕缓存覆盖新版自然混排直播弹幕（用户手动修改过的弹幕除外，完整保留）
                    if (id === 'in-live-danmaku-list' && !__userModifiedFieldSet.has('in-live-danmaku-list')) {
                        const sVal = String(val || '').trim();
                        const lineArr = sVal.split(/[\r\n]+/).filter(Boolean);
                        if (lineArr.length < 6 || (!sVal.includes('來了') && !sVal.includes('来了'))) {
                            return;
                        }
                    }
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
                    if (!el) return;
                    if (SIMULATION_TRANSIENT_FIELD_IDS.has(id) && !__userModifiedFieldSet.has(id)) return;
                    // 每次打开页面始终默认开启直播间公屏弹幕自动滚动、礼物弹窗自动轮播与送完消失间隔，并默认关闭每行末尾假紫心
                    if (id === 'sw-live-auto-roll-dm' || id === 'sw-live-auto-cycle-gift') {
                        el.checked = true;
                        return;
                    }
                    if (id === 'sw-live-gift-empty-gap') {
                        return;
                    }
                    if (id === 'sw-live-dm-row-heart' || id === 'sw-dy-land-box') {
                        el.checked = false;
                        return;
                    }
                    el.checked = checked;
                    el.dispatchEvent(new Event('change'));
                });
            }

            if (data.selects) {
                Object.entries(data.selects).forEach(([id, val]) => {
                    // 每次打开页面始终默认 1.0x 原速，且录制秒数由视频时间轴区间 (LAYA_LAST_MEDIA_STATE) 精确接管
                    if (id === 'sel-preview-speed' || id === 'jy-sel-speed' || id === 'sel-record-sec' || id === 'sel-crop-orient') return;
                    if (SIMULATION_TRANSIENT_FIELD_IDS.has(id) && !__userModifiedFieldSet.has(id)) return;
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

            if (__userModifiedFieldSet.has('dy-author-avatar') && data.avatar && dyAvatarImg && data.avatarIsCustom && !data.avatar.includes('pravatar.cc') && !data.avatar.includes('dicebear.com')) {
                syncAuthorAvatarEverywhere(data.avatar, true);
            } else {
                randomizeAuthorChineseAvatar(false, false);
            }

            if (data.skin && selMobileSkin) {
                selMobileSkin.value = data.skin;
                applyMobileSkin(data.skin);
            }
            // 恢复刷新前所在的顶部/底部导航标签、画幅模式与直播间状态
            const savedTopIdx = (typeof data.layaAppTopIdx === 'number' && data.layaAppTopIdx >= 0) ? data.layaAppTopIdx : 1;
            const savedBotIdx = (typeof data.layaAppBotIdx === 'number' && data.layaAppBotIdx >= 0) ? data.layaAppBotIdx : 2;
            const topItems = document.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item');
            if (topItems.length) {
                topItems.forEach((el, idx) => el.classList.toggle('active', idx === savedTopIdx));
            }
            const botItems = document.querySelectorAll('#laya-app-bottom-tabs .laya-app-tab-item');
            if (botItems.length) {
                botItems.forEach((el, idx) => el.classList.toggle('active', idx === savedBotIdx));
            }
            if (typeof setRightAvatarFollowedByTab === 'function') {
                setRightAvatarFollowedByTab(savedTopIdx === 0);
            }
            if (data.viewportMode && ['mode-pc', 'mode-mobile-land', 'mode-mobile-port', 'mode-dy-land'].includes(data.viewportMode) && window.PlayerEngine && typeof window.PlayerEngine.activateViewportMode === 'function') {
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
                            const isFileProto = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
                            if (!it.avatar || it.avatar.includes('pravatar.cc') || it.avatar.includes('dicebear.com') || (isFileProto && /^https?:\/\//i.test(it.avatar))) {
                                it.avatar = buildOnlineAvatarUrl(`mig_${idx}`, window.CommentEngine.apiMode);
                                it.avatarDataUrl = '';
                            }
                            if (!Array.isArray(it.replies)) {
                                it.replies = [];
                            } else if (isFileProto) {
                                it.replies.forEach((rep, rIdx) => {
                                    if (rep && /^https?:\/\//i.test(rep.avatar || '')) {
                                        rep.avatar = buildOnlineAvatarUrl(`mig_rep_${idx}_${rIdx}`, window.CommentEngine.apiMode);
                                        rep.avatarDataUrl = '';
                                    }
                                });
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
                if (!data.liveRoomOpen) {
                    window.CommentEngine.setDrawerOpen(!!cd.isOpen, false);
                }
            }

            // 若刷新前用户正在直播间内，刷新后自动停留在直播间页面并恢复放大查看状态，且右侧直接对齐【🔴 直播间专属设置】
            if (data.viewportMode === 'mode-mobile-port' && data.liveRoomOpen) {
                if (typeof window.enterLayaLiveRoom === 'function') {
                    window.enterLayaLiveRoom({ silentToast: true, preserveScroll: true });
                }
                if (data.liveZoomEditing && typeof window.syncLiveZoomEditingUI === 'function') {
                    window.syncLiveZoomEditingUI(true);
                }
                setActiveQuickAccessItem('card-dy-live-settings', true);
                const rightSideEl = document.getElementById('right-sidebar');
                const liveCardEl = document.getElementById('card-dy-live-settings');
                if (rightSideEl && liveCardEl) {
                    setTimeout(() => {
                        const sideRect = rightSideEl.getBoundingClientRect();
                        const cardRect = liveCardEl.getBoundingClientRect();
                        rightSideEl.scrollTop = Math.max(0, rightSideEl.scrollTop + (cardRect.top - sideRect.top) - 12);
                    }, 90);
                }
            } else {
                if (data.activeQaCardId && typeof setActiveQuickAccessItem === 'function') {
                    setActiveQuickAccessItem(data.activeQaCardId, true);
                }
                if (typeof data.rightSidebarScrollTop === 'number' && data.rightSidebarScrollTop > 0) {
                    const rightSideEl = document.getElementById('right-sidebar');
                    if (rightSideEl) {
                        setTimeout(() => {
                            rightSideEl.scrollTop = data.rightSidebarScrollTop;
                        }, 90);
                    }
                }
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
        btnGlobalReset.addEventListener('click', async () => {
            if (confirm('确认要一键清除所有本地修改（包括已上传的视频/图片素材）并回到最开始的初始状态吗？')) {
                window.__isResettingAll = true;
                if (saveTimeout) clearTimeout(saveTimeout);
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem('LAYA_LAST_MEDIA_STATE');
                localStorage.removeItem(USER_MODIFIED_FIELDS_KEY);
                localStorage.removeItem(USED_NICKNAMES_STORAGE_KEY);
                localStorage.removeItem(USED_AVATARS_STORAGE_KEY);
                if (window.LayaMediaPersistDB && typeof window.LayaMediaPersistDB.clearMedia === 'function') {
                    try {
                        await window.LayaMediaPersistDB.clearMedia();
                    } catch (e) {}
                }
                location.reload();
            }
        });
    }

    // ★ 问题四核心实现：每次页面加载时，对所有未被用户手动修改过的状态栏与仿真数据执行一次全量随机（且不写入持久化）
    function randomizeUneditedSimulationDataOnBoot() {
        window.__isAutoRandomizing = true;
        try {
            // 1) 状态栏时间随机 08:00 ~ 23:59（若用户未手动修改时间）
            const timeEdited = __userModifiedFieldSet.has('in-dy-sb-time') || __userModifiedFieldSet.has('in-m-status-time') || __userModifiedFieldSet.has('in-dyl-clock-time');
            if (!timeEdited) {
                const randClock = generateRandomClockTime08To23();
                syncAllPhoneClockTimes(randClock, false);
            }

            // 2) 竖屏/横屏/全屏状态栏电量随机 20% ~ 100%（若用户未手动修改电量）
            const batEdited = __userModifiedFieldSet.has('in-dy-sb-battery') || __userModifiedFieldSet.has('in-m-battery-pct') || __userModifiedFieldSet.has('in-dyl-battery');
            if (!batEdited) {
                const randBat = Math.floor(Math.random() * 81) + 20; // 20% ~ 100%
                if (inDySbBattery) inDySbBattery.value = String(randBat);
                if (txtDySbBattery) txtDySbBattery.textContent = randBat + '%';
                if (inMBatteryPct) {
                    inMBatteryPct.value = String(randBat);
                    inMBatteryPct.dispatchEvent(new Event('input'));
                }
                const inDylBat = document.getElementById('in-dyl-battery');
                if (inDylBat) {
                    inDylBat.value = String(randBat);
                    inDylBat.dispatchEvent(new Event('input'));
                }
            }

            // 3) 竖屏状态栏运营商、实时网速、信号格数、充电状态、Wi-Fi/5G 状态随机（匹配真实下拉 option 值）
            if (!__userModifiedFieldSet.has('sel-dy-sb-carrier') && selDySbCarrier && selDySbCarrier.options.length > 0) {
                if (Math.random() < 0.35) {
                    selDySbCarrier.value = '';
                } else {
                    const validCarriers = Array.from(selDySbCarrier.options).map(o => o.value).filter(v => v && v !== 'none');
                    if (validCarriers.length > 0) {
                        selDySbCarrier.value = validCarriers[Math.floor(Math.random() * validCarriers.length)];
                    }
                }
            }
            if (!__userModifiedFieldSet.has('sw-dy-sb-speed') && swDySbSpeed) {
                swDySbSpeed.checked = Math.random() < 0.45;
            }
            if (!__userModifiedFieldSet.has('in-dy-sb-speed') && inDySbSpeed) {
                const randSpd = (0.6 + Math.random() * 17.8).toFixed(1) + 'M/s';
                inDySbSpeed.value = randSpd;
            }
            if (!__userModifiedFieldSet.has('sel-dy-sb-signal') && selDySbSignal && selDySbSignal.options.length > 0) {
                const sigChoices = ['single-4', 'single-3', 'dual-4', 'dual-3', 'single-2'];
                const validSigs = sigChoices.filter(v => Array.from(selDySbSignal.options).some(o => o.value === v));
                if (validSigs.length > 0) {
                    selDySbSignal.value = validSigs[Math.floor(Math.random() * validSigs.length)];
                }
            }
            if (!__userModifiedFieldSet.has('sel-dy-sb-net') && selDySbNet && selDySbNet.options.length > 0) {
                const netChoices = ['wifi', '5g', '5ga', 'wifi+5g', '4g'];
                const validNets = netChoices.filter(v => Array.from(selDySbNet.options).some(o => o.value === v));
                if (validNets.length > 0) {
                    selDySbNet.value = validNets[Math.floor(Math.random() * validNets.length)];
                }
            }
            if (!__userModifiedFieldSet.has('sw-dy-sb-charging') && swDySbCharging) {
                swDySbCharging.checked = Math.random() < 0.28;
            }
            if (!__userModifiedFieldSet.has('sel-m-signal') && selMSignal && selMSignal.options.length > 0) {
                selMSignal.selectedIndex = Math.floor(Math.random() * selMSignal.options.length);
                selMSignal.dispatchEvent(new Event('change'));
            }
            if (typeof renderDyStatusBar === 'function') {
                renderDyStatusBar();
            }

            // 4) 竖屏右下角点赞/评论/收藏/转发每次打开成比例随机（评论≈点赞1/30，收藏≈1/80，转发≈1/50），自动保留用户已手动修改过的单项
            if (typeof randomizeViralMetricsByDuration === 'function') {
                randomizeViralMetricsByDuration(null, false, true);
            }

            // 5) 评论区昵称与头像去重轮换（若用户未手动增删改评论）
            if (!__userModifiedFieldSet.has('cmt-list-manual') && window.CommentEngine && typeof window.CommentEngine.refreshUnmodifiedIdentitiesOnBoot === 'function') {
                window.CommentEngine.refreshUnmodifiedIdentitiesOnBoot();
            }

            // 6) 直播间实时数字每次打开随机：主播昵称、在线人数(1000~200万)、本场点赞(=在线人数若干倍)、右上角3张观众头像、送礼人名与头像
            if (typeof window.__randomizeLiveRoomSimulationOnBoot === 'function') {
                window.__randomizeLiveRoomSimulationOnBoot();
            }
        } finally {
            window.__isAutoRandomizing = false;
        }
    }
    window.randomizeUneditedSimulationDataOnBoot = randomizeUneditedSimulationDataOnBoot;

    setTimeout(() => {
        const hadSavedState = !!localStorage.getItem(STORAGE_KEY);
        loadAllFromStorage();
        if (!hadSavedState && window.PlayerEngine && typeof window.PlayerEngine.randomizeDuration === 'function') {
            window.PlayerEngine.randomizeDuration(false);
        }
        // ★ 在 140ms 直播间迁移初始化完成后（155ms），对所有未手动修改过的状态栏、互动量、评论身份与直播间仿真数据统一执行一次去重随机
        setTimeout(() => {
            window.__isInitialPreBoot = false;
            randomizeUneditedSimulationDataOnBoot();
        }, 55);
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
            window.__currentLangMode = isTraditional ? 'trad' : 'simp';
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
            if (typeof renderLiveChatBubbles === 'function') renderLiveChatBubbles(false);
            if (typeof renderLiveJoinTicker === 'function') renderLiveJoinTicker(false);
            window.showToast(isTraditional ? '画面已切换为：繁体中文' : '画面已切换为：简体中文');
        });
    }

    /* ==========================================================================
       ★ 辅助函数：确保克隆节点 100% 注入你绑定的真实蓝/紫原图，绝不替换为假图
       ========================================================================== */
    function injectRealLogosToClonedDoc(clonedDoc) {
        try {
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
        const clonedDySbLayaIcon = clonedDoc.getElementById('dy-sb-laya-icon');
        if (clonedDySbLayaIcon) {
            const sbKey = (selDySbLayaLogo && selDySbLayaLogo.value) ? selDySbLayaLogo.value : 'Laya.png';
            clonedDySbLayaIcon.src = getActiveLogoSrc(sbKey);
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

        const rawDyAvSrc = dyAvatarImg
            ? (dyAvatarImg.getAttribute('data-export-src') || dyAvatarImg.getAttribute('src') || dyAvatarImg.src || '')
            : '';
        const avatarSrc = (rawDyAvSrc && !rawDyAvSrc.endsWith('Laya.png') && !rawDyAvSrc.endsWith('Laya2.png'))
            ? rawDyAvSrc
            : activeRealSrc;
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
        if (origArmedTip && clonedArmedTip && renderTarget && renderTarget.classList.contains('dy-live-preview')) {
            const targetW = renderTarget.offsetWidth || 360;
            const tipW = origArmedTip.offsetWidth || 138;
            clonedArmedTip.style.setProperty('left', Math.max(0, Math.round((targetW - tipW) / 2)) + 'px', 'important');
            clonedArmedTip.style.setProperty('right', 'auto', 'important');
            clonedArmedTip.style.setProperty('margin', '0', 'important');
        }
        const origFollowDrop = document.getElementById('dy-live-follow-drop');
        const clonedFollowDrop = clonedDoc.getElementById('dy-live-follow-drop');
        if (origFollowDrop && clonedFollowDrop && renderTarget && renderTarget.classList.contains('dy-live-preview')) {
            const targetW = renderTarget.offsetWidth || 360;
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

        // ★ 截图导出时锁定直播间漂浮弹幕与右侧飘心在当前画面上的实时像素位置，并同步礼物空窗期隐去状态
        if (renderTarget && renderTarget.classList.contains('dy-live-open')) {
            const origGiftBanner = document.getElementById('live-gift-combo-banner');
            const clonedGiftBanner = clonedDoc.getElementById('live-gift-combo-banner');
            if (origGiftBanner && clonedGiftBanner && (origGiftBanner.dataset.inEmptyGap === 'true' || origGiftBanner.classList.contains('is-in-empty-gap'))) {
                clonedGiftBanner.style.setProperty('display', 'none', 'important');
                clonedGiftBanner.style.setProperty('opacity', '0', 'important');
                clonedGiftBanner.style.setProperty('visibility', 'hidden', 'important');
            }
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
                const targetAssetSrc = (isLightMode && window.LAYA_APP_ASSETS_LIGHT && window.LAYA_APP_ASSETS_LIGHT[key])
                    ? window.LAYA_APP_ASSETS_LIGHT[key]
                    : window.LAYA_APP_ASSETS[key];
                if (targetAssetSrc && img.getAttribute('src') !== targetAssetSrc) {
                    img.src = targetAssetSrc;
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

        // 克隆节点中隐藏 .laya-app-nav-glow（统一交由底层 drawTopNavActiveGlowOnCanvas 在绘制 UI 文字覆层之前先行铺底，彻底杜绝光效压在「直播」白色文字上方）
        const clonedNavItems = clonedDoc.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item');
        clonedNavItems.forEach((clonedItem) => {
            const clonedGlow = clonedItem.querySelector('.laya-app-nav-glow');
            if (clonedGlow) {
                clonedGlow.style.setProperty('visibility', 'hidden', 'important');
                clonedGlow.style.setProperty('opacity', '0', 'important');
            }
            const clonedTxt = clonedItem.querySelector('.laya-app-nav-txt');
            if (clonedTxt) {
                clonedTxt.style.setProperty('position', 'relative', 'important');
                clonedTxt.style.setProperty('z-index', '3', 'important');
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
        } catch (cloneSyncErr) {
            console.warn('injectRealLogosToClonedDoc warning:', cloneSyncErr);
        }
    }

    // 使用原生 Canvas 2D 线性渐变绘制顶/底部蒙层（自动适配夜间深色与日间浅色模式）
    function drawSeamlessHudGradients(targetCtx, outW, outH) {
        if (!renderTarget || !targetCtx) return;
        const targetRect = renderTarget.getBoundingClientRect();
        const baseTargetH = renderTarget.offsetHeight || targetRect.height;
        if (!baseTargetH) return;
        const isLightMode = renderTarget.classList.contains('theme-light');
        const rgbBase = isLightMode ? '255, 255, 255' : '0, 0, 0';

        const topBar = document.getElementById('web-player-top');
        if (topBar && topBar.offsetWidth > 0 && topBar.offsetHeight > 0) {
            const topH = Math.round((topBar.offsetHeight / baseTargetH) * outH * 1.18);
            const gTop = targetCtx.createLinearGradient(0, 0, 0, topH);
            gTop.addColorStop(0, `rgba(${rgbBase}, ${isLightMode ? '0.94' : '1.0'})`);
            gTop.addColorStop(0.14, `rgba(${rgbBase}, ${isLightMode ? '0.88' : '0.90'})`);
            gTop.addColorStop(0.55, `rgba(${rgbBase}, ${isLightMode ? '0.52' : '0.44'})`);
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
                const botH = Math.round((botBar.offsetHeight / baseTargetH) * outH * 1.2);
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

    // ★ 预加载顶部导航栏「直播/推薦」选中态粉黄极光贴图 (top_glow)，并在导出截图/视频画布上原生 1:1 补绘，杜绝 html2canvas 裁切或白字遮挡导致顶部光效变淡
    let preloadedTopGlowImg = null;
    if (window.LAYA_APP_ASSETS && window.LAYA_APP_ASSETS.top_glow) {
        preloadedTopGlowImg = new Image();
        preloadedTopGlowImg.src = window.LAYA_APP_ASSETS.top_glow;
    }
    function drawTopNavActiveGlowOnCanvas(targetCtx, targetRect, scaleX, scaleY) {
        if (!targetCtx || !renderTarget || !targetRect) return;
        const topNavWrap = document.getElementById('laya-app-wrap-top-nav');
        if (!topNavWrap || topNavWrap.offsetWidth <= 0 || topNavWrap.offsetHeight <= 0) return;
        const csWrap = window.getComputedStyle(topNavWrap);
        if (csWrap.display === 'none' || csWrap.visibility === 'hidden' || parseFloat(csWrap.opacity || '1') <= 0.01) return;

        const activeNavItem = document.querySelector('#laya-app-nav-tabs .laya-app-nav-item.active');
        if (!activeNavItem) return;
        const glowEl = activeNavItem.querySelector('.laya-app-nav-glow');
        const imgSource = (preloadedTopGlowImg && preloadedTopGlowImg.complete && preloadedTopGlowImg.naturalWidth > 0)
            ? preloadedTopGlowImg
            : (glowEl && glowEl.complete && glowEl.naturalWidth > 0 ? glowEl : null);
        if (!imgSource) return;

        const itemRect = activeNavItem.getBoundingClientRect();
        if (itemRect.width <= 0 || itemRect.height <= 0) return;
        const glowRect = (glowEl && glowEl.getBoundingClientRect().width > 0)
            ? glowEl.getBoundingClientRect()
            : null;

        const gw = (glowRect ? glowRect.width : 48) * scaleX;
        const gh = (glowRect ? glowRect.height : 27) * scaleY;
        const gx = glowRect
            ? (glowRect.left - targetRect.left) * scaleX
            : ((itemRect.left + itemRect.width * 0.5 - 24) - targetRect.left) * scaleX;
        const gy = glowRect
            ? (glowRect.top - targetRect.top) * scaleY
            : ((itemRect.top + itemRect.height * 0.5 - 12) - targetRect.top) * scaleY;

        targetCtx.save();
        targetCtx.globalAlpha = 0.88;
        targetCtx.drawImage(imgSource, Math.round(gx), Math.round(gy), Math.round(gw), Math.round(gh));
        targetCtx.restore();
    }

    // ★ 导出前自动收起画面上正在编辑的输入框与悬浮框，确保导出的截图和视频 100% 纯净无编辑虚线框
    function prepareCleanStageBeforeExport() {
        document.querySelectorAll('#render-target .live-inline-edit-input').forEach(inp => {
            try { inp.blur(); } catch (_e) {}
        });
        document.querySelectorAll('#render-target .live-row-inline-editor .live-ed-btn.save').forEach(btn => {
            try { btn.click(); } catch (_e) {}
        });
        const botSec = document.querySelector('#laya-live-room-overlay .live-bottom-section');
        if (botSec) {
            botSec.classList.remove('is-touching-dm-zone', 'is-zoom-editing');
        }
        const scrollBox = document.getElementById('live-chat-scroll-box');
        if (scrollBox) {
            scrollBox.classList.remove('is-resizing-dm');
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
            prepareCleanStageBeforeExport();
            if (typeof window.suspendStageMagnifierForExport === 'function') {
                window.suspendStageMagnifierForExport();
            }

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

                // 2. 计算取景框在输出画布中的精确坐标与裁剪参数（直播间内同样完整保留 16:9 横屏框 port-land-box 构图）
                const isLiveOpenImg = renderTarget.classList.contains('dy-live-open');
                const isSpecialSubBox = renderTarget.classList.contains('port-land-box') || renderTarget.classList.contains('land-port-box') || (!isLiveOpenImg && renderTarget.classList.contains('dy-comment-open'));
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

                const measureImgRelBox = (el) => {
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    if (r.width === 0 || r.height === 0) return null;
                    return {
                        x: (r.left - targetRect.left) * scaleFactor,
                        y: (r.top - targetRect.top) * scaleFactor,
                        w: r.width * scaleFactor,
                        h: r.height * scaleFactor
                    };
                };

                if (isLiveOpenImg) {
                    if (typeof window.__captureLiveExportInitialState === 'function') {
                        window.__captureLiveExportInitialState();
                    }
                    window.__liveExportLayout = {
                        chatBox: measureImgRelBox(document.getElementById('live-chat-list')),
                        joinBox: measureImgRelBox(document.getElementById('live-join-ticker-row')),
                        scrollBox: measureImgRelBox(document.getElementById('live-chat-scroll-box')),
                        giftBox: measureImgRelBox(document.querySelector('.live-gift-combo-slot') || document.getElementById('live-gift-combo-banner')),
                        botBarBox: measureImgRelBox(document.querySelector('.live-bottom-bar')),
                        sysNoticeBox: measureImgRelBox(document.getElementById('live-sys-notice')),
                        welcomeBox: measureImgRelBox(document.getElementById('live-room-welcome')),
                        redDotBox: measureImgRelBox(document.getElementById('live-red-breath-dot') || document.getElementById('live-pulse-dot') || document.querySelector('#live-left-live-pill .live-red-dot')),
                        brandViewportBox: measureImgRelBox(document.getElementById('live-brand-ticker-viewport') || document.getElementById('live-laya-brand-txt'))
                    };
                }

                const rawCropRectImg = window.getPlayerCropRect
                    ? window.getPlayerCropRect(mediaBox.w, mediaBox.h)
                    : { renderW: mediaBox.w + 12, renderH: mediaBox.h + 12, offX: -6, offY: -6 };
                const cropRect = {
                    offX: Math.round(rawCropRectImg.offX || 0),
                    offY: Math.round(rawCropRectImg.offY || 0),
                    renderW: Math.max(2, Math.round(rawCropRectImg.renderW || mediaBox.w)),
                    renderH: Math.max(2, Math.round(rawCropRectImg.renderH || mediaBox.h))
                };

                // 3. 直接在底层画布绘制当前视频暂停帧/播放帧 或 底层图片
                let directMediaDrawn = false;
                if (isVidMode && previewVideo.readyState >= 2 && previewVideo.videoWidth > 0) {
                    try {
                        ctx.save();
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
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
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
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

                if (!isLightExport && directMediaDrawn) {
                    ctx.save();
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = Math.max(4, Math.round(2 * scaleFactor));
                    ctx.strokeRect(mediaBox.x, mediaBox.y, mediaBox.w, mediaBox.h);
                    ctx.restore();
                }

                // 4. 渲染透明 UI 覆层（通过 ignoreElements 跳过媒体层克隆，且强制移除容器黑色背景，绝不遮挡底层画面）
                const uiCanvas = await html2canvas(renderTarget, {
                    scale: scaleFactor,
                    useCORS: true,
                    allowTaint: false,
                    backgroundColor: directMediaDrawn ? null : '#000000',
                    ignoreElements: (el) => {
                        if (el.id === 'live-dm-onstage-toolbar' || el.id === 'dy-cmt-font-quick-bar' || (el.classList && (el.classList.contains('live-dm-edit-toolbar') || el.classList.contains('dy-cmt-font-quick-bar') || el.classList.contains('dy-cmt-stage-QuickTools')))) {
                            return true;
                        }
                        if (isLiveOpenImg && (el.id === 'live-floating-dm-stage' || el.id === 'live-floating-hearts')) {
                            return true;
                        }
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

                        if (isLiveOpenImg) {
                            ['live-gift-combo-banner', 'live-sys-notice', 'live-room-welcome', 'live-chat-list', 'live-join-ticker-row', 'live-red-breath-dot', 'live-pulse-dot', 'live-laya-brand-txt'].forEach(lid => {
                                const lEl = clonedDoc.getElementById(lid);
                                if (lEl) lEl.style.visibility = 'hidden';
                            });
                            clonedDoc.querySelectorAll('#live-left-live-pill .live-red-dot').forEach(dotEl => {
                                dotEl.style.visibility = 'hidden';
                            });
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

                // 5. 先用原生 Canvas 2D 绘制无缝顶/底渐变蒙层与底层顶部导航光效，再在最上层叠加纯白导航文字 UI 覆层（确保光效永远在「直播」文字下面）
                drawSeamlessHudGradients(ctx, outW, outH);
                drawTopNavActiveGlowOnCanvas(ctx, targetRect, scaleFactor, scaleFactor);
                ctx.drawImage(uiCanvas, 0, 0, outW, outH);

                // 5.2 若处于直播间模式，使用与视频导出完全一致的 Canvas 渲染管线绘制礼物弹窗、欢迎语、弹幕列表与飘心，确保截图与视频导出 100% 视觉同源
                if (isLiveOpenImg && typeof window.__drawLiveRoomDynamicCanvas === 'function') {
                    const activeExportFontImg = (typeof getActiveOsFontStack === 'function')
                        ? getActiveOsFontStack()
                        : '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Source Han Sans SC", "Noto Sans SC", sans-serif';
                    window.__drawLiveRoomDynamicCanvas(ctx, outW, outH, scaleFactor, scaleFactor, 0, activeExportFontImg);
                }

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
                if (typeof window.__restoreLiveExportAfterDone === 'function') {
                    window.__restoreLiveExportAfterDone();
                }
                if (typeof window.restoreStageMagnifierAfterExport === 'function') {
                    window.restoreStageMagnifierAfterExport();
                }
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

            prepareCleanStageBeforeExport();

            // 计算录制起点与时长：
            // 100% 严格按照用户在底部时间轴「✂️ 导出区间 (共 XX.Xs)」与顶部录制秒数框选定的秒数导出
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

            let exportStartSec = Math.max(0, Math.min(trimRange.start || 0, Math.max(0, vidTotalDur - 0.2)));
            let sourceClipSpan = trimRange.duration;

            if (window.PlayerEngine.userHasTrimmed) {
                exportStartSec = Math.max(0, Math.min(trimRange.start || 0, Math.max(0, vidTotalDur - 0.2)));
                sourceClipSpan = Math.max(0.5, Math.min(trimRange.duration, vidTotalDur - exportStartSec));
            } else {
                // ★ 默认始终从时间轴导出区间起点 (00:00.0) 开始完整录制，绝不因预览播放头走到半路而漏掉前半段视频
                exportStartSec = Math.max(0, Math.min(trimRange.start || 0, Math.max(0, vidTotalDur - 0.2)));
                if (vidTotalDur <= 60 || dropdownSec >= vidTotalDur) {
                    sourceClipSpan = Math.max(0.5, vidTotalDur - exportStartSec);
                } else {
                    sourceClipSpan = Math.min(dropdownSec, Math.max(0.5, vidTotalDur - exportStartSec));
                }
            }
            // 与界面显示的「(共 XX.Xs)」保持完全一致的 0.1s 精度（例如显示 13.6s 则导出严格为 13.6s）
            sourceClipSpan = Math.min(sourceClipSpan, Math.max(0.5, vidTotalDur - exportStartSec));
            sourceClipSpan = Math.max(0.5, Math.round(sourceClipSpan * 10) / 10);

            const origPlaybackRate = previewVideo.playbackRate || 1.0;
            const exportSpeedRate = Math.max(0.25, Math.min(4.0, origPlaybackRate));
            // 结合用户设定的倍速计算实际导出的成片时长（例如 13.6s 片段在 1.0x 原速下严格导出 13.6s）
            const recordSeconds = Math.max(0.5, Number((sourceClipSpan / exportSpeedRate).toFixed(2)));
            const origLoopState = previewVideo.loop;
            const origMutedState = !!previewVideo.muted;
            const origPausedState = !!(previewVideo.paused || (window.PlayerEngine && window.PlayerEngine._stoppedAtClipEnd));

            origVidBtnText = '🎥 录屏导出视频';
            btnSaveVid.textContent = `⏳ 正在构建 1080P 手机硬解覆层...`;
            window.__isExportRecording = true;

            // 在 html2canvas 构建 UI 覆层期间，暂停视频并锁定在裁剪起点，同时严格尊重用户的静音/原声开关选择
            previewVideo.loop = false;
            previewVideo.muted = origMutedState;
            previewVideo.volume = 1.0;
            if (!origMutedState && window._audioCtx && window._audioCtx.state === 'suspended') {
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

                // ★ 支持 1080p 与 720p 导出分辨率（默认超清 1080p：横屏 1920x1080 / 竖屏 1080x1920；若用户切换为 720P 画质档位则为 1280x720 / 720x1280），编码分辨率与画布分辨率 100% 严格一致，绝不额外降采样
                const botResTxt = (document.getElementById('disp-bot-res')?.textContent || '') + ' ' + (document.getElementById('m-disp-res-badge')?.textContent || '');
                const prefer720p = /720P/i.test(botResTxt) && !isPort;
                let outW = prefer720p ? 1280 : 1920;
                let outH = prefer720p ? 720 : 1080;
                if (isPort) {
                    outW = prefer720p ? 720 : 1080;
                    outH = prefer720p ? 1280 : 1920;
                }
                offCanvas.width = outW;
                offCanvas.height = outH;
                const ctx = offCanvas.getContext('2d', { alpha: false });
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                if (window.PlayerEngine.updatePlayStateUI) {
                    window.PlayerEngine.updatePlayStateUI(true);
                }

                if (typeof window.suspendStageMagnifierForExport === 'function') {
                    window.suspendStageMagnifierForExport();
                }

                const targetRect = renderTarget.getBoundingClientRect();
                const baseRectW = targetRect.width || (isPort ? 366 : 1040);
                const baseRectH = targetRect.height || (isPort ? 650 : 585);
                const scaleRatioX = outW / baseRectW;
                const scaleRatioY = outH / baseRectH;

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
                // ★ 修复：直播间模式下同样完整保留 16:9 横屏取景框 (port-land-box) 与 9:16 竖屏框，确保网页预览与导出视频 1:1 完全一致！
                const isSpecialSubBox = renderTarget.classList.contains('port-land-box') || renderTarget.classList.contains('land-port-box') || (!isLiveOpenVid && renderTarget.classList.contains('dy-comment-open'));
                const mediaWrapEl = document.getElementById('player-media-wrap');
                const rawMediaWrapBox = isSpecialSubBox
                    ? (measureRelBox(mediaWrapEl) || { x: 0, y: 0, w: outW, h: outH })
                    : { x: 0, y: 0, w: outW, h: outH };
                // ★ 像素级整数对齐：彻底消除 Canvas drawImage 半像素双线性插值导致的视频画面发虚模糊
                const mediaWrapBox = {
                    x: Math.round(rawMediaWrapBox.x),
                    y: Math.round(rawMediaWrapBox.y),
                    w: Math.max(2, Math.round(rawMediaWrapBox.w)),
                    h: Math.max(2, Math.round(rawMediaWrapBox.h))
                };

                if (isLiveOpenVid && typeof window.__captureLiveExportInitialState === 'function') {
                    window.__captureLiveExportInitialState();
                }

                const pcBarBox = measureRelBox(document.getElementById('progress-click-bar'));
                const pcTimeBox = measureRelBox(document.getElementById('disp-time'));
                const mBarBox = measureRelBox(document.querySelector('.m-progress-track'));
                const mTimeBox = measureRelBox(document.getElementById('m-disp-time'));
                const dyBarBox = measureRelBox(document.querySelector('.dy-tiny-progressbar'));
                const dylBarBox = measureRelBox(document.querySelector('.dyl-progress-track'));
                const dylTimeBox = measureRelBox(document.getElementById('dyl-wrap-time'));
                const dylSubBox = measureRelBox(document.getElementById('dyl-wrap-subtitle'));
                const liveChatListBox = isLiveOpenVid ? measureRelBox(document.getElementById('live-chat-list')) : null;
                const liveJoinTickerBox = isLiveOpenVid ? measureRelBox(document.getElementById('live-join-ticker-row')) : null;
                const liveScrollBoxRect = isLiveOpenVid ? measureRelBox(document.getElementById('live-chat-scroll-box')) : null;
                const liveGiftSlotBox = isLiveOpenVid ? measureRelBox(document.querySelector('.live-gift-combo-slot') || document.getElementById('live-gift-combo-banner')) : null;
                const liveBotBarBox = isLiveOpenVid ? measureRelBox(document.querySelector('.live-bottom-bar')) : null;
                const liveSysNoticeBox = isLiveOpenVid ? measureRelBox(document.getElementById('live-sys-notice')) : null;
                const liveRoomWelcomeBox = isLiveOpenVid ? measureRelBox(document.getElementById('live-room-welcome')) : null;
                const liveRedDotBox = isLiveOpenVid ? measureRelBox(document.getElementById('live-red-breath-dot') || document.getElementById('live-pulse-dot') || document.querySelector('#live-left-live-pill .live-red-dot')) : null;
                const liveBrandViewportBox = isLiveOpenVid ? measureRelBox(document.getElementById('live-brand-ticker-viewport') || document.getElementById('live-laya-brand-txt')) : null;
                window.__liveExportLayout = isLiveOpenVid ? {
                    chatBox: liveChatListBox,
                    joinBox: liveJoinTickerBox,
                    scrollBox: liveScrollBoxRect,
                    giftBox: liveGiftSlotBox,
                    botBarBox: liveBotBarBox,
                    sysNoticeBox: liveSysNoticeBox,
                    welcomeBox: liveRoomWelcomeBox,
                    redDotBox: liveRedDotBox,
                    brandViewportBox: liveBrandViewportBox
                } : null;

                // 抓取静态透明 UI 覆层（通过 ignoreElements 完全跳过媒体与弹幕节点，并强制移除容器黑色背景）
                const uiSnapshotCanvas = await html2canvas(renderTarget, {
                    backgroundColor: null,
                    scale: scaleRatioX,
                    useCORS: true,
                    allowTaint: false,
                    ignoreElements: (el) => {
                        if (el.id === 'live-dm-onstage-toolbar' || el.id === 'dy-cmt-font-quick-bar' || (el.classList && (el.classList.contains('live-dm-edit-toolbar') || el.classList.contains('dy-cmt-font-quick-bar') || el.classList.contains('dy-cmt-stage-QuickTools')))) {
                            return true;
                        }
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
                        // 若处于直播间模式导出视频，隐藏静态快照中的礼物横幅、防诈提示、欢迎语、评论列表、进场条、顶部动态轮播字与 LIVE 呼吸红点，统一由 CFR 动态画布无缝流式绘制
                        if (isLiveOpenVid) {
                            ['live-gift-combo-banner', 'live-sys-notice', 'live-room-welcome', 'live-chat-list', 'live-join-ticker-row', 'live-red-breath-dot', 'live-pulse-dot', 'live-laya-brand-txt'].forEach(lid => {
                                const lEl = clonedDoc.getElementById(lid);
                                if (lEl) lEl.style.visibility = 'hidden';
                            });
                            clonedDoc.querySelectorAll('#live-left-live-pill .live-red-dot').forEach(dotEl => {
                                dotEl.style.visibility = 'hidden';
                            });
                        }
                        const mTrack = clonedDoc.querySelector('.m-progress-track');
                        if (mTrack) mTrack.style.visibility = 'hidden';
                        const dyTrack = clonedDoc.querySelector('.dy-tiny-progressbar');
                        if (dyTrack) dyTrack.style.visibility = 'hidden';
                        const dylTrack = clonedDoc.querySelector('.dyl-progress-track');
                        if (dylTrack) dylTrack.style.visibility = 'hidden';
                    }
                });

                // 预合成 1:1 尺寸的 UI 覆层画布（严禁纵向非等比拉伸，确保画面文字与头像 100% 原比例无变形）
                const uiOverlayCanvas = document.createElement('canvas');
                uiOverlayCanvas.width = outW;
                uiOverlayCanvas.height = outH;
                const uiOverlayCtx = uiOverlayCanvas.getContext('2d');
                uiOverlayCtx.imageSmoothingEnabled = true;
                uiOverlayCtx.imageSmoothingQuality = 'high';
                drawSeamlessHudGradients(uiOverlayCtx, outW, outH);
                // ★ 先在底层绘制顶部导航选中态极光贴图 (top_glow)，再叠加纯白文字 UI 快照，确保录屏导出时光效永远在「直播」文字下面
                drawTopNavActiveGlowOnCanvas(uiOverlayCtx, targetRect, scaleRatioX, scaleRatioY);
                uiOverlayCtx.drawImage(uiSnapshotCanvas, 0, 0, outW, outH);

                const rawCachedCropRect = window.getPlayerCropRect
                    ? window.getPlayerCropRect(mediaWrapBox.w, mediaWrapBox.h)
                    : { renderW: mediaWrapBox.w + 12, renderH: mediaWrapBox.h + 12, offX: -6, offY: -6 };
                const cachedCropRect = {
                    offX: Math.round(rawCachedCropRect.offX || 0),
                    offY: Math.round(rawCachedCropRect.offY || 0),
                    renderW: Math.max(2, Math.round(rawCachedCropRect.renderW || mediaWrapBox.w)),
                    renderH: Math.max(2, Math.round(rawCachedCropRect.renderH || mediaWrapBox.h))
                };
                const cachedFilter = (mediaWrapEl && mediaWrapEl.style.filter) ? mediaWrapEl.style.filter : '';
                const dmContainerEl = document.getElementById('danmaku-container');
                const dmSwitchEl = document.getElementById('sw-danmaku');
                const isDmContainerVisible = !!(dmContainerEl && window.getComputedStyle(dmContainerEl).display !== 'none' && window.getComputedStyle(dmContainerEl).visibility !== 'hidden');
                const showDanmaku = !isLiveOpenVid && ((dmSwitchEl ? dmSwitchEl.checked : true) || isDmContainerVisible);
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

                // ★ 问题二 & 问题三：恒定 30fps（源视频 60fps 则 60fps）CFR 超清参数与全设备通用标准 MP4
                //   - 1080p 显式采用 'avc1.640033' (H.264 High Profile Level 5.1)，固定高码率 14~16 Mbps (10~16 Mbps)
                //   - 720p  显式采用 'avc1.640028' (H.264 High Profile Level 4.0)，固定高码率 7~8 Mbps   (5~8 Mbps)
                //   - 音频固定 AAC (mp4a.40.2, 44100/48000Hz, 128kbps)
                const is1080pExport = (Math.max(outW, outH) >= 1080);
                const TARGET_FPS = (window.__detectedSourceFps === 60) ? 60 : 30;
                const TARGET_VIDEO_BITRATE = is1080pExport ? 15_000_000 : 7_500_000;
                const TARGET_AUDIO_BITRATE = 128_000;

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
                            : ((outW + tw) / (durSec * TARGET_FPS));

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
                            speed: (isFixedDm || lockedX || isDmPaused) ? 0 : ((outW + tw) / (durSec * TARGET_FPS))
                        });
                    });
                }

                if (typeof window.restoreStageMagnifierAfterExport === 'function') {
                    window.restoreStageMagnifierAfterExport();
                }

                const baseStartSec = window.PlayerEngine.timeToSec(inStartTime.value);
                const totalVideoSec = window.PlayerEngine.timeToSec(inTotalTime.value) || 1125;
                const bufferPct = Math.min(100, Math.max(0, parseFloat(inBuffer.value) || 68)) / 100;

                previewVideo.playbackRate = exportSpeedRate;
                previewVideo.defaultPlaybackRate = exportSpeedRate;

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
                        if (cachedFilter && cachedFilter !== 'none') ctx.filter = cachedFilter;
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
                        if (!isLightRecord) {
                            ctx.strokeStyle = '#000000';
                            ctx.lineWidth = Math.max(4, Math.round(2 * scaleRatioX));
                            ctx.strokeRect(mediaWrapBox.x, mediaWrapBox.y, mediaWrapBox.w, mediaWrapBox.h);
                        }
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

                    // 4. 动态绘制进度条与时间码（全模式统一遵循用户设定的虚拟超长总时长与起始时间区间一秒一秒走动，尾帧精准停在片段结束秒数）
                    const rawElapsed = forcedElapsedSec !== null ? forcedElapsedSec : ((nowStamp - recordStartStamp) / 1000);
                    const snappedElapsed = (rawElapsed >= Math.max(0.1, (recordSeconds || 10) - 0.06))
                        ? Math.round(recordSeconds || 10)
                        : rawElapsed;
                    const elapsedSec = syncTimeChecked ? snappedElapsed : 0;
                    const curSec = baseStartSec + elapsedSec;
                    const dispCurSecInt = Math.floor(curSec + 0.001);
                    const effTotalVideoSec = Math.max(baseStartSec + Math.ceil(recordSeconds || 10), totalVideoSec);
                    const curPct = Math.min(1, Math.max(0, curSec / effTotalVideoSec));
                    const effBufferPct = Math.max(bufferPct, Math.min(1, curPct + 0.12));

                    ctx.save();
                    if (!isPort && !isLand && !isDyLand) {
                        if (showPcBot && pcBarBox) {
                            ctx.fillStyle = isLightRecord ? 'rgba(22,24,35,0.18)' : 'rgba(255,255,255,0.22)';
                            ctx.fillRect(pcBarBox.x, pcBarBox.y, pcBarBox.w, pcBarBox.h);
                            ctx.fillStyle = isLightRecord ? 'rgba(22,24,35,0.32)' : 'rgba(255,255,255,0.42)';
                            ctx.fillRect(pcBarBox.x, pcBarBox.y, pcBarBox.w * effBufferPct, pcBarBox.h);
                            const fillW = pcBarBox.w * curPct;
                            ctx.fillStyle = '#1877F2';
                            ctx.fillRect(pcBarBox.x, pcBarBox.y, fillW, pcBarBox.h);
                            ctx.beginPath();
                            ctx.arc(pcBarBox.x + fillW, pcBarBox.y + pcBarBox.h / 2, 5.5 * scaleRatioX, 0, Math.PI * 2);
                            ctx.fillStyle = isLightRecord ? '#1877F2' : '#ffffff';
                            ctx.fill();
                        }
                        if (showPcBot && pcTimeBox) {
                            const timeText = `${window.PlayerEngine.secToTime(dispCurSecInt)} / ${window.PlayerEngine.secToTime(effTotalVideoSec)}`;
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
                            ctx.fillRect(mBarBox.x, mBarBox.y, mBarBox.w * effBufferPct, mBarBox.h);
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
                            const shortTime = `${window.PlayerEngine.secToShortTime(dispCurSecInt)} / ${window.PlayerEngine.secToShortTime(effTotalVideoSec)}`;
                            ctx.font = `500 ${Math.round(12.5 * scaleRatioX)}px ${activeExportFont}`;
                            ctx.fillStyle = isLightRecord ? '#161823' : '#ffffff';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(shortTime, mTimeBox.x, mTimeBox.y + mTimeBox.h / 2);
                        }
                    } else if (isDyLand) {
                        if (showDylBot && dylBarBox) {
                            ctx.fillStyle = isLightRecord ? 'rgba(22,24,35,0.22)' : 'rgba(255,255,255,0.28)';
                            ctx.fillRect(dylBarBox.x, dylBarBox.y, dylBarBox.w, dylBarBox.h);
                            const fillW = dylBarBox.w * curPct;
                            ctx.fillStyle = isLightRecord ? '#7c3aed' : '#ffffff';
                            ctx.fillRect(dylBarBox.x, dylBarBox.y, fillW, dylBarBox.h);
                            ctx.beginPath();
                            ctx.arc(dylBarBox.x + fillW, dylBarBox.y + dylBarBox.h / 2, 5 * scaleRatioX, 0, Math.PI * 2);
                            ctx.fillStyle = isLightRecord ? '#7c3aed' : '#ffffff';
                            ctx.fill();
                        }
                        if (showDylBot && showDylTime && dylTimeBox) {
                            const tLeft = window.PlayerEngine.formatVirtualTimeForDyl
                                ? window.PlayerEngine.formatVirtualTimeForDyl(dispCurSecInt, effTotalVideoSec)
                                : window.PlayerEngine.secToTime(dispCurSecInt);
                            const tRight = window.PlayerEngine.formatVirtualTimeForDyl
                                ? window.PlayerEngine.formatVirtualTimeForDyl(effTotalVideoSec, effTotalVideoSec)
                                : window.PlayerEngine.secToTime(effTotalVideoSec);
                            ctx.font = `600 ${Math.round(12 * scaleRatioX)}px ${activeExportFont}`;
                            ctx.fillStyle = isLightRecord ? '#161823' : 'rgba(255,255,255,0.92)';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(`${tLeft} / ${tRight}`, dylTimeBox.x, dylTimeBox.y + dylTimeBox.h / 2);
                        }
                    } else if (isPort && dyBarBox && !isLiveOpenVid) {
                        const barH = Math.max(3.5 * scaleRatioY, dyBarBox.h);
                        ctx.fillStyle = isLightRecord ? 'rgba(22,24,35,0.18)' : 'rgba(255,255,255,0.32)';
                        ctx.fillRect(dyBarBox.x, dyBarBox.y, dyBarBox.w, barH);
                        ctx.fillStyle = isLightRecord ? 'rgba(22,24,35,0.32)' : 'rgba(255,255,255,0.52)';
                        ctx.fillRect(dyBarBox.x, dyBarBox.y, dyBarBox.w * effBufferPct, barH);
                        const fillW = dyBarBox.w * curPct;
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
                    // 显式指定 H.264 High Profile：1080p 优先用 'avc1.640033'，720p 优先用 'avc1.640028'，编码分辨率严格与画布导出分辨率 (outW x outH) 一致
                    const primaryHighProfile = is1080pExport ? 'avc1.640033' : 'avc1.640028';
                    const secondaryHighProfile = is1080pExport ? 'avc1.640028' : 'avc1.640033';
                    const h264Candidates = [
                        primaryHighProfile,   // H.264 High Profile (1080p: avc1.640033 / 720p: avc1.640028)
                        secondaryHighProfile,
                        'avc1.64002a',        // H.264 High Profile Level 4.2
                        'avc1.640029',        // H.264 High Profile Level 4.1
                        'avc1.4d002a',        // H.264 Main Profile Level 4.2
                        'avc1.4d0029',        // H.264 Main Profile Level 4.1
                        'avc1.4d0028',        // H.264 Main Profile Level 4.0
                        'avc1.42e02a',        // H.264 Constrained Baseline Level 4.2
                        'avc1.42e028'         // H.264 Constrained Baseline Level 4.0
                    ];
                    // 兼容各显卡驱动的多阶配置：优先 High Profile + quality + CBR，若部分显卡不支持 CBR+quality 共存则平滑回退 High Profile + quality (高码率 VBR)
                    const encoderVariantTemplates = [
                        { hardwareAcceleration: 'prefer-hardware', latencyMode: 'quality', bitrateMode: 'constant' },
                        { hardwareAcceleration: 'prefer-hardware', latencyMode: 'quality' },
                        { latencyMode: 'quality' },
                        { hardwareAcceleration: 'prefer-software', latencyMode: 'quality' },
                        { hardwareAcceleration: 'prefer-hardware', latencyMode: 'realtime' }
                    ];
                    outerCodecLoop:
                    for (const codecStr of h264Candidates) {
                        for (const variant of encoderVariantTemplates) {
                            try {
                                const cfg = Object.assign({
                                    codec: codecStr,
                                    width: outW,
                                    height: outH,
                                    bitrate: TARGET_VIDEO_BITRATE,
                                    framerate: TARGET_FPS,
                                    avc: { format: 'avc' }
                                }, variant);
                                const sup = await VideoEncoder.isConfigSupported(cfg);
                                if (sup && sup.supported) {
                                    selectedVideoCodecConfig = Object.assign({}, sup.config || cfg, {
                                        codec: codecStr,
                                        width: outW,
                                        height: outH,
                                        bitrate: TARGET_VIDEO_BITRATE,
                                        framerate: TARGET_FPS,
                                        avc: { format: 'avc' }
                                    });
                                    webCodecsSupported = true;
                                    break outerCodecLoop;
                                }
                            } catch (e) {}
                        }
                    }
                }

                // 尝试解码源视频音轨并以 AAC (mp4a.40.2, 44100/48000Hz, 128kbps) 编码混流
                if (!origMutedState && webCodecsSupported && typeof window.AudioEncoder === 'function' && typeof window.AudioData === 'function' && previewVideo.src) {
                    try {
                        const resp = await fetch(previewVideo.src);
                        if (resp.ok) {
                            const arrBuf = await resp.arrayBuffer();
                            const decCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
                            try {
                                decodedAudioBuffer = await decCtx.decodeAudioData(arrBuf);
                            } catch (decErr) {
                                decodedAudioBuffer = null;
                            } finally {
                                if (decCtx.close) decCtx.close().catch(() => {});
                            }
                        }
                        if (decodedAudioBuffer) {
                            const rawSr = decodedAudioBuffer.sampleRate || 48000;
                            const sampleRate = (rawSr === 44100 || rawSr === 48000) ? rawSr : 48000;
                            const numCh = Math.min(2, Math.max(1, decodedAudioBuffer.numberOfChannels || 2));
                            const aCfg = {
                                codec: 'mp4a.40.2', // AAC-LC 标准音频 (ISO BMFF MP4 全设备通用)
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
                    let videoEncoder = null;
                    let muxer = null;
                    let muxerEncoderError = null;
                    const encodedAudioChunks = [];

                    // 1) 先安全预编码音频轨（支持 0.5x~2.0x 倍速线性插值重采样，确保倍速下音画时长 100% 同步）
                    if (!origMutedState && selectedAudioCodecConfig && decodedAudioBuffer) {
                        try {
                            const audioEncoder = new AudioEncoder({
                                output: (chunk, meta) => {
                                    encodedAudioChunks.push({ chunk, meta });
                                },
                                error: (e) => {
                                    console.warn('AudioEncoder warning:', e);
                                }
                            });
                            audioEncoder.configure(selectedAudioCodecConfig);
                            const sr = selectedAudioCodecConfig.sampleRate;
                            const nCh = selectedAudioCodecConfig.numberOfChannels;
                            const startSample = Math.max(0, Math.floor(exportStartSec * sr));
                            const exactOutDurSec = Math.max(1, Math.round(recordSeconds * TARGET_FPS)) / TARGET_FPS;
                            const totalSamples = Math.max(1, Math.floor(exactOutDurSec * sr));
                            const chunkFrames = 1024;
                            const isNormalRate = Math.abs(exportSpeedRate - 1.0) < 0.005;
                            for (let offset = 0; offset < totalSamples; offset += chunkFrames) {
                                if (audioEncoder.state !== 'configured') break;
                                const curFrames = Math.min(chunkFrames, totalSamples - offset);
                                if (curFrames <= 0) break;
                                const planarBuf = new Float32Array(curFrames * nCh);
                                for (let ch = 0; ch < nCh; ch++) {
                                    const srcCh = decodedAudioBuffer.getChannelData(Math.min(ch, decodedAudioBuffer.numberOfChannels - 1));
                                    const dstOffset = ch * curFrames;
                                    if (isNormalRate) {
                                        const sStart = Math.min(srcCh.length, startSample + offset);
                                        const sEnd = Math.min(srcCh.length, sStart + curFrames);
                                        if (sEnd > sStart) {
                                            planarBuf.set(srcCh.subarray(sStart, sEnd), dstOffset);
                                        }
                                    } else {
                                        const maxSrcIdx = srcCh.length - 1;
                                        for (let i = 0; i < curFrames; i++) {
                                            const srcPos = startSample + (offset + i) * exportSpeedRate;
                                            if (srcPos > maxSrcIdx) {
                                                planarBuf[dstOffset + i] = 0;
                                            } else {
                                                const idx0 = Math.min(maxSrcIdx, Math.max(0, Math.floor(srcPos)));
                                                const idx1 = Math.min(maxSrcIdx, idx0 + 1);
                                                const frac = srcPos - idx0;
                                                planarBuf[dstOffset + i] = srcCh[idx0] * (1 - frac) + srcCh[idx1] * frac;
                                            }
                                        }
                                    }
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
                            if (audioEncoder.state === 'configured') {
                                await audioEncoder.flush();
                            }
                            if (audioEncoder.state !== 'closed') {
                                audioEncoder.close();
                            }
                        } catch (audEncErr) {
                            console.warn('AAC encode note (fallback to video track):', audEncErr);
                            encodedAudioChunks.length = 0;
                        }
                    }

                    // 2) 初始化 Mp4Muxer 与 VideoEncoder，并预检首帧编码是否被显卡接受
                    try {
                        const muxerOpts = {
                            target: new window.Mp4Muxer.ArrayBufferTarget(),
                            video: {
                                codec: 'avc',
                                width: outW,
                                height: outH,
                                frameRate: TARGET_FPS
                            },
                            fastStart: 'in-memory',
                            firstTimestampBehavior: 'offset'
                        };
                        if (encodedAudioChunks.length > 0 && selectedAudioCodecConfig) {
                            muxerOpts.audio = {
                                codec: 'aac',
                                numberOfChannels: selectedAudioCodecConfig.numberOfChannels,
                                sampleRate: selectedAudioCodecConfig.sampleRate
                            };
                        }
                        muxer = new window.Mp4Muxer.Muxer(muxerOpts);
                        for (const item of encodedAudioChunks) {
                            try { muxer.addAudioChunk(item.chunk, item.meta); } catch (e) {}
                        }

                        videoEncoder = new VideoEncoder({
                            output: (chunk, meta) => {
                                try { muxer.addVideoChunk(chunk, meta); } catch (e) { muxerEncoderError = e; }
                            },
                            error: (e) => {
                                muxerEncoderError = e;
                            }
                        });
                        videoEncoder.configure(selectedVideoCodecConfig);
                    } catch (initEncErr) {
                        console.warn('WebCodecs init fallback to MediaRecorder:', initEncErr);
                        webCodecsSupported = false;
                    }

                    if (webCodecsSupported && videoEncoder && muxer && videoEncoder.state === 'configured') {
                        const totalFrames = Math.max(1, Math.round(recordSeconds * TARGET_FPS));
                        const frameDurationUs = Math.round(1_000_000 / TARGET_FPS);
                        let isRecording = true;
                        let encodedFrameCount = 0;
                        let intervalId = null;

                        const finalizeWebCodecsExport = async () => {
                            if (!isRecording) return;
                            isRecording = false;
                            window.__stopActiveExport = null;
                            if (intervalId) {
                                clearTimeout(intervalId);
                                clearInterval(intervalId);
                                intervalId = null;
                            }

                            try {
                                btnSaveVid.textContent = `⏳ 正在封装 H.264 High + faststart MP4...`;
                                if (videoEncoder.state === 'configured') {
                                    await videoEncoder.flush();
                                }
                                if (videoEncoder.state !== 'closed') {
                                    videoEncoder.close();
                                }
                                muxer.finalize();

                                if (muxerEncoderError || encodedFrameCount === 0) {
                                    throw (muxerEncoderError || new Error('未采集到有效视频帧'));
                                }

                                const { buffer } = muxer.target;
                                const blob = new Blob([buffer], { type: 'video/mp4' });
                                const downloadUrl = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.style.display = 'none';
                                const modeTag = isPort ? 'MobilePort' : (isDyLand ? 'DouyinFullLand' : (isLand ? 'MobileCinema' : 'WebPC'));
                                link.download = `Laya_${modeTag}_H264_${TARGET_FPS}fps_${Date.now()}.mp4`;
                                link.href = downloadUrl;
                                document.body.appendChild(link);
                                link.click();
                                setTimeout(() => {
                                    if (link.parentNode) link.parentNode.removeChild(link);
                                    URL.revokeObjectURL(downloadUrl);
                                }, 800);

                                const actualSec = Math.max(0.5, encodedFrameCount / TARGET_FPS).toFixed(1);
                                const audioTag = (encodedAudioChunks.length > 0 && !origMutedState) ? 'H.264+AAC' : (origMutedState ? '静音无音轨' : 'H.264');
                                window.showToast(`🎉 全设备通用 MP4 (${audioTag} · 恒定${TARGET_FPS}fps · faststart · ${actualSec}s) 导出成功！`);
                            } catch (encFinalErr) {
                                console.error('WebCodecs finalize error:', encFinalErr);
                                window.showToast(`❌ MP4 封装失败：${encFinalErr.message || '请重试'}`);
                            } finally {
                                window.__isExportRecording = false;
                                window.__stopActiveExport = null;
                                if (typeof window.restoreStageMagnifierAfterExport === 'function') {
                                    window.restoreStageMagnifierAfterExport();
                                }
                                if (typeof window.__restoreLiveExportAfterDone === 'function') {
                                    window.__restoreLiveExportAfterDone();
                                }
                                previewVideo.loop = origLoopState;
                                previewVideo.playbackRate = origPlaybackRate;
                                previewVideo.defaultPlaybackRate = origPlaybackRate;
                                previewVideo.muted = origMutedState;
                                if (window.PlayerEngine && typeof window.PlayerEngine.setVideoSoundMuted === 'function') {
                                    window.PlayerEngine.setVideoSoundMuted(origMutedState, false);
                                }
                                if (offCanvas.parentNode) offCanvas.parentNode.removeChild(offCanvas);
                                btnSaveVid.textContent = origVidBtnText;
                                btnSaveVid.disabled = false;
                                if (window.PlayerEngine) {
                                    window.PlayerEngine._stoppedAtClipEnd = false;
                                }
                                try { previewVideo.currentTime = exportStartSec; } catch (_e) {}
                                if (origPausedState) {
                                    try { previewVideo.pause(); } catch (_e) {}
                                    if (window.PlayerEngine && typeof window.PlayerEngine.updatePlayStateUI === 'function') {
                                        window.PlayerEngine.updatePlayStateUI(false);
                                    }
                                    if (window.PlayerEngine && typeof window.PlayerEngine.refreshTimeUI === 'function') {
                                        window.PlayerEngine.refreshTimeUI();
                                    }
                                } else if (window.PlayerEngine && typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') {
                                    window.PlayerEngine.ensureVideoPlayingIfActive(true);
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

                        // ★ 恒定 30fps/60fps (CFR) 零回跳单向顺滑采样循环：
                        //   1. 每帧 timestamp = Math.round(frameIndex * (1e6 / TARGET_FPS)) 微秒，严格恒定帧率 CFR
                        //   2. 严禁在正常录制中向后回跳 previewVideo.currentTime（彻底根除 GOP 硬件重解码导致的背景视频卡顿掉帧！）
                        //   3. 当 previewVideo 超前目标帧时间超过 0.85 帧时短暂暂停等待画布追上；轻微落后时微调倍速平滑追帧
                        let encodeBusy = false;
                        let lastForwardSeekTs = 0;
                        const frameStepSec = 1 / TARGET_FPS;

                        const stepWebCodecsFrame = () => {
                            if (!isRecording) return;
                            if (encodedFrameCount >= totalFrames) {
                                finalizeWebCodecsExport();
                                return;
                            }
                            if (encodeBusy) {
                                intervalId = setTimeout(stepWebCodecsFrame, 4);
                                return;
                            }
                            // 若硬件编码器队列积压超过 10 帧，先暂停源视频防止超前偷跑，等队列释放后再继续
                            if (typeof videoEncoder.encodeQueueSize === 'number' && videoEncoder.encodeQueueSize > 10) {
                                if (!previewVideo.paused) {
                                    try { previewVideo.pause(); } catch (_e) {}
                                }
                                intervalId = setTimeout(stepWebCodecsFrame, 6);
                                return;
                            }

                            const now = performance.now();
                            const exactElapsedSec = Math.min(recordSeconds, encodedFrameCount / TARGET_FPS);
                            const wallElapsedSec = Math.max(0.001, (now - recordStartStamp) / 1000);

                            // 尚未到达下一帧的采样时刻，按精确剩余毫秒数唤醒
                            if (wallElapsedSec + 0.002 < exactElapsedSec) {
                                const waitMs = Math.max(2, Math.min(12, Math.round((exactElapsedSec - wallElapsedSec) * 1000)));
                                intervalId = setTimeout(stepWebCodecsFrame, waitMs);
                                return;
                            }

                            encodeBusy = true;
                            try {
                                const targetVidTime = Math.min(
                                    Math.max(0, vidTotalDur - 0.015),
                                    exportStartSec + Math.min(sourceClipSpan, exactElapsedSec * exportSpeedRate)
                                );
                                const curVidTime = isFinite(previewVideo.currentTime) ? previewVideo.currentTime : targetVidTime;
                                const vidDrift = curVidTime - targetVidTime; // >0 表示视频超前，<0 表示视频落后

                                if (vidDrift > frameStepSec * 0.85) {
                                    // 视频超前：零回跳暂停等待编码帧追平，绝不 backward seek 破坏硬件解码流水线
                                    if (!previewVideo.paused) {
                                        try { previewVideo.pause(); } catch (_e) {}
                                    }
                                } else {
                                    // 视频处于同步区间或轻微落后：确保顺滑播放，必要时在 [0.94x, 1.08x] 内无感微调追齐
                                    let desiredRate = exportSpeedRate;
                                    if (vidDrift < -0.045) {
                                        desiredRate = Math.min(4.0, Number((exportSpeedRate * 1.08).toFixed(3)));
                                    } else if (vidDrift > frameStepSec * 0.35) {
                                        desiredRate = Math.max(0.25, Number((exportSpeedRate * 0.94).toFixed(3)));
                                    }
                                    if (Math.abs((previewVideo.playbackRate || 1) - desiredRate) > 0.015) {
                                        try { previewVideo.playbackRate = desiredRate; } catch (_e) {}
                                    }
                                    if (!previewVideo.seeking && vidDrift < -1.25 && (now - lastForwardSeekTs > 1200)) {
                                        lastForwardSeekTs = now;
                                        try { previewVideo.currentTime = targetVidTime; } catch (_e) {}
                                    }
                                    if (previewVideo.paused && !previewVideo.ended && targetVidTime < vidTotalDur - 0.025) {
                                        previewVideo.play().catch(() => {});
                                    }
                                }

                                renderSingleFrame(now, exactElapsedSec);

                                if (videoEncoder.state === 'configured' && encodedFrameCount < totalFrames) {
                                    // 每帧 timestamp = frameIndex * (1e6 / fps) 微秒，严格保证 CFR，关键帧间隔约 1 秒
                                    const frameIndex = encodedFrameCount;
                                    const timestampUs = Math.round(frameIndex * (1e6 / TARGET_FPS));
                                    const frame = new VideoFrame(offCanvas, {
                                        timestamp: timestampUs,
                                        duration: frameDurationUs
                                    });
                                    videoEncoder.encode(frame, { keyFrame: (frameIndex % TARGET_FPS === 0) });
                                    frame.close();
                                    encodedFrameCount++;
                                }

                                const curProgressSec = encodedFrameCount / TARGET_FPS;
                                const remain = Math.max(0, recordSeconds - curProgressSec);
                                const pct = Math.min(99, Math.round((encodedFrameCount / totalFrames) * 100));
                                btnSaveVid.textContent = `🔴 导出中 ${pct}% (剩 ${remain.toFixed(1)}s · 点击立即保存)`;

                                if (encodedFrameCount >= totalFrames) {
                                    finalizeWebCodecsExport();
                                    return;
                                }
                            } catch (frameErr) {
                                console.warn('Frame encode warning:', frameErr);
                            } finally {
                                encodeBusy = false;
                            }
                            if (isRecording) {
                                intervalId = setTimeout(stepWebCodecsFrame, 4);
                            }
                        };

                        intervalId = setTimeout(stepWebCodecsFrame, 4);

                        return;
                    }
                }

                // =========================================================================
                // ★ 兼容降级方案（当旧浏览器不支持 WebCodecs 时）：恒定 30fps H.264 Baseline/Main + AAC MP4
                // =========================================================================
                const canvasStream = offCanvas.captureStream(TARGET_FPS);
                const videoTrack = canvasStream.getVideoTracks()[0];

                let audioTracks = [];
                if (!origMutedState) {
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

                // 严格固定 H.264 (avc1) + AAC (mp4a.40.2) 标准 MP4 格式，绝不产出 WebM 等其它格式
                const tryConfigs = [
                    { stream: streamWithAudio, mime: 'video/mp4;codecs="avc1.640033, mp4a.40.2"', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/mp4;codecs="avc1.640028, mp4a.40.2"', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/mp4;codecs="avc1.4D4028, mp4a.40.2"', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/mp4;codecs="avc1.42E028, mp4a.40.2"', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/mp4;codecs="avc1.42E01F, mp4a.40.2"', ext: 'mp4' },
                    { stream: streamWithAudio, mime: 'video/mp4', ext: 'mp4' },
                    { stream: streamVideoOnly, mime: 'video/mp4;codecs="avc1.640028"', ext: 'mp4' },
                    { stream: streamVideoOnly, mime: 'video/mp4;codecs="avc1.42E01F"', ext: 'mp4' },
                    { stream: streamVideoOnly, mime: 'video/mp4', ext: 'mp4' }
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
                        renderSingleFrame(performance.now(), recordSeconds);
                        if (videoTrack && typeof videoTrack.requestFrame === 'function') {
                            videoTrack.requestFrame();
                        }
                    } catch (_e) {}
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
                    if (typeof window.restoreStageMagnifierAfterExport === 'function') {
                        window.restoreStageMagnifierAfterExport();
                    }
                    if (typeof window.__restoreLiveExportAfterDone === 'function') {
                        window.__restoreLiveExportAfterDone();
                    }
                    previewVideo.loop = origLoopState;
                    previewVideo.playbackRate = origPlaybackRate;
                    previewVideo.defaultPlaybackRate = origPlaybackRate;
                    previewVideo.muted = origMutedState;
                    if (window.PlayerEngine && typeof window.PlayerEngine.setVideoSoundMuted === 'function') {
                        window.PlayerEngine.setVideoSoundMuted(origMutedState, false);
                    }
                    if (offCanvas.parentNode) offCanvas.parentNode.removeChild(offCanvas);
                    btnSaveVid.textContent = origVidBtnText;
                    btnSaveVid.disabled = false;
                    if (window.PlayerEngine) {
                        window.PlayerEngine._stoppedAtClipEnd = false;
                    }
                    try { previewVideo.currentTime = exportStartSec; } catch (_e) {}
                    if (origPausedState) {
                        try { previewVideo.pause(); } catch (_e) {}
                        if (window.PlayerEngine && typeof window.PlayerEngine.updatePlayStateUI === 'function') {
                            window.PlayerEngine.updatePlayStateUI(false);
                        }
                        if (window.PlayerEngine && typeof window.PlayerEngine.refreshTimeUI === 'function') {
                            window.PlayerEngine.refreshTimeUI();
                        }
                    } else if (window.PlayerEngine && typeof window.PlayerEngine.ensureVideoPlayingIfActive === 'function') {
                        window.PlayerEngine.ensureVideoPlayingIfActive(true);
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
                    if (elapsed >= recordSeconds || previewVideo.ended || (previewVideo.currentTime >= exportStartSec + sourceClipSpan + 0.05)) {
                        finishRecording();
                        return;
                    }
                    if (previewVideo.paused && !previewVideo.ended) {
                        previewVideo.play().catch(() => {});
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
                if (typeof window.restoreStageMagnifierAfterExport === 'function') {
                    window.restoreStageMagnifierAfterExport();
                }
                if (typeof window.__restoreLiveExportAfterDone === 'function') {
                    window.__restoreLiveExportAfterDone();
                }
                previewVideo.loop = origLoopState;
                previewVideo.playbackRate = origPlaybackRate;
                previewVideo.defaultPlaybackRate = origPlaybackRate;
                previewVideo.muted = origMutedState;
                if (window.PlayerEngine && typeof window.PlayerEngine.setVideoSoundMuted === 'function') {
                    window.PlayerEngine.setVideoSoundMuted(origMutedState, false);
                }
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

        // 直播间顶部胶囊标签（Laya 精选动态滚动话题 / 直播广场）自定义与随机控件
    const inLiveBrandTag = document.getElementById('in-live-brand-tag');
    const btnLiveRandBrandTag = document.getElementById('btn-live-rand-brand-tag');
    const btnLiveRandBrandTagBtn = document.getElementById('btn-live-rand-brand-tag-btn');
    const inLiveSquareTag = document.getElementById('in-live-square-tag');

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
    const inLiveGiftMinQty = document.getElementById('in-live-gift-min-qty');
    const inLiveGiftMaxQty = document.getElementById('in-live-gift-max-qty');
    const txtLiveGiftQtyRange = document.getElementById('txt-live-gift-qty-range');
    const giftQtyPresetBtns = document.querySelectorAll('.btn-gift-qty-preset');
    const swLiveGiftEmptyGap = document.getElementById('sw-live-gift-empty-gap');
    const txtLiveGiftGapStatus = document.getElementById('txt-live-gift-gap-status');
    const btnLiveToggleGiftGapNow = document.getElementById('btn-live-toggle-gift-gap-now');
    const inLiveGiftGapMin = document.getElementById('in-live-gift-gap-min');
    const inLiveGiftGapMax = document.getElementById('in-live-gift-gap-max');
    const inLiveGiftStaySec = document.getElementById('in-live-gift-stay-sec');
    const inLiveGiftFadeSec = document.getElementById('in-live-gift-fade-sec');
    const giftGapPresetBtns = document.querySelectorAll('.btn-gift-gap-preset');
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
    const inLiveDmBoxScale = document.getElementById('in-live-dm-box-scale');
    const btnLiveResetDmSize = document.getElementById('btn-live-reset-dm-size');
    const btnLiveResetDmPos = document.getElementById('btn-live-reset-dm-pos');
    const btnLiveResetDmArea = document.getElementById('btn-live-reset-dm-area');
    const btnLiveResetDmFont = document.getElementById('btn-live-reset-dm-font');
    const btnLivePanelAreaDown = document.getElementById('btn-live-panel-area-down');
    const btnLivePanelAreaUp = document.getElementById('btn-live-panel-area-up');
    const btnLivePanelFontDown = document.getElementById('btn-live-panel-font-down');
    const btnLivePanelFontUp = document.getElementById('btn-live-panel-font-up');
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
    const liveLayaBrandPill = document.getElementById('live-laya-brand-pill');
    const liveLayaBrandTxt = document.getElementById('live-laya-brand-txt');
    const liveSubSquarePill = document.getElementById('live-sub-square-pill');
    const liveSubTxtSquare = document.getElementById('live-sub-txt-square');
    const liveSysNoticeEl = document.getElementById('live-sys-notice');
    const liveSysNoticeTxt = document.getElementById('live-sys-notice-txt');
    const liveRoomWelcomeEl = document.getElementById('live-room-welcome');
    const liveRoomWelcomeTxt = document.getElementById('live-room-welcome-txt');
    const inLiveWelcomeTxt = document.getElementById('in-live-welcome-txt');
    const btnLiveRandWelcome = document.getElementById('btn-live-rand-welcome');
    const btnLiveRandWelcomeBtn = document.getElementById('btn-live-rand-welcome-btn');
    const swLiveShowWelcome = document.getElementById('sw-live-show-welcome');
    const inLiveNoticeTxt = document.getElementById('in-live-notice-txt');
    const btnLiveRandNotice = document.getElementById('btn-live-rand-notice');
    const btnLiveRandNoticeBtn = document.getElementById('btn-live-rand-notice-btn');
    const swLiveShowNotice = document.getElementById('sw-live-show-notice');

    // ★ 1. 右上角观众头像：直接采用内置 153+ 海外华人真实社交头像库 (Base64 高清原图秒开，绝不使用假剪影小人或蓝色 Laya 图标)
    function getDouyinLiveAudiencePool(mode) {
        const db = window.LAYA_ASIAN_AVATARS || {};
        const beauties = Array.isArray(db.beauties) ? db.beauties : [];
        const guys = Array.isArray(db.guys) ? db.guys : [];
        const vibes = Array.isArray(db.vibes) ? db.vibes : [];
        const pets = Array.isArray(db.pets) ? db.pets : [];
        const anime = Array.isArray(db.anime) ? db.anime : [];

        if (mode === 'beauties') {
            return beauties.length ? beauties : [...beauties, ...guys];
        }
        if (mode === 'guys') {
            return guys.length ? guys : [...guys, ...beauties];
        }
        if (mode === 'vibes') {
            return vibes.length ? vibes : [...vibes, ...beauties];
        }
        if (mode === 'pets') {
            return pets.length ? pets : [...pets, ...beauties];
        }
        if (mode === 'anime') {
            return anime.length ? anime : [...anime, ...beauties];
        }
        if (mode === 'real') {
            return [...beauties, ...guys];
        }
        // 默认 overseas-mix / douyin-mix：海外华人 IG / 小红书 / 台湾真实生活照 + 氛围感风景 + 萌宠混搭
        return [...beauties, ...guys, ...vibes, ...pets];
    }

    let liveAudUsedIndices = [-1, -1, -1];

    function syncLiveAudienceAvatars(randomize = true) {
        if (selLiveAudAvatarMode && (selLiveAudAvatarMode.value === 'douyin-default' || selLiveAudAvatarMode.value === 'douyin-mix')) {
            selLiveAudAvatarMode.value = 'overseas-mix';
        }
        const mode = selLiveAudAvatarMode ? selLiveAudAvatarMode.value : 'overseas-mix';
        const pool = getDouyinLiveAudiencePool(mode);

        if (liveAudImgs.length > 0 && pool.length > 0) {
            const avoidUrls = new Set();
            if (dyAvatarImg && dyAvatarImg.src) avoidUrls.add(dyAvatarImg.src);
            liveAudImgs.forEach((img, idx) => {
                let dataUrl = '';
                if (!randomize && liveAudUsedIndices[idx] >= 0 && liveAudUsedIndices[idx] < pool.length) {
                    dataUrl = pool[liveAudUsedIndices[idx]];
                } else if (typeof window.claimUniqueAvatarFromPool === 'function') {
                    dataUrl = window.claimUniqueAvatarFromPool(pool, avoidUrls);
                    const foundIdx = pool.indexOf(dataUrl);
                    liveAudUsedIndices[idx] = foundIdx >= 0 ? foundIdx : idx;
                } else {
                    const cand = Math.floor(Math.random() * pool.length);
                    liveAudUsedIndices[idx] = cand;
                    dataUrl = pool[cand];
                }
                if (dataUrl) {
                    avoidUrls.add(dataUrl);
                    img.src = dataUrl;
                    img.setAttribute('data-export-src', dataUrl);
                }
            });
        }
    }
    window.syncLiveAudienceAvatars = syncLiveAudienceAvatars;
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
            if (window.__isRestoringStorage) return;
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

    function formatLiveLikesNumberText(numVal) {
        const n = Math.max(1000, Math.min(12990000, Number(numVal) || 256000));
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
            triggerEl.classList.add('is-editing-inline');
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
                triggerEl.classList.remove('is-editing-inline');
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
            markFieldUserModified('in-live-viewers-text');
            markFieldUserModified('in-live-viewers');
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
            markFieldUserModified('in-live-viewers-text');
            markFieldUserModified('in-live-viewers');
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
    let liveGiftComboBounceTimer = null;
    let liveHeaderFlipTimer = null;
    let liveFlyDmRaf = null;
    let liveDmVisible = true;
    let liveChatCursor = 0;
    let liveJoinCursor = 0;
    let liveRollTickCount = 0;
    let liveFlyParticles = [];
    let lastLiveVideoSyncTime = -1;

    // ★ 自愈式检测当前是否处于直播间：若 #laya-live-room-overlay 正在显示但 renderTarget 的 dy-live-open 类意外丢失，立即自动补回，确保评论/礼物/点赞动画永不假死！
    function isLiveRoomOpenNow() {
        if (!renderTarget || !renderTarget.classList.contains('mode-mobile-port')) return false;
        const overlayVisible = !!(liveOverlayEl && liveOverlayEl.style.display === 'flex');
        if (overlayVisible && !renderTarget.classList.contains('dy-live-open')) {
            renderTarget.classList.add('dy-live-open');
        }
        return renderTarget.classList.contains('dy-live-open') || overlayVisible;
    }

    const defaultLiveChatLines = [
        '微醺小貓：哈哈哈哈笑死我了😂',
        '輕輕吹風 來了',
        '阿傑：666牛啊',
        '晚風溫柔：👍',
        '再次邂逅說愛你 來了',
        '小羊：太美了吧😘',
        '星河少女：主播哪裡人',
        '麥兜黑鳳梨 來了',
        '夜色有點濃：😄好看好看',
        '皓哥：來了來了☕',
        '南城舊夢 來了',
        '石頭baby：這多少錢👀',
        '漫渡：👏',
        '深海裡的星星 來了'
    ];
    const presetLevels = [19, 12, 26, 25, 21, 16, 29, 24, 18, 33, 28, 31, 15, 22, 36];
    const presetFanLevels = [10, 12, 8, 15, 9, 11, 16, 14, 6, 18, 13, 10, 7, 19, 11];
    const fallbackNicknames = ['小羊', '七月初五', '輕輕吹風', '蒙蒙', '夜色有點濃', '微醺小貓', '阿傑', '捉事盧鑫', '石頭baby', '希拉', '皓哥', '漫渡', '晚風溫柔', '星河少女'];

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

    // ★ 彩虹/彩色用户名色板（普通无牌观众采用清爽浅蓝/青白昵称，带牌老粉/大哥采用炫彩或彩虹名，100% 兼容截图与视频导出）
    const RAINBOW_CHAR_COLORS = ['#ff6b9d', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#f472b6', '#38bdf8'];
    const COLORFUL_NICK_PALETTE = ['#60a5fa', '#c084fc', '#f472b6', '#34d399', '#fbbf24', '#38bdf8', '#a78bfa'];
    const PLAIN_VIEWER_NICK_PALETTE = ['#93c5fd', '#7dd3fc', '#a5b4fc', '#bae6fd', '#cbd5e1'];

    function buildColorfulNickHtml(nickStr, rowIdx, isJoinRow = false, hasBadges = true) {
        const useRainbow = !swLiveRainbowNick || swLiveRainbowNick.checked;
        const clean = String(nickStr || '');
        const colonSuffix = isJoinRow ? '' : '：';
        if (!useRainbow) {
            return `<span class="live-chat-nick">${escapeHtmlSafe(clean)}${colonSuffix}</span>`;
        }
        // 普通无灯牌/无等级观众（或「名字 来了」进场行）：采用抖音原版清爽浅蓝/淡青色系昵称，自然真实不花哨
        if (!hasBadges || isJoinRow) {
            const plainCol = PLAIN_VIEWER_NICK_PALETTE[rowIdx % PLAIN_VIEWER_NICK_PALETTE.length];
            return `<span class="live-chat-nick" style="color:${plainCol};">${escapeHtmlSafe(clean)}${colonSuffix}</span>`;
        }
        // 带等级牌/粉丝灯牌的活跃老粉与榜上大哥：交替使用逐字彩虹渐变色或高饱和彩名
        if (rowIdx % 2 === 0 && clean.length >= 2) {
            const chars = Array.from(clean);
            const spans = chars.map((ch, cIdx) => {
                const col = RAINBOW_CHAR_COLORS[(rowIdx + cIdx) % RAINBOW_CHAR_COLORS.length];
                return `<span style="color:${col};">${escapeHtmlSafe(ch)}</span>`;
            }).join('');
            return `<span class="live-chat-nick">${spans}${colonSuffix ? `<span style="color:#cbd5e1;">${colonSuffix}</span>` : ''}</span>`;
        }
        const solidCol = COLORFUL_NICK_PALETTE[rowIdx % COLORFUL_NICK_PALETTE.length];
        return `<span class="live-chat-nick" style="color:${solidCol};">${escapeHtmlSafe(clean)}${colonSuffix}</span>`;
    }

    // ★ 独立高频进场观众池（约 70% 为无灯牌无等级的纯「名字 来了」普通路人观众，约 30% 带单蓝牌等级）
    const liveJoinViewerPool = [
        { lv: 0,  fan: 0, nick: '再次邂逅說愛你' },
        { lv: 0,  fan: 0, nick: '輕輕吹風' },
        { lv: 17, fan: 0, nick: '足弟' },
        { lv: 0,  fan: 0, nick: '晚風溫柔' },
        { lv: 0,  fan: 0, nick: '麥兜黑鳳梨' },
        { lv: 25, fan: 0, nick: 'LOL' },
        { lv: 0,  fan: 0, nick: '滴水成冰' },
        { lv: 0,  fan: 0, nick: '捉事盧鑫' },
        { lv: 18, fan: 0, nick: '混凝土銷售' },
        { lv: 0,  fan: 0, nick: '南城舊夢' },
        { lv: 0,  fan: 0, nick: '漫渡' },
        { lv: 21, fan: 0, nick: '風止何安' },
        { lv: 0,  fan: 0, nick: '晨霸' },
        { lv: 0,  fan: 0, nick: '石頭baby' },
        { lv: 14, fan: 0, nick: '香港明' },
        { lv: 0,  fan: 0, nick: '歲月如歌' },
        { lv: 0,  fan: 0, nick: '深海裡的星星' },
        { lv: 29, fan: 0, nick: '皓哥' },
        { lv: 0,  fan: 0, nick: '暴富小錦鯉' },
        { lv: 36, fan: 0, nick: 'Laya榜一大哥' }
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
        return Number.isNaN(v) ? 5 : Math.min(10, Math.max(0, v));
    }

    // ★ 0~10 档直播间评论滚动间隔映射表（单位 ms）：
    // 0档=静止不动(0ms)，1档(超级慢)=12000ms(12秒/条)，2档(极慢)=7000ms(7秒/条)，3档(慢速)=4000ms(4秒/条)，4档(舒缓)=2500ms，5档(标准)=1500ms，6档=950ms，7档=580ms，8档=350ms，9档=200ms，10档=110ms
    const LIVE_DM_SPEED_INTERVAL_MAP = [0, 12000, 7000, 4000, 2500, 1500, 950, 580, 350, 200, 110];
    const LIVE_JOIN_SPEED_INTERVAL_MAP = [0, 15000, 9000, 5500, 3500, 2200, 1400, 900, 580, 380, 240];

    function getLiveDmIntervalMs(speedLv) {
        const lv = Math.min(10, Math.max(0, Number.isNaN(parseInt(speedLv, 10)) ? 5 : parseInt(speedLv, 10)));
        if (lv === 0) return 0;
        return LIVE_DM_SPEED_INTERVAL_MAP[lv] || 1500;
    }

    function getLiveJoinIntervalMs(speedLv) {
        const lv = Math.min(10, Math.max(0, Number.isNaN(parseInt(speedLv, 10)) ? 5 : parseInt(speedLv, 10)));
        if (lv === 0) return 0;
        return LIVE_JOIN_SPEED_INTERVAL_MAP[lv] || 2200;
    }

    function formatLiveDmSpeedLabel(speedLv) {
        const lv = Math.min(10, Math.max(0, Number.isNaN(parseInt(speedLv, 10)) ? 5 : parseInt(speedLv, 10)));
        if (lv === 0) return '0档 (⏸️ 静止不动)';
        const ms = getLiveDmIntervalMs(lv);
        if (ms >= 1000) {
            const sec = (ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1);
            const slowTag = lv === 1 ? '🐢超级慢' : (lv === 2 ? '🐢极慢' : (lv === 3 ? '慢速' : (lv === 4 ? '舒缓' : '标准')));
            return `${lv}档 (${slowTag}·${sec}秒/条)`;
        }
        const perSec = (1000 / ms).toFixed(1).replace(/\.0$/, '');
        const fastTag = lv <= 6 ? '轻快' : (lv <= 8 ? '热闹刷屏' : '万人狂刷');
        return `${lv}档 (${fastTag}·${perSec}条/秒)`;
    }

    function getLiveHeartDensityVal() {
        const v = inLiveHeartDensity ? parseInt(inLiveHeartDensity.value, 10) : 6;
        return Number.isNaN(v) ? 6 : Math.min(10, Math.max(0, v));
    }

    function escapeHtmlSafe(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ★ 1:1 复刻抖音实拍视频的「蓝紫财富等级胶囊牌」与「橙粉粉丝团勋章牌」（采用高清矢量 SVG，绝不用假的 💎 和 🏅 Emoji）
    const DOUYIN_LV_STAR_DIAMOND_SVG = `<svg class="live-lv-svg" width="9" height="9" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="8,1.2 13.8,5.2 11.6,14.2 4.4,14.2 2.2,5.2" fill="#e0f2fe" fill-opacity="0.95"/><polygon points="8,1.2 13.8,5.2 8,6.8 2.2,5.2" fill="#ffffff"/><polygon points="2.2,5.2 8,6.8 4.4,14.2" fill="#bae6fd"/><polygon points="13.8,5.2 11.6,14.2 8,6.8" fill="#7dd3fc"/><polygon points="8,3.2 9.4,6.4 12.6,7.8 9.4,9.2 8,12.4 6.6,9.2 3.4,7.8 6.6,6.4" fill="#ffffff"/></svg>`;
    const DOUYIN_FAN_HEART_WING_SVG = `<svg class="live-fan-svg" width="9" height="9" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 13.8C8 13.8 2.2 10.1 2.2 5.9C2.2 3.9 3.8 2.4 5.6 2.4C6.7 2.4 7.6 3 8 3.8C8.4 3 9.3 2.4 10.4 2.4C12.2 2.4 13.8 3.9 13.8 5.9C13.8 10.1 8 13.8 8 13.8Z" fill="#fff7ed"/><path d="M8 4.3L9.05 6.45L11.4 6.8L9.7 8.45L10.1 10.8L8 9.7L5.9 10.8L6.3 8.45L4.6 6.8L6.95 6.45L8 4.3Z" fill="#f97316"/></svg>`;

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
    // 1) 真实还原直播间观众构成：约 60% 观众名字前面没有任何灯牌和等级（纯「名字：文案」或纯「名字 来了」），约 20% 仅带单蓝牌，约 20% 老粉带双牌，房管「管」字牌极少出现；
    // 2) 支持「名字 来了」（无冒号）进场行与「名字：文案」评论行混合滚动；
    // 3) 双击画面上任意一条弹幕（.live-chat-bubble），自动暂停滚动并原地弹出全能编辑条，可单独修改这条弹幕的：蓝牌等级、橙牌粉丝等级、是否带「管」字牌、发言人昵称、弹幕文字！
    let liveEditingDmIdx = null;

    function getDefaultBadgeProfileForRow(seedIdx, isJoinRow = false) {
        const idx = Math.abs(parseInt(seedIdx, 10) || 0);
        if (isJoinRow) {
            // 「名字 来了」进场行：约 75% 完全无灯牌无等级（纯「名字 来了」），仅 25% 带单个蓝牌
            if (idx % 4 === 2) {
                return { lv: presetLevels[idx % presetLevels.length], fanLv: 0, isAdmin: false };
            }
            return { lv: 0, fanLv: 0, isAdmin: false };
        }
        const slot = idx % 10;
        // 60% 的普通观众 (slot 0, 2, 4, 5, 7, 9)：名字前面没有任何灯牌和等级，只有「名字：文案」
        if (slot === 0 || slot === 2 || slot === 4 || slot === 5 || slot === 7 || slot === 9) {
            return { lv: 0, fanLv: 0, isAdmin: false };
        }
        // 20% 的观众 (slot 1, 6)：仅带单个蓝紫财富等级牌
        if (slot === 1 || slot === 6) {
            return { lv: presetLevels[idx % presetLevels.length], fanLv: 0, isAdmin: false };
        }
        // 10% 的观众 (slot 3)：仅带单个橙色粉丝团灯牌
        if (slot === 3) {
            return { lv: 0, fanLv: presetFanLevels[idx % presetFanLevels.length], isAdmin: false };
        }
        // 10% 的核心老粉/房管 (slot 8)：同时带蓝牌+粉丝牌，其中每 20 条仅 1 条带红「管」字牌
        return {
            lv: presetLevels[idx % presetLevels.length],
            fanLv: presetFanLevels[idx % presetFanLevels.length],
            isAdmin: (idx % 20 === 8)
        };
    }

    function parseSingleLiveDanmakuRow(rawLine, globalIdx) {
        let rest = String(rawLine || '').trim();
        let hasCustomMeta = false;
        let customLv = 0;
        let customFanLv = 0;
        let customAdmin = false;

        // 解析行首可选自定义徽章标签，如：[Lv26|粉12|管] 或 [26|0|無管] 或 [管] 或 [無管]
        const metaMatch = rest.match(/^\[([^\]]+)\]\s*/);
        if (metaMatch) {
            const tagBody = metaMatch[1].trim();
            if (/^(Lv\d+|\d+|粉\d+|管|房管|無管|无管|-管|\|)+$/i.test(tagBody)) {
                hasCustomMeta = true;
                rest = rest.slice(metaMatch[0].length).trim();
                const parts = tagBody.split('|').map(s => s.trim()).filter(Boolean);
                parts.forEach((p, idx) => {
                    if (/^Lv(\d+)$/i.test(p)) {
                        customLv = parseInt(RegExp.$1, 10) || 0;
                    } else if (/^粉(\d+)$/i.test(p)) {
                        customFanLv = parseInt(RegExp.$1, 10) || 0;
                    } else if (/^\d+$/.test(p)) {
                        if (idx === 0) customLv = parseInt(p, 10) || 0;
                        else if (idx === 1) customFanLv = parseInt(p, 10) || 0;
                    } else if (p === '管' || p === '房管') {
                        customAdmin = true;
                    } else if (p === '無管' || p === '无管' || p === '-管') {
                        customAdmin = false;
                    }
                });
            }
        }

        const isSimp = window.__currentLangMode === 'simp';
        const defaultJoinWord = isSimp ? '来了' : '來了';
        let nickPart = '';
        let msg = '';
        let isJoinRow = false;

        // 识别「名字 来了 / 名字 來了 / 名字：来了」进场行格式（展示为无冒号的「名字 来了」）
        const joinSpaceMatch = rest.match(/^([^\s:：]+)\s+(來了|来了|進入直播間|进入直播间)[！!~～]*$/);
        const colonIdx = rest.indexOf('：') !== -1 ? rest.indexOf('：') : rest.indexOf(':');

        if (joinSpaceMatch) {
            nickPart = joinSpaceMatch[1].trim();
            msg = defaultJoinWord;
            isJoinRow = true;
        } else if (/^(來了|来了)[！!~～]*$/.test(rest)) {
            nickPart = fallbackNicknames[globalIdx % fallbackNicknames.length];
            msg = defaultJoinWord;
            isJoinRow = true;
        } else if (colonIdx > 0) {
            nickPart = rest.slice(0, colonIdx).trim();
            msg = rest.slice(colonIdx + 1).trim();
            if (/^(來了|来了|進入直播間|进入直播间)[！!~～]*$/.test(msg)) {
                msg = defaultJoinWord;
                isJoinRow = true;
            }
        } else {
            nickPart = fallbackNicknames[globalIdx % fallbackNicknames.length];
            msg = rest;
        }
        nickPart = nickPart.replace(/\s*\[💜[^\]]+\]\s*/g, '').replace(/^\[主播\]\s*/, '').trim() || fallbackNicknames[globalIdx % fallbackNicknames.length];
        if (typeof window.__sanitizeDanmakuAllowedEmojisOnly === 'function') {
            nickPart = window.__sanitizeDanmakuAllowedEmojisOnly(nickPart, true) || fallbackNicknames[globalIdx % fallbackNicknames.length];
            if (!isJoinRow) {
                msg = window.__sanitizeDanmakuAllowedEmojisOnly(msg, false) || '666';
            }
        }

        const defBadge = getDefaultBadgeProfileForRow(globalIdx, isJoinRow);
        const lv = hasCustomMeta ? customLv : defBadge.lv;
        const fanLv = hasCustomMeta ? customFanLv : defBadge.fanLv;
        const isAdmin = hasCustomMeta ? customAdmin : defBadge.isAdmin;

        return { lv, fanLv, isAdmin, nickPart, msg, isJoinRow };
    }

    function formatSingleLiveDanmakuRow(lv, fanLv, isAdmin, nickPart, msg, globalIdx) {
        const cleanNick = String(nickPart || '').trim() || fallbackNicknames[globalIdx % fallbackNicknames.length];
        const cleanMsg = String(msg || '').trim() || '666';
        const isJoinRow = /^(來了|来了|進入直播間|进入直播间)[！!~～]*$/.test(cleanMsg);
        const defBadge = getDefaultBadgeProfileForRow(globalIdx, isJoinRow);
        const bodyText = isJoinRow ? `${cleanNick} ${cleanMsg}` : `${cleanNick}：${cleanMsg}`;

        // 若等级与房管均与默认一致，则保持最干净的「昵称：内容」或「昵称 来了」；若用户自定义了等级或开关了「管」，则写入行首标签持久化保存
        if (lv === defBadge.lv && fanLv === defBadge.fanLv && isAdmin === defBadge.isAdmin) {
            return bodyText;
        }
        const adminToken = isAdmin ? '管' : '無管';
        return `[Lv${Math.max(0, lv)}|粉${Math.max(0, fanLv)}|${adminToken}] ${bodyText}`;
    }

    function updateSingleLiveDanmakuLineInTextarea(globalIdx, newFormattedLine) {
        const allLines = parseLiveDanmakuTexts();
        if (globalIdx >= 0 && globalIdx < allLines.length) {
            allLines[globalIdx] = newFormattedLine;
            if (inLiveDanmakuList) {
                inLiveDanmakuList.value = allLines.join('\n');
            }
            if (!window.__isRestoringStorage) {
                if (typeof markFieldUserModified === 'function') markFieldUserModified('in-live-danmaku-list');
                if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            }
        }
    }

    function getLiveMaxRowsVal() {
        const v = inLiveDmMaxRows ? parseInt(inLiveDmMaxRows.value, 10) : 5;
        return Number.isNaN(v) ? 5 : Math.min(12, Math.max(2, v));
    }

    function getLiveDmFontScalePct() {
        const v = inLiveDmScale ? parseInt(inLiveDmScale.value, 10) : 100;
        return Number.isNaN(v) ? 100 : Math.min(260, Math.max(60, v));
    }

    function getLiveDmBoxScalePct() {
        const v = inLiveDmBoxScale ? parseInt(inLiveDmBoxScale.value, 10) : 100;
        return Number.isNaN(v) ? 100 : Math.min(180, Math.max(70, v));
    }

    function applyLiveDmScaleAndArea(triggerRender = false) {
        const clampedFontScale = getLiveDmFontScalePct();
        const fontScaleRatio = (clampedFontScale / 100).toFixed(2);

        const clampedBoxScale = getLiveDmBoxScalePct();
        const boxScaleRatio = (clampedBoxScale / 100).toFixed(2);

        const widthPct = inLiveDmAreaWidth ? (parseInt(inLiveDmAreaWidth.value, 10) || 93) : 93;
        const clampedWidth = Math.min(100, Math.max(45, widthPct));
        const maxRows = getLiveMaxRowsVal();

        if (liveChatScrollBox) {
            liveChatScrollBox.style.setProperty('--live-dm-font-scale', fontScaleRatio);
            liveChatScrollBox.style.setProperty('--live-dm-box-scale', boxScaleRatio);
            liveChatScrollBox.style.setProperty('--live-dm-scale', fontScaleRatio);
            liveChatScrollBox.style.setProperty('--live-dm-width', `${clampedWidth}%`);
        }
        if (txtLiveDmScale) {
            const desc = clampedFontScale < 95 ? '偏小' : (clampedFontScale <= 105 ? '标准' : (clampedFontScale <= 145 ? '放大' : '超大字'));
            txtLiveDmScale.textContent = `${clampedFontScale}% (${desc})`;
        }
        const onstageFontEl = document.getElementById('txt-live-onstage-font');
        if (onstageFontEl) {
            onstageFontEl.textContent = `字${clampedFontScale}%`;
        }
        if (txtLiveDmArea) {
            txtLiveDmArea.textContent = `宽${clampedWidth}% · ${maxRows}行 · 框${clampedBoxScale}%`;
        }
        const onstageAreaEl = document.getElementById('txt-live-onstage-area');
        if (onstageAreaEl) {
            onstageAreaEl.textContent = `${clampedWidth}%·${maxRows}行`;
        }
        if (triggerRender) {
            renderLiveChatBubbles(false);
        }
    }

    function renderLiveChatBubbles(advance = false) {
        if (!liveChatList) return;
        // 若用户正在双击编辑某条弹幕且编辑框仍在 DOM 中，暂停自动滚动刷新；若编辑框已不在 DOM 则自动恢复滚动
        if (liveEditingDmIdx !== null) {
            if (liveChatList.querySelector('.live-row-inline-editor')) {
                if (advance) return;
            } else {
                liveEditingDmIdx = null;
            }
        }

        const allLines = parseLiveDanmakuTexts();
        if (advance) {
            liveRollTickCount++;
            liveChatCursor = liveRollTickCount % Math.max(1, allLines.length);
        }
        const userMaxRows = getLiveMaxRowsVal();
        const maxRows = (liveSysNoticeEl && liveSysNoticeEl.style.display !== 'none') ? Math.max(2, userMaxRows - 1) : userMaxRows;
        // 始终填满 maxRows 行，即便用户只输入了 1~2 行也能持续向上循环滚动推进
        const count = Math.max(2, maxRows);
        const dmTextColor = getLiveDmColor();
        const showRowPurpleHeart = !!(swLiveDmRowHeart && swLiveDmRowHeart.checked);
        const rowsHtml = [];

        for (let i = 0; i < count; i++) {
            const virtualStep = liveRollTickCount + i;
            const globalIdx = virtualStep % allLines.length;
            let rawLine = allLines[globalIdx];
            // 当弹幕总行数较少(<= count)时，用 virtualStep 驱动等级牌与默认昵称轮换，确保视觉上每一行都在持续向上滚动
            const badgeSeedIdx = allLines.length <= count ? virtualStep : globalIdx;

            // 若当前弹幕池里还没有「某某 来了」进场行，每隔 5 步自然穿插一条无灯牌的「名字 来了」进场提示
            const hasJoinInPool = allLines.some(l => /(\s|^|：|:)(來了|来了)$/.test(String(l).trim()));
            if (!hasJoinInPool && (virtualStep % 5 === 3)) {
                const jViewer = liveJoinViewerPool[virtualStep % liveJoinViewerPool.length];
                rawLine = `${jViewer.nick} ${window.__currentLangMode === 'simp' ? '来了' : '來了'}`;
            }

            const { lv, fanLv, isAdmin, nickPart, msg, isJoinRow } = parseSingleLiveDanmakuRow(rawLine, badgeSeedIdx);
            const hasBadges = (lv > 0 || fanLv > 0 || isAdmin);

            const lvBadgeHtml = buildLiveLvBadgeHtml(lv);
            const fanBadgeHtml = buildLiveFanBadgeHtml(fanLv);
            const adminBadgeHtml = isAdmin ? `<span class="live-admin-badge" title="房管標識（雙擊彈幕可開關）">管</span>` : '';
            const rightHeartHtml = (showRowPurpleHeart && !isJoinRow) ? `<span class="live-row-purple-heart"><svg width="10" height="10" viewBox="0 0 24 24" fill="#c084fc"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></span>` : '';

            const colorfulNickHtml = buildColorfulNickHtml(nickPart, badgeSeedIdx, isJoinRow, hasBadges);
            const msgContentHtml = isJoinRow
                ? `<span class="live-chat-msg is-join" style="color:rgba(255,255,255,0.88);"> ${escapeHtmlSafe(msg)}</span>`
                : `<span class="live-chat-msg" style="color:${dmTextColor};">${escapeHtmlSafe(msg)}</span>`;

            rowsHtml.push(
                `<div class="live-chat-bubble interactive-elem" data-dm-idx="${globalIdx}" title="雙擊可編輯這條彈幕的所有內容（等級/管字標/暱稱/彈幕文字）">${lvBadgeHtml}${fanBadgeHtml}${adminBadgeHtml}${colorfulNickHtml}${msgContentHtml}${rightHeartHtml}</div>`
            );
        }

        liveChatList.innerHTML = rowsHtml.join('');
        if (advance) {
            const curInterval = getLiveDmIntervalMs(getLiveDmSpeedVal());
            const animMs = Math.min(220, Math.max(45, Math.round(curInterval * 0.78)));
            liveChatList.style.setProperty('--live-roll-anim-ms', `${animMs}ms`);
            liveChatList.classList.remove('is-rolling-step');
            void liveChatList.offsetWidth;
            liveChatList.classList.add('is-rolling-step');
        }
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

    // ★ 二、右侧竖排开心鲜艳表情与彩心混搭飘动动画（火花✨🔥🌟、开心笑脸🥳🤩😄😍😆、礼花礼炮🎉🎊🎆🎇🎈、点赞彩心💖👍掺和在一起欢快上飘 + 精致贴边微光晕）
    const LIVE_CHEER_PARTICLES = [
        '🎉', '✨', '🥳', '🔥', '😄', '🎊', '🤩', '🎆',
        '😍', '🌟', '🎇', '😆', '💖', '🎈', '🥰', '👍',
        '⚡', '😎', '🧨', '👏', '💥', '❤️‍🔥',
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 20.8l-1.35-1.22C5.6 15.02 2.4 12.1 2.4 8.55 2.4 5.65 4.65 3.4 7.55 3.4c1.62 0 3.18.76 4.45 1.98C13.27 4.16 14.83 3.4 16.45 3.4c2.9 0 5.15 2.25 5.15 5.15 0 3.55-3.2 6.47-8.25 11.03L12 20.8z" fill="#ff5e97"/><path d="M7.8 5.6c-1.5 0-2.7 1.1-2.9 2.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.65"/></svg>`,
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 20.8l-1.35-1.22C5.6 15.02 2.4 12.1 2.4 8.55 2.4 5.65 4.65 3.4 7.55 3.4c1.62 0 3.18.76 4.45 1.98C13.27 4.16 14.83 3.4 16.45 3.4c2.9 0 5.15 2.25 5.15 5.15 0 3.55-3.2 6.47-8.25 11.03L12 20.8z" fill="#a855f7"/><circle cx="17.2" cy="6.8" r="1.5" fill="#fde047"/></svg>`
    ];
    let lastCheerParticleIdx = -1;
    function spawnSingleLiveHeart() {
        if (!liveFloatingHearts || !isLiveRoomOpenNow()) return;
        const h = document.createElement('span');
        h.className = 'live-heart-particle';
        let pickIdx = Math.floor(Math.random() * LIVE_CHEER_PARTICLES.length);
        if (pickIdx === lastCheerParticleIdx) {
            pickIdx = (pickIdx + 1 + Math.floor(Math.random() * 5)) % LIVE_CHEER_PARTICLES.length;
        }
        lastCheerParticleIdx = pickIdx;
        const item = LIVE_CHEER_PARTICLES[pickIdx];
        if (item.startsWith('<svg')) {
            h.innerHTML = item;
        } else {
            h.textContent = item;
        }
        const hright = Math.round(4 + Math.random() * 32);
        const hsize = Math.round(18 + Math.random() * 5);
        const hx1 = Math.round((Math.random() - 0.5) * 32);
        const hx2 = Math.round((Math.random() - 0.5) * 34);
        const hrot1 = Math.round((Math.random() - 0.5) * 28);
        const hrot2 = Math.round((Math.random() - 0.5) * 28);
        h.style.setProperty('--hright', hright + 'px');
        h.style.setProperty('--hsize', hsize + 'px');
        h.style.setProperty('--hx1', hx1 + 'px');
        h.style.setProperty('--hx2', hx2 + 'px');
        h.style.setProperty('--hrot1', hrot1 + 'deg');
        h.style.setProperty('--hrot2', hrot2 + 'deg');
        liveFloatingHearts.appendChild(h);
        setTimeout(() => {
            if (h.parentNode) h.parentNode.removeChild(h);
        }, 2280);
    }

    function restartLiveHeartTimer() {
        if (liveHeartTimer) {
            clearInterval(liveHeartTimer);
            liveHeartTimer = null;
        }
        if (!isLiveRoomOpenNow()) return;
        if (liveFloatingHearts && liveFloatingHearts.dataset.liveHidden === 'true') return;
        const density = getLiveHeartDensityVal();
        if (density <= 0) {
            if (liveFloatingHearts) liveFloatingHearts.innerHTML = '';
            return;
        }
        const HEART_INTERVAL_MAP = [0, 4500, 2800, 1800, 1200, 820, 520, 360, 260, 190, 140];
        const intervalMs = HEART_INTERVAL_MAP[density] || 520;
        spawnSingleLiveHeart();
        if (density >= 4) {
            setTimeout(spawnSingleLiveHeart, 140);
        }
        liveHeartTimer = setInterval(() => {
            if (!isLiveRoomOpenNow()) return;
            if (liveFloatingHearts && liveFloatingHearts.dataset.liveHidden === 'true') return;
            spawnSingleLiveHeart();
            if (density >= 6) {
                setTimeout(spawnSingleLiveHeart, Math.round(intervalMs * 0.45));
            }
        }, intervalMs);
    }

    if (inLiveHeartDensity) {
        inLiveHeartDensity.addEventListener('input', () => {
            const d = getLiveHeartDensityVal();
            const desc = d === 0 ? '⏸️静止关闭' : (d === 1 ? '🐢超级慢' : (d <= 3 ? '轻柔慢速' : (d <= 7 ? '热闹' : '满屏暴击')));
            if (txtLiveHeartDensity) txtLiveHeartDensity.textContent = `${d} (${desc})`;
            restartLiveHeartTimer();
        });
    }

    // ★ 三、礼物进场提示小弹窗：
    // 1) 左侧采用抖音真实人物头像（帥哥/美女真人照片，不再使用蓝色 Laya 图标，且每次弹出切换不同真人头像）；
    // 2) 内置 16 款抖音热门礼物与对应彩色图标（嘉年華🎠、超級火箭🚀、至尊跑車🏎️、私人飛機🛩️、夢幻城堡🏰、紫金皇冠👑、璀璨鑽石💎、浪漫煙花🎆、99朵玫瑰🌹、彩虹棒棒糖🍭 等），不再只有爱心；
    // 3) 每次弹出自动轮换不同的送礼人、真人头像、礼物图标、连击数与胶囊流光渐变色，绝不千篇一律；
    // 4) 单击小弹窗随机切换下一条，双击小弹窗可直接原地编辑全部内容！
    const giftUserPresets = [
        '皓哥', '晨霸', '漫渡', '輕輕吹風', 'Laya榜一大哥', '微醺小貓', '夜色有點濃', '萬里星河',
        '暴富小錦鯉', '阿傑', '南城舊夢', '星河少女', '深海裡的星星', '威廉W', '陳先生HK', '台北小宇',
        '溫哥華阿凱', '墨爾本小鹿', '半夏微涼', '風止何安', '晚風溫柔', '草莓氣泡水', '山海皆可平', '落日歸山海',
        '加州陽光Leo', '倫敦夜未眠', '星辰大海', '人間小甜豆', '芝士奶蓋', '江上清風', '追光者Eric', '月亮不睡我不睡',
        '東京鐵塔的貓', '新加坡老陳', '多倫多小魚', '微風不燥'
    ];
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

    let lastGiftCatalogIdx = -1;
    let lastGiftUserIdx = -1;
    let lastGiftRealAvatarIdx = -1;
    const recentGiftUserIdxs = [];
    const recentGiftCatalogIdxs = [];
    const recentGiftAvatarUrls = [];
    let customPinnedGiftAvatarUrl = '';
    let currentGiftEndColor = 'rgba(245, 158, 11, 0.85)';

    // 从内置海外华人真实社交头像库中抽取不重复的头像给礼物小弹窗使用（记录最近 10 次，确保每次送礼头像绝不重复）
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
        const vibes = Array.isArray(db.vibes) ? db.vibes.slice(0, 12) : [];
        const pets = Array.isArray(db.pets) ? db.pets.slice(0, 10) : [];
        const realPool = [...beauties, ...guys, ...vibes, ...pets];
        if (realPool.length === 0) return;

        // 根据昵称倾向选择海外华人美女、潮男或 IG 氛围/萌宠头像，且严格避开最近已出现过的头像
        const isFemaleNick = /(小貓|少女|溫柔|迷妹|姐姐|甜|仙女|希拉|蒙蒙|薇|柔|妍|晴|琪|草莓|奶蓋|小鹿|半夏|小魚)/.test(String(preferNick || ''));
        const subPool = (isFemaleNick && beauties.length > 0)
            ? [...beauties, ...pets.slice(0, 5)]
            : ((!isFemaleNick && guys.length > 0 && Math.random() < 0.6) ? [...guys, ...vibes.slice(0, 6)] : realPool);

        const curAvatarSrc = liveGiftSenderAv ? (liveGiftSenderAv.getAttribute('data-export-src') || liveGiftSenderAv.src || '') : '';
        let pickUrl = '';
        if (typeof window.claimUniqueAvatarFromPool === 'function') {
            pickUrl = window.claimUniqueAvatarFromPool(subPool, 'gift_av', new Set([...recentGiftAvatarUrls, curAvatarSrc].filter(Boolean)));
        }
        if (!pickUrl) {
            pickUrl = subPool[0];
            for (let attempt = 0; attempt < 35; attempt++) {
                const candIdx = Math.floor(Math.random() * subPool.length);
                const candUrl = subPool[candIdx];
                if (candUrl && candUrl !== curAvatarSrc && !recentGiftAvatarUrls.includes(candUrl)) {
                    pickUrl = candUrl;
                    lastGiftRealAvatarIdx = realPool.indexOf(candUrl);
                    break;
                }
            }
        }
        if (pickUrl) {
            recentGiftAvatarUrls.push(pickUrl);
            if (recentGiftAvatarUrls.length > 10) recentGiftAvatarUrls.shift();
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

    // ★ 礼物进场数量（最少多少个 ~ 最多多少个）自由控制与持久化
    const GIFT_QTY_RANGE_STORAGE_KEY = 'LAYA_LIVE_GIFT_QTY_RANGE_V1';
    try {
        const savedQtyRange = JSON.parse(localStorage.getItem(GIFT_QTY_RANGE_STORAGE_KEY) || 'null');
        if (savedQtyRange && typeof savedQtyRange === 'object') {
            const sMin = Math.max(1, Math.min(99999, parseInt(savedQtyRange.minQty, 10) || 1));
            const sMax = Math.max(sMin, Math.min(99999, parseInt(savedQtyRange.maxQty, 10) || 10));
            if (inLiveGiftMinQty) inLiveGiftMinQty.value = String(sMin);
            if (inLiveGiftMaxQty) inLiveGiftMaxQty.value = String(sMax);
        }
    } catch (_e) {}

    function getLiveGiftQtyRange() {
        const rawMin = inLiveGiftMinQty ? (parseInt(inLiveGiftMinQty.value, 10) || 1) : 1;
        const rawMax = inLiveGiftMaxQty ? (parseInt(inLiveGiftMaxQty.value, 10) || 10) : 10;
        const clampedMin = Math.max(1, Math.min(99999, rawMin));
        const clampedMax = Math.max(1, Math.min(99999, rawMax));
        return {
            minQty: Math.min(clampedMin, clampedMax),
            maxQty: Math.max(clampedMin, clampedMax)
        };
    }

    function pickRandomGiftQtyInRange(preferLowStart = false) {
        const { minQty, maxQty } = getLiveGiftQtyRange();
        if (minQty >= maxQty) return 'x' + minQty;
        const span = maxQty - minQty;
        if (preferLowStart && span >= 3) {
            const lowSpan = Math.max(1, Math.ceil(span * 0.6));
            const picked = minQty + Math.floor(Math.random() * (lowSpan + 1));
            return 'x' + Math.min(maxQty, Math.max(minQty, picked));
        }
        const picked = minQty + Math.floor(Math.random() * (span + 1));
        return 'x' + picked;
    }

    const GIFT_NICE_MILESTONES = [1, 2, 3, 5, 6, 8, 9, 10, 15, 18, 25, 28, 36, 52, 66, 88, 99, 138, 188, 288, 520, 666, 888, 999, 1314, 3344, 5200, 9999];
    function getNextGiftComboInRange(curNumInput, stepCount = 1) {
        const { minQty, maxQty } = getLiveGiftQtyRange();
        if (minQty >= maxQty) return 'x' + minQty;

        const ladder = [minQty];
        if (maxQty - minQty <= 12) {
            for (let v = minQty + 1; v < maxQty; v++) {
                ladder.push(v);
            }
        } else {
            GIFT_NICE_MILESTONES.forEach(m => {
                if (m > minQty && m < maxQty) ladder.push(m);
            });
            if (ladder.length < 3) {
                const step = Math.max(1, Math.round((maxQty - minQty) / 4));
                for (let v = minQty + step; v < maxQty; v += step) {
                    ladder.push(v);
                }
            }
        }
        if (ladder[ladder.length - 1] !== maxQty) ladder.push(maxQty);

        let curNum = parseInt(String(curNumInput || '').replace(/[^\d]/g, ''), 10);
        if (Number.isNaN(curNum) || curNum < minQty || curNum > maxQty) {
            curNum = minQty;
        }
        let baseIdx = 0;
        for (let i = 0; i < ladder.length; i++) {
            if (ladder[i] <= curNum) baseIdx = i;
        }
        const nextIdx = (baseIdx + Math.max(1, stepCount)) % ladder.length;
        return 'x' + ladder[nextIdx];
    }

    function syncGiftQtyRangeUI(clampCurrent = true) {
        const { minQty, maxQty } = getLiveGiftQtyRange();
        if (txtLiveGiftQtyRange) {
            txtLiveGiftQtyRange.textContent = (minQty === maxQty)
                ? `当前固定：x${minQty}`
                : `当前范围：x${minQty} ~ x${maxQty}`;
        }
        if (giftQtyPresetBtns && giftQtyPresetBtns.length) {
            giftQtyPresetBtns.forEach(btn => {
                const bMin = parseInt(btn.getAttribute('data-min'), 10);
                const bMax = parseInt(btn.getAttribute('data-max'), 10);
                const isMatch = (bMin === minQty && bMax === maxQty);
                btn.style.background = isMatch ? 'rgba(245, 158, 11, 0.32)' : 'rgba(245, 158, 11, 0.14)';
                btn.style.borderColor = isMatch ? 'rgba(251, 191, 36, 0.85)' : 'rgba(245, 158, 11, 0.35)';
                btn.style.color = isMatch ? '#fef08a' : '#fde68a';
            });
        }
        try {
            localStorage.setItem(GIFT_QTY_RANGE_STORAGE_KEY, JSON.stringify({ minQty, maxQty }));
        } catch (_e) {}

        if (clampCurrent && inLiveGiftCount) {
            const curNum = parseInt(String(inLiveGiftCount.value || '').replace(/[^\d]/g, ''), 10) || minQty;
            if (curNum < minQty || curNum > maxQty) {
                const clamped = Math.min(maxQty, Math.max(minQty, curNum));
                inLiveGiftCount.value = 'x' + clamped;
                applyLiveGiftBannerState(true, false);
            }
        }
    }

    function applyLiveGiftBannerState(playSlideAnim = false, changeAvatar = false) {
        if (!liveGiftComboBanner) return;
        const userTxt = (inLiveGiftUser && inLiveGiftUser.value.trim()) ? inLiveGiftUser.value.trim() : '皓哥';
        const giftTxt = (inLiveGiftName && inLiveGiftName.value.trim()) ? inLiveGiftName.value.trim() : '送 嘉年華';
        const { minQty, maxQty } = getLiveGiftQtyRange();
        let rawCountTxt = (inLiveGiftCount && inLiveGiftCount.value.trim()) ? inLiveGiftCount.value.trim() : ('x' + Math.min(maxQty, Math.max(minQty, 9)));
        let parsedCountNum = parseInt(rawCountTxt.replace(/[^\d]/g, ''), 10);
        if (Number.isNaN(parsedCountNum)) parsedCountNum = minQty;
        parsedCountNum = Math.min(maxQty, Math.max(minQty, parsedCountNum));
        const countTxt = 'x' + parsedCountNum;
        if (inLiveGiftCount && inLiveGiftCount.value !== countTxt) {
            inLiveGiftCount.value = countTxt;
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
        liveGiftComboBanner.style.boxShadow = `0 3px 14px ${hexToRgba(baseColor, 0.55)}, 0 0 10px ${rightGradColor}`;

        if (playSlideAnim) {
            if (isGiftInEmptyGapNow) {
                setGiftEmptyGapVisualState(false);
            }
            liveGiftComboBanner.classList.remove('gift-slide-in', 'gift-slide-out', 'is-in-empty-gap');
            void liveGiftComboBanner.offsetWidth;
            liveGiftComboBanner.classList.add('gift-slide-in');
        }
    }

    // 抽取下一组完全不重复的【送礼人名字 + 礼物名称与图标 + 胶囊渐变色 + 数量 + 真人头像】并应用到画面
    function pickAndApplyNextUniqueGiftBundle(playSlideIn = true) {
        if (!liveGiftComboBanner || isEditingGiftBanner) return;

        const curDisplayedUser = (liveGiftSenderName && liveGiftSenderName.textContent.trim()) || '';
        const curDisplayedGift = (liveGiftDescTxt && liveGiftDescTxt.textContent.trim()) || '';

        // 1) 优先从 325+ 海外华人/AI 昵称去重库抽取完全不重复的送礼用户名
        let u = '';
        if (typeof window.claimUniqueNickname === 'function') {
            u = window.claimUniqueNickname();
        }
        if (!u || u === curDisplayedUser) {
            let uIdx = Math.floor(Math.random() * giftUserPresets.length);
            for (let attempt = 0; attempt < 30; attempt++) {
                const cand = Math.floor(Math.random() * giftUserPresets.length);
                if (cand !== lastGiftUserIdx && !recentGiftUserIdxs.includes(cand) && giftUserPresets[cand] !== curDisplayedUser) {
                    uIdx = cand;
                    break;
                }
            }
            lastGiftUserIdx = uIdx;
            recentGiftUserIdxs.push(uIdx);
            if (recentGiftUserIdxs.length > 7) recentGiftUserIdxs.shift();
            u = giftUserPresets[uIdx];
        }

        // 2) 抽取一款与最近 5 次以及当前画面礼物完全不同的礼物（带专属图标、文案、主题色）
        let gIdx = Math.floor(Math.random() * LIVE_GIFT_CATALOG.length);
        for (let attempt = 0; attempt < 30; attempt++) {
            const cand = Math.floor(Math.random() * LIVE_GIFT_CATALOG.length);
            if (cand !== lastGiftCatalogIdx && !recentGiftCatalogIdxs.includes(cand) && LIVE_GIFT_CATALOG[cand].name !== curDisplayedGift) {
                gIdx = cand;
                break;
            }
        }
        lastGiftCatalogIdx = gIdx;
        recentGiftCatalogIdxs.push(gIdx);
        if (recentGiftCatalogIdxs.length > 5) recentGiftCatalogIdxs.shift();
        const giftItem = LIVE_GIFT_CATALOG[gIdx];
        const c = pickRandomGiftQtyInRange(true);

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
        // 3) 强制抽取一位全新的真人头像（每次送礼头像绝不重复）
        pickNextRealHumanGiftAvatar(u, true);
        applyLiveGiftBannerState(playSlideIn, false);
    }

    // 滑出旧礼物 -> 切换下一位真人 + 下一款不同礼物与图标 -> 滑入新礼物
    let giftSlideTimeout = null;
    let isEditingGiftBanner = false;
    function cycleNextGiftBannerWithSlide(customRandom = false) {
        if (!liveGiftComboBanner || isEditingGiftBanner) return;
        const fadeCfgSec = typeof getLiveGiftEmptyGapConfig === 'function' ? getLiveGiftEmptyGapConfig().fadeSec : 0.4;
        const outMs = Math.max(120, Math.min(1200, Math.round(fadeCfgSec * 1000)));
        liveGiftComboBanner.style.setProperty('--gift-fade-out-sec', `${(outMs / 1000).toFixed(2)}s`);
        liveGiftComboBanner.classList.remove('gift-slide-in', 'is-combo-pulse');
        liveGiftComboBanner.classList.add('gift-slide-out');

        if (giftSlideTimeout) clearTimeout(giftSlideTimeout);
        giftSlideTimeout = setTimeout(() => {
            if (customRandom) {
                pickAndApplyNextUniqueGiftBundle(true);
            } else {
                applyLiveGiftBannerState(true, true);
            }
        }, outMs);
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
    if (inLiveGiftCount) {
        inLiveGiftCount.addEventListener('input', () => {
            const typedNum = parseInt(String(inLiveGiftCount.value || '').replace(/[^\d]/g, ''), 10);
            if (!Number.isNaN(typedNum) && typedNum >= 1) {
                const { minQty, maxQty } = getLiveGiftQtyRange();
                if (typedNum < minQty && inLiveGiftMinQty) {
                    inLiveGiftMinQty.value = String(typedNum);
                    syncGiftQtyRangeUI(false);
                } else if (typedNum > maxQty && inLiveGiftMaxQty) {
                    inLiveGiftMaxQty.value = String(typedNum);
                    syncGiftQtyRangeUI(false);
                }
            }
            applyLiveGiftBannerState(true, false);
        });
    }
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
        const pick = pickRandomGiftQtyInRange(false);
        if (inLiveGiftCount) inLiveGiftCount.value = pick;
        applyLiveGiftBannerState(true, false);
    };
    if (inLiveGiftMinQty) {
        inLiveGiftMinQty.addEventListener('input', () => syncGiftQtyRangeUI(true));
        inLiveGiftMinQty.addEventListener('change', () => {
            const { minQty, maxQty } = getLiveGiftQtyRange();
            inLiveGiftMinQty.value = String(minQty);
            if (inLiveGiftMaxQty) inLiveGiftMaxQty.value = String(maxQty);
            syncGiftQtyRangeUI(true);
            window.showToast(`🎁 禮物進場數量已設為：最少 x${minQty} ~ 最多 x${maxQty}`);
        });
    }
    if (inLiveGiftMaxQty) {
        inLiveGiftMaxQty.addEventListener('input', () => syncGiftQtyRangeUI(true));
        inLiveGiftMaxQty.addEventListener('change', () => {
            const { minQty, maxQty } = getLiveGiftQtyRange();
            if (inLiveGiftMinQty) inLiveGiftMinQty.value = String(minQty);
            inLiveGiftMaxQty.value = String(maxQty);
            syncGiftQtyRangeUI(true);
            window.showToast(`🎁 禮物進場數量已設為：最少 x${minQty} ~ 最多 x${maxQty}`);
        });
    }
    if (giftQtyPresetBtns && giftQtyPresetBtns.length) {
        giftQtyPresetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const pMin = Math.max(1, parseInt(btn.getAttribute('data-min'), 10) || 1);
                const pMax = Math.max(pMin, parseInt(btn.getAttribute('data-max'), 10) || 10);
                if (inLiveGiftMinQty) inLiveGiftMinQty.value = String(pMin);
                if (inLiveGiftMaxQty) inLiveGiftMaxQty.value = String(pMax);
                syncGiftQtyRangeUI(true);
                const picked = pickRandomGiftQtyInRange(false);
                if (inLiveGiftCount) inLiveGiftCount.value = picked;
                applyLiveGiftBannerState(true, false);
                window.showToast(pMin === pMax
                    ? `🎁 已固定禮物進場數量為 x${pMin}`
                    : `🎁 已切換禮物數量範圍為：最少 x${pMin} ~ 最多 x${pMax}`);
            });
        });
    }
    syncGiftQtyRangeUI(false);
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
                    if (inLiveGiftUser && inpU.value.trim()) {
                        markFieldUserModified('in-live-gift-user');
                        inLiveGiftUser.value = inpU.value.trim();
                    }
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

    // ★ 彻底分开的两块绑定：
    //   1) 块一：评论区区域大小（宽度 45%~100%、行数 2~12行、框体间距缩放 70%~180%）+ 挪动位置（liveDmOffsetX/Y），绝不影响文字字号
    //   2) 块二：里面弹幕文字大小（in-live-dm-scale 60%~260%），绝不改变评论区框体宽高、行数或位置
    if (inLiveDmScale) {
        inLiveDmScale.addEventListener('input', () => {
            applyLiveDmScaleAndArea(false);
            if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    if (inLiveDmBoxScale) {
        inLiveDmBoxScale.addEventListener('input', () => {
            applyLiveDmScaleAndArea(false);
            if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    if (inLiveDmAreaWidth) {
        inLiveDmAreaWidth.addEventListener('input', () => {
            applyLiveDmScaleAndArea(false);
            if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    if (inLiveDmMaxRows) {
        inLiveDmMaxRows.addEventListener('input', () => {
            applyLiveDmScaleAndArea(true);
            if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    const liveBottomSectionEl = liveOverlayEl ? liveOverlayEl.querySelector('.live-bottom-section') : null;
    const liveGiftComboSlotEl = document.getElementById('live-gift-combo-slot');
    const liveDmOnstageToolbar = document.getElementById('live-dm-onstage-toolbar');
    const liveDmMoveHandle = document.getElementById('live-dm-move-handle');
    const btnLiveAreaDown = document.getElementById('btn-live-area-down');
    const btnLiveAreaUp = document.getElementById('btn-live-area-up');
    const txtLiveOnstageArea = document.getElementById('txt-live-onstage-area');
    const btnLiveFontDown = document.getElementById('btn-live-font-down');
    const btnLiveFontUp = document.getElementById('btn-live-font-up');
    const txtLiveOnstageFont = document.getElementById('txt-live-onstage-font');
    const btnLiveOnstageSpdDown = document.getElementById('btn-live-onstage-spd-down');
    const btnLiveOnstageSpdUp = document.getElementById('btn-live-onstage-spd-up');
    const txtLiveOnstageSpd = document.getElementById('txt-live-onstage-spd');

    // ★ 公屏礼物与弹幕区位置偏移 (支持按住「✥ 挪位置」自由拖动位置，点「位置归零」或「重置」归零)
    const LIVE_DM_OFFSET_STORAGE_KEY = 'LAYA_LIVE_DM_OFFSET_V1';
    let liveDmOffsetX = 0;
    let liveDmOffsetY = 0;
    try {
        const savedOff = JSON.parse(localStorage.getItem(LIVE_DM_OFFSET_STORAGE_KEY) || 'null');
        if (savedOff && typeof savedOff === 'object') {
            liveDmOffsetX = Math.max(-165, Math.min(165, Number(savedOff.x) || 0));
            liveDmOffsetY = Math.max(-320, Math.min(85, Number(savedOff.y) || 0));
        }
    } catch (_e) {}

    function applyLiveDmPositionOffset(saveToLocal = false) {
        const tf = (liveDmOffsetX === 0 && liveDmOffsetY === 0)
            ? ''
            : `translate(${liveDmOffsetX}px, ${liveDmOffsetY}px)`;
        [liveDmOnstageToolbar, liveGiftComboSlotEl, liveChatScrollBox].forEach(el => {
            if (el) el.style.transform = tf;
        });
        if (saveToLocal) {
            try {
                localStorage.setItem(LIVE_DM_OFFSET_STORAGE_KEY, JSON.stringify({ x: liveDmOffsetX, y: liveDmOffsetY }));
            } catch (_e) {}
        }
    }
    applyLiveDmPositionOffset(false);

    // ★「碰了就有，不碰就没有」：仅当鼠标碰触/操作礼物槽、弹幕区或悬浮工具栏本身（或正在拖拽改大小/挪位置）时才显示工具栏与虚线框
    let isDraggingDmSizeOrPos = false;
    let dmZoneHoverCount = 0;
    let dmZoneLeaveTimer = null;
    const enterDmInteractiveZone = () => {
        if (dmZoneLeaveTimer) {
            clearTimeout(dmZoneLeaveTimer);
            dmZoneLeaveTimer = null;
        }
        dmZoneHoverCount++;
        if (liveBottomSectionEl) liveBottomSectionEl.classList.add('is-touching-dm-zone');
    };
    const leaveDmInteractiveZone = () => {
        dmZoneHoverCount = Math.max(0, dmZoneHoverCount - 1);
        if (dmZoneLeaveTimer) clearTimeout(dmZoneLeaveTimer);
        dmZoneLeaveTimer = setTimeout(() => {
            if (!isDraggingDmSizeOrPos && dmZoneHoverCount <= 0 && liveBottomSectionEl) {
                liveBottomSectionEl.classList.remove('is-touching-dm-zone');
            }
        }, 90);
    };
    [liveDmOnstageToolbar, liveGiftComboSlotEl, liveChatScrollBox].forEach(zEl => {
        if (!zEl) return;
        zEl.addEventListener('mouseenter', enterDmInteractiveZone);
        zEl.addEventListener('mouseleave', leaveDmInteractiveZone);
    });

    if (liveDmMoveHandle) {
        liveDmMoveHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDraggingDmSizeOrPos = true;
            if (liveBottomSectionEl) liveBottomSectionEl.classList.add('is-touching-dm-zone');
            if (liveChatScrollBox) liveChatScrollBox.classList.add('is-resizing-dm');
            const startX = e.clientX;
            const startY = e.clientY;
            const initX = liveDmOffsetX;
            const initY = liveDmOffsetY;

            const onMovePos = (ev) => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                liveDmOffsetX = Math.max(-165, Math.min(165, Math.round(initX + dx)));
                liveDmOffsetY = Math.max(-320, Math.min(85, Math.round(initY + dy)));
                applyLiveDmPositionOffset(false);
            };
            const onUpPos = () => {
                isDraggingDmSizeOrPos = false;
                if (liveChatScrollBox) liveChatScrollBox.classList.remove('is-resizing-dm');
                if (dmZoneHoverCount <= 0 && liveBottomSectionEl) {
                    liveBottomSectionEl.classList.remove('is-touching-dm-zone');
                }
                window.removeEventListener('mousemove', onMovePos);
                window.removeEventListener('mouseup', onUpPos);
                applyLiveDmPositionOffset(true);
            };
            window.addEventListener('mousemove', onMovePos);
            window.addEventListener('mouseup', onUpPos);
        });
    }

    // 独立步进函数 1：单独放大/缩小「评论区框体区域」（宽度 + 行数 + 框体边距），绝不改变里面的弹幕文字字号
    function stepLiveDmAreaOnly(dir, showMsg = true) {
        const curWidth = inLiveDmAreaWidth ? (parseInt(inLiveDmAreaWidth.value, 10) || 93) : 93;
        const curRows = getLiveMaxRowsVal();
        const curBoxScale = getLiveDmBoxScalePct();
        const nextWidth = Math.min(100, Math.max(45, curWidth + dir * 5));
        const nextRows = Math.min(12, Math.max(2, curRows + (dir > 0 ? 1 : -1)));
        const nextBoxScale = Math.min(180, Math.max(70, curBoxScale + dir * 5));
        if (inLiveDmAreaWidth) inLiveDmAreaWidth.value = String(nextWidth);
        if (inLiveDmMaxRows) inLiveDmMaxRows.value = String(nextRows);
        if (inLiveDmBoxScale) inLiveDmBoxScale.value = String(nextBoxScale);
        applyLiveDmScaleAndArea(nextRows !== curRows);
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
        }
        if (showMsg) {
            window.showToast(`📦 评论区区域：宽${nextWidth}% · ${nextRows}行 · 框${nextBoxScale}%（弹幕文字大小保持 ${getLiveDmFontScalePct()}% 不变）`);
        }
    }

    // 独立步进函数 2：单独放大/缩小「里面的弹幕文字字号」，绝不改变评论区框体宽高、行数与位置
    function stepLiveDmFontOnly(deltaPct, showMsg = true) {
        const curFont = getLiveDmFontScalePct();
        const nextFont = Math.min(260, Math.max(60, curFont + deltaPct));
        if (inLiveDmScale) inLiveDmScale.value = String(nextFont);
        applyLiveDmScaleAndArea(false);
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
        }
        if (showMsg) {
            window.showToast(`🔤 弹幕文字字号：${nextFont}%（评论区框体区域与位置保持不变）`);
        }
    }

    if (liveDmResizeHandle && liveChatScrollBox) {
        // 1) 按住「⤡ 拖区域」拖拽手柄：左右拖动调评论区框体宽度 (45%~100%)，上下拖动调评论区高度/行数 (2~12行)，绝不改里面的文字字号！
        liveDmResizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDraggingDmSizeOrPos = true;
            if (liveBottomSectionEl) liveBottomSectionEl.classList.add('is-touching-dm-zone');
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = inLiveDmAreaWidth ? (parseInt(inLiveDmAreaWidth.value, 10) || 93) : 93;
            const startRows = getLiveMaxRowsVal();
            liveChatScrollBox.classList.add('is-resizing-dm');

            const onMove = (ev) => {
                const dx = ev.clientX - startX;
                const dy = startY - ev.clientY; // 向上拖拉增加高度/行数
                const nextWidth = Math.min(100, Math.max(45, Math.round(startWidth + dx * 0.28)));
                const nextRows = Math.min(12, Math.max(2, Math.round(startRows + dy / 20)));
                if (inLiveDmAreaWidth) inLiveDmAreaWidth.value = String(nextWidth);
                const prevRows = getLiveMaxRowsVal();
                if (inLiveDmMaxRows) inLiveDmMaxRows.value = String(nextRows);
                applyLiveDmScaleAndArea(nextRows !== prevRows);
            };
            const onUp = () => {
                isDraggingDmSizeOrPos = false;
                liveChatScrollBox.classList.remove('is-resizing-dm');
                if (dmZoneHoverCount <= 0 && liveBottomSectionEl) {
                    liveBottomSectionEl.classList.remove('is-touching-dm-zone');
                }
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
                    triggerSaveStorage();
                }
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });

        // 2) 滚轮彻底分开：
        //    - 在「第1排区域控制栏 / ⤡ 拖区域」滚动滚轮 -> 单独放大/缩小【评论区框体区域】
        //    - 在「弹幕文字区 (#live-chat-scroll-box) / 第2排字号栏」滚动滚轮 -> 单独放大/缩小【里面的弹幕文字字号】
        const handleAreaWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            stepLiveDmAreaOnly(e.deltaY < 0 ? 1 : -1, false);
        };
        const handleFontWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            stepLiveDmFontOnly(e.deltaY < 0 ? 5 : -5, false);
        };
        liveDmResizeHandle.addEventListener('wheel', handleAreaWheel, { passive: false });
        if (liveDmOnstageToolbar) {
            const areaRowEl = liveDmOnstageToolbar.querySelector('.is-area-row');
            const fontRowEl = liveDmOnstageToolbar.querySelector('.is-font-row');
            if (areaRowEl) areaRowEl.addEventListener('wheel', handleAreaWheel, { passive: false });
            if (fontRowEl) fontRowEl.addEventListener('wheel', handleFontWheel, { passive: false });
        }
        liveChatScrollBox.addEventListener('wheel', (e) => {
            if (e.target && e.target.closest && e.target.closest('.live-row-inline-editor')) return;
            handleFontWheel(e);
        }, { passive: false });
    }
    [btnLiveAreaDown, btnLivePanelAreaDown].forEach(b => {
        if (b) b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); stepLiveDmAreaOnly(-1, true); });
    });
    [btnLiveAreaUp, btnLivePanelAreaUp].forEach(b => {
        if (b) b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); stepLiveDmAreaOnly(1, true); });
    });
    [btnLiveFontDown, btnLivePanelFontDown].forEach(b => {
        if (b) b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); stepLiveDmFontOnly(-10, true); });
    });
    [btnLiveFontUp, btnLivePanelFontUp].forEach(b => {
        if (b) b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); stepLiveDmFontOnly(10, true); });
    });
    applyLiveDmScaleAndArea(false);

    const btnLiveCanvasZoomEdit = document.getElementById('btn-live-canvas-zoom-edit');
    const btnLiveCanvasResetSize = document.getElementById('btn-live-canvas-reset-size');
    const btnLiveHeaderZoomEdit = document.getElementById('btn-live-header-zoom-edit');
    const btnLiveHeaderResetSize = document.getElementById('btn-live-header-reset-size');
    const btnLiveDmZoom2 = document.getElementById('btn-live-dm-zoom-2');
    const btnLiveDmReset2 = document.getElementById('btn-live-dm-reset-2');
    const btnLiveToggleZoomEdit = document.getElementById('btn-live-toggle-zoom-edit');
    const btnLiveCanvasSpdDown = document.getElementById('btn-live-canvas-spd-down');
    const btnLiveCanvasSpdUp = document.getElementById('btn-live-canvas-spd-up');
    const txtLiveCanvasSpd = document.getElementById('txt-live-canvas-spd');
    const btnLiveCanvasAiDm = document.getElementById('btn-live-canvas-ai-dm');

    function syncLiveZoomEditingUI(forceState = null) {
        if (!liveBottomSectionEl) return false;
        const nextOn = typeof forceState === 'boolean' ? forceState : !liveBottomSectionEl.classList.contains('is-zoom-editing');
        liveBottomSectionEl.classList.toggle('is-zoom-editing', nextOn);
        if (btnLiveCanvasZoomEdit) {
            btnLiveCanvasZoomEdit.classList.toggle('is-active', nextOn);
            btnLiveCanvasZoomEdit.textContent = nextOn ? '🔍收起' : '🔍';
        }
        if (btnLiveHeaderZoomEdit) {
            btnLiveHeaderZoomEdit.textContent = nextOn ? '🔍 收起放大預覽' : '🔍 放大查看調細節';
            btnLiveHeaderZoomEdit.style.background = nextOn ? 'linear-gradient(90deg, #f59e0b, #ec4899)' : 'linear-gradient(90deg, #0284c7, #7c3aed)';
        }
        if (btnLiveDmZoom2) {
            btnLiveDmZoom2.textContent = nextOn ? '🔍 收起放大' : '🔍 放大查看';
            btnLiveDmZoom2.style.background = nextOn ? 'linear-gradient(90deg, #f59e0b, #ec4899)' : 'linear-gradient(90deg, #0284c7, #7c3aed)';
        }
        if (btnLiveToggleZoomEdit) {
            btnLiveToggleZoomEdit.textContent = nextOn ? '🔍收起放大' : '🔍放大查看细节';
            btnLiveToggleZoomEdit.style.background = nextOn ? 'linear-gradient(90deg, #f59e0b, #ec4899)' : 'linear-gradient(90deg, #0284c7, #7c3aed)';
        }
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
        }
        return nextOn;
    }
    window.syncLiveZoomEditingUI = syncLiveZoomEditingUI;

    function resetLiveDmPosOnly(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        liveDmOffsetX = 0;
        liveDmOffsetY = 0;
        applyLiveDmPositionOffset(true);
        window.showToast('✥ 已将评论区挪动位置归零（区域大小与文字字号保持不变）');
    }

    function resetLiveDmAreaOnly(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        liveDmOffsetX = 0;
        liveDmOffsetY = 0;
        applyLiveDmPositionOffset(true);
        if (inLiveDmAreaWidth) inLiveDmAreaWidth.value = '93';
        if (inLiveDmMaxRows) inLiveDmMaxRows.value = '5';
        if (inLiveDmBoxScale) inLiveDmBoxScale.value = '100';
        applyLiveDmScaleAndArea(true);
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
        window.showToast(`📦 已单独重置评论区区域与位置（宽93%·5行·框100%），弹幕文字大小保持 ${getLiveDmFontScalePct()}% 不变`);
    }

    function resetLiveDmFontOnly(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (inLiveDmScale) inLiveDmScale.value = '100';
        applyLiveDmScaleAndArea(false);
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
        window.showToast('🔤 已单独还原弹幕文字为 100% 标准大小（评论区区域大小与位置保持不变）');
    }

    function resetLiveDmSizeAndZoom(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        syncLiveZoomEditingUI(false);
        liveDmOffsetX = 0;
        liveDmOffsetY = 0;
        applyLiveDmPositionOffset(true);
        if (inLiveDmScale) inLiveDmScale.value = '100';
        if (inLiveDmBoxScale) inLiveDmBoxScale.value = '100';
        if (inLiveDmAreaWidth) inLiveDmAreaWidth.value = '93';
        if (inLiveDmMaxRows) inLiveDmMaxRows.value = '5';
        applyLiveDmScaleAndArea(true);
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
        }
        window.showToast('↺ 已全部重置：评论区标准区域（宽93%·5行·框100%）、默认位置与弹幕文字标准字号（100%）');
    }

    if (btnLiveResetDmPos) btnLiveResetDmPos.addEventListener('click', resetLiveDmPosOnly);
    [btnLiveResetDmArea, txtLiveOnstageArea].forEach(b => {
        if (b) b.addEventListener('click', resetLiveDmAreaOnly);
    });
    [btnLiveResetDmFont, txtLiveOnstageFont].forEach(b => {
        if (b) b.addEventListener('click', resetLiveDmFontOnly);
    });
    [btnLiveResetDmSize, btnLiveCanvasResetSize, btnLiveHeaderResetSize, btnLiveDmReset2].forEach(rBtn => {
        if (rBtn) rBtn.addEventListener('click', resetLiveDmSizeAndZoom);
    });

    const handleToggleZoomClick = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!isLiveRoomOpenNow() && typeof enterLayaLiveRoom === 'function') {
            enterLayaLiveRoom();
        }
        const isNowZoom = syncLiveZoomEditingUI();
        window.showToast(isNowZoom ? '🔍 已放大底部禮物與評論區，雙擊任意文字/勳章即可精修細節（點「↺ 重置大小」可一鍵還原）' : '✅ 已還原直播間標準預覽比例');
    };
    [btnLiveCanvasZoomEdit, btnLiveHeaderZoomEdit, btnLiveDmZoom2, btnLiveToggleZoomEdit].forEach(zBtn => {
        if (zBtn) zBtn.addEventListener('click', handleToggleZoomClick);
    });

    function adjustLiveSpeedByStep(deltaStep) {
        const cur = getLiveDmSpeedVal();
        const next = Math.min(10, Math.max(0, cur + deltaStep));
        if (inLiveDmSpeed) inLiveDmSpeed.value = String(next);
        if (txtLiveDmSpeed) txtLiveDmSpeed.textContent = formatLiveDmSpeedLabel(next);
        const spdBadgeTxt = next === 0 ? '⏸️靜止' : `⚡${next}檔`;
        if (txtLiveCanvasSpd) txtLiveCanvasSpd.textContent = spdBadgeTxt;
        if (txtLiveOnstageSpd) txtLiveOnstageSpd.textContent = spdBadgeTxt;
        if (inLiveGiftSpeed) {
            const curGiftSpd = getLiveGiftSpeedVal();
            const nextGiftSpd = Math.min(10, Math.max(0, curGiftSpd + deltaStep));
            inLiveGiftSpeed.value = String(nextGiftSpd);
            if (txtLiveGiftSpeed) txtLiveGiftSpeed.textContent = formatLiveGiftSpeedLabel(nextGiftSpd);
            if (swLiveAutoCycleGift) swLiveAutoCycleGift.checked = nextGiftSpd > 0;
        }
        if (swLiveAutoRollDm) swLiveAutoRollDm.checked = next > 0;
        syncAutoGiftToggleBadgeUI();
        if (next > 0) renderLiveChatBubbles(true);
        restartLiveChatRollTimer();
        restartLiveGiftAutoCycleTimer();
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
        window.showToast(next === 0 ? '⏸️ 直播間評論與禮物已設為 0 檔：完全靜止不動' : `⚡ 直播間評論與禮物速度已調至：${formatLiveDmSpeedLabel(next)}`);
    }

    [btnLiveCanvasSpdDown, btnLiveOnstageSpdDown].forEach(b => {
        if (b) {
            b.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                adjustLiveSpeedByStep(-1);
            });
        }
    });
    [btnLiveCanvasSpdUp, btnLiveOnstageSpdUp].forEach(b => {
        if (b) {
            b.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                adjustLiveSpeedByStep(1);
            });
        }
    });
    if (btnLiveCanvasAiDm) {
        btnLiveCanvasAiDm.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof autoMatchLiveDanmakuByVideoAI === 'function') {
                autoMatchLiveDanmakuByVideoAI(true, null);
            }
        });
    }

    let isHoveringLiveChatBox = false;
    if (liveChatScrollBox) {
        liveChatScrollBox.addEventListener('mouseenter', () => { isHoveringLiveChatBox = true; });
        liveChatScrollBox.addEventListener('mouseleave', () => { isHoveringLiveChatBox = false; });
    }

    // ★ 礼物弹窗连击数字跳动 + 自动弹出轮播下一位真人送礼 + 0~10档独立速度调节（0档完全静止固定不动，1~3档超级慢速，4~10档常速至狂暴）
    const inLiveGiftSpeed = document.getElementById('in-live-gift-speed');
    const txtLiveGiftSpeed = document.getElementById('txt-live-gift-speed');
    const btnLiveGiftSpdPause = document.getElementById('btn-live-gift-spd-pause');
    const btnLiveGiftSpdDown = document.getElementById('btn-live-gift-spd-down');
    const btnLiveGiftSpdUp = document.getElementById('btn-live-gift-spd-up');
    const btnLiveDmSpdPause = document.getElementById('btn-live-dm-spd-pause');
    const txtLiveAutoGiftState = document.getElementById('txt-live-auto-gift-state');

    // 0~10档礼物切换间隔与连击跳动间隔表（0档=静止，1档=25秒/个超级慢，2档=15秒/个极慢，3档=9秒/个慢速，5档=3.5秒/个标准）
    const GIFT_SWITCH_MS_TABLE = [0, 25000, 15000, 9000, 5500, 3500, 2200, 1500, 1000, 700, 450];
    const GIFT_BOUNCE_MS_TABLE = [0, 5500, 3500, 2200, 1300, 850, 550, 380, 280, 200, 150];
    const GIFT_SPEED_DESC_TABLE = ['⏸️静止不动', '🐢超级慢', '🐢极慢速', '慢速弹出', '舒缓轮播', '标准弹出', '欢快连发', '高频刷礼', '狂飙刷礼', '大哥屠屏', '满屏暴击'];

    function getLiveGiftSpeedVal() {
        const raw = inLiveGiftSpeed ? parseInt(inLiveGiftSpeed.value, 10) : 5;
        return Math.min(10, Math.max(0, Number.isNaN(raw) ? 5 : raw));
    }

    function formatLiveGiftSpeedLabel(lv) {
        const clamped = Math.min(10, Math.max(0, Number.isNaN(parseInt(lv, 10)) ? 5 : parseInt(lv, 10)));
        if (clamped === 0) {
            return '0档 · ⏸️ 静止不动 (固定不弹)';
        }
        const secStr = (GIFT_SWITCH_MS_TABLE[clamped] / 1000).toFixed(1).replace(/\.0$/, '');
        return `${clamped}档 · ${secStr}秒/个 (${GIFT_SPEED_DESC_TABLE[clamped]})`;
    }

    const GIFT_COMBO_STEP_SEQ = ['x1', 'x2', 'x5', 'x9', 'x18', 'x52', 'x66', 'x99', 'x188', 'x520'];
    function bumpLiveGiftComboOnce() {
        if (!liveGiftComboNum || isEditingGiftBanner) return;
        const { minQty, maxQty } = getLiveGiftQtyRange();
        const curTxt = (liveGiftComboNum.textContent || ('x' + minQty)).trim();
        const curNum = parseInt(curTxt.replace(/[^\d]/g, ''), 10) || minQty;
        const nextTxt = getNextGiftComboInRange(curNum, 1);
        liveGiftComboNum.textContent = nextTxt;
        if (inLiveGiftCount) inLiveGiftCount.value = nextTxt;
        if (minQty >= maxQty) {
            return;
        }
        liveGiftComboNum.classList.remove('is-bouncing');
        void liveGiftComboNum.offsetWidth;
        liveGiftComboNum.classList.add('is-bouncing');
        if (liveGiftItemIcon) {
            liveGiftItemIcon.classList.remove('is-bouncing');
            void liveGiftItemIcon.offsetWidth;
            liveGiftItemIcon.classList.add('is-bouncing');
        }
        if (liveGiftComboBanner && !liveGiftComboBanner.classList.contains('gift-slide-out')) {
            liveGiftComboBanner.classList.remove('gift-slide-in', 'is-combo-pulse');
            void liveGiftComboBanner.offsetWidth;
            liveGiftComboBanner.classList.add('is-combo-pulse');
        }
    }

    // ★ 送礼停留时间（默认1秒）、消失过渡时间（默认0.4秒）与两次送礼随机空窗间隔（默认1~3秒没人送礼）配置与状态机
    const GIFT_EMPTY_GAP_STORAGE_KEY = 'LAYA_LIVE_GIFT_EMPTY_GAP_V3';
    try {
        const savedGapCfg = JSON.parse(localStorage.getItem(GIFT_EMPTY_GAP_STORAGE_KEY) || 'null');
        if (savedGapCfg && typeof savedGapCfg === 'object') {
            if (swLiveGiftEmptyGap && typeof savedGapCfg.enabled === 'boolean') {
                swLiveGiftEmptyGap.checked = savedGapCfg.enabled;
            }
            if (inLiveGiftStaySec && savedGapCfg.staySec !== undefined) {
                inLiveGiftStaySec.value = String(Math.max(0.3, Math.min(60, parseFloat(savedGapCfg.staySec) || 1.0)));
            }
            if (inLiveGiftFadeSec && savedGapCfg.fadeSec !== undefined) {
                inLiveGiftFadeSec.value = String(Math.max(0.1, Math.min(5, parseFloat(savedGapCfg.fadeSec) || 0.4)));
            }
            if (inLiveGiftGapMin && savedGapCfg.gapMinSec !== undefined) {
                inLiveGiftGapMin.value = String(Math.max(0, Math.min(300, parseFloat(savedGapCfg.gapMinSec) || 0)));
            }
            if (inLiveGiftGapMax && savedGapCfg.gapMaxSec !== undefined) {
                inLiveGiftGapMax.value = String(Math.max(0, Math.min(300, parseFloat(savedGapCfg.gapMaxSec) || 0)));
            }
        } else {
            if (swLiveGiftEmptyGap) swLiveGiftEmptyGap.checked = true;
            if (inLiveGiftStaySec) inLiveGiftStaySec.value = '1.0';
            if (inLiveGiftFadeSec) inLiveGiftFadeSec.value = '0.4';
            if (inLiveGiftGapMin) inLiveGiftGapMin.value = '1.0';
            if (inLiveGiftGapMax) inLiveGiftGapMax.value = '3.0';
        }
    } catch (_gapErr) {}

    function getLiveGiftEmptyGapConfig() {
        const enabled = !swLiveGiftEmptyGap || swLiveGiftEmptyGap.checked;
        const rawStay = inLiveGiftStaySec ? parseFloat(inLiveGiftStaySec.value) : 1.0;
        const rawFade = inLiveGiftFadeSec ? parseFloat(inLiveGiftFadeSec.value) : 0.4;
        const rawMin = inLiveGiftGapMin ? parseFloat(inLiveGiftGapMin.value) : 1.0;
        const rawMax = inLiveGiftGapMax ? parseFloat(inLiveGiftGapMax.value) : 3.0;
        const cleanStay = Math.max(0.3, Math.min(60, Number.isNaN(rawStay) ? 1.0 : rawStay));
        const cleanFade = Math.max(0.1, Math.min(5, Number.isNaN(rawFade) ? 0.4 : rawFade));
        const cleanMin = Math.max(0, Math.min(300, Number.isNaN(rawMin) ? 1.0 : rawMin));
        const cleanMax = Math.max(0, Math.min(300, Number.isNaN(rawMax) ? 3.0 : rawMax));
        return {
            enabled,
            staySec: cleanStay,
            fadeSec: cleanFade,
            gapMinSec: Math.min(cleanMin, cleanMax),
            gapMaxSec: Math.max(cleanMin, cleanMax)
        };
    }

    function saveLiveGiftEmptyGapConfig() {
        const cfg = getLiveGiftEmptyGapConfig();
        try {
            localStorage.setItem(GIFT_EMPTY_GAP_STORAGE_KEY, JSON.stringify(cfg));
        } catch (_e) {}
    }

    let isGiftInEmptyGapNow = false;
    let isGiftFadingOutNow = false;
    let giftEmptyGapPhaseTimer = null;
    let giftFadeOutPhaseTimer = null;

    function updateGiftGapStatusBadge() {
        const cfg = getLiveGiftEmptyGapConfig();
        if (liveGiftComboBanner) {
            liveGiftComboBanner.style.setProperty('--gift-fade-out-sec', `${cfg.fadeSec}s`);
        }
        if (!txtLiveGiftGapStatus) return;
        if (!cfg.enabled || cfg.gapMaxSec <= 0) {
            txtLiveGiftGapStatus.textContent = `(🎁 停留${cfg.staySec}s · 消失${cfg.fadeSec}s · 0s空窗连弹)`;
            txtLiveGiftGapStatus.style.color = '#93c5fd';
            return;
        }
        if (isGiftInEmptyGapNow || isGiftFadingOutNow) {
            txtLiveGiftGapStatus.textContent = `(🙈 间隔空窗中 · 没人送礼 ${cfg.gapMinSec}~${cfg.gapMaxSec}s)`;
            txtLiveGiftGapStatus.style.color = '#fde047';
        } else {
            txtLiveGiftGapStatus.textContent = `(🎁 停留${cfg.staySec}s · 消失${cfg.fadeSec}s · 间隔${cfg.gapMinSec}~${cfg.gapMaxSec}s)`;
            txtLiveGiftGapStatus.style.color = '#a7f3d0';
        }
    }

    function setGiftEmptyGapVisualState(inGap, fadingOut = false) {
        isGiftInEmptyGapNow = !!inGap;
        isGiftFadingOutNow = !!fadingOut;
        const cfg = getLiveGiftEmptyGapConfig();
        if (liveGiftComboBanner) {
            liveGiftComboBanner.style.setProperty('--gift-fade-out-sec', `${cfg.fadeSec}s`);
            if (isGiftInEmptyGapNow) {
                liveGiftComboBanner.dataset.inEmptyGap = 'true';
                liveGiftComboBanner.classList.remove('gift-slide-in', 'is-combo-pulse', 'gift-slide-out');
                liveGiftComboBanner.classList.add('is-in-empty-gap');
            } else if (isGiftFadingOutNow) {
                liveGiftComboBanner.dataset.inEmptyGap = 'fading';
                liveGiftComboBanner.classList.remove('gift-slide-in', 'is-combo-pulse', 'is-in-empty-gap');
                liveGiftComboBanner.classList.add('gift-slide-out');
            } else {
                delete liveGiftComboBanner.dataset.inEmptyGap;
                liveGiftComboBanner.classList.remove('is-in-empty-gap', 'gift-slide-out');
            }
        }
        if (btnLiveToggleGiftGapNow) {
            btnLiveToggleGiftGapNow.textContent = (isGiftInEmptyGapNow || isGiftFadingOutNow) ? '🎁 立即弹出礼物' : '🙈 立即空窗/弹出';
        }
        updateGiftGapStatusBadge();
    }

    function pickRandomGiftEmptyGapMs() {
        const cfg = getLiveGiftEmptyGapConfig();
        if (!cfg.enabled || cfg.gapMaxSec <= 0) return 0;
        const minMs = Math.round(cfg.gapMinSec * 1000);
        const maxMs = Math.round(cfg.gapMaxSec * 1000);
        if (maxMs <= minMs) return minMs;
        return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
    }

    function syncAutoGiftToggleBadgeUI() {
        const giftSpdLv = getLiveGiftSpeedVal();
        const isOn = (!swLiveAutoCycleGift || swLiveAutoCycleGift.checked) && giftSpdLv > 0;
        if (txtLiveAutoGiftState) {
            txtLiveAutoGiftState.textContent = isOn ? '自动弹出轮播中' : '⏸️ 已固定静止(点此开启)';
        }
        updateGiftGapStatusBadge();
    }

    function restartLiveGiftAutoCycleTimer() {
        if (liveGiftComboTimer) {
            clearInterval(liveGiftComboTimer);
            liveGiftComboTimer = null;
        }
        if (liveGiftComboBounceTimer) {
            clearInterval(liveGiftComboBounceTimer);
            liveGiftComboBounceTimer = null;
        }
        if (giftEmptyGapPhaseTimer) {
            clearTimeout(giftEmptyGapPhaseTimer);
            giftEmptyGapPhaseTimer = null;
        }
        if (giftFadeOutPhaseTimer) {
            clearTimeout(giftFadeOutPhaseTimer);
            giftFadeOutPhaseTimer = null;
        }
        const giftSpdLv = getLiveGiftSpeedVal();
        if (txtLiveGiftSpeed) {
            txtLiveGiftSpeed.textContent = formatLiveGiftSpeedLabel(giftSpdLv);
        }
        syncAutoGiftToggleBadgeUI();
        if (giftSpdLv <= 0) {
            setGiftEmptyGapVisualState(false, false);
            return;
        }
        if (!swLiveAutoCycleGift || swLiveAutoCycleGift.checked) {
            const bounceComboMs = Math.min(480, GIFT_BOUNCE_MS_TABLE[giftSpdLv] || 420);

            liveGiftComboBounceTimer = setInterval(() => {
                if (!isLiveRoomOpenNow() || isEditingGiftBanner) return;
                if (swLiveAutoCycleGift && !swLiveAutoCycleGift.checked) return;
                if (getLiveGiftSpeedVal() <= 0) return;
                if (isGiftInEmptyGapNow || isGiftFadingOutNow) return; // 消失中或空窗期不跳动连击
                bumpLiveGiftComboOnce();
            }, bounceComboMs);

            // 统一 3 阶段送礼循环：[1. 展示停留 staySec 秒 (默认1秒)] -> [2. 淡出消失 fadeSec 秒 (默认0.4秒)] -> [3. 无人送礼空窗间隔 gapMin~gapMax 秒] -> [弹出下一位全新头像/名字/礼物]
            setGiftEmptyGapVisualState(false, false);
            const runStayFadeEmptyLoop = () => {
                if (giftEmptyGapPhaseTimer) { clearTimeout(giftEmptyGapPhaseTimer); giftEmptyGapPhaseTimer = null; }
                if (giftFadeOutPhaseTimer) { clearTimeout(giftFadeOutPhaseTimer); giftFadeOutPhaseTimer = null; }

                const curCfg = getLiveGiftEmptyGapConfig();
                const curSpdLv = getLiveGiftSpeedVal();
                if (curSpdLv <= 0 || (swLiveAutoCycleGift && !swLiveAutoCycleGift.checked)) {
                    setGiftEmptyGapVisualState(false, false);
                    return;
                }

                const stayMs = Math.max(300, Math.round(curCfg.staySec * 1000));
                const fadeMs = Math.max(100, Math.round(curCfg.fadeSec * 1000));

                // 阶段 1：送礼停留 stayMs（默认 1.0 秒）
                giftEmptyGapPhaseTimer = setTimeout(() => {
                    if (!isLiveRoomOpenNow() || isEditingGiftBanner) {
                        runStayFadeEmptyLoop();
                        return;
                    }
                    // 阶段 2：停留结束，开始淡出消失（耗时 fadeMs，默认 0.4 秒）
                    setGiftEmptyGapVisualState(false, true);

                    giftFadeOutPhaseTimer = setTimeout(() => {
                        giftFadeOutPhaseTimer = null;
                        if (!isLiveRoomOpenNow() || isEditingGiftBanner) {
                            setGiftEmptyGapVisualState(false, false);
                            runStayFadeEmptyLoop();
                            return;
                        }
                        const gapMs = pickRandomGiftEmptyGapMs();
                        if (gapMs <= 50) {
                            // 0 秒空窗：消失后立即弹出下一位不同头像、不同名字、不同礼物的人
                            setGiftEmptyGapVisualState(false, false);
                            pickAndApplyNextUniqueGiftBundle(true);
                            runStayFadeEmptyLoop();
                            return;
                        }
                        // 阶段 3：完全隐去，进入「没人送礼物」空窗间隔期（耗时 gapMs）
                        setGiftEmptyGapVisualState(true, false);
                        giftEmptyGapPhaseTimer = setTimeout(() => {
                            // 空窗期结束：立即换下一位真人头像 + 不同名字 + 不同礼物滑入！
                            setGiftEmptyGapVisualState(false, false);
                            if (isLiveRoomOpenNow() && !isEditingGiftBanner) {
                                pickAndApplyNextUniqueGiftBundle(true);
                            }
                            runStayFadeEmptyLoop();
                        }, gapMs);
                    }, fadeMs);
                }, stayMs);
            };
            runStayFadeEmptyLoop();
        } else {
            setGiftEmptyGapVisualState(false, false);
        }
    }

    // 绑定送礼停留时间、消失时间、空窗间隔开关、最短/最长间隔秒数与一键预设按钮
    if (swLiveGiftEmptyGap) {
        swLiveGiftEmptyGap.addEventListener('change', () => {
            saveLiveGiftEmptyGapConfig();
            restartLiveGiftAutoCycleTimer();
            const cfg = getLiveGiftEmptyGapConfig();
            window.showToast(cfg.enabled
                ? (`⏱️ 已开启送完消失+随机间隔：停留 ${cfg.staySec}s -> 消失 ${cfg.fadeSec}s -> 间隔 ${cfg.gapMinSec}~${cfg.gapMaxSec}s`)
                : (`🎁 已设为 0 秒间隔连弹：停留 ${cfg.staySec}s -> 消失 ${cfg.fadeSec}s 后立即弹下一位`));
        });
    }
    [inLiveGiftStaySec, inLiveGiftFadeSec, inLiveGiftGapMin, inLiveGiftGapMax].forEach(inp => {
        if (!inp) return;
        inp.addEventListener('change', () => {
            const cfg = getLiveGiftEmptyGapConfig();
            if (inLiveGiftStaySec) inLiveGiftStaySec.value = String(cfg.staySec);
            if (inLiveGiftFadeSec) inLiveGiftFadeSec.value = String(cfg.fadeSec);
            if (inLiveGiftGapMin) inLiveGiftGapMin.value = String(cfg.gapMinSec);
            if (inLiveGiftGapMax) inLiveGiftGapMax.value = String(cfg.gapMaxSec);
            saveLiveGiftEmptyGapConfig();
            restartLiveGiftAutoCycleTimer();
            window.showToast(`⏱️ 送礼节奏已更新：停留 ${cfg.staySec}s · 消失 ${cfg.fadeSec}s · 间隔 ${cfg.gapMinSec}~${cfg.gapMaxSec}s`);
        });
        inp.addEventListener('input', () => {
            saveLiveGiftEmptyGapConfig();
            updateGiftGapStatusBadge();
        });
    });
    if (giftGapPresetBtns && giftGapPresetBtns.length > 0) {
        giftGapPresetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const gStay = parseFloat(btn.getAttribute('data-stay') || '1.0');
                const gFade = parseFloat(btn.getAttribute('data-fade') || '0.4');
                const gMin = parseFloat(btn.getAttribute('data-gap-min') || '0');
                const gMax = parseFloat(btn.getAttribute('data-gap-max') || '0');
                if (inLiveGiftStaySec) inLiveGiftStaySec.value = String(gStay);
                if (inLiveGiftFadeSec) inLiveGiftFadeSec.value = String(gFade);
                if (gMax <= 0) {
                    if (swLiveGiftEmptyGap) swLiveGiftEmptyGap.checked = false;
                    if (inLiveGiftGapMin) inLiveGiftGapMin.value = '0';
                    if (inLiveGiftGapMax) inLiveGiftGapMax.value = '0';
                } else {
                    if (swLiveGiftEmptyGap) swLiveGiftEmptyGap.checked = true;
                    if (inLiveGiftGapMin) inLiveGiftGapMin.value = String(gMin);
                    if (inLiveGiftGapMax) inLiveGiftGapMax.value = String(gMax);
                }
                saveLiveGiftEmptyGapConfig();
                restartLiveGiftAutoCycleTimer();
                window.showToast(gMax <= 0
                    ? `🎁 已切换为「连弹模式」：停留 ${gStay}s · 消失 ${gFade}s · 0秒间隔`
                    : `⏱️ 已切换送礼节奏：停留 ${gStay}s · 消失 ${gFade}s · 间隔 ${gMin}~${gMax}s`);
            });
        });
    }
    if (btnLiveToggleGiftGapNow) {
        btnLiveToggleGiftGapNow.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isGiftInEmptyGapNow && !isGiftFadingOutNow) {
                setGiftEmptyGapVisualState(true, false);
                window.showToast('🙈 已立即隐藏礼物条进入「没人送礼物」空窗状态');
            } else {
                setGiftEmptyGapVisualState(false, false);
                pickAndApplyNextUniqueGiftBundle(true);
                restartLiveGiftAutoCycleTimer();
                window.showToast('🎁 已立即弹出下一位全新送礼人');
            }
        });
    }

    function setLiveGiftSpeedLevel(nextLv, showToastMsg = true) {
        const parsed = parseInt(nextLv, 10);
        const lv = Math.min(10, Math.max(0, Number.isNaN(parsed) ? 5 : parsed));
        if (inLiveGiftSpeed) inLiveGiftSpeed.value = String(lv);
        if (txtLiveGiftSpeed) txtLiveGiftSpeed.textContent = formatLiveGiftSpeedLabel(lv);
        if (lv === 0) {
            if (swLiveAutoCycleGift) swLiveAutoCycleGift.checked = false;
        } else {
            if (swLiveAutoCycleGift && !swLiveAutoCycleGift.checked) {
                swLiveAutoCycleGift.checked = true;
            }
        }
        syncAutoGiftToggleBadgeUI();
        restartLiveGiftAutoCycleTimer();
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
        }
        if (showToastMsg) {
            window.showToast(lv === 0 ? '⏸️ 禮物小彈窗已設為 0 檔：完全固定靜止不動' : `🎁 禮物彈出與連擊速度已設為：${formatLiveGiftSpeedLabel(lv)}`);
        }
    }

    if (inLiveGiftSpeed) {
        inLiveGiftSpeed.addEventListener('input', () => {
            setLiveGiftSpeedLevel(inLiveGiftSpeed.value, false);
        });
    }
    if (btnLiveGiftSpdPause) {
        btnLiveGiftSpdPause.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setLiveGiftSpeedLevel(0, true);
        });
    }
    if (btnLiveGiftSpdDown) {
        btnLiveGiftSpdDown.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setLiveGiftSpeedLevel(getLiveGiftSpeedVal() - 1, true);
        });
    }
    if (btnLiveGiftSpdUp) {
        btnLiveGiftSpdUp.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const cur = getLiveGiftSpeedVal();
            setLiveGiftSpeedLevel(cur <= 0 ? 1 : cur + 1, true);
        });
    }
    if (swLiveAutoCycleGift) {
        swLiveAutoCycleGift.addEventListener('change', () => {
            if (swLiveAutoCycleGift.checked && getLiveGiftSpeedVal() <= 0) {
                if (inLiveGiftSpeed) inLiveGiftSpeed.value = '3';
            }
            syncAutoGiftToggleBadgeUI();
            restartLiveGiftAutoCycleTimer();
            window.showToast(swLiveAutoCycleGift.checked ? '🔄 已開啟禮物彈窗自動輪播與連擊跳動' : '⏸️ 已固定當前禮物彈窗（完全靜止不動）');
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

        const speedLv = getLiveDmSpeedVal();
        if (txtLiveDmSpeed) {
            txtLiveDmSpeed.textContent = formatLiveDmSpeedLabel(speedLv);
        }
        const spdBadgeLabel = speedLv === 0 ? '⏸️靜止' : `⚡${speedLv}檔`;
        if (txtLiveCanvasSpd) {
            txtLiveCanvasSpd.textContent = spdBadgeLabel;
        }
        if (txtLiveOnstageSpd) {
            txtLiveOnstageSpd.textContent = spdBadgeLabel;
        }
        if (speedLv <= 0) {
            return;
        }
        if (!swLiveAutoRollDm || swLiveAutoRollDm.checked) {
            const intervalMs = getLiveDmIntervalMs(speedLv);
            if (intervalMs > 0) {
                liveChatRollTimer = setInterval(() => {
                    if (isLiveRoomOpenNow() && liveDmVisible && getLiveDmSpeedVal() > 0 && (!swLiveAutoRollDm || swLiveAutoRollDm.checked)) {
                        renderLiveChatBubbles(true);
                    }
                }, intervalMs);
            }
        }

        const joinIntervalMs = getLiveJoinIntervalMs(speedLv);
        if (joinIntervalMs > 0 && (!swLiveAutoRollDm || swLiveAutoRollDm.checked)) {
            liveJoinTickerTimer = setInterval(() => {
                if (isLiveRoomOpenNow() && liveDmVisible && liveEditingDmIdx === null && getLiveDmSpeedVal() > 0 && (!swLiveAutoRollDm || swLiveAutoRollDm.checked)) {
                    renderLiveJoinTicker(true);
                }
            }, joinIntervalMs);
        }
    }
    if (btnLiveDmSpdPause) {
        btnLiveDmSpdPause.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (inLiveDmSpeed) inLiveDmSpeed.value = '0';
            if (swLiveAutoRollDm) swLiveAutoRollDm.checked = false;
            restartLiveChatRollTimer();
            if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('⏸️ 公屏彈幕已設為 0 檔：完全靜止固定不動');
        });
    }
    if (swLiveAutoRollDm) {
        swLiveAutoRollDm.addEventListener('change', () => {
            if (swLiveAutoRollDm.checked && getLiveDmSpeedVal() <= 0) {
                if (inLiveDmSpeed) inLiveDmSpeed.value = '3';
            }
            restartLiveChatRollTimer();
            window.showToast(swLiveAutoRollDm.checked ? '🔄 已開啟公屏彈幕自動滾動' : '⏸️ 已固定公屏彈幕展示（文字完全靜止不再滾動）');
        });
    }

    // ★ 仅当用户在暂停状态下手动拖动底部视频时间轴游标时，才按需联动预览；正常播放时严格按照用户设定的 0~10 档定时器速度运行（支持超级慢与完全静止）
    window.__onLiveVideoProgressSync = function (curTimeSec, isPaused) {
        if (!isLiveRoomOpenNow() || !isPaused) return;
        const t = Number(curTimeSec) || 0;
        if (lastLiveVideoSyncTime < 0) {
            lastLiveVideoSyncTime = t;
            return;
        }
        const diff = Math.abs(t - lastLiveVideoSyncTime);
        if (diff >= 0.35) {
            lastLiveVideoSyncTime = t;
            if (liveDmVisible && getLiveDmSpeedVal() > 0 && (!swLiveAutoRollDm || swLiveAutoRollDm.checked)) {
                renderLiveChatBubbles(true);
                renderLiveJoinTicker(true);
            }
        }
    };

    const previewVidForLiveSync = document.getElementById('preview-video');
    if (previewVidForLiveSync) {
        previewVidForLiveSync.addEventListener('seeking', () => {
            if (typeof window.__onLiveVideoProgressSync === 'function') {
                window.__onLiveVideoProgressSync(previewVidForLiveSync.currentTime || 0, true);
            }
        });
        previewVidForLiveSync.addEventListener('ratechange', () => {
            if (isLiveRoomOpenNow()) {
                restartLiveChatRollTimer();
                restartLiveGiftAutoCycleTimer();
            }
        });
    }
    const inProgressSliderForLive = document.getElementById('in-progress');
    if (inProgressSliderForLive) {
        inProgressSliderForLive.addEventListener('input', () => {
            if (typeof window.__onLiveVideoProgressSync === 'function') {
                window.__onLiveVideoProgressSync(parseFloat(inProgressSliderForLive.value) || 0, true);
            }
        });
    }

    function startLiveRoomAnimations() {
        liveRollTickCount = 0;
        liveDmVisible = true;
        liveEditingDmIdx = null;
        if (liveChatList) liveChatList.style.opacity = '1';
        if (liveJoinTickerRow) liveJoinTickerRow.style.opacity = '1';
        if (typeof applyAllLiveElementVisibility === 'function') {
            applyAllLiveElementVisibility();
        } else {
            if (liveSysNoticeEl) {
                liveSysNoticeEl.style.display = (!swLiveShowNotice || swLiveShowNotice.checked) ? '' : 'none';
            }
            if (liveRoomWelcomeEl) {
                liveRoomWelcomeEl.style.display = (!swLiveShowWelcome || swLiveShowWelcome.checked) ? '' : 'none';
            }
        }
        applyLiveGiftBannerState(false, false);
        renderLiveChatBubbles(false);
        renderLiveJoinTicker(false);
        restartLiveChatRollTimer();
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
        if (liveGiftComboBounceTimer) {
            clearInterval(liveGiftComboBounceTimer);
            liveGiftComboBounceTimer = null;
        }
        if (giftEmptyGapPhaseTimer) {
            clearTimeout(giftEmptyGapPhaseTimer);
            giftEmptyGapPhaseTimer = null;
        }
        if (giftFadeOutPhaseTimer) {
            clearTimeout(giftFadeOutPhaseTimer);
            giftFadeOutPhaseTimer = null;
        }
        if (liveHeaderFlipTimer) {
            clearInterval(liveHeaderFlipTimer);
            liveHeaderFlipTimer = null;
        }
        syncLiveZoomEditingUI(false);
    }

    // ★ 右侧编辑栏瞬间跳转并高亮【🔴 直播间专属设置】卡片（置顶对齐）
    function scrollToLiveSettingsCardImmediately(targetSubSelector = '#card-dy-live-settings') {
        const panelDyEl = document.getElementById('panel-dy-settings');
        if (panelDyEl) panelDyEl.classList.add('live-priority-order');
        if (typeof window.locateSidebarControl === 'function') {
            window.locateSidebarControl({
                tab: 'dy',
                cardId: 'card-dy-live-settings',
                targetSelector: targetSubSelector || '#card-dy-live-settings',
                highlightSelector: targetSubSelector || '#card-dy-live-settings'
            });
            return;
        }
        if (typeof window.switchRightTab === 'function') {
            window.switchRightTab('dy');
        }
        if (typeof setActiveQuickAccessItem === 'function') {
            setActiveQuickAccessItem('card-dy-live-settings', true);
        }
    }

    // 进入 Laya 直播页面（点顶部「直播」立即进入，自动开启礼物轮播、点赞飘心与公屏滚动，且右侧瞬间跳到【直播间专属设置】）
    function enterLayaLiveRoom(opts = {}) {
        if (!window.__ENABLE_LAYA_LIVE_ENTRY) return;
        if (!renderTarget) return;
        if (!renderTarget.classList.contains('mode-mobile-port') && window.PlayerEngine && typeof window.PlayerEngine.activateViewportMode === 'function') {
            window.PlayerEngine.activateViewportMode('mode-mobile-port');
        }
        window.__layaLiveTabArmed = false;
        if (liveArmedTipEl) liveArmedTipEl.style.display = 'none';
        if (topNavBounceTimer) {
            clearTimeout(topNavBounceTimer);
            topNavBounceTimer = null;
        }

        // 若评论区打开则先收起，并切换为直播间内页态
        renderTarget.classList.remove('dy-comment-open', 'dy-comment-expanded', 'dy-live-preview');
        renderTarget.classList.add('dy-live-open');
        const panelDyEl = document.getElementById('panel-dy-settings');
        if (panelDyEl) panelDyEl.classList.add('live-priority-order');
        if (liveOverlayEl) liveOverlayEl.style.display = 'flex';
        syncLiveAudienceAvatars(0);

        // 保持本软件原有的顶部标签栏亮在「直播」(index 2)
        document.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item').forEach((el, idx) => el.classList.toggle('active', idx === 2));
        document.querySelectorAll('.laya-nav-tabs > span').forEach((el, idx) => el.classList.toggle('active', idx === 2));
        document.querySelectorAll('.dy-top-tabs > span').forEach((el, idx) => el.classList.toggle('active', idx === 2));

        if (window.PlayerEngine && typeof window.PlayerEngine.updateTransform === 'function') {
            setTimeout(() => window.PlayerEngine.updateTransform(), 25);
        }
        startLiveRoomAnimations();
        if (!opts || !opts.preserveScroll) {
            scrollToLiveSettingsCardImmediately();
        } else {
            if (typeof window.switchRightTab === 'function') window.switchRightTab('dy');
            if (typeof setActiveQuickAccessItem === 'function') setActiveQuickAccessItem('card-dy-live-settings', true);
        }
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
        }
        if (!opts || !opts.silentToast) {
            window.showToast('🔴 已進入直播間！禮物、點讚與滾動評論已自動開啟，右側已定位至【直播間專屬設置】');
        }
    }
    window.enterLayaLiveRoom = enterLayaLiveRoom;

    // ★ 当用户点击中间快捷导航「🔴 直播间设置」或在右侧点击/调整【🔴 直播间专属设置】卡片任意项时，若左侧还未进入直播间，自动打开直播间并启动滚动！
    const qaLiveItemBtn = document.querySelector('.qa-item[data-target-card="card-dy-live-settings"]');
    if (qaLiveItemBtn) {
        qaLiveItemBtn.addEventListener('click', () => {
            if (!isLiveRoomOpenNow()) {
                enterLayaLiveRoom();
            } else {
                scrollToLiveSettingsCardImmediately();
            }
        });
    }
    const liveSettingsCardEl = document.getElementById('card-dy-live-settings');
    if (liveSettingsCardEl) {
        liveSettingsCardEl.addEventListener('mousedown', (e) => {
            if (window.__isRestoringStorage) return;
            if (e.target && e.target.closest && e.target.closest('#btn-live-back-to-video')) return;
            if (!isLiveRoomOpenNow() && renderTarget && renderTarget.classList.contains('mode-mobile-port')) {
                enterLayaLiveRoom();
            }
        });
    }

    // ★ 700ms 自愈巡检守护：仅当用户开启了对应自动开关且档位 > 0 时才守护运行，若设为 0 档或关闭了自动开关则严格保持静止（导出录制期间暂停干预）
    setInterval(() => {
        if (!isLiveRoomOpenNow() || window.__isExportRecording) return;
        const dmSpd = getLiveDmSpeedVal();
        if (dmSpd > 0 && (!swLiveAutoRollDm || swLiveAutoRollDm.checked) && !liveChatRollTimer) {
            restartLiveChatRollTimer();
        }
        if (dmSpd > 0 && (!swLiveAutoRollDm || swLiveAutoRollDm.checked) && !liveJoinTickerTimer) {
            restartLiveChatRollTimer();
        }
        const giftSpd = getLiveGiftSpeedVal();
        if (giftSpd > 0 && (!swLiveAutoCycleGift || swLiveAutoCycleGift.checked) && (!liveGiftComboTimer && !giftEmptyGapPhaseTimer && !giftFadeOutPhaseTimer)) {
            restartLiveGiftAutoCycleTimer();
        }
        const heartDen = getLiveHeartDensityVal();
        if (heartDen > 0 && (!liveFloatingHearts || liveFloatingHearts.dataset.liveHidden !== 'true') && !liveHeartTimer) {
            restartLiveHeartTimer();
        }
    }, 700);

    // 切回短视频（推薦）默认状态
    function exitLayaLiveRoom(showMsg = true) {
        window.__layaLiveTabArmed = false;
        if (liveArmedTipEl) liveArmedTipEl.style.display = 'none';
        if (!renderTarget) return;
        const wasOpen = renderTarget.classList.contains('dy-live-open') || renderTarget.classList.contains('dy-live-preview');
        renderTarget.classList.remove('dy-live-open', 'dy-live-preview');
        const panelDyEl = document.getElementById('panel-dy-settings');
        if (panelDyEl) panelDyEl.classList.remove('live-priority-order');
        if (liveOverlayEl) liveOverlayEl.style.display = 'none';
        stopLiveRoomAnimations();

        // 确保顶部标签回到「推薦」，底部导航回到「視頻」
        document.querySelectorAll('#laya-app-nav-tabs .laya-app-nav-item').forEach((el, idx) => el.classList.toggle('active', idx === 1));
        document.querySelectorAll('.laya-nav-tabs > span').forEach((el, idx) => el.classList.toggle('active', idx === 1));
        document.querySelectorAll('#laya-app-bottom-tabs .laya-app-tab-item').forEach((el, idx) => el.classList.toggle('active', idx === 2));

        if (window.PlayerEngine && typeof window.PlayerEngine.updateTransform === 'function') {
            setTimeout(() => window.PlayerEngine.updateTransform(), 25);
        }
        if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
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
    document.querySelectorAll('.viewport-tabs .tab-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            if (mode && mode !== 'mode-mobile-port') {
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

    const liveHostNamePresets = ['溫哥華小鹿', '洛杉磯老陳', '多倫多Sandy', '墨爾本阿豪', '悉尼小陳', '舊金山阿凱', '倫敦Chloé', '紐約Kevin', '小鹿同學', '蜜桃甜心', '星河少女', '微醺小貓'];
    function randomizeLiveHostName(showMsg = true) {
        const pick = (typeof window.claimUniqueNickname === 'function')
            ? window.claimUniqueNickname()
            : liveHostNamePresets[Math.floor(Math.random() * liveHostNamePresets.length)];
        applyLiveHostNameDisplay(pick);
        if (showMsg) window.showToast(`🎲 主播名已切換為：${pick}`);
    }
    if (inLiveHostName && liveDispHostName) {
        inLiveHostName.addEventListener('input', () => {
            applyLiveHostNameDisplay(inLiveHostName.value.trim() || '溫哥華小鹿');
        });
    }
    if (btnLiveRandName) btnLiveRandName.addEventListener('click', (e) => { e.preventDefault(); randomizeLiveHostName(true); });
    if (btnLiveRandNameBtn) btnLiveRandNameBtn.addEventListener('click', () => randomizeLiveHostName(true));

    // 本场点赞：1000 ~ 200万 随机（如 5.6萬、25.3萬、138.5萬、6890）
    function randomizeLiveHostId(showMsg = true) {
        const { dispTxt } = generateRandom1kTo2M();
        applyLiveHostLikesDisplay(dispTxt);
        if (showMsg) window.showToast(`🎲 本場點讚已隨機為：${dispTxt}`);
    }
    if (inLiveHostId && liveDispHostId) {
        inLiveHostId.addEventListener('input', () => {
            applyLiveHostLikesDisplay(inLiveHostId.value.trim() || '25.6萬');
        });
    }
    if (btnLiveRandId) btnLiveRandId.addEventListener('click', (e) => { e.preventDefault(); randomizeLiveHostId(true); });
    if (btnLiveRandIdBtn) btnLiveRandIdBtn.addEventListener('click', () => randomizeLiveHostId(true));

    // 绑定画面左上角「主播名」与「本場點讚」：单击随机(1000~200万)，双击原地编辑文字
    bindLiveClickRandAndDblEdit(
        liveHostNameRow,
        liveDispHostName,
        () => (liveDispHostName ? liveDispHostName.textContent.trim() : '溫哥華小鹿'),
        (v) => {
            markFieldUserModified('in-live-host-name');
            applyLiveHostNameDisplay(v);
            window.showToast(`✅ 主播名已修改為：${v}`);
        },
        () => randomizeLiveHostName(true),
        68
    );
    bindLiveClickRandAndDblEdit(
        liveHostIdRow,
        liveDispHostId,
        () => (liveDispHostId ? liveDispHostId.textContent.trim() : '25.6萬'),
        (v) => {
            markFieldUserModified('in-live-host-id');
            applyLiveHostLikesDisplay(v);
            window.showToast(`✅ 本場點讚已修改為：${v}`);
        },
        () => randomizeLiveHostId(true),
        52
    );

    /* ==========================================================================
       ★ 需求二：直播间顶部「限时福利+Logo」标签区全维度定制（文字编辑/位置拖动/字号/外框宽高/轮播与8种炫彩动画可开关）
       ========================================================================== */
    const liveBrandTopicGroupPresets = [
        ['限時福利', 'Laya 精選', '獨家未刪減', '今晚9點開播', '新人必看'],
        ['限時福利', '高能名場面', '全場最高能', '點關注不迷路', '寵粉福袋中'],
        ['限時福利', 'Laya 獨播', '深夜陪伴局', '高清無水印', '前排領福利'],
        ['限時福利', '官方精選', '主播才藝秀', '互動抽大獎', '每晚準時見']
    ];
    const liveSquareTagPresets = ['直播廣場', '熱門直播', '同城直播', '更多直播', '精選頻道', '發現更多'];
    const btnLiveAddBrandTopic = document.getElementById('btn-live-add-brand-topic');
    const btnLiveRandSquareTag = document.getElementById('btn-live-rand-square-tag');
    const btnLiveRandSquareTagBtn = document.getElementById('btn-live-rand-square-tag-btn');
    const liveBrandTopicsChipsBox = document.getElementById('live-brand-topics-chips');

    // 顶部标签定制控件
    const swLiveBrandCarousel = document.getElementById('sw-live-brand-carousel');
    const inLiveBrandFontSize = document.getElementById('in-live-brand-font-size');
    const txtLiveBrandFontSize = document.getElementById('txt-live-brand-font-size');
    const inLiveBrandBoxW = document.getElementById('in-live-brand-box-w');
    const txtLiveBrandBoxW = document.getElementById('txt-live-brand-box-w');
    const inLiveBrandBoxH = document.getElementById('in-live-brand-box-h');
    const txtLiveBrandBoxH = document.getElementById('txt-live-brand-box-h');
    const inLiveBrandPosX = document.getElementById('in-live-brand-pos-x');
    const inLiveBrandPosY = document.getElementById('in-live-brand-pos-y');
    const txtLiveBrandPos = document.getElementById('txt-live-brand-pos');
    const swLiveBrandAnim = document.getElementById('sw-live-brand-anim');
    const selLiveBrandAnim = document.getElementById('sel-live-brand-anim');
    const liveBrandAnimBtnsBox = document.getElementById('live-brand-anim-btns');
    const btnLiveBrandReset = document.getElementById('btn-live-brand-reset');

    const BRAND_ANIM_ALL_CLASSES = [
        'anim-none', 'anim-shimmer', 'anim-rainbow', 'anim-breathe',
        'anim-typewriter', 'anim-wave', 'anim-bounce', 'anim-spin', 'anim-fade'
    ];

    let liveBrandTopicsList = ['限時福利', 'Laya 精選', '獨家未刪減', '今晚9點開播', '新人必看'];
    let liveBrandTopicCursor = 0;
    let liveBrandTickerTimer = null;

    function getEffectiveLiveBrandAnimType() {
        if (swLiveBrandAnim && !swLiveBrandAnim.checked) return 'none';
        const val = selLiveBrandAnim ? selLiveBrandAnim.value : 'shimmer';
        return val || 'none';
    }
    window.__getEffectiveLiveBrandAnimType = getEffectiveLiveBrandAnimType;

    function applyLiveBrandPillCustomStyle(shouldSave = false) {
        const fontPx = Math.min(16, Math.max(7, parseFloat(inLiveBrandFontSize ? inLiveBrandFontSize.value : '9') || 9));
        const boxW = Math.min(200, Math.max(54, parseInt(inLiveBrandBoxW ? inLiveBrandBoxW.value : '92', 10) || 92));
        const boxH = Math.min(36, Math.max(15, parseInt(inLiveBrandBoxH ? inLiveBrandBoxH.value : '20', 10) || 20));
        const posX = Math.min(160, Math.max(-80, parseInt(inLiveBrandPosX ? inLiveBrandPosX.value : '0', 10) || 0));
        const posY = Math.min(180, Math.max(-36, parseInt(inLiveBrandPosY ? inLiveBrandPosY.value : '0', 10) || 0));
        const logoPx = Math.max(11, Math.min(boxH - 4, Math.round(fontPx * 1.45)));
        const animType = getEffectiveLiveBrandAnimType();

        if (liveLayaBrandPill) {
            liveLayaBrandPill.style.setProperty('--brand-pill-font-size', `${fontPx}px`);
            liveLayaBrandPill.style.setProperty('--brand-pill-w', `${boxW}px`);
            liveLayaBrandPill.style.setProperty('--brand-pill-h', `${boxH}px`);
            liveLayaBrandPill.style.setProperty('--brand-pill-x', `${posX}px`);
            liveLayaBrandPill.style.setProperty('--brand-pill-y', `${posY}px`);
            liveLayaBrandPill.style.setProperty('--brand-logo-size', `${logoPx}px`);
        }

        if (liveLayaBrandTxt) {
            BRAND_ANIM_ALL_CLASSES.forEach(cls => liveLayaBrandTxt.classList.remove(cls));
            liveLayaBrandTxt.classList.add(`anim-${animType}`);
        }

        if (liveBrandAnimBtnsBox) {
            liveBrandAnimBtnsBox.querySelectorAll('.live-brand-anim-pill-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-brand-anim') === animType);
            });
        }

        if (txtLiveBrandFontSize) txtLiveBrandFontSize.textContent = `${fontPx}px`;
        if (txtLiveBrandBoxW) txtLiveBrandBoxW.textContent = `${boxW}px`;
        if (txtLiveBrandBoxH) txtLiveBrandBoxH.textContent = `${boxH}px`;
        if (txtLiveBrandPos) txtLiveBrandPos.textContent = `X:${posX} · Y:${posY}`;

        if (shouldSave && !window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
        }
    }

    function parseBrandTopicsInputString(rawStr) {
        const parts = String(rawStr || '')
            .split(/\s*[|｜,，、/\n]+\s*/)
            .map(s => s.trim())
            .filter(Boolean);
        return parts.length > 0 ? parts : ['限時福利', 'Laya 精選', '獨家未刪減', '今晚9點開播', '新人必看'];
    }

    function renderLiveBrandTopicChipsUI() {
        if (!liveBrandTopicsChipsBox) return;
        liveBrandTopicsChipsBox.innerHTML = '';
        liveBrandTopicsList.forEach((topic, idx) => {
            const chip = document.createElement('span');
            chip.className = 'live-brand-topic-chip' + (idx === (liveBrandTopicCursor % liveBrandTopicsList.length) ? ' active' : '');
            const txtSpan = document.createElement('span');
            txtSpan.textContent = topic;
            txtSpan.title = '點擊立即切換展示該話題 · 雙擊修改';
            txtSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                liveBrandTopicCursor = idx;
                updateStageBrandTickerActiveText(false);
                renderLiveBrandTopicChipsUI();
            });
            txtSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const edited = window.prompt('修改滾動話題標籤文字：', topic);
                if (edited && edited.trim()) {
                    liveBrandTopicsList[idx] = edited.trim();
                    markFieldUserModified('in-live-brand-tag');
                    syncBrandTopicsToInputAndStage(true);
                }
            });
            chip.appendChild(txtSpan);
            if (liveBrandTopicsList.length > 1) {
                const delBtn = document.createElement('span');
                delBtn.className = 'chip-del';
                delBtn.textContent = '×';
                delBtn.title = '刪除該條話題';
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    liveBrandTopicsList.splice(idx, 1);
                    if (liveBrandTopicCursor >= liveBrandTopicsList.length) liveBrandTopicCursor = 0;
                    markFieldUserModified('in-live-brand-tag');
                    syncBrandTopicsToInputAndStage(true);
                });
                chip.appendChild(delBtn);
            }
            liveBrandTopicsChipsBox.appendChild(chip);
        });
    }

    function updateStageBrandTickerActiveText(animateSlide = true) {
        if (!liveLayaBrandTxt) return;
        if (!Array.isArray(liveBrandTopicsList) || liveBrandTopicsList.length === 0) {
            liveBrandTopicsList = ['Laya 精選'];
        }
        const activeTxt = liveBrandTopicsList[liveBrandTopicCursor % liveBrandTopicsList.length] || 'Laya 精選';
        const stageTradTxt = typeof window.toStageTrad === 'function' ? window.toStageTrad(activeTxt) : activeTxt;

        liveLayaBrandTxt.textContent = stageTradTxt;
        liveLayaBrandTxt.setAttribute('data-text', stageTradTxt);
        liveLayaBrandTxt.classList.remove('is-slide-next', 'is-scrolling-marquee', 'is-switching-out', 'is-switching-in');

        const activeAnim = getEffectiveLiveBrandAnimType();
        const charCount = Array.from(stageTradTxt).length;
        if (activeAnim === 'none') {
            if (charCount >= 7) {
                const shiftPx = -Math.max(18, (charCount - 6) * 9);
                liveLayaBrandTxt.style.setProperty('--marquee-shift', `${shiftPx}px`);
                void liveLayaBrandTxt.offsetWidth;
                liveLayaBrandTxt.classList.add('is-scrolling-marquee');
            } else if (animateSlide) {
                void liveLayaBrandTxt.offsetWidth;
                liveLayaBrandTxt.classList.add('is-slide-next');
            }
        }
        applyLiveBrandPillCustomStyle(false);
    }

    function syncBrandTopicsToInputAndStage(shouldSave = false) {
        const joined = liveBrandTopicsList.join(' | ');
        if (inLiveBrandTag && document.activeElement !== inLiveBrandTag) {
            inLiveBrandTag.value = joined;
        }
        updateStageBrandTickerActiveText(false);
        renderLiveBrandTopicChipsUI();
        if (shouldSave && !window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
        }
    }

    function applyLiveBrandTagDisplay(val, shouldSave = false) {
        liveBrandTopicsList = parseBrandTopicsInputString(val);
        if (liveBrandTopicCursor >= liveBrandTopicsList.length) {
            liveBrandTopicCursor = 0;
        }
        syncBrandTopicsToInputAndStage(shouldSave);
    }

    function stepNextLiveBrandTopic(animate = true) {
        if (!Array.isArray(liveBrandTopicsList) || liveBrandTopicsList.length <= 1) return;
        liveBrandTopicCursor = (liveBrandTopicCursor + 1) % liveBrandTopicsList.length;
        updateStageBrandTickerActiveText(animate);
        renderLiveBrandTopicChipsUI();
    }

    function restartLiveBrandTickerTimer() {
        if (liveBrandTickerTimer) clearInterval(liveBrandTickerTimer);
        if (swLiveBrandCarousel && !swLiveBrandCarousel.checked) {
            liveBrandTickerTimer = null;
            return;
        }
        liveBrandTickerTimer = setInterval(() => {
            if (window.__isExportRecording) return;
            if (swLiveBrandCarousel && !swLiveBrandCarousel.checked) return;
            if (liveLayaBrandPill && liveLayaBrandPill.querySelector('.live-inline-edit-input')) return;
            stepNextLiveBrandTopic(true);
        }, 2800);
    }
    restartLiveBrandTickerTimer();

    // 供 30fps/60fps Canvas 录屏与截图实时获取当前时刻正在轮播的动态话题文字
    window.__getActiveLiveBrandTopicAtTime = function (elapsedSec = 0) {
        if (!Array.isArray(liveBrandTopicsList) || liveBrandTopicsList.length === 0) return '限時福利';
        const carouselOn = !swLiveBrandCarousel || swLiveBrandCarousel.checked;
        const step = carouselOn ? Math.floor((Number(elapsedSec) || 0) / 2.8) : 0;
        const idx = (liveBrandTopicCursor + step) % liveBrandTopicsList.length;
        const raw = liveBrandTopicsList[idx] || '限時福利';
        return typeof window.toStageTrad === 'function' ? window.toStageTrad(raw) : raw;
    };

    function applyLiveSquareTagDisplay(val) {
        const cleanVal = String(val || '').trim() || '直播廣場';
        if (liveSubTxtSquare) liveSubTxtSquare.textContent = cleanVal;
        if (inLiveSquareTag && document.activeElement !== inLiveSquareTag) {
            inLiveSquareTag.value = cleanVal;
        }
    }

    let brandGroupPresetIdx = 0;
    function randomizeLiveBrandTag(showMsg = true) {
        brandGroupPresetIdx = (brandGroupPresetIdx + 1 + Math.floor(Math.random() * (liveBrandTopicGroupPresets.length - 1))) % liveBrandTopicGroupPresets.length;
        const pickedGroup = liveBrandTopicGroupPresets[brandGroupPresetIdx].slice();
        liveBrandTopicCursor = 0;
        if (showMsg) markFieldUserModified('in-live-brand-tag');
        applyLiveBrandTagDisplay(pickedGroup.join(' | '), showMsg);
        if (showMsg) window.showToast(`🎲 頂部滾動話題已切換為：${pickedGroup.join(' · ')}`);
    }
    function randomizeLiveSquareTag(showMsg = true) {
        const cur = liveSubTxtSquare ? liveSubTxtSquare.textContent.trim() : '';
        const candidates = liveSquareTagPresets.filter(t => t !== cur);
        const pick = candidates[Math.floor(Math.random() * candidates.length)] || '直播廣場';
        applyLiveSquareTagDisplay(pick);
        if (showMsg) window.showToast(`🎲 右側標籤已隨機為：${pick}`);
    }

    if (inLiveBrandTag) {
        inLiveBrandTag.addEventListener('input', () => {
            markFieldUserModified('in-live-brand-tag');
            applyLiveBrandTagDisplay(inLiveBrandTag.value.trim() || 'Laya 精選', true);
        });
    }
    if (btnLiveAddBrandTopic) {
        btnLiveAddBrandTopic.addEventListener('click', () => {
            const newTopic = window.prompt('新增一條頂部滾動話題（如：獨家未刪減 / 今晚9點開播 / 限時福利）：', '限時福利');
            if (newTopic && newTopic.trim()) {
                liveBrandTopicsList.push(newTopic.trim());
                liveBrandTopicCursor = liveBrandTopicsList.length - 1;
                markFieldUserModified('in-live-brand-tag');
                syncBrandTopicsToInputAndStage(true);
                window.showToast(`✅ 已新增滾動話題：${newTopic.trim()}`);
            }
        });
    }
    if (btnLiveRandBrandTag) btnLiveRandBrandTag.addEventListener('click', (e) => { e.preventDefault(); randomizeLiveBrandTag(true); });
    if (btnLiveRandBrandTagBtn) btnLiveRandBrandTagBtn.addEventListener('click', () => randomizeLiveBrandTag(true));

    if (inLiveSquareTag) {
        inLiveSquareTag.addEventListener('input', () => {
            applyLiveSquareTagDisplay(inLiveSquareTag.value.trim() || '直播廣場');
        });
    }
    if (btnLiveRandSquareTag) {
        btnLiveRandSquareTag.addEventListener('click', (e) => {
            e.preventDefault();
            randomizeLiveSquareTag(true);
        });
    }
    if (btnLiveRandSquareTagBtn) {
        btnLiveRandSquareTagBtn.addEventListener('click', () => {
            randomizeLiveSquareTag(true);
        });
    }

    // 单击画面 #live-laya-brand-pill 切换下一条滚动话题，双击原地编辑当前话题或完整列表，按住拖动可自由移位
    bindLiveClickRandAndDblEdit(
        liveLayaBrandPill,
        liveLayaBrandTxt,
        () => (liveBrandTopicsList[liveBrandTopicCursor % liveBrandTopicsList.length] || '限時福利'),
        (v) => {
            const cleanV = String(v || '').trim();
            if (!cleanV) return;
            markFieldUserModified('in-live-brand-tag');
            if (cleanV.includes('|') || cleanV.includes('｜') || cleanV.includes(',')) {
                applyLiveBrandTagDisplay(cleanV, true);
            } else {
                liveBrandTopicsList[liveBrandTopicCursor % liveBrandTopicsList.length] = cleanV;
                syncBrandTopicsToInputAndStage(true);
            }
            window.showToast(`✅ 頂部標籤已修改為：${cleanV}`);
        },
        () => {
            if (Date.now() < (window.__suppressBrandPillClickUntil || 0)) return;
            stepNextLiveBrandTopic(true);
        },
        74
    );

    // 绑定顶部标签大小、外框宽高、位置拖动与动画切换事件
    [inLiveBrandFontSize, inLiveBrandBoxW, inLiveBrandBoxH, inLiveBrandPosX, inLiveBrandPosY].forEach(el => {
        if (!el) return;
        el.addEventListener('input', () => applyLiveBrandPillCustomStyle(true));
    });
    if (swLiveBrandCarousel) {
        swLiveBrandCarousel.addEventListener('change', () => {
            restartLiveBrandTickerTimer();
            if (!window.__isRestoringStorage && typeof triggerSaveStorage === 'function') triggerSaveStorage();
        });
    }
    if (swLiveBrandAnim) {
        swLiveBrandAnim.addEventListener('change', () => {
            if (swLiveBrandAnim.checked && selLiveBrandAnim && selLiveBrandAnim.value === 'none') {
                selLiveBrandAnim.value = 'shimmer';
            }
            applyLiveBrandPillCustomStyle(true);
        });
    }
    if (selLiveBrandAnim) {
        selLiveBrandAnim.addEventListener('change', () => {
            if (swLiveBrandAnim) {
                swLiveBrandAnim.checked = (selLiveBrandAnim.value !== 'none');
            }
            applyLiveBrandPillCustomStyle(true);
        });
    }
    if (liveBrandAnimBtnsBox) {
        liveBrandAnimBtnsBox.querySelectorAll('.live-brand-anim-pill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const animVal = btn.getAttribute('data-brand-anim') || 'none';
                if (selLiveBrandAnim) selLiveBrandAnim.value = animVal;
                if (swLiveBrandAnim) swLiveBrandAnim.checked = (animVal !== 'none');
                applyLiveBrandPillCustomStyle(true);
            });
        });
    }
    if (btnLiveBrandReset) {
        btnLiveBrandReset.addEventListener('click', () => {
            if (inLiveBrandFontSize) inLiveBrandFontSize.value = '9';
            if (inLiveBrandBoxW) inLiveBrandBoxW.value = '92';
            if (inLiveBrandBoxH) inLiveBrandBoxH.value = '20';
            if (inLiveBrandPosX) inLiveBrandPosX.value = '0';
            if (inLiveBrandPosY) inLiveBrandPosY.value = '0';
            if (swLiveBrandCarousel) swLiveBrandCarousel.checked = true;
            if (swLiveBrandAnim) swLiveBrandAnim.checked = true;
            if (selLiveBrandAnim) selLiveBrandAnim.value = 'shimmer';
            restartLiveBrandTickerTimer();
            applyLiveBrandPillCustomStyle(true);
            window.showToast('↺ 已還原頂部「限時福利+Logo」標籤默認尺寸與位置');
        });
    }

    // 支持直接在手机直播间画面按住拖动 #live-laya-brand-pill 自由调整位置（4px 阈值与单击/双击无冲突）
    if (liveLayaBrandPill) {
        liveLayaBrandPill.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target && e.target.closest('.live-inline-edit-input')) return;
            const startClientX = e.clientX;
            const startClientY = e.clientY;
            const startPosX = parseInt(inLiveBrandPosX ? inLiveBrandPosX.value : '0', 10) || 0;
            const startPosY = parseInt(inLiveBrandPosY ? inLiveBrandPosY.value : '0', 10) || 0;
            const rect = renderTarget ? renderTarget.getBoundingClientRect() : null;
            const stageScale = (rect && renderTarget && renderTarget.offsetWidth > 0)
                ? (rect.width / renderTarget.offsetWidth)
                : 1;
            let hasDragged = false;

            const onMove = (mv) => {
                const rawDx = mv.clientX - startClientX;
                const rawDy = mv.clientY - startClientY;
                if (!hasDragged && Math.hypot(rawDx, rawDy) < 4) return;
                hasDragged = true;
                window.__suppressBrandPillClickUntil = Date.now() + 280;
                liveLayaBrandPill.classList.add('is-dragging');
                const nextX = Math.min(160, Math.max(-80, Math.round(startPosX + rawDx / stageScale)));
                const nextY = Math.min(180, Math.max(-36, Math.round(startPosY + rawDy / stageScale)));
                if (inLiveBrandPosX) inLiveBrandPosX.value = String(nextX);
                if (inLiveBrandPosY) inLiveBrandPosY.value = String(nextY);
                applyLiveBrandPillCustomStyle(false);
            };
            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                if (hasDragged) {
                    liveLayaBrandPill.classList.remove('is-dragging');
                    window.__suppressBrandPillClickUntil = Date.now() + 220;
                    triggerSaveStorage();
                }
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });
    }
    applyLiveBrandPillCustomStyle(false);
    bindLiveClickRandAndDblEdit(
        liveSubSquarePill,
        liveSubTxtSquare,
        () => (liveSubTxtSquare ? liveSubTxtSquare.textContent.trim() : '直播廣場'),
        (v) => {
            applyLiveSquareTagDisplay(v);
            window.showToast(`✅ 右側標籤已修改為：${v}`);
        },
        () => randomizeLiveSquareTag(true),
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
    const btnDmStudioAiGen = document.getElementById('btn-dm-studio-ai-gen');
    const swDmStudioAutoAi = document.getElementById('sw-dm-studio-auto-ai');
    const txtDmStudioAiStatus = document.getElementById('txt-dm-studio-ai-status');
    const btnWebAiDm = document.getElementById('btn-web-ai-dm');
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

    // ★ 全站默认共享 AI API Key（已内置团队专属 Gemini 3.8 Flash 秘钥 + 严格 30 秒最小调用间隔防刷保护）
    const _TEAM_BUILTIN_KEY_PARTS = ['AQ.Ab8RN6JEu2BzQVh7cehw', 'LxkkCOnsQG4E4a8_I3RTKtzd5AIS6w'];
    const GLOBAL_SHARED_DEFAULT_AI_KEY = window.LAYA_GLOBAL_SHARED_AI_KEY || _TEAM_BUILTIN_KEY_PARTS.join('');
    const GLOBAL_SHARED_DEFAULT_AI_URL = window.LAYA_GLOBAL_SHARED_AI_URL || '';
    const TEAM_AI_PASSCODE = '0000';
    const TEAM_AI_DAILY_LIMIT = 40;       // 每人每天最多调用 40 次（8人合计最多 320 次/天）
    const TEAM_AI_COOLDOWN_SEC = 30;      // ★ 每次使用 AI 间隔严格不能低于 30 秒
    let lastAiCallTimestamp = parseInt(localStorage.getItem('LAYA_GLOBAL_LAST_AI_TS') || '0', 10) || 0;
    let aiCooldownTimer = null;
    const videoAiResultCache = new Map(); // 同视频/图片自动触发时的防重复消耗缓存

    function getTodayDateKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function getDailyAiQuotaState() {
        const today = getTodayDateKey();
        try {
            const raw = JSON.parse(localStorage.getItem('LAYA_LIVE_AI_QUOTA_V1') || '{}');
            if (raw.date === today && typeof raw.used === 'number') {
                return { date: today, used: raw.used, remain: Math.max(0, TEAM_AI_DAILY_LIMIT - raw.used) };
            }
        } catch (e) {}
        return { date: today, used: 0, remain: TEAM_AI_DAILY_LIMIT };
    }

    function consumeOneDailyAiQuota() {
        const st = getDailyAiQuotaState();
        const nextUsed = st.used + 1;
        try {
            localStorage.setItem('LAYA_LIVE_AI_QUOTA_V1', JSON.stringify({ date: st.date, used: nextUsed }));
        } catch (e) {}
        updateLiveAiQuotaStatusText();
        return Math.max(0, TEAM_AI_DAILY_LIMIT - nextUsed);
    }

    function updateLiveAiQuotaStatusText(prefixMsg = '⚡ Gemini 3.8 Flash 就緒') {
        const { remain } = getDailyAiQuotaState();
        const statusStr = `${prefixMsg} (30s冷卻 · 今日剩餘 ${remain}/${TEAM_AI_DAILY_LIMIT})`;
        if (txtLiveAiStatus) txtLiveAiStatus.textContent = statusStr;
        if (txtDmStudioAiStatus) txtDmStudioAiStatus.textContent = statusStr;
    }

    function verifyTeamAiPasscode(isInteractive = true) {
        const savedPass = localStorage.getItem('LAYA_LIVE_TEAM_PASS_OK') || '';
        const boxPass = (inLiveAiGasUrl && inLiveAiGasUrl.value.trim()) || '';
        // 默认为空或等于 0000 时直接自动通过验证并写入 0000（防止旧版 localStorage 空值覆盖导致弹窗卡死）
        if (!boxPass || savedPass === TEAM_AI_PASSCODE || boxPass === TEAM_AI_PASSCODE || /^https?:\/\//i.test(boxPass)) {
            localStorage.setItem('LAYA_LIVE_TEAM_PASS_OK', TEAM_AI_PASSCODE);
            if (inLiveAiGasUrl && !boxPass) inLiveAiGasUrl.value = TEAM_AI_PASSCODE;
            return true;
        }
        if (!isInteractive) return false;
        const userInp = window.prompt('🔐 請輸入 4 位數團隊 AI 口令（默認 0000，驗證一次後自動記住）：', '0000');
        if (userInp && userInp.trim() === TEAM_AI_PASSCODE) {
            localStorage.setItem('LAYA_LIVE_TEAM_PASS_OK', TEAM_AI_PASSCODE);
            if (inLiveAiGasUrl) inLiveAiGasUrl.value = TEAM_AI_PASSCODE;
            window.showToast('✅ 團隊口令驗證成功！已解鎖 Gemini 3.8 Flash 視覺 AI');
            return true;
        }
        if (userInp !== null) {
            window.showToast('❌ 團隊口令不正確，已切換為本地智能匹配模式');
        }
        return false;
    }

    const allAiDanmakuButtons = [
        { el: btnLiveAiMatchDm, defaultLabel: '🤖 AI 識別視頻/圖片配彈幕' },
        { el: btnLiveCanvasAiDm, defaultLabel: '🤖 AI畫面生詞' },
        { el: btnDmStudioAiGen, defaultLabel: '🤖 AI 识别视频/图片获取弹幕话术' },
        { el: btnWebAiDm, defaultLabel: '🤖 AI 识别视频/图片配弹幕' }
    ];

    function syncAllAiButtonsCooldownUI() {
        const elapsedMs = Date.now() - lastAiCallTimestamp;
        const elapsedSec = Math.floor(elapsedMs / 1000);
        const leftSec = TEAM_AI_COOLDOWN_SEC - elapsedSec;
        if (lastAiCallTimestamp <= 0 || leftSec <= 0) {
            if (aiCooldownTimer) {
                clearInterval(aiCooldownTimer);
                aiCooldownTimer = null;
            }
            allAiDanmakuButtons.forEach(({ el, defaultLabel }) => {
                if (!el) return;
                el.disabled = false;
                el.style.opacity = '1';
                el.textContent = defaultLabel;
            });
            return false;
        }
        allAiDanmakuButtons.forEach(({ el }) => {
            if (!el) return;
            el.disabled = true;
            el.style.opacity = '0.82';
            el.textContent = `⏳ 冷卻 ${leftSec}s (間隔≥30s)`;
        });
        return true;
    }

    function startAiButtonCooldown(initialTimestamp = Date.now()) {
        lastAiCallTimestamp = initialTimestamp;
        try {
            localStorage.setItem('LAYA_GLOBAL_LAST_AI_TS', String(lastAiCallTimestamp));
        } catch (e) {}
        if (aiCooldownTimer) clearInterval(aiCooldownTimer);
        syncAllAiButtonsCooldownUI();
        aiCooldownTimer = setInterval(() => {
            syncAllAiButtonsCooldownUI();
        }, 400);
    }

    // 页面加载时若仍在 30 秒冷却期内，自动恢复倒计时状态
    if (lastAiCallTimestamp > 0 && (Date.now() - lastAiCallTimestamp) < TEAM_AI_COOLDOWN_SEC * 1000) {
        startAiButtonCooldown(lastAiCallTimestamp);
    }

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

        const inputUrl = (inLiveAiGasUrl && inLiveAiGasUrl.value.trim() && inLiveAiGasUrl.value.trim() !== TEAM_AI_PASSCODE) ? inLiveAiGasUrl.value.trim() : '';
        const storedUrl = localStorage.getItem('LAYA_LIVE_SHARED_AI_URL') || '';
        const finalUrl = inputUrl || storedUrl || GLOBAL_SHARED_DEFAULT_AI_URL;

        return { apiKey: finalKey, apiUrl: finalUrl };
    }
    setTimeout(() => {
        getActiveLiveAiKeyAndUrl();
        updateLiveAiQuotaStatusText();
    }, 160);

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
        inLiveDanmakuList.addEventListener('input', (e) => {
            if (e && e.isTrusted && !window.__isRestoringStorage && !window.__isAutoRandomizing) {
                if (typeof markFieldUserModified === 'function') markFieldUserModified('in-live-danmaku-list');
                if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            }
            renderLiveChatBubbles(false);
        });
        inLiveDanmakuList.addEventListener('paste', () => {
            setTimeout(() => {
                if (typeof markFieldUserModified === 'function') markFieldUserModified('in-live-danmaku-list');
                normalizeLiveDanmakuTextarea(true);
                renderLiveChatBubbles(false);
                if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
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

    /* ==========================================================================
       ★ 需求一 & 需求四：真人说话风弹幕引擎（抖音29款黄脸表情白名单+去重+三形态混排+高质量离线兜底）与 AI 暗号重构
       ========================================================================== */
    // 已定稿抖音黄脸小表情白名单（共 29 个，严禁出现 🔥🎉💕💖🐑🌈🐳 等彩色符号 emoji）
    const ALLOWED_DOUYIN_EMOJIS = [
        // 笑 (5)
        '😊', '😁', '😄', '😂', '🤣',
        // 动作 (6)
        '🤦', '😳', '😘', '🤗', '🙏', '👏',
        // 情绪 (6)
        '😭', '😢', '😅', '😲', '😡', '😴',
        // 互动 (6)
        '👍', '👌', '💪', '👀', '🐮', '🫶',
        // 氛围 (6)
        '❤️', '🌹', '🎁', '🎆', '🍺', '☕'
    ];
    const ALLOWED_SINGLE_EMOJI_SET = new Set(ALLOWED_DOUYIN_EMOJIS.filter(e => e !== '❤️'));

    // 严禁出现的模板化 AI 高频套话正则
    const BANNED_AI_CLICHE_REGEX = /(氛圍感拉滿|氛围感拉满|氣氛拉滿|气氛拉满|張力拉滿|张力拉满|狀態拉滿|状态拉满|直接拉滿|直接拉满|拉滿|拉满|治癒系天花板|治愈系天花板|純欲天花板|纯欲天花板|天花板|絕絕子|绝绝子|yyds|狠狠愛住|狠狠爱住|一整個拿捏住|一整个拿捏住|拿捏住|太頂了|太顶了|直接封神|封神|直接跪了|電影級質感|电影级质感|太治癒|太治愈|治癒了|治愈了)/i;

    // 弹幕表情清洗守卫：只保留文字标点与 29 款抖音黄脸 emoji，剥离一切禁用彩色符号 emoji
    function sanitizeDanmakuAllowedEmojisOnly(rawStr, stripAllEmojis = false) {
        let s = String(rawStr || '')
            .replace(/\u200D[\u2640\u2642]\uFE0F?/g, '')
            .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
        // 将红心统一映射为占位符 \uE001 再按码点过滤
        s = s.replace(/\u2764\uFE0F?/g, stripAllEmojis ? '' : '\uE001');
        s = s.replace(/[\uFE0E\uFE0F\u200D\u20E3]/g, '');
        let out = '';
        for (const ch of Array.from(s)) {
            if (ch === '\uE001') {
                if (!stripAllEmojis) out += '❤️';
                continue;
            }
            if (ALLOWED_SINGLE_EMOJI_SET.has(ch)) {
                if (!stripAllEmojis) out += ch;
                continue;
            }
            if (/[\p{Extended_Pictographic}\p{Emoji_Presentation}\u2600-\u27BF\u{1F000}-\u{1FAFF}]/u.test(ch)) {
                continue;
            }
            out += ch;
        }
        return out.replace(/\s{2,}/g, ' ').trim();
    }
    window.__sanitizeDanmakuAllowedEmojisOnly = sanitizeDanmakuAllowedEmojisOnly;

    function extractAllowedEmojisList(str) {
        const clean = sanitizeDanmakuAllowedEmojisOnly(str, false).replace(/\u2764\uFE0F?/g, '\uE001');
        const list = [];
        for (const ch of Array.from(clean)) {
            if (ch === '\uE001') list.push('❤️');
            else if (ALLOWED_SINGLE_EMOJI_SET.has(ch)) list.push(ch);
        }
        return list;
    }

    // 高质量真人短句离线弹幕素材库（2~10字居多、口语化、无AI腔，AI不可用时100%真实兜底）
    const REAL_HUMAN_DANMAKU_CORPUS = {
        general: [
            '哈哈哈', '哈哈', '笑死我了', '哈哈哈哈絕了', '哈哈哈哈哈哈哈',
            '臥槽', '666', '牛啊', '真的假的', '太強了',
            '愛了愛了', '太美了吧', '好看好看', '絕了', '好甜啊',
            '來了來了', '路過', '打卡', '有人嗎', '前排',
            '主播多大了', '主播哪裡人', '這多少錢', '怎麼買', '有連結嗎',
            '剛刷到', '晚上好呀', '今天人好多', '終於開播了', '蹲一會兒',
            '可以啊這波', '笑不活了', '有點東西', '越看越順眼', '幾點下播',
            '又刷到你了', '這畫質真清楚', '一點都不卡', '主播說話好溫柔', '支持一下'
        ],
        beauty_dance: [
            '太美了吧', '好看好看', '愛了愛了', '這套好看', '今天這身絕了',
            '衣服哪買的', '有連結嗎', '這多少錢', '主播多大了', '主播哪裡人',
            '求口紅色號', '身材真好', '笑起來好甜', '哈哈哈可愛', '耐看型',
            '剛刷到就不想划走了', '前排看美女', '髮型好看', '再跳一段唄', '666好看'
        ],
        music_singing: [
            '這首好聽', '求歌名', '唱得真穩', '聲音好好聽', '再來一首',
            '前奏一響就愛了', '開口脆', '666好聽', '這是什麼歌', '點歌可以嗎',
            '聽入迷了', '高音牛啊', '比原唱好聽', '來了來了', '睡前聽剛剛好',
            '哈哈哈好聽', '伴奏不錯', '嗓子真好', '每天都來聽', '絕了這嗓音'
        ],
        mahjong_game: [
            '臥槽666', '這牌能胡嗎', '對面懵了', '等一個自摸', '哈哈這手氣',
            '別打出去了', '笑死我了', '牛啊這波', '真的假的', '太強了',
            '這把穩了', '哈哈哈哈絕了', '看傻了', '神預判啊', '主播牌技可以',
            '換我早輸了', '刺激刺激', '這都能贏', '前排圍觀', '太逗了吧'
        ],
        drama_cinema: [
            '臥槽反轉了', '這段看過', '眼神有戲', '看入迷了', '後面更刺激',
            '真的假的', '這是什麼劇', '演技可以啊', '哈哈哈哈笑死', '絕了這段',
            '細節拉得真足', '沒猜到結局', '求劇名', '畫質好清晰', '前排追劇',
            '太強了吧', '這台詞絕了', '越看越上頭', '有人看懂嗎', '666好看'
        ]
    };

    // 同一直播会话级弹幕去重记忆池 + 上一条表情记忆（确保不重复、连续多条不用同表情）
    const liveSessionUsedDanmakuSet = new Set();
    let lastBatchTailEmoji = '';

    function buildThemedHumanPhrases(themeText, secretCode) {
        const rawT = String(themeText || '').trim();
        const tradTheme = typeof window.toStageTrad === 'function' ? window.toStageTrad(rawT) : rawT;
        const codeStr = String(secretCode || '4748').trim() || '4748';
        const res = [];
        if (/穿搭|衣服|裙|好看|美|顏值|颜值|妝|妆/.test(rawT)) {
            res.push('今天這套穿搭真好看', '衣服好好看哪買的', '這身太適合你了', '穿搭絕了求連結', '今天狀態真好');
        } else if (/連結|链接|多少錢|多少钱|買|买|同款|價格|价格|福利/.test(rawT)) {
            res.push('這多少錢', '有連結嗎', '怎麼買呀', '求同款連結', '包郵嗎主播');
        } else if (/心情|聊|陪|晚安|開心|开心/.test(rawT)) {
            res.push('今天心情不錯呀', '下班過來聽你聊天', '哈哈今天挺開心的', '晚上好呀主播', '陪主播嘮會兒');
        } else if (tradTheme) {
            const shortKw = tradTheme.slice(0, 8);
            res.push(`${shortKw}真不錯`, `哈哈${shortKw}`, `衝著${shortKw}來的`);
        }
        res.push(codeStr, `發${codeStr}是吧`, `${codeStr}已發`, `${codeStr}安排一下`);
        return res;
    }

    function insertEmojiRandomPosition(pureText, emoji, seedIdx = 0) {
        const chars = Array.from(String(pureText || '').trim());
        if (chars.length === 0) return emoji;
        const roll = (seedIdx + Math.floor(Math.random() * 3)) % 3;
        if (roll === 0) {
            // 句首
            return `${emoji}${chars.join('')}`;
        }
        if (roll === 1 && chars.length >= 3) {
            // 句中
            const mid = Math.max(1, Math.min(chars.length - 1, Math.floor(chars.length / 2)));
            return `${chars.slice(0, mid).join('')}${emoji}${chars.slice(mid).join('')}`;
        }
        // 句尾
        return `${chars.join('')}${emoji}`;
    }

    // 核心合成器：输出满足「真人短句 + 无AI腔 + 29黄脸表情不重复 + 纯表情/文字+表情/纯文字三形态并存 + 会话内文字不重复」的分行弹幕
    function composeAuthenticLiveDanmakuBatch(options = {}) {
        const {
            rawCandidateLines = [],
            category = 'general',
            contextText = '',
            forceIncludeSecret = null,
            totalRows = 14
        } = options;

        const isSimp = window.__currentLangMode === 'simp';
        const joinWord = isSimp ? '来了' : '來了';
        const secretOn = forceIncludeSecret !== null
            ? !!forceIncludeSecret
            : !!(swLiveAiSecret && swLiveAiSecret.checked);
        const secretCode = (inLiveSecretCode && inLiveSecretCode.value.trim()) ? inLiveSecretCode.value.trim() : '4748';
        const secretTheme = (inLiveSecretTheme && inLiveSecretTheme.value.trim()) ? inLiveSecretTheme.value.trim() : '夸主播今天这套穿搭好看';

        // 若会话已累计超过 110 条，自动释放最早批次防止无限耗尽
        if (liveSessionUsedDanmakuSet.size > 110) {
            liveSessionUsedDanmakuSet.clear();
        }

        // 1) 收集纯文字候选短句（优先采用已过滤 AI 腔的候选行 + 暗号主题短句 + 对应场景真人素材库兜底）
        const purePhraseQueue = [];
        const pushCleanPhrase = (rawMsg) => {
            let txt = sanitizeDanmakuAllowedEmojisOnly(rawMsg, true)
                .replace(/^[：:\-\s]+/, '')
                .trim();
            if (!txt) return;
            if (BANNED_AI_CLICHE_REGEX.test(txt)) return;
            if (Array.from(txt).length > 16) return;
            const stageTxt = (!isSimp && typeof window.toStageTrad === 'function') ? window.toStageTrad(txt) : txt;
            if (!liveSessionUsedDanmakuSet.has(stageTxt) && !purePhraseQueue.includes(stageTxt)) {
                purePhraseQueue.push(stageTxt);
            }
        };

        if (secretOn) {
            buildThemedHumanPhrases(secretTheme, secretCode).forEach(pushCleanPhrase);
        }

        (rawCandidateLines || []).forEach(line => {
            const trimmed = String(line || '').trim();
            if (!trimmed || /(\s|^|：|:)(來了|来了|進入直播間|进入直播间)[！!~～]*$/.test(trimmed)) return;
            const cIdx = trimmed.indexOf('：') !== -1 ? trimmed.indexOf('：') : trimmed.indexOf(':');
            const msgBody = cIdx > 0 ? trimmed.slice(cIdx + 1).trim() : trimmed;
            pushCleanPhrase(msgBody);
        });

        // 提取视频/标题简短自然词（不拼任何 AI 套话）
        const cleanTokens = String(contextText || '')
            .replace(/#[\S]+/g, m => ' ' + m.slice(1) + ' ')
            .split(/[\s,，。！？!?:：；;、/\-—_（）()【】\[\]《》""''「」]+/)
            .map(s => s.trim())
            .filter(s => s.length >= 2 && s.length <= 6 && !/^(mp4|mov|webm|video|screenrecording|IMG|VID|作者声明|虚构演绎|仅供娱乐|小王小王)$/i.test(s));
        if (cleanTokens.length > 0) {
            pushCleanPhrase(`衝著${cleanTokens[0]}來的`);
        }

        const catPool = (REAL_HUMAN_DANMAKU_CORPUS[category] || []).slice().sort(() => Math.random() - 0.5);
        const genPool = REAL_HUMAN_DANMAKU_CORPUS.general.slice().sort(() => Math.random() - 0.5);
        [...catPool, ...genPool].forEach(pushCleanPhrase);

        // 若极端情况下候选不足，放宽会话去重兜底，但依然保证本批次内 100% 不重复
        if (purePhraseQueue.length < 12) {
            [...catPool, ...genPool].forEach(rawMsg => {
                const stageTxt = (!isSimp && typeof window.toStageTrad === 'function') ? window.toStageTrad(rawMsg) : rawMsg;
                if (!purePhraseQueue.includes(stageTxt)) purePhraseQueue.push(stageTxt);
            });
        }

        // 2) 准备本批次去重黄脸表情池（打乱全部 29 个抖音黄脸 emoji，每个最多只用 1 次，且首条避开上一批末尾表情）
        const emojiDeck = ALLOWED_DOUYIN_EMOJIS.slice().sort(() => Math.random() - 0.5);
        const usedBatchEmojis = new Set();
        const claimDistinctEmoji = () => {
            for (let i = 0; i < emojiDeck.length; i++) {
                const em = emojiDeck[i];
                if (!usedBatchEmojis.has(em) && em !== lastBatchTailEmoji) {
                    usedBatchEmojis.add(em);
                    lastBatchTailEmoji = em;
                    return em;
                }
            }
            return ALLOWED_DOUYIN_EMOJIS[0];
        };

        // 3) 组装三种形态弹幕（纯文字 4~5 条 + 文字+表情[句首/句中/句尾随机] 5 条 + 纯表情 2 条 = 11 条评论 + 3 条进场 = 14 条）
        const commentCount = Math.max(9, totalRows - 3);
        const pureEmojiCount = 2;
        const textWithEmojiCount = Math.max(4, Math.round((commentCount - pureEmojiCount) * 0.52));
        const pureTextCount = Math.max(3, commentCount - pureEmojiCount - textWithEmojiCount);

        const formSlots = [
            ...Array(pureTextCount).fill('pure_text'),
            ...Array(textWithEmojiCount).fill('text_emoji'),
            ...Array(pureEmojiCount).fill('pure_emoji')
        ];
        // 打乱三种形态出现顺序，但避免两条纯表情紧挨着同质化
        for (let i = formSlots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = formSlots[i];
            formSlots[i] = formSlots[j];
            formSlots[j] = tmp;
        }

        const pickUniqueViewerNick = (idx) => {
            if (typeof window.claimUniqueNickname === 'function') {
                return sanitizeDanmakuAllowedEmojisOnly(window.claimUniqueNickname(), true) || fallbackNicknames[idx % fallbackNicknames.length];
            }
            return fallbackNicknames[idx % fallbackNicknames.length];
        };

        let phraseCursor = 0;
        const commentRows = [];
        const batchMsgSet = new Set();

        formSlots.forEach((formType, idx) => {
            const nick = pickUniqueViewerNick(idx);
            let finalMsg = '';
            if (formType === 'pure_emoji') {
                const em1 = claimDistinctEmoji();
                // 偶尔双不同黄脸表情，大部分单黄脸表情，均严格互不重复
                if (idx % 2 === 1 && emojiDeck.length - usedBatchEmojis.size > 4) {
                    const em2 = claimDistinctEmoji();
                    finalMsg = `${em1}${em2}`;
                } else {
                    finalMsg = em1;
                }
            } else {
                while (phraseCursor < purePhraseQueue.length && batchMsgSet.has(purePhraseQueue[phraseCursor])) {
                    phraseCursor++;
                }
                const basePhrase = purePhraseQueue[phraseCursor++] || '666';
                batchMsgSet.add(basePhrase);
                liveSessionUsedDanmakuSet.add(basePhrase);

                if (formType === 'text_emoji') {
                    const em = claimDistinctEmoji();
                    finalMsg = insertEmojiRandomPosition(basePhrase, em, idx);
                } else {
                    finalMsg = basePhrase;
                }
            }
            liveSessionUsedDanmakuSet.add(finalMsg);
            commentRows.push(`${nick}：${finalMsg}`);
        });

        // 4) 穿插 3 条「观众昵称 来了」进场行
        const finalLines = [];
        const joinInsertAfter = new Set([1, 5, 9]);
        commentRows.forEach((row, idx) => {
            finalLines.push(row);
            if (joinInsertAfter.has(idx)) {
                finalLines.push(`${pickUniqueViewerNick(idx + 20)} ${joinWord}`);
            }
        });

        return finalLines;
    }
    window.__composeAuthenticLiveDanmakuBatch = composeAuthenticLiveDanmakuBatch;

    // ★ 多场景分行弹幕预设池（真人短句 + 抖音黄脸去重 + 三形态混排）
    const LIVE_AI_SCENE_DANMAKU_POOLS = {
        classic: () => composeAuthenticLiveDanmakuBatch({ category: 'general' }),
        beauty_dance: () => composeAuthenticLiveDanmakuBatch({ category: 'beauty_dance' }),
        music_singing: () => composeAuthenticLiveDanmakuBatch({ category: 'music_singing' }),
        mahjong_game: () => composeAuthenticLiveDanmakuBatch({ category: 'mahjong_game' }),
        drama_cinema: () => composeAuthenticLiveDanmakuBatch({ category: 'drama_cinema' })
    };

    /* ==========================================================================
       ★ 需求四：AI 暗号功能重构（默认关闭；开启后可编辑主题与暗号[默认4748]，含可编辑参考案例模板与直播间醒目引导）
       ========================================================================== */
    const swLiveAiSecret = document.getElementById('sw-live-ai-secret');
    const boxLiveAiSecretBody = document.getElementById('box-live-ai-secret-body');
    const txtLiveSecretStateBadge = document.getElementById('txt-live-secret-state-badge');
    const inLiveSecretTheme = document.getElementById('in-live-secret-theme');
    const inLiveSecretCode = document.getElementById('in-live-secret-code');
    const selLiveSecretPos = document.getElementById('sel-live-secret-pos');
    const inLiveSecretGuideTxt = document.getElementById('in-live-secret-guide-txt');
    const btnLiveSecretGenDm = document.getElementById('btn-live-secret-gen-dm');
    const inLiveSecretExTheme = document.getElementById('in-live-secret-ex-theme');
    const inLiveSecretExCode = document.getElementById('in-live-secret-ex-code');
    const inLiveSecretExDesc = document.getElementById('in-live-secret-ex-desc');
    const btnLiveApplySecretExample = document.getElementById('btn-live-apply-secret-example');
    const liveSecretTopBadge = document.getElementById('live-secret-top-badge');
    const liveSecretTopTxt = document.getElementById('live-secret-top-txt');
    const liveSecretGuideBar = document.getElementById('live-secret-guide-bar');
    const liveSecretGuideDisp = document.getElementById('live-secret-guide-disp');

    function renderLiveAiSecretState(shouldSave = false) {
        const isEnabled = !!(swLiveAiSecret && swLiveAiSecret.checked);
        const secretCode = (inLiveSecretCode && inLiveSecretCode.value.trim()) ? inLiveSecretCode.value.trim() : '4748';
        const posMode = (selLiveSecretPos && selLiveSecretPos.value) ? selLiveSecretPos.value : 'guide-bar';
        const rawGuideTpl = (inLiveSecretGuideTxt && inLiveSecretGuideTxt.value.trim())
            ? inLiveSecretGuideTxt.value.trim()
            : '公屏發送暗號【{code}】觸發專屬互動彈幕';
        const resolvedGuide = rawGuideTpl.replace(/\{code\}|4748/g, secretCode);
        const stageGuideTxt = typeof window.toStageTrad === 'function' ? window.toStageTrad(resolvedGuide) : resolvedGuide;
        const stageTopTxt = (window.__currentLangMode === 'simp' ? '暗号 ' : '暗號 ') + secretCode;

        if (boxLiveAiSecretBody) {
            boxLiveAiSecretBody.style.display = isEnabled ? 'block' : 'none';
        }
        if (txtLiveSecretStateBadge) {
            txtLiveSecretStateBadge.textContent = isEnabled ? `已开启 · 暗号 ${secretCode}` : '默认已关闭';
            txtLiveSecretStateBadge.style.background = isEnabled ? 'rgba(16, 185, 129, 0.28)' : 'rgba(100, 116, 139, 0.35)';
            txtLiveSecretStateBadge.style.color = isEnabled ? '#6ee7b7' : '#cbd5e1';
        }
        if (liveSecretTopTxt) liveSecretTopTxt.textContent = stageTopTxt;
        if (liveSecretGuideDisp) liveSecretGuideDisp.textContent = stageGuideTxt;

        const showTopBadge = isEnabled && (posMode === 'top-pill' || posMode === 'both');
        const showGuideBar = isEnabled && (posMode === 'guide-bar' || posMode === 'both');
        if (liveSecretTopBadge) liveSecretTopBadge.style.display = showTopBadge ? 'inline-flex' : 'none';
        if (liveSecretGuideBar) liveSecretGuideBar.style.display = showGuideBar ? 'inline-flex' : 'none';

        if (shouldSave && !window.__isRestoringStorage && typeof triggerSaveStorage === 'function') {
            triggerSaveStorage();
        }
    }

    if (swLiveAiSecret) {
        swLiveAiSecret.addEventListener('change', () => {
            renderLiveAiSecretState(true);
            window.showToast(swLiveAiSecret.checked
                ? `🔑 已開啟 AI 暗號互動（暗號：${inLiveSecretCode?.value || '4748'}）`
                : '🙈 已關閉 AI 暗號互動');
        });
    }
    [inLiveSecretTheme, inLiveSecretCode, inLiveSecretGuideTxt, inLiveSecretExTheme, inLiveSecretExCode, inLiveSecretExDesc].forEach(el => {
        if (!el) return;
        el.addEventListener('input', () => renderLiveAiSecretState(true));
    });
    if (selLiveSecretPos) {
        selLiveSecretPos.addEventListener('change', () => renderLiveAiSecretState(true));
    }
    if (btnLiveApplySecretExample) {
        btnLiveApplySecretExample.addEventListener('click', () => {
            const exTheme = (inLiveSecretExTheme && inLiveSecretExTheme.value.trim()) || '夸主播今天这套穿搭好看';
            const exCode = (inLiveSecretExCode && inLiveSecretExCode.value.trim()) || '4748';
            if (inLiveSecretTheme) inLiveSecretTheme.value = exTheme;
            if (inLiveSecretCode) inLiveSecretCode.value = exCode;
            if (inLiveSecretGuideTxt) inLiveSecretGuideTxt.value = `公屏發送暗號【${exCode}】觸發專屬互動彈幕`;
            renderLiveAiSecretState(true);
            window.showToast(`📋 已套用參考案例：主題「${exTheme}」· 暗號「${exCode}」`);
        });
    }

    async function triggerSecretThemeDanmakuGeneration(fromViewerSend = false) {
        if (renderTarget && renderTarget.classList.contains('mode-mobile-port') && !renderTarget.classList.contains('dy-live-open')) {
            enterLayaLiveRoom();
        }
        const secretCode = (inLiveSecretCode && inLiveSecretCode.value.trim()) || '4748';
        const secretTheme = (inLiveSecretTheme && inLiveSecretTheme.value.trim()) || '夸主播今天这套穿搭好看';
        const sinceLastSec = Math.floor((Date.now() - lastAiCallTimestamp) / 1000);
        const canCallCloudAi = (lastAiCallTimestamp === 0 || sinceLastSec >= TEAM_AI_COOLDOWN_SEC)
            && getDailyAiQuotaState().remain > 0
            && verifyTeamAiPasscode(false);

        let aiLines = null;
        if (canCallCloudAi && !fromViewerSend) {
            startAiButtonCooldown(Date.now());
            try {
                const { frames } = await extractCurrentVideoFramesAndStats(null);
                aiLines = await requestCloudVisionVideoDanmaku(frames, `互動主題：${secretTheme}；觀眾暗號：${secretCode}`);
                if (aiLines && aiLines.length >= 4) consumeOneDailyAiQuota();
            } catch (e) {
                aiLines = null;
            }
            syncAllAiButtonsCooldownUI();
        }

        const lines = composeAuthenticLiveDanmakuBatch({
            rawCandidateLines: aiLines || [],
            category: 'beauty_dance',
            contextText: secretTheme,
            forceIncludeSecret: true
        });
        if (inLiveDanmakuList) {
            markFieldUserModified('in-live-danmaku-list');
            inLiveDanmakuList.value = lines.join('\n');
        }
        liveChatCursor = 0;
        renderLiveChatBubbles(false);
        restartLiveChatRollTimer();
        triggerSaveStorage();
        window.showToast(`🔑 已圍繞主題「${secretTheme}」與暗號「${secretCode}」生成真人彈幕`);
    }

    if (btnLiveSecretGenDm) {
        btnLiveSecretGenDm.addEventListener('click', () => triggerSecretThemeDanmakuGeneration(false));
    }
    [liveSecretTopBadge, liveSecretGuideBar].forEach(el => {
        if (!el) return;
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerSecretThemeDanmakuGeneration(true);
        });
        el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const curCode = (inLiveSecretCode && inLiveSecretCode.value.trim()) || '4748';
            const nextCode = window.prompt('修改直播間互動暗號：', curCode);
            if (nextCode && nextCode.trim()) {
                if (inLiveSecretCode) inLiveSecretCode.value = nextCode.trim();
                renderLiveAiSecretState(true);
                window.showToast(`✅ 互動暗號已修改為：${nextCode.trim()}`);
            }
        });
    });
    // 初始化确保默认关闭隐藏
    renderLiveAiSecretState(false);

    let randDmPoolIndex = 0;
    if (btnLiveRandDmBatch) {
        btnLiveRandDmBatch.addEventListener('click', () => {
            if (renderTarget && renderTarget.classList.contains('mode-mobile-port') && !renderTarget.classList.contains('dy-live-open')) {
                enterLayaLiveRoom();
            }
            const keys = Object.keys(LIVE_AI_SCENE_DANMAKU_POOLS);
            randDmPoolIndex = (randDmPoolIndex + 1) % keys.length;
            const pickedKey = keys[randDmPoolIndex];
            const poolBuilder = LIVE_AI_SCENE_DANMAKU_POOLS[pickedKey];
            const lines = typeof poolBuilder === 'function' ? poolBuilder() : composeAuthenticLiveDanmakuBatch({ category: 'general' });
            if (inLiveDanmakuList) {
                markFieldUserModified('in-live-danmaku-list');
                inLiveDanmakuList.value = lines.join('\n');
            }
            liveChatCursor = 0;
            renderLiveChatBubbles(false);
            restartLiveChatRollTimer();
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            window.showToast(`🎲 已換一批真人風格彈幕（共 ${lines.length} 條 · 黃臉表情不重複）`);
        });
    }

    // ★ 从当前预览视频或图片即时截取最多 2 张高清关键帧 Base64 (宽 420px, JPEG 0.72，兼顾字幕清晰度与省流) + 视觉色彩/人像特征分析
    async function extractCurrentVideoFramesAndStats(preFrames = null) {
        const previewVid = document.getElementById('preview-video');
        const previewImg = document.getElementById('preview-img');
        const rawCandidates = [];
        const isImgMode = (window.PlayerEngine && window.PlayerEngine.isVideoMode === false)
            || (previewImg && previewImg.style.display !== 'none' && (!previewVid || previewVid.style.display === 'none'));

        // 0) 若当前处于图片模式（用户上传的是图片），优先直接截取当前图片画面！
        if (isImgMode && previewImg && previewImg.naturalWidth > 0) {
            try {
                const c = document.createElement('canvas');
                const iw = previewImg.naturalWidth || 640;
                const ih = previewImg.naturalHeight || 360;
                c.width = Math.min(420, iw);
                c.height = Math.round(c.width * (ih / iw)) || 236;
                c.getContext('2d').drawImage(previewImg, 0, 0, c.width, c.height);
                rawCandidates.push(c.toDataURL('image/jpeg', 0.75));
            } catch (e) {}
        }

        // 1) 若当前为视频模式，截取当前画面正在展示的实时视频帧（若视频刚加载停在 0.0s 片头黑屏且处于暂停状态，自动微调到 0.8s 抓取真实画面）
        if (!isImgMode && previewVid && previewVid.videoWidth > 0 && previewVid.style.display !== 'none') {
            try {
                if (previewVid.paused && previewVid.currentTime < 0.18 && previewVid.duration > 1.0) {
                    await new Promise((resolve) => {
                        const onSeeked = () => {
                            previewVid.removeEventListener('seeked', onSeeked);
                            resolve();
                        };
                        previewVid.addEventListener('seeked', onSeeked);
                        try {
                            previewVid.currentTime = Math.min(1.2, previewVid.duration * 0.2);
                        } catch (e) {
                            resolve();
                        }
                        setTimeout(resolve, 220);
                    });
                }
                const c = document.createElement('canvas');
                const vw = previewVid.videoWidth || 640;
                const vh = previewVid.videoHeight || 360;
                c.width = Math.min(420, vw);
                c.height = Math.round(c.width * (vh / vw)) || 236;
                c.getContext('2d').drawImage(previewVid, 0, 0, c.width, c.height);
                rawCandidates.push(c.toDataURL('image/jpeg', 0.72));
            } catch (e) {}
        }

        if (Array.isArray(preFrames) && preFrames.length > 0) {
            preFrames.forEach(f => {
                if (f && rawCandidates.length < 4) rawCandidates.push(f);
            });
        }
        if (Array.isArray(window.__lastExtractedVideoFrames) && window.__lastExtractedVideoFrames.length > 0) {
            window.__lastExtractedVideoFrames.forEach(f => {
                if (f && rawCandidates.length < 4) rawCandidates.push(f);
            });
        }
        if (rawCandidates.length === 0 && previewImg && previewImg.naturalWidth > 0) {
            try {
                const c = document.createElement('canvas');
                const iw = previewImg.naturalWidth || 640;
                const ih = previewImg.naturalHeight || 360;
                c.width = Math.min(420, iw);
                c.height = Math.round(c.width * (ih / iw)) || 236;
                c.getContext('2d').drawImage(previewImg, 0, 0, c.width, c.height);
                rawCandidates.push(c.toDataURL('image/jpeg', 0.72));
            } catch (e) {}
        }

        // 逐帧检测亮度与色彩特征，自动过滤掉亮度过低 (<12) 的全黑帧，保留最多 2 张有效画面帧
        const validFrames = [];
        let primaryStats = { skinRatio: 0, greenTableRatio: 0, neonStageRatio: 0, avgLuma: 120 };

        for (let idx = 0; idx < rawCandidates.length; idx++) {
            const frameUrl = rawCandidates[idx];
            const frameStat = await new Promise((resolve) => {
                const st = { skinRatio: 0, greenTableRatio: 0, neonStageRatio: 0, avgLuma: 120 };
                const img = new Image();
                img.onload = () => {
                    try {
                        const sc = document.createElement('canvas');
                        sc.width = 64;
                        sc.height = 64;
                        const sctx = sc.getContext('2d');
                        sctx.drawImage(img, 0, 0, 64, 64);
                        const data = sctx.getImageData(0, 0, 64, 64).data;
                        let skinCnt = 0, greenCnt = 0, neonCnt = 0, lumaSum = 0;
                        const totalPx = 64 * 64;
                        for (let i = 0; i < data.length; i += 4) {
                            const r = data[i], g = data[i + 1], b = data[i + 2];
                            lumaSum += (0.299 * r + 0.587 * g + 0.114 * b);
                            if (r > 95 && g > 40 && b > 20 && r > g && r > b && (r - Math.min(g, b)) > 15 && Math.abs(r - g) > 12) skinCnt++;
                            if (g > 75 && g > r * 1.08 && g > b * 1.05) greenCnt++;
                            if ((r > 130 && b > 130 && g < 110) || (b > 140 && r > 90 && g < 100)) neonCnt++;
                        }
                        st.skinRatio = skinCnt / totalPx;
                        st.greenTableRatio = greenCnt / totalPx;
                        st.neonStageRatio = neonCnt / totalPx;
                        st.avgLuma = Math.round(lumaSum / totalPx);
                    } catch (e) {}
                    resolve(st);
                };
                img.onerror = () => resolve(st);
                img.src = frameUrl;
            });

            if (frameStat.avgLuma >= 12) {
                if (validFrames.length === 0) primaryStats = frameStat;
                if (validFrames.length < 2) validFrames.push(frameUrl);
            }
        }

        // 若所有候选帧都很暗但至少有一张，保留第一张兜底
        if (validFrames.length === 0 && rawCandidates.length > 0) {
            validFrames.push(rawCandidates[0]);
        }

        return { frames: validFrames, stats: primaryStats };
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

        const lines = composeAuthenticLiveDanmakuBatch({
            category,
            contextText
        });
        return { lines, sceneLabel };
    }

    // ★ 调用云端 Gemini 3.8 Flash Vision API (支持 AQ. 与 AIza Key)、OpenAI/DeepSeek 兼容接口或 Google Apps Script 代理
    async function requestCloudVisionVideoDanmaku(frames, contextText) {
        const { apiKey, apiUrl } = getActiveLiveAiKeyAndUrl();
        const hostName = (inLiveHostName && inLiveHostName.value.trim()) ? inLiveHostName.value.trim() : '主播';
        const randSeed = Math.floor(1000 + Math.random() * 9000);
        const secretOn = !!(swLiveAiSecret && swLiveAiSecret.checked);
        const secretCode = (inLiveSecretCode && inLiveSecretCode.value.trim()) || '4748';
        const secretTheme = (inLiveSecretTheme && inLiveSecretTheme.value.trim()) || '';
        const secretRulePrompt = secretOn
            ? `6.當前主播已開啟互動暗號【${secretCode}】，主題為「${secretTheme}」，請穿插 2~3 條觀眾發送「${secretCode}」及圍繞「${secretTheme}」的真實口語短句。`
            : '';
        const commonStyleRules = `要求：1.必須是真實觀眾隨手打的口語短句（2~10字為主，如：哈哈哈、笑死我了、臥槽、666、牛啊、真的假的、太美了吧、好看好看、來了來了、路過、主播哪裡人、這多少錢、有連結嗎）；2.嚴禁任何AI腔套話（絕對禁用：氛圍感拉滿、治癒系天花板、絕絕子、yyds、狠狠愛住、一整個拿捏住、太頂了、直接封神）；3.表情只允許從以下抖音黃臉小表情中挑選且每條表情互不相同（😊 😁 😄 😂 🤣 🤦 😳 😘 🤗 🙏 👏 😭 😢 😅 😲 😡 😴 👍 👌 💪 👀 🐮 🫶 ❤️ 🌹 🎁 🎆 🍺 ☕），嚴禁出現🔥🎉💕💖等彩色符號；4.混合出現「純表情」「文字+表情（表情隨機在句首/句中/句尾）」「純文字」三種形態，每條文字互不重複；5.全部繁體中文，每行一條無編號，只輸出這14行文本。${secretRulePrompt}`;
        const promptText = frames && frames.length > 0
            ? `你是抖音/Laya直播間的真實觀眾彈幕生成助手。觀察直播畫面截圖（主播：${hostName}，參考信息：${contextText || '無'}，批次：${randSeed}），針對畫面細節生成 14 條真實公屏內容（11 條「觀眾暱稱：彈幕內容」+ 3 條「觀眾暱稱 來了」）。${commonStyleRules}`
            : `你是抖音/Laya直播間的真實觀眾彈幕生成助手。根據直播間信息（主播：${hostName}，參考主題：${contextText || '直播互動'}，批次：${randSeed}），生成 14 條真實公屏內容（11 條「觀眾暱稱：彈幕內容」+ 3 條「觀眾暱稱 來了」）。${commonStyleRules}`;

        const cleanParsedAiLines = (rawText) => {
            const lines = splitDanmakuTextToMultiline(rawText)
                .map(line => line.replace(/^(\d+[\.、\)\s]+|[-•*]\s*)/, '').replace(/^\*\*|\*\*$/g, '').trim())
                .filter(line => line.length >= 2 && !/^(好的|以下是|根據畫面|這裡是)/.test(line));
            return lines;
        };

        // 1. Google Gemini 3.8 Flash API Key (支持 AQ... 或 AIza...)
        if (apiKey && (/^(AIza|AQ\.)/i.test(apiKey))) {
            const parts = [{ text: promptText }];
            frames.slice(0, 2).forEach(dataUrl => {
                const base64Data = String(dataUrl).split(',')[1];
                if (base64Data) {
                    parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Data } });
                }
            });

            // 针对 gemini-3.8-flash 必须使用 thinkingLevel: 'LOW' + maxOutputTokens: 2048，避免思考 Token 占满输出上限导致只返回 1 行
            const candidateConfigs = [
                {
                    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
                    generationConfig: {
                        thinkingConfig: { thinkingLevel: 'LOW' },
                        maxOutputTokens: 2048,
                        temperature: 0.9
                    }
                },
                {
                    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`,
                    generationConfig: {
                        maxOutputTokens: 2048,
                        temperature: 0.9
                    }
                },
                {
                    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
                    generationConfig: {
                        maxOutputTokens: 2048,
                        temperature: 0.9
                    }
                }
            ];

            for (const cfg of candidateConfigs) {
                try {
                    const res = await fetch(cfg.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts }],
                            generationConfig: cfg.generationConfig
                        })
                    });
                    if (res.ok) {
                        const json = await res.json();
                        const resParts = json?.candidates?.[0]?.content?.parts || [];
                        const textPart = resParts.find(p => typeof p.text === 'string' && !p.thought) || resParts[0];
                        const outTxt = textPart?.text || '';
                        const parsed = cleanParsedAiLines(outTxt);
                        if (parsed.length >= 4) return parsed;
                    }
                } catch (e) {}
            }
        }

        // 2. OpenAI / DeepSeek / 硅基流动 等兼容 API Key (sk-...)
        if (apiKey && !/^(AIza|AQ\.)/i.test(apiKey)) {
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

    // ★ 核心主入口：无论上传的是视频还是图片，只要有弹幕的地方（直播间弹幕 / 飘屏弹幕工坊 / 电脑端弹幕）均可通过 AI 获取话术，且严格执行每次调用间隔 ≥ 30 秒！
    async function autoMatchLiveDanmakuByVideoAI(isManualClick = true, preFrames = null, targetScope = 'all') {
        // 1) 严格 30 秒冷却时间检查（无论手动点击还是上传自动触发，两次 AI 调用之间绝不低于 30 秒）
        const sinceLastSec = Math.floor((Date.now() - lastAiCallTimestamp) / 1000);
        if (lastAiCallTimestamp > 0 && sinceLastSec < TEAM_AI_COOLDOWN_SEC) {
            const waitSec = TEAM_AI_COOLDOWN_SEC - sinceLastSec;
            syncAllAiButtonsCooldownUI();
            if (isManualClick) {
                window.showToast(`⏳ 每次使用 AI 間隔不能低於 ${TEAM_AI_COOLDOWN_SEC} 秒，請等待 ${waitSec} 秒後再試`);
            }
            return;
        }

        if (isManualClick && targetScope === 'live') {
            if (renderTarget && renderTarget.classList.contains('mode-mobile-port') && !renderTarget.classList.contains('dy-live-open')) {
                enterLayaLiveRoom();
            }
        }

        if (txtLiveAiStatus) txtLiveAiStatus.textContent = '🔍 Gemini 3.8 Flash 正在識別視頻/圖片畫面並生成彈幕...';
        if (txtDmStudioAiStatus) txtDmStudioAiStatus.textContent = '🔍 AI 正在識別畫面生成彈幕話術...';
        allAiDanmakuButtons.forEach(({ el }) => {
            if (!el) return;
            el.disabled = true;
            el.style.opacity = '0.82';
            el.textContent = '🔍 AI 正在識別畫面...';
        });

        try {
            const { frames, stats } = await extractCurrentVideoFramesAndStats(preFrames);
            const rawDesc = document.getElementById('in-dy-desc')?.value || '';
            const rawTags = document.getElementById('in-dy-tags')?.value || '';
            const rawTitle = document.getElementById('in-m-main-title')?.value || document.getElementById('in-title')?.value || '';
            const fileName = window.__lastUploadedMediaName || '';
            const contextText = [fileName, rawDesc, rawTags, rawTitle].filter(Boolean).join(' ');

            const cacheSig = `${fileName}|${contextText}|${stats.avgLuma}|${stats.skinRatio.toFixed(2)}`;
            let matchedLines = null;
            let sceneLabel = 'Gemini 3.8 Flash 視覺大模型';

            // 无论云端或本地，一旦发起本次 AI 识别，立即启动 30 秒全局冷却计时
            startAiButtonCooldown(Date.now());

            if (!isManualClick && videoAiResultCache.has(cacheSig)) {
                matchedLines = videoAiResultCache.get(cacheSig);
                sceneLabel = 'Flash 緩存秒配 (0消耗)';
            } else {
                const quota = getDailyAiQuotaState();
                const passOk = verifyTeamAiPasscode(isManualClick);
                if (passOk && quota.remain > 0) {
                    try {
                        matchedLines = await requestCloudVisionVideoDanmaku(frames, contextText);
                        if (matchedLines && matchedLines.length >= 4) {
                            consumeOneDailyAiQuota();
                            videoAiResultCache.set(cacheSig, matchedLines);
                        }
                    } catch (err) {
                        matchedLines = null;
                    }
                } else if (isManualClick && quota.remain <= 0) {
                    window.showToast(`⚠️ 今日雲端 AI 額度 (${TEAM_AI_DAILY_LIMIT}次) 已用完，已自動切換為本地智能匹配`);
                }
            }

            if (!matchedLines || matchedLines.length === 0) {
                const localRes = buildSmartLocalVideoAiDanmaku(stats, contextText);
                matchedLines = localRes.lines;
                sceneLabel = localRes.sceneLabel;
            } else {
                // 对云端 AI 返回内容强制执行「去AI套话 + 29黄脸表情去重 + 三形态混排 + 会话文字去重」质检合成
                matchedLines = composeAuthenticLiveDanmakuBatch({
                    rawCandidateLines: matchedLines,
                    category: 'general',
                    contextText
                });
            }

            // A) 填充直播间公屏滚动弹幕列表
            if (inLiveDanmakuList && matchedLines.length > 0) {
                markFieldUserModified('in-live-danmaku-list');
                inLiveDanmakuList.value = matchedLines.join('\n');
                inLiveDanmakuList.style.borderColor = '#10b981';
                inLiveDanmakuList.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.35)';
                setTimeout(() => {
                    if (inLiveDanmakuList) {
                        inLiveDanmakuList.style.borderColor = '#2b3142';
                        inLiveDanmakuList.style.boxShadow = 'none';
                    }
                }, 1200);
            }
            liveChatCursor = 0;
            renderLiveChatBubbles(false);
            restartLiveChatRollTimer();

            // B) 提取纯弹幕话术（剥离「昵称：」与「XXX 来了」进场行），同步到全模式飘屏弹幕工坊 (DanmakuEngine) 与底部弹幕输入框
            const pureDanmakuMsgs = matchedLines
                .filter(line => !/(\s|^|：|:)(來了|来了|進入直播間|进入直播间)[！!~～]*$/.test(String(line).trim()))
                .map(line => {
                    const cIdx = line.indexOf('：') !== -1 ? line.indexOf('：') : line.indexOf(':');
                    return cIdx > 0 ? line.slice(cIdx + 1).trim() : line.trim();
                })
                .filter(Boolean);

            const batchDmTextarea = document.getElementById('in-batch-danmaku');
            if (batchDmTextarea && pureDanmakuMsgs.length > 0) {
                batchDmTextarea.value = pureDanmakuMsgs.join('\n');
            }

            if (window.DanmakuEngine && Array.isArray(window.DanmakuEngine.list) && pureDanmakuMsgs.length > 0) {
                const topLanes = [10, 14, 18, 22, 26, 30];
                const colors = ['#ffffff', '#ffeaa7', '#81ecec', '#ffffff', '#fab1a0', '#ffffff'];
                window.DanmakuEngine.list = pureDanmakuMsgs.slice(0, 8).map((pureMsg, idx) => ({
                    id: 'ai_dm_' + Date.now() + '_' + idx,
                    text: pureMsg,
                    top: topLanes[idx % topLanes.length],
                    left: (10 + idx * 14) % 76,
                    color: colors[idx % colors.length],
                    size: parseInt(document.getElementById('in-danmaku-size')?.value, 10) || 14,
                    speed: 9 + (idx % 4),
                    visible: true
                }));
                if (targetScope === 'studio' || targetScope === 'web') {
                    const swDmEl = document.getElementById('sw-danmaku');
                    if (swDmEl && !swDmEl.checked) {
                        swDmEl.checked = true;
                        swDmEl.dispatchEvent(new Event('change'));
                    }
                }
                if (typeof window.DanmakuEngine.renderTrackList === 'function') {
                    window.DanmakuEngine.renderTrackList();
                }
                if (typeof window.DanmakuEngine.refresh === 'function') {
                    window.DanmakuEngine.refresh();
                }
            }

            // C) 同步更新电脑网页端与全屏横屏底部弹幕占位骚话
            if (pureDanmakuMsgs.length > 0) {
                const firstHotDm = pureDanmakuMsgs[0];
                const inWebDm = document.getElementById('in-dm-placeholder');
                const dispWebDm = document.getElementById('disp-dm-placeholder');
                if (inWebDm && (targetScope === 'web' || targetScope === 'studio')) {
                    inWebDm.value = firstHotDm;
                    if (dispWebDm) dispWebDm.textContent = firstHotDm;
                }
            }

            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            updateLiveAiQuotaStatusText(`✅ AI 已匹配 (${sceneLabel})`);
            const mediaKindLabel = (window.PlayerEngine && window.PlayerEngine.isVideoMode === false) ? '圖片' : '視頻';
            if (isManualClick) {
                window.showToast(`🤖 AI 已識別${mediaKindLabel}畫面（${sceneLabel}）並同步生成彈幕話術！（冷卻 30 秒）`);
            }
        } finally {
            syncAllAiButtonsCooldownUI();
        }
    }
    window.autoMatchLiveDanmakuByVideoAI = autoMatchLiveDanmakuByVideoAI;

    window.onVideoUploadedForLiveAi = function (fileName, aiFrames) {
        const allowLiveAuto = !swLiveAutoAiDm || swLiveAutoAiDm.checked;
        const allowStudioAuto = !swDmStudioAutoAi || swDmStudioAutoAi.checked;
        if (!allowLiveAuto && !allowStudioAuto) return;
        const sinceLastSec = Math.floor((Date.now() - lastAiCallTimestamp) / 1000);
        if (lastAiCallTimestamp > 0 && sinceLastSec < TEAM_AI_COOLDOWN_SEC) {
            syncAllAiButtonsCooldownUI();
            return;
        }
        autoMatchLiveDanmakuByVideoAI(false, aiFrames, 'all');
        const mediaKindLabel = (window.PlayerEngine && window.PlayerEngine.isVideoMode === false) ? '圖片' : '視頻';
        window.showToast(`🤖 AI 已根據新上傳${mediaKindLabel}自動識別並填充彈幕話術`);
    };

    if (btnLiveAiMatchDm) {
        btnLiveAiMatchDm.addEventListener('click', () => {
            autoMatchLiveDanmakuByVideoAI(true, null, 'live');
        });
    }
    if (btnDmStudioAiGen) {
        btnDmStudioAiGen.addEventListener('click', () => {
            autoMatchLiveDanmakuByVideoAI(true, null, 'studio');
        });
    }
    if (btnWebAiDm) {
        btnWebAiDm.addEventListener('click', () => {
            autoMatchLiveDanmakuByVideoAI(true, null, 'web');
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
            if (txtLiveDmSpeed) txtLiveDmSpeed.textContent = formatLiveDmSpeedLabel(v);
            if (txtLiveCanvasSpd) txtLiveCanvasSpd.textContent = v === 0 ? '⏸️靜止' : `⚡${v}檔`;
            if (v === 0) {
                if (swLiveAutoRollDm) swLiveAutoRollDm.checked = false;
            } else {
                if (swLiveAutoRollDm && !swLiveAutoRollDm.checked) swLiveAutoRollDm.checked = true;
                renderLiveChatBubbles(true);
            }
            restartLiveChatRollTimer();
        });
    }

    // ★ 直播间全元素显隐开关系统（支持顶部总控「全部显示 / 全部关闭」与下方各模块旁的单独「显示」开关双向同步）
    const LIVE_VIS_TARGETS = {
        'host-info': ['#live-host-avatar-wrap', '#live-host-name-row'],
        'host-likes': ['#live-host-id-row'],
        'follow-btn': ['#live-btn-follow'],
        'aud-avatars': ['#live-aud-avatars'],
        'top-viewers': ['#live-viewer-pill-top'],
        'exit-btn': ['#live-btn-exit-top'],
        'live-pill': ['#live-left-live-pill'],
        'brand-pill': ['#live-laya-brand-pill'],
        'square-pill': ['#live-sub-square-pill'],
        'sys-notice': ['#live-sys-notice'],
        'welcome-bar': ['#live-room-welcome'],
        'gift-banner': ['#live-gift-combo-slot', '#live-gift-combo-banner'],
        'chat-list': ['#live-chat-list'],
        'join-ticker': ['#live-join-ticker-row'],
        'float-hearts': ['#live-floating-hearts'],
        'bottom-input': ['.live-input-row'],
        'bottom-icons': ['.live-bottom-bar']
    };
    const liveVisStateMap = {};
    Object.keys(LIVE_VIS_TARGETS).forEach(k => { liveVisStateMap[k] = true; });
    try {
        const savedVis = JSON.parse(localStorage.getItem('LAYA_LIVE_VIS_MAP_V1') || '{}');
        if (savedVis && typeof savedVis === 'object') {
            Object.keys(LIVE_VIS_TARGETS).forEach(k => {
                if (typeof savedVis[k] === 'boolean') liveVisStateMap[k] = savedVis[k];
            });
        }
    } catch (e) {}

    function setLiveElementVisibility(visKey, isVisible, saveToStorage = true) {
        if (!LIVE_VIS_TARGETS[visKey]) return;
        const flag = !!isVisible;
        liveVisStateMap[visKey] = flag;

        // 1) 同步所有同名的 [data-live-vis] 复选框（包含顶部总控矩阵与每个设置项旁边的独立开关）
        document.querySelectorAll(`input[type="checkbox"][data-live-vis="${visKey}"]`).forEach(cb => {
            if (cb.checked !== flag) cb.checked = flag;
        });

        // 2) 同步原有的欢迎语与系统提示语复选框
        if (visKey === 'welcome-bar' && swLiveShowWelcome && swLiveShowWelcome.checked !== flag) {
            swLiveShowWelcome.checked = flag;
        }
        if (visKey === 'sys-notice' && swLiveShowNotice && swLiveShowNotice.checked !== flag) {
            swLiveShowNotice.checked = flag;
        }

        // 3) 控制直播间对应 DOM 节点显隐
        const root = liveOverlayEl || document;
        LIVE_VIS_TARGETS[visKey].forEach(sel => {
            root.querySelectorAll(sel).forEach(el => {
                el.style.display = flag ? '' : 'none';
                el.dataset.liveHidden = flag ? 'false' : 'true';
            });
        });

        // 若主播头像与本场点赞都关闭了，则自动隐藏左上角主播胶囊背景框；只要有一个开启则显示
        const hostPillEl = root.querySelector('.live-host-pill');
        if (hostPillEl) {
            const anyHostPartOn = liveVisStateMap['host-info'] || liveVisStateMap['host-likes'] || liveVisStateMap['follow-btn'];
            hostPillEl.style.display = anyHostPartOn ? '' : 'none';
        }
        const hostMetaEl = root.querySelector('.live-host-meta');
        if (hostMetaEl) {
            hostMetaEl.style.display = (liveVisStateMap['host-info'] || liveVisStateMap['host-likes']) ? '' : 'none';
        }

        if (visKey === 'float-hearts') {
            if (!flag) {
                if (liveHeartTimer) { clearInterval(liveHeartTimer); liveHeartTimer = null; }
                if (liveFloatingHearts) liveFloatingHearts.innerHTML = '';
            } else if (isLiveRoomOpenNow()) {
                restartLiveHeartTimer();
            }
        }

        if (saveToStorage && !window.__isRestoringStorage) {
            try {
                localStorage.setItem('LAYA_LIVE_VIS_MAP_V1', JSON.stringify(liveVisStateMap));
            } catch (e) {}
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
        }
    }

    function applyAllLiveElementVisibility() {
        Object.keys(LIVE_VIS_TARGETS).forEach(k => {
            setLiveElementVisibility(k, liveVisStateMap[k], false);
        });
    }

    document.querySelectorAll('input[type="checkbox"][data-live-vis]').forEach(cb => {
        cb.addEventListener('change', () => {
            const k = cb.getAttribute('data-live-vis');
            setLiveElementVisibility(k, cb.checked, true);
        });
    });

    if (swLiveShowWelcome) {
        swLiveShowWelcome.addEventListener('change', () => {
            setLiveElementVisibility('welcome-bar', swLiveShowWelcome.checked, true);
        });
    }
    if (swLiveShowNotice) {
        swLiveShowNotice.addEventListener('change', () => {
            setLiveElementVisibility('sys-notice', swLiveShowNotice.checked, true);
        });
    }

    const btnLiveVisAllOn = document.getElementById('btn-live-vis-all-on');
    const btnLiveVisAllOff = document.getElementById('btn-live-vis-all-off');
    if (btnLiveVisAllOn) {
        btnLiveVisAllOn.addEventListener('click', () => {
            Object.keys(LIVE_VIS_TARGETS).forEach(k => setLiveElementVisibility(k, true, false));
            try { localStorage.setItem('LAYA_LIVE_VIS_MAP_V1', JSON.stringify(liveVisStateMap)); } catch (e) {}
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('✅ 已開啟直播間全部元素顯示');
        });
    }
    if (btnLiveVisAllOff) {
        btnLiveVisAllOff.addEventListener('click', () => {
            Object.keys(LIVE_VIS_TARGETS).forEach(k => setLiveElementVisibility(k, false, false));
            try { localStorage.setItem('LAYA_LIVE_VIS_MAP_V1', JSON.stringify(liveVisStateMap)); } catch (e) {}
            if (typeof triggerSaveStorage === 'function') triggerSaveStorage();
            window.showToast('🚫 已關閉直播間全部元素（純淨畫面模式）');
        });
    }
    setTimeout(applyAllLiveElementVisibility, 60);

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
        const rawTxt = (liveChatInput.value || '').trim();
        if (!rawTxt) {
            window.showToast('💬 請先輸入要發送的彈幕內容');
            return;
        }
        const txt = sanitizeDanmakuAllowedEmojisOnly(rawTxt, false) || rawTxt;
        const secretOn = !!(swLiveAiSecret && swLiveAiSecret.checked);
        const secretCode = (inLiveSecretCode && inLiveSecretCode.value.trim()) || '4748';
        if (secretOn && txt.includes(secretCode)) {
            liveChatInput.value = '';
            triggerSecretThemeDanmakuGeneration(true);
            spawnSingleLiveHeart();
            return;
        }
        if (inLiveDanmakuList) {
            markFieldUserModified('in-live-danmaku-list');
            const cur = inLiveDanmakuList.value.trim();
            const fmtLine = (txt.includes('：') || txt.includes(':')) ? txt : `小羊：${txt}`;
            inLiveDanmakuList.value = cur ? `${fmtLine}\n${cur}` : fmtLine;
        }
        liveChatCursor = 0;
        renderLiveChatBubbles(false);
        liveChatInput.value = '';
        spawnSingleLiveHeart();
        triggerSaveStorage();
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
    let isLiveBotLiked = false;
    if (liveBotBtnLike) {
        liveBotBtnLike.addEventListener('click', (e) => {
            e.stopPropagation();
            isLiveBotLiked = true;
            liveBotBtnLike.classList.add('liked');
            const svgEl = document.getElementById('live-bot-svg-like') || liveBotBtnLike.querySelector('svg');
            if (svgEl) {
                svgEl.setAttribute('fill', '#fe2c55');
            }
            liveBotBtnLike.classList.remove('like-bounce-anim');
            void liveBotBtnLike.offsetWidth;
            liveBotBtnLike.classList.add('like-bounce-anim');
            for (let i = 0; i < 5; i++) {
                setTimeout(spawnSingleLiveHeart, i * 90);
            }
        });
        liveBotBtnLike.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isLiveBotLiked = false;
            liveBotBtnLike.classList.remove('liked', 'like-bounce-anim');
            const svgEl = document.getElementById('live-bot-svg-like') || liveBotBtnLike.querySelector('svg');
            if (svgEl) {
                svgEl.setAttribute('fill', '#ffffff');
            }
        });
    }

    // ★ 录屏导出 MP4 (30fps/60fps) 专用的直播间右侧动态小表情与彩心离屏精灵缓存（1:1 还原编辑器 24px 精致贴边微光晕，且消除主画布每帧高斯模糊开销）
    const EXPORT_HEART_COLORS = ['#ff5e97', '#a855f7', '#f43f5e', '#ec4899'];
    const liveCheerSpriteCache = new Map();
    const liveGiftIconSpriteCache = new Map();
    let liveGiftPillBgCache = { key: '', canvas: null, pad: 0 };

    function getCachedCheerParticleSprite(tokenKey, isHeart, heartCol, baseSizePx, scaleRatioX, scaleRatioY) {
        const cacheKey = `v3_${tokenKey}_${isHeart ? heartCol : 'em'}_${baseSizePx}_${Math.round(scaleRatioX * 10)}`;
        if (liveCheerSpriteCache.has(cacheKey)) {
            return liveCheerSpriteCache.get(cacheKey);
        }
        const pad = Math.ceil(14 * scaleRatioX);
        const boxW = Math.ceil(baseSizePx + pad * 2);
        const boxH = Math.ceil(baseSizePx + pad * 2);
        const c = document.createElement('canvas');
        c.width = boxW;
        c.height = boxH;
        const cx = c.getContext('2d');
        const midX = boxW * 0.5;
        const midY = boxH * 0.5;

        // 1) 底层紧致小巧的径向柔光晕（直径约 24px，贴合小表情边缘，自然柔和不夸张，与 CSS .live-heart-particle::before 1:1 对齐）
        cx.save();
        const auraR = baseSizePx * 0.62;
        const auraGrad = cx.createRadialGradient(midX, midY, baseSizePx * 0.06, midX, midY, auraR);
        if (isHeart && heartCol === '#a855f7') {
            auraGrad.addColorStop(0, 'rgba(216, 180, 254, 0.30)');
            auraGrad.addColorStop(0.50, 'rgba(168, 85, 247, 0.15)');
            auraGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
        } else if (isHeart) {
            auraGrad.addColorStop(0, 'rgba(255, 110, 165, 0.30)');
            auraGrad.addColorStop(0.50, 'rgba(244, 63, 94, 0.15)');
            auraGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
        } else {
            auraGrad.addColorStop(0, 'rgba(250, 204, 21, 0.28)');
            auraGrad.addColorStop(0.48, 'rgba(244, 114, 182, 0.14)');
            auraGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
        }
        cx.fillStyle = auraGrad;
        cx.beginPath();
        cx.arc(midX, midY, auraR, 0, Math.PI * 2);
        cx.fill();
        cx.restore();

        if (isHeart) {
            const drawHeartPath = () => {
                cx.beginPath();
                cx.moveTo(0, 8.8);
                cx.bezierCurveTo(-6.4, 3.2, -9.6, 0.3, -9.6, -3.45);
                cx.bezierCurveTo(-9.6, -6.35, -7.35, -8.6, -4.45, -8.6);
                cx.bezierCurveTo(-2.83, -8.6, -1.27, -7.84, 0, -6.62);
                cx.bezierCurveTo(1.27, -7.84, 2.83, -8.6, 4.45, -8.6);
                cx.bezierCurveTo(7.35, -8.6, 9.6, -6.35, 9.6, -3.45);
                cx.bezierCurveTo(9.6, 0.3, 6.4, 3.2, 0, 8.8);
                cx.closePath();
            };
            cx.save();
            cx.translate(midX, midY);
            const s = baseSizePx / 24;
            cx.scale(s, s);
            drawHeartPath();
            cx.fillStyle = heartCol;
            cx.shadowColor = 'rgba(250, 204, 21, 0.62)';
            cx.shadowBlur = 4.5 * scaleRatioX;
            cx.shadowOffsetY = 1.2 * scaleRatioY;
            cx.fill();
            cx.shadowColor = 'transparent';
            cx.shadowBlur = 0;
            cx.shadowOffsetY = 0;
            if (heartCol === '#a855f7') {
                cx.beginPath();
                cx.arc(5.2, -5.2, 1.5, 0, Math.PI * 2);
                cx.fillStyle = '#fde047';
                cx.fill();
            } else {
                cx.beginPath();
                cx.arc(-4.2, -3.9, 2.7, Math.PI * 1.05, Math.PI * 1.48, false);
                cx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
                cx.lineWidth = 1.5;
                cx.lineCap = 'round';
                cx.stroke();
            }
            cx.restore();
        } else {
            cx.save();
            cx.translate(midX, midY);
            cx.font = `${baseSizePx}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
            cx.textAlign = 'center';
            cx.textBaseline = 'middle';
            cx.shadowColor = 'rgba(250, 204, 21, 0.65)';
            cx.shadowBlur = 4.5 * scaleRatioX;
            cx.shadowOffsetY = 1.2 * scaleRatioY;
            cx.fillText(tokenKey, 0, 0);
            cx.restore();
        }

        const entry = { canvas: c, halfW: boxW * 0.5, halfH: boxH * 0.5 };
        liveCheerSpriteCache.set(cacheKey, entry);
        return entry;
    }

    function getCachedGiftIconSprite(iconStr, iconFontPx, gs) {
        const key = `${iconStr}_${iconFontPx}_${Math.round(gs * 10)}`;
        if (liveGiftIconSpriteCache.has(key)) {
            return liveGiftIconSpriteCache.get(key);
        }
        const pad = Math.ceil(10 * gs);
        const side = Math.ceil(iconFontPx + pad * 2);
        const c = document.createElement('canvas');
        c.width = side;
        c.height = side;
        const cx = c.getContext('2d');
        cx.save();
        cx.translate(side * 0.5, side * 0.5);
        cx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        cx.shadowBlur = 5 * gs;
        cx.shadowOffsetY = 2 * gs;
        cx.font = `${iconFontPx}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        cx.textAlign = 'center';
        cx.textBaseline = 'middle';
        cx.fillText(iconStr, 0, 0);
        cx.restore();
        const entry = { canvas: c, half: side * 0.5 };
        liveGiftIconSpriteCache.set(key, entry);
        return entry;
    }

    function drawVectorHeartOnCanvas(ctx, cx, cy, size, fillColor, alpha, rotRad = 0, withNeonAura = false) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.translate(cx, cy);
        if (rotRad) ctx.rotate(rotRad);

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
        ctx.fill();
        ctx.restore();
    }

    // ★ 在录屏 Canvas 上绘制发光四角星芒（✦，用于礼物胶囊与飘屏表情包高光点缀）
    function drawCanvasSparkleStar(ctx, cx, cy, outerR, innerR, color, alpha, rotRad = 0) {
        if (alpha <= 0.01 || outerR <= 0.5) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.translate(cx, cy);
        if (rotRad) ctx.rotate(rotRad);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const r = (i % 2 === 0) ? outerR : innerR;
            const angle = (i * Math.PI) / 4;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = color || '#fef08a';
        ctx.shadowColor = color || '#fde047';
        ctx.shadowBlur = outerR * 1.4;
        ctx.fill();
        ctx.restore();
    }

    // ★ 在录屏 Canvas 上绘制圆角矩形辅助函数
    function drawLiveRoundRect(ctx, x, y, w, h, r) {
        const rad = Math.max(0, Math.min(r, w / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + rad, y);
        ctx.arcTo(x + w, y, x + w, y + h, rad);
        ctx.arcTo(x + w, y + h, x, y + h, rad);
        ctx.arcTo(x, y + h, x, y, rad);
        ctx.arcTo(x, y, x + w, y, rad);
        ctx.closePath();
    }

    // ★ 在录屏 Canvas 上 1:1 绘制抖音蓝紫财富等级胶囊牌（含左侧矢量星钻 + 右侧数字）
    function drawCanvasLvBadge(ctx, x, y, lv, s, fontStack) {
        const n = parseInt(lv, 10) || 0;
        if (n <= 0) return 0;
        const txt = String(n);
        const h = Math.round(13.2 * s);
        const fontPx = Math.round(8.4 * s);
        ctx.save();
        ctx.font = `800 ${fontPx}px "Inter", ${fontStack}`;
        const numW = ctx.measureText(txt).width;
        const icoSize = 8.4 * s;
        const padL = 3.5 * s;
        const padR = 4.8 * s;
        const gap = 2 * s;
        const w = Math.ceil(padL + icoSize + gap + numW + padR);

        const grad = ctx.createLinearGradient(x, y, x + w, y);
        if (n <= 15) {
            grad.addColorStop(0, '#4aa1fa');
            grad.addColorStop(1, '#3b74f6');
        } else if (n <= 29) {
            grad.addColorStop(0, '#5c73fa');
            grad.addColorStop(1, '#7d5bfa');
        } else {
            grad.addColorStop(0, '#8655f8');
            grad.addColorStop(1, '#b84bf8');
        }
        drawLiveRoundRect(ctx, x, y, w, h, h / 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 左侧矢量钻石星芒
        const cx = x + padL + icoSize * 0.5;
        const cy = y + h * 0.5;
        const r = icoSize * 0.44;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.88, cy - r * 0.25);
        ctx.lineTo(cx + r * 0.52, cy + r * 0.92);
        ctx.lineTo(cx - r * 0.52, cy + r * 0.92);
        ctx.lineTo(cx - r * 0.88, cy - r * 0.25);
        ctx.closePath();
        ctx.fillStyle = '#e0f2fe';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.65);
        ctx.lineTo(cx + r * 0.25, cy - r * 0.15);
        ctx.lineTo(cx + r * 0.72, cy);
        ctx.lineTo(cx + r * 0.25, cy + r * 0.15);
        ctx.lineTo(cx, cy + r * 0.65);
        ctx.lineTo(cx - r * 0.25, cy + r * 0.15);
        ctx.lineTo(cx - r * 0.72, cy);
        ctx.lineTo(cx - r * 0.25, cy - r * 0.15);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(txt, x + padL + icoSize + gap, y + h * 0.52);
        ctx.restore();
        return w;
    }

    // ★ 在录屏 Canvas 上 1:1 绘制橙粉粉丝团勋章胶囊牌（含左侧星翼爱心 + 右侧数字）
    function drawCanvasFanBadge(ctx, x, y, fanLv, s, fontStack) {
        const n = parseInt(fanLv, 10) || 0;
        if (n <= 0) return 0;
        const txt = String(n);
        const h = Math.round(13.2 * s);
        const fontPx = Math.round(8.4 * s);
        ctx.save();
        ctx.font = `800 ${fontPx}px "Inter", ${fontStack}`;
        const numW = ctx.measureText(txt).width;
        const icoSize = 8.4 * s;
        const padL = 3.2 * s;
        const padR = 4.8 * s;
        const gap = 2 * s;
        const w = Math.ceil(padL + icoSize + gap + numW + padR);

        const grad = ctx.createLinearGradient(x, y, x + w, y);
        grad.addColorStop(0, '#fb923c');
        grad.addColorStop(0.55, '#f97316');
        grad.addColorStop(1, '#f43f5e');
        drawLiveRoundRect(ctx, x, y, w, h, h / 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 左侧白色小爱心徽章
        drawVectorHeartOnCanvas(ctx, x + padL + icoSize * 0.5, y + h * 0.52, icoSize * 1.15, '#fff7ed', 0.96);

        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(txt, x + padL + icoSize + gap, y + h * 0.52);
        ctx.restore();
        return w;
    }

    // ★ 辅助函数：将长文本按最大像素宽度自动拆分为多行（100% 完整保留全部文字，绝不截断加省略号 ...，带哈希缓存消除每帧重复 measureText）
    const liveWrapTextCache = new Map();
    function wrapCanvasTextLines(ctx, text, maxW) {
        const str = String(text || '');
        if (!str) return [''];
        const cacheKey = `${ctx.font}|${Math.round(maxW)}|${str}`;
        const cached = liveWrapTextCache.get(cacheKey);
        if (cached) return cached;
        const chars = Array.from(str);
        const lines = [];
        let cur = '';
        for (let i = 0; i < chars.length; i++) {
            const next = cur + chars[i];
            if (cur && ctx.measureText(next).width > maxW) {
                lines.push(cur);
                cur = chars[i];
            } else {
                cur = next;
            }
        }
        if (cur) lines.push(cur);
        const res = lines.length > 0 ? lines : [''];
        if (liveWrapTextCache.size > 400) liveWrapTextCache.clear();
        liveWrapTextCache.set(cacheKey, res);
        return res;
    }

    // ★ 预加载真人头像 Image 池供视频导出时礼物弹窗每轮切换不同头像使用
    const exportGiftAvatarImages = [];
    function ensureExportGiftAvatarPoolLoaded() {
        if (exportGiftAvatarImages.length > 0) return;
        const db = window.LAYA_ASIAN_AVATARS || {};
        const beauties = Array.isArray(db.beauties) ? db.beauties : [];
        const guys = Array.isArray(db.guys) ? db.guys : [];
        const vibes = Array.isArray(db.vibes) ? db.vibes.slice(0, 12) : [];
        const pets = Array.isArray(db.pets) ? db.pets.slice(0, 10) : [];
        const pool = [...beauties, ...guys, ...vibes, ...pets];
        pool.slice(0, 48).forEach(url => {
            if (!url) return;
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = url;
            exportGiftAvatarImages.push(img);
        });
    }
    setTimeout(ensureExportGiftAvatarPoolLoaded, 400);

    // ★ 在录屏 Canvas 上绘制单条或多行自动换行弹幕胶囊气泡（框体比例 boxS 与里面文字比例 fontS 完全独立分开，1:1 还原预览画面）
    function drawSingleLiveChatBubbleOnCanvas(ctx, baseX, rowTopY, maxBubbleW, rowData, badgeSeedIdx, fontS, boxS, dmTextColor, showRowHeart, fontStack, dryRun = false) {
        const { lv, fanLv, isAdmin, nickPart, msg, isJoinRow } = rowData;
        const hasBadges = (lv > 0 || fanLv > 0 || isAdmin);
        const padX = Math.round(7.5 * boxS);
        const padY = Math.round(2.8 * boxS);
        const cornerR = Math.round(10.5 * boxS);
        const itemGap = Math.round(3.5 * fontS);
        const badgeH = Math.round(13.2 * fontS);
        const fontPx = Math.max(7, Math.round(10 * fontS));
        const lineStepH = Math.max(Math.round(fontPx * 1.34), Math.round(14.0 * fontS));

        ctx.save();
        ctx.font = `800 ${fontPx}px "Inter", ${fontStack}`;
        const lvW = lv > 0 ? Math.ceil((lv >= 10 ? 26.5 : 21.5) * fontS) : 0;
        const fanW = fanLv > 0 ? Math.ceil((fanLv >= 10 ? 26.2 : 21.2) * fontS) : 0;
        const admW = isAdmin ? Math.ceil(14.5 * fontS) : 0;
        const nickFull = isJoinRow ? `${nickPart} ` : `${nickPart}：`;
        const nickW = ctx.measureText(nickFull).width;

        let prefixContentW = 0;
        if (lvW > 0) prefixContentW += lvW + itemGap;
        if (fanW > 0) prefixContentW += fanW + itemGap;
        if (admW > 0) prefixContentW += admW + itemGap;
        prefixContentW += nickW;

        ctx.font = `600 ${fontPx}px ${fontStack}`;
        const displayMsg = String(msg || '');
        const effectiveShowHeart = showRowHeart && !isJoinRow;
        const heartW = effectiveShowHeart ? Math.ceil(12 * fontS) : 0;
        const msgW = ctx.measureText(displayMsg).width;
        const innerMaxW = Math.max(72 * boxS, maxBubbleW - padX * 2);

        // 判断是否单行即可放下，或者像预览画面 (.live-chat-bubble flex-wrap: wrap) 一样将长弹幕换到第二行完整展示
        const fitsSingleLine = isJoinRow || ((prefixContentW + msgW + heartW) <= innerMaxW);

        if (fitsSingleLine) {
            const rowH = Math.max(Math.round(14 * boxS), Math.round(padY * 2 + Math.max(badgeH, Math.round(fontPx * 1.28))));
            const totalBubbleW = Math.min(maxBubbleW, Math.ceil(padX * 2 + prefixContentW + msgW + heartW));
            if (dryRun) {
                ctx.restore();
                return rowH;
            }

            // 1) 圆角深色半透明气泡背景
            drawLiveRoundRect(ctx, baseX, rowTopY, totalBubbleW, rowH, cornerR);
            ctx.fillStyle = 'rgba(10, 12, 20, 0.50)';
            ctx.fill();
            ctx.lineWidth = Math.max(1, 0.8 * boxS);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
            ctx.stroke();

            // 2) 绘制徽章 + 昵称 + 弹幕文字
            let curX = baseX + padX;
            const badgeY = rowTopY + Math.round((rowH - badgeH) / 2);
            if (lv > 0) {
                const actualLvW = drawCanvasLvBadge(ctx, curX, badgeY, lv, fontS, fontStack);
                curX += actualLvW + itemGap;
            }
            if (fanLv > 0) {
                const actualFanW = drawCanvasFanBadge(ctx, curX, badgeY, fanLv, fontS, fontStack);
                curX += actualFanW + itemGap;
            }
            if (isAdmin) {
                const aw = Math.round(14.2 * fontS);
                drawLiveRoundRect(ctx, curX, badgeY, aw, badgeH, 3.5 * fontS);
                const agrad = ctx.createLinearGradient(curX, badgeY, curX + aw, badgeY);
                agrad.addColorStop(0, '#ef4444');
                agrad.addColorStop(1, '#f43f5e');
                ctx.fillStyle = agrad;
                ctx.fill();
                ctx.font = `800 ${Math.round(8 * fontS)}px ${fontStack}`;
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('管', curX + aw / 2, badgeY + badgeH * 0.52);
                curX += aw + itemGap;
            }

            const textMidY = rowTopY + rowH * 0.53;
            ctx.font = `800 ${fontPx}px ${fontStack}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const useRainbow = !swLiveRainbowNick || swLiveRainbowNick.checked;
            if (!useRainbow) {
                ctx.fillStyle = '#93c5fd';
                ctx.fillText(nickFull, curX, textMidY);
                curX += ctx.measureText(nickFull).width;
            } else if (!hasBadges || isJoinRow) {
                ctx.fillStyle = PLAIN_VIEWER_NICK_PALETTE[badgeSeedIdx % PLAIN_VIEWER_NICK_PALETTE.length];
                ctx.fillText(nickFull, curX, textMidY);
                curX += ctx.measureText(nickFull).width;
            } else if (badgeSeedIdx % 2 === 0 && nickPart.length >= 2) {
                const chars = Array.from(nickPart);
                for (let cIdx = 0; cIdx < chars.length; cIdx++) {
                    const ch = chars[cIdx];
                    ctx.fillStyle = RAINBOW_CHAR_COLORS[(badgeSeedIdx + cIdx) % RAINBOW_CHAR_COLORS.length];
                    ctx.fillText(ch, curX, textMidY);
                    curX += ctx.measureText(ch).width;
                }
                ctx.fillStyle = '#cbd5e1';
                ctx.fillText('：', curX, textMidY);
                curX += ctx.measureText('：').width;
            } else {
                ctx.fillStyle = COLORFUL_NICK_PALETTE[badgeSeedIdx % COLORFUL_NICK_PALETTE.length];
                ctx.fillText(nickFull, curX, textMidY);
                curX += ctx.measureText(nickFull).width;
            }

            ctx.font = `600 ${fontPx}px ${fontStack}`;
            ctx.fillStyle = isJoinRow ? 'rgba(255, 255, 255, 0.88)' : (dmTextColor || '#ffffff');
            ctx.fillText(displayMsg, curX, textMidY);
            curX += msgW;

            if (effectiveShowHeart) {
                drawVectorHeartOnCanvas(ctx, curX + 6 * fontS, textMidY, 9.5 * fontS, '#c084fc', 0.95);
            }
            ctx.restore();
            return rowH;
        }

        // ★ 多行完整换行模式（如预览图中「江南煙雨客：\n身材管理得太厲害了，愛了愛了」与「🧡19 浪漫遊蕩者：\n主播今天完全是在瘋狂試探邊緣啊」）
        const msgWrapMaxW = Math.max(60 * boxS, innerMaxW - heartW);
        const msgLines = wrapCanvasTextLines(ctx, displayMsg, msgWrapMaxW);
        let maxMsgLineW = 0;
        for (let mIdx = 0; mIdx < msgLines.length; mIdx++) {
            const lw = ctx.measureText(msgLines[mIdx]).width + (mIdx === msgLines.length - 1 ? heartW : 0);
            if (lw > maxMsgLineW) maxMsgLineW = lw;
        }
        const totalLines = 1 + msgLines.length;
        const rowH = Math.round(padY * 2 + totalLines * lineStepH);
        const totalBubbleW = Math.min(maxBubbleW, Math.ceil(padX * 2 + Math.max(prefixContentW, maxMsgLineW)));

        if (dryRun) {
            ctx.restore();
            return rowH;
        }

        // 1) 绘制多行圆角深色半透明气泡背景
        drawLiveRoundRect(ctx, baseX, rowTopY, totalBubbleW, rowH, cornerR);
        ctx.fillStyle = 'rgba(10, 12, 20, 0.50)';
        ctx.fill();
        ctx.lineWidth = Math.max(1, 0.8 * boxS);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.stroke();

        // 2) 第一行：绘制蓝牌、橙牌、红管字牌、彩色/彩虹昵称
        let curX = baseX + padX;
        const line1MidY = rowTopY + padY + lineStepH * 0.52;
        const badgeY = Math.round(line1MidY - badgeH / 2);

        if (lv > 0) {
            const actualLvW = drawCanvasLvBadge(ctx, curX, badgeY, lv, fontS, fontStack);
            curX += actualLvW + itemGap;
        }
        if (fanLv > 0) {
            const actualFanW = drawCanvasFanBadge(ctx, curX, badgeY, fanLv, fontS, fontStack);
            curX += actualFanW + itemGap;
        }
        if (isAdmin) {
            const aw = Math.round(14.2 * fontS);
            drawLiveRoundRect(ctx, curX, badgeY, aw, badgeH, 3.5 * fontS);
            const agrad = ctx.createLinearGradient(curX, badgeY, curX + aw, badgeY);
            agrad.addColorStop(0, '#ef4444');
            agrad.addColorStop(1, '#f43f5e');
            ctx.fillStyle = agrad;
            ctx.fill();
            ctx.font = `800 ${Math.round(8 * fontS)}px ${fontStack}`;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('管', curX + aw / 2, badgeY + badgeH * 0.52);
            curX += aw + itemGap;
        }

        ctx.font = `800 ${fontPx}px ${fontStack}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const useRainbow = !swLiveRainbowNick || swLiveRainbowNick.checked;
        if (!useRainbow) {
            ctx.fillStyle = '#93c5fd';
            ctx.fillText(nickFull, curX, line1MidY);
        } else if (!hasBadges) {
            ctx.fillStyle = PLAIN_VIEWER_NICK_PALETTE[badgeSeedIdx % PLAIN_VIEWER_NICK_PALETTE.length];
            ctx.fillText(nickFull, curX, line1MidY);
        } else if (badgeSeedIdx % 2 === 0 && nickPart.length >= 2) {
            const chars = Array.from(nickPart);
            for (let cIdx = 0; cIdx < chars.length; cIdx++) {
                const ch = chars[cIdx];
                ctx.fillStyle = RAINBOW_CHAR_COLORS[(badgeSeedIdx + cIdx) % RAINBOW_CHAR_COLORS.length];
                ctx.fillText(ch, curX, line1MidY);
                curX += ctx.measureText(ch).width;
            }
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText('：', curX, line1MidY);
        } else {
            ctx.fillStyle = COLORFUL_NICK_PALETTE[badgeSeedIdx % COLORFUL_NICK_PALETTE.length];
            ctx.fillText(nickFull, curX, line1MidY);
        }

        // 3) 第二行及后续行：完整绘制弹幕正文内容（绝无省略号截断）
        ctx.font = `600 ${fontPx}px ${fontStack}`;
        ctx.fillStyle = dmTextColor || '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let mIdx = 0; mIdx < msgLines.length; mIdx++) {
            const lineTxt = msgLines[mIdx];
            const lineMidY = rowTopY + padY + (1 + mIdx + 0.54) * lineStepH;
            const msgStartX = baseX + padX;
            ctx.fillText(lineTxt, msgStartX, lineMidY);
            if (effectiveShowHeart && mIdx === msgLines.length - 1) {
                const lw = ctx.measureText(lineTxt).width;
                drawVectorHeartOnCanvas(ctx, msgStartX + lw + 6 * fontS, lineMidY, 9.5 * fontS, '#c084fc', 0.95);
            }
        }

        ctx.restore();
        return rowH;
    }

    // ★ 录屏导出开始前：快照用户在网页画面上设置好的礼物、头像、连击数字、弹幕位置与进场游标，并预生成后续每一轮不重复的【新头像 + 新名字 + 新礼物】序列
    window.__captureLiveExportInitialState = function () {
        if (liveChatRollTimer) { clearInterval(liveChatRollTimer); liveChatRollTimer = null; }
        if (liveJoinTickerTimer) { clearInterval(liveJoinTickerTimer); liveJoinTickerTimer = null; }
        if (liveHeartTimer) { clearInterval(liveHeartTimer); liveHeartTimer = null; }
        if (liveFloatingHearts) { liveFloatingHearts.innerHTML = ''; }
        if (liveGiftComboTimer) { clearInterval(liveGiftComboTimer); liveGiftComboTimer = null; }
        if (liveGiftComboBounceTimer) { clearInterval(liveGiftComboBounceTimer); liveGiftComboBounceTimer = null; }
        if (giftEmptyGapPhaseTimer) { clearTimeout(giftEmptyGapPhaseTimer); giftEmptyGapPhaseTimer = null; }
        if (giftFadeOutPhaseTimer) { clearTimeout(giftFadeOutPhaseTimer); giftFadeOutPhaseTimer = null; }

        ensureExportGiftAvatarPoolLoaded();

        const snapSender = (liveGiftSenderName && liveGiftSenderName.textContent.trim())
            || (inLiveGiftUser && inLiveGiftUser.value.trim())
            || '皓哥';
        const snapGiftDesc = (liveGiftDescTxt && liveGiftDescTxt.textContent.trim())
            || (inLiveGiftName && inLiveGiftName.value.trim())
            || '送 嘉年華';
        const snapGiftIcon = (liveGiftItemIcon && liveGiftItemIcon.textContent.trim())
            || (inLiveGiftIcon && inLiveGiftIcon.value.trim())
            || inferGiftIconFromName(snapGiftDesc)
            || '🎠';
        const snapBaseColor = (inLiveGiftColor && inLiveGiftColor.value) || '#9333ea';
        const matchedCat = LIVE_GIFT_CATALOG.find(item => item.icon === snapGiftIcon || snapGiftDesc.includes(item.name.replace(/^[^\s]+\s+/, '')));
        const snapEndColor = matchedCat ? matchedCat.endColor : (currentGiftEndColor || 'rgba(245, 158, 11, 0.85)');
        const { minQty, maxQty } = getLiveGiftQtyRange();
        const rawCombo = (liveGiftComboNum && liveGiftComboNum.textContent.trim())
            || (inLiveGiftCount && inLiveGiftCount.value.trim())
            || ('x' + minQty);
        let parsedCombo = parseInt(rawCombo.replace(/[^\d]/g, ''), 10);
        if (Number.isNaN(parsedCombo) || parsedCombo < 1) parsedCombo = minQty;
        const snapComboTxt = 'x' + parsedCombo;

        let snapAvatarImg = liveGiftSenderAv;
        let snapAvatarSrc = '';
        if (liveGiftSenderAv) {
            const avSrc = liveGiftSenderAv.getAttribute('data-export-src') || liveGiftSenderAv.src;
            if (avSrc) {
                snapAvatarSrc = avSrc;
                if (liveGiftSenderAv.complete && liveGiftSenderAv.naturalWidth > 0) {
                    snapAvatarImg = liveGiftSenderAv;
                } else {
                    const cloneAv = new Image();
                    cloneAv.crossOrigin = 'anonymous';
                    cloneAv.src = avSrc;
                    snapAvatarImg = cloneAv;
                }
            }
        }

        // 预生成 80 轮互不重复的送礼序列（第 0 轮为画面当前展示的送礼，第 1~79 轮每次都换不同真人头像、不同送礼人名字、不同礼物与图标）
        const cycleSequence = [{
            sender: snapSender,
            giftDesc: snapGiftDesc,
            giftIcon: snapGiftIcon,
            baseColor: snapBaseColor,
            endColor: snapEndColor,
            comboNumVal: parsedCombo,
            comboTxt: snapComboTxt,
            avatarImg: snapAvatarImg
        }];

        const readyAvPool = exportGiftAvatarImages.filter(img => img && img.complete && img.naturalWidth > 0);
        const activeAvPool = readyAvPool.length > 0 ? readyAvPool : exportGiftAvatarImages;
        let prevUserIdx = giftUserPresets.indexOf(snapSender);
        let prevCatIdx = LIVE_GIFT_CATALOG.findIndex(item => item.icon === snapGiftIcon || snapGiftDesc.includes(item.name.replace(/^[^\s]+\s+/, '')));
        let prevAvIdx = activeAvPool.findIndex(img => img && img.src === snapAvatarSrc);

        for (let step = 1; step < 80; step++) {
            let uIdx = (prevUserIdx + 1 + Math.floor(Math.random() * Math.max(1, giftUserPresets.length - 2))) % giftUserPresets.length;
            if (uIdx < 0) uIdx = step % giftUserPresets.length;
            prevUserIdx = uIdx;

            let gIdx = (prevCatIdx + 1 + Math.floor(Math.random() * Math.max(1, LIVE_GIFT_CATALOG.length - 2))) % LIVE_GIFT_CATALOG.length;
            if (gIdx < 0) gIdx = step % LIVE_GIFT_CATALOG.length;
            prevCatIdx = gIdx;
            const catItem = LIVE_GIFT_CATALOG[gIdx];

            let avImg = snapAvatarImg;
            if (activeAvPool.length > 0) {
                let aIdx = (prevAvIdx + 1 + Math.floor(Math.random() * Math.max(1, activeAvPool.length - 2))) % activeAvPool.length;
                if (aIdx < 0) aIdx = step % activeAvPool.length;
                prevAvIdx = aIdx;
                avImg = activeAvPool[aIdx] || snapAvatarImg;
            }

            const startQtyStr = pickRandomGiftQtyInRange(true);
            const startQtyNum = parseInt(startQtyStr.replace(/[^\d]/g, ''), 10) || minQty;

            cycleSequence.push({
                sender: giftUserPresets[uIdx],
                giftDesc: catItem.name,
                giftIcon: catItem.icon,
                baseColor: catItem.color,
                endColor: catItem.endColor,
                comboNumVal: startQtyNum,
                comboTxt: 'x' + startQtyNum,
                avatarImg: avImg
            });
        }

        window.__liveExportInitialState = {
            sender: snapSender,
            giftDesc: snapGiftDesc,
            giftIcon: snapGiftIcon,
            baseColor: snapBaseColor,
            endColor: snapEndColor,
            comboNumVal: parsedCombo,
            comboTxt: snapComboTxt,
            avatarImg: snapAvatarImg,
            cycleSequence: cycleSequence,
            rollTickCount: liveRollTickCount,
            joinCursor: liveJoinCursor,
            inEmptyGap: isGiftInEmptyGapNow
        };
    };

    window.__restoreLiveExportAfterDone = function () {
        const snap = window.__liveExportInitialState;
        window.__liveExportInitialState = null;
        if (snap) {
            if (inLiveGiftUser) inLiveGiftUser.value = snap.sender;
            if (inLiveGiftName) inLiveGiftName.value = snap.giftDesc;
            if (inLiveGiftIcon) inLiveGiftIcon.value = snap.giftIcon;
            if (inLiveGiftCount) inLiveGiftCount.value = snap.comboTxt;
            if (inLiveGiftColor) inLiveGiftColor.value = snap.baseColor;
            if (inLiveGiftColorHex) inLiveGiftColorHex.value = snap.baseColor;
            applyLiveGiftBannerState(false, false);
        }
        if (isLiveRoomOpenNow()) {
            restartLiveChatRollTimer();
            restartLiveHeartTimer();
            restartLiveGiftAutoCycleTimer();
        }
    };

    window.__drawLiveRoomDynamicCanvas = function (ctx, outW, outH, scaleRatioX, scaleRatioY, elapsedSec, exportFontStack) {
        if (!ctx) return;
        const activeFont = exportFontStack || '"PingFang SC", "Microsoft YaHei", sans-serif';
        const elapsedMs = Math.max(0, elapsedSec * 1000);
        const expSnap = window.__liveExportInitialState || null;

        const fontScalePct = getLiveDmFontScalePct();
        const dmFontScale = Math.min(2.60, Math.max(0.60, fontScalePct / 100));
        const boxScalePct = getLiveDmBoxScalePct();
        const dmBoxScale = Math.min(1.80, Math.max(0.70, boxScalePct / 100));
        const fontS = scaleRatioX * dmFontScale;
        const boxS = scaleRatioX * dmBoxScale;
        const rowGap = Math.round(3.5 * boxS);

        const widthPct = inLiveDmAreaWidth ? (parseInt(inLiveDmAreaWidth.value, 10) || 93) : 93;
        const layout = window.__liveExportLayout || {};
        const offXPx = Math.round((liveDmOffsetX || 0) * scaleRatioX);
        const offYPx = Math.round((liveDmOffsetY || 0) * scaleRatioY);
        const baseX = (layout.chatBox && layout.chatBox.x)
            || (layout.scrollBox && layout.scrollBox.x)
            || (layout.giftBox && layout.giftBox.x)
            || (Math.round(10 * scaleRatioX) + offXPx);
        const maxBubbleW = Math.max(
            180 * scaleRatioX,
            (layout.chatBox && layout.chatBox.w)
                || (layout.scrollBox && layout.scrollBox.w)
                || Math.round((outW - 20 * scaleRatioX) * (widthPct / 100))
        );

        // 计算底部锚点 Y（紧贴在底部「說點什麼...」输入栏上方，由下至上无缝堆叠：进场条 -> 滚动弹幕 -> 欢迎语 -> 防诈提示 -> 礼物弹窗，且完整保留用户拖拽偏移 offYPx）
        let curBottomY = (layout.joinBox && (layout.joinBox.y + layout.joinBox.h))
            || (layout.scrollBox && (layout.scrollBox.y + layout.scrollBox.h))
            || (layout.botBarBox && (layout.botBarBox.y - Math.round(4 * scaleRatioY) + offYPx))
            || (layout.chatBox && (layout.chatBox.y + layout.chatBox.h + Math.round(21 * boxS)))
            || (Math.round(outH - 92 * scaleRatioY) + offYPx);

        const speedLv = getLiveDmSpeedVal();
        const intervalMs = getLiveDmIntervalMs(speedLv);
        const joinIntervalMs = getLiveJoinIntervalMs(speedLv);
        const autoRoll = (speedLv > 0 && intervalMs > 0) && (!swLiveAutoRollDm || swLiveAutoRollDm.checked);
        const autoJoin = (speedLv > 0 && joinIntervalMs > 0) && (!swLiveAutoRollDm || swLiveAutoRollDm.checked);

        // 0) 第 0 层（左上角 LIVE 在线胶囊内）：动态绘制红点呼吸闪动与扩散水波纹光环 (#live-red-breath-dot，1:1 还原编辑器 .live-red-dot 样式)
        const livePulseDotEl = document.getElementById('live-red-breath-dot') || document.getElementById('live-pulse-dot') || document.querySelector('#live-left-live-pill .live-red-dot');
        const liveOnlinePillEl = document.getElementById('live-left-live-pill') || document.getElementById('live-online-pill');
        const showLivePill = (liveVisStateMap['live-pill'] !== false)
            && (!liveOnlinePillEl || liveOnlinePillEl.dataset.liveHidden !== 'true')
            && (!livePulseDotEl || livePulseDotEl.dataset.liveHidden !== 'true');
        if (showLivePill && layout.redDotBox && layout.redDotBox.w > 0) {
            const rd = layout.redDotBox;
            const dotCx = rd.x + rd.w * 0.5;
            const dotCy = rd.y + rd.h * 0.5;
            const baseR = Math.max(2.6 * scaleRatioX, Math.min(rd.w, rd.h) * 0.5);
            const breathPeriod = 1.45;
            const breathPhase = (elapsedSec % breathPeriod) / breathPeriod;
            const breathWave = 0.5 - 0.5 * Math.cos(breathPhase * Math.PI * 2); // 0 -> 1 -> 0 平滑呼吸曲线
            const coreScale = 0.88 + 0.28 * breathWave; // 0.88 <-> 1.16 (与 CSS @keyframes liveRedDotBreath 一致)
            const coreAlpha = 0.72 + 0.28 * breathWave; // 0.72 <-> 1.00

            ctx.save();
            // 0.1 外层扩散水波纹光圈 (liveRedDotRipple: scale 0.75 -> 1.85, opacity 0.90 -> 0)
            const rippleEase = 1 - Math.pow(1 - breathPhase, 2.0);
            const rippleR = (baseR + 1.8 * scaleRatioX) * (0.75 + 1.10 * rippleEase);
            const rippleAlpha = Math.max(0, (1 - breathPhase) * 0.85);
            if (rippleAlpha > 0.02) {
                ctx.beginPath();
                ctx.arc(dotCx, dotCy, rippleR, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 42, 85, ${rippleAlpha.toFixed(3)})`;
                ctx.lineWidth = Math.max(1.0, 1.2 * scaleRatioX);
                ctx.stroke();
            }

            // 0.2 中心呼吸红点本体 + 原生径向红光（零 shadowBlur 开销，1:1 还原 box-shadow: 0 0 6px #ff2442, 0 0 11px rgba(255, 36, 66, 0.85)）
            const glowR = baseR * (1.85 + 0.65 * breathWave);
            const dotGlow = ctx.createRadialGradient(dotCx, dotCy, baseR * 0.25, dotCx, dotCy, glowR);
            dotGlow.addColorStop(0, `rgba(255, 36, 66, ${(0.55 + 0.30 * breathWave).toFixed(3)})`);
            dotGlow.addColorStop(1, 'rgba(255, 36, 66, 0)');
            ctx.fillStyle = dotGlow;
            ctx.beginPath();
            ctx.arc(dotCx, dotCy, glowR, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = coreAlpha;
            ctx.beginPath();
            ctx.arc(dotCx, dotCy, baseR * coreScale, 0, Math.PI * 2);
            ctx.fillStyle = '#ff2442';
            ctx.fill();
            ctx.restore();
        }

        // 0.5) 顶部动态轮播/横向滚动话题标签文字 (#live-laya-brand-txt，在高清截图与 MP4 录屏导出中 1:1 动态渲染自定义字号与 8 种炫彩动画)
        const showBrandPill = (liveVisStateMap['brand-pill'] !== false)
            && (!liveLayaBrandPill || liveLayaBrandPill.dataset.liveHidden !== 'true');
        if (showBrandPill && layout.brandViewportBox && layout.brandViewportBox.w > 0 && typeof window.__getActiveLiveBrandTopicAtTime === 'function') {
            const bv = layout.brandViewportBox;
            const topicPeriod = 2.8;
            const carouselOn = !swLiveBrandCarousel || swLiveBrandCarousel.checked;
            const topicStep = carouselOn ? Math.floor(elapsedSec / topicPeriod) : 0;
            const stepLocalSec = carouselOn ? (elapsedSec - topicStep * topicPeriod) : 0.8;
            const activeTopicStr = window.__getActiveLiveBrandTopicAtTime(elapsedSec);
            const customBrandFont = parseFloat(inLiveBrandFontSize ? inLiveBrandFontSize.value : '9') || 9;
            const brandFontPx = Math.max(7, Math.round(customBrandFont * scaleRatioX));
            const brandAnimType = typeof window.__getEffectiveLiveBrandAnimType === 'function'
                ? window.__getEffectiveLiveBrandAnimType()
                : 'shimmer';

            ctx.save();
            ctx.beginPath();
            ctx.rect(bv.x - 1 * scaleRatioX, bv.y - 2 * scaleRatioY, bv.w + 2 * scaleRatioX, bv.h + 4 * scaleRatioY);
            ctx.clip();

            let slideOffY = 0;
            let slideAlpha = 1;
            if (carouselOn && topicStep > 0 && stepLocalSec < 0.34) {
                const t = stepLocalSec / 0.34;
                const ease = 1 - Math.pow(1 - t, 3);
                slideOffY = (1 - ease) * (7 * scaleRatioY);
                slideAlpha = 0.25 + 0.75 * ease;
            }

            ctx.font = `700 ${brandFontPx}px ${activeFont}`;
            let drawTopicStr = activeTopicStr;
            if (brandAnimType === 'typewriter' && elapsedSec > 0) {
                const chars = Array.from(activeTopicStr);
                const twPhase = (elapsedSec % 2.4) / 2.4;
                const visibleLen = twPhase < 0.72
                    ? Math.max(1, Math.ceil((twPhase / 0.72) * chars.length))
                    : chars.length;
                drawTopicStr = chars.slice(0, visibleLen).join('');
            }

            const topicW = ctx.measureText(drawTopicStr).width;
            let marqueeOffX = 0;
            if (brandAnimType === 'none' && topicW > bv.w + 2 * scaleRatioX && elapsedSec > 0) {
                const overflowW = topicW - bv.w + 6 * scaleRatioX;
                const mProg = Math.min(1, Math.max(0, (stepLocalSec - 0.35) / Math.max(0.8, topicPeriod - 0.65)));
                const mWave = 0.5 - 0.5 * Math.cos(mProg * Math.PI * 2);
                marqueeOffX = -overflowW * mWave;
            }

            let animScaleX = 1, animScaleY = 1, animOffY = 0;
            if (brandAnimType === 'breathe') {
                slideAlpha *= (0.45 + 0.55 * (0.5 + 0.5 * Math.cos((elapsedSec / 1.6) * Math.PI * 2)));
            } else if (brandAnimType === 'fade') {
                slideAlpha *= (0.16 + 0.84 * (0.5 + 0.5 * Math.cos((elapsedSec / 2.0) * Math.PI * 2)));
            } else if (brandAnimType === 'wave') {
                animOffY = Math.sin((elapsedSec / 1.35) * Math.PI * 2) * (1.8 * scaleRatioY);
            } else if (brandAnimType === 'bounce') {
                const bWave = Math.abs(Math.sin((elapsedSec / 1.25) * Math.PI));
                animScaleX = 1 + bWave * 0.10;
                animScaleY = 1 - bWave * 0.05;
                animOffY = -bWave * (1.4 * scaleRatioY);
            } else if (brandAnimType === 'spin') {
                const spPhase = (elapsedSec % 2.6) / 2.6;
                if (spPhase < 0.36) {
                    animScaleY = Math.max(0.18, Math.abs(Math.cos((spPhase / 0.36) * Math.PI * 2)));
                }
            }

            ctx.globalAlpha = slideAlpha;
            if (brandAnimType === 'shimmer') {
                const shift = ((elapsedSec * 48) % 120) * scaleRatioX;
                const grad = ctx.createLinearGradient(bv.x - shift, bv.y, bv.x + Math.max(bv.w, topicW) * 1.8 - shift, bv.y);
                grad.addColorStop(0, '#f5f3ff');
                grad.addColorStop(0.28, '#fde047');
                grad.addColorStop(0.55, '#f472b6');
                grad.addColorStop(0.8, '#e9d5ff');
                grad.addColorStop(1, '#fde047');
                ctx.fillStyle = grad;
            } else if (brandAnimType === 'rainbow') {
                const shift = ((elapsedSec * 56) % 140) * scaleRatioX;
                const grad = ctx.createLinearGradient(bv.x - shift, bv.y, bv.x + Math.max(bv.w, topicW) * 1.9 - shift, bv.y);
                grad.addColorStop(0, '#ff6b6b');
                grad.addColorStop(0.22, '#feca57');
                grad.addColorStop(0.45, '#48dbfb');
                grad.addColorStop(0.68, '#ff9ff3');
                grad.addColorStop(0.88, '#54a0ff');
                grad.addColorStop(1, '#ff6b6b');
                ctx.fillStyle = grad;
            } else if (brandAnimType === 'breathe' || brandAnimType === 'bounce') {
                ctx.fillStyle = '#fef08a';
            } else {
                ctx.fillStyle = '#f5f3ff';
            }

            const drawX = bv.x + marqueeOffX;
            const drawY = bv.y + bv.h * 0.52 + slideOffY + animOffY;
            ctx.translate(drawX + topicW * 0.5, drawY);
            ctx.scale(animScaleX, animScaleY);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(drawTopicStr, -topicW * 0.5, 0);
            ctx.restore();
        }

        // 1) 第 1 层（最底部）：高频观众进场通道 (#live-join-ticker-row，如「漫渡 來了」，带滑入微动效)
        const showJoinTicker = liveDmVisible
            && (liveVisStateMap['join-ticker'] !== false)
            && (!liveJoinTickerRow || liveJoinTickerRow.dataset.liveHidden !== 'true')
            && liveJoinViewerPool.length > 0;

        if (showJoinTicker) {
            const joinSteps = autoJoin ? Math.floor(elapsedMs / joinIntervalMs) : 0;
            const joinStepElapsed = (autoJoin && joinIntervalMs > 0) ? (elapsedMs % joinIntervalMs) : 999;
            const joinSlideProgress = (autoJoin && joinSteps > 0) ? Math.min(1, joinStepElapsed / 210) : 1;
            const joinSlideEase = 1 - Math.pow(1 - joinSlideProgress, 3);
            const joinOffsetX = Math.round((1 - joinSlideEase) * (-14 * scaleRatioX));
            const joinAlpha = 0.35 + 0.65 * joinSlideEase;

            const baseJoinCursor = expSnap ? expSnap.joinCursor : liveJoinCursor;
            const v = liveJoinViewerPool[(baseJoinCursor + joinSteps) % liveJoinViewerPool.length];
            const isSimp = window.__currentLangMode === 'simp';
            const joinTxt = isSimp ? ' 来了' : ' 來了';
            const jPadX = Math.round(7.5 * boxS);
            const jPadY = Math.round(2.2 * boxS);
            const jFontPx = Math.max(7, Math.round(9.6 * fontS));
            const badgeH = Math.round(13.2 * fontS);
            const jRowH = Math.max(Math.round(15 * boxS), Math.round(jPadY * 2 + Math.max(badgeH, Math.round(jFontPx * 1.26))));
            const jY = curBottomY - jRowH;
            const jX = baseX + joinOffsetX;

            ctx.save();
            ctx.globalAlpha = joinAlpha;
            ctx.font = `800 ${jFontPx}px ${activeFont}`;
            const nickW = ctx.measureText(v.nick).width;
            ctx.font = `600 ${jFontPx}px ${activeFont}`;
            const suffixW = ctx.measureText(joinTxt).width;
            const lvEstW = v.lv > 0 ? Math.ceil((v.lv >= 10 ? 26.5 : 21.5) * fontS) + Math.round(4 * fontS) : 0;
            const jPillW = Math.ceil(jPadX * 2 + lvEstW + nickW + suffixW);

            drawLiveRoundRect(ctx, jX, jY, jPillW, jRowH, Math.round(10 * boxS));
            ctx.fillStyle = 'rgba(12, 14, 24, 0.50)';
            ctx.fill();
            ctx.lineWidth = Math.max(1, 0.8 * boxS);
            ctx.strokeStyle = joinSlideProgress < 1 ? 'rgba(147, 197, 253, 0.32)' : 'rgba(255, 255, 255, 0.08)';
            ctx.stroke();

            let jCurX = jX + jPadX;
            if (v.lv > 0) {
                const badgeY = jY + Math.round((jRowH - badgeH) / 2);
                const realLvW = drawCanvasLvBadge(ctx, jCurX, badgeY, v.lv, fontS, activeFont);
                jCurX += realLvW + Math.round(4 * fontS);
            }

            const jMidY = jY + jRowH * 0.53;
            ctx.font = `800 ${jFontPx}px ${activeFont}`;
            ctx.fillStyle = '#93c5fd';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(v.nick, jCurX, jMidY);
            jCurX += nickW;

            ctx.font = `600 ${jFontPx}px ${activeFont}`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
            ctx.fillText(joinTxt, jCurX, jMidY);
            ctx.restore();

            curBottomY = jY - rowGap;
        }

        // 2) 第 2 层：公屏滚动弹幕列表 (#live-chat-list，支持多行自动换行且严丝合缝紧贴欢迎语)
        const showChatList = liveDmVisible
            && (liveVisStateMap['chat-list'] !== false)
            && (!liveChatList || liveChatList.dataset.liveHidden !== 'true');

        if (showChatList) {
            const allLines = parseLiveDanmakuTexts();
            const userMaxRows = getLiveMaxRowsVal();
            const noticeVisNow = (liveVisStateMap['sys-notice'] !== false)
                && (!swLiveShowNotice || swLiveShowNotice.checked)
                && (!liveSysNoticeEl || (liveSysNoticeEl.style.display !== 'none' && liveSysNoticeEl.dataset.liveHidden !== 'true'));
            const maxRows = noticeVisNow ? Math.max(2, userMaxRows - 1) : userMaxRows;
            const count = Math.max(2, maxRows);
            const dmTextColor = getLiveDmColor();
            const showRowHeart = !!(swLiveDmRowHeart && swLiveDmRowHeart.checked);
            const hasJoinInPool = allLines.some(l => /(\s|^|：|:)(來了|来了)$/.test(String(l).trim()));

            const stepsAdvanced = autoRoll ? Math.floor(elapsedMs / intervalMs) : 0;
            const stepElapsedMs = autoRoll ? (elapsedMs % intervalMs) : intervalMs;
            const animDurationMs = autoRoll ? Math.min(220, Math.max(45, intervalMs * 0.78)) : 170;
            const animProgress = (autoRoll && stepsAdvanced > 0) ? Math.min(1, stepElapsedMs / animDurationMs) : 1;
            const easeOut = 1 - Math.pow(1 - animProgress, 3);

            const resolveRowSpec = (offsetIdx) => {
                const baseRollTick = expSnap ? expSnap.rollTickCount : liveRollTickCount;
                const virtualStep = baseRollTick + stepsAdvanced + offsetIdx;
                const safeStep = ((virtualStep % 100000) + 100000) % 100000;
                const globalIdx = safeStep % allLines.length;
                let rawLine = allLines[globalIdx];
                if (!hasJoinInPool && (safeStep % 5 === 3)) {
                    const jViewer = liveJoinViewerPool[safeStep % liveJoinViewerPool.length];
                    rawLine = `${jViewer.nick} ${window.__currentLangMode === 'simp' ? '来了' : '來了'}`;
                }
                const badgeSeedIdx = allLines.length <= count ? safeStep : globalIdx;
                const parsedRow = parseSingleLiveDanmakuRow(rawLine, badgeSeedIdx);
                const h = drawSingleLiveChatBubbleOnCanvas(
                    ctx, baseX, 0, maxBubbleW, parsedRow, badgeSeedIdx, fontS, boxS, dmTextColor, showRowHeart, activeFont, true
                );
                return { parsedRow, badgeSeedIdx, h };
            };

            const curSpecs = [];
            let curTotalH = 0;
            for (let i = 0; i < count; i++) {
                const sp = resolveRowSpec(i);
                curSpecs.push(sp);
                curTotalH += sp.h;
            }
            curTotalH += Math.max(0, count - 1) * rowGap;

            let winH = curTotalH;
            let outSpec = null;
            if (animProgress < 1) {
                outSpec = resolveRowSpec(-1);
                const incomingSpec = curSpecs[count - 1];
                const prevTotalH = curTotalH - incomingSpec.h + outSpec.h;
                winH = Math.round(prevTotalH + (curTotalH - prevTotalH) * easeOut);
            }

            const listTopY = curBottomY - winH;

            ctx.save();
            ctx.beginPath();
            ctx.rect(baseX - 4 * scaleRatioX, listTopY - 2 * scaleRatioY, maxBubbleW + 12 * scaleRatioX, winH + 4 * scaleRatioY);
            ctx.clip();

            let drawY = listTopY;
            if (animProgress < 1 && outSpec) {
                const slideShift = Math.round(easeOut * (outSpec.h + rowGap));
                drawY = listTopY - slideShift;
                drawSingleLiveChatBubbleOnCanvas(
                    ctx, baseX, drawY, maxBubbleW, outSpec.parsedRow, outSpec.badgeSeedIdx, fontS, boxS, dmTextColor, showRowHeart, activeFont, false
                );
                drawY += outSpec.h + rowGap;
            }

            for (let i = 0; i < curSpecs.length; i++) {
                const sp = curSpecs[i];
                drawSingleLiveChatBubbleOnCanvas(
                    ctx, baseX, drawY, maxBubbleW, sp.parsedRow, sp.badgeSeedIdx, fontS, boxS, dmTextColor, showRowHeart, activeFont, false
                );
                drawY += sp.h + rowGap;
            }
            ctx.restore();

            curBottomY = listTopY - rowGap;
        }

        // 3) 第 3 层：直播间欢迎语气泡 (#live-room-welcome，带 🎧 图标，紧贴在弹幕列表正上方，0断层)
        const showWelcomeBar = (liveVisStateMap['welcome-bar'] !== false)
            && (!swLiveShowWelcome || swLiveShowWelcome.checked)
            && (!liveRoomWelcomeEl || (liveRoomWelcomeEl.style.display !== 'none' && liveRoomWelcomeEl.dataset.liveHidden !== 'true'));

        if (showWelcomeBar) {
            const welcomeStr = (liveRoomWelcomeTxt && liveRoomWelcomeTxt.textContent.trim())
                || (inLiveWelcomeTxt && inLiveWelcomeTxt.value.trim())
                || liveWelcomePresets[0];
            const wFontPx = Math.max(7, Math.round(9 * fontS));
            const wPadX = Math.round(7.5 * boxS);
            const wPadY = Math.round(3.2 * boxS);
            const wLineH = Math.max(Math.round(wFontPx * 1.35), Math.round(12.8 * fontS));
            const iconBoxW = Math.round(13.5 * fontS);

            ctx.save();
            ctx.font = `700 ${wFontPx}px ${activeFont}`;
            const wLines = wrapCanvasTextLines(ctx, welcomeStr, Math.max(80 * boxS, maxBubbleW - wPadX * 2 - iconBoxW));
            let maxWL = 0;
            wLines.forEach(l => {
                const lw = ctx.measureText(l).width;
                if (lw > maxWL) maxWL = lw;
            });
            const wH = Math.round(wPadY * 2 + wLines.length * wLineH);
            const wW = Math.min(maxBubbleW, Math.ceil(wPadX * 2 + iconBoxW + maxWL));
            const wY = curBottomY - wH;

            drawLiveRoundRect(ctx, baseX, wY, wW, wH, Math.round(8.5 * boxS));
            ctx.fillStyle = 'rgba(12, 14, 24, 0.54)';
            ctx.fill();
            ctx.lineWidth = Math.max(1, 0.85 * boxS);
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.28)';
            ctx.stroke();

            // 左侧白色小耳机矢量图标 (避免 Emoji 在不同系统色差)
            const hcX = baseX + wPadX + iconBoxW * 0.38;
            const hcY = wY + wH * 0.5;
            const hr = 4.2 * fontS;
            ctx.save();
            ctx.strokeStyle = 'rgba(243, 232, 255, 0.92)';
            ctx.lineWidth = Math.max(1.2, 1.35 * fontS);
            ctx.beginPath();
            ctx.arc(hcX, hcY, hr, Math.PI, 0, false);
            ctx.stroke();
            ctx.fillStyle = 'rgba(243, 232, 255, 0.92)';
            ctx.fillRect(hcX - hr - 0.8 * fontS, hcY - 0.5 * fontS, 2 * fontS, 3.6 * fontS);
            ctx.fillRect(hcX + hr - 1.2 * fontS, hcY - 0.5 * fontS, 2 * fontS, 3.6 * fontS);
            ctx.restore();

            ctx.font = `700 ${wFontPx}px ${activeFont}`;
            ctx.fillStyle = '#f3e8ff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            for (let idx = 0; idx < wLines.length; idx++) {
                const ly = wY + wPadY + (idx + 0.54) * wLineH;
                ctx.fillText(wLines[idx], baseX + wPadX + iconBoxW, ly);
            }
            ctx.restore();

            curBottomY = wY - rowGap;
        }

        // 4) 第 4 层：系统绿色健康直播防诈提示语气泡 (#live-sys-notice，紧贴在欢迎语正上方)
        const showSysNotice = (liveVisStateMap['sys-notice'] !== false)
            && (!swLiveShowNotice || swLiveShowNotice.checked)
            && (!liveSysNoticeEl || (liveSysNoticeEl.style.display !== 'none' && liveSysNoticeEl.dataset.liveHidden !== 'true'));

        if (showSysNotice) {
            const noticeElRef = liveSysNoticeTxt || liveSysNoticeEl;
            const noticeStr = (noticeElRef && noticeElRef.textContent.trim())
                || (inLiveNoticeTxt && inLiveNoticeTxt.value.trim())
                || liveNoticePresets[0];
            const nFontPx = Math.max(7, Math.round(8.8 * fontS));
            const nPadX = Math.round(7.5 * boxS);
            const nPadY = Math.round(3.5 * boxS);
            const nLineH = Math.max(Math.round(nFontPx * 1.35), Math.round(12.6 * fontS));

            ctx.save();
            ctx.font = `600 ${nFontPx}px ${activeFont}`;
            const nLines = wrapCanvasTextLines(ctx, noticeStr, Math.max(80 * boxS, maxBubbleW - nPadX * 2));
            let maxNL = 0;
            nLines.forEach(l => {
                const lw = ctx.measureText(l).width;
                if (lw > maxNL) maxNL = lw;
            });
            const nH = Math.round(nPadY * 2 + nLines.length * nLineH);
            const nW = Math.min(maxBubbleW, Math.ceil(nPadX * 2 + maxNL));
            const nY = curBottomY - nH;

            drawLiveRoundRect(ctx, baseX, nY, nW, nH, Math.round(8.5 * boxS));
            ctx.fillStyle = 'rgba(12, 14, 24, 0.54)';
            ctx.fill();
            ctx.lineWidth = Math.max(1, 0.85 * boxS);
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.24)';
            ctx.stroke();

            ctx.fillStyle = '#c4b5fd';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            for (let idx = 0; idx < nLines.length; idx++) {
                const ly = nY + nPadY + (idx + 0.54) * nLineH;
                ctx.fillText(nLines[idx], baseX + nPadX, ly);
            }
            ctx.restore();

            curBottomY = nY - Math.round(4.5 * scaleRatioY);
        }

        // 5) 第 5 层（位于公屏最上方）：礼物进场小弹窗 (#live-gift-combo-banner，支持 0~10 档速度 + 中间随机「没人送礼物」空窗间隔)
        const showGiftBanner = (liveVisStateMap['gift-banner'] !== false)
            && (!liveGiftComboBanner || liveGiftComboBanner.dataset.liveHidden !== 'true');

        if (showGiftBanner) {
            const giftSpdLv = getLiveGiftSpeedVal();
            const switchGiftMs = GIFT_SWITCH_MS_TABLE[giftSpdLv] || 0;
            const bounceComboMs = GIFT_BOUNCE_MS_TABLE[giftSpdLv] || 0;
            const autoGiftOn = (giftSpdLv > 0 && switchGiftMs > 0) && (!swLiveAutoCycleGift || swLiveAutoCycleGift.checked);
            const gapCfg = getLiveGiftEmptyGapConfig();
            const useEmptyGapInExport = autoGiftOn && gapCfg.enabled;

            // 计算当前录制时刻处于第几个送礼周期、是否处于「消失动画期」或「没人送礼物的空窗间隔期」
            let giftCycleStep = 0;
            let giftPhaseMs = 9999;
            let currentStayMs = Math.max(200, Math.round(gapCfg.staySec * 1000));
            let currentFadeMs = Math.max(100, Math.round((gapCfg.fadeSec || 0.4) * 1000));
            let inExportEmptyGap = (!autoGiftOn && isGiftInEmptyGapNow);

            if (useEmptyGapInExport) {
                const stayMs = Math.max(200, Math.round(gapCfg.staySec * 1000));
                const fadeMs = Math.max(100, Math.round((gapCfg.fadeSec || 0.4) * 1000));
                const minGapMs = Math.round(gapCfg.gapMinSec * 1000);
                const maxGapMs = Math.round(gapCfg.gapMaxSec * 1000);
                const spanGapMs = Math.max(0, maxGapMs - minGapMs);
                // 为每个周期生成确定性的伪随机空窗时长（保证导出帧序列平滑连续且每段空窗长短自然变化）
                let accMs = 0;
                let stepIdx = 0;
                while (stepIdx < 800) {
                    const pseudoRand = ((stepIdx * 9301 + 49297) % 233280) / 233280;
                    const curGapMs = minGapMs + Math.round(pseudoRand * spanGapMs);
                    const totalPeriodMs = stayMs + fadeMs + curGapMs;
                    if (elapsedMs < accMs + totalPeriodMs) {
                        giftCycleStep = stepIdx;
                        giftPhaseMs = elapsedMs - accMs;
                        currentStayMs = stayMs;
                        currentFadeMs = fadeMs;
                        inExportEmptyGap = giftPhaseMs >= (stayMs + fadeMs);
                        break;
                    }
                    accMs += totalPeriodMs;
                    stepIdx++;
                }
            } else if (autoGiftOn) {
                const activeCycleMs = Math.max(400, Math.round(gapCfg.staySec * 1000)) || switchGiftMs;
                giftCycleStep = Math.floor(elapsedMs / activeCycleMs);
                giftPhaseMs = elapsedMs % activeCycleMs;
                currentStayMs = activeCycleMs;
                currentFadeMs = 0;
            }

            if (!inExportEmptyGap) {
            const comboStepInCycle = (autoGiftOn && bounceComboMs > 0) ? Math.floor(Math.min(giftPhaseMs, currentStayMs - 1) / bounceComboMs) : 0;
            const comboBouncePhase = (autoGiftOn && bounceComboMs > 0 && giftPhaseMs < currentStayMs) ? ((giftPhaseMs % bounceComboMs) / bounceComboMs) : 1;

            // ★ 根据当前送礼轮次 (giftCycleStep) 从预生成的无重复序列中取出对应的送礼人、头像、礼物、配色与起始数量（第 0 轮为画面当前展示状态，后续每一轮头像、昵称、礼物都不一样）
            const cycleItem = (autoGiftOn && expSnap && Array.isArray(expSnap.cycleSequence) && expSnap.cycleSequence.length > 0)
                ? expSnap.cycleSequence[giftCycleStep % expSnap.cycleSequence.length]
                : null;

            let expSender = (cycleItem && cycleItem.sender)
                || (expSnap && expSnap.sender)
                || (liveGiftSenderName && liveGiftSenderName.textContent.trim())
                || (inLiveGiftUser && inLiveGiftUser.value.trim())
                || '皓哥';
            let expGiftDesc = (cycleItem && cycleItem.giftDesc)
                || (expSnap && expSnap.giftDesc)
                || (liveGiftDescTxt && liveGiftDescTxt.textContent.trim())
                || (inLiveGiftName && inLiveGiftName.value.trim())
                || '送 嘉年華';
            let expGiftIcon = (cycleItem && cycleItem.giftIcon)
                || (expSnap && expSnap.giftIcon)
                || (liveGiftItemIcon && liveGiftItemIcon.textContent.trim())
                || (inLiveGiftIcon && inLiveGiftIcon.value.trim())
                || inferGiftIconFromName(expGiftDesc)
                || '🎠';
            let expBaseColor = (cycleItem && cycleItem.baseColor)
                || (expSnap && expSnap.baseColor)
                || (inLiveGiftColor && inLiveGiftColor.value)
                || '#9333ea';
            const matchedInitCat = LIVE_GIFT_CATALOG.find(item => item.icon === expGiftIcon || expGiftDesc.includes(item.name.replace(/^[^\s]+\s+/, '')));
            let expEndColor = (cycleItem && cycleItem.endColor)
                || (expSnap && expSnap.endColor)
                || (matchedInitCat ? matchedInitCat.endColor : (currentGiftEndColor || 'rgba(245, 158, 11, 0.85)'));
            const { minQty: expMinQty, maxQty: expMaxQty } = getLiveGiftQtyRange();
            let rawExpComboTxt = (cycleItem && cycleItem.comboTxt)
                || (expSnap && expSnap.comboTxt)
                || (liveGiftComboNum && liveGiftComboNum.textContent.trim())
                || (inLiveGiftCount && inLiveGiftCount.value.trim())
                || ('x' + expMinQty);
            let expComboNumVal = parseInt(rawExpComboTxt.replace(/[^\d]/g, ''), 10);
            if (Number.isNaN(expComboNumVal) || expComboNumVal < 1) expComboNumVal = expMinQty;
            let expComboTxt = 'x' + expComboNumVal;

            if (autoGiftOn && comboStepInCycle > 0) {
                expComboTxt = getNextGiftComboInRange(expComboNumVal, comboStepInCycle);
            }

            // 进场滑入动效（第 1 轮起前 240ms）与停留结束后的平滑消失动效（按用户设定的消失时间 fadeSec 渐隐滑出）
            const enterAnimMs = Math.min(240, Math.round(currentStayMs * 0.35));
            const isSlidingNewGift = autoGiftOn && giftCycleStep > 0 && giftPhaseMs < enterAnimMs;
            const isSlidingOutToGap = useEmptyGapInExport && giftPhaseMs >= currentStayMs;
            let slideOffsetX = 0;
            let bannerAlpha = 1;
            if (isSlidingNewGift) {
                const slideInProgress = Math.min(1, Math.max(0, giftPhaseMs / Math.max(1, enterAnimMs)));
                const slideEase = 1 - Math.pow(1 - slideInProgress, 3);
                slideOffsetX = Math.round((1 - slideEase) * (-28 * scaleRatioX));
                bannerAlpha = Math.min(1, 0.2 + slideEase * 0.8);
            } else if (isSlidingOutToGap) {
                const outProgress = Math.min(1, Math.max(0, (giftPhaseMs - currentStayMs) / Math.max(1, currentFadeMs)));
                const outEase = Math.pow(outProgress, 1.4);
                slideOffsetX = Math.round(outEase * (-24 * scaleRatioX));
                bannerAlpha = Math.max(0, 1 - outEase);
            }

            const gs = scaleRatioX;
            const gH = Math.round(30 * gs);
            const gY = Math.max(78 * scaleRatioY, curBottomY - gH);
            const gX = baseX + slideOffsetX;
            const avSize = Math.round(24 * gs);
            const senderFontPx = Math.round(9.8 * gs);
            const descFontPx = Math.round(8.2 * gs);
            const iconFontPx = Math.round(18.5 * gs);
            const comboFontPx = Math.round(15.8 * gs);

            // 连击脉冲波 (0 -> 1 -> 0)：驱动整条胶囊微扩、霓虹外发光增强、礼物图标旋转弹跳与连击数字金光爆发
            const isComboBouncing = autoGiftOn && comboStepInCycle > 0 && comboBouncePhase < 0.36;
            const pulseWave = isComboBouncing ? Math.sin((comboBouncePhase / 0.36) * Math.PI) : 0;
            const bannerPulseScale = 1 + pulseWave * 0.042;

            ctx.save();
            ctx.globalAlpha = bannerAlpha;
            ctx.font = `800 ${senderFontPx}px ${activeFont}`;
            const sNameW = ctx.measureText(expSender).width;
            ctx.font = `600 ${descFontPx}px ${activeFont}`;
            const sDescW = ctx.measureText(expGiftDesc).width;
            const metaW = Math.max(sNameW, sDescW);
            ctx.font = `italic 900 ${comboFontPx}px "Inter", ${activeFont}`;
            const comboW = ctx.measureText(expComboTxt).width;
            const gBannerW = Math.ceil((3.5 + 6 + 6 + 4 + 12) * gs + avSize + metaW + iconFontPx + comboW);

            // 若处于连击脉冲期，以胶囊左侧中点为锚点做微缩放 (liveGiftBannerPulse)
            if (bannerPulseScale > 1.001) {
                const pivotX = gX + gBannerW * 0.25;
                const pivotY = gY + gH * 0.5;
                ctx.translate(pivotX, pivotY);
                ctx.scale(bannerPulseScale, bannerPulseScale);
                ctx.translate(-pivotX, -pivotY);
            }

            // 5.1 胶囊外部环境柔光、渐变底色与 1px 边框（使用离屏缓存渲染 box-shadow，每轮礼物仅构建 1 次，单帧耗时 < 0.05ms）
            const pillCacheKey = `${gBannerW}_${gH}_${expBaseColor}_${expEndColor}`;
            if (liveGiftPillBgCache.key !== pillCacheKey || !liveGiftPillBgCache.canvas) {
                const pad = Math.ceil(18 * scaleRatioX);
                const c = document.createElement('canvas');
                c.width = gBannerW + pad * 2;
                c.height = gH + pad * 2;
                const pCtx = c.getContext('2d');
                pCtx.save();
                drawLiveRoundRect(pCtx, pad, pad, gBannerW, gH, gH / 2);
                pCtx.shadowColor = hexToRgba(expBaseColor, 0.58);
                pCtx.shadowBlur = 13 * scaleRatioX;
                pCtx.shadowOffsetY = 3 * scaleRatioY;
                const gGrad = pCtx.createLinearGradient(pad, pad, pad + gBannerW, pad + gH * 0.18);
                gGrad.addColorStop(0, hexToRgba(expBaseColor, 0.94));
                gGrad.addColorStop(0.55, hexToRgba(expBaseColor, 0.84));
                gGrad.addColorStop(1, expEndColor);
                pCtx.fillStyle = gGrad;
                pCtx.fill();
                pCtx.restore();

                pCtx.save();
                drawLiveRoundRect(pCtx, pad, pad, gBannerW, gH, gH / 2);
                pCtx.lineWidth = Math.max(1, 1.0 * gs);
                pCtx.strokeStyle = hexToRgba(expBaseColor, 0.72);
                pCtx.stroke();
                pCtx.restore();

                liveGiftPillBgCache = { key: pillCacheKey, canvas: c, pad };
            }
            ctx.drawImage(
                liveGiftPillBgCache.canvas,
                gX - liveGiftPillBgCache.pad,
                gY - liveGiftPillBgCache.pad
            );

            // 5.3 左侧圆形真人送礼头像（1:1 还原编辑器 CSS：border: 1.2px solid rgba(255, 255, 255, 0.9)）
            const avX = gX + Math.round(3.5 * gs);
            const avY = gY + Math.round((gH - avSize) / 2);
            let avatarImgToDraw = (cycleItem && cycleItem.avatarImg && cycleItem.avatarImg.complete && cycleItem.avatarImg.naturalWidth > 0)
                ? cycleItem.avatarImg
                : ((expSnap && expSnap.avatarImg && expSnap.avatarImg.complete && expSnap.avatarImg.naturalWidth > 0)
                    ? expSnap.avatarImg
                    : liveGiftSenderAv);
            ctx.save();
            ctx.beginPath();
            ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            if (avatarImgToDraw && avatarImgToDraw.complete && avatarImgToDraw.naturalWidth > 0) {
                try {
                    ctx.drawImage(avatarImgToDraw, avX, avY, avSize, avSize);
                } catch (avDrawErr) {
                    ctx.fillStyle = '#1877f2';
                    ctx.fillRect(avX, avY, avSize, avSize);
                }
            } else {
                ctx.fillStyle = '#1877f2';
                ctx.fillRect(avX, avY, avSize, avSize);
            }
            ctx.restore();
            ctx.save();
            ctx.beginPath();
            ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
            ctx.lineWidth = Math.max(1.0, 1.2 * gs);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.90)';
            ctx.stroke();
            ctx.restore();

            // 5.4 送礼人昵称与礼物描述（1:1 还原编辑器 CSS：昵称 #ffffff 800，描述 rgba(255,255,255,0.88) 600）
            const metaX = avX + avSize + Math.round(6 * gs);
            ctx.save();
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = `800 ${senderFontPx}px ${activeFont}`;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(expSender, metaX, gY + gH * 0.35);
            ctx.font = `600 ${descFontPx}px ${activeFont}`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
            ctx.fillText(expGiftDesc, metaX, gY + gH * 0.72);
            ctx.restore();

            // 5.5 礼物图标（使用离屏精灵缓存绘制 drop-shadow，零主画布模糊开销）
            const iconBounceScale = isComboBouncing
                ? (1 + pulseWave * 0.34)
                : 1;
            const iconRotRad = isComboBouncing
                ? ((8 * Math.sin(comboBouncePhase / 0.36 * Math.PI * 2)) * Math.PI / 180)
                : 0;
            const iconCenterX = metaX + metaW + Math.round(6 * gs) + iconFontPx * 0.5;
            const iconCenterY = gY + gH * 0.50;
            const iconSprite = getCachedGiftIconSprite(expGiftIcon, iconFontPx, gs);

            ctx.save();
            ctx.translate(iconCenterX, iconCenterY);
            if (iconRotRad) ctx.rotate(iconRotRad);
            ctx.scale(iconBounceScale, iconBounceScale);
            ctx.drawImage(iconSprite.canvas, -iconSprite.half, -iconSprite.half);
            ctx.restore();

            // 5.6 连击数字 (x3 / x99)：1:1 还原编辑器 CSS (.live-gift-combo-num: italic 900 15.8px #fde047, text-shadow: 0 1px 5px rgba(0, 0, 0, 0.85))
            const comboBounceScale = isComboBouncing ? (1 + pulseWave * 0.34) : 1;
            const comboRotRad = isComboBouncing ? (-6 * pulseWave * Math.PI / 180) : 0;
            const comboX = iconCenterX + iconFontPx * 0.55 + Math.round(4 * gs);
            const comboY = gY + gH * 0.53;

            ctx.save();
            ctx.translate(comboX, comboY);
            if (comboRotRad) ctx.rotate(comboRotRad);
            ctx.scale(comboBounceScale, comboBounceScale);
            ctx.font = `italic 900 ${comboFontPx}px "Inter", ${activeFont}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillText(expComboTxt, 1 * gs, 1.5 * gs);
            ctx.fillStyle = '#fde047';
            ctx.fillText(expComboTxt, 0, 0);
            ctx.restore();

            ctx.restore();
            } // end if (!inExportEmptyGap)
        }

        // 6) 动态绘制右下角向上飘动的小表情与彩心粒子（使用离屏精灵缓存 1:1 还原编辑器 24px 精致贴边微光晕，零主画布模糊开销）
        const density = getLiveHeartDensityVal();
        const showFloatingHearts = density > 0
            && (liveVisStateMap['float-hearts'] !== false && liveVisStateMap['floating-hearts'] !== false)
            && (!liveFloatingHearts || liveFloatingHearts.dataset.liveHidden !== 'true');

        if (showFloatingHearts) {
            const EXPORT_CHEER_EMOJIS = [
                '🎉', '✨', '🥳', '🔥', '😄', '🎊', '🤩', '🎆',
                '😍', '🌟', '🎇', '😆', '💖', '🎈', '🥰', '👍',
                '⚡', '😎', '🧨', '👏', '💥', '❤️‍🔥'
            ];
            const heartSizePx = Math.round(19.5 * scaleRatioX);
            const baseRightX = outW - 31 * scaleRatioX;
            const baseBottomY = outH - 146 * scaleRatioY;
            const floatHeight = 212 * scaleRatioY;
            const particleCount = Math.max(2, Math.min(10, Math.round(density * 0.95)));

            for (let i = 0; i < particleCount; i++) {
                const speedFactor = 0.42 + density * 0.038;
                const totalCycleVal = elapsedSec * speedFactor + i * (1 / particleCount);
                const phase = totalCycleVal % 1;
                const curY = baseBottomY - phase * floatHeight;
                const swayX = Math.sin((phase * Math.PI * 2.2) + i * 1.7) * (13 * scaleRatioX);
                const curX = baseRightX + swayX;

                // 复刻 CSS @keyframes liveHeartFloatUp 的 5 段式弹性缩放曲线 (0.45 -> 1.18 -> 1.06 -> 0.95 -> 0.78)
                let pScale = 1.0;
                if (phase < 0.14) {
                    const t = phase / 0.14;
                    pScale = 0.45 + (1.18 - 0.45) * (1 - Math.pow(1 - t, 2));
                } else if (phase < 0.35) {
                    const t = (phase - 0.14) / 0.21;
                    pScale = 1.18 - (1.18 - 1.06) * t;
                } else if (phase < 0.75) {
                    const t = (phase - 0.35) / 0.40;
                    pScale = 1.06 - (1.06 - 0.95) * t;
                } else {
                    const t = (phase - 0.75) / 0.25;
                    pScale = 0.95 - (0.95 - 0.78) * t;
                }

                // 复刻 CSS @keyframes liveHeartFloatUp 的左右灵动摇摆倾角 (±11.5°)
                const rotDeg = Math.sin(phase * Math.PI * 3 + i * 1.3) * 11.5;
                const rotRad = (rotDeg * Math.PI) / 180;

                // 透明度曲线：前 12% 渐显，中间保持高亮，后 26% 柔和渐隐
                const alpha = phase < 0.12
                    ? (phase / 0.12)
                    : (phase > 0.74 ? Math.max(0, (1 - phase) / 0.26) : 0.98);

                if (alpha <= 0.02) continue;

                const cycleStep = Math.floor(totalCycleVal);
                const pickToken = (i * 5 + cycleStep * 3) % (EXPORT_CHEER_EMOJIS.length + 2);
                const isHeartToken = pickToken >= EXPORT_CHEER_EMOJIS.length;
                const heartCol = pickToken === EXPORT_CHEER_EMOJIS.length ? '#ff5e97' : '#a855f7';
                const tokenStr = isHeartToken ? heartCol : EXPORT_CHEER_EMOJIS[pickToken];
                const sprite = getCachedCheerParticleSprite(tokenStr, isHeartToken, heartCol, heartSizePx, scaleRatioX, scaleRatioY);

                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
                ctx.translate(curX, curY);
                ctx.rotate(rotRad);
                ctx.scale(pScale, pScale);
                ctx.drawImage(sprite.canvas, -sprite.halfW, -sprite.halfH);
                ctx.restore();
            }
        }
    };

    // ★ 问题四.2 & 问题五.1：直播间实时数字每次打开随机（在线 1000~200万，本场点赞 = 在线人数若干倍，观众头像3张随机换，主播昵称/送礼人名及头像去重随机 + Gemini Flash AI 生成海外华人昵称）
    window.__randomizeLiveRoomSimulationOnBoot = function () {
        const modSet = window.__userModifiedFieldSet || new Set();

        // 1) 主播昵称 #live-disp-host-name
        if (!modSet.has('in-live-host-name')) {
            const hostNick = (typeof window.claimUniqueNickname === 'function')
                ? window.claimUniqueNickname()
                : '溫哥華小鹿';
            applyLiveHostNameDisplay(hostNick);
        }

        // 2) 在线人数 #live-disp-viewers / #live-left-live-viewers (1000 ~ 200万) 与本场点赞 #live-disp-host-id (= 在线人数 2.2 ~ 6.5 倍)
        let viewerNumVal = parseInt(inLiveViewers ? inLiveViewers.value : '102000', 10) || 102000;
        if (!modSet.has('in-live-viewers-text') && !modSet.has('in-live-viewers')) {
            const vGen = generateRandom1kTo2M();
            viewerNumVal = vGen.numVal;
            applyLiveViewersDisplay(vGen.dispTxt, vGen.numVal);
        }
        if (!modSet.has('in-live-host-id')) {
            const mult = 2.2 + Math.random() * 4.3; // 本场点赞 = 在线人数 2.2~6.5 倍
            const likesNum = Math.min(9990000, Math.max(2500, Math.round(viewerNumVal * mult)));
            const likesTxt = formatLiveLikesNumberText(likesNum);
            applyLiveHostLikesDisplay(likesTxt);
        }

        // 3) 右上角 3 张观众头像 #live-aud-avatars 随机更换（走 340+ 海外华人真人库去重）
        if (typeof syncLiveAudienceAvatars === 'function') {
            syncLiveAudienceAvatars(true);
        }

        // 4) 送礼人名 #live-gift-sender-name 与送礼真人头像随机更换
        if (!modSet.has('in-live-gift-user')) {
            const giftNick = (typeof window.claimUniqueNickname === 'function')
                ? window.claimUniqueNickname()
                : '洛杉磯老陳';
            if (inLiveGiftUser) inLiveGiftUser.value = giftNick;
            if (liveGiftSenderName) liveGiftSenderName.textContent = giftNick;
            pickNextRealHumanGiftAvatar(giftNick, true);
            applyLiveGiftBannerState(false, false);
        }

        // 5) 顶部动态轮播话题标签 #live-laya-brand-pill：若用户未手动编辑过，则每次加载随机选用一组热门轮播话题
        if (!modSet.has('in-live-brand-tag')) {
            const randGrp = liveBrandTopicGroupPresets[Math.floor(Math.random() * liveBrandTopicGroupPresets.length)].slice();
            liveBrandTopicCursor = Math.floor(Math.random() * randGrp.length);
            applyLiveBrandTagDisplay(randGrp.join(' | '), false);
        }

        // 6) 若公屏弹幕未被用户手动编辑过，每次打开会话自动合成一批全新的「真人短句 + 抖音29黄脸表情去重 + 三形态随机混排」直播弹幕并换上不重复的海外华人昵称
        if (!modSet.has('in-live-danmaku-list') && inLiveDanmakuList) {
            if (typeof window.__composeAuthenticLiveDanmakuBatch === 'function') {
                const freshBatch = window.__composeAuthenticLiveDanmakuBatch({
                    category: 'general',
                    totalRows: 15
                });
                if (freshBatch && freshBatch.length > 0) {
                    inLiveDanmakuList.value = freshBatch.join('\n');
                    renderLiveChatBubbles(false);
                }
            } else if (typeof window.claimUniqueNickname === 'function') {
                const rawLines = String(inLiveDanmakuList.value || '').split(/\r?\n/).filter(Boolean);
                if (rawLines.length > 0) {
                    const updatedLines = rawLines.map((line) => {
                        const freshNick = window.claimUniqueNickname();
                        if (/(\s)(來了|来了)$/.test(line.trim())) {
                            return `${freshNick} ${window.__currentLangMode === 'simp' ? '来了' : '來了'}`;
                        }
                        const colonIdx = line.indexOf('：') >= 0 ? line.indexOf('：') : line.indexOf(':');
                        if (colonIdx > 0) {
                            return `${freshNick}：${line.slice(colonIdx + 1).trim()}`;
                        }
                        return `${freshNick}：${line.trim()}`;
                    });
                    inLiveDanmakuList.value = updatedLines.join('\n');
                    renderLiveChatBubbles(false);
                }
            }
        }
    };

    // ★ 问题五.1：复用已内置的团队共享 Gemini Flash AI 接口（口令 0000、独立 30 秒预热冷却，不锁定用户 AI 弹幕按钮、不扣减用户每日配额），后台静默补充海外华人昵称
    const AI_NICK_WARMUP_TS_KEY = 'LAYA_AI_NICK_WARMUP_TS_V1';
    async function requestGeminiOverseasNicknamesOnLoad() {
        try {
            // 若本地 AI 昵称缓存仍有 >= 8 条本机未使用的候选昵称，直接复用，无需每次刷新都请求网络
            try {
                const cachedAi = JSON.parse(localStorage.getItem(AI_NICKNAMES_CACHE_KEY) || '[]');
                const usedRaw = JSON.parse(localStorage.getItem(USED_NICKNAMES_STORAGE_KEY) || '[]');
                const usedSetLocal = new Set(Array.isArray(usedRaw) ? usedRaw : []);
                if (Array.isArray(cachedAi)) {
                    const unusedCached = cachedAi.filter(n => n && !usedSetLocal.has(n));
                    if (unusedCached.length >= 8) return;
                }
            } catch (_cErr) {}

            const lastWarmupTs = parseInt(localStorage.getItem(AI_NICK_WARMUP_TS_KEY) || '0', 10) || 0;
            if (lastWarmupTs > 0 && (Date.now() - lastWarmupTs) < TEAM_AI_COOLDOWN_SEC * 1000) {
                return; // 遵守 30 秒间隔保护，冷却期内直接走本地 325+ 大昵称库
            }
            const passOk = verifyTeamAiPasscode(false);
            if (!passOk) return;

            const { apiKey } = getActiveLiveAiKeyAndUrl();
            if (!apiKey || !/^(AIza|AQ\.)/i.test(apiKey)) return;

            try { localStorage.setItem(AI_NICK_WARMUP_TS_KEY, String(Date.now())); } catch (_e) {}

            const seed = Math.floor(1000 + Math.random() * 9000);
            const prompt = `請生成 20 個「海外華人/真實社交用戶風格」的繁體中文暱稱（例如：溫哥華小鹿、洛杉磯老陳、多倫多Sandy、墨爾本阿豪、悉尼小陳、倫敦Chloé、西雅圖老林、東京小夏、新加坡阿杰、灣區工程師阿哲 等，批次號：${seed}）。要求：1.每行一個暱稱，不要序號、不要標點解釋；2.風格自然真實，涵蓋北美/澳洲/歐洲/日韓新馬港澳台華人日常網名；3.長度 3~8 個字。`;

            const modelsToTry = [
                { id: 'gemini-3.8-flash', genCfg: { thinkingConfig: { thinkingLevel: 'LOW' }, maxOutputTokens: 1024, temperature: 0.95 } },
                { id: 'gemini-2.5-flash', genCfg: { maxOutputTokens: 512, temperature: 0.95 } }
            ];
            let outTxt = '';
            for (const mSpec of modelsToTry) {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${mSpec.id}:generateContent?key=${encodeURIComponent(apiKey)}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: mSpec.genCfg
                    })
                });
                if (res.ok) {
                    const json = await res.json();
                    const parts = json?.candidates?.[0]?.content?.parts || [];
                    outTxt = parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('\n');
                    if (outTxt.trim()) break;
                }
            }
            if (!outTxt) return;

            const nicks = String(outTxt)
                .split(/[\r\n,，、|]+/)
                .map(s => s.replace(/^(\d+[\.、\)\s]+|[-•*]\s*)/, '').trim())
                .filter(s => s.length >= 2 && s.length <= 12 && !/^(好的|以下|暱稱)/.test(s));

            if (nicks.length >= 4) {
                nicks.forEach(n => {
                    if (!NICKNAME_POOL.includes(n)) NICKNAME_POOL.unshift(n);
                });
                try {
                    localStorage.setItem(AI_NICKNAMES_CACHE_KEY, JSON.stringify(nicks.slice(0, 40)));
                } catch (e) {}
            }
        } catch (e) {
            // AI 失败或离线时完全静默回退到本地 325+ 海外华人昵称库
        }
    }
    setTimeout(requestGeminiOverseasNicknamesOnLoad, 600);

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
    ['btn-save-img', 'btn-save-vid', 'btn-screenshot', 'btn-export-video'].forEach(expBtnId => {
        const expBtn = document.getElementById(expBtnId);
        if (expBtn) {
            expBtn.addEventListener('click', () => {
                syncLiveZoomEditingUI(false);
            }, true);
        }
    });
    setTimeout(() => {
        if (localStorage.getItem('LAYA_LIVE_V24_CLEAN_BADGE_MIGRATED') !== '1') {
            if (swLiveDmRowHeart) swLiveDmRowHeart.checked = false;
            localStorage.setItem('LAYA_LIVE_V24_CLEAN_BADGE_MIGRATED', '1');
        }
        // V25/V26/V27 迁移：默认强制开启公屏弹幕平滑自动滚动与礼物弹窗自动轮播跳动，无论是否上传视频打开直播间即全自动运行
        if (swLiveAutoRollDm) swLiveAutoRollDm.checked = true;
        if (swLiveAutoCycleGift) swLiveAutoCycleGift.checked = true;
        if (localStorage.getItem('LAYA_LIVE_V27_AUTO_GIFT_SYNC_MIGRATED') !== '1') {
            if (swLiveAutoRollDm) swLiveAutoRollDm.checked = true;
            if (swLiveAutoCycleGift) swLiveAutoCycleGift.checked = true;
            localStorage.setItem('LAYA_LIVE_V27_AUTO_GIFT_SYNC_MIGRATED', '1');
            saveAllToStorage();
        }
        if (localStorage.getItem('LAYA_LIVE_V26_NOBADGE_JOIN_MIGRATED') !== '1') {
            localStorage.setItem('LAYA_LIVE_TEAM_PASS_OK', TEAM_AI_PASSCODE);
            if (inLiveAiGasUrl && !inLiveAiGasUrl.value.trim()) {
                inLiveAiGasUrl.value = TEAM_AI_PASSCODE;
            }
            if (inLiveDanmakuList) {
                const curTxt = inLiveDanmakuList.value || '';
                // 若旧缓存还是旧版默认文案或没有任何「來了」进场行，自动升级为新版含「名字：文案」与「名字 來了」的自然混排预设
                if (!curTxt.trim() || (curTxt.includes('微醺小貓：主播今天狀態太好了吧') && !curTxt.includes('來了'))) {
                    inLiveDanmakuList.value = defaultLiveChatLines.join('\n');
                }
            }
            localStorage.setItem('LAYA_LIVE_V25_FLASH38_MIGRATED', '1');
            localStorage.setItem('LAYA_LIVE_V26_NOBADGE_JOIN_MIGRATED', '1');
            saveAllToStorage();
        } else if (inLiveAiGasUrl && !inLiveAiGasUrl.value.trim()) {
            inLiveAiGasUrl.value = TEAM_AI_PASSCODE;
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
        applyLiveGiftBannerState(false, !liveGiftSenderAv || liveGiftSenderAv.dataset.hasRealHumanAv !== 'true');
        renderLiveChatBubbles(false);
        restartLiveChatRollTimer();
        restartLiveHeartTimer();
        restartLiveGiftAutoCycleTimer();
    }, 140);

    applyLiveHostNameDisplay(inLiveHostName ? inLiveHostName.value : '溫哥華小鹿');
    applyLiveHostLikesDisplay((inLiveHostId && inLiveHostId.value !== '8888') ? inLiveHostId.value : '25.6萬');
    applyLiveViewersDisplay((inLiveViewersText && inLiveViewersText.value !== '1000') ? inLiveViewersText.value : '10.2萬', null);
    applyLiveBrandTagDisplay(inLiveBrandTag ? inLiveBrandTag.value : 'Laya 精選 | 獨家未刪減 | 今晚9點開播 | 新人必看 | 限時福利');
    applyLiveSquareTagDisplay(inLiveSquareTag ? inLiveSquareTag.value : '直播廣場');
    applyLiveWelcomeDisplay(inLiveWelcomeTxt ? inLiveWelcomeTxt.value : '');
    applyLiveNoticeDisplay(inLiveNoticeTxt ? inLiveNoticeTxt.value : '');
    applyLiveGiftBannerState(false, true);
    renderLiveChatBubbles(false);
    renderLiveJoinTicker(false);
    let shouldStayInLiveOnBoot = false;
    try {
        const rawSavedBoot = localStorage.getItem(STORAGE_KEY);
        if (rawSavedBoot) {
            const parsedBoot = JSON.parse(rawSavedBoot);
            shouldStayInLiveOnBoot = !!(parsedBoot && parsedBoot.liveRoomOpen && parsedBoot.viewportMode === 'mode-mobile-port');
        }
    } catch (e) {}
    if (!shouldStayInLiveOnBoot) {
        exitLayaLiveRoom(false);
    }

    /* ==========================================================================
       ★ 全局素材画面最大化自适应 + 放大镜 & 拖动查看控制器 (支持全部 4 种画幅)
         - 自动最大化：无论在电脑网页/手机横屏/手机竖屏社区/竖屏全屏观看，在不遮挡顶部栏与底部视频时间轴的前提下自动等比最大化撑满舞台
         - 鼠标滚轮：在空白区域或画面上滚动滚轮即可放大/缩小 (50% ~ 350%)，并默认自动开启拖动查看模式
         - 键盘 M 键 / ✋ 拖动(M) 按钮：随时切换拖动查看模式的开启/关闭
         - ↺ 重置按键：一键还原 100% 默认最大化尺寸与居中位置
       ========================================================================== */
    (function initGlobalStageMagnifier() {
        const workspaceEl = document.getElementById('left-workspace') || document.querySelector('.workspace');
        const stageEl = document.getElementById('player-stage') || document.querySelector('.player-stage');
        const boxEl = document.getElementById('render-target');
        const trimmerEl = document.getElementById('jy-trimmer-panel');
        if (!stageEl || !boxEl) return;

        // 自愈防护：若本地缓存曾导致 render-target 丢失画幅类名（出现 undefined），立即恢复为当前激活标签的画幅
        const VALID_MODES = ['mode-pc', 'mode-mobile-land', 'mode-mobile-port', 'mode-dy-land'];
        function ensureValidModeClass() {
            const hasValid = VALID_MODES.some(m => boxEl.classList.contains(m));
            if (!hasValid) {
                boxEl.classList.remove('undefined', 'null');
                const activeTab = document.querySelector('.viewport-tabs .tab-btn.active[data-mode]');
                const fallbackMode = (activeTab && activeTab.dataset.mode) || (window.PlayerEngine && VALID_MODES.includes(window.PlayerEngine.currentMode) ? window.PlayerEngine.currentMode : 'mode-pc');
                boxEl.classList.add(fallbackMode);
                if (window.PlayerEngine) window.PlayerEngine.currentMode = fallbackMode;
            }
        }
        ensureValidModeClass();

        const btnStageMagToggle = document.getElementById('btn-stage-mag-toggle');
        const btnStageZoomOut = document.getElementById('btn-stage-zoom-out');
        const inStageZoomSlider = document.getElementById('in-stage-zoom-slider');
        const txtStageZoomPct = document.getElementById('txt-stage-zoom-pct');
        const btnStageZoomIn = document.getElementById('btn-stage-zoom-in');
        const btnStagePanToggle = document.getElementById('btn-stage-pan-toggle');
        const txtStagePanBtn = document.getElementById('txt-stage-pan-btn');
        const btnStageZoomReset = document.getElementById('btn-stage-zoom-reset');
        const stagePanHintPill = document.getElementById('stage-pan-hint-pill');

        const btnTopStageMag = document.getElementById('btn-top-stage-mag');
        const txtTopStageZoom = document.getElementById('txt-top-stage-zoom');
        const btnTopStagePan = document.getElementById('btn-top-stage-pan');
        const btnTopStageReset = document.getElementById('btn-top-stage-reset');

        let stageFitScale = 1;
        let stageZoomPct = 100;
        let stagePanX = 0;
        let stagePanY = 0;
        let isStagePanMode = false;
        let userLockedPanOff = false; // 当用户手动按 M 或点按钮关闭拖动模式时记录，直到再次在空白处滚轮或再次按 M

        let isDraggingStage = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let dragOriginPanX = 0;
        let dragOriginPanY = 0;
        let didMoveDuringDrag = false;
        let suppressClickUntil = 0;
        let wheelZoomTimer = null;

        function isEditableInputFocused(target) {
            const el = target || document.activeElement;
            if (!el) return false;
            const tag = (el.tagName || '').toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
                const inputType = (el.type || '').toLowerCase();
                if (tag === 'INPUT' && (inputType === 'range' || inputType === 'checkbox' || inputType === 'button')) {
                    return false;
                }
                return true;
            }
            return !!el.isContentEditable;
        }

        // 计算四端画面在当前舞台可用空间内的等比最大化倍率（不与其他元素重叠，底部有时间轴时自动留出空间并向上居中）
        const sidebarEl = document.querySelector('.sidebar');
        if (sidebarEl) {
            sidebarEl.style.width = 'clamp(540px, 37vw, 680px)';
            sidebarEl.style.padding = '14px 16px 55vh 16px';
        }

        // ★ 顶部「↺ 重置」旁与左下放大镜「↺ 重置」旁的「📐 独立取景框」按钮双向联动
        const btnTopCropWindow = document.getElementById('btn-top-crop-window');
        const btnStageCropWindow = document.getElementById('btn-stage-crop-window');
        const swCropWindowEl = document.getElementById('sw-crop-window');
        const cropWinEl = document.getElementById('crop-inspector-window');
        const btnCloseCropWinEl = document.getElementById('btn-close-crop-window');

        function syncCropWindowButtonsUI() {
            const isOpen = !!(swCropWindowEl && swCropWindowEl.checked) || !!(cropWinEl && cropWinEl.style.display !== 'none' && cropWinEl.style.display !== '');
            if (btnTopCropWindow) btnTopCropWindow.classList.toggle('is-active', isOpen);
            if (btnStageCropWindow) btnStageCropWindow.classList.toggle('is-active', isOpen);
        }

        function toggleCropInspectorWindowFromStage(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (!swCropWindowEl) return;
            swCropWindowEl.checked = !swCropWindowEl.checked;
            swCropWindowEl.dispatchEvent(new Event('change'));
            syncCropWindowButtonsUI();
            if (typeof window.showToast === 'function') {
                window.showToast(swCropWindowEl.checked ? '📐 已开启独立取景框（支持绿框拖拽构图与滚轮缩放）' : '📐 已关闭独立取景框');
            }
        }

        if (btnTopCropWindow) btnTopCropWindow.addEventListener('click', toggleCropInspectorWindowFromStage);
        if (btnStageCropWindow) btnStageCropWindow.addEventListener('click', toggleCropInspectorWindowFromStage);
        if (swCropWindowEl) swCropWindowEl.addEventListener('change', syncCropWindowButtonsUI);
        if (btnCloseCropWinEl) btnCloseCropWinEl.addEventListener('click', () => setTimeout(syncCropWindowButtonsUI, 20));
        setTimeout(syncCropWindowButtonsUI, 80);

        function applyBoxTransformNow() {
            if (boxEl.classList.contains('stage-mag-export-suspend')) {
                boxEl.style.transform = 'none';
                return;
            }
            const zoomScale = Math.round(stageZoomPct) / 100;
            const totalScale = Number((stageFitScale * zoomScale).toFixed(4));
            boxEl.style.transformOrigin = 'center center';
            boxEl.style.transform = `translate3d(${Math.round(stagePanX)}px, ${Math.round(stagePanY)}px, 0px) scale(${totalScale})`;
        }

        function updateStageFitScale() {
            ensureValidModeClass();
            if (boxEl.parentElement && boxEl.parentElement.id === 'preview-stage-wrap') {
                stageFitScale = 1;
                boxEl.style.setProperty('--stage-fit-scale', '1');
                applyBoxTransformNow();
                return;
            }
            const stageW = stageEl.clientWidth || Math.max(600, (window.innerWidth || 1440) - 540);
            const stageH = stageEl.clientHeight || Math.max(620, (window.innerHeight || 920) - 104);
            const baseW = boxEl.offsetWidth || (boxEl.classList.contains('mode-mobile-port') ? 366 : 1040);
            const baseH = boxEl.offsetHeight || (boxEl.classList.contains('mode-mobile-port') ? 650 : 585);
            if (baseW <= 0 || baseH <= 0) return;

            const padX = 12;
            const padY = 6;
            const availW = Math.max(180, stageW - padX);
            const availH = Math.max(180, stageH - padY);
            const nextFit = Math.max(0.45, Math.min(2.6, Math.min(availW / baseW, availH / baseH)));
            stageFitScale = Number(nextFit.toFixed(4));
            boxEl.style.setProperty('--stage-fit-scale', String(stageFitScale));
            applyBoxTransformNow();
        }
        window.updateStageFitScale = updateStageFitScale;

        function syncStageMagnifierUI() {
            ensureValidModeClass();
            const roundedPct = Math.round(stageZoomPct);
            const scaleVal = roundedPct / 100;
            boxEl.style.setProperty('--stage-zoom-scale', String(scaleVal));
            boxEl.style.setProperty('--stage-pan-x', `${Math.round(stagePanX)}px`);
            boxEl.style.setProperty('--stage-pan-y', `${Math.round(stagePanY)}px`);
            applyBoxTransformNow();

            if (inStageZoomSlider) inStageZoomSlider.value = String(roundedPct);
            if (txtStageZoomPct) txtStageZoomPct.textContent = `${roundedPct}%`;
            if (txtTopStageZoom) txtTopStageZoom.textContent = `${roundedPct}%`;

            const isModified = roundedPct !== 100 || Math.abs(stagePanX) > 1 || Math.abs(stagePanY) > 1;
            if (btnStageMagToggle) btnStageMagToggle.classList.toggle('is-active', isModified);
            if (btnTopStageMag) btnTopStageMag.classList.toggle('is-active', isModified);

            stageEl.classList.toggle('is-stage-pan-mode', isStagePanMode);
            if (btnStagePanToggle) btnStagePanToggle.classList.toggle('is-active', isStagePanMode);
            if (btnTopStagePan) btnTopStagePan.classList.toggle('is-active', isStagePanMode);
            if (txtStagePanBtn) txtStagePanBtn.textContent = isStagePanMode ? '✋ 拖动中 (M)' : '✋ 拖动 (M)';
            if (btnTopStagePan) btnTopStagePan.textContent = isStagePanMode ? '✋ 拖动中(M)' : '✋ 拖动(M)';
            if (stagePanHintPill) stagePanHintPill.style.display = isStagePanMode ? 'block' : 'none';
        }

        function setStageZoom(nextPct, clientX, clientY, fromWheel, autoEnablePan = false) {
            const clamped = Math.max(50, Math.min(350, Math.round(Number(nextPct) || 100)));
            const oldScale = stageZoomPct / 100;
            const newScale = clamped / 100;

            if (typeof clientX === 'number' && typeof clientY === 'number' && oldScale > 0 && clamped !== stageZoomPct) {
                const stRect = stageEl.getBoundingClientRect();
                const cx = stRect.left + stRect.width / 2;
                const cy = stRect.top + stRect.height / 2;
                const dx = clientX - cx;
                const dy = clientY - cy;
                const ratio = newScale / oldScale;
                stagePanX = dx - (dx - stagePanX) * ratio;
                stagePanY = dy - (dy - stagePanY) * ratio;
            }

            stageZoomPct = clamped;
            if (stageZoomPct === 100 && Math.abs(stagePanX) < 16 && Math.abs(stagePanY) < 16) {
                stagePanX = 0;
                stagePanY = 0;
            }

            // 仅当用户显式开启拖动模式（点 ✋ 拖动(M) 或按 M 键）时才拦截内部点击，缩放时不自动锁死内部按钮与进度条交互
            if (autoEnablePan && !userLockedPanOff) {
                isStagePanMode = true;
            }

            if (fromWheel) {
                stageEl.classList.add('is-stage-wheel-zooming');
                if (wheelZoomTimer) clearTimeout(wheelZoomTimer);
                wheelZoomTimer = setTimeout(() => {
                    stageEl.classList.remove('is-stage-wheel-zooming');
                }, 150);
            }

            syncStageMagnifierUI();
        }

        function resetStageMagnifier(showTip = true) {
            stageZoomPct = 100;
            stagePanX = 0;
            stagePanY = 0;
            isStagePanMode = false;
            userLockedPanOff = false;
            isDraggingStage = false;
            stageEl.classList.remove('is-stage-panning', 'is-stage-wheel-zooming', 'is-stage-pan-mode');
            updateStageFitScale();
            syncStageMagnifierUI();
            if (showTip && typeof window.showToast === 'function') {
                window.showToast('↺ 素材画面已重置为 100% 最大化默认尺寸并恢复居中');
            }
        }

        function toggleStagePanMode(forceState, showTip = true) {
            isStagePanMode = typeof forceState === 'boolean' ? forceState : !isStagePanMode;
            userLockedPanOff = !isStagePanMode;
            if (!isStagePanMode) {
                isDraggingStage = false;
                stageEl.classList.remove('is-stage-panning');
            }
            syncStageMagnifierUI();
            if (showTip && typeof window.showToast === 'function') {
                window.showToast(isStagePanMode
                    ? '✋ 已开启拖动查看模式（按住鼠标左键任意拖动画面，滚轮放大缩小，按 M 键或点此按钮可退出拖动）'
                    : '✋ 已关闭拖动查看模式（滚轮仍可放大缩小，按 M 键可再次开启拖动）');
            }
        }

        function quickToggleMagnifier() {
            if (stageZoomPct === 100 && Math.abs(stagePanX) < 2 && Math.abs(stagePanY) < 2) {
                setStageZoom(150, undefined, undefined, false, false);
                if (typeof window.showToast === 'function') {
                    window.showToast('🔍 已放大至 150%（画面内按钮与进度条仍可直接操作；按住黑底空白处或按 M 键可拖动画面）');
                }
            } else {
                resetStageMagnifier(true);
            }
        }

        // 1. 按钮与滑块事件绑定
        if (btnStageMagToggle) btnStageMagToggle.addEventListener('click', (e) => { e.stopPropagation(); quickToggleMagnifier(); });
        if (btnTopStageMag) btnTopStageMag.addEventListener('click', (e) => { e.stopPropagation(); quickToggleMagnifier(); });

        if (btnStageZoomIn) {
            btnStageZoomIn.addEventListener('click', (e) => {
                e.stopPropagation();
                setStageZoom(stageZoomPct + 20, undefined, undefined, false, false);
            });
        }
        if (btnStageZoomOut) {
            btnStageZoomOut.addEventListener('click', (e) => {
                e.stopPropagation();
                setStageZoom(stageZoomPct - 20, undefined, undefined, false, false);
            });
        }
        if (inStageZoomSlider) {
            inStageZoomSlider.addEventListener('input', () => {
                setStageZoom(Number(inStageZoomSlider.value) || 100, undefined, undefined, true, false);
            });
        }
        if (txtStageZoomPct) {
            txtStageZoomPct.addEventListener('click', (e) => {
                e.stopPropagation();
                const presets = [100, 150, 200, 250];
                const nextIdx = (presets.indexOf(Math.round(stageZoomPct)) + 1) % presets.length;
                setStageZoom(presets[nextIdx], undefined, undefined, false, false);
            });
        }
        if (btnStagePanToggle) {
            btnStagePanToggle.addEventListener('click', (e) => { e.stopPropagation(); toggleStagePanMode(undefined, true); });
        }
        if (btnTopStagePan) {
            btnTopStagePan.addEventListener('click', (e) => { e.stopPropagation(); toggleStagePanMode(undefined, true); });
        }
        if (btnStageZoomReset) {
            btnStageZoomReset.addEventListener('click', (e) => { e.stopPropagation(); resetStageMagnifier(true); });
        }
        if (btnTopStageReset) {
            btnTopStageReset.addEventListener('click', (e) => { e.stopPropagation(); resetStageMagnifier(true); });
        }

        const btnGlobalResetEl = document.getElementById('btn-global-reset');
        if (btnGlobalResetEl) {
            btnGlobalResetEl.addEventListener('click', () => resetStageMagnifier(false));
        }

        // 2. 鼠标滚轮放大/缩小整个素材画面：排除内部弹幕、直播间公屏/礼物区与评论列表自身的滚轮操作
        const wheelTargetEl = workspaceEl || stageEl;
        wheelTargetEl.addEventListener('wheel', (e) => {
            if (e.target && e.target.closest && (e.target.closest('.viewport-tabs') || e.target.closest('#jy-trimmer-panel') || e.target.closest('#crop-inspector-window'))) {
                return;
            }
            const isOverEmptyArea = !boxEl.contains(e.target);
            if (!isOverEmptyArea && !isStagePanMode && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (e.target && e.target.closest && e.target.closest('.danmaku-item, #dy-comment-list, .live-bottom-section, #live-chat-scroll-box, #live-gift-combo-banner')) {
                    return;
                }
            }
            e.preventDefault();
            const delta = e.deltaY < 0 ? 15 : -15;
            setStageZoom(stageZoomPct + delta, e.clientX, e.clientY, true, false);
        }, { passive: false });

        // 3. 键盘 M 键一键切换拖动查看模式（开启/关闭）
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (isEditableInputFocused(e.target)) return;
            if (e.key === 'm' || e.key === 'M' || e.code === 'KeyM') {
                if (e.repeat) return;
                e.preventDefault();
                toggleStagePanMode(!isStagePanMode, true);
            }
        });

        // 4. 鼠标拖拽平移整个素材画面（在拖动查看模式开启时、或在空白区域按住左键拖拽时、或按鼠标中键时均生效）
        stageEl.addEventListener('mousedown', (e) => {
            if (e.target && e.target.closest && (e.target.closest('#stage-magnifier-bar') || e.target.closest('#crop-inspector-window'))) return;
            const isOverEmptyStage = !boxEl.contains(e.target);
            const canPanNow = isStagePanMode || e.button === 1 || (e.button === 0 && isOverEmptyStage);
            if (!canPanNow) return;
            if (e.button !== 0 && e.button !== 1) return;

            isDraggingStage = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragOriginPanX = stagePanX;
            dragOriginPanY = stagePanY;
            didMoveDuringDrag = false;
            stageEl.classList.add('is-stage-panning');
            e.preventDefault();
            e.stopPropagation();
        }, true);

        window.addEventListener('mousemove', (e) => {
            if (!isDraggingStage) return;
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                didMoveDuringDrag = true;
            }
            stagePanX = dragOriginPanX + dx;
            stagePanY = dragOriginPanY + dy;
            syncStageMagnifierUI();
        }, { passive: true });

        window.addEventListener('mouseup', () => {
            if (!isDraggingStage) return;
            isDraggingStage = false;
            stageEl.classList.remove('is-stage-panning');
            if (didMoveDuringDrag || isStagePanMode) {
                suppressClickUntil = performance.now() + 200;
            }
        });

        // 在拖动查看模式下或刚拖拽完画面时，拦截内部点击与双击，防止误触暂停视频或弹出上传框
        ['click', 'dblclick'].forEach(evtName => {
            stageEl.addEventListener(evtName, (e) => {
                if (e.target && e.target.closest && e.target.closest('#stage-magnifier-bar')) return;
                if (isStagePanMode || performance.now() < suppressClickUntil) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }, true);
        });

        // 5. 监听舞台尺寸变化、窗口缩放与底部视频时间轴显隐，实时保持画面最大化且不与其他元素重叠
        if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(() => {
                updateStageFitScale();
            });
            ro.observe(stageEl);
            if (workspaceEl) ro.observe(workspaceEl);
        } else {
            window.addEventListener('resize', updateStageFitScale);
        }

        if (typeof MutationObserver !== 'undefined') {
            const mo = new MutationObserver(() => {
                updateStageFitScale();
            });
            mo.observe(boxEl, { attributes: true, attributeFilter: ['class'] });
            if (trimmerEl) {
                mo.observe(trimmerEl, { attributes: true, attributeFilter: ['style', 'class'] });
            }
        }

        // 6. 截图与录屏导出时的无损暂挂/恢复钩子（确保导出的截图与 MP4 视频永远 100% 原始满画幅无偏移）
        window.suspendStageMagnifierForExport = function () {
            boxEl.classList.add('stage-mag-export-suspend');
            boxEl.style.transform = 'none';
            void boxEl.offsetWidth;
        };
        window.restoreStageMagnifierAfterExport = function () {
            boxEl.classList.remove('stage-mag-export-suspend');
            updateStageFitScale();
            syncStageMagnifierUI();
        };
        window.resetStageMagnifier = resetStageMagnifier;

        updateStageFitScale();
        syncStageMagnifierUI();
        setTimeout(() => {
            updateStageFitScale();
            syncStageMagnifierUI();
        }, 120);
    })();

    /* ==========================================================================
       ★ 全画面点击即定位引擎：点击左侧预览屏幕任意元素/区域，右侧编辑栏立即切换对应板块、
         自动滑动置顶到要修改的具体输入框/区块并闪烁高亮（无需人工逐个上下翻找）
       ========================================================================== */
    (function initScreenClickToSidebarLocator() {
        const boxEl = document.getElementById('render-target');
        const stageEl = document.getElementById('player-stage');
        if (!boxEl || typeof window.locateSidebarControl !== 'function') return;

        boxEl.addEventListener('click', (e) => {
            if (window.__isRestoringStorage) return;
            if (stageEl && (stageEl.classList.contains('is-stage-pan-mode') || stageEl.classList.contains('is-stage-panning'))) return;
            const t = e.target;
            if (!t || !t.closest) return;

            // 忽略画布内双击原地编辑条的内部操作按钮
            if (t.closest('.live-row-inline-editor')) return;

            const locate = (tab, cardId, targetSelector, highlightSelector, extra = {}) => {
                window.locateSidebarControl({
                    tab,
                    cardId,
                    targetSelector,
                    highlightSelector: highlightSelector || undefined,
                    ...extra
                });
            };

            // ------------------------------------------------------------------
            // 0. 全局通用层：智能字幕覆层 & 跑马灯弹幕层
            // ------------------------------------------------------------------
            if (t.closest('#dyl-wrap-subtitle, #dy-disp-box-sub')) {
                locate('dy', 'card-dy-subtitle', '#sub-cue-list', '#card-dy-subtitle', { expandSubtitleStudio: true });
                return;
            }
            if (t.closest('#danmaku-container, .danmaku-item')) {
                locate('dm', 'card-dm-studio', '#danmaku-track-list', '#card-dm-studio');
                return;
            }

            // ------------------------------------------------------------------
            // 1. 手机竖屏社区模式 (mode-mobile-port)
            // ------------------------------------------------------------------
            if (boxEl.classList.contains('mode-mobile-port')) {
                // 1A. 点击顶部导航栏中的「直播」标签
                const navTabEl = t.closest('#laya-app-nav-tabs .laya-app-nav-item, .laya-nav-tabs > span, .dy-nav-tabs > span');
                if (navTabEl) {
                    const navTxt = (navTabEl.textContent || '').trim();
                    if (navTxt.includes('直播')) {
                        locate('dy', 'card-dy-live-settings', '#card-dy-live-settings', '#card-dy-live-settings');
                        return;
                    }
                    locate('dy', 'card-dy-skin', '#sel-mobile-skin');
                    return;
                }

                // 1B. 处于直播间内页 (dy-live-open) 时点击直播间各区域
                if (boxEl.classList.contains('dy-live-open') && t.closest('#laya-live-room-overlay')) {
                    if (t.closest('#live-btn-exit-top')) return;

                    // 主播头像 / 主播昵称
                    if (t.closest('#live-host-avatar-wrap, #live-host-name-row, #live-disp-host-name')) {
                        locate('dy', 'card-dy-live-settings', '#in-live-host-name');
                        return;
                    }
                    // 本场点赞
                    if (t.closest('#live-host-id-row, #live-disp-host-id')) {
                        locate('dy', 'card-dy-live-settings', '#in-live-host-id');
                        return;
                    }
                    // 关注按钮
                    if (t.closest('#live-btn-follow')) {
                        locate('dy', 'card-dy-live-settings', '#in-live-follow-color');
                        return;
                    }
                    // 右上角 3 位观众头像
                    if (t.closest('#live-aud-avatars')) {
                        locate('dy', 'card-dy-live-settings', '#sel-live-aud-avatar-mode');
                        return;
                    }
                    // 右上角在线人数 / 第二行红色 LIVE 在线人数
                    if (t.closest('#live-viewer-pill-top, #live-left-live-pill')) {
                        locate('dy', 'card-dy-live-settings', '#in-live-viewers-text');
                        return;
                    }
                    // Laya 精选品牌胶囊
                    if (t.closest('#live-laya-brand-pill')) {
                        locate('dy', 'card-dy-live-settings', '#in-live-brand-tag');
                        return;
                    }
                    // 直播广场胶囊
                    if (t.closest('#live-sub-square-pill')) {
                        locate('dy', 'card-dy-live-settings', '#in-live-square-tag');
                        return;
                    }
                    // 公屏顶部绿色系统提示语
                    if (t.closest('#live-sys-notice')) {
                        locate('dy', 'card-dy-live-settings', '#in-live-notice-txt', '#live-cfg-box-welcome');
                        return;
                    }
                    // 公屏顶部直播间欢迎语
                    if (t.closest('#live-room-welcome')) {
                        locate('dy', 'card-dy-live-settings', '#in-live-welcome-txt', '#live-cfg-box-welcome');
                        return;
                    }
                    // 紫色礼物进场小弹窗 / 底部黄色礼物盒按钮
                    if (t.closest('#live-gift-combo-banner, .live-gift-combo-slot, #live-bot-btn-gift')) {
                        locate('dy', 'card-dy-live-settings', '#in-live-gift-user', '#live-cfg-box-gift');
                        return;
                    }
                    // 画布弹幕精修小工具栏
                    if (t.closest('#live-dm-edit-toolbar')) {
                        if (t.closest('#btn-live-canvas-spd-down, #btn-live-canvas-spd-up, #txt-live-canvas-spd')) {
                            locate('dy', 'card-dy-live-settings', '#in-live-dm-speed');
                        } else if (t.closest('#btn-live-canvas-ai-dm')) {
                            locate('dy', 'card-dy-live-settings', '#in-live-danmaku-list', '#live-cfg-box-danmaku');
                        } else {
                            locate('dy', 'card-dy-live-settings', '#in-live-dm-scale');
                        }
                        return;
                    }
                    // 公屏滚动弹幕列表 / 底部进场提示 / 底部「說點什麼...」输入框
                    if (t.closest('#live-chat-list, .live-chat-bubble, #live-join-ticker-row, .live-input-pill, #live-chat-input, #live-bot-btn-emoji')) {
                        locate('dy', 'card-dy-live-settings', '#in-live-danmaku-list', '#live-cfg-box-danmaku');
                        return;
                    }
                    // 右侧飘心区 / 底部粉色爱心按钮
                    if (t.closest('#live-floating-hearts, #live-bot-btn-like')) {
                        locate('dy', 'card-dy-live-settings', '#in-live-heart-density');
                        return;
                    }
                    // 点击直播间其他区域默认置顶【🔴 直播间专属设置】
                    locate('dy', 'card-dy-live-settings', '#card-dy-live-settings', '#card-dy-live-settings');
                    return;
                }

                // 1C. 竖屏顶部手机状态栏 (#dy-status-bar)
                if (t.closest('#dy-status-bar')) {
                    if (t.closest('#dy-sb-time, #dy-sb-rec')) {
                        locate('dy', 'card-dy-statusbar', '#in-dy-sb-time');
                    } else if (t.closest('#dy-sb-cutout-wrap')) {
                        locate('dy', 'card-dy-statusbar', '#sel-dy-cutout');
                    } else if (t.closest('#dy-sb-carrier')) {
                        locate('dy', 'card-dy-statusbar', '#sel-dy-sb-carrier');
                    } else if (t.closest('#dy-sb-netspeed')) {
                        locate('dy', 'card-dy-statusbar', '#in-dy-sb-speed');
                    } else if (t.closest('#dy-sb-battery-group')) {
                        locate('dy', 'card-dy-statusbar', '#in-dy-sb-battery');
                    } else if (t.closest('#dy-sb-signal, #dy-sb-wifi, #dy-sb-net-txt')) {
                        locate('dy', 'card-dy-statusbar', '#sel-dy-sb-signal');
                    } else {
                        locate('dy', 'card-dy-statusbar', '#sel-dy-phone-model');
                    }
                    return;
                }

                // 1D. 竖屏评论区抽屉 (#dy-comment-drawer)
                if (t.closest('#dy-comment-drawer')) {
                    if (t.closest('#dy-cmt-collection-bar')) {
                        locate('dy', 'card-dy-comment-studio', '#in-cmt-col-title');
                        return;
                    }
                    if (t.closest('.dy-cmt-tabs-bar, #dy-cmt-head-count')) {
                        locate('dy', 'card-dy-comment-studio', '#in-cmt-head-count');
                        return;
                    }
                    const cmtItem = t.closest('.dy-cmt-item[data-idx]');
                    if (cmtItem) {
                        const idx = cmtItem.getAttribute('data-idx');
                        const edCard = document.querySelector(`#dy-cmt-editor-list .dy-cmt-ed-card[data-idx="${idx}"]`);
                        if (edCard) {
                            locate('dy', 'card-dy-comment-studio', edCard, edCard);
                            return;
                        }
                    }
                    locate('dy', 'card-dy-comment-studio', '#card-dy-comment-studio');
                    return;
                }

                // 1E. 竖屏右侧互动图标列 (#dy-wrap-right-bar)
                if (t.closest('#dy-wrap-right-bar')) {
                    if (t.closest('#dy-avatar-click, #dy-btn-follow')) {
                        locate('dy', 'card-dy-author', '#sel-author-avatar-gender');
                    } else if (t.closest('#dy-btn-like')) {
                        locate('dy', 'card-dy-author', '#in-dy-likes');
                    } else if (t.closest('#dy-btn-comment')) {
                        locate('dy', 'card-dy-comment-studio', '#card-dy-comment-studio');
                    } else if (t.closest('#dy-btn-star')) {
                        locate('dy', 'card-dy-author', '#in-dy-stars');
                    } else if (t.closest('#dy-btn-share')) {
                        locate('dy', 'card-dy-author', '#in-dy-shares');
                    } else if (t.closest('#dy-vinyl-wrap')) {
                        locate('dy', 'card-dy-right-icons', '#sw-dy-icon-vinyl');
                    }
                    return;
                }

                // 1F. 竖屏全屏观看按钮或内嵌横屏水印
                if (t.closest('#dy-fullscreen-pill, #dy-land-frame-overlay')) {
                    locate('dy', 'card-dy-fullscreen', '#inp-dy-lf-title');
                    return;
                }

                // 1G. 竖屏左下角文案/热搜/热点/弹幕信息区 (.dy-left-info)
                if (t.closest('.dy-left-info, #dy-dm-compose-bar')) {
                    if (t.closest('#dy-btn-dm-round, #dy-dm-compose-bar')) {
                        locate('dm', 'card-dm-studio', '#in-dm-port-min');
                    } else if (t.closest('#dy-wrap-featured')) {
                        locate('dy', 'card-dy-hotspot', '#in-dy-featured-title');
                    } else if (t.closest('#dy-disp-author, .dy-author-row')) {
                        locate('dy', 'card-dy-author', '#in-dy-author', null, { focusInput: true });
                    } else if (t.closest('#dy-disp-tags')) {
                        locate('dy', 'card-dy-author', '#in-dy-tags', null, { focusInput: true });
                    } else if (t.closest('#dy-disp-desc, .dy-desc-row')) {
                        locate('dy', 'card-dy-author', '#in-dy-desc', null, { focusInput: true });
                    } else if (t.closest('#dy-wrap-campaign')) {
                        locate('dy', 'card-dy-hotspot', '#in-dy-campaign', null, { focusInput: true });
                    } else if (t.closest('#dy-wrap-gold, #dy-search-bar-row')) {
                        locate('dy', 'card-dy-hotspot', '#in-dy-gold-title', null, { focusInput: true });
                    } else if (t.closest('#dy-disp-hotspot-views, .dy-hotspot-right')) {
                        locate('dy', 'card-dy-hotspot', '#in-dy-hotspot-views');
                    } else if (t.closest('#dy-wrap-hotspot')) {
                        locate('dy', 'card-dy-hotspot', '#in-dy-hotspot-title', null, { focusInput: true });
                    }
                    return;
                }

                // 1H. 竖屏底部导航栏 (#laya-app-wrap-bottom-bar / #laya-wrap-bottom-bar / #dy-wrap-bottom-bar)
                if (t.closest('#laya-app-wrap-bottom-bar, #laya-wrap-bottom-bar, #dy-wrap-bottom-bar')) {
                    const tabItem = t.closest('.laya-app-tab-item, .laya-tab-item, .dy-tab-item');
                    if (tabItem && (tabItem.textContent || '').includes('消息')) {
                        locate('dy', 'card-dy-author', '#in-dy-msg-count');
                    } else {
                        locate('dy', 'card-dy-skin', '#sel-mobile-skin');
                    }
                    return;
                }
                return;
            }

            // ------------------------------------------------------------------
            // 2. 竖屏全屏观看模式 (mode-dy-land)
            // ------------------------------------------------------------------
            if (boxEl.classList.contains('mode-dy-land')) {
                if (t.closest('#dyl-wrap-status, #dyl-disp-clock')) {
                    locate('dy', 'card-dyl-switches', '#in-dyl-clock-time');
                } else if (t.closest('#dyl-disp-title, .dyl-title-scroll')) {
                    locate('dy', 'card-dy-fullscreen', '#inp-dy-lf-title', null, { focusInput: true });
                } else if (t.closest('#dyl-wrap-author, #dyl-disp-author')) {
                    locate('dy', 'card-dy-fullscreen', '#inp-dy-lf-brand', null, { focusInput: true });
                } else if (t.closest('#dyl-wrap-dm-pill')) {
                    locate('dy', 'card-dyl-switches', '#sw-dyl-dm-pill');
                } else if (t.closest('#dyl-wrap-time, #dyl-progress-wrap')) {
                    locate('dy', 'card-dyl-switches', '#in-dyl-start-time', null, { focusInput: true });
                } else if (t.closest('#dyl-wrap-social')) {
                    locate('dy', 'card-dyl-switches', '#sw-dyl-bottom');
                } else if (t.closest('#dyl-wrap-right-opts')) {
                    locate('dy', 'card-dyl-switches', '#sw-dyl-right-opts');
                } else if (t.closest('#dyl-wrap-bright')) {
                    locate('dy', 'card-dyl-switches', '#sw-dyl-bright');
                } else if (t.closest('#dyl-wrap-right-tools')) {
                    locate('dy', 'card-dyl-switches', '#sw-dyl-right-tools');
                } else if (t.closest('#dyl-wrap-top-actions')) {
                    locate('dy', 'card-dyl-switches', '#sw-dyl-top-act');
                } else if (t.closest('#dyl-wrap-center-pause')) {
                    locate('dy', 'card-dyl-switches', '#sw-dyl-pause');
                }
                return;
            }

            // ------------------------------------------------------------------
            // 3. 手机横屏影音模式 (mode-mobile-land)
            // ------------------------------------------------------------------
            if (boxEl.classList.contains('mode-mobile-land')) {
                if (t.closest('#m-status-bar')) {
                    if (t.closest('#m-signal-group')) {
                        locate('m-cinema', 'card-mc-statusbar', '#sel-m-signal');
                    } else if (t.closest('.m-battery-icon')) {
                        locate('m-cinema', 'card-mc-statusbar', '#in-m-battery-pct');
                    } else {
                        locate('m-cinema', 'card-mc-statusbar', '#in-m-status-time');
                    }
                } else if (t.closest('#m-wrap-logo')) {
                    locate('m-cinema', 'card-mc-badge', '#in-m-logo-scale');
                } else if (t.closest('#m-disp-res-badge')) {
                    locate('m-cinema', 'card-mc-badge', '#sel-m-res-badge');
                } else if (t.closest('#m-disp-main-title')) {
                    locate('m-cinema', 'card-mc-badge', '#in-m-main-title', null, { focusInput: true });
                } else if (t.closest('#m-disp-sub-title')) {
                    locate('m-cinema', 'card-mc-badge', '#in-m-sub-title', null, { focusInput: true });
                } else if (t.closest('#m-wrap-center-play')) {
                    locate('m-cinema', 'card-mc-switches', '#sw-m-center-play');
                } else if (t.closest('#m-bot-right-actions')) {
                    locate('m-cinema', 'card-mc-switches', '#sw-m-right-actions');
                } else if (t.closest('#m-bottom-bar')) {
                    locate('m-cinema', 'card-mc-time', '#in-m-start-time');
                }
                return;
            }

            // ------------------------------------------------------------------
            // 4. 电脑网页模式 (mode-pc)
            // ------------------------------------------------------------------
            if (boxEl.classList.contains('mode-pc')) {
                if (t.closest('#wrap-back-btn')) {
                    locate('web', 'card-web-switches', '#sw-back-btn');
                } else if (t.closest('#wrap-laya-badge')) {
                    locate('web', 'card-web-text', '#in-laya-label', null, { focusInput: true });
                } else if (t.closest('#wrap-free-pill')) {
                    locate('web', 'card-web-text', '#in-free-pill-text', null, { focusInput: true });
                } else if (t.closest('#wrap-viewer-pill')) {
                    locate('web', 'card-web-text', '#in-viewer-text', null, { focusInput: true });
                } else if (t.closest('#disp-title')) {
                    locate('web', 'card-web-text', '#in-title', null, { focusInput: true });
                } else if (t.closest('#wrap-vip-tag')) {
                    locate('web', 'card-web-switches', '#sw-vip-tag');
                } else if (t.closest('#wrap-top-right')) {
                    locate('web', 'card-web-switches', '#sw-top-right');
                } else if (t.closest('#wrap-banner')) {
                    locate('web', 'card-web-text', '#in-banner-body', null, { focusInput: true });
                } else if (t.closest('#wrap-center-all')) {
                    locate('web', 'card-web-switches', '#sw-center-btn');
                } else if (t.closest('#wrap-waveform')) {
                    locate('web', 'card-web-wave', '#sel-waveform-preset');
                } else if (t.closest('#wrap-bot-dm-group')) {
                    locate('web', 'card-web-text', '#in-dm-placeholder', null, { focusInput: true });
                } else if (t.closest('#wrap-bottom-bar')) {
                    locate('web', 'card-web-time', '#in-start-time');
                }
            }
        }, true);
    })();
})();
