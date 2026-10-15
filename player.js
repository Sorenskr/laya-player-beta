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
    
    // 将时间字符串转换为总秒数
    timeToSec(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.trim().split(':').map(Number);
        if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
        if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
        return parseInt(timeStr, 10) || 0;
    },

    // 标准全格式时间码 (00:04:07)
    secToTime(totalSec) {
        if (isNaN(totalSec) || totalSec < 0) totalSec = 0;
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = Math.floor(totalSec % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },

    // 手机横屏紧凑时间码 (0:04:07)
    secToShortTime(totalSec) {
        if (isNaN(totalSec) || totalSec < 0) totalSec = 0;
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = Math.floor(totalSec % 60);
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },

    // 获取当前底层媒体素材的原始物理宽高
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
       1. 视口画幅切换器 (电脑 16:9 / 手机横屏 19.5:9 / 手机竖屏 9:16)
       ========================================================================== */
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const targetMode = btn.dataset.mode;
            const currentSkin = document.getElementById('sel-mobile-skin')?.value === 'laya' ? 'skin-laya' : 'skin-douyin';
            renderTarget.className = `player-box ${targetMode} ${currentSkin}`;

            // 自动联动右侧控制面板到对应分类
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

                // 为独立取景框生成第 0.5 秒视频帧缩略图
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
       3. 播放与暂停状态双向联动 (电脑端 + 手机横屏同步)
       ========================================================================== */
    function updatePlayStateUI(isPlaying) {
        if (isPlaying) {
            // 电脑端控件
            if (iconBotPlay) iconBotPlay.style.display = 'none';
            if (iconBotPause) iconBotPause.style.display = 'block';
            if (iconCenterPlay) iconCenterPlay.style.display = 'none';
            if (iconCenterPause) iconCenterPause.style.display = 'flex';
            if (dispCenterPill) dispCenterPill.textContent = '點擊暫停播放';

            // 手机横屏控件
            if (mIconPlay) mIconPlay.style.display = 'none';
            if (mIconPause) mIconPause.style.display = 'flex';
            if (swMAutoSub && swMAutoSub.checked && mDispSubTitle) {
                mDispSubTitle.textContent = '正在播放 · 橫屏播放';
                if (inMSubTitle) inMSubTitle.value = '正在播放 · 橫屏播放';
            }
        } else {
            // 电脑端控件
            if (iconBotPlay) iconBotPlay.style.display = 'block';
            if (iconBotPause) iconBotPause.style.display = 'none';
            if (iconCenterPlay) iconCenterPlay.style.display = 'block';
            if (iconCenterPause) iconCenterPause.style.display = 'none';
            if (dispCenterPill) dispCenterPill.textContent = '點擊繼續播放';

            // 手机横屏控件
            if (mIconPlay) mIconPlay.style.display = 'block';
            if (mIconPause) mIconPause.style.display = 'none';
            if (swMAutoSub && swMAutoSub.checked && mDispSubTitle) {
                mDispSubTitle.textContent = '正在暫停 · 橫屏播放';
                if (inMSubTitle) inMSubTitle.value = '正在暫停 · 橫屏播放';
            }
        }
    }
    window.PlayerEngine.updatePlayStateUI = updatePlayStateUI;

    function togglePlayback() {
        if (!window.PlayerEngine.isVideoMode) {
            // 静态图模式下也允许切换按钮图标状态，方便用户截图“播放态”或“暂停态”
            const currentlyPaused = mIconPlay ? (mIconPlay.style.display !== 'none') : true;
            updatePlayStateUI(currentlyPaused);
            toast(currentlyPaused ? '已切換圖標為：播放狀態' : '已切換圖標為：暫停狀態');
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

    /* ==========================================================================
       4. 三端时间码与进度条同步系统
       ========================================================================== */
    function syncAllProgressBars(pct) {
        const clamped = Math.min(100, Math.max(0, Number(pct) || 0));
        const widthStr = clamped.toFixed(2) + '%';
        if (dispProgressBar) dispProgressBar.style.width = widthStr;
        if (mDispProgress) mDispProgress.style.width = widthStr;
        if (dyTinyFill) dyTinyFill.style.width = widthStr;
        if (txtProgress) txtProgress.textContent = Math.round(clamped) + '%';
    }

    function syncAllBufferBars(pct) {
        const clamped = Math.min(100, Math.max(0, Number(pct) || 0));
        const widthStr = clamped + '%';
        if (dispBufferBar) dispBufferBar.style.width = widthStr;
        if (mDispBuffer) mDispBuffer.style.width = widthStr;
        if (dyTinyBuffer) dyTinyBuffer.style.width = widthStr;
        if (txtBuffer) txtBuffer.textContent = widthStr;
    }

    function refreshTimeUI() {
        const s = window.PlayerEngine.timeToSec(inStartTime.value);
        const t = window.PlayerEngine.timeToSec(inTotalTime.value) || 1;
        if (dispTime) dispTime.textContent = `${window.PlayerEngine.secToTime(s)} / ${window.PlayerEngine.secToTime(t)}`;
        if (mDispTime) mDispTime.textContent = window.PlayerEngine.secToShortTime(s);
    }
    window.PlayerEngine.refreshTimeUI = refreshTimeUI;

    inStartTime.addEventListener('input', () => {
        refreshTimeUI();
        const startSec = window.PlayerEngine.timeToSec(inStartTime.value);
        const totalSec = window.PlayerEngine.timeToSec(inTotalTime.value);
        if (totalSec > 0) {
            const pct = Math.min(100, Math.max(0, Math.round((startSec / totalSec) * 100)));
            inProgress.value = pct;
            syncAllProgressBars(pct);
        }
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
    });

    inTotalTime.addEventListener('input', () => {
        refreshTimeUI();
        const startSec = window.PlayerEngine.timeToSec(inStartTime.value);
        const totalSec = window.PlayerEngine.timeToSec(inTotalTime.value);
        if (totalSec > 0) {
            const pct = Math.min(100, Math.max(0, Math.round((startSec / totalSec) * 100)));
            inProgress.value = pct;
            syncAllProgressBars(pct);
        }
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
    });

    inProgress.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        syncAllProgressBars(val);
        const total = window.PlayerEngine.timeToSec(inTotalTime.value) || 1125;
        const newSec = Math.round((val / 100) * total);
        inStartTime.value = window.PlayerEngine.secToTime(newSec);
        refreshTimeUI();
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
    });

    inBuffer.addEventListener('input', (e) => {
        syncAllBufferBars(e.target.value);
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
    });

    // 电脑端进度条点击直接跳转
    if (progressClickBar) {
        progressClickBar.addEventListener('click', (e) => {
            const rect = progressClickBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.min(100, Math.max(0, Math.round((clickX / rect.width) * 100)));
            inProgress.value = pct;
            inProgress.dispatchEvent(new Event('input'));
        });
    }

    // 手机横屏进度条点击直接跳转
    if (mProgressContainer) {
        mProgressContainer.addEventListener('click', (e) => {
            const rect = mProgressContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.min(100, Math.max(0, Math.round((clickX / rect.width) * 100)));
            inProgress.value = pct;
            inProgress.dispatchEvent(new Event('input'));
        });
    }

    // 视频播放时真实秒数与进度条走动
    previewVideo.addEventListener('timeupdate', () => {
        if (!window.PlayerEngine.isVideoMode || !swSyncVideoTime.checked) return;

        const baseStart = window.PlayerEngine.timeToSec(inStartTime.value);
        const totalSec = window.PlayerEngine.timeToSec(inTotalTime.value) || 1125;
        const elapsed = Math.floor(previewVideo.currentTime);
        const curSec = baseStart + elapsed;

        if (dispTime) dispTime.textContent = `${window.PlayerEngine.secToTime(curSec)} / ${window.PlayerEngine.secToTime(totalSec)}`;
        if (mDispTime) mDispTime.textContent = window.PlayerEngine.secToShortTime(curSec);

        const pct = Math.min(100, (curSec / totalSec) * 100);
        syncAllProgressBars(pct);
    });

    /* ==========================================================================
       5. 独立取景框浮窗：滚轮缩放小窗、红绿选框拖拽与双向联动
       ========================================================================== */
    function updateTransform() {
        const yVal = inPosY.value + '%';
        const xVal = inPosX.value + '%';
        const scaleVal = inMediaScale.value / 100;

        document.documentElement.style.setProperty('--media-pos-y', yVal);
        document.documentElement.style.setProperty('--media-pos-x', xVal);
        document.documentElement.style.setProperty('--media-scale', scaleVal);

        if (txtPosY) txtPosY.textContent = yVal;
        if (txtPosX) txtPosX.textContent = xVal;
        if (txtMediaScale) txtMediaScale.textContent = inMediaScale.value + '%';

        syncCropBoxPosition();
        if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
    }

    inPosY.addEventListener('input', updateTransform);
    inPosX.addEventListener('input', updateTransform);
    inMediaScale.addEventListener('input', updateTransform);

    if (selCropFit) {
        selCropFit.addEventListener('change', (e) => {
            const fit = e.target.value;
            previewImg.style.objectFit = fit;
            previewVideo.style.objectFit = fit;
            toast(fit === 'cover' ? '已切換為：等比裁切填充 (無黑邊)' : '已切換為：完整畫面包含 (留黑邊不變形)');
            if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
        });
    }

    if (swCropWindow && cropInspectorWindow) {
        swCropWindow.addEventListener('change', (e) => {
            cropInspectorWindow.style.display = e.target.checked ? 'flex' : 'none';
            if (e.target.checked) {
                if (!cropThumbImg.src || cropThumbImg.src === window.location.href) {
                    cropThumbImg.src = previewImg.src;
                }
                syncCropBoxRatio();
                syncCropBoxPosition();
            }
        });
    }

    if (btnCloseCropWindow) {
        btnCloseCropWindow.addEventListener('click', () => {
            swCropWindow.checked = false;
            cropInspectorWindow.style.display = 'none';
        });
    }

    let currentWinWidth = 240;
    if (cropInspectorWindow) {
        cropInspectorWindow.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                currentWinWidth = Math.min(420, currentWinWidth + 15);
            } else {
                currentWinWidth = Math.max(180, currentWinWidth - 15);
            }
            cropInspectorWindow.style.width = currentWinWidth + 'px';
            if (txtCropWinSize) txtCropWinSize.textContent = `尺寸: ${currentWinWidth}px`;
            syncCropBoxPosition();
        }, { passive: false });
    }

    function syncCropBoxRatio() {
        if (!cropSelectionBox) return;
        const isPort = renderTarget.classList.contains('mode-mobile-port');
        const isLand = renderTarget.classList.contains('mode-mobile-land');
        
        if (isPort) {
            cropSelectionBox.style.width = '42%';
            cropSelectionBox.style.aspectRatio = '9 / 16';
        } else if (isLand) {
            cropSelectionBox.style.width = '80%';
            cropSelectionBox.style.aspectRatio = '19.5 / 9';
        } else {
            cropSelectionBox.style.width = '75%';
            cropSelectionBox.style.aspectRatio = '16 / 9';
        }
    }

    function syncCropBoxPosition() {
        if (!cropSelectionBox || !cropWindowBody) return;
        const xPct = parseFloat(inPosX.value) || 50;
        const yPct = parseFloat(inPosY.value) || 50;
        
        const bodyW = cropWindowBody.offsetWidth;
        const bodyH = cropWindowBody.offsetHeight;
        const boxW = cropSelectionBox.offsetWidth;
        const boxH = cropSelectionBox.offsetHeight;

        const maxLeft = bodyW - boxW;
        const maxTop = bodyH - boxH;

        if (maxLeft > 0 && maxTop > 0) {
            cropSelectionBox.style.left = (maxLeft * (1 - xPct / 100)) + 'px';
            cropSelectionBox.style.top = (maxTop * (1 - yPct / 100)) + 'px';
        }
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
            e.stopPropagation();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDraggingCrop) return;
            const deltaX = e.clientX - cropStartX;
            const deltaY = e.clientY - cropStartY;

            const bodyW = cropWindowBody.offsetWidth;
            const bodyH = cropWindowBody.offsetHeight;
            const boxW = cropSelectionBox.offsetWidth;
            const boxH = cropSelectionBox.offsetHeight;

            const maxLeft = Math.max(1, bodyW - boxW);
            const maxTop = Math.max(1, bodyH - boxH);

            let newLeft = Math.min(maxLeft, Math.max(0, cropBoxStartLeft + deltaX));
            let newTop = Math.min(maxTop, Math.max(0, cropBoxStartTop + deltaY));

            cropSelectionBox.style.left = newLeft + 'px';
            cropSelectionBox.style.top = newTop + 'px';

            const revXPct = Math.round((1 - newLeft / maxLeft) * 100);
            const revYPct = Math.round((1 - newTop / maxTop) * 100);

            inPosX.value = revXPct;
            inPosY.value = revYPct;

            const yVal = revYPct + '%';
            const xVal = revXPct + '%';
            document.documentElement.style.setProperty('--media-pos-y', yVal);
            document.documentElement.style.setProperty('--media-pos-x', xVal);
            if (txtPosY) txtPosY.textContent = yVal;
            if (txtPosX) txtPosX.textContent = xVal;
        });

        window.addEventListener('mouseup', () => {
            if (isDraggingCrop) {
                isDraggingCrop = false;
                if (typeof window.triggerSaveStorage === 'function') window.triggerSaveStorage();
            }
        });
    }

    if (btnCropReset) {
        btnCropReset.addEventListener('click', () => {
            inPosY.value = 50;
            inPosX.value = 50;
            inMediaScale.value = 100;
            updateTransform();
            toast('小窗取景已居中');
        });
    }

    btnResetPos.addEventListener('click', () => {
        inPosY.value = 50;
        inPosX.value = 50;
        inMediaScale.value = 100;
        updateTransform();
        toast('畫面已恢復默認居中');
    });

    btnFacePreset.addEventListener('click', () => {
        inPosY.value = 18;
        inPosX.value = 50;
        inMediaScale.value = 110;
        updateTransform();
        toast('已應用快速露臉構圖預設');
    });

    refreshTimeUI();
    updateTransform();
})();
