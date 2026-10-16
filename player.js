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
    const previewImg = document.getElementById('preview-img');
    const previewVideo = document.getElementById('preview-video');
    const mediaUploader = document.getElementById('media-uploader');
    const dyFullscreenPill = document.getElementById('dy-fullscreen-pill');
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
    const btnCloseCropWindow = document.getElementById('btn-close-crop-window');
    const cropThumbImg = document.getElementById('crop-thumb-img');
    const cropSelectionBox = document.getElementById('crop-selection-box');
    const cropWindowBody = document.getElementById('crop-window-body');
    const btnCropReset = document.getElementById('btn-crop-reset');
    const txtCropWinSize = document.getElementById('txt-crop-win-size');

    window.PlayerEngine.renderTarget = renderTarget;
    window.PlayerEngine.previewImg = previewImg;
    window.PlayerEngine.previewVideo = previewVideo;

    const toast = (msg) => {
        if (typeof window.showToast === 'function') window.showToast(msg);
    };

    /* ==========================================================================
       1. 视口画幅切换器
       ========================================================================== */
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetMode = btn.dataset.mode;
            const currentSkin = document.getElementById('sel-mobile-skin')?.value === 'laya' ? 'skin-laya' : 'skin-douyin';
            renderTarget.className = `player-box ${targetMode} ${currentSkin}`;

            if (targetMode === 'mode-mobile-land') {
                if (typeof window.switchRightTab === 'function') window.switchRightTab('m-cinema');
            } else if (targetMode === 'mode-mobile-port') {
                if (typeof window.switchRightTab === 'function') window.switchRightTab('dy');
            } else {
                if (typeof window.switchRightTab === 'function') window.switchRightTab('web');
            }
            checkMediaAspect();
            syncCropBoxRatio();
            setTimeout(() => {
                if (typeof window.drawWaveform === 'function') window.drawWaveform();
            }, 60);
        });
    });

    /* ==========================================================================
       2. 媒体上传、格式嗅探与小窗缩略图提取
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
            const isVideo = fileType.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi)$/i.test(fileName);
            const isImage = fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|jfif|bmp|svg)$/i.test(fileName);

            if (isVideo) {
                window.PlayerEngine.isVideoMode = true;
                previewImg.style.display = 'none';
                previewVideo.style.display = 'block';
                if (previewVideo.src && previewVideo.src.startsWith('blob:')) {
                    URL.revokeObjectURL(previewVideo.src);
                }
                const vidUrl = URL.createObjectURL(file);
                previewVideo.src = vidUrl;
                previewVideo.play().then(() => {
                    updatePlayStateUI(true);
                }).catch(() => {
                    updatePlayStateUI(false);
                });

                const tempVid = document.createElement('video');
                tempVid.src = vidUrl;
                tempVid.muted = true;
                tempVid.currentTime = 0.5;
                tempVid.onloadeddata = () => {
                    try {
                        const c = document.createElement('canvas');
                        c.width = tempVid.videoWidth || 640;
                        c.height = tempVid.videoHeight || 360;
                        c.getContext('2d').drawImage(tempVid, 0, 0, c.width, c.height);
                        if (cropThumbImg) cropThumbImg.src = c.toDataURL();
                    } catch (err) {
                        console.warn('Thumb capture fallback:', err);
                    }
                };
                toast('🎬 視頻素材加載成功，點擊「錄屏導出視頻」即可合成帶邊框與動態進度條的視頻！');
            } else if (isImage || !isVideo) {
                window.PlayerEngine.isVideoMode = false;
                previewVideo.pause();
                previewVideo.style.display = 'none';
                previewImg.style.display = 'block';
                if (previewImg.src && previewImg.src.startsWith('blob:')) {
                    URL.revokeObjectURL(previewImg.src);
                }
                const imgUrl = URL.createObjectURL(file);
                previewImg.src = imgUrl;
                if (cropThumbImg) cropThumbImg.src = imgUrl;
                previewImg.onload = () => {
                    checkMediaAspect();
                };
                updatePlayStateUI(false);
                toast('🖼️ 圖片素材加載成功！');
            }
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        });
    }

    function checkMediaAspect() {
        if (!renderTarget.classList.contains('mode-mobile-port')) {
            if (dyFullscreenPill) dyFullscreenPill.style.display = 'none';
            return;
        }
        const dims = window.PlayerEngine.getMediaNaturalDimensions();
        if (dims.width > dims.height) {
            if (dyFullscreenPill) dyFullscreenPill.style.display = 'flex';
        } else {
            if (dyFullscreenPill) dyFullscreenPill.style.display = 'none';
        }
    }
    previewVideo.addEventListener('loadedmetadata', checkMediaAspect);

    if (dyFullscreenPill) {
        dyFullscreenPill.addEventListener('click', () => {
            const landBtn = document.querySelector('.tab-btn[data-mode="mode-mobile-land"]');
            if (landBtn) landBtn.click();
            toast('已切換為手機橫屏全屏視野');
        });
    }

    /* ==========================================================================
       3. 播放与暂停状态双向联动
       ========================================================================== */
    function updatePlayStateUI(isPlaying) {
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

    function randomizeDuration(showMsg = false) {
        const minSec = 1 * 3600 + 20 * 60;
        const maxSec = 2 * 3600 + 30 * 60;
        const randomTotalSec = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
        const formattedTotal = window.PlayerEngine.secToTime(randomTotalSec);
        const curStartStr = inStartTime ? inStartTime.value : '00:04:07';
        applyStartAndTotalTime(curStartStr, formattedTotal, false);
        if (showMsg) {
            toast(`🎲 已随机生成新总片长：${window.PlayerEngine.secToShortTime(randomTotalSec)}`);
        }
    }
    window.PlayerEngine.randomizeDuration = randomizeDuration;

    if (btnRandomTime) {
        btnRandomTime.addEventListener('click', () => randomizeDuration(true));
    }

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

    function handleProgressSliderInput(val) {
        const numVal = parseFloat(val) || 0;
        syncAllProgressBars(numVal);
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

    previewVideo.addEventListener('timeupdate', () => {
        if (!window.PlayerEngine.isVideoMode || !swSyncVideoTime || !swSyncVideoTime.checked) return;
        const baseStart = window.PlayerEngine.timeToSec(inStartTime.value);
        const totalSec = window.PlayerEngine.timeToSec(inTotalTime.value) || 7581;
        const elapsed = Math.floor(previewVideo.currentTime);
        const curSec = baseStart + elapsed;
        if (dispTime) dispTime.textContent = `${window.PlayerEngine.secToTime(curSec)} / ${window.PlayerEngine.secToTime(totalSec)}`;
        if (mDispTime) mDispTime.textContent = `${window.PlayerEngine.secToShortTime(curSec)} / ${window.PlayerEngine.secToShortTime(totalSec)}`;
        const pct = Math.min(100, (curSec / totalSec) * 100);
        syncAllProgressBars(pct);
    });

    randomizeDuration(false);

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
        const zoom = fitMode === 'cover' ? Math.max(1, scaleVal / 100) : (scaleVal / 100);
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
        const renderW = baseW * zoom;
        const renderH = baseH * zoom;
        const offX = (targetW - renderW) * posX;
        const offY = (targetH - renderH) * posY;
        return {
            mediaW, mediaH, mAspect, cAspect,
            zoom, scaleVal, posX, posY, xPct, yPct,
            renderW, renderH, offX, offY
        };
    };

    function updateTransform() {
        const targetW = renderTarget.clientWidth || 800;
        const targetH = renderTarget.clientHeight || 450;
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

    function syncCropBoxPosition() {
        if (!cropInspectorWindow || cropInspectorWindow.style.display === 'none') return;
        const bodyW = cropWindowBody.clientWidth;
        const bodyH = cropWindowBody.clientHeight;
        if (!bodyW || !bodyH) return;
        const targetW = renderTarget.clientWidth || 800;
        const targetH = renderTarget.clientHeight || 450;
        const rect = window.getPlayerCropRect(targetW, targetH);
        const visWFrac = Math.min(1, targetW / rect.renderW);
        const visHFrac = Math.min(1, targetH / rect.renderH);
        const boxW = Math.max(20, Math.round(bodyW * visWFrac));
        const boxH = Math.max(20, Math.round(bodyH * visHFrac));
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
            cropInspectorWindow.style.display = e.target.checked ? 'block' : 'none';
            if (e.target.checked) {
                cropThumbImg.src = previewImg.src;
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

    let isDraggingCrop = false;
    let cropStartX = 0, cropStartY = 0;
    let cropBoxStartLeft = 0, cropBoxStartTop = 0;
    if (cropSelectionBox && cropWindowBody) {
        cropSelectionBox.addEventListener('mousedown', (e) => {
            isDraggingCrop = true;
            cropStartX = e.clientX;
            cropStartY = e.clientY;
            cropBoxStartLeft = cropSelectionBox.offsetLeft;
            cropBoxStartTop = cropSelectionBox.offsetTop;
            e.preventDefault();
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDraggingCrop) return;
            const deltaX = e.clientX - cropStartX;
            const deltaY = e.clientY - cropStartY;
            const bodyW = cropWindowBody.clientWidth;
            const bodyH = cropWindowBody.clientHeight;
            const boxW = cropSelectionBox.offsetWidth;
            const boxH = cropSelectionBox.offsetHeight;
            const maxLeft = Math.max(0, bodyW - boxW);
            const maxTop = Math.max(0, bodyH - boxH);
            const newLeft = Math.min(maxLeft, Math.max(0, cropBoxStartLeft + deltaX));
            const newTop = Math.min(maxTop, Math.max(0, cropBoxStartTop + deltaY));
            const curXPct = maxLeft > 0 ? Math.round((newLeft / maxLeft) * 100) : 50;
            const curYPct = maxTop > 0 ? Math.round((newTop / maxTop) * 100) : 50;
            inPosX.value = curXPct;
            inPosY.value = curYPct;
            updateTransform();
        });
        window.addEventListener('mouseup', () => {
            isDraggingCrop = false;
        });
    }

    if (btnCropReset) {
        btnCropReset.addEventListener('click', () => {
            inPosX.value = 50;
            inPosY.value = 50;
            inMediaScale.value = 100;
            updateTransform();
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
            inMediaScale.value = 110;
            updateTransform();
            toast('已應用快速露臉構圖預設');
        });
    }

    refreshTimeUI();
    updateTransform();
})();
