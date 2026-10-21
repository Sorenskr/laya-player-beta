/**
 * ==========================================================================
 * player.js - 媒体播放器核心控制引擎 (三端进度/时间联动、独立取景框与画幅中枢)
 * ==========================================================================
 */
window.PlayerEngine = {
    isVideoMode: false,
    previewVideo: null,
    previewImg: null,
    renderTarget: null,
    trimStart: 0,
    trimEnd: 0,
    videoDuration: 0,

    getTrimRange() {
        const dur = (this.previewVideo && this.previewVideo.duration && isFinite(this.previewVideo.duration))
            ? this.previewVideo.duration
            : (this.videoDuration || 5);
        const start = Math.max(0, Math.min(this.trimStart || 0, dur - 0.2));
        const end = (this.trimEnd && this.trimEnd > start + 0.2) ? Math.min(this.trimEnd, dur) : dur;
        return { start, end, duration: Math.max(0.2, end - start), total: dur };
    },

    secToMinSec(sec, showTenths = false) {
        if (!isFinite(sec) || sec < 0) sec = 0;
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (!showTenths) return base;
        const tenth = Math.floor((sec - Math.floor(sec)) * 10);
        return `${base}.${tenth}`;
    },

    timeToSec(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.trim().split(':').map(Number);
        if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
        if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
        return parseInt(timeStr, 10) || 0;
    },
    secToTime(totalSec) {
        if (isNaN(totalSec) || totalSec < 0) totalSec = 0;
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = Math.floor(totalSec % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },
    secToShortTime(totalSec) {
        if (isNaN(totalSec) || totalSec < 0) totalSec = 0;
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = Math.floor(totalSec % 60);
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },
    getMediaNaturalDimensions() {
        if (this.isVideoMode && this.previewVideo) {
            return {
                width: this.previewVideo.videoWidth || 1280,
                height: this.previewVideo.videoHeight || 720
            };
        } else if (this.previewImg) {
            return {
                width: this.previewImg.naturalWidth || 1280,
                height: this.previewImg.naturalHeight || 720
            };
        }
        return { width: 1280, height: 720 };
    }
};

(function () {
    const renderTarget = document.getElementById('render-target');
    const playerMediaWrap = document.getElementById('player-media-wrap');
    const previewImg = document.getElementById('preview-img');
    const previewVideo = document.getElementById('preview-video');
    const mediaUploader = document.getElementById('media-uploader');
    const dyFullscreenPill = document.getElementById('dy-fullscreen-pill');
    const swDyLandBox = document.getElementById('sw-dy-land-box');
    const selCropFit = document.getElementById('sel-crop-fit');
    // 电脑端播放控件
    const btnTogglePlayback = document.getElementById('btn-toggle-playback');
    const btnBotPlayState = document.getElementById('btn-bot-play-state');
    const iconCenterPlay = document.getElementById('icon-center-play');
    const iconCenterPause = document.getElementById('icon-center-pause');
    const iconBotPlay = document.getElementById('icon-bot-play');
    const iconBotPause = document.getElementById('icon-bot-pause');
    const dispCenterPill = document.getElementById('disp-center-pill');
    // 手机横屏影音专属控件
    const mBtnTogglePlay = document.getElementById('m-btn-toggle-play');
    const mIconPlay = document.getElementById('m-icon-play');
    const mIconPause = document.getElementById('m-icon-pause');
    const mBtnCenterPlay = document.getElementById('m-btn-center-play');
    const mCenterIconPlay = document.getElementById('m-center-icon-play');
    const mCenterIconPause = document.getElementById('m-center-icon-pause');
    const mDispSubTitle = document.getElementById('m-disp-sub-title');
    const inMSubTitle = document.getElementById('in-m-sub-title');
    const swMAutoSub = document.getElementById('sw-m-auto-sub');
    const mDispTime = document.getElementById('m-disp-time');
    const mProgressContainer = document.getElementById('m-progress-container');
    const mDispProgress = document.getElementById('m-disp-progress');
    const mDispBuffer = document.getElementById('m-disp-buffer');
    // 手机竖屏底部进度条
    const dyTinyFill = document.getElementById('dy-tiny-fill');
    const dyTinyBuffer = document.getElementById('dy-tiny-buffer');
    // 图4 (mode-dy-land) 专属控件
    const dylBtnBack = document.getElementById('dyl-btn-back');
    const dylBtnCenterPlay = document.getElementById('dyl-btn-center-play');
    const dylSvgPause = document.getElementById('dyl-svg-pause');
    const dylSvgPlay = document.getElementById('dyl-svg-play');
    const dylDispCur = document.getElementById('dyl-disp-cur');
    const dylDispDur = document.getElementById('dyl-disp-dur');
    const dylProgressWrap = document.getElementById('dyl-progress-wrap');
    const dylProgressFill = document.getElementById('dyl-progress-fill');
    const btnEnterDyFullscreen = document.getElementById('btn-enter-dy-fullscreen');
    const btnExitDyFullscreen = document.getElementById('btn-exit-dy-fullscreen');
    // 时间与进度控制输入框
    const inStartTime = document.getElementById('in-start-time');
    const inTotalTime = document.getElementById('in-total-time');
    const dispTime = document.getElementById('disp-time');
    const swSyncVideoTime = document.getElementById('sw-sync-video-time');
    const inProgress = document.getElementById('in-progress');
    const txtProgress = document.getElementById('txt-progress');
    const dispProgressBar = document.getElementById('disp-progress-bar');
    const inBuffer = document.getElementById('in-buffer');
    const txtBuffer = document.getElementById('txt-buffer');
    const dispBufferBar = document.getElementById('disp-buffer-bar');
    const progressClickBar = document.getElementById('progress-click-bar');
    // 构图与缩放滑块
    const inPosY = document.getElementById('in-pos-y');
    const txtPosY = document.getElementById('txt-pos-y');
    const inPosX = document.getElementById('in-pos-x');
    const txtPosX = document.getElementById('txt-pos-x');
    const inMediaScale = document.getElementById('in-media-scale');
    const txtMediaScale = document.getElementById('txt-media-scale');
    const btnResetPos = document.getElementById('btn-reset-pos');
    const btnFacePreset = document.getElementById('btn-face-preset');
    // 独立取景框浮窗 DOM
    const swCropWindow = document.getElementById('sw-crop-window');
    const cropInspectorWindow = document.getElementById('crop-inspector-window');
    const cropWindowHeader = document.getElementById('crop-window-header');
    const btnCloseCropWindow = document.getElementById('btn-close-crop-window');
    const btnCropOrientPort = document.getElementById('btn-crop-orient-port');
    const btnCropOrientLand = document.getElementById('btn-crop-orient-land');
    const selCropOrient = document.getElementById('sel-crop-orient');
    const cropThumbImg = document.getElementById('crop-thumb-img');
    const cropSelectionBox = document.getElementById('crop-selection-box');
    const cropWindowBody = document.getElementById('crop-window-body');
    const btnCropBoxShrink = document.getElementById('btn-crop-box-shrink');
    const btnCropBoxGrow = document.getElementById('btn-crop-box-grow');
    const btnCropReset = document.getElementById('btn-crop-reset');
    const txtCropWinSize = document.getElementById('txt-crop-win-size');
    // 顶部与剪映栏原声开关 & 预览倍速选择器
    const btnHeaderSound = document.getElementById('btn-header-sound');
    const selPreviewSpeed = document.getElementById('sel-preview-speed');
    const jySelSpeed = document.getElementById('jy-sel-speed');
    // 剪映风格时间轴裁剪面板 DOM
    const jyTrimmerPanel = document.getElementById('jy-trimmer-panel');
    const jyBtnPlay = document.getElementById('jy-btn-play');
    const jyDispCur = document.getElementById('jy-disp-cur');
    const jyDispTotal = document.getElementById('jy-disp-total');
    const jyDispStart = document.getElementById('jy-disp-start');
    const jyDispEnd = document.getElementById('jy-disp-end');
    const jyDispDur = document.getElementById('jy-disp-dur');
    const jyBtnSetIn = document.getElementById('jy-btn-set-in');
    const jyBtnSetOut = document.getElementById('jy-btn-set-out');
    const jyBtnReset = document.getElementById('jy-btn-reset');
    const jyRuler = document.getElementById('jy-ruler');
    const jyBtnMute = document.getElementById('jy-btn-mute');
    const jyTrackMain = document.getElementById('jy-track-main');
    const jyFilmstrip = document.getElementById('jy-filmstrip');
    const jyWaveCanvas = document.getElementById('jy-wave-canvas');
    const jyMaskLeft = document.getElementById('jy-mask-left');
    const jyMaskRight = document.getElementById('jy-mask-right');
    const jySelectionBox = document.getElementById('jy-selection-box');
    const jyHandleLeft = document.getElementById('jy-handle-left');
    const jyHandleRight = document.getElementById('jy-handle-right');
    const jyTipLeft = document.getElementById('jy-tip-left');
    const jyTipRight = document.getElementById('jy-tip-right');
    const jyPlayhead = document.getElementById('jy-playhead');

    window.PlayerEngine.renderTarget = renderTarget;
    window.PlayerEngine.previewImg = previewImg;
    window.PlayerEngine.previewVideo = previewVideo;
    window.PlayerEngine.cropOrient = 'land';

    const toast = (msg) => {
        if (typeof window.showToast === 'function') window.showToast(msg);
    };

    /* ==========================================================================
       0. 页面预览原声控制 & 预览倍速同步中枢
       ========================================================================== */
    function syncSoundUI(isMuted) {
        if (jyBtnMute) jyBtnMute.textContent = isMuted ? '🔇' : '🔊';
        if (btnHeaderSound) {
            btnHeaderSound.textContent = isMuted ? '🔇 已静音' : '🔊 原声开启';
            btnHeaderSound.style.borderColor = isMuted ? 'rgba(148, 163, 184, 0.4)' : 'rgba(56, 189, 248, 0.5)';
            btnHeaderSound.style.color = isMuted ? '#94a3b8' : '#38bdf8';
        }
    }

    function setVideoSoundMuted(isMuted, showMsg = false) {
        if (previewVideo) {
            previewVideo.muted = !!isMuted;
            previewVideo.volume = 1.0;
        }
        if (!isMuted && window._audioCtx && window._audioCtx.state === 'suspended') {
            window._audioCtx.resume().catch(() => {});
        }
        syncSoundUI(!!isMuted);
        if (showMsg) {
            toast(isMuted ? '🔇 已静音页面预览' : '🔊 已开启页面视频原声播放');
        }
    }
    window.PlayerEngine.setVideoSoundMuted = setVideoSoundMuted;

    function setPreviewPlaybackSpeed(rateVal, showMsg = false) {
        const rate = parseFloat(rateVal) || 1.0;
        if (previewVideo) {
            previewVideo.playbackRate = rate;
            previewVideo.defaultPlaybackRate = rate;
        }
        const rateStr = String(rateVal);
        if (selPreviewSpeed && selPreviewSpeed.value !== rateStr) selPreviewSpeed.value = rateStr;
        if (jySelSpeed && jySelSpeed.value !== rateStr) jySelSpeed.value = rateStr;
        const dispSpeedVal = document.getElementById('disp-speed-val');
        if (dispSpeedVal) dispSpeedVal.textContent = rate + 'X';
        const dylBtnSpeed = document.getElementById('dyl-btn-speed');
        if (dylBtnSpeed) dylBtnSpeed.textContent = '倍速 ' + rate + 'X';
        if (showMsg) {
            toast(`⚡ 预览播放倍速已切换为：${rate}x`);
        }
    }
    window.PlayerEngine.setPreviewPlaybackSpeed = setPreviewPlaybackSpeed;

    if (btnHeaderSound) {
        btnHeaderSound.addEventListener('click', () => {
            setVideoSoundMuted(!previewVideo.muted, true);
        });
    }
    if (selPreviewSpeed) {
        selPreviewSpeed.addEventListener('change', (e) => {
            setPreviewPlaybackSpeed(e.target.value, true);
        });
    }
    if (jySelSpeed) {
        jySelSpeed.addEventListener('change', (e) => {
            setPreviewPlaybackSpeed(e.target.value, true);
        });
    }
    if (previewVideo) {
        previewVideo.addEventListener('play', () => {
            if (window._audioCtx && window._audioCtx.state === 'suspended') {
                window._audioCtx.resume().catch(() => {});
            }
        });
    }

    /* ==========================================================================
       1. 视口画幅切换器 (支持 mode-pc / mode-mobile-land / mode-mobile-port / mode-dy-land)
       ========================================================================== */
    const tabButtons = document.querySelectorAll('.tab-btn');
    function activateViewportMode(targetMode) {
        tabButtons.forEach(b => {
            b.classList.toggle('active', b.dataset.mode === targetMode);
        });
        window.PlayerEngine.currentMode = targetMode;
        const skinVal = document.getElementById('sel-mobile-skin')?.value || 'laya-app';
        const currentSkin = skinVal === 'laya-app' ? 'skin-laya-app' : (skinVal === 'laya' ? 'skin-laya' : 'skin-douyin');
        const isCmtOpen = !!(document.getElementById('sw-dy-comment-drawer')?.checked);
        const cmtClass = (targetMode === 'mode-mobile-port' && isCmtOpen) ? ' dy-comment-open' : '';
        renderTarget.className = `player-box ${targetMode} ${currentSkin}${cmtClass}`;

        if (targetMode === 'mode-mobile-land') {
            if (typeof window.switchRightTab === 'function') window.switchRightTab('m-cinema');
            window.PlayerEngine.cropOrient = 'land';
        } else if (targetMode === 'mode-mobile-port') {
            if (typeof window.switchRightTab === 'function') window.switchRightTab('dy');
            window.PlayerEngine.cropOrient = (swDyLandBox && swDyLandBox.checked) ? 'land' : 'port';
        } else if (targetMode === 'mode-dy-land') {
            if (typeof window.switchRightTab === 'function') window.switchRightTab('dy');
            window.PlayerEngine.cropOrient = 'land';
        } else {
            if (typeof window.switchRightTab === 'function') window.switchRightTab('web');
            window.PlayerEngine.cropOrient = 'land';
        }
        checkMediaAspect();
        updateTransform();
        setTimeout(() => {
            updateTransform();
            if (typeof window.drawWaveform === 'function') window.drawWaveform();
        }, 60);
    }
    window.PlayerEngine.activateViewportMode = activateViewportMode;

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            activateViewportMode(btn.dataset.mode);
        });
    });

    /* ==========================================================================
       2. 媒体上传、格式嗅探、小窗缩略图与剪映时间轴初始化
       ========================================================================== */
    if (mediaUploader) {
        mediaUploader.addEventListener('click', () => {
            mediaUploader.value = '';
        });
        mediaUploader.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const fileName = file.name || '';
            const fileType = file.type || '';
            const isVideo = fileType.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(fileName);
            const isImage = fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|jfif|bmp|svg)$/i.test(fileName);

            if (isVideo) {
                window.PlayerEngine.isVideoMode = true;
                previewImg.style.display = 'none';
                previewVideo.style.display = 'block';
                setVideoSoundMuted(false, false);
                const curSpeed = selPreviewSpeed ? (parseFloat(selPreviewSpeed.value) || 1.0) : 1.0;
                if (previewVideo.src && previewVideo.src.startsWith('blob:')) {
                    URL.revokeObjectURL(previewVideo.src);
                }
                const vidUrl = URL.createObjectURL(file);
                previewVideo.src = vidUrl;
                previewVideo.playbackRate = curSpeed;
                previewVideo.defaultPlaybackRate = curSpeed;
                previewVideo.play().then(() => {
                    updatePlayStateUI(true);
                }).catch(() => {
                    updatePlayStateUI(false);
                });

                if (jyTrimmerPanel) jyTrimmerPanel.style.display = 'flex';
                buildJianyingTimeline(vidUrl);
                toast('🎬 视频加载成功！页面原声已开启，右上取景框可自由切换竖框/横框并拖动！');
            } else if (isImage || !isVideo) {
                window.PlayerEngine.isVideoMode = false;
                previewVideo.pause();
                previewVideo.style.display = 'none';
                previewImg.style.display = 'block';
                if (jyTrimmerPanel) jyTrimmerPanel.style.display = 'none';
                if (previewImg.src && previewImg.src.startsWith('blob:')) {
                    URL.revokeObjectURL(previewImg.src);
                }
                const imgUrl = URL.createObjectURL(file);
                previewImg.src = imgUrl;
                if (cropThumbImg) cropThumbImg.src = imgUrl;
                previewImg.onload = () => {
                    checkMediaAspect();
                    updateTransform();
                };
                updatePlayStateUI(false);
                toast('🖼️ 图片素材加载成功！');
            }
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        });
    }

    /* ==========================================================================
       2.5 剪映风格视频时间轴裁剪器 (图2：刻度尺、胶片缩略图、青色音频波形、区间手柄)
       ========================================================================== */
    function renderJianyingRuler(dur) {
        if (!jyRuler) return;
        jyRuler.innerHTML = '';
        const steps = 6;
        for (let i = 0; i <= steps; i++) {
            const t = (dur / steps) * i;
            const span = document.createElement('span');
            span.className = 'jy-ruler-tick';
            span.textContent = window.PlayerEngine.secToMinSec(t, false);
            jyRuler.appendChild(span);
            if (i < steps) {
                const dot = document.createElement('span');
                dot.className = 'jy-ruler-dot';
                jyRuler.appendChild(dot);
            }
        }
    }

    function renderJianyingWaveform() {
        if (!jyWaveCanvas) return;
        const w = jyWaveCanvas.clientWidth || 720;
        const h = jyWaveCanvas.clientHeight || 22;
        jyWaveCanvas.width = w;
        jyWaveCanvas.height = h;
        const ctx = jyWaveCanvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(130, 245, 255, 0.55)';
        const barW = 2;
        const gap = 2;
        const midY = h / 2;
        let seed = 42;
        for (let x = 0; x < w; x += barW + gap) {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            const norm = (seed / 4294967296);
            const env = 0.35 + 0.65 * Math.abs(Math.sin(x * 0.035));
            const amp = Math.max(2, Math.round(norm * env * (h * 0.85)));
            ctx.fillRect(x, midY - amp / 2, barW, amp);
        }
    }

    function getDesiredClipDuration() {
        const selRecSecEl = document.getElementById('sel-record-sec');
        const inCustomSecEl = document.getElementById('in-custom-sec');
        if (selRecSecEl) {
            const val = selRecSecEl.value === 'custom'
                ? (parseFloat(inCustomSecEl ? inCustomSecEl.value : 10) || 10)
                : (parseFloat(selRecSecEl.value) || 10);
            if (val > 0) return val;
        }
        return 10;
    }

    function syncTopDurationControl(clipDur) {
        const selRecSecEl = document.getElementById('sel-record-sec');
        const inCustomSecEl = document.getElementById('in-custom-sec');
        if (!selRecSecEl || !inCustomSecEl) return;
        const rounded = Math.round(clipDur * 10) / 10;
        if (Math.abs(rounded - 5) < 0.15) {
            selRecSecEl.value = '5';
            inCustomSecEl.style.display = 'none';
        } else if (Math.abs(rounded - 10) < 0.15) {
            selRecSecEl.value = '10';
            inCustomSecEl.style.display = 'none';
        } else if (Math.abs(rounded - 15) < 0.15) {
            selRecSecEl.value = '15';
            inCustomSecEl.style.display = 'none';
        } else {
            selRecSecEl.value = 'custom';
            inCustomSecEl.style.display = 'inline-block';
            inCustomSecEl.value = String(Math.max(1, Math.round(rounded)));
        }
    }

    function updateJianyingTrimUI() {
        const dur = window.PlayerEngine.videoDuration || 1;
        const start = window.PlayerEngine.trimStart || 0;
        const end = window.PlayerEngine.trimEnd || dur;
        const leftPct = Math.max(0, Math.min(100, (start / dur) * 100));
        const rightPct = Math.max(0, Math.min(100, 100 - (end / dur) * 100));

        if (jySelectionBox) {
            jySelectionBox.style.left = leftPct + '%';
            jySelectionBox.style.right = rightPct + '%';
        }
        if (jyMaskLeft) jyMaskLeft.style.width = leftPct + '%';
        if (jyMaskRight) jyMaskRight.style.width = rightPct + '%';

        const startStr = window.PlayerEngine.secToMinSec(start, true);
        const endStr = window.PlayerEngine.secToMinSec(end, true);
        const clipDur = Math.max(0.1, end - start);

        if (jyDispStart) jyDispStart.textContent = startStr;
        if (jyDispEnd) jyDispEnd.textContent = endStr;
        if (jyDispDur) jyDispDur.textContent = clipDur.toFixed(1) + 's';
        if (jyTipLeft) jyTipLeft.textContent = startStr;
        if (jyTipRight) jyTipRight.textContent = endStr;
        if (jyDispTotal) jyDispTotal.textContent = window.PlayerEngine.secToMinSec(dur, true);

        if (window.PlayerEngine.userHasTrimmed) {
            syncTopDurationControl(clipDur);
        }
    }

    window.PlayerEngine.applyDropdownDuration = function (sec) {
        const targetSec = Math.max(1, parseFloat(sec) || 10);
        if (!window.PlayerEngine.isVideoMode || !previewVideo) return;
        const dur = (previewVideo.duration && isFinite(previewVideo.duration))
            ? previewVideo.duration
            : (window.PlayerEngine.videoDuration || targetSec);
        const clipLen = Math.min(targetSec, dur);
        let anchorStart = window.PlayerEngine.userHasTrimmed
            ? (window.PlayerEngine.trimStart || 0)
            : (previewVideo.currentTime || 0);
        if (anchorStart + clipLen > dur) {
            anchorStart = Math.max(0, dur - clipLen);
        }
        window.PlayerEngine.trimStart = anchorStart;
        window.PlayerEngine.trimEnd = Math.min(dur, anchorStart + clipLen);
        window.PlayerEngine.userHasTrimmed = true;
        window.PlayerEngine._allowPlayOutsideTrim = false;
        previewVideo.currentTime = window.PlayerEngine.trimStart;
        updateJianyingTrimUI();
        updateJianyingPlayheadUI();
    };

    function updateJianyingPlayheadUI() {
        if (!window.PlayerEngine.isVideoMode || !previewVideo) return;
        const dur = window.PlayerEngine.videoDuration || previewVideo.duration || 1;
        const cur = previewVideo.currentTime || 0;
        const pct = Math.max(0, Math.min(100, (cur / dur) * 100));
        if (jyPlayhead) jyPlayhead.style.left = pct + '%';
        if (jyDispCur) jyDispCur.textContent = window.PlayerEngine.secToMinSec(cur, true);
    }

    function buildJianyingTimeline(vidUrl) {
        const tempVid = document.createElement('video');
        tempVid.src = vidUrl;
        tempVid.muted = true;
        tempVid.playsInline = true;

        tempVid.addEventListener('loadedmetadata', async () => {
            const dur = (tempVid.duration && isFinite(tempVid.duration)) ? tempVid.duration : 10;
            window.PlayerEngine.videoDuration = dur;
            window.PlayerEngine.trimStart = 0;
            window.PlayerEngine.trimEnd = dur;
            window.PlayerEngine.userHasTrimmed = false;
            window.PlayerEngine._allowPlayOutsideTrim = false;

            renderJianyingRuler(dur);
            renderJianyingWaveform();
            updateJianyingTrimUI();
            updateJianyingPlayheadUI();

            // 提取 8 张轻量帧缩略图铺满胶片轨道，完成后立即释放临时解码器防止主视频卡顿
            const thumbCount = 8;
            if (jyFilmstrip) jyFilmstrip.innerHTML = '';
            const thumbDivs = [];
            for (let i = 0; i < thumbCount; i++) {
                const d = document.createElement('div');
                d.className = 'jy-film-thumb';
                if (jyFilmstrip) jyFilmstrip.appendChild(d);
                thumbDivs.push(d);
            }

            const c = document.createElement('canvas');
            const vw = tempVid.videoWidth || 640;
            const vh = tempVid.videoHeight || 360;
            c.width = 128;
            c.height = Math.round(128 * (vh / vw)) || 72;
            const ctx = c.getContext('2d');

            for (let i = 0; i < thumbCount; i++) {
                if (window.__isExportRecording) break;
                const seekTime = Math.min(dur - 0.05, Math.max(0.05, ((i + 0.5) / thumbCount) * dur));
                await new Promise((resolve) => {
                    const timer = setTimeout(resolve, 180);
                    const onSeeked = () => {
                        clearTimeout(timer);
                        tempVid.removeEventListener('seeked', onSeeked);
                        try {
                            ctx.drawImage(tempVid, 0, 0, c.width, c.height);
                            const dataUrl = c.toDataURL('image/jpeg', 0.6);
                            if (thumbDivs[i]) thumbDivs[i].style.backgroundImage = `url(${dataUrl})`;
                            if (i === 0 && cropThumbImg) {
                                const bigC = document.createElement('canvas');
                                bigC.width = Math.min(480, vw);
                                bigC.height = Math.round(bigC.width * (vh / vw)) || 270;
                                bigC.getContext('2d').drawImage(tempVid, 0, 0, bigC.width, bigC.height);
                                cropThumbImg.src = bigC.toDataURL('image/jpeg', 0.8);
                            }
                        } catch (e) {}
                        resolve();
                    };
                    tempVid.addEventListener('seeked', onSeeked);
                    tempVid.currentTime = seekTime;
                });
            }

            // 彻底释放临时视频解码器，避免与主预览视频争抢硬件加速管线导致卡顿
            try {
                tempVid.pause();
                tempVid.removeAttribute('src');
                tempVid.load();
            } catch (e) {}
        }, { once: true });
    }

    // 剪映手柄与播放指针拖拽交互
    let jyDragMode = null; // 'left' | 'right' | 'range' | 'playhead'
    let jyRangeDragStartX = 0;
    let jyRangeDragStartTime = 0;
    let jyRangeInitialStart = 0;
    let jyRangeInitialEnd = 0;
    let jyRangeHasMoved = false;

    function getTrackTimeFromClientX(clientX) {
        if (!jyTrackMain) return 0;
        const rect = jyTrackMain.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));
        const dur = window.PlayerEngine.videoDuration || previewVideo.duration || 1;
        return ratio * dur;
    }

    if (jyHandleLeft) {
        jyHandleLeft.addEventListener('mousedown', (e) => {
            jyDragMode = 'left';
            jyRangeInitialStart = window.PlayerEngine.trimStart || 0;
            jyRangeInitialEnd = window.PlayerEngine.trimEnd || window.PlayerEngine.videoDuration || 1;
            window.PlayerEngine.userHasTrimmed = true;
            window.PlayerEngine._allowPlayOutsideTrim = false;
            jyHandleLeft.classList.add('dragging');
            e.stopPropagation();
            e.preventDefault();
        });
    }
    if (jyHandleRight) {
        jyHandleRight.addEventListener('mousedown', (e) => {
            jyDragMode = 'right';
            jyRangeInitialStart = window.PlayerEngine.trimStart || 0;
            jyRangeInitialEnd = window.PlayerEngine.trimEnd || window.PlayerEngine.videoDuration || 1;
            window.PlayerEngine.userHasTrimmed = true;
            window.PlayerEngine._allowPlayOutsideTrim = true;
            jyHandleRight.classList.add('dragging');
            e.stopPropagation();
            e.preventDefault();
        });
    }
    if (jySelectionBox) {
        jySelectionBox.addEventListener('mousedown', (e) => {
            if (e.target === jyHandleLeft || e.target === jyHandleRight || (jyHandleLeft && jyHandleLeft.contains(e.target)) || (jyHandleRight && jyHandleRight.contains(e.target))) {
                return;
            }
            const dur = window.PlayerEngine.videoDuration || previewVideo.duration || 1;
            const curStart = window.PlayerEngine.trimStart || 0;
            const curEnd = window.PlayerEngine.trimEnd || dur;
            // 若当前已裁剪出子区间，支持直接按住选框整体左右平移（保持选定秒数如 10s 不变）
            if (curEnd - curStart < dur - 0.2) {
                jyDragMode = 'range';
                jyRangeDragStartX = e.clientX;
                jyRangeDragStartTime = getTrackTimeFromClientX(e.clientX);
                jyRangeInitialStart = curStart;
                jyRangeInitialEnd = curEnd;
                jyRangeHasMoved = false;
                jySelectionBox.classList.add('dragging');
                e.stopPropagation();
                e.preventDefault();
            }
        });
    }
    if (jyPlayhead) {
        jyPlayhead.addEventListener('mousedown', (e) => {
            jyDragMode = 'playhead';
            window.PlayerEngine._allowPlayOutsideTrim = true;
            e.stopPropagation();
            e.preventDefault();
        });
    }
    if (jyTrackMain) {
        jyTrackMain.addEventListener('mousedown', (e) => {
            if (e.target === jyHandleLeft || e.target === jyHandleRight) return;
            jyDragMode = 'playhead';
            const t = getTrackTimeFromClientX(e.clientX);
            const range = window.PlayerEngine.getTrimRange();
            window.PlayerEngine._allowPlayOutsideTrim = (t < range.start || t >= range.end - 0.1);
            if (previewVideo && window.PlayerEngine.isVideoMode) {
                previewVideo.currentTime = t;
                updateJianyingPlayheadUI();
            }
        });
    }

    window.addEventListener('mousemove', (e) => {
        if (!jyDragMode || !window.PlayerEngine.isVideoMode) return;
        const t = getTrackTimeFromClientX(e.clientX);
        const dur = window.PlayerEngine.videoDuration || previewVideo.duration || 1;
        const minClip = Math.min(1.0, dur);

        if (jyDragMode === 'left') {
            const newStart = Math.max(0, Math.min(t, dur - minClip));
            let curEnd = window.PlayerEngine.trimEnd || dur;
            if (newStart >= curEnd - minClip) {
                const prevSpan = Math.max(minClip, (jyRangeInitialEnd - jyRangeInitialStart) || getDesiredClipDuration());
                curEnd = Math.min(dur, newStart + prevSpan);
                window.PlayerEngine.trimEnd = curEnd;
            }
            window.PlayerEngine.trimStart = Math.min(newStart, curEnd - minClip);
            previewVideo.currentTime = window.PlayerEngine.trimStart;
            updateJianyingTrimUI();
            updateJianyingPlayheadUI();
        } else if (jyDragMode === 'right') {
            const newEnd = Math.min(dur, Math.max(t, minClip));
            let curStart = window.PlayerEngine.trimStart || 0;
            if (newEnd <= curStart + minClip) {
                const prevSpan = Math.max(minClip, (jyRangeInitialEnd - jyRangeInitialStart) || getDesiredClipDuration());
                curStart = Math.max(0, newEnd - prevSpan);
                window.PlayerEngine.trimStart = curStart;
            }
            window.PlayerEngine.trimEnd = Math.max(newEnd, curStart + minClip);
            previewVideo.currentTime = window.PlayerEngine.trimEnd;
            updateJianyingTrimUI();
            updateJianyingPlayheadUI();
        } else if (jyDragMode === 'range') {
            if (Math.abs(e.clientX - jyRangeDragStartX) > 3) {
                jyRangeHasMoved = true;
            }
            if (jyRangeHasMoved) {
                const span = Math.max(minClip, jyRangeInitialEnd - jyRangeInitialStart);
                const delta = t - jyRangeDragStartTime;
                let newStart = jyRangeInitialStart + delta;
                if (newStart < 0) newStart = 0;
                if (newStart + span > dur) newStart = Math.max(0, dur - span);
                window.PlayerEngine.trimStart = newStart;
                window.PlayerEngine.trimEnd = Math.min(dur, newStart + span);
                window.PlayerEngine.userHasTrimmed = true;
                window.PlayerEngine._allowPlayOutsideTrim = false;
                previewVideo.currentTime = newStart;
                updateJianyingTrimUI();
                updateJianyingPlayheadUI();
            }
        } else if (jyDragMode === 'playhead') {
            const clampedT = Math.max(0, Math.min(dur, t));
            const range = window.PlayerEngine.getTrimRange();
            window.PlayerEngine._allowPlayOutsideTrim = (clampedT < range.start || clampedT >= range.end - 0.1);
            previewVideo.currentTime = clampedT;
            updateJianyingPlayheadUI();
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (!jyDragMode) return;
        const finishedMode = jyDragMode;
        jyDragMode = null;
        if (jyHandleLeft) jyHandleLeft.classList.remove('dragging');
        if (jyHandleRight) jyHandleRight.classList.remove('dragging');
        if (jySelectionBox) jySelectionBox.classList.remove('dragging');

        if (finishedMode === 'right') {
            // 拖动右把手松开后，将播放指针回到裁剪起点，避免停留在终点导致下一帧自动跳回或误触设为起点变成0.3s
            window.PlayerEngine._allowPlayOutsideTrim = false;
            if (previewVideo && window.PlayerEngine.isVideoMode) {
                previewVideo.currentTime = window.PlayerEngine.trimStart || 0;
                updateJianyingPlayheadUI();
            }
        } else if (finishedMode === 'range' && !jyRangeHasMoved) {
            // 若在选框内部仅点击未拖拽，则将播放指针定位到点击处
            const clickT = getTrackTimeFromClientX(e.clientX);
            if (previewVideo && window.PlayerEngine.isVideoMode) {
                window.PlayerEngine._allowPlayOutsideTrim = false;
                previewVideo.currentTime = clickT;
                updateJianyingPlayheadUI();
            }
        }
    });

    if (jyBtnPlay) {
        jyBtnPlay.addEventListener('click', () => togglePlayback());
    }
    if (jyBtnSetIn) {
        jyBtnSetIn.addEventListener('click', () => {
            if (!window.PlayerEngine.isVideoMode) return;
            const dur = window.PlayerEngine.videoDuration || previewVideo.duration || 1;
            const cur = Math.max(0, Math.min(dur - 0.5, previewVideo.currentTime || 0));
            const prevEnd = window.PlayerEngine.trimEnd || dur;
            const prevSpan = prevEnd - (window.PlayerEngine.trimStart || 0);
            const desiredSpan = (window.PlayerEngine.userHasTrimmed && prevSpan >= 1.0 && prevSpan < dur - 0.5)
                ? prevSpan
                : getDesiredClipDuration();

            window.PlayerEngine.trimStart = cur;
            // 若新起点大于等于原终点（或距离过近），自动将终点向后顺延选定秒数（如 10s），绝不压缩成 0.3s
            if (cur >= prevEnd - 0.8) {
                window.PlayerEngine.trimEnd = Math.min(dur, cur + desiredSpan);
                if (window.PlayerEngine.trimEnd - window.PlayerEngine.trimStart < 1.0) {
                    window.PlayerEngine.trimStart = Math.max(0, window.PlayerEngine.trimEnd - Math.min(desiredSpan, dur));
                }
            }
            window.PlayerEngine.userHasTrimmed = true;
            window.PlayerEngine._allowPlayOutsideTrim = false;
            updateJianyingTrimUI();
            const clipDur = (window.PlayerEngine.trimEnd - window.PlayerEngine.trimStart).toFixed(1);
            toast(`✂️ 已设起点 ${window.PlayerEngine.secToMinSec(window.PlayerEngine.trimStart, true)}（当前区间 ${clipDur}s）`);
        });
    }
    if (jyBtnSetOut) {
        jyBtnSetOut.addEventListener('click', () => {
            if (!window.PlayerEngine.isVideoMode) return;
            const dur = window.PlayerEngine.videoDuration || previewVideo.duration || 1;
            const cur = Math.max(0, Math.min(dur, previewVideo.currentTime || 0));
            const prevStart = window.PlayerEngine.trimStart || 0;
            const prevSpan = (window.PlayerEngine.trimEnd || dur) - prevStart;
            const desiredSpan = (window.PlayerEngine.userHasTrimmed && prevSpan >= 1.0 && prevSpan < dur - 0.5)
                ? prevSpan
                : getDesiredClipDuration();

            if (cur <= prevStart + 0.8) {
                // 若游标在起点之前或重合，自动按期望时长（如10s）向前推导起点或向后顺延终点，绝不缩成 0.3s
                if (cur >= 1.5) {
                    window.PlayerEngine.trimEnd = cur;
                    window.PlayerEngine.trimStart = Math.max(0, cur - desiredSpan);
                } else {
                    window.PlayerEngine.trimStart = cur;
                    window.PlayerEngine.trimEnd = Math.min(dur, cur + desiredSpan);
                }
            } else {
                window.PlayerEngine.trimEnd = cur;
            }
            window.PlayerEngine.userHasTrimmed = true;
            window.PlayerEngine._allowPlayOutsideTrim = false;
            previewVideo.currentTime = window.PlayerEngine.trimStart;
            updateJianyingTrimUI();
            updateJianyingPlayheadUI();
            const clipDur = (window.PlayerEngine.trimEnd - window.PlayerEngine.trimStart).toFixed(1);
            toast(`✂️ 已设终点 ${window.PlayerEngine.secToMinSec(window.PlayerEngine.trimEnd, true)}（共截取 ${clipDur}s）`);
        });
    }
    if (jyBtnReset) {
        jyBtnReset.addEventListener('click', () => {
            if (!window.PlayerEngine.isVideoMode) return;
            window.PlayerEngine.trimStart = 0;
            window.PlayerEngine.trimEnd = window.PlayerEngine.videoDuration || previewVideo.duration || 1;
            window.PlayerEngine.userHasTrimmed = false;
            window.PlayerEngine._allowPlayOutsideTrim = false;
            updateJianyingTrimUI();
            toast('✂️ 已恢复完整视频导出区间');
        });
    }
    if (jyBtnMute) {
        jyBtnMute.addEventListener('click', () => {
            setVideoSoundMuted(!previewVideo.muted, true);
        });
    }

    /* ==========================================================================
       2.8 取景边框横竖自由切换 (竖着框 9:16 / 横着框 16:9) & 全屏观看联动
       ========================================================================== */
    function checkMediaAspect() {
        const orient = window.PlayerEngine.cropOrient || 'land';
        const isPortMode = renderTarget.classList.contains('mode-mobile-port');
        const dims = window.PlayerEngine.getMediaNaturalDimensions();
        const isLandscapeMedia = dims.width >= dims.height;

        if (btnCropOrientPort) btnCropOrientPort.classList.toggle('active', orient === 'port');
        if (btnCropOrientLand) btnCropOrientLand.classList.toggle('active', orient === 'land');
        if (selCropOrient && selCropOrient.value !== orient) selCropOrient.value = orient;
        if (swDyLandBox) swDyLandBox.checked = (orient === 'land');

        if (isPortMode) {
            renderTarget.classList.remove('land-port-box');
            if (orient === 'land') {
                renderTarget.classList.add('port-land-box');
                if (dyFullscreenPill) dyFullscreenPill.style.display = 'inline-flex';
            } else {
                renderTarget.classList.remove('port-land-box');
                if (dyFullscreenPill) dyFullscreenPill.style.display = isLandscapeMedia ? 'inline-flex' : 'none';
            }
        } else {
            renderTarget.classList.remove('port-land-box');
            if (dyFullscreenPill) dyFullscreenPill.style.display = 'none';
            if (orient === 'port') {
                renderTarget.classList.add('land-port-box');
            } else {
                renderTarget.classList.remove('land-port-box');
            }
        }
    }
    window.PlayerEngine.checkMediaAspect = checkMediaAspect;

    function ensureGreenBoxMovable() {
        const dims = window.PlayerEngine.getMediaNaturalDimensions();
        const isLandMedia = dims.width >= dims.height;
        const orient = window.PlayerEngine.cropOrient || 'land';
        const sameOrient = (isLandMedia && orient === 'land') || (!isLandMedia && orient === 'port');
        const curScale = parseFloat(inMediaScale.value) || 100;
        if (sameOrient && curScale <= 105) {
            inMediaScale.value = 120;
        }
    }

    function setCropOrientation(orient, showMsg = false) {
        window.PlayerEngine.cropOrient = (orient === 'port') ? 'port' : 'land';
        checkMediaAspect();
        ensureGreenBoxMovable();
        updateTransform();
        setTimeout(updateTransform, 50);
        if (showMsg) {
            toast(orient === 'port'
                ? '📱 已切换为：竖着取景框 (9:16)，可直接拖动绿框调整构图！'
                : '🖼️ 已切换为：横着取景框 (16:9)，可直接拖动绿框调整构图！');
        }
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
    }
    window.PlayerEngine.setCropOrientation = setCropOrientation;

    if (btnCropOrientPort) {
        btnCropOrientPort.addEventListener('click', () => setCropOrientation('port', true));
    }
    if (btnCropOrientLand) {
        btnCropOrientLand.addEventListener('click', () => setCropOrientation('land', true));
    }
    if (selCropOrient) {
        selCropOrient.addEventListener('change', (e) => setCropOrientation(e.target.value, true));
    }

    previewVideo.addEventListener('loadedmetadata', () => {
        const isPortMode = renderTarget.classList.contains('mode-mobile-port');
        const isLandscapeVid = (previewVideo.videoWidth || 0) >= (previewVideo.videoHeight || 1);
        if (isPortMode) {
            if (isLandscapeVid) {
                window.PlayerEngine.cropOrient = 'land';
                if (swDyLandBox) swDyLandBox.checked = true;
            } else {
                window.PlayerEngine.cropOrient = (swDyLandBox && swDyLandBox.checked) ? 'land' : 'port';
            }
        }
        checkMediaAspect();
        ensureGreenBoxMovable();
        updateTransform();
        const realDur = (previewVideo.duration && isFinite(previewVideo.duration) && previewVideo.duration > 0)
            ? previewVideo.duration
            : (window.PlayerEngine.videoDuration || 15);
        if (typeof window.randomizeViralMetricsByDuration === 'function') {
            window.randomizeViralMetricsByDuration(realDur, true);
        }
        syncPreviewVideoProgress();
    });

    if (swDyLandBox) {
        swDyLandBox.addEventListener('change', () => {
            setCropOrientation(swDyLandBox.checked ? 'land' : 'port', true);
        });
    }

    // 点击竖屏中央的「全屏观看」胶囊 -> 画面直接变成横屏全屏预览 (mode-dy-land)
    if (dyFullscreenPill) {
        dyFullscreenPill.addEventListener('click', () => {
            activateViewportMode('mode-dy-land');
            toast('🔄 已进入全屏观看模式 (16:9横屏)，右侧面板可自由输入片名并开关所有控件！');
        });
    }
    if (btnEnterDyFullscreen) {
        btnEnterDyFullscreen.addEventListener('click', () => {
            activateViewportMode('mode-dy-land');
            toast('🔄 已切换为全屏观看横屏模式');
        });
    }
    // 点击左上角返回箭头 < 或右侧返回按钮 -> 回到手机竖屏社区
    if (dylBtnBack) {
        dylBtnBack.addEventListener('click', () => {
            activateViewportMode('mode-mobile-port');
            toast('📱 已退出全屏，返回手机竖屏社区');
        });
    }
    if (btnExitDyFullscreen) {
        btnExitDyFullscreen.addEventListener('click', () => {
            activateViewportMode('mode-mobile-port');
            toast('📱 已返回手机竖屏社区');
        });
    }

    /* ==========================================================================
       3. 播放与暂停状态双向联动
       ========================================================================== */
    function updatePlayStateUI(isPlaying) {
        if (jyBtnPlay) jyBtnPlay.textContent = isPlaying ? '❚❚' : '▶';
        if (dylSvgPause) dylSvgPause.style.display = isPlaying ? 'block' : 'none';
        if (dylSvgPlay) dylSvgPlay.style.display = isPlaying ? 'none' : 'block';
        if (isPlaying) {
            if (iconBotPlay) iconBotPlay.style.display = 'none';
            if (iconBotPause) iconBotPause.style.display = 'block';
            if (iconCenterPlay) iconCenterPlay.style.display = 'none';
            if (iconCenterPause) iconCenterPause.style.display = 'flex';
            if (dispCenterPill) dispCenterPill.textContent = '點擊暫停播放';
            if (mIconPlay) mIconPlay.style.display = 'none';
            if (mIconPause) mIconPause.style.display = 'flex';
            if (mCenterIconPlay) mCenterIconPlay.style.display = 'none';
            if (mCenterIconPause) mCenterIconPause.style.display = 'flex';
            if (swMAutoSub && swMAutoSub.checked && mDispSubTitle) {
                mDispSubTitle.textContent = '正在播放 · 橫屏播放';
                if (inMSubTitle) inMSubTitle.value = '正在播放 · 橫屏播放';
            }
        } else {
            if (iconBotPlay) iconBotPlay.style.display = 'block';
            if (iconBotPause) iconBotPause.style.display = 'none';
            if (iconCenterPlay) iconCenterPlay.style.display = 'block';
            if (iconCenterPause) iconCenterPause.style.display = 'none';
            if (dispCenterPill) dispCenterPill.textContent = '點擊繼續播放';
            if (mIconPlay) mIconPlay.style.display = 'block';
            if (mIconPause) mIconPause.style.display = 'none';
            if (mCenterIconPlay) mCenterIconPlay.style.display = 'block';
            if (mCenterIconPause) mCenterIconPause.style.display = 'none';
            if (swMAutoSub && swMAutoSub.checked && mDispSubTitle) {
                mDispSubTitle.textContent = '正在暫停 · 橫屏播放';
                if (inMSubTitle) inMSubTitle.value = '正在暫停 · 橫屏播放';
            }
        }
    }
    window.PlayerEngine.updatePlayStateUI = updatePlayStateUI;

    function togglePlayback() {
        if (!window.PlayerEngine.isVideoMode) {
            const currentlyPaused = mIconPlay ? (mIconPlay.style.display !== 'none') : true;
            updatePlayStateUI(currentlyPaused);
            toast(currentlyPaused ? '已切換圖標為：播放狀態 (❚❚)' : '已切換圖標為：暫停狀態 (▶)');
            return;
        }
        if (previewVideo.paused) {
            const range = window.PlayerEngine.getTrimRange();
            if (previewVideo.currentTime < range.start || previewVideo.currentTime >= range.end - 0.05) {
                previewVideo.currentTime = range.start;
            }
            previewVideo.play().then(() => updatePlayStateUI(true)).catch(console.warn);
        } else {
            previewVideo.pause();
            updatePlayStateUI(false);
        }
    }
    window.PlayerEngine.togglePlayback = togglePlayback;

    if (btnTogglePlayback) btnTogglePlayback.addEventListener('click', togglePlayback);
    if (btnBotPlayState) btnBotPlayState.addEventListener('click', togglePlayback);
    if (mBtnTogglePlay) mBtnTogglePlay.addEventListener('click', togglePlayback);
    if (mBtnCenterPlay) mBtnCenterPlay.addEventListener('click', togglePlayback);
    if (dylBtnCenterPlay) dylBtnCenterPlay.addEventListener('click', togglePlayback);

    /* ==========================================================================
       4. 三端时间码、随机总时长与双向同步系统
       ========================================================================== */
    const swMSyncVideoTime = document.getElementById('sw-m-sync-video-time');
    const inMStartTime = document.getElementById('in-m-start-time');
    const inMTotalTime = document.getElementById('in-m-total-time');
    const inMProgress = document.getElementById('in-m-progress');
    const txtMProgress = document.getElementById('txt-m-progress');
    const inMBuffer = document.getElementById('in-m-buffer');
    const txtMBuffer = document.getElementById('txt-m-buffer');
    const btnRandomTime = document.getElementById('btn-random-time');

    function syncAllProgressBars(pct) {
        const clamped = Math.min(100, Math.max(0, Number(pct) || 0));
        const widthStr = clamped.toFixed(2) + '%';
        const intVal = Math.round(clamped);
        if (dispProgressBar) dispProgressBar.style.width = widthStr;
        if (mDispProgress) mDispProgress.style.width = widthStr;
        if (dyTinyFill) dyTinyFill.style.width = widthStr;
        if (dylProgressFill) dylProgressFill.style.width = widthStr;
        if (inProgress) inProgress.value = intVal;
        if (inMProgress) inMProgress.value = intVal;
        if (txtProgress) txtProgress.textContent = intVal + '%';
        if (txtMProgress) txtMProgress.textContent = intVal + '%';
    }

    function syncAllBufferBars(pct) {
        const clamped = Math.min(100, Math.max(0, Number(pct) || 0));
        const widthStr = clamped + '%';
        if (dispBufferBar) dispBufferBar.style.width = widthStr;
        if (mDispBuffer) mDispBuffer.style.width = widthStr;
        if (dyTinyBuffer) dyTinyBuffer.style.width = widthStr;
        if (inBuffer) inBuffer.value = clamped;
        if (inMBuffer) inMBuffer.value = clamped;
        if (txtBuffer) txtBuffer.textContent = widthStr;
        if (txtMBuffer) txtMBuffer.textContent = widthStr;
    }

    function refreshTimeUI() {
        const s = window.PlayerEngine.timeToSec(inStartTime.value);
        const t = window.PlayerEngine.timeToSec(inTotalTime.value) || 1;
        if (dispTime) {
            dispTime.textContent = `${window.PlayerEngine.secToTime(s)} / ${window.PlayerEngine.secToTime(t)}`;
        }
        if (mDispTime) {
            mDispTime.textContent = `${window.PlayerEngine.secToShortTime(s)} / ${window.PlayerEngine.secToShortTime(t)}`;
        }
        if (dylDispCur) {
            dylDispCur.textContent = window.PlayerEngine.secToMinSec(s % 3600, false);
        }
        if (dylDispDur) {
            dylDispDur.textContent = window.PlayerEngine.secToMinSec(Math.min(3599, t), false);
        }
    }
    window.PlayerEngine.refreshTimeUI = refreshTimeUI;

    function applyStartAndTotalTime(startStr, totalStr, save = true) {
        if (startStr !== null && startStr !== undefined) {
            if (inStartTime) inStartTime.value = startStr;
            if (inMStartTime) inMStartTime.value = startStr;
        }
        if (totalStr !== null && totalStr !== undefined) {
            if (inTotalTime) inTotalTime.value = totalStr;
            if (inMTotalTime) inMTotalTime.value = totalStr;
        }
        refreshTimeUI();
        const startSec = window.PlayerEngine.timeToSec(inStartTime.value);
        const totalSec = window.PlayerEngine.timeToSec(inTotalTime.value);
        if (totalSec > 0) {
            const pct = Math.min(100, Math.max(0, (startSec / totalSec) * 100));
            syncAllProgressBars(pct);
        }
        if (save && typeof window.triggerSaveStorage === 'function') {
            window.triggerSaveStorage();
        }
    }

    function randomizeStartTimeOnly(showMsg = false) {
        const totalSec = window.PlayerEngine.timeToSec(inTotalTime ? inTotalTime.value : '01:54:21') || 6861;
        const maxStart = Math.max(15, Math.floor(totalSec * 0.78));
        const randomStartSec = Math.floor(15 + Math.random() * (maxStart - 15));
        const formattedStart = window.PlayerEngine.secToTime(randomStartSec);
        const curTotalStr = inTotalTime ? inTotalTime.value : '01:54:21';
        applyStartAndTotalTime(formattedStart, curTotalStr, true);
        if (showMsg) {
            toast(`已随机切换起始时间：${window.PlayerEngine.secToShortTime(randomStartSec)}`);
        }
    }
    window.PlayerEngine.randomizeStartTimeOnly = randomizeStartTimeOnly;

    function randomizeDuration(showMsg = false) {
        const minSec = 1 * 3600 + 20 * 60;
        const maxSec = 2 * 3600 + 30 * 60;
        const randomTotalSec = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
        const formattedTotal = window.PlayerEngine.secToTime(randomTotalSec);
        const curStartStr = inStartTime ? inStartTime.value : '00:04:07';
        applyStartAndTotalTime(curStartStr, formattedTotal, showMsg);
        if (showMsg) {
            toast(`已随机切换结尾总时长：${window.PlayerEngine.secToShortTime(randomTotalSec)}`);
        }
    }
    window.PlayerEngine.randomizeDuration = randomizeDuration;

    function randomizeBothStartAndTotalTime(showMsg = false) {
        const minSec = 1 * 3600 + 20 * 60;
        const maxSec = 2 * 3600 + 30 * 60;
        const randomTotalSec = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
        const formattedTotal = window.PlayerEngine.secToTime(randomTotalSec);
        const maxStart = Math.max(15, Math.floor(randomTotalSec * 0.65));
        const randomStartSec = Math.floor(15 + Math.random() * (maxStart - 15));
        const formattedStart = window.PlayerEngine.secToTime(randomStartSec);
        applyStartAndTotalTime(formattedStart, formattedTotal, true);
        if (showMsg) {
            toast(`已随机切换时间：${window.PlayerEngine.secToShortTime(randomStartSec)} / ${window.PlayerEngine.secToShortTime(randomTotalSec)}`);
        }
    }
    window.PlayerEngine.randomizeBothStartAndTotalTime = randomizeBothStartAndTotalTime;

    [
        'btn-random-start-time',
        'btn-random-start-time-link',
        'btn-random-m-start-time',
        'btn-random-m-start-time-link'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                randomizeStartTimeOnly(true);
            });
        }
    });

    [
        'btn-random-total-time',
        'btn-random-total-time-link',
        'btn-random-m-total-time',
        'btn-random-m-total-time-link'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                randomizeDuration(true);
            });
        }
    });

    [
        'btn-random-time',
        'btn-web-random-time-all',
        'btn-dyl-random-prog-time'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                randomizeBothStartAndTotalTime(true);
            });
        }
    });

    if (swSyncVideoTime && swMSyncVideoTime) {
        swSyncVideoTime.addEventListener('change', (e) => {
            swMSyncVideoTime.checked = e.target.checked;
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        });
        swMSyncVideoTime.addEventListener('change', (e) => {
            swSyncVideoTime.checked = e.target.checked;
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        });
    }

    if (inStartTime) {
        inStartTime.addEventListener('input', (e) => applyStartAndTotalTime(e.target.value, null, true));
    }
    if (inMStartTime) {
        inMStartTime.addEventListener('input', (e) => applyStartAndTotalTime(e.target.value, null, true));
    }
    if (inTotalTime) {
        inTotalTime.addEventListener('input', (e) => applyStartAndTotalTime(null, e.target.value, true));
    }
    if (inMTotalTime) {
        inMTotalTime.addEventListener('input', (e) => applyStartAndTotalTime(null, e.target.value, true));
    }

    function handleProgressSliderInput(val, seekVideo = true) {
        const numVal = Math.min(100, Math.max(0, parseFloat(val) || 0));
        syncAllProgressBars(numVal);
        if (seekVideo && window.PlayerEngine.isVideoMode && previewVideo) {
            const vidDur = (previewVideo.duration && isFinite(previewVideo.duration) && previewVideo.duration > 0)
                ? previewVideo.duration
                : (window.PlayerEngine.videoDuration || 0);
            if (vidDur > 0) {
                try {
                    previewVideo.currentTime = (numVal / 100) * vidDur;
                } catch (e) {}
                updateJianyingPlayheadUI();
            }
        }
        const total = window.PlayerEngine.timeToSec(inTotalTime.value) || 7581;
        const newSec = Math.round((numVal / 100) * total);
        const newStartStr = window.PlayerEngine.secToTime(newSec);
        if (inStartTime) inStartTime.value = newStartStr;
        if (inMStartTime) inMStartTime.value = newStartStr;
        refreshTimeUI();
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
    }

    if (inProgress) {
        inProgress.addEventListener('input', (e) => handleProgressSliderInput(e.target.value));
    }
    if (inMProgress) {
        inMProgress.addEventListener('input', (e) => handleProgressSliderInput(e.target.value));
    }

    if (inBuffer) {
        inBuffer.addEventListener('input', (e) => {
            syncAllBufferBars(e.target.value);
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        });
    }
    if (inMBuffer) {
        inMBuffer.addEventListener('input', (e) => {
            syncAllBufferBars(e.target.value);
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        });
    }

    if (progressClickBar) {
        progressClickBar.addEventListener('click', (e) => {
            const rect = progressClickBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.min(100, Math.max(0, Math.round((clickX / rect.width) * 100)));
            handleProgressSliderInput(pct);
        });
    }

    if (mProgressContainer) {
        mProgressContainer.addEventListener('click', (e) => {
            const rect = mProgressContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.min(100, Math.max(0, Math.round((clickX / rect.width) * 100)));
            handleProgressSliderInput(pct);
        });
    }

    if (dylProgressWrap) {
        dylProgressWrap.addEventListener('click', (e) => {
            const rect = dylProgressWrap.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.min(100, Math.max(0, Math.round((clickX / rect.width) * 100)));
            handleProgressSliderInput(pct);
        });
    }

    const dyTinyProgressbarEl = document.getElementById('dy-tiny-progressbar') || document.querySelector('.dy-tiny-progressbar');
    if (dyTinyProgressbarEl) {
        let isScrubbingDyBar = false;
        const scrubDyBarAt = (clientX) => {
            const rect = dyTinyProgressbarEl.getBoundingClientRect();
            if (!rect.width) return;
            const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
            handleProgressSliderInput(pct, true);
        };
        dyTinyProgressbarEl.addEventListener('mousedown', (e) => {
            isScrubbingDyBar = true;
            scrubDyBarAt(e.clientX);
            e.stopPropagation();
        });
        window.addEventListener('mousemove', (e) => {
            if (!isScrubbingDyBar) return;
            scrubDyBarAt(e.clientX);
        });
        window.addEventListener('mouseup', () => {
            isScrubbingDyBar = false;
        });
        dyTinyProgressbarEl.addEventListener('click', (e) => {
            scrubDyBarAt(e.clientX);
            e.stopPropagation();
        });
    }

    function syncPreviewVideoProgress() {
        if (!window.PlayerEngine.isVideoMode || !previewVideo) return;
        if (window.__isExportRecording) return;

        updateJianyingPlayheadUI();

        if (window.SubtitleEngine && typeof window.SubtitleEngine.onTimeUpdate === 'function') {
            window.SubtitleEngine.onTimeUpdate(previewVideo.currentTime);
        }

        if (!jyDragMode && !previewVideo.paused && !window.PlayerEngine._allowPlayOutsideTrim) {
            const range = window.PlayerEngine.getTrimRange();
            if (previewVideo.currentTime >= range.end) {
                previewVideo.currentTime = range.start;
            }
        }

        const vidDur = (previewVideo.duration && isFinite(previewVideo.duration) && previewVideo.duration > 0)
            ? previewVideo.duration
            : (window.PlayerEngine.videoDuration || 1);
        const curVidSec = Math.max(0, previewVideo.currentTime || 0);

        // 预览播放视频时，底部进度条随上传视频的真实画面时长 (0% -> 100%) 实时丝滑移动
        const vidPct = Math.min(100, Math.max(0, (curVidSec / vidDur) * 100));
        syncAllProgressBars(vidPct);

        if (dylDispCur) dylDispCur.textContent = window.PlayerEngine.secToMinSec(curVidSec, false);
        if (dylDispDur) dylDispDur.textContent = window.PlayerEngine.secToMinSec(vidDur, false);

        if (!swSyncVideoTime || swSyncVideoTime.checked) {
            const baseStart = window.PlayerEngine.timeToSec(inStartTime.value);
            const totalSec = window.PlayerEngine.timeToSec(inTotalTime.value) || 7581;
            const elapsed = Math.floor(curVidSec);
            const curSec = baseStart + elapsed;
            if (dispTime) dispTime.textContent = `${window.PlayerEngine.secToTime(curSec)} / ${window.PlayerEngine.secToTime(totalSec)}`;
            if (mDispTime) mDispTime.textContent = `${window.PlayerEngine.secToShortTime(curSec)} / ${window.PlayerEngine.secToShortTime(totalSec)}`;
        }
    }

    let previewProgRafId = null;
    function tickPreviewProgressRaf() {
        if (!window.PlayerEngine.isVideoMode || !previewVideo || previewVideo.paused || window.__isExportRecording) {
            previewProgRafId = null;
            return;
        }
        syncPreviewVideoProgress();
        previewProgRafId = requestAnimationFrame(tickPreviewProgressRaf);
    }

    previewVideo.addEventListener('play', () => {
        if (previewProgRafId) cancelAnimationFrame(previewProgRafId);
        previewProgRafId = requestAnimationFrame(tickPreviewProgressRaf);
    });
    previewVideo.addEventListener('pause', () => {
        if (previewProgRafId) {
            cancelAnimationFrame(previewProgRafId);
            previewProgRafId = null;
        }
        syncPreviewVideoProgress();
    });
    previewVideo.addEventListener('seeked', syncPreviewVideoProgress);
    previewVideo.addEventListener('timeupdate', syncPreviewVideoProgress);

    randomizeDuration(false);
    checkMediaAspect();

    /* ==========================================================================
       5. 独立取景框浮窗：滚轮缩放小窗、红绿选框拖拽与双向联动
       ========================================================================== */
    window.getPlayerCropRect = function (targetW, targetH) {
        const isVideo = previewVideo && previewVideo.style.display !== 'none' && previewVideo.videoWidth > 0;
        const mediaW = isVideo ? previewVideo.videoWidth : (previewImg.naturalWidth || 1280);
        const mediaH = isVideo ? previewVideo.videoHeight : (previewImg.naturalHeight || 720);
        const mAspect = mediaW / mediaH;
        const cAspect = (targetW || 800) / (targetH || 450);
        const fitMode = selCropFit ? selCropFit.value : 'cover';
        const rawScale = parseFloat(inMediaScale.value);
        const scaleVal = Number.isNaN(rawScale) ? 100 : rawScale;
        const zoom = fitMode === 'cover' ? Math.max(1.02, scaleVal / 100) : (scaleVal / 100);
        const rawX = parseFloat(inPosX.value);
        const rawY = parseFloat(inPosY.value);
        const xPct = Math.min(100, Math.max(0, Number.isNaN(rawX) ? 50 : rawX));
        const yPct = Math.min(100, Math.max(0, Number.isNaN(rawY) ? 50 : rawY));
        const posX = xPct / 100;
        const posY = yPct / 100;
        let baseW, baseH;
        if (fitMode === 'contain') {
            if (mAspect > cAspect) {
                baseW = targetW;
                baseH = baseW / mAspect;
            } else {
                baseH = targetH;
                baseW = baseH * mAspect;
            }
        } else {
            if (mAspect > cAspect) {
                baseH = targetH;
                baseW = baseH * mAspect;
            } else {
                baseW = targetW;
                baseH = baseW / mAspect;
            }
        }
        // ★ 边缘防白边出血量 (bleed=6px)：彻底消除亚像素取整缝隙及原视频自带边缘白线
        const bleed = fitMode === 'cover' ? 6 : 0;
        const coreW = baseW * zoom;
        const coreH = baseH * zoom;
        const renderW = Math.ceil(coreW + bleed * 2);
        const renderH = Math.ceil(coreH + bleed * 2);
        const offX = Math.floor(-bleed + (targetW - coreW) * posX);
        const offY = Math.floor(-bleed + (targetH - coreH) * posY);
        return {
            mediaW, mediaH, mAspect, cAspect,
            zoom, scaleVal, posX, posY, xPct, yPct,
            renderW, renderH, offX, offY
        };
    };

    function getActiveMediaViewportSize() {
        if (playerMediaWrap && playerMediaWrap.clientWidth > 0 && playerMediaWrap.clientHeight > 0) {
            return {
                w: playerMediaWrap.clientWidth,
                h: playerMediaWrap.clientHeight
            };
        }
        return {
            w: renderTarget.clientWidth || 800,
            h: renderTarget.clientHeight || 450
        };
    }

    function updateTransform() {
        const vp = getActiveMediaViewportSize();
        const targetW = vp.w;
        const targetH = vp.h;
        const rect = window.getPlayerCropRect(targetW, targetH);
        [previewImg, previewVideo].forEach(el => {
            if (!el) return;
            el.style.width = rect.renderW + 'px';
            el.style.height = rect.renderH + 'px';
            el.style.left = rect.offX + 'px';
            el.style.top = rect.offY + 'px';
        });
        if (txtPosX) txtPosX.textContent = Math.round(rect.xPct) + '%';
        if (txtPosY) txtPosY.textContent = Math.round(rect.yPct) + '%';
        if (txtMediaScale) txtMediaScale.textContent = Math.round(rect.scaleVal) + '%';
        if (txtCropWinSize) txtCropWinSize.textContent = '缩放: ' + Math.round(rect.scaleVal) + '%';
        syncCropBoxPosition();
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
    }
    window.PlayerEngine.updateTransform = updateTransform;

    function syncCropBoxPosition() {
        if (!cropInspectorWindow || cropInspectorWindow.style.display === 'none') return;
        const vp = getActiveMediaViewportSize();
        const targetW = vp.w;
        const targetH = vp.h;
        const rect = window.getPlayerCropRect(targetW, targetH);

        // 让独立取景框画布严格贴合上传视频/图片的真实宽高比 (横屏或竖屏)
        const mAspect = rect.mAspect || (16 / 9);
        const maxW = 240;
        const maxH = 260;
        let bodyW, bodyH;
        if (mAspect >= maxW / maxH) {
            bodyW = maxW;
            bodyH = Math.max(80, Math.round(maxW / mAspect));
        } else {
            bodyH = maxH;
            bodyW = Math.max(80, Math.round(maxH * mAspect));
        }
        cropWindowBody.style.width = bodyW + 'px';
        cropWindowBody.style.height = bodyH + 'px';

        const visWFrac = Math.min(1, targetW / rect.renderW);
        const visHFrac = Math.min(1, targetH / rect.renderH);
        const boxW = Math.max(24, Math.round(bodyW * visWFrac));
        const boxH = Math.max(24, Math.round(bodyH * visHFrac));
        cropSelectionBox.style.width = boxW + 'px';
        cropSelectionBox.style.height = boxH + 'px';
        const maxLeft = Math.max(0, bodyW - boxW);
        const maxTop = Math.max(0, bodyH - boxH);
        cropSelectionBox.style.left = (maxLeft * rect.posX) + 'px';
        cropSelectionBox.style.top = (maxTop * rect.posY) + 'px';
    }

    if (previewImg) previewImg.addEventListener('load', updateTransform);
    if (previewVideo) previewVideo.addEventListener('loadedmetadata', updateTransform);
    if (cropThumbImg) cropThumbImg.addEventListener('load', updateTransform);
    window.addEventListener('resize', updateTransform);
    [inPosY, inPosX, inMediaScale].forEach(el => {
        if (el) el.addEventListener('input', updateTransform);
    });
    if (selCropFit) selCropFit.addEventListener('change', updateTransform);

    if (swCropWindow && cropInspectorWindow) {
        swCropWindow.addEventListener('change', (e) => {
            cropInspectorWindow.style.display = e.target.checked ? 'flex' : 'none';
            if (e.target.checked) {
                if (!window.PlayerEngine.isVideoMode && previewImg.src) {
                    cropThumbImg.src = previewImg.src;
                }
                setTimeout(updateTransform, 30);
            }
        });
    }
    if (btnCloseCropWindow) {
        btnCloseCropWindow.addEventListener('click', () => {
            cropInspectorWindow.style.display = 'none';
            if (swCropWindow) swCropWindow.checked = false;
        });
    }
    if (cropInspectorWindow) {
        cropInspectorWindow.addEventListener('wheel', (e) => {
            e.preventDefault();
            const curScale = parseFloat(inMediaScale.value) || 100;
            const delta = e.deltaY < 0 ? 5 : -5;
            const nextScale = Math.min(250, Math.max(100, curScale + delta));
            inMediaScale.value = nextScale;
            updateTransform();
        }, { passive: false });
    }

    // ★ 1. 独立取景框浮窗任意位置自由拖拽 (通过顶部标题栏 #crop-window-header)
    let isDraggingCropWin = false;
    let winDragStartX = 0, winDragStartY = 0;
    let winStartLeft = 0, winStartTop = 0;

    if (cropWindowHeader && cropInspectorWindow) {
        cropWindowHeader.addEventListener('mousedown', (e) => {
            if (e.target && e.target.closest('#btn-close-crop-window')) return;
            isDraggingCropWin = true;
            winDragStartX = e.clientX;
            winDragStartY = e.clientY;
            winStartLeft = cropInspectorWindow.offsetLeft;
            winStartTop = cropInspectorWindow.offsetTop;
            cropInspectorWindow.style.right = 'auto';
            cropInspectorWindow.style.bottom = 'auto';
            cropInspectorWindow.style.left = winStartLeft + 'px';
            cropInspectorWindow.style.top = winStartTop + 'px';
            e.preventDefault();
            e.stopPropagation();
        });
    }

    // ★ 2. 绿色取景框四角缩放手柄拖拽 & 变小/变大按钮
    let isResizingCropBox = false;
    let resizeCornerDir = '';
    let resizeStartX = 0, resizeStartY = 0;
    let resizeStartScale = 100;

    if (cropSelectionBox) {
        const corners = cropSelectionBox.querySelectorAll('.crop-corner');
        corners.forEach(corner => {
            corner.addEventListener('mousedown', (e) => {
                isResizingCropBox = true;
                resizeCornerDir = corner.dataset.dir || corner.dataset.corner || 'se';
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                resizeStartScale = parseFloat(inMediaScale.value) || 100;
                e.preventDefault();
                e.stopPropagation();
            });
        });
    }

    if (btnCropBoxShrink) {
        btnCropBoxShrink.addEventListener('click', () => {
            const cur = parseFloat(inMediaScale.value) || 100;
            inMediaScale.value = Math.min(250, cur + 15);
            updateTransform();
        });
    }
    if (btnCropBoxGrow) {
        btnCropBoxGrow.addEventListener('click', () => {
            const cur = parseFloat(inMediaScale.value) || 100;
            inMediaScale.value = Math.max(100, cur - 15);
            updateTransform();
        });
    }

    // ★ 3. 绿色取景框上下左右自由拖拽 (若处于100%满框状态则自动解锁缩放以便全方位挪动)
    let isDraggingCrop = false;
    let cropStartX = 0, cropStartY = 0;
    let cropBoxStartLeft = 0, cropBoxStartTop = 0;

    function startGreenBoxDrag(clientX, clientY) {
        let bodyW = cropWindowBody.clientWidth;
        let bodyH = cropWindowBody.clientHeight;
        let boxW = cropSelectionBox.offsetWidth;
        let boxH = cropSelectionBox.offsetHeight;
        let maxLeft = Math.max(0, bodyW - boxW);
        let maxTop = Math.max(0, bodyH - boxH);

        // 若当前绿框撑满整个缩略图无法移动，自动将缩放提升至 125% 解锁全方位拖动
        if (maxLeft < 6 && maxTop < 6) {
            inMediaScale.value = 125;
            updateTransform();
        }

        isDraggingCrop = true;
        cropStartX = clientX;
        cropStartY = clientY;
        cropBoxStartLeft = cropSelectionBox.offsetLeft;
        cropBoxStartTop = cropSelectionBox.offsetTop;
    }

    if (cropSelectionBox && cropWindowBody) {
        cropSelectionBox.addEventListener('mousedown', (e) => {
            if (e.target && e.target.classList.contains('crop-corner')) return;
            startGreenBoxDrag(e.clientX, e.clientY);
            e.preventDefault();
            e.stopPropagation();
        });

        // 点击黑色缩略图背景区域也可直接将绿框中心移过来并开始拖动
        cropWindowBody.addEventListener('mousedown', (e) => {
            if (e.target === cropSelectionBox || cropSelectionBox.contains(e.target)) return;
            const rect = cropWindowBody.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            let bodyW = cropWindowBody.clientWidth;
            let bodyH = cropWindowBody.clientHeight;
            let boxW = cropSelectionBox.offsetWidth;
            let boxH = cropSelectionBox.offsetHeight;
            if (bodyW - boxW < 6 && bodyH - boxH < 6) {
                inMediaScale.value = 125;
                updateTransform();
                boxW = cropSelectionBox.offsetWidth;
                boxH = cropSelectionBox.offsetHeight;
            }
            const maxLeft = Math.max(0, bodyW - boxW);
            const maxTop = Math.max(0, bodyH - boxH);
            const targetLeft = Math.min(maxLeft, Math.max(0, clickX - boxW / 2));
            const targetTop = Math.min(maxTop, Math.max(0, clickY - boxH / 2));
            if (maxLeft > 0) inPosX.value = Math.round((targetLeft / maxLeft) * 100);
            if (maxTop > 0) inPosY.value = Math.round((targetTop / maxTop) * 100);
            updateTransform();
            startGreenBoxDrag(e.clientX, e.clientY);
            e.preventDefault();
        });
    }

    window.addEventListener('mousemove', (e) => {
        if (isDraggingCropWin && cropInspectorWindow) {
            const parent = cropInspectorWindow.offsetParent || document.body;
            const maxWinLeft = Math.max(0, parent.clientWidth - cropInspectorWindow.offsetWidth - 4);
            const maxWinTop = Math.max(0, parent.clientHeight - cropInspectorWindow.offsetHeight - 4);
            const nextLeft = Math.min(maxWinLeft, Math.max(4, winStartLeft + (e.clientX - winDragStartX)));
            const nextTop = Math.min(maxWinTop, Math.max(4, winStartTop + (e.clientY - winDragStartY)));
            cropInspectorWindow.style.left = nextLeft + 'px';
            cropInspectorWindow.style.top = nextTop + 'px';
            return;
        }

        if (isResizingCropBox) {
            const dx = e.clientX - resizeStartX;
            const dy = e.clientY - resizeStartY;
            const signX = (resizeCornerDir === 'nw' || resizeCornerDir === 'sw') ? 1 : -1;
            const signY = (resizeCornerDir === 'nw' || resizeCornerDir === 'ne') ? 1 : -1;
            const dragDelta = (dx * signX + dy * signY) * 0.65;
            const nextScale = Math.min(250, Math.max(100, Math.round(resizeStartScale + dragDelta)));
            inMediaScale.value = nextScale;
            updateTransform();
            return;
        }

        if (!isDraggingCrop) return;
        const deltaX = e.clientX - cropStartX;
        const deltaY = e.clientY - cropStartY;
        const bodyW = cropWindowBody.clientWidth;
        const bodyH = cropWindowBody.clientHeight;
        let boxW = cropSelectionBox.offsetWidth;
        let boxH = cropSelectionBox.offsetHeight;
        let maxLeft = Math.max(0, bodyW - boxW);
        let maxTop = Math.max(0, bodyH - boxH);

        // 如果用户在单轴贴边状态下往受限方向拖动，自动稍微缩小绿框以允许全方向自由移动
        if ((maxLeft < 4 && Math.abs(deltaX) > 10) || (maxTop < 4 && Math.abs(deltaY) > 10)) {
            const curS = parseFloat(inMediaScale.value) || 100;
            if (curS <= 105) {
                inMediaScale.value = 120;
                syncCropBoxPosition();
                boxW = cropSelectionBox.offsetWidth;
                boxH = cropSelectionBox.offsetHeight;
                maxLeft = Math.max(0, bodyW - boxW);
                maxTop = Math.max(0, bodyH - boxH);
                cropBoxStartLeft = cropSelectionBox.offsetLeft;
                cropBoxStartTop = cropSelectionBox.offsetTop;
            }
        }

        const newLeft = Math.min(maxLeft, Math.max(0, cropBoxStartLeft + deltaX));
        const newTop = Math.min(maxTop, Math.max(0, cropBoxStartTop + deltaY));
        const curXPct = maxLeft > 0 ? Math.round((newLeft / maxLeft) * 100) : 50;
        const curYPct = maxTop > 0 ? Math.round((newTop / maxTop) * 100) : 50;
        inPosX.value = curXPct;
        inPosY.value = curYPct;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        isDraggingCropWin = false;
        isResizingCropBox = false;
        isDraggingCrop = false;
    });

    if (btnCropReset) {
        btnCropReset.addEventListener('click', () => {
            inPosX.value = 50;
            inPosY.value = 50;
            inMediaScale.value = 100;
            updateTransform();
            toast('🎯 绿框构图已居中重置');
        });
    }
    if (btnResetPos) {
        btnResetPos.addEventListener('click', () => {
            inPosY.value = 50;
            inPosX.value = 50;
            inMediaScale.value = 100;
            updateTransform();
            toast('畫面位置與縮放已居中重置');
        });
    }
    if (btnFacePreset) {
        btnFacePreset.addEventListener('click', () => {
            inPosY.value = 18;
            inPosX.value = 50;
            inMediaScale.value = 120;
            updateTransform();
            toast('已應用快速露臉構圖預設');
        });
    }

    refreshTimeUI();
    updateTransform();
})();
