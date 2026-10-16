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
    toast.textContent = msg;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 260);
    }, 2800);
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
    }
};

(function () {
    const tabWeb = document.getElementById('tab-btn-web');
    const tabCinema = document.getElementById('tab-btn-m-cinema');
    const tabDy = document.getElementById('tab-btn-dy');
    const tabDm = document.getElementById('tab-btn-dm');

    if (tabWeb) tabWeb.addEventListener('click', () => window.switchRightTab('web'));
    if (tabCinema) tabCinema.addEventListener('click', () => window.switchRightTab('m-cinema'));
    if (tabDy) tabDy.addEventListener('click', () => window.switchRightTab('dy'));
    if (tabDm) tabDm.addEventListener('click', () => window.switchRightTab('dm'));

    /* ==========================================================================
       ★ 1. 真实蓝/紫双 Logo 原图切换与 Base64 永久绑定引擎 (导出绝不变假图)
       ========================================================================== */
    const selLogoVersion = document.getElementById('sel-logo-version');
    const upLogo1 = document.getElementById('up-logo-1');
    const upLogo2 = document.getElementById('up-logo-2');
    const headerBrandLogo = document.getElementById('header-brand-logo');
    const playerMiniLogo = document.getElementById('player-mini-logo');
    const mBrandLogo = document.getElementById('m-brand-logo');
    const dyAvatarImg = document.getElementById('dy-avatar-img');

    // 存储用户绑定的真实蓝/紫 Logo 的 Base64 数据 (解决本地跨域导致下载变默认假图的问题)
    const customLogoDB = {
        'Laya.png': (window.LOCAL_LOGOS && window.LOCAL_LOGOS['Laya.png']) || localStorage.getItem('LAYA_REAL_LOGO_1') || '',
        'Laya2.png': (window.LOCAL_LOGOS && window.LOCAL_LOGOS['Laya2.png']) || localStorage.getItem('LAYA_REAL_LOGO_2') || ''
    };

    // 尝试自动将同文件夹下的 Laya.png / Laya2.png 预转为 Base64
    function tryAutoConvertLocalFile(fileName) {
        if (customLogoDB[fileName]) return;
        fetch(fileName)
            .then(res => res.ok ? res.blob() : Promise.reject())
            .then(blob => {
                const reader = new FileReader();
                reader.onload = () => {
                    customLogoDB[fileName] = reader.result;
                    localStorage.setItem(fileName === 'Laya.png' ? 'LAYA_REAL_LOGO_1' : 'LAYA_REAL_LOGO_2', reader.result);
                    if (selLogoVersion && selLogoVersion.value === fileName) {
                        applyLogoVersion(fileName);
                    }
                };
                reader.readAsDataURL(blob);
            })
            .catch(() => {
                // 若是 file:// 协议禁止 fetch，则可通过界面上的“上传绑定蓝色/紫色Logo”按钮一键绑定
            });
    }
    tryAutoConvertLocalFile('Laya.png');
    tryAutoConvertLocalFile('Laya2.png');

    // 获取当前选中的真实图标源 (优先使用 Base64 原图，其次使用文件相对路径)
    function getActiveLogoSrc(logoKey) {
        return customLogoDB[logoKey] || logoKey;
    }

    function applyLogoVersion(logoKey) {
        const realSrc = getActiveLogoSrc(logoKey);

        if (headerBrandLogo) {
            headerBrandLogo.src = realSrc;
            headerBrandLogo.style.display = 'block';
        }
        if (playerMiniLogo) playerMiniLogo.src = realSrc;
        if (mBrandLogo) mBrandLogo.src = realSrc;

        // 手机竖屏头像如果没单独上传过其他人物头像，也同步切换为蓝/紫 Logo
        if (dyAvatarImg && (!dyAvatarImg.dataset.custom || dyAvatarImg.dataset.custom === 'false')) {
            dyAvatarImg.src = realSrc;
        }
        triggerSaveStorage();
    }

    if (selLogoVersion) {
        selLogoVersion.addEventListener('change', (e) => {
            applyLogoVersion(e.target.value);
            window.showToast(e.target.value === 'Laya2.png' ? '🟣 已切换为：紫色图标 (Laya2.png)' : '🔵 已切换为：蓝色图标 (Laya.png)');
        });
    }

    // 绑定蓝色 Logo (Laya.png) 按钮事件
    if (upLogo1) {
        upLogo1.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                customLogoDB['Laya.png'] = evt.target.result;
                localStorage.setItem('LAYA_REAL_LOGO_1', evt.target.result);
                if (selLogoVersion) selLogoVersion.value = 'Laya.png';
                applyLogoVersion('Laya.png');
                window.showToast('✅ 蓝色图标原图已永久绑定！下载图片和视频将100%显示此图标！');
            };
            reader.readAsDataURL(file);
        });
    }

    // 绑定紫色 Logo (Laya2.png) 按钮事件
    if (upLogo2) {
        upLogo2.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                customLogoDB['Laya2.png'] = evt.target.result;
                localStorage.setItem('LAYA_REAL_LOGO_2', evt.target.result);
                if (selLogoVersion) selLogoVersion.value = 'Laya2.png';
                applyLogoVersion('Laya2.png');
                window.showToast('✅ 紫色图标原图已永久绑定！下载图片和视频将100%显示此图标！');
            };
            reader.readAsDataURL(file);
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
            inCustomSec.style.display = (e.target.value === 'custom') ? 'inline-block' : 'none';
        });
    }

    const btnCycleSpeed = document.getElementById('btn-cycle-speed');
    const dispSpeedVal = document.getElementById('disp-speed-val');
    const speeds = ['1.0X', '1.25X', '1.5X', '2.0X', '0.75X'];
    let speedIdx = 0;
    if (btnCycleSpeed && dispSpeedVal) {
        btnCycleSpeed.addEventListener('click', () => {
            speedIdx = (speedIdx + 1) % speeds.length;
            dispSpeedVal.textContent = speeds[speedIdx];
            const previewVideo = document.getElementById('preview-video');
            if (previewVideo) previewVideo.playbackRate = parseFloat(speeds[speedIdx]);
            window.showToast(`已切换倍速为：${speeds[speedIdx]}`);
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
                window.showToast('已关注作者');
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
    const selMobileSkin = document.getElementById('sel-mobile-skin');
    const renderTarget = document.getElementById('render-target');

    function applyMobileSkin(skin) {
        if (!renderTarget) return;
        if (skin === 'laya') {
            renderTarget.classList.remove('skin-douyin');
            renderTarget.classList.add('skin-laya');
        } else {
            renderTarget.classList.remove('skin-laya');
            renderTarget.classList.add('skin-douyin');
        }
        triggerSaveStorage();
    }

    if (selMobileSkin) {
        selMobileSkin.addEventListener('change', (e) => {
            applyMobileSkin(e.target.value);
            window.showToast(e.target.value === 'laya' ? '💎 已切换为：Laya 官方社区风格' : '📱 已切换为：抖音原生短视频风格');
        });
    }

    /* ==========================================================================
       6. 三端显隐开关矩阵与文案实时绑定
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
// 👇 新增：手机横屏画质徽标开关 & 中央大播放键显隐开关
    bindToggle('sw-m-res-badge', 'm-disp-res-badge', 'inline-flex');
    bindToggle('sw-m-center-play', 'm-wrap-center-play', 'flex');
    bindToggle('sw-m-status-bar', 'm-status-bar', 'flex');
    bindToggle('sw-m-top-header', 'm-top-header', 'flex');
    bindToggle('sw-m-bottom-bar', 'm-bottom-bar', 'flex');
    bindToggle('sw-m-right-actions', 'm-bot-right-actions', 'flex');

    bindToggle('sw-dy-gold', 'dy-wrap-gold', 'flex');
    bindToggle('sw-dy-hotspot', 'dy-wrap-hotspot', 'flex');
    bindToggle('sw-dy-campaign', 'dy-wrap-campaign', 'inline-flex');
    bindToggle('sw-dy-right-bar', 'dy-wrap-right-bar', 'flex');

    const swDyTopNav = document.getElementById('sw-dy-top-nav');
    const dyWrapTopNav = document.getElementById('dy-wrap-top-nav');
    const layaWrapTopNav = document.getElementById('laya-wrap-top-nav');
    if (swDyTopNav) {
        swDyTopNav.addEventListener('change', (e) => {
            const op = e.target.checked ? '1' : '0';
            const pe = e.target.checked ? 'auto' : 'none';
            if (dyWrapTopNav) { dyWrapTopNav.style.opacity = op; dyWrapTopNav.style.pointerEvents = pe; }
            if (layaWrapTopNav) { layaWrapTopNav.style.opacity = op; layaWrapTopNav.style.pointerEvents = pe; }
            triggerSaveStorage();
        });
    }

    const bindText = (inputId, outputId) => {
        const inp = document.getElementById(inputId);
        const out = document.getElementById(outputId);
        if (inp && out) {
            inp.addEventListener('input', (e) => { 
                out.textContent = e.target.value; 
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
    bindText('in-dy-likes', 'dy-val-likes');
    bindText('in-dy-comments', 'dy-val-comments');
    bindText('in-dy-stars', 'dy-val-stars');
    bindText('in-dy-shares', 'dy-val-shares');
    bindText('in-dy-author', 'dy-disp-author');
    bindText('in-dy-desc', 'dy-disp-desc');
    bindText('in-dy-tags', 'dy-disp-tags');
    bindText('in-dy-gold-title', 'dy-disp-gold-title');
    bindText('in-dy-hotspot-title', 'dy-disp-hotspot-title');
    bindText('in-dy-hotspot-views', 'dy-disp-hotspot-views');

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
                window.showToast('头像已成功更换！');
                triggerSaveStorage();
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnResetAvatar && dyAvatarImg) {
        btnResetAvatar.addEventListener('click', () => {
            const currentLogo = selLogoVersion ? selLogoVersion.value : 'Laya.png';
            dyAvatarImg.src = getActiveLogoSrc(currentLogo);
            dyAvatarImg.dataset.custom = 'false';
            window.showToast('已恢复当前选中的官方 Logo 头像！');
            triggerSaveStorage();
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
    const STORAGE_KEY = 'LAYA_STUDIO_PERSIST_V9';
    let saveTimeout = null;

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
                skin: document.getElementById('sel-mobile-skin')?.value || 'douyin',
                logoVersion: document.getElementById('sel-logo-version')?.value || 'Laya.png'
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
            const data = JSON.parse(raw);

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
                    const el = document.getElementById(id);
                    if (el) {
                        el.value = val;
                        el.dispatchEvent(new Event('change'));
                    }
                });
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
            }

            if (data.skin && selMobileSkin) {
                selMobileSkin.value = data.skin;
                applyMobileSkin(data.skin);
            }

            if (data.danmakuList && window.DanmakuEngine) {
                window.DanmakuEngine.list = data.danmakuList;
                if (data.danmakuMode) window.DanmakuEngine.mode = data.danmakuMode;
                window.DanmakuEngine.refresh();
            }
        } catch (e) {
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
            window.showToast(isTraditional ? '画面已切换为：繁体中文' : '画面已切换为：简体中文');
        });
    }

    /* ==========================================================================
       ★ 辅助函数：确保克隆节点 100% 注入你绑定的真实蓝/紫原图，绝不替换为假图
       ========================================================================== */
    function injectRealLogosToClonedDoc(clonedDoc) {
        const curKey = selLogoVersion ? selLogoVersion.value : 'Laya.png';
        const activeRealSrc = getActiveLogoSrc(curKey);

        ['header-brand-logo', 'player-mini-logo', 'm-brand-logo'].forEach(id => {
            const clonedImg = clonedDoc.getElementById(id);
            if (clonedImg) clonedImg.src = activeRealSrc;
        });

        const clonedAvatar = clonedDoc.getElementById('dy-avatar-img');
        if (clonedAvatar && (!dyAvatarImg || dyAvatarImg.dataset.custom !== 'true')) {
            clonedAvatar.src = activeRealSrc;
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
    }

    /* ==========================================================================
       10. 超高清截图导出 (100% 保留你的蓝/紫真实图标)
       ========================================================================== */
    const btnSaveImg = document.getElementById('btn-save-img');
    if (btnSaveImg) {
        btnSaveImg.addEventListener('click', () => {
            if (!renderTarget) return;
            window.showToast('📸 正在生成带真实图标与全套 UI 的超高清截图...');

            html2canvas(renderTarget, {
                scale: 2.5,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#000000',
                onclone: (clonedDoc) => {
                    injectRealLogosToClonedDoc(clonedDoc);

                    const containerBox = renderTarget.getBoundingClientRect();
                    const cW = containerBox.width;
                    const cH = containerBox.height;
                    const cAspect = cW / cH;

                    const mediaDims = window.PlayerEngine ? window.PlayerEngine.getMediaNaturalDimensions() : { width: 1280, height: 720 };
                    const mW = mediaDims.width;
                    const mH = mediaDims.height;
                    const mAspect = mW / mH;

                    const zoom = (parseFloat(document.getElementById('in-media-scale').value) || 100) / 100;
                    const fitMode = document.getElementById('sel-crop-fit')?.value || 'cover';

                    let renderW, renderH;
                    if (fitMode === 'cover') {
                        if (mAspect > cAspect) {
                            renderH = cH * zoom;
                            renderW = renderH * mAspect;
                        } else {
                            renderW = cW * zoom;
                            renderH = renderW / mAspect;
                        }
                    } else {
                        if (mAspect > cAspect) {
                            renderW = cW * zoom;
                            renderH = renderW / mAspect;
                        } else {
                            renderH = cH * zoom;
                            renderW = renderH * mAspect;
                        }
                    }

                    const posX = (parseFloat(document.getElementById('in-pos-x').value) || 50) / 100;
                    const posY = (parseFloat(document.getElementById('in-pos-y').value) || 50) / 100;
                    const offX = (cW - renderW) * posX;
                    const offY = (cH - renderH) * posY;

                    const clonedMedia = window.PlayerEngine.isVideoMode 
                        ? clonedDoc.getElementById('preview-video')
                        : clonedDoc.getElementById('preview-img');

                    if (clonedMedia) {
                        clonedMedia.style.position = 'absolute';
                        clonedMedia.style.width = renderW + 'px';
                        clonedMedia.style.height = renderH + 'px';
                        clonedMedia.style.left = offX + 'px';
                        clonedMedia.style.top = offY + 'px';
                        clonedMedia.style.objectFit = 'fill';
                        clonedMedia.style.transform = 'none';
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
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `Laya_Screenshot_${Date.now()}.png`;
                link.href = canvas.toDataURL('image/png', 1.0);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.showToast('✅ 高清图片已保存！');
            }).catch(err => {
                window.showToast(`⚠️ 请点击右侧「🔵上传绑定蓝色Logo」或「🟣上传绑定紫色Logo」选中一次你的图标即可导出！`);
            });
        });
    }

    /* ==========================================================================
       ★ 11. 真机录屏级视频合成导出引擎 (修复PotPlayer只出声音/系统播放器无法打开)
       ========================================================================== */
    const btnSaveVid = document.getElementById('btn-save-vid');
    if (btnSaveVid) {
        btnSaveVid.addEventListener('click', async () => {
            const inMediaScale = document.getElementById('in-media-scale');
            const inPosY = document.getElementById('in-pos-y');
            const inPosX = document.getElementById('in-pos-x');
            const inStartTime = document.getElementById('in-start-time');
            const inTotalTime = document.getElementById('in-total-time');
            const inBuffer = document.getElementById('in-buffer');
            const swSyncVideoTime = document.getElementById('sw-sync-video-time');
            const swRecordFrame = document.getElementById('sw-record-frame');

            if (!window.PlayerEngine || !window.PlayerEngine.isVideoMode || !previewVideo) {
                window.showToast('⚠️ 请先点击「上传截图/视频」上传一段视频素材！');
                return;
            }

            let recordSeconds = parseInt(document.getElementById('sel-record-sec').value);
            if (document.getElementById('sel-record-sec').value === 'custom') {
                recordSeconds = Math.max(1, parseInt(document.getElementById('in-custom-sec').value) || 8);
            }

            const origBtnText = btnSaveVid.textContent;
            btnSaveVid.textContent = `⏳ 正在构建真机 UI 覆层...`;
            btnSaveVid.disabled = true;

            // 创建并挂载画布到 DOM 中（核心修复1：防止离屏 Canvas 被浏览器休眠导致录制出纯音频）
            const offCanvas = document.createElement('canvas');
            offCanvas.style.cssText = 'position:fixed; top:0; left:0; width:1px; height:1px; opacity:0.01; pointer-events:none; z-index:-9999;';
            document.body.appendChild(offCanvas);

            try {
                const isPort = renderTarget.classList.contains('mode-mobile-port');
                const isLand = renderTarget.classList.contains('mode-mobile-land');

                // 确保宽高均为标准偶数（编码器硬性要求）
                let outW = 1280, outH = 720;
                if (isPort) {
                    outW = 720;
                    outH = 1280;
                } else if (isLand) {
                    outW = 1300;
                    outH = 600;
                }
                offCanvas.width = outW;
                offCanvas.height = outH;
                const ctx = offCanvas.getContext('2d', { alpha: false });

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

                const pcBarBox = measureRelBox(document.getElementById('progress-click-bar'));
                const pcTimeBox = measureRelBox(document.getElementById('disp-time'));
                const mBarBox = measureRelBox(document.querySelector('.m-progress-track'));
                const mTimeBox = measureRelBox(document.getElementById('m-disp-time'));
                const dyBarBox = measureRelBox(document.querySelector('.dy-tiny-progressbar'));

                // 抓取静态 UI 覆层
                const uiSnapshotCanvas = await html2canvas(renderTarget, {
                    backgroundColor: null,
                    scale: scaleRatioX,
                    useCORS: true,
                    allowTaint: true,
                    onclone: (clonedDoc) => {
                        injectRealLogosToClonedDoc(clonedDoc);

                        const target = clonedDoc.getElementById('render-target');
                        if (target) {
                            target.style.width = targetRect.width + 'px';
                            target.style.height = targetRect.height + 'px';
                            target.style.position = 'relative';
                            target.style.background = 'transparent';
                            target.style.backgroundColor = 'transparent';
                            target.style.boxShadow = 'none';
                        }

                        const media = clonedDoc.getElementById('player-media-wrap');
                        if (media) media.style.display = 'none';
                        const dm = clonedDoc.getElementById('danmaku-container');
                        if (dm) dm.style.display = 'none';

                        ['progress-click-bar', 'disp-time', 'm-disp-time'].forEach(id => {
                            const el = clonedDoc.getElementById(id);
                            if (el) el.style.visibility = 'hidden';
                        });
                        const mTrack = clonedDoc.querySelector('.m-progress-track');
                        if (mTrack) mTrack.style.visibility = 'hidden';
                        const dyTrack = clonedDoc.querySelector('.dy-tiny-progressbar');
                        if (dyTrack) dyTrack.style.visibility = 'hidden';
                    }
                });

                btnSaveVid.textContent = `🔴 正在录屏合成 (${recordSeconds}s)...`;

                // 准备弹幕与时间参数
                const isFixedDm = (window.DanmakuEngine && window.DanmakuEngine.mode === 'fixed');
                const danmakuParticles = (window.DanmakuEngine ? window.DanmakuEngine.getActiveList() : []).map((dm, idx) => ({
                    text: dm.text,
                    color: isPort ? '#ffffff' : dm.color,
                    size: (dm.size || 16) * scaleRatioX,
                    y: (outH * dm.top) / 100,
                    x: isFixedDm ? ((outW * (dm.left || 20)) / 100) : ((outW * ((idx * 27) % 85)) / 100),
                    speed: isFixedDm ? 0 : ((dm.speed ? (22 - dm.speed) : 9) * 0.85 * (window.DanmakuEngine.speedFactor || 1))
                }));

                const baseStartSec = window.PlayerEngine.timeToSec(inStartTime.value);
                const totalVideoSec = window.PlayerEngine.timeToSec(inTotalTime.value) || 1125;
                const bufferPct = Math.min(100, Math.max(0, parseFloat(inBuffer.value) || 68)) / 100;

                // 视频跳回起点并开始播放
                previewVideo.currentTime = 0;
                await new Promise(resolve => {
                    const onSeeked = () => {
                        previewVideo.removeEventListener('seeked', onSeeked);
                        resolve();
                    };
                    previewVideo.addEventListener('seeked', onSeeked);
                    setTimeout(resolve, 250);
                });
                await previewVideo.play();

                let recordStartStamp = performance.now();

                // 封装单帧绘制函数
                const renderSingleFrame = () => {
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, outW, outH);

                    // 1. 绘制底层视频画面
                    const vw = previewVideo.videoWidth || 1280;
                    const vh = previewVideo.videoHeight || 720;
                    const mAspect = vw / vh;
                    const cAspect = outW / outH;
                    const zoom = (parseFloat(inMediaScale.value) || 100) / 100;
                    const fitMode = document.getElementById('sel-crop-fit')?.value || 'cover';

                    let rw, rh;
                    if (fitMode === 'cover') {
                        if (mAspect > cAspect) {
                            rh = outH * zoom;
                            rw = rh * mAspect;
                        } else {
                            rw = outW * zoom;
                            rh = rw / mAspect;
                        }
                    } else {
                        if (mAspect > cAspect) {
                            rw = outW * zoom;
                            rh = rw / mAspect;
                        } else {
                            rh = outH * zoom;
                            rw = rh * mAspect;
                        }
                    }

                    const posX = (parseFloat(inPosX.value) || 50) / 100;
                    const posY = (parseFloat(inPosY.value) || 50) / 100;
                    const offX = (outW - rw) * posX;
                    const offY = (outH - rh) * posY;

                    if (previewVideo.readyState >= 2) {
                        ctx.drawImage(previewVideo, offX, offY, rw, rh);
                    }

                    // 2. 绘制弹幕
                    const swDm = document.getElementById('sw-danmaku');
                    if (swDm && swDm.checked) {
                        ctx.save();
                        ctx.textBaseline = 'top';
                        danmakuParticles.forEach(p => {
                            ctx.font = `bold ${Math.round(p.size)}px -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`;
                            if (!isFixedDm) {
                                p.x -= p.speed;
                                const tw = ctx.measureText(p.text).width;
                                if (p.x < -tw - 40) {
                                    p.x = outW + Math.random() * 80;
                                }
                            }
                            ctx.lineWidth = 3;
                            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
                            ctx.strokeText(p.text, p.x, p.y);
                            ctx.fillStyle = p.color;
                            ctx.fillText(p.text, p.x, p.y);
                        });
                        ctx.restore();
                    }

                    // 3. 叠加 UI 覆层
                    ctx.drawImage(uiSnapshotCanvas, 0, 0, outW, outH);

                    // 4. 动态绘制进度条与时间码
                    const elapsedSec = (!swSyncVideoTime || swSyncVideoTime.checked)
                        ? ((performance.now() - recordStartStamp) / 1000)
                        : 0;
                    const curSec = baseStartSec + elapsedSec;
                    const curPct = Math.min(1, Math.max(0, curSec / totalVideoSec));

                    ctx.save();
                    if (!isPort && !isLand) {
                        const swBot = document.getElementById('sw-bottom-bar');
                        if ((!swBot || swBot.checked) && pcBarBox) {
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
                        if ((!swBot || swBot.checked) && pcTimeBox) {
                            const timeText = `${window.PlayerEngine.secToTime(Math.floor(curSec))} / ${window.PlayerEngine.secToTime(totalVideoSec)}`;
                            ctx.font = `500 ${Math.round(11.5 * scaleRatioX)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
                            ctx.fillStyle = '#d0d4dc';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(timeText, pcTimeBox.x, pcTimeBox.y + pcTimeBox.h / 2);
                        }
                    } else if (isLand) {
                        const swMBot = document.getElementById('sw-m-bottom-bar');
                        if ((!swMBot || swMBot.checked) && mBarBox) {
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
                        if ((!swMBot || swMBot.checked) && mTimeBox) {
                            // ★ 录屏导出时同步绘制“当前时间 / 结尾总时长” (如 0:04:07 / 2:06:21)
                            const shortTime = `${window.PlayerEngine.secToShortTime(Math.floor(curSec))} / ${window.PlayerEngine.secToShortTime(totalVideoSec)}`;
                            ctx.font = `600 ${Math.round(12.5 * scaleRatioX)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
                            ctx.fillStyle = '#ffffff';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(shortTime, mTimeBox.x, mTimeBox.y + mTimeBox.h / 2);
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

                    // 5. 绘制外边框
                    if (!swRecordFrame || swRecordFrame.checked) {
                        ctx.save();
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
                        ctx.lineWidth = 4;
                        ctx.strokeRect(2, 2, outW - 4, outH - 4);
                        ctx.restore();
                    }
                };

                // ★ 核心修复2：在启动录制流之前，必须先绘制首帧激活画布缓存！
                renderSingleFrame();

                const canvasStream = offCanvas.captureStream(30);
                const videoTrack = canvasStream.getVideoTracks()[0];

                // 提取原声音轨
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
                        window._audioSrcNode.connect(window._audioDstNode);
                        window._audioSrcNode.connect(window._audioCtx.destination);
                    }
                    audioTracks = window._audioDstNode.stream.getAudioTracks();
                } catch (audioErr) {
                    console.warn('Audio fallback:', audioErr);
                }

                const combinedStream = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...audioTracks
                ]);

                // ★ 核心修复3：严格匹配音视频双轨标准编码格式，防止生成半残废的容器头
                const mimeCandidates = [
                    { mime: 'video/mp4;codecs="avc1.42E01E, mp4a.40.2"', ext: 'mp4' },
                    { mime: 'video/mp4;codecs="avc1.424028, mp4a.40.2"', ext: 'mp4' },
                    { mime: 'video/mp4', ext: 'mp4' },
                    { mime: 'video/webm;codecs="vp9,opus"', ext: 'webm' },
                    { mime: 'video/webm;codecs="vp8,opus"', ext: 'webm' },
                    { mime: 'video/webm', ext: 'webm' }
                ];

                let selectedFormat = { mime: '', ext: 'webm' };
                for (const item of mimeCandidates) {
                    if (window.MediaRecorder && MediaRecorder.isTypeSupported(item.mime)) {
                        selectedFormat = item;
                        break;
                    }
                }

                const recorderOptions = { videoBitsPerSecond: 8000000 };
                if (selectedFormat.mime) {
                    recorderOptions.mimeType = selectedFormat.mime;
                }

                const recorder = new MediaRecorder(combinedStream, recorderOptions);
                const chunks = [];

                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) chunks.push(e.data);
                };

                recorder.onstop = () => {
                    if (offCanvas.parentNode) offCanvas.parentNode.removeChild(offCanvas);
                    btnSaveVid.textContent = origBtnText;
                    btnSaveVid.disabled = false;

                    if (chunks.length === 0) {
                        window.showToast('❌ 录制数据为空，请重试');
                        return;
                    }

                    const blob = new Blob(chunks, { type: selectedFormat.mime || 'video/webm' });
                    const downloadUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.style.display = 'none';
                    const modeTag = isPort ? 'MobilePort' : (isLand ? 'MobileCinema' : 'WebPC');
                    link.download = `Laya_${modeTag}_${Date.now()}.${selectedFormat.ext}`;
                    link.href = downloadUrl;
                    document.body.appendChild(link);
                    link.click();
                    setTimeout(() => {
                        document.body.removeChild(link);
                        URL.revokeObjectURL(downloadUrl);
                    }, 500);

                    window.showToast(`🎉 录屏视频 (.${selectedFormat.ext}) 导出成功！画面与声音均已完美合成！`);
                };

                // 启动录制并开启 30fps 稳定帧推送循环
                recordStartStamp = performance.now();
                recorder.start(200);

                let isRecording = true;
                const frameInterval = setInterval(() => {
                    if (!isRecording) return;
                    renderSingleFrame();
                    // 显式通知视频轨推送新帧
                    if (videoTrack && typeof videoTrack.requestFrame === 'function') {
                        videoTrack.requestFrame();
                    }
                }, 1000 / 30);

                setTimeout(() => {
                    isRecording = false;
                    clearInterval(frameInterval);
                    if (recorder.state !== 'inactive') {
                        recorder.stop();
                    }
                }, recordSeconds * 1000);

            } catch (err) {
                if (offCanvas.parentNode) offCanvas.parentNode.removeChild(offCanvas);
                console.error(err);
                btnSaveVid.textContent = origBtnText;
                btnSaveVid.disabled = false;
                window.showToast(`⚠️ 请先点击右侧「🔵上传绑定蓝色Logo」和「🟣上传绑定紫色Logo」选中一次你的图标文件，即可消除本地跨域限制并导出！`);
            }
        });
    }
})();
