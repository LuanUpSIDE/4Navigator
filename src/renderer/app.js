// 4Navigator — Main Renderer Application Logic

document.addEventListener('DOMContentLoaded', () => {
  const quadrants = [];
  let isGlobalMuted = false;
  let lastFocusedQuadId = 1;

  // Online Resilience & Anti-Disconnect State
  const onlineSettings = {
    autoReconnect: true,
    keepAlive: true,
    browserCloak: true,
    userAgent: ''
  };
  const watchdogQuadState = new Map();
  let totalWatchdogReconnections = parseInt(sessionStorage.getItem('4nav_reconnect_count') || '0', 10);

  function resetWatchdogRetry(quadId) {
    const state = watchdogQuadState.get(quadId);
    if (state) {
      state.retryCount = 0;
      if (state.retryTimeout) {
        clearTimeout(state.retryTimeout);
        state.retryTimeout = null;
      }
    }
  }

  function handleWatchdogFailure(quad, errorDesc) {
    if (!onlineSettings.autoReconnect) return;
    if (!quad || quad.isClosed || !quad.webview) return;

    const currentUrl = quad.webview.getURL() || quad.urlInput.value;
    if (!currentUrl || currentUrl === 'about:blank') return;

    const state = watchdogQuadState.get(quad.id) || { retryCount: 0, lastRetryTime: 0, retryTimeout: null };
    const now = Date.now();

    // Debounce retries: don't double schedule within 2.5 seconds
    if (state.retryTimeout && (now - state.lastRetryTime) < 2500) {
      return;
    }

    state.retryCount++;
    state.lastRetryTime = now;
    // Progressive backoff: 3s, 5s, 8s, up to max 12s
    const delaySec = Math.min(12, 2 + state.retryCount * 2);

    totalWatchdogReconnections++;
    sessionStorage.setItem('4nav_reconnect_count', String(totalWatchdogReconnections));
    if (typeof updateWatchdogUI === 'function') updateWatchdogUI();

    showToast(`🔄 [Sentinela P${quad.id}] Falha de rede (${errorDesc}). Reconectando em ${delaySec}s...`, 4000);

    if (state.retryTimeout) clearTimeout(state.retryTimeout);
    state.retryTimeout = setTimeout(() => {
      state.retryTimeout = null;
      try {
        if (quad.webview && quad.webview.getURL() && quad.webview.getURL() !== 'about:blank') {
          quad.reload();
        } else if (currentUrl && currentUrl !== 'about:blank') {
          quad.navigateTo(currentUrl);
        }
      } catch (_) {}
    }, delaySec * 1000);

    watchdogQuadState.set(quad.id, state);
  }

  // Feature 4: Security Shield & Protocol Indicator
  function updateQuadrantSecurityShield(quad, url) {
    if (!quad || !quad.urlShield) return;
    const rawUrl = (url || '').trim().toLowerCase();
    if (rawUrl.startsWith('https://')) {
      quad.urlShield.textContent = '🔒';
      quad.urlShield.className = 'url-shield secure';
      quad.urlShield.title = 'Conexão Segura e Criptografada (HTTPS - SSL/TLS)';
    } else if (rawUrl.startsWith('http://')) {
      quad.urlShield.textContent = '⚠️';
      quad.urlShield.className = 'url-shield insecure';
      quad.urlShield.title = 'Atenção: Conexão NÃO criptografada (HTTP)! Não insira senhas nesta página.';
    } else {
      quad.urlShield.textContent = '🌐';
      quad.urlShield.className = 'url-shield neutral';
      quad.urlShield.title = 'Página local ou endereço padrão';
    }
  }

  // ================= Smart FPS & Background Sleeping Tabs State =================
  let smartFpsEnabled = localStorage.getItem('4nav_smart_fps') !== 'false';

  function applySmartFpsThrottleToQuadrant(quad, targetFps) {
    if (!quad || quad.isClosed || !quad.webview) return;
    try {
      quad.webview.executeJavaScript(`
        (function(fps) {
          if (!window.__4navRafThrottlerInstalled) {
            window.__4navRafThrottlerInstalled = true;
            const originalRaf = window.requestAnimationFrame.bind(window);
            window.__4navTargetInterval = 0;
            window.__4navLastFrameTime = 0;

            window.__set4NavRenderThrottle = function(target) {
              if (!target || target <= 0 || target >= 60) {
                window.__4navTargetInterval = 0;
              } else {
                window.__4navTargetInterval = 1000 / target;
              }
            };

            window.requestAnimationFrame = function(callback) {
              if (window.__4navTargetInterval <= 0) {
                return originalRaf(callback);
              }
              return originalRaf(function(timestamp) {
                const elapsed = timestamp - window.__4navLastFrameTime;
                if (elapsed < window.__4navTargetInterval) {
                  window.requestAnimationFrame(callback);
                } else {
                  window.__4navLastFrameTime = timestamp - (elapsed % window.__4navTargetInterval);
                  callback(timestamp);
                }
              });
            };
          }

          if (window.__set4NavRenderThrottle) {
            window.__set4NavRenderThrottle(fps);
          }
        })(${targetFps});
      `).catch(() => {});
    } catch (_) {}
  }

  function updateSmartFpsThrottling() {
    const statusTextEl = document.getElementById('smart-fps-status-text');
    if (!smartFpsEnabled) {
      quadrants.forEach(q => applySmartFpsThrottleToQuadrant(q, 0));
      if (statusTextEl) {
        statusTextEl.textContent = '⚪ Smart FPS: Desativado (60 FPS Contínuo)';
      }
      return;
    }

    const isWindowFocused = document.hasFocus();
    if (!isWindowFocused) {
      // Window in background: throttle all open quadrants to 5 FPS (extreme GPU saving)
      quadrants.forEach(q => applySmartFpsThrottleToQuadrant(q, 5));
      if (statusTextEl) {
        statusTextEl.textContent = '💤 Smart FPS: Janela em 2º plano (Todos os painéis a 5 FPS)';
      }
    } else {
      // Window focused: active quadrant at 60 FPS, background quadrants at 10 FPS
      quadrants.forEach(q => {
        if (q.id === lastFocusedQuadId) {
          applySmartFpsThrottleToQuadrant(q, 0);
        } else {
          applySmartFpsThrottleToQuadrant(q, 10);
        }
      });
      if (statusTextEl) {
        statusTextEl.textContent = `🟢 Smart FPS: Ativo (Painel ${lastFocusedQuadId} a 60 FPS, outros a 10 FPS)`;
      }
    }
  }

  // Initialize Quadrants 1 through 4
  for (let id = 1; id <= 4; id++) {
    const el = document.getElementById(`quadrant-${id}`);
    if (!el) continue;

    const webview = el.querySelector('.game-webview');
    const urlInput = el.querySelector('.url-input');
    const urlShield = el.querySelector('.url-shield');
    const btnGo = el.querySelector('.btn-go');
    const btnHome = el.querySelector('.btn-home');
    const btnBack = el.querySelector('.btn-back');
    const btnForward = el.querySelector('.btn-forward');
    const btnReload = el.querySelector('.btn-reload');
    const btnMute = el.querySelector('.btn-mute');
    const volumeSlider = el.querySelector('.volume-slider');
    const volumeLevelEl = el.querySelector('.volume-level');
    const btnBookmark = el.querySelector('.btn-bookmark');
    const btnCredentials = el.querySelector('.btn-credentials');
    const btnAutoclick = el.querySelector('.btn-autoclick');
    const autoclickBadge = el.querySelector('.autoclick-badge');
    const btnZoomIn = el.querySelector('.btn-zoom-in');
    const btnZoomOut = el.querySelector('.btn-zoom-out');
    const zoomLevelEl = el.querySelector('.zoom-level');
    const btnDevtools = el.querySelector('.btn-devtools');
    const btnExpand = el.querySelector('.btn-expand');
    const btnCloseQuadrant = el.querySelector('.btn-close-quadrant');
    const loadingBar = el.querySelector('.loading-bar');
    const emptyState = el.querySelector('.empty-state-overlay');
    const webviewWrapper = el.querySelector('.webview-wrapper');

    let currentZoom = 1.0;
    let autoClickerInterval = null;
    let clickCoords = { x: 200, y: 200 };

    let savedVol = parseInt(localStorage.getItem(`4nav_volume_quad_${id}`) || '100', 10);
    if (isNaN(savedVol) || savedVol < 0 || savedVol > 200) savedVol = 100;

    const handleQuadFocus = () => {
      if (lastFocusedQuadId !== id) {
        lastFocusedQuadId = id;
        updateSmartFpsThrottling();
      }
    };
    el.addEventListener('focusin', handleQuadFocus);
    el.addEventListener('mousedown', handleQuadFocus);
    el.addEventListener('mouseenter', handleQuadFocus);

    // Track coordinates inside webview wrapper
    webviewWrapper.addEventListener('mousemove', (e) => {
      const rect = webview.getBoundingClientRect();
      clickCoords.x = Math.max(0, Math.round(e.clientX - rect.left));
      clickCoords.y = Math.max(0, Math.round(e.clientY - rect.top));
    });

    const quad = {
      id,
      el,
      webview,
      urlInput,
      urlShield,
      btnMute,
      btnBookmark,
      btnCredentials,
      emptyState,
      isClosed: false,
      goHome() {
        try { webview.stop(); } catch (_) {}
        webview.src = 'about:blank';
        urlInput.value = '';
        if (emptyState) emptyState.classList.remove('hidden');
        updateQuadrantSecurityShield(this, '');
        resetWatchdogRetry(id);
        if (autoClickerInterval) {
          clearInterval(autoClickerInterval);
          autoClickerInterval = null;
          btnAutoclick.classList.remove('active-autoclick');
          autoclickBadge.classList.add('hidden');
        }
        currentZoom = 1.0;
        try { webview.setZoomFactor(1.0); } catch (_) {}
        zoomLevelEl.textContent = '100%';
        updateBookmarkButtons();
        updateCredentialButtons();
        showToast(`Painel ${id}: Retornado à Tela Inicial`);
      },
      close() {
        // Really close and stop everything running in this webview
        try { webview.stop(); } catch (_) {}
        webview.src = 'about:blank';
        try { webview.setAudioMuted(true); } catch (_) {}
        urlInput.value = '';
        if (emptyState) emptyState.classList.remove('hidden');
        updateQuadrantSecurityShield(this, '');
        resetWatchdogRetry(id);
        if (autoClickerInterval) {
          clearInterval(autoClickerInterval);
          autoClickerInterval = null;
          btnAutoclick.classList.remove('active-autoclick');
          autoclickBadge.classList.add('hidden');
        }
        currentZoom = 1.0;
        try { webview.setZoomFactor(1.0); } catch (_) {}
        zoomLevelEl.textContent = '100%';

        if (el.classList.contains('is-maximized')) {
          el.classList.remove('is-maximized');
          btnExpand.textContent = '⤢';
        }

        this.isClosed = true;
        el.classList.add('is-closed');
        updateGridLayout();
        showToast(`Painel ${id} fechado`);
      },
      open(targetUrl = null) {
        this.isClosed = false;
        el.classList.remove('is-closed');
        updateGridLayout();
        if (targetUrl) {
          this.navigateTo(targetUrl);
        } else {
          this.goHome();
        }
      },
      navigateTo(url) {
        if (!url) return;
        let finalUrl = url.trim();
        if (!/^https?:\/\//i.test(finalUrl)) {
          finalUrl = 'https://' + finalUrl;
        }
        urlInput.value = finalUrl;
        webview.src = finalUrl;
        updateQuadrantSecurityShield(this, finalUrl);
        if (emptyState) emptyState.classList.add('hidden');
      },
      volume: savedVol,
      setVolume(volPercent, syncSlider = true) {
        this.volume = Math.max(0, Math.min(200, Number(volPercent) || 0));
        if (syncSlider && volumeSlider) {
          volumeSlider.value = this.volume;
        }
        if (volumeLevelEl) {
          volumeLevelEl.textContent = `${this.volume}%`;
          volumeLevelEl.classList.toggle('boosted', this.volume > 100);
        }
        localStorage.setItem(`4nav_volume_quad_${id}`, this.volume);

        if (this.volume === 0) {
          this.setMuted(true);
        } else {
          if (this.isMuted()) {
            this.setMuted(false);
          } else {
            this.updateMuteIcon();
          }
          this.applyAudioGainToWebview();
        }
      },
      updateMuteIcon() {
        if (this.isMuted()) {
          btnMute.textContent = '🔇';
          btnMute.classList.add('active-mute');
          btnMute.title = 'Desmutar este jogo';
        } else {
          btnMute.classList.remove('active-mute');
          btnMute.title = 'Mutar este jogo';
          if (this.volume > 100) {
            btnMute.textContent = '📢';
          } else if (this.volume > 40) {
            btnMute.textContent = '🔊';
          } else {
            btnMute.textContent = '🔉';
          }
        }
      },
      setMuted(muted) {
        webview.setAudioMuted(muted);
        this.updateMuteIcon();
        this.applyAudioGainToWebview();
      },
      isMuted() {
        return webview.isAudioMuted();
      },
      applyAudioGainToWebview() {
        const gainFactor = this.isMuted() ? 0 : (this.volume / 100);
        try {
          webview.executeJavaScript(`
            (function(gain) {
              try {
                // 1. Regular media elements (volume 0.0 to 1.0)
                const normVol = Math.min(1.0, Math.max(0.0, gain));
                document.querySelectorAll('audio, video').forEach(m => {
                  try { m.volume = normVol; } catch (_) {}
                });

                // 2. Web Audio API Master Gain
                if (!window.__4navAudioCtx && (window.AudioContext || window.webkitAudioContext)) {
                  const Ctx = window.AudioContext || window.webkitAudioContext;
                  window.__4navAudioCtx = new Ctx();
                  window.__4navGainNode = window.__4navAudioCtx.createGain();
                  window.__4navGainNode.connect(window.__4navAudioCtx.destination);
                  window.__4navSources = new WeakSet();
                }

                if (window.__4navGainNode && window.__4navAudioCtx) {
                  window.__4navGainNode.gain.setValueAtTime(gain, window.__4navAudioCtx.currentTime);

                  document.querySelectorAll('audio, video').forEach(media => {
                    if (!window.__4navSources.has(media)) {
                      try {
                        const src = window.__4navAudioCtx.createMediaElementSource(media);
                        src.connect(window.__4navGainNode);
                        window.__4navSources.add(media);
                      } catch (_) {}
                    }
                  });

                  if (window.__4navAudioCtx.state === 'suspended' && gain > 0) {
                    window.__4navAudioCtx.resume().catch(() => {});
                  }
                }
              } catch (_) {}
            })(${gainFactor});
          `).catch(() => {});
        } catch (_) {}
      },
      reload() {
        webview.reload();
      },
      toggleAutoClicker(cps = 20) {
        if (autoClickerInterval) {
          clearInterval(autoClickerInterval);
          autoClickerInterval = null;
          btnAutoclick.classList.remove('active-autoclick');
          autoclickBadge.classList.add('hidden');
          showToast(`Painel ${id}: Auto-Clicker Desativado`);
        } else {
          const delay = Math.max(10, Math.round(1000 / cps));
          btnAutoclick.classList.add('active-autoclick');
          autoclickBadge.textContent = `${cps} CPS`;
          autoclickBadge.classList.remove('hidden');

          autoClickerInterval = setInterval(() => {
            const targetX = clickCoords.x || Math.round(webview.clientWidth / 2);
            const targetY = clickCoords.y || Math.round(webview.clientHeight / 2);
            
            // Native Chromium input event
            try {
              webview.sendInputEvent({ type: 'mouseDown', x: targetX, y: targetY, button: 'left', clickCount: 1 });
              webview.sendInputEvent({ type: 'mouseUp', x: targetX, y: targetY, button: 'left', clickCount: 1 });
            } catch (_) {}
          }, delay);

          showToast(`Painel ${id}: Auto-Clicker Ativado (${cps} CPS)`);
        }
      }
    };

    // Shield status information click
    if (urlShield) {
      urlShield.addEventListener('click', () => {
        const currentUrl = (webview.getURL() || urlInput.value || '').trim();
        if (!currentUrl || currentUrl === 'about:blank') {
          showToast(`Painel ${id}: Nenhuma página aberta.`);
          return;
        }
        if (currentUrl.startsWith('https://')) {
          showToast(`🔒 Painel ${id}: Conexão Segura com Criptografia SSL/TLS (HTTPS).`);
        } else if (currentUrl.startsWith('http://')) {
          showToast(`⚠️ Painel ${id}: ATENÇÃO! Conexão NÃO segura (HTTP sem criptografia). Não envie senhas!`);
        } else {
          showToast(`🌐 Painel ${id}: Página local ou interna.`);
        }
      });
    }

    // Navigation Input Actions
    btnGo.addEventListener('click', () => quad.navigateTo(urlInput.value));
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        quad.navigateTo(urlInput.value);
      }
    });

    btnBack.addEventListener('click', () => {
      if (webview.canGoBack()) webview.goBack();
    });

    btnForward.addEventListener('click', () => {
      if (webview.canGoForward()) webview.goForward();
    });

    btnReload.addEventListener('click', () => {
      quad.reload();
    });

    if (btnHome) {
      btnHome.addEventListener('click', () => {
        quad.goHome();
      });
    }

    // Bookmark Action for this quadrant
    if (btnBookmark) {
      btnBookmark.addEventListener('click', () => {
        toggleBookmarkForQuadrant(quad);
      });
    }

    // Credentials Action for this quadrant (protected by Master PIN if configured)
    if (btnCredentials) {
      btnCredentials.addEventListener('click', async () => {
        const unlocked = await ensureVaultUnlocked();
        if (!unlocked) return;
        openQuickCredentialsModal(quad);
      });
    }

    // Auto-Clicker Toggle
    btnAutoclick.addEventListener('click', () => {
      quad.toggleAutoClicker(20);
    });

    // Volume & Gain Slider Actions (0% to 200%)
    if (volumeSlider) {
      volumeSlider.value = savedVol;
      volumeSlider.addEventListener('input', () => {
        const val = Number(volumeSlider.value);
        quad.setVolume(val, false);
      });
      volumeSlider.addEventListener('click', (e) => e.stopPropagation());
      volumeSlider.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    if (volumeLevelEl) {
      volumeLevelEl.textContent = `${savedVol}%`;
      volumeLevelEl.classList.toggle('boosted', savedVol > 100);
    }

    // Mute / Unmute Button
    btnMute.addEventListener('click', (e) => {
      e.stopPropagation();
      const willMute = !quad.isMuted();
      quad.setMuted(willMute);
      if (!willMute && quad.volume === 0) {
        quad.setVolume(100);
      }
      showToast(`Painel ${id}: ${willMute ? 'Áudio Silenciado' : 'Áudio Ativado (' + quad.volume + '%)'}`);
    });

    // Zoom Actions
    btnZoomIn.addEventListener('click', () => {
      currentZoom = Math.min(2.0, +(currentZoom + 0.1).toFixed(1));
      webview.setZoomFactor(currentZoom);
      zoomLevelEl.textContent = `${Math.round(currentZoom * 100)}%`;
    });

    btnZoomOut.addEventListener('click', () => {
      currentZoom = Math.max(0.5, +(currentZoom - 0.1).toFixed(1));
      webview.setZoomFactor(currentZoom);
      zoomLevelEl.textContent = `${Math.round(currentZoom * 100)}%`;
    });

    // DevTools
    btnDevtools.addEventListener('click', () => {
      if (webview.isDevToolsOpened()) {
        webview.closeDevTools();
      } else {
        webview.openDevTools();
      }
    });

    // Maximize / Expand single quadrant
    btnExpand.addEventListener('click', () => {
      const isMax = el.classList.toggle('is-maximized');
      btnExpand.textContent = isMax ? '⤡' : '⤢';
      btnExpand.title = isMax ? 'Restaurar grade' : 'Maximizar este quadrante';
      if (isMax) {
        showToast(`Painel ${id} maximizado (clique em ⤡ para restaurar)`);
      }
    });

    if (btnCloseQuadrant) {
      btnCloseQuadrant.addEventListener('click', () => {
        quad.close();
      });
    }

    // Webview Event Listeners
    webview.addEventListener('did-start-loading', () => {
      if (loadingBar) {
        loadingBar.style.opacity = '1';
        loadingBar.style.width = '70%';
      }
      updateQuadrantSecurityShield(quad, webview.getURL());
    });

    webview.addEventListener('did-stop-loading', () => {
      if (loadingBar) {
        loadingBar.style.width = '100%';
        setTimeout(() => {
          loadingBar.style.opacity = '0';
          loadingBar.style.width = '0%';
        }, 300);
      }
      if (webview.getURL() && webview.getURL() !== 'about:blank') {
        urlInput.value = webview.getURL();
        if (emptyState) emptyState.classList.add('hidden');
        updateBookmarkButtons();
        updateCredentialButtons();
        updateQuadrantSecurityShield(quad, webview.getURL());
        resetWatchdogRetry(quad.id);
        quad.applyAudioGainToWebview();
        if (smartFpsEnabled) {
          applySmartFpsThrottleToQuadrant(quad, (quad.id === lastFocusedQuadId && document.hasFocus()) ? 0 : 10);
        }
      }
    });

    webview.addEventListener('did-navigate', (event) => {
      if (event.url && event.url !== 'about:blank') {
        urlInput.value = event.url;
        if (emptyState) emptyState.classList.add('hidden');
        updateBookmarkButtons();
        updateCredentialButtons();
        updateQuadrantSecurityShield(quad, event.url);
        resetWatchdogRetry(quad.id);
        quad.applyAudioGainToWebview();
        if (smartFpsEnabled) {
          applySmartFpsThrottleToQuadrant(quad, (quad.id === lastFocusedQuadId && document.hasFocus()) ? 0 : 10);
        }
      }
    });

    // Feature 4: Navigation Guard - Monitor redirects and protocol changes
    webview.addEventListener('will-navigate', (event) => {
      updateQuadrantSecurityShield(quad, event.url);
    });

    // Intercept popups into the quadrant sandbox
    webview.addEventListener('new-window', (e) => {
      e.preventDefault();
      if (e.url) {
        quad.navigateTo(e.url);
      }
    });

    // Feature 5: Inject Client-Side Camouflage on Dom Ready
    webview.addEventListener('dom-ready', () => {
      if (onlineSettings.browserCloak !== false) {
        webview.executeJavaScript(`
          try {
            Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
            if (!window.chrome) window.chrome = {};
            if (!window.chrome.runtime) window.chrome.runtime = {};
          } catch (_) {}
        `).catch(() => {});
      }
      quad.applyAudioGainToWebview();
      if (smartFpsEnabled) {
        applySmartFpsThrottleToQuadrant(quad, (quad.id === lastFocusedQuadId && document.hasFocus()) ? 0 : 10);
      }
    });

    // Feature 1: Watchdog did-fail-load handler for network disconnections
    webview.addEventListener('did-fail-load', (e) => {
      if (e.errorCode === -3) return; // Ignore user navigation / redirect aborts
      if (webview.getURL() && webview.getURL() !== 'about:blank') {
        handleWatchdogFailure(quad, e.errorDescription || 'Falha de conexão');
      }
    });

    // Quick suggestion chips
    el.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const targetUrl = chip.getAttribute('data-url');
        quad.navigateTo(targetUrl);
      });
    });

    quad.setVolume(savedVol, true);
    quadrants.push(quad);
  }

  // ================= Bookmarks Logic =================
  const DEFAULT_BOOKMARKS = [
    { title: 'Cookie Clicker', url: 'https://orteil.dashnet.org/cookieclicker/' },
    { title: 'Paperclips', url: 'https://www.decisionproblem.com/paperclips/' },
    { title: 'Trimps', url: 'https://trimps.github.io/' },
    { title: 'Candy Box 2', url: 'https://candybox2.github.io/' },
    { title: 'Antimatter Dimensions', url: 'https://ivark.github.io/AntimatterDimensions/' },
    { title: 'Melvor Idle', url: 'https://melvoridle.com/' }
  ];

  function getBookmarks() {
    const raw = localStorage.getItem('4nav_bookmarks');
    if (!raw) return DEFAULT_BOOKMARKS;
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : DEFAULT_BOOKMARKS;
    } catch (_) {
      return DEFAULT_BOOKMARKS;
    }
  }

  function saveBookmarks(list) {
    localStorage.setItem('4nav_bookmarks', JSON.stringify(list));
    renderBookmarks();
    updateBookmarkButtons();
  }

  function renderBookmarks() {
    const listEl = document.getElementById('bookmarks-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    const bookmarks = getBookmarks();

    bookmarks.forEach((bm, index) => {
      const chip = document.createElement('div');
      chip.className = 'bookmark-chip';
      chip.title = `Clique para abrir no Painel ${lastFocusedQuadId} (${bm.url})`;

      const titleSpan = document.createElement('span');
      titleSpan.textContent = bm.title;
      chip.appendChild(titleSpan);

      const removeBtn = document.createElement('span');
      removeBtn.className = 'chip-remove';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remover favorito';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        bookmarks.splice(index, 1);
        saveBookmarks(bookmarks);
        showToast(`Removido dos favoritos: ${bm.title}`);
      });
      chip.appendChild(removeBtn);

      chip.addEventListener('click', () => {
        const targetQuad = quadrants.find(q => q.id === lastFocusedQuadId) || quadrants[0];
        if (targetQuad) {
          targetQuad.navigateTo(bm.url);
          showToast(`Abrindo "${bm.title}" no Painel ${targetQuad.id}`);
        }
      });

      listEl.appendChild(chip);
    });
  }

  function updateBookmarkButtons() {
    const bookmarks = getBookmarks();
    quadrants.forEach(q => {
      const currentUrl = (q.webview.getURL() || q.urlInput.value || '').trim();
      const isBookmarked = bookmarks.some(bm => bm.url.toLowerCase() === currentUrl.toLowerCase());
      if (q.btnBookmark) {
        q.btnBookmark.classList.toggle('is-bookmarked', isBookmarked);
        q.btnBookmark.title = isBookmarked ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos';
      }
    });
  }

  function toggleBookmarkForQuadrant(quad) {
    const currentUrl = (quad.webview.getURL() || quad.urlInput.value || '').trim();
    if (!currentUrl || currentUrl === 'about:blank') {
      showToast('Digite uma URL ou abra um jogo antes de favoritar.');
      return;
    }

    let title = (quad.webview.getTitle() || '').replace(/ - Google Chrome$/i, '').trim();
    if (!title || title === 'about:blank') {
      try {
        const urlObj = new URL(currentUrl);
        title = urlObj.hostname.replace(/^www\./, '');
      } catch (_) {
        title = 'Jogo Painel ' + quad.id;
      }
    }

    const bookmarks = getBookmarks();
    const existingIndex = bookmarks.findIndex(bm => bm.url.toLowerCase() === currentUrl.toLowerCase());

    if (existingIndex >= 0) {
      bookmarks.splice(existingIndex, 1);
      saveBookmarks(bookmarks);
      showToast(`Removido dos favoritos: ${title}`);
    } else {
      bookmarks.push({ title, url: currentUrl });
      saveBookmarks(bookmarks);
      showToast(`⭐ Adicionado aos favoritos: ${title}`);
    }
  }

  // Bookmark Modal Elements
  const btnAddBookmarkManual = document.getElementById('btn-add-bookmark-manual');
  const bookmarkModal = document.getElementById('bookmark-modal');
  const btnCloseBookmarkModal = document.getElementById('btn-close-bookmark-modal');
  const btnCancelBookmark = document.getElementById('btn-cancel-bookmark');
  const btnSaveBookmark = document.getElementById('btn-save-bookmark');
  const bookmarkTitleInput = document.getElementById('bookmark-title-input');
  const bookmarkUrlInput = document.getElementById('bookmark-url-input');

  if (btnAddBookmarkManual) {
    btnAddBookmarkManual.addEventListener('click', () => {
      const targetQuad = quadrants.find(q => q.id === lastFocusedQuadId) || quadrants[0];
      const url = targetQuad ? (targetQuad.webview.getURL() || targetQuad.urlInput.value || '') : '';
      const title = targetQuad ? (targetQuad.webview.getTitle() || '') : '';
      bookmarkTitleInput.value = (title && title !== 'about:blank') ? title : '';
      bookmarkUrlInput.value = (url && url !== 'about:blank') ? url : 'https://';
      bookmarkModal.classList.remove('hidden');
      bookmarkTitleInput.focus();
    });
  }

  function closeBookmarkModal() {
    if (bookmarkModal) bookmarkModal.classList.add('hidden');
  }

  if (btnCloseBookmarkModal) btnCloseBookmarkModal.addEventListener('click', closeBookmarkModal);
  if (btnCancelBookmark) btnCancelBookmark.addEventListener('click', closeBookmarkModal);

  if (btnSaveBookmark) {
    btnSaveBookmark.addEventListener('click', () => {
      const title = bookmarkTitleInput.value.trim() || 'Jogo Favorito';
      let url = bookmarkUrlInput.value.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      const bookmarks = getBookmarks();
      bookmarks.push({ title, url });
      saveBookmarks(bookmarks);
      closeBookmarkModal();
      showToast(`⭐ Favorito salvo: ${title}`);
    });
  }

  // Render initial bookmarks
  renderBookmarks();

  // ================= Global Controls =================
  const btnOptionsMenu = document.getElementById('btn-options-menu');
  const optionsMenu = document.getElementById('options-menu');

  function closeAllDropdowns() {
    if (optionsMenu) optionsMenu.classList.add('hidden');
  }

  const btnExportBackup = document.getElementById('btn-export-backup');
  const btnImportBackupTrigger = document.getElementById('btn-import-backup-trigger');
  const backupFileInput = document.getElementById('backup-file-input');

  const btnGlobalMute = document.getElementById('btn-global-mute');
  const globalMuteIcon = document.getElementById('global-mute-icon');
  const btnGlobalReload = document.getElementById('btn-global-reload');
  const screenCountBtns = document.querySelectorAll('.btn-screen-count');
  const quadrantsViewport = document.getElementById('quadrants-viewport');
  const btnWinMaximize = document.getElementById('btn-win-maximize');
  const btnMiniWidget = document.getElementById('btn-mini-widget');
  const fpsPills = document.querySelectorAll('.fps-pill');

  // Notes Elements
  const btnToggleNotes = document.getElementById('btn-toggle-notes');
  const notesDrawer = document.getElementById('notes-drawer');
  const btnCloseNotes = document.getElementById('btn-close-notes');
  const notesTabs = document.querySelectorAll('.notes-tab');
  const notesContent = document.getElementById('notes-content');
  const notesCharCount = document.getElementById('notes-char-count');
  const btnCopyNotes = document.getElementById('btn-copy-notes');
  const btnClearNotes = document.getElementById('btn-clear-notes');

  let currentNoteTab = 'general';

  // Options Menu Toggle
  if (btnOptionsMenu && optionsMenu) {
    btnOptionsMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      optionsMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      closeAllDropdowns();
    });

    optionsMenu.addEventListener('click', (e) => e.stopPropagation());
  }

  // ================= Custom Presets Feature =================
  const customPresetModal = document.getElementById('custom-preset-modal');
  const btnClosePresetModal = document.getElementById('btn-close-preset-modal');
  const btnPresetModalClose = document.getElementById('btn-preset-modal-close');
  const btnSaveCurrentPreset = document.getElementById('btn-save-current-preset');
  const btnOpenPresetManager = document.getElementById('btn-open-preset-manager');
  const btnAutofillCurrentScreens = document.getElementById('btn-autofill-current-screens');
  const presetEditIdInput = document.getElementById('preset-edit-id');
  const presetFormModeTitle = document.getElementById('preset-form-mode-title');
  const presetNameInput = document.getElementById('preset-name-input');
  const presetScreenOptBtns = document.querySelectorAll('.preset-screen-opt');
  const presetUrlInputs = [
    document.getElementById('preset-url-1'),
    document.getElementById('preset-url-2'),
    document.getElementById('preset-url-3'),
    document.getElementById('preset-url-4')
  ];
  const slotFieldEls = [
    document.getElementById('slot-field-1'),
    document.getElementById('slot-field-2'),
    document.getElementById('slot-field-3'),
    document.getElementById('slot-field-4')
  ];
  const btnCancelPresetForm = document.getElementById('btn-cancel-preset-form');
  const btnSavePresetSubmit = document.getElementById('btn-save-preset-submit');
  const optionsPresetsList = document.getElementById('options-presets-list');
  const modalPresetsList = document.getElementById('modal-presets-list');
  const presetTotalBadge = document.getElementById('preset-total-badge');

  let formSelectedScreens = 4;

  function getUserPresets() {
    try {
      const data = localStorage.getItem('4nav_custom_presets_v2');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
      // Migrate legacy preset if exists
      const legacy = localStorage.getItem('4nav_custom_preset');
      if (legacy) {
        const urls = JSON.parse(legacy);
        if (Array.isArray(urls) && urls.length > 0) {
          const migrated = [{
            id: 'preset_legacy_' + Date.now(),
            name: 'Meu Preset Salvo',
            screens: 4,
            urls: urls.slice(0, 4),
            updatedAt: Date.now()
          }];
          localStorage.setItem('4nav_custom_presets_v2', JSON.stringify(migrated));
          localStorage.removeItem('4nav_custom_preset');
          return migrated;
        }
      }
    } catch (_) {}
    return [];
  }

  function saveUserPresets(presets) {
    try {
      localStorage.setItem('4nav_custom_presets_v2', JSON.stringify(presets));
    } catch (_) {}
  }

  function applyPreset(preset) {
    if (!preset) return;
    const targetScreens = Math.max(1, Math.min(4, Number(preset.screens) || 4));
    setScreenCount(targetScreens);

    const urls = Array.isArray(preset.urls) ? preset.urls : [];
    for (let i = 0; i < targetScreens; i++) {
      const url = urls[i];
      if (quadrants[i] && url && url !== 'about:blank') {
        quadrants[i].navigateTo(url);
      }
    }

    if (optionsMenu) optionsMenu.classList.add('hidden');
    if (customPresetModal) customPresetModal.classList.add('hidden');
    showToast(`Preset "${preset.name || 'Personalizado'}" carregado com sucesso (${targetScreens} tela${targetScreens > 1 ? 's' : ''})!`);
  }

  function setFormScreenCount(count) {
    formSelectedScreens = Math.max(1, Math.min(4, Number(count) || 4));
    presetScreenOptBtns.forEach(btn => {
      const sc = Number(btn.getAttribute('data-screens')) || 4;
      btn.classList.toggle('active', sc === formSelectedScreens);
    });
    slotFieldEls.forEach((field, idx) => {
      if (field) {
        field.classList.toggle('disabled', idx >= formSelectedScreens);
      }
    });
  }

  function resetPresetForm() {
    if (presetEditIdInput) presetEditIdInput.value = '';
    if (presetFormModeTitle) presetFormModeTitle.textContent = '➕ Criar Novo Preset';
    if (presetNameInput) presetNameInput.value = '';
    if (btnCancelPresetForm) btnCancelPresetForm.classList.add('hidden');
    presetUrlInputs.forEach(inp => { if (inp) inp.value = ''; });
    setFormScreenCount(4);
  }

  function autofillCurrentScreens() {
    const openQuads = quadrants.filter(q => !q.isClosed);
    const count = Math.max(1, Math.min(4, openQuads.length || 4));
    setFormScreenCount(count);

    quadrants.forEach((q, idx) => {
      if (presetUrlInputs[idx]) {
        if (!q.isClosed) {
          const url = (q.webview && q.webview.getURL ? q.webview.getURL() : '') || (q.urlInput ? q.urlInput.value : '');
          presetUrlInputs[idx].value = (url && url !== 'about:blank') ? url : '';
        } else {
          presetUrlInputs[idx].value = '';
        }
      }
    });
  }

  function openPresetModal() {
    if (customPresetModal) {
      renderPresetsUI();
      customPresetModal.classList.remove('hidden');
    }
  }

  function closePresetModal() {
    if (customPresetModal) {
      customPresetModal.classList.add('hidden');
      resetPresetForm();
    }
  }

  function editPreset(p) {
    if (!p) return;
    if (presetEditIdInput) presetEditIdInput.value = p.id;
    if (presetFormModeTitle) presetFormModeTitle.textContent = `✏️ Editar Preset: ${p.name}`;
    if (presetNameInput) {
      presetNameInput.value = p.name;
      presetNameInput.focus();
    }
    if (btnCancelPresetForm) btnCancelPresetForm.classList.remove('hidden');

    const screens = Math.max(1, Math.min(4, Number(p.screens) || 4));
    setFormScreenCount(screens);

    const urls = Array.isArray(p.urls) ? p.urls : [];
    for (let i = 0; i < 4; i++) {
      if (presetUrlInputs[i]) {
        presetUrlInputs[i].value = urls[i] || '';
      }
    }

    const formSection = document.getElementById('preset-form-section');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function deletePreset(id, name) {
    if (!confirm(`Deseja realmente excluir o preset "${name}"?`)) return;
    const presets = getUserPresets().filter(p => p.id !== id);
    saveUserPresets(presets);
    if (presetEditIdInput && presetEditIdInput.value === id) {
      resetPresetForm();
    }
    renderPresetsUI();
    showToast(`🗑️ Preset "${name}" excluído.`);
  }

  function renderPresetsUI() {
    const presets = getUserPresets();

    // 1. Render in Options Menu dropdown
    if (optionsPresetsList) {
      if (presets.length === 0) {
        optionsPresetsList.innerHTML = `
          <div class="preset-empty-hint">
            Nenhum preset personalizado ainda.<br>Clique em <strong>Salvar Telas Atuais</strong> para criar seu primeiro preset.
          </div>
        `;
      } else {
        optionsPresetsList.innerHTML = '';
        presets.forEach(p => {
          const btn = document.createElement('button');
          btn.className = 'preset-chip-item';
          btn.title = `Carregar preset "${p.name}" (${p.screens || 4} Telas)`;
          btn.innerHTML = `
            <div class="preset-chip-meta">
              <span>🎮</span>
              <span class="preset-chip-name">${escapeHtml(p.name)}</span>
            </div>
            <span class="preset-badge-screens">${p.screens || 4} Telas</span>
          `;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            applyPreset(p);
          });
          optionsPresetsList.appendChild(btn);
        });
      }
    }

    // 2. Render in Modal List
    if (presetTotalBadge) {
      presetTotalBadge.textContent = `${presets.length} salvo${presets.length === 1 ? '' : 's'}`;
    }

    if (modalPresetsList) {
      if (presets.length === 0) {
        modalPresetsList.innerHTML = `
          <div class="preset-empty-hint" style="padding: 24px;">
            🎮 Nenhum preset salvo ainda. Use o formulário acima ou clique em "Copiar Telas Abertas" para criar o seu primeiro preset de jogos!
          </div>
        `;
      } else {
        modalPresetsList.innerHTML = '';
        presets.forEach(p => {
          const item = document.createElement('div');
          item.className = 'modal-preset-item';

          const validUrls = (p.urls || []).slice(0, p.screens || 4).filter(u => u && u !== 'about:blank');
          const urlsHtml = validUrls.map(u => `<span class="preset-url-chip" title="${escapeHtml(u)}">${escapeHtml(u)}</span>`).join('') || '<span class="preset-url-chip" style="opacity:0.5;">(Sem URLs)</span>';

          item.innerHTML = `
            <div class="modal-preset-info">
              <div class="modal-preset-title-row">
                <span class="modal-preset-name">${escapeHtml(p.name)}</span>
                <span class="preset-badge-screens">${p.screens || 4} Telas</span>
              </div>
              <div class="modal-preset-urls-preview">
                ${urlsHtml}
              </div>
            </div>
            <div class="modal-preset-actions">
              <button class="btn btn-secondary btn-sm btn-apply" title="Aplicar preset no navegador">🚀 Aplicar</button>
              <button class="btn btn-secondary btn-sm btn-edit" title="Editar este preset">✏️</button>
              <button class="btn btn-secondary btn-sm btn-delete text-danger" title="Excluir preset">🗑️</button>
            </div>
          `;

          item.querySelector('.btn-apply').addEventListener('click', () => {
            applyPreset(p);
          });

          item.querySelector('.btn-edit').addEventListener('click', () => {
            editPreset(p);
          });

          item.querySelector('.btn-delete').addEventListener('click', () => {
            deletePreset(p.id, p.name);
          });

          modalPresetsList.appendChild(item);
        });
      }
    }
  }

  // Preset listeners & bindings
  if (btnSaveCurrentPreset) {
    btnSaveCurrentPreset.addEventListener('click', () => {
      if (optionsMenu) optionsMenu.classList.add('hidden');
      resetPresetForm();
      autofillCurrentScreens();
      if (presetNameInput) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR');
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        presetNameInput.value = `Preset ${dateStr} ${timeStr}`;
      }
      openPresetModal();
      if (presetNameInput) {
        presetNameInput.focus();
        presetNameInput.select();
      }
    });
  }

  if (btnOpenPresetManager) {
    btnOpenPresetManager.addEventListener('click', () => {
      if (optionsMenu) optionsMenu.classList.add('hidden');
      openPresetModal();
    });
  }

  if (btnClosePresetModal) {
    btnClosePresetModal.addEventListener('click', closePresetModal);
  }

  if (btnPresetModalClose) {
    btnPresetModalClose.addEventListener('click', closePresetModal);
  }

  if (btnAutofillCurrentScreens) {
    btnAutofillCurrentScreens.addEventListener('click', () => {
      autofillCurrentScreens();
      showToast('⚡ URLs e telas abertas copiadas para o formulário!');
    });
  }

  presetScreenOptBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sc = Number(btn.getAttribute('data-screens')) || 4;
      setFormScreenCount(sc);
    });
  });

  if (btnCancelPresetForm) {
    btnCancelPresetForm.addEventListener('click', () => {
      resetPresetForm();
    });
  }

  if (btnSavePresetSubmit) {
    btnSavePresetSubmit.addEventListener('click', () => {
      const name = presetNameInput ? presetNameInput.value.trim() : '';
      if (!name) {
        showToast('⚠️ Digite um nome para o seu preset.');
        if (presetNameInput) presetNameInput.focus();
        return;
      }

      const urls = [];
      let hasAtLeastOneUrl = false;
      for (let i = 0; i < formSelectedScreens; i++) {
        const val = presetUrlInputs[i] ? presetUrlInputs[i].value.trim() : '';
        urls.push(val);
        if (val && val !== 'about:blank') {
          hasAtLeastOneUrl = true;
        }
      }

      if (!hasAtLeastOneUrl) {
        showToast('⚠️ Informe ao menos uma URL válida para o preset.');
        return;
      }

      const presets = getUserPresets();
      const editId = presetEditIdInput ? presetEditIdInput.value.trim() : '';

      if (editId) {
        const existingIdx = presets.findIndex(p => p.id === editId);
        if (existingIdx !== -1) {
          presets[existingIdx].name = name;
          presets[existingIdx].screens = formSelectedScreens;
          presets[existingIdx].urls = urls;
          presets[existingIdx].updatedAt = Date.now();
          showToast(`✅ Preset "${name}" atualizado com sucesso!`);
        } else {
          presets.unshift({
            id: 'preset_' + Date.now(),
            name,
            screens: formSelectedScreens,
            urls,
            updatedAt: Date.now()
          });
          showToast(`✅ Preset "${name}" salvo com sucesso!`);
        }
      } else {
        presets.unshift({
          id: 'preset_' + Date.now(),
          name,
          screens: formSelectedScreens,
          urls,
          updatedAt: Date.now()
        });
        showToast(`✅ Preset "${name}" salvo com sucesso!`);
      }

      saveUserPresets(presets);
      resetPresetForm();
      renderPresetsUI();
    });
  }

  // Initial render of user presets in options dropdown
  renderPresetsUI();

  // ================= Backup & Restore Saves =================
  btnExportBackup.addEventListener('click', async () => {
    if (optionsMenu) optionsMenu.classList.add('hidden');
    showToast('Extraindo saves dos 4 jogos...');

    const backupPayload = {
      app: '4Navigator',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      slots: []
    };

    for (const q of quadrants) {
      const url = q.webview.getURL() || q.urlInput.value || '';
      let storageData = {};
      try {
        const jsonStr = await q.webview.executeJavaScript('JSON.stringify(localStorage)');
        storageData = JSON.parse(jsonStr || '{}');
      } catch (_) {}

      backupPayload.slots.push({
        id: q.id,
        url,
        localStorage: storageData
      });
    }

    // Trigger download
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = blobUrl;
    a.download = `4navigator-saves-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    showToast('💾 Backup exportado com sucesso!');
  });

  btnImportBackupTrigger.addEventListener('click', () => {
    if (optionsMenu) optionsMenu.classList.add('hidden');
    backupFileInput.click();
  });

  backupFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.slots || !Array.isArray(parsed.slots)) {
          showToast('❌ Arquivo de backup inválido.');
          return;
        }

        showToast('Restaurando saves e reiniciando jogos...');
        for (const slot of parsed.slots) {
          const q = quadrants.find(item => item.id === slot.id);
          if (q) {
            if (slot.url && slot.url !== 'about:blank') {
              q.navigateTo(slot.url);
            }
            if (slot.localStorage && Object.keys(slot.localStorage).length > 0) {
              const injectScript = `
                (()=>{
                  const data = ${JSON.stringify(slot.localStorage)};
                  for (const key in data) {
                    try { localStorage.setItem(key, data[key]); } catch(e){}
                  }
                })()
              `;
              try {
                await q.webview.executeJavaScript(injectScript);
                setTimeout(() => q.reload(), 500);
              } catch (_) {}
            }
          }
        }
        showToast('✅ Saves restaurados com sucesso!');
      } catch (err) {
        showToast('❌ Erro ao processar arquivo de backup.');
      }
    };
    reader.readAsText(file);
    backupFileInput.value = '';
  });

  // Global Mute Toggle
  btnGlobalMute.addEventListener('click', () => {
    isGlobalMuted = !isGlobalMuted;
    quadrants.forEach(q => q.setMuted(isGlobalMuted));
    globalMuteIcon.textContent = isGlobalMuted ? '🔇' : '🔊';
    btnGlobalMute.innerHTML = `${isGlobalMuted ? '🔇' : '🔊'} ${isGlobalMuted ? 'Ativar Áudios' : 'Silenciar Tudo'}`;
    showToast(isGlobalMuted ? 'Todos os painéis silenciados' : 'Áudio restaurado em todos os painéis');
  });

  // Global Reload
  btnGlobalReload.addEventListener('click', () => {
    quadrants.forEach(q => q.reload());
    showToast('Reiniciando os 4 jogos...');
  });

  // ================= Screen Count Selector & Layout Management =================
  const btnGlobalHome = document.getElementById('btn-global-home');
  const quadrantsEmptyState = document.getElementById('quadrants-empty-state');
  const btnReopenQuadrant = document.getElementById('btn-reopen-quadrant');

  let currentScreenCount = Number(localStorage.getItem('4nav_screen_count')) || 4;

  function updateGridLayout() {
    const openQuadrants = quadrants.filter(q => !q.isClosed);
    const count = openQuadrants.length;

    // Reset inline grid-row overrides
    quadrants.forEach(q => {
      q.el.style.gridRow = '';
      q.el.style.gridColumn = '';
    });

    if (quadrantsEmptyState) {
      quadrantsEmptyState.classList.toggle('hidden', count > 0);
    }

    if (count === 0) {
      if (quadrantsViewport) {
        quadrantsViewport.className = 'quadrants-grid layout-screens-0';
      }
      screenCountBtns.forEach(btn => btn.classList.remove('active'));
      return;
    }

    if (quadrantsViewport) {
      quadrantsViewport.className = `quadrants-grid layout-screens-${count}`;
    }

    // 3 screens layout: first visible quadrant spans 2 rows
    if (count === 3 && openQuadrants[0]) {
      openQuadrants[0].el.style.gridRow = 'span 2';
    }

    // Update screen count selector buttons (1, 2, 3, 4)
    screenCountBtns.forEach(btn => {
      const btnScreens = Number(btn.getAttribute('data-screens'));
      btn.classList.toggle('active', btnScreens === count);
    });

    // Update HUD slots visibility
    quadrants.forEach(q => {
      const slotEl = document.getElementById(`hud-p${q.id}`);
      if (slotEl) {
        slotEl.classList.toggle('hidden', q.isClosed);
      }
    });

    localStorage.setItem('4nav_screen_count', count);
  }

  function setScreenCount(targetCount) {
    const count = Math.max(1, Math.min(4, Number(targetCount) || 4));

    quadrants.forEach((q, idx) => {
      if (idx < count) {
        q.isClosed = false;
        q.el.classList.remove('is-closed');
      } else {
        // Really close excess screens
        q.close();
      }
    });

    updateGridLayout();

    const labels = {
      1: '1 Tela Cheia (Solo)',
      2: '2 Telas Divididas (Lado a Lado)',
      3: '3 Telas (1 Principal + 2)',
      4: '4 Telas (Grade 2x2)'
    };
    showToast(`Visualização: ${labels[count] || count + ' Telas'}`);
  }

  screenCountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const count = Number(btn.getAttribute('data-screens')) || 4;
      setScreenCount(count);
    });
  });

  if (btnGlobalHome) {
    btnGlobalHome.addEventListener('click', () => {
      const active = quadrants.filter(q => !q.isClosed);
      if (active.length === 0) {
        setScreenCount(1);
      } else {
        active.forEach(q => q.goHome());
        showToast('Todos os painéis retornaram à tela inicial');
      }
    });
  }

  if (btnReopenQuadrant) {
    btnReopenQuadrant.addEventListener('click', () => {
      setScreenCount(1);
    });
  }

  // Apply initial screen count preference
  const savedScreenCount = Number(localStorage.getItem('4nav_screen_count')) || 4;
  quadrants.forEach((q, idx) => {
    if (idx >= savedScreenCount) {
      q.isClosed = true;
      q.el.classList.add('is-closed');
    } else {
      q.isClosed = false;
      q.el.classList.remove('is-closed');
    }
  });
  updateGridLayout();

  // Mini-Widget Mode
  btnMiniWidget.addEventListener('click', async () => {
    if (window.navigatorAPI && window.navigatorAPI.toggleMiniWidget) {
      const isMini = await window.navigatorAPI.toggleMiniWidget();
      document.body.classList.toggle('mini-widget-mode', isMini);
      btnMiniWidget.classList.toggle('active', isMini);
      showToast(isMini ? '📌 Modo Mini-Widget Ativo (Always-on-Top)' : 'Modo Normal Restaurado');
    }
  });

  // FPS Limiter with interactive pills
  fpsPills.forEach(pill => {
    pill.addEventListener('click', async () => {
      const fps = Number(pill.getAttribute('data-fps')) || 60;
      fpsPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      if (window.navigatorAPI && window.navigatorAPI.setFpsLimit) {
        await window.navigatorAPI.setFpsLimit(fps);
        showToast(`⚡ Taxa de quadros ajustada para ${fps} FPS`);
      }
    });
  });

  // Smart FPS / Background Sleeping Tabs Toggle & Listeners
  const toggleSmartFps = document.getElementById('toggle-smart-fps');
  if (toggleSmartFps) {
    toggleSmartFps.checked = smartFpsEnabled;
    toggleSmartFps.addEventListener('change', () => {
      smartFpsEnabled = toggleSmartFps.checked;
      localStorage.setItem('4nav_smart_fps', smartFpsEnabled);
      updateSmartFpsThrottling();
      showToast(smartFpsEnabled 
        ? '⚡ Smart FPS ativado: painéis em segundo plano rodam a 5-10 FPS' 
        : '⚡ Smart FPS desativado: todos os painéis em 60 FPS contínuo');
    });
  }

  window.addEventListener('focus', () => {
    updateSmartFpsThrottling();
  });
  window.addEventListener('blur', () => {
    updateSmartFpsThrottling();
  });

  // Initial update
  updateSmartFpsThrottling();

  // ================= GPU Hardware Acceleration Logic =================
  const toggleGpuAccel = document.getElementById('toggle-gpu-accel');
  const gpuRestartNotice = document.getElementById('gpu-restart-notice');
  const btnRelaunchApp = document.getElementById('btn-relaunch-app');
  let initialGpuState = true;

  if (window.navigatorAPI && window.navigatorAPI.getGpuStatus) {
    window.navigatorAPI.getGpuStatus().then(status => {
      initialGpuState = status.gpuAcceleration !== false;
      if (toggleGpuAccel) {
        toggleGpuAccel.checked = initialGpuState;
      }
    }).catch(() => {});
  }

  if (toggleGpuAccel) {
    toggleGpuAccel.addEventListener('change', async () => {
      const isEnabled = toggleGpuAccel.checked;
      if (window.navigatorAPI && window.navigatorAPI.setGpuStatus) {
        await window.navigatorAPI.setGpuStatus(isEnabled);
      }

      // Show restart prompt if the state differs from current runtime state
      if (isEnabled !== initialGpuState) {
        gpuRestartNotice?.classList.remove('hidden');
        showToast(isEnabled ? '🖥️ GPU Acelerada ligada! Reinicie para aplicar.' : '🖥️ GPU Acelerada desligada! Reinicie para aplicar.');
      } else {
        gpuRestartNotice?.classList.add('hidden');
      }
    });
  }

  if (btnRelaunchApp) {
    btnRelaunchApp.addEventListener('click', () => {
      if (window.navigatorAPI && window.navigatorAPI.relaunch) {
        showToast('Reiniciando 4Navigator...');
        setTimeout(() => {
          window.navigatorAPI.relaunch();
        }, 300);
      }
    });
  }

  // ================= Notes Drawer Logic (Persistent on Disk & localStorage) =================
  let cachedNotes = {
    general: '',
    p1: '',
    p2: '',
    p3: '',
    p4: '',
    lastTab: 'general'
  };
  let saveNotesDebounceTimer = null;

  async function initPersistentNotes() {
    // 1. First load from localStorage for instant display
    ['general', 'p1', 'p2', 'p3', 'p4'].forEach(tab => {
      const localVal = localStorage.getItem(`4nav_notes_${tab}`);
      if (localVal) cachedNotes[tab] = localVal;
    });

    // 2. Fetch from persistent disk storage (portable 4Navigator-Data or installed userData)
    if (window.navigatorAPI?.notes?.getAll) {
      try {
        const diskNotes = await window.navigatorAPI.notes.getAll();
        if (diskNotes && typeof diskNotes === 'object') {
          ['general', 'p1', 'p2', 'p3', 'p4'].forEach(tab => {
            if (diskNotes[tab] !== undefined && diskNotes[tab] !== null) {
              cachedNotes[tab] = diskNotes[tab];
              localStorage.setItem(`4nav_notes_${tab}`, diskNotes[tab]);
            } else if (cachedNotes[tab]) {
              diskNotes[tab] = cachedNotes[tab];
            }
          });
          if (diskNotes.lastTab) {
            currentNoteTab = diskNotes.lastTab;
          }
        }
      } catch (err) {
        console.error('Error loading notes from disk:', err);
      }
    }

    // Activate the saved tab
    notesTabs.forEach(t => {
      const isTab = t.getAttribute('data-tab') === currentNoteTab;
      t.classList.toggle('active', isTab);
    });
    loadNote(currentNoteTab);
  }

  function loadNote(tab) {
    const text = cachedNotes[tab] !== undefined ? cachedNotes[tab] : (localStorage.getItem(`4nav_notes_${tab}`) || '');
    notesContent.value = text;
    notesCharCount.textContent = `${text.length} caracteres`;
  }

  function queueSaveNotes() {
    cachedNotes[currentNoteTab] = notesContent.value;
    cachedNotes.lastTab = currentNoteTab;
    localStorage.setItem(`4nav_notes_${currentNoteTab}`, notesContent.value);
    notesCharCount.textContent = `${notesContent.value.length} caracteres`;

    clearTimeout(saveNotesDebounceTimer);
    saveNotesDebounceTimer = setTimeout(async () => {
      if (window.navigatorAPI?.notes?.saveAll) {
        await window.navigatorAPI.notes.saveAll(cachedNotes);
      }
    }, 350);
  }

  btnToggleNotes.addEventListener('click', () => {
    notesDrawer.classList.toggle('hidden');
    loadNote(currentNoteTab);
  });

  btnCloseNotes.addEventListener('click', () => {
    notesDrawer.classList.add('hidden');
  });

  notesTabs.forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      // Save current active tab text before switching
      cachedNotes[currentNoteTab] = notesContent.value;
      localStorage.setItem(`4nav_notes_${currentNoteTab}`, notesContent.value);

      notesTabs.forEach(t => t.classList.remove('active'));
      tabBtn.classList.add('active');
      currentNoteTab = tabBtn.getAttribute('data-tab');
      cachedNotes.lastTab = currentNoteTab;

      loadNote(currentNoteTab);
      queueSaveNotes();
    });
  });

  notesContent.addEventListener('input', () => {
    queueSaveNotes();
  });

  // Right-Click Context Menu on Notes Textarea
  notesContent.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    notesContent.focus();
    if (window.navigatorAPI?.notes?.showContextMenu) {
      window.navigatorAPI.notes.showContextMenu();
    }
  });

  // Context menu triggered actions
  if (window.navigatorAPI?.notes?.onTriggerCopyAll) {
    window.navigatorAPI.notes.onTriggerCopyAll(async () => {
      if (!notesContent.value) return;
      try {
        await navigator.clipboard.writeText(notesContent.value);
        showToast('📋 Todas as anotações desta aba foram copiadas!');
      } catch (_) {
        showToast('❌ Erro ao copiar anotações.');
      }
    });
  }

  if (window.navigatorAPI?.notes?.onTriggerClear) {
    window.navigatorAPI.notes.onTriggerClear(() => {
      if (confirm('Deseja realmente limpar as anotações desta aba?')) {
        notesContent.value = '';
        queueSaveNotes();
        showToast('Anotações limpas.');
      }
    });
  }

  btnCopyNotes.addEventListener('click', async () => {
    if (!notesContent.value) return;
    try {
      await navigator.clipboard.writeText(notesContent.value);
      showToast('📋 Anotações copiadas para a área de transferência!');
    } catch (_) {
      showToast('❌ Erro ao copiar');
    }
  });

  btnClearNotes.addEventListener('click', () => {
    if (confirm('Deseja limpar as anotações desta aba?')) {
      notesContent.value = '';
      queueSaveNotes();
      showToast('Anotações limpas.');
    }
  });

  // Initialize persistent notes immediately
  initPersistentNotes();

  // Fullscreen / Window Toggle
  if (btnWinMaximize && window.navigatorAPI) {
    btnWinMaximize.addEventListener('click', async () => {
      await window.navigatorAPI.toggleMaximize();
    });
  }

  // Auto-restore last session or load default classics
  const lastSession = localStorage.getItem('4nav_last_session');
  if (lastSession) {
    try {
      const urls = JSON.parse(lastSession);
      const hasAnyValid = urls.some(u => u && u !== 'about:blank');
      if (hasAnyValid) {
        loadPreset(urls);
      }
    } catch (_) {}
  }

  // ================= Resource & RAM Monitor HUD =================
  const hudValTotal = document.getElementById('hud-val-total');
  const btnCleanRam = document.getElementById('btn-clean-ram');

  async function updateResourceHud() {
    if (!window.navigatorAPI || !window.navigatorAPI.getMetrics) return;
    try {
      const data = await window.navigatorAPI.getMetrics();
      if (!data) return;

      if (hudValTotal) {
        hudValTotal.textContent = `${data.totalMB} MB`;
      }

      for (let i = 0; i < 4; i++) {
        const q = quadrants[i];
        const valEl = document.getElementById(`hud-val-${i + 1}`);
        if (!valEl) continue;

        if (q && q.isClosed) {
          valEl.textContent = 'Fechado';
          continue;
        }

        let pid = null;
        try {
          pid = q.webview.getProcessId();
        } catch (_) {}

        if (pid) {
          const proc = data.processes.find(p => p.pid === pid);
          if (proc) {
            valEl.textContent = `${proc.memoryMB} MB (${proc.cpuPercent}%)`;
          } else {
            valEl.textContent = (q.webview.src && q.webview.src !== 'about:blank') ? 'Ativo' : 'Ocioso';
          }
        } else {
          valEl.textContent = (q.webview.src && q.webview.src !== 'about:blank') ? 'Ativo' : 'Ocioso';
        }
      }
    } catch (_) {}
  }

  // Poll metrics every 2.5 seconds
  setInterval(updateResourceHud, 2500);
  setTimeout(updateResourceHud, 1000);

  if (btnCleanRam) {
    btnCleanRam.addEventListener('click', async () => {
      if (window.navigatorAPI && window.navigatorAPI.clearCache) {
        await window.navigatorAPI.clearCache();
        showToast('🧹 Cache e buffers de memória otimizados!');
        setTimeout(updateResourceHud, 500);
      }
    });
  }

  // ================= Credentials & Autofill System =================
  let activeCredQuad = null;
  let allVaultCredentials = [];

  // DOM Elements - Quick Modal
  const quickCredModal = document.getElementById('credentials-quick-modal');
  const btnCloseQuickCred = document.getElementById('btn-close-quick-cred');
  const btnCancelQuickCred = document.getElementById('btn-cancel-quick-cred');
  const btnSaveQuickCred = document.getElementById('btn-save-quick-cred');
  const btnQuickAutofillApply = document.getElementById('btn-quick-autofill-apply');
  const credDomainInput = document.getElementById('cred-domain-input');
  const credUsernameInput = document.getElementById('cred-username-input');
  const credPasswordInput = document.getElementById('cred-password-input');
  const btnToggleCredPass = document.getElementById('btn-toggle-cred-pass');
  const credQuickAutofillSection = document.getElementById('cred-quick-autofill-section');

  // DOM Elements - Vault Management Modal
  const btnOpenVaultModal = document.getElementById('btn-open-vault-modal');
  const vaultModal = document.getElementById('credentials-vault-modal');
  const btnCloseVaultModal = document.getElementById('btn-close-vault-modal');
  const btnVaultClose = document.getElementById('btn-vault-close');
  const vaultSearchInput = document.getElementById('vault-search-input');
  const btnVaultAddManual = document.getElementById('btn-vault-add-manual');
  const vaultListContainer = document.getElementById('vault-list-container');

  // DOM Elements - Master PIN & Vault Security Modals (Feature 2)
  const btnVaultSecurityPin = document.getElementById('btn-vault-security-pin');
  const vaultPinModal = document.getElementById('vault-pin-modal');
  const btnClosePinModal = document.getElementById('btn-close-pin-modal');
  const btnCancelPinModal = document.getElementById('btn-cancel-pin-modal');
  const btnSubmitPinModal = document.getElementById('btn-submit-pin-modal');
  const vaultPinInput = document.getElementById('vault-pin-input');
  const vaultPinError = document.getElementById('vault-pin-error');

  const vaultSetPinModal = document.getElementById('vault-set-pin-modal');
  const setPinModalTitle = document.getElementById('set-pin-modal-title');
  const btnCloseSetPinModal = document.getElementById('btn-close-set-pin-modal');
  const setPinCurrentGroup = document.getElementById('set-pin-current-group');
  const setPinCurrentInput = document.getElementById('set-pin-current-input');
  const setPinNewInput = document.getElementById('set-pin-new-input');
  const setPinConfirmInput = document.getElementById('set-pin-confirm-input');
  const setPinError = document.getElementById('set-pin-error');
  const btnRemovePin = document.getElementById('btn-remove-pin');
  const btnCancelSetPin = document.getElementById('btn-cancel-set-pin');
  const btnSaveSetPin = document.getElementById('btn-save-set-pin');

  let isVaultUnlocked = false;
  let vaultInactivityTimer = null;
  let pendingUnlockResolver = null;
  const VAULT_INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes auto-lock

  function resetVaultInactivityTimer() {
    if (vaultInactivityTimer) clearTimeout(vaultInactivityTimer);
    if (!isVaultUnlocked) return;
    vaultInactivityTimer = setTimeout(() => {
      isVaultUnlocked = false;
      if (vaultModal && !vaultModal.classList.contains('hidden')) {
        vaultModal.classList.add('hidden');
        showToast('🔒 Cofre de senhas bloqueado automaticamente por inatividade.');
      }
    }, VAULT_INACTIVITY_LIMIT);
  }

  // Activity in vault modal resets inactivity countdown
  vaultModal?.addEventListener('mousemove', resetVaultInactivityTimer);
  vaultModal?.addEventListener('keydown', resetVaultInactivityTimer);

  async function ensureVaultUnlocked() {
    if (!window.navigatorAPI?.vaultSecurity?.hasMasterPin) return true;
    try {
      const hasPin = await window.navigatorAPI.vaultSecurity.hasMasterPin();
      if (!hasPin) return true;
      if (isVaultUnlocked) {
        resetVaultInactivityTimer();
        return true;
      }

      return new Promise((resolve) => {
        pendingUnlockResolver = resolve;
        if (vaultPinInput) vaultPinInput.value = '';
        if (vaultPinError) vaultPinError.classList.add('hidden');
        if (vaultPinModal) vaultPinModal.classList.remove('hidden');
        setTimeout(() => vaultPinInput?.focus(), 100);
      });
    } catch (_) {
      return true;
    }
  }

  function closeUnlockPinModal(success = false) {
    if (vaultPinModal) vaultPinModal.classList.add('hidden');
    if (pendingUnlockResolver) {
      pendingUnlockResolver(success);
      pendingUnlockResolver = null;
    }
  }

  btnClosePinModal?.addEventListener('click', () => closeUnlockPinModal(false));
  btnCancelPinModal?.addEventListener('click', () => closeUnlockPinModal(false));

  async function handleUnlockSubmit() {
    const pin = (vaultPinInput?.value || '').trim();
    if (!pin) {
      if (vaultPinError) {
        vaultPinError.textContent = 'Por favor, digite o PIN de acesso.';
        vaultPinError.classList.remove('hidden');
      }
      return;
    }

    try {
      const res = await window.navigatorAPI.vaultSecurity.verifyMasterPin(pin);
      if (res && res.success) {
        isVaultUnlocked = true;
        resetVaultInactivityTimer();
        closeUnlockPinModal(true);
        showToast('🔓 Cofre de senhas desbloqueado com sucesso!');
      } else {
        if (vaultPinError) {
          vaultPinError.textContent = res?.error || 'PIN incorreto. Tente novamente.';
          vaultPinError.classList.remove('hidden');
        }
        if (vaultPinInput) {
          vaultPinInput.value = '';
          vaultPinInput.focus();
        }
      }
    } catch (err) {
      if (vaultPinError) {
        vaultPinError.textContent = 'Erro ao verificar PIN: ' + err.message;
        vaultPinError.classList.remove('hidden');
      }
    }
  }

  btnSubmitPinModal?.addEventListener('click', handleUnlockSubmit);
  vaultPinInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleUnlockSubmit();
  });

  // Helper to extract clean domain from URL
  function extractDomain(url) {
    if (!url || url === 'about:blank') return '';
    try {
      const parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
      return parsed.hostname.replace(/^www\./i, '');
    } catch (_) {
      return url.replace(/^https?:\/\//i, '').split('/')[0];
    }
  }

  // Update quadrant toolbar key buttons indicator
  async function updateCredentialButtons() {
    if (!window.navigatorAPI?.credentials?.getForUrl) return;
    for (const q of quadrants) {
      if (!q.btnCredentials) continue;
      const currentUrl = (q.webview.getURL() || q.urlInput.value || '').trim();
      if (!currentUrl || currentUrl === 'about:blank') {
        q.btnCredentials.classList.remove('has-credentials');
        q.btnCredentials.title = 'Logins & Senhas Salvas deste Jogo';
        continue;
      }

      try {
        const matches = await window.navigatorAPI.credentials.getForUrl(currentUrl);
        if (matches && matches.length > 0) {
          q.btnCredentials.classList.add('has-credentials');
          q.btnCredentials.title = `🔑 ${matches.length} conta(s) salva(s) para este jogo. Clique para ver ou preencher.`;
        } else {
          q.btnCredentials.classList.remove('has-credentials');
          q.btnCredentials.title = 'Salvar login ou senha para este jogo';
        }
      } catch (_) {}
    }
  }

  // Open Quick Modal to save or autofill credentials for a quadrant
  async function openQuickCredentialsModal(quad, manualDomain = '') {
    activeCredQuad = quad;
    const currentUrl = (quad?.webview?.getURL() || quad?.urlInput?.value || '').trim();
    const domain = manualDomain !== '' ? manualDomain : extractDomain(currentUrl);

    if (!quickCredModal) return;

    credDomainInput.value = domain;
    credDomainInput.readOnly = manualDomain === '' && Boolean(domain);
    credUsernameInput.value = '';
    credPasswordInput.value = '';
    credPasswordInput.type = 'password';
    if (btnToggleCredPass) btnToggleCredPass.textContent = '👁️';

    if (domain && window.navigatorAPI?.credentials?.getForUrl) {
      try {
        const matches = await window.navigatorAPI.credentials.getForUrl(currentUrl || `https://${domain}`);
        if (matches && matches.length > 0) {
          const first = matches[0];
          credUsernameInput.value = first.username || '';
          credPasswordInput.value = first.password || '';
          credQuickAutofillSection?.classList.remove('hidden');
        } else {
          credQuickAutofillSection?.classList.add('hidden');
        }
      } catch (_) {
        credQuickAutofillSection?.classList.add('hidden');
      }
    } else {
      credQuickAutofillSection?.classList.add('hidden');
    }

    quickCredModal.classList.remove('hidden');
    if (!credUsernameInput.value) {
      credUsernameInput.focus();
    } else {
      credPasswordInput.focus();
    }
  }

  function closeQuickCredentialsModal() {
    if (quickCredModal) quickCredModal.classList.add('hidden');
  }

  // Toggle password visibility
  if (btnToggleCredPass && credPasswordInput) {
    btnToggleCredPass.addEventListener('click', () => {
      if (credPasswordInput.type === 'password') {
        credPasswordInput.type = 'text';
        btnToggleCredPass.textContent = '🔒';
      } else {
        credPasswordInput.type = 'password';
        btnToggleCredPass.textContent = '👁️';
      }
    });
  }

  // Close buttons for quick modal
  btnCloseQuickCred?.addEventListener('click', closeQuickCredentialsModal);
  btnCancelQuickCred?.addEventListener('click', closeQuickCredentialsModal);

  // Save credential
  if (btnSaveQuickCred) {
    btnSaveQuickCred.addEventListener('click', async () => {
      const domain = (credDomainInput?.value || '').trim();
      const username = (credUsernameInput?.value || '').trim();
      const password = credPasswordInput?.value || '';

      if (!domain) {
        showToast('⚠️ Por favor, informe o domínio ou jogo.');
        return;
      }
      if (!password) {
        showToast('⚠️ Por favor, digite a senha.');
        return;
      }

      try {
        await window.navigatorAPI.credentials.save({ domain, username, password });
        showToast(`🔑 Credencial para "${username || domain}" salva com sucesso!`);
        closeQuickCredentialsModal();
        updateCredentialButtons();

        if (vaultModal && !vaultModal.classList.contains('hidden')) {
          await loadVaultList();
        }
      } catch (err) {
        showToast(`Erro ao salvar senha: ${err.message || err}`);
      }
    });
  }

  // Autofill webview helper
  async function autofillFormInWebview(webview, username, password) {
    if (!webview) return { success: false, reason: 'no-webview' };
    const code = `
      (() => {
        const passInputs = Array.from(document.querySelectorAll('input[type="password"]'));
        if (passInputs.length === 0) return { success: false, reason: 'no-password-field' };

        const passInput = passInputs[0];
        passInput.focus();
        passInput.value = ${JSON.stringify(password)};
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.dispatchEvent(new Event('change', { bubbles: true }));

        const form = passInput.closest('form');
        let userInput = null;

        if (form) {
          userInput = form.querySelector('input[type="text"], input[type="email"], input[name*="user"], input[name*="login"], input[name*="email"], input[autocomplete*="username"]');
        }
        if (!userInput) {
          userInput = document.querySelector('input[type="text"], input[type="email"], input[name*="user"], input[name*="login"], input[name*="email"], input[autocomplete*="username"]');
        }

        if (userInput) {
          userInput.focus();
          userInput.value = ${JSON.stringify(username)};
          userInput.dispatchEvent(new Event('input', { bubbles: true }));
          userInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        passInput.focus();
        return { success: true };
      })()
    `;

    try {
      const result = await webview.executeJavaScript(code);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Quick autofill button click
  if (btnQuickAutofillApply) {
    btnQuickAutofillApply.addEventListener('click', async () => {
      if (!activeCredQuad) return;
      const username = (credUsernameInput?.value || '').trim();
      const password = credPasswordInput?.value || '';

      const res = await autofillFormInWebview(activeCredQuad.webview, username, password);
      if (res && res.success) {
        showToast(`⚡ Login preenchido no Painel ${activeCredQuad.id}!`);
        closeQuickCredentialsModal();
      } else {
        showToast('⚠️ Nenhum campo de senha encontrado nesta página.');
      }
    });
  }

  // Vault Modal Functions
  async function loadVaultList() {
    if (!window.navigatorAPI?.credentials?.getAll) return;
    try {
      allVaultCredentials = await window.navigatorAPI.credentials.getAll();
      renderVaultList();
    } catch (err) {
      console.error('Failed to load vault credentials:', err);
    }
  }

  function renderVaultList() {
    if (!vaultListContainer) return;
    const filter = (vaultSearchInput?.value || '').trim().toLowerCase();

    const filtered = allVaultCredentials.filter(c => {
      const dom = (c.domain || '').toLowerCase();
      const usr = (c.username || '').toLowerCase();
      return dom.includes(filter) || usr.includes(filter);
    });

    vaultListContainer.innerHTML = '';

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'vault-empty-state';
      empty.innerHTML = `
        <span class="vault-empty-icon">🔐</span>
        <strong>Nenhum login salvo encontrado</strong>
        <span>Suas contas e senhas salvas para os jogos aparecerão aqui.</span>
      `;
      vaultListContainer.appendChild(empty);
      return;
    }

    filtered.forEach(cred => {
      const item = document.createElement('div');
      item.className = 'vault-item';

      const dateStr = cred.updatedAt ? new Date(cred.updatedAt).toLocaleDateString() : '';

      item.innerHTML = `
        <div class="vault-item-info">
          <div class="vault-item-domain">
            <span>🎮</span> <span>${escapeHtml(cred.domain || 'Site')}</span>
          </div>
          <div class="vault-item-user">
            👤 ${escapeHtml(cred.username || 'Sem usuário')}
          </div>
          ${dateStr ? `<div class="vault-item-date">Salvo em ${dateStr}</div>` : ''}
        </div>
        <div class="vault-item-actions">
          <button class="btn-vault-action btn-vault-copy" title="Copiar Senha">
            <span>📋</span> Copiar Senha
          </button>
          <button class="btn-vault-action btn-vault-delete" title="Excluir Login">
            <span>🗑️</span>
          </button>
        </div>
      `;

      // Copy password action
      const btnCopy = item.querySelector('.btn-vault-copy');
      btnCopy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(cred.password);
          btnCopy.innerHTML = '<span>✅</span> Copiado!';
          showToast(`Senha de "${cred.username || cred.domain}" copiada!`);
          setTimeout(() => {
            btnCopy.innerHTML = '<span>📋</span> Copiar Senha';
          }, 2000);
        } catch (_) {
          showToast('Erro ao copiar senha para a área de transferência.');
        }
      });

      // Delete action
      const btnDel = item.querySelector('.btn-vault-delete');
      btnDel.addEventListener('click', async () => {
        if (confirm(`Deseja remover o login "${cred.username}" do jogo ${cred.domain}?`)) {
          await window.navigatorAPI.credentials.delete(cred.id);
          showToast('Login removido do cofre com sucesso!');
          await loadVaultList();
          updateCredentialButtons();
        }
      });

      vaultListContainer.appendChild(item);
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[s]));
  }

  // Open Vault Modal from Options dropdown (protected by Master PIN if configured)
  if (btnOpenVaultModal) {
    btnOpenVaultModal.addEventListener('click', async () => {
      if (optionsMenu) optionsMenu.classList.add('hidden');
      const unlocked = await ensureVaultUnlocked();
      if (!unlocked) return;
      if (vaultModal) vaultModal.classList.remove('hidden');
      if (vaultSearchInput) vaultSearchInput.value = '';
      await loadVaultList();
    });
  }

  // Close Vault Modal
  btnCloseVaultModal?.addEventListener('click', () => {
    if (vaultModal) vaultModal.classList.add('hidden');
  });
  btnVaultClose?.addEventListener('click', () => {
    if (vaultModal) vaultModal.classList.add('hidden');
  });

  // Search filter
  vaultSearchInput?.addEventListener('input', () => {
    renderVaultList();
  });

  // Add manual credential from Vault
  btnVaultAddManual?.addEventListener('click', () => {
    openQuickCredentialsModal(quadrants[0], '');
    if (credDomainInput) {
      credDomainInput.readOnly = false;
      credDomainInput.placeholder = 'Ex: melvoridle.com';
      credDomainInput.focus();
    }
  });

  // Master PIN Configuration & Management (Feature 2)
  if (btnVaultSecurityPin) {
    btnVaultSecurityPin.addEventListener('click', async () => {
      try {
        const hasPin = await window.navigatorAPI.vaultSecurity.hasMasterPin();
        if (setPinModalTitle) {
          setPinModalTitle.textContent = hasPin ? '🔒 Alterar PIN Mestre' : '🔒 Ativar PIN Mestre';
        }
        if (setPinCurrentGroup) {
          if (hasPin) setPinCurrentGroup.classList.remove('hidden');
          else setPinCurrentGroup.classList.add('hidden');
        }
        if (btnRemovePin) {
          if (hasPin) btnRemovePin.classList.remove('hidden');
          else btnRemovePin.classList.add('hidden');
        }
        if (btnSaveSetPin) {
          btnSaveSetPin.textContent = hasPin ? 'Atualizar PIN' : 'Ativar PIN';
        }
        if (setPinCurrentInput) setPinCurrentInput.value = '';
        if (setPinNewInput) setPinNewInput.value = '';
        if (setPinConfirmInput) setPinConfirmInput.value = '';
        if (setPinError) setPinError.classList.add('hidden');
        if (vaultSetPinModal) vaultSetPinModal.classList.remove('hidden');
        setTimeout(() => {
          if (hasPin) setPinCurrentInput?.focus();
          else setPinNewInput?.focus();
        }, 100);
      } catch (err) {
        showToast('Erro ao carregar status do PIN: ' + err.message);
      }
    });
  }

  btnCloseSetPinModal?.addEventListener('click', () => vaultSetPinModal?.classList.add('hidden'));
  btnCancelSetPin?.addEventListener('click', () => vaultSetPinModal?.classList.add('hidden'));

  btnSaveSetPin?.addEventListener('click', async () => {
    const hasPin = await window.navigatorAPI.vaultSecurity.hasMasterPin();
    const curr = (setPinCurrentInput?.value || '').trim();
    const next = (setPinNewInput?.value || '').trim();
    const conf = (setPinConfirmInput?.value || '').trim();

    if (hasPin && !curr) {
      if (setPinError) {
        setPinError.textContent = 'Digite o seu PIN atual para prosseguir.';
        setPinError.classList.remove('hidden');
      }
      return;
    }
    if (next.length < 4 || next.length > 12) {
      if (setPinError) {
        setPinError.textContent = 'O novo PIN deve ter entre 4 e 12 caracteres/dígitos.';
        setPinError.classList.remove('hidden');
      }
      return;
    }
    if (next !== conf) {
      if (setPinError) {
        setPinError.textContent = 'A confirmação do novo PIN não confere.';
        setPinError.classList.remove('hidden');
      }
      return;
    }

    try {
      const res = await window.navigatorAPI.vaultSecurity.setMasterPin({ currentPin: curr, newPin: next });
      if (res && res.success) {
        isVaultUnlocked = true;
        resetVaultInactivityTimer();
        vaultSetPinModal.classList.add('hidden');
        showToast('✅ PIN Mestre configurado com sucesso!');
      } else {
        if (setPinError) {
          setPinError.textContent = res?.error || 'Erro ao definir PIN Mestre.';
          setPinError.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (setPinError) {
        setPinError.textContent = 'Falha: ' + err.message;
        setPinError.classList.remove('hidden');
      }
    }
  });

  btnRemovePin?.addEventListener('click', async () => {
    const curr = (setPinCurrentInput?.value || '').trim();
    if (!curr) {
      if (setPinError) {
        setPinError.textContent = 'Digite o seu PIN atual no campo acima para remover a proteção.';
        setPinError.classList.remove('hidden');
      }
      setPinCurrentInput?.focus();
      return;
    }

    try {
      const res = await window.navigatorAPI.vaultSecurity.removeMasterPin(curr);
      if (res && res.success) {
        isVaultUnlocked = false;
        vaultSetPinModal.classList.add('hidden');
        showToast('🔓 Proteção por PIN Mestre removida.');
      } else {
        if (setPinError) {
          setPinError.textContent = res?.error || 'PIN incorreto. Não foi possível remover.';
          setPinError.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (setPinError) {
        setPinError.textContent = 'Falha: ' + err.message;
        setPinError.classList.remove('hidden');
      }
    }
  });

  // Feature 5: Download Guard - Intercept dangerous executable files
  if (window.navigatorAPI?.security?.onDownloadBlocked) {
    window.navigatorAPI.security.onDownloadBlocked((data) => {
      const filename = data?.filename || 'arquivo executável';
      showToast(`🛡️ Download Bloqueado: "${filename}" é um executável de alto risco proibido por segurança.`, 6000);
    });
  }

  // ================= Anti-Cryptojacking & Miner Protection Logic =================
  const minerModal = document.getElementById('miner-history-modal');
  const btnOpenMinerModal = document.getElementById('btn-open-miner-modal');
  const btnCloseMinerModal = document.getElementById('btn-close-miner-modal');
  const btnMinerModalClose = document.getElementById('btn-miner-modal-close');
  const minerLogsContainer = document.getElementById('miner-logs-container');
  const minerTotalCount = document.getElementById('miner-total-count');
  const optionsMinerBadge = document.getElementById('options-miner-badge');
  const btnClearMinerLogs = document.getElementById('btn-clear-miner-logs');
  const btnSimulateMiner = document.getElementById('btn-simulate-miner');

  function openMinerModal() {
    closeAllDropdowns();
    if (minerModal) {
      minerModal.classList.remove('hidden');
      loadMinerStatus();
    }
  }

  function closeMinerModal() {
    if (minerModal) {
      minerModal.classList.add('hidden');
    }
  }

  function renderMinerLogs(logs) {
    if (!minerLogsContainer) return;
    const count = (logs && Array.isArray(logs)) ? logs.length : 0;

    if (minerTotalCount) {
      minerTotalCount.textContent = count;
    }

    if (optionsMinerBadge) {
      if (count > 0) {
        optionsMinerBadge.textContent = count;
        optionsMinerBadge.classList.remove('hidden');
      } else {
        optionsMinerBadge.classList.add('hidden');
      }
    }

    if (!logs || logs.length === 0) {
      minerLogsContainer.innerHTML = `
        <div class="miner-empty-state">
          <div class="miner-empty-icon">🛡️✨</div>
          <strong>Nenhuma tentativa de mineração detectada!</strong>
          <p>Seus 4 quadrantes estão monitorados em tempo real. Se algum site tentar rodar scripts de cryptojacking (Coinhive, CryptoLoot, Monero), o bloqueio ocorrerá imediatamente e o alerta será registrado aqui.</p>
        </div>
      `;
      return;
    }

    minerLogsContainer.innerHTML = logs.map(item => {
      const slotNum = item.slot || 1;
      return `
        <div class="miner-log-card">
          <div class="miner-log-top">
            <div class="miner-log-meta">
              <span class="slot-badge slot-${slotNum}">${escapeHtml(item.slotLabel || 'Painel ' + slotNum)}</span>
              <span class="miner-log-origin">${escapeHtml(item.siteOrigin || 'Site')}</span>
              <span class="miner-threat-badge">${escapeHtml(item.threatName || 'Cryptominer')}</span>
            </div>
            <span class="miner-log-time">${escapeHtml(item.dateFormatted || '')} às ${escapeHtml(item.timeFormatted || '')}</span>
          </div>
          <div class="miner-log-url" title="${escapeHtml(item.blockedUrl || '')}">
            <span class="url-label">Script Bloqueado:</span>
            <code>${escapeHtml(item.blockedUrl || '')}</code>
          </div>
          <div class="miner-log-action">
            <span class="badge-blocked">🛡️ Requisição Neutralizada na Rede</span>
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadMinerStatus() {
    if (!window.navigatorAPI?.security?.getMinerLogs) return;
    try {
      const res = await window.navigatorAPI.security.getMinerLogs();
      if (res && res.logs) {
        renderMinerLogs(res.logs);
      }
    } catch (err) {
      console.error('Failed to load miner status:', err);
    }
  }

  // Intercept real-time miner blocked event
  if (window.navigatorAPI?.security?.onMinerBlocked) {
    window.navigatorAPI.security.onMinerBlocked((data) => {
      const panelLabel = data?.slotLabel || (data?.slot ? `Painel ${data.slot}` : 'Navegador');
      const threatName = data?.threatName || 'Cryptojacking';
      showToast(`🛡️ ALERTA DE MINERAÇÃO: Tentativa de cryptojacking bloqueada no ${panelLabel}! (${threatName})`, 7000);

      // Trigger visual alert button in quadrant toolbar if slot is available
      if (data?.slot) {
        const quadElement = document.getElementById(`quadrant-${data.slot}`);
        if (quadElement) {
          const alertBtn = quadElement.querySelector('.btn-miner-alert');
          if (alertBtn) {
            alertBtn.classList.remove('hidden');
          }
        }
      }

      loadMinerStatus();
    });
  }

  // Modal triggers
  btnOpenMinerModal?.addEventListener('click', openMinerModal);
  btnCloseMinerModal?.addEventListener('click', closeMinerModal);
  btnMinerModalClose?.addEventListener('click', closeMinerModal);

  // Quadrant alert button clicks
  document.querySelectorAll('.btn-miner-alert').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMinerModal();
    });
  });

  // Clear logs button
  btnClearMinerLogs?.addEventListener('click', async () => {
    if (!window.navigatorAPI?.security?.clearMinerLogs) return;
    try {
      await window.navigatorAPI.security.clearMinerLogs();
      document.querySelectorAll('.btn-miner-alert').forEach(btn => btn.classList.add('hidden'));
      renderMinerLogs([]);
      showToast('🧹 Histórico de tentativas de mineração limpo com sucesso.');
    } catch (err) {
      showToast('Erro ao limpar histórico: ' + err.message);
    }
  });

  // Simulate miner detection for testing
  btnSimulateMiner?.addEventListener('click', async () => {
    if (!window.navigatorAPI?.security?.simulateMinerDetection) return;
    try {
      const targetSlot = lastFocusedQuadId || 1;
      await window.navigatorAPI.security.simulateMinerDetection({ slot: targetSlot });
    } catch (err) {
      showToast('Erro ao simular detecção: ' + err.message);
    }
  });

  // Close miner modal on background click
  minerModal?.addEventListener('click', (e) => {
    if (e.target === minerModal) closeMinerModal();
  });

  // Initial load of miner status to populate badge
  setTimeout(loadMinerStatus, 1200);

  // Initial check of credential indicators
  setTimeout(updateCredentialButtons, 1500);

  // ================= Online Resilience & Cloak Logic =================
  const toggleAutoReconnect = document.getElementById('toggle-auto-reconnect');
  const toggleKeepAlive = document.getElementById('toggle-keep-alive');
  const watchdogStatusText = document.getElementById('watchdog-status-text');
  const watchdogReconnectBadge = document.getElementById('watchdog-reconnect-badge');
  const toggleBrowserCloak = document.getElementById('toggle-browser-cloak');
  const cloakUaHint = document.getElementById('cloak-ua-hint');

  function updateWatchdogUI() {
    if (watchdogStatusText) {
      if (onlineSettings.autoReconnect) {
        watchdogStatusText.textContent = '🟢 Sentinela 24/7 Ativo';
        watchdogStatusText.style.color = '#10b981';
      } else {
        watchdogStatusText.textContent = '⚪ Sentinela Desativado';
        watchdogStatusText.style.color = 'var(--text-muted)';
      }
    }
    if (watchdogReconnectBadge) {
      watchdogReconnectBadge.textContent = `${totalWatchdogReconnections} ${totalWatchdogReconnections === 1 ? 'reconexão' : 'reconexões'}`;
    }
  }

  // Initial load of online settings from backend
  if (window.navigatorAPI?.online?.getSettings) {
    window.navigatorAPI.online.getSettings().then(cfg => {
      if (cfg) {
        onlineSettings.autoReconnect = cfg.autoReconnect !== false;
        onlineSettings.keepAlive = cfg.keepAlive !== false;
        onlineSettings.browserCloak = cfg.browserCloak !== false;
        if (toggleAutoReconnect) toggleAutoReconnect.checked = onlineSettings.autoReconnect;
        if (toggleKeepAlive) toggleKeepAlive.checked = onlineSettings.keepAlive;
        if (toggleBrowserCloak) toggleBrowserCloak.checked = onlineSettings.browserCloak;
        if (cloakUaHint) {
          cloakUaHint.textContent = onlineSettings.browserCloak
            ? 'Identificação: Google Chrome Desktop (Sem rastros de Electron)'
            : 'Identificação: Padrão Electron (Camuflagem desligada)';
        }
        updateWatchdogUI();
      }
    }).catch(() => {});
  }

  toggleAutoReconnect?.addEventListener('change', () => {
    onlineSettings.autoReconnect = toggleAutoReconnect.checked;
    window.navigatorAPI?.online?.saveSettings({ autoReconnect: onlineSettings.autoReconnect });
    updateWatchdogUI();
    showToast(onlineSettings.autoReconnect ? '🛡️ Sentinela Anti-Queda Ativado' : 'Sentinela Anti-Queda Desativado');
  });

  toggleKeepAlive?.addEventListener('change', () => {
    onlineSettings.keepAlive = toggleKeepAlive.checked;
    window.navigatorAPI?.online?.saveSettings({ keepAlive: onlineSettings.keepAlive });
    showToast(onlineSettings.keepAlive ? '⚡ Keep-Alive Anti-AFK Ativado' : 'Keep-Alive Anti-AFK Desativado');
  });

  toggleBrowserCloak?.addEventListener('change', () => {
    onlineSettings.browserCloak = toggleBrowserCloak.checked;
    window.navigatorAPI?.online?.saveSettings({ browserCloak: onlineSettings.browserCloak });
    if (cloakUaHint) {
      cloakUaHint.textContent = onlineSettings.browserCloak
        ? 'Identificação: Google Chrome Desktop (Sem rastros de Electron)'
        : 'Identificação: Padrão Electron (Camuflagem desligada)';
    }
    showToast(onlineSettings.browserCloak ? '🎭 Camuflagem Chrome Ativada (Requer reiniciar ou recarregar os jogos)' : 'Camuflagem Chrome Desativada');
  });

  // Feature 2: In-Game Reconnect Button Auto-Clicker Scanner (Every 12s)
  setInterval(() => {
    if (!onlineSettings.autoReconnect) return;
    quadrants.forEach(quad => {
      if (quad.isClosed || !quad.webview || !quad.webview.getURL() || quad.webview.getURL() === 'about:blank') return;
      quad.webview.executeJavaScript(`
        (() => {
          try {
            const reconnectKeywords = [
              'reconnect', 'reconectar', 'try again', 'tentar novamente',
              'recarregar', 'reload game', 'resume game', 'reconnecting', 'play again'
            ];
            const buttons = Array.from(document.querySelectorAll('button, a, .btn, [role="button"], input[type="button"], input[type="submit"]'));
            for (const btn of buttons) {
              const text = (btn.innerText || btn.textContent || btn.value || '').trim().toLowerCase();
              if (reconnectKeywords.some(kw => text === kw || text.includes(kw))) {
                const rect = btn.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(btn).display !== 'none' && window.getComputedStyle(btn).visibility !== 'hidden') {
                  btn.click();
                  return true;
                }
              }
            }
          } catch (_) {}
          return false;
        })()
      `).then(clicked => {
        if (clicked) {
          totalWatchdogReconnections++;
          sessionStorage.setItem('4nav_reconnect_count', String(totalWatchdogReconnections));
          updateWatchdogUI();
          showToast(`⚡ [Sentinela P${quad.id}] Sessão reconectada automaticamente no jogo!`, 3500);
        }
      }).catch(() => {});
    });
  }, 12000);

  // Feature 3: Anti-AFK Keep-Alive Pulse (Every 3 minutes)
  setInterval(() => {
    if (!onlineSettings.keepAlive) return;
    quadrants.forEach(quad => {
      if (quad.isClosed || !quad.webview || !quad.webview.getURL() || quad.webview.getURL() === 'about:blank') return;
      quad.webview.executeJavaScript(`
        try {
          window.dispatchEvent(new Event('focus'));
          document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10 }));
        } catch (_) {}
      `).catch(() => {});
    });
  }, 180000);

  // Global Escape key handler to close modals & dropdowns gracefully
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (optionsMenu && !optionsMenu.classList.contains('hidden')) {
        closeAllDropdowns();
        return;
      }
      if (customPresetModal && !customPresetModal.classList.contains('hidden')) {
        closePresetModal();
        return;
      }
      const bookmarkModal = document.getElementById('bookmark-modal');
      if (bookmarkModal && !bookmarkModal.classList.contains('hidden')) {
        bookmarkModal.classList.add('hidden');
        return;
      }
      const credQuickModal = document.getElementById('credentials-quick-modal');
      if (credQuickModal && !credQuickModal.classList.contains('hidden')) {
        credQuickModal.classList.add('hidden');
        return;
      }
      if (vaultModal && !vaultModal.classList.contains('hidden')) {
        vaultModal.classList.add('hidden');
        return;
      }
      const pinModal = document.getElementById('vault-pin-modal');
      if (pinModal && !pinModal.classList.contains('hidden')) {
        closeUnlockPinModal(false);
        return;
      }
      const setPinModal = document.getElementById('vault-set-pin-modal');
      if (setPinModal && !setPinModal.classList.contains('hidden')) {
        setPinModal.classList.add('hidden');
        return;
      }
      if (minerModal && !minerModal.classList.contains('hidden')) {
        closeMinerModal();
        return;
      }
      if (updaterModal && !updaterModal.classList.contains('hidden')) {
        closeUpdaterModal();
        return;
      }
      if (notesDrawer && notesDrawer.classList.contains('open')) {
        notesDrawer.classList.remove('open');
        return;
      }
    }
  });

  // ================= Auto-Updater Logic =================
  const btnCheckUpdates = document.getElementById('btn-check-updates');
  const updaterBadgeDot = document.getElementById('updater-badge-dot');
  const updaterModal = document.getElementById('updater-modal');
  const btnCloseUpdaterModal = document.getElementById('btn-close-updater-modal');
  const btnUpdaterCancel = document.getElementById('btn-updater-cancel');
  const btnUpdaterAction = document.getElementById('btn-updater-action');
  const updaterCurrVersion = document.getElementById('updater-curr-version');
  const updaterTargetVersion = document.getElementById('updater-target-version');
  const updaterNewVersion = document.getElementById('updater-new-version');
  const updaterStatusMessage = document.getElementById('updater-status-message');
  const updaterProgressContainer = document.getElementById('updater-progress-container');
  const updaterProgressBar = document.getElementById('updater-progress-bar');
  const updaterProgressPercent = document.getElementById('updater-progress-percent');
  const updaterProgressSpeed = document.getElementById('updater-progress-speed');
  const updaterNotesContainer = document.getElementById('updater-notes-container');
  const updaterReleaseNotes = document.getElementById('updater-release-notes');

  let updaterCurrentState = 'idle'; // idle | checking | available | downloading | downloaded | error
  let localCurrentVersion = '';

  // Ensure updater badge is hidden by default
  if (updaterBadgeDot) {
    updaterBadgeDot.classList.add('hidden');
    updaterBadgeDot.style.display = 'none';
  }

  // Fetch current version on load
  if (window.navigatorAPI?.updater?.getCurrentVersion) {
    window.navigatorAPI.updater.getCurrentVersion().then(ver => {
      localCurrentVersion = ver || '';
      if (updaterCurrVersion && ver) updaterCurrVersion.textContent = `v${ver}`;
    }).catch(() => {});
  }

  function openUpdaterModal() {
    if (updaterModal) updaterModal.classList.remove('hidden');
  }

  function closeUpdaterModal() {
    if (updaterModal) updaterModal.classList.add('hidden');
  }

  if (btnCheckUpdates) {
    btnCheckUpdates.addEventListener('click', () => {
      openUpdaterModal();
      if (updaterCurrentState === 'idle' || updaterCurrentState === 'error') {
        triggerCheckForUpdates();
      }
    });
  }

  if (btnCloseUpdaterModal) btnCloseUpdaterModal.addEventListener('click', closeUpdaterModal);
  if (btnUpdaterCancel) btnUpdaterCancel.addEventListener('click', closeUpdaterModal);

  async function triggerCheckForUpdates() {
    if (!window.navigatorAPI?.updater?.check) {
      showToast('⚠️ Atualizações automáticas não disponíveis em modo de desenvolvimento.');
      return;
    }
    updaterCurrentState = 'checking';
    updaterStatusMessage.textContent = 'Verificando atualizações no GitHub...';
    btnUpdaterAction.disabled = true;
    btnUpdaterAction.textContent = 'Verificando...';
    updaterProgressContainer.classList.add('hidden');
    updaterNotesContainer.classList.add('hidden');

    try {
      const res = await window.navigatorAPI.updater.check();
      if (!res.success && res.error) {
        updaterCurrentState = 'error';
        const is404 = String(res.error).includes('404');
        updaterStatusMessage.textContent = is404
          ? 'Nenhum pacote de atualização encontrado no GitHub para esta versão.'
          : `Não foi possível verificar: ${res.error}`;
        btnUpdaterAction.disabled = false;
        btnUpdaterAction.textContent = 'Tentar Novamente';
      }
    } catch (err) {
      updaterCurrentState = 'error';
      updaterStatusMessage.textContent = `Erro ao verificar atualizações: ${err.message || err}`;
      btnUpdaterAction.disabled = false;
      btnUpdaterAction.textContent = 'Tentar Novamente';
    }
  }

  let isAppPortable = false;
  if (window.navigatorAPI?.updater?.getAppInfo) {
    window.navigatorAPI.updater.getAppInfo().then(info => {
      if (info) isAppPortable = Boolean(info.isPortable);
    }).catch(() => {});
  }

  if (btnUpdaterAction) {
    btnUpdaterAction.addEventListener('click', async () => {
      if (updaterCurrentState === 'idle' || updaterCurrentState === 'error' || updaterCurrentState === 'not-available') {
        await triggerCheckForUpdates();
      } else if (updaterCurrentState === 'available') {
        if (isAppPortable) {
          // Portable version: open direct release download in default browser to avoid AppData temp lock
          await window.navigatorAPI.updater.openDownloadUrl('https://github.com/LuanUpSIDE/4Navigator/releases/latest');
          showToast('🌐 Abrindo página de download da versão portátil...');
        } else {
          // Installed NSIS version: silent in-app background download
          updaterCurrentState = 'downloading';
          btnUpdaterAction.disabled = true;
          btnUpdaterAction.textContent = 'Baixando...';
          updaterStatusMessage.textContent = 'Baixando nova versão em segundo plano...';
          updaterProgressContainer.classList.remove('hidden');
          updaterProgressBar.style.width = '0%';
          updaterProgressPercent.textContent = '0%';
          try {
            await window.navigatorAPI.updater.download();
          } catch (e) {
            updaterCurrentState = 'error';
            updaterStatusMessage.textContent = `Erro no download: ${e.message || e}`;
            btnUpdaterAction.disabled = false;
            btnUpdaterAction.textContent = 'Tentar Novamente';
          }
        }
      } else if (updaterCurrentState === 'downloaded') {
        updaterStatusMessage.textContent = 'Reiniciando o 4Navigator para aplicar a atualização...';
        btnUpdaterAction.disabled = true;
        btnUpdaterAction.textContent = 'Instalando...';
        setTimeout(() => {
          window.navigatorAPI?.updater?.install();
        }, 800);
      }
    });
  }

  // Listen to main process updater events
  if (window.navigatorAPI?.updater?.onStatus) {
    window.navigatorAPI.updater.onStatus((data) => {
      if (!data) return;
      if (data.isPortable !== undefined) isAppPortable = Boolean(data.isPortable);

      switch (data.state) {
        case 'checking':
          updaterCurrentState = 'checking';
          updaterStatusMessage.textContent = 'Conectando ao repositório para verificar novidades...';
          btnUpdaterAction.disabled = true;
          btnUpdaterAction.textContent = 'Verificando...';
          break;

        case 'available': {
          const currentClean = (localCurrentVersion || updaterCurrVersion?.textContent || '').replace(/^v/, '').trim();
          const remoteClean = (data.version || '').replace(/^v/, '').trim();

          // If current version is already equal or newer, do not show badge
          if (currentClean && remoteClean && currentClean === remoteClean) {
            updaterCurrentState = 'not-available';
            if (updaterBadgeDot) {
              updaterBadgeDot.classList.add('hidden');
              updaterBadgeDot.style.display = 'none';
            }
            updaterTargetVersion?.classList.add('hidden');
            updaterStatusMessage.textContent = 'O 4Navigator já está na versão mais recente disponível! 🎉';
            btnUpdaterAction.disabled = false;
            btnUpdaterAction.textContent = 'Verificar Novamente';
            break;
          }

          updaterCurrentState = 'available';
          if (updaterBadgeDot) {
            updaterBadgeDot.classList.remove('hidden');
            updaterBadgeDot.style.display = 'block';
          }
          updaterTargetVersion?.classList.remove('hidden');
          if (updaterNewVersion && data.version) updaterNewVersion.textContent = `v${data.version}`;

          if (isAppPortable) {
            updaterStatusMessage.textContent = `Uma nova versão (v${data.version}) foi encontrada! Como você está usando a versão portátil, clique abaixo para baixar o executável atualizado diretamente.`;
            btnUpdaterAction.textContent = 'Baixar Versão Portátil (.exe)';
          } else {
            updaterStatusMessage.textContent = `Uma nova versão (v${data.version}) foi encontrada e pronta para download!`;
            btnUpdaterAction.textContent = 'Baixar Atualização';
          }

          if (data.releaseNotes && updaterReleaseNotes) {
            updaterReleaseNotes.textContent = data.releaseNotes;
            updaterNotesContainer?.classList.remove('hidden');
          }
          btnUpdaterAction.disabled = false;
          showToast(`🚀 Nova versão v${data.version} disponível!`);
          break;
        }

        case 'not-available':
          updaterCurrentState = 'not-available';
          if (updaterBadgeDot) {
            updaterBadgeDot.classList.add('hidden');
            updaterBadgeDot.style.display = 'none';
          }
          updaterTargetVersion?.classList.add('hidden');
          updaterStatusMessage.textContent = 'O 4Navigator já está na versão mais recente disponível! 🎉';
          btnUpdaterAction.disabled = false;
          btnUpdaterAction.textContent = 'Verificar Novamente';
          showToast('✅ Seu navegador está 100% atualizado.');
          break;

        case 'downloading':
          updaterCurrentState = 'downloading';
          updaterProgressContainer?.classList.remove('hidden');
          if (updaterProgressBar && data.percent !== undefined) {
            updaterProgressBar.style.width = `${data.percent}%`;
            updaterProgressPercent.textContent = `${data.percent}%`;
          }
          if (updaterProgressSpeed && data.bytesPerSecond) {
            const kbps = Math.round(data.bytesPerSecond / 1024);
            updaterProgressSpeed.textContent = `${kbps} KB/s`;
          }
          break;

        case 'downloaded':
          updaterCurrentState = 'downloaded';
          updaterProgressContainer?.classList.remove('hidden');
          if (updaterProgressBar) updaterProgressBar.style.width = '100%';
          if (updaterProgressPercent) updaterProgressPercent.textContent = '100%';
          updaterStatusMessage.textContent = 'Download concluído com sucesso! Clique para reiniciar e aplicar agora.';
          btnUpdaterAction.disabled = false;
          btnUpdaterAction.textContent = 'Reiniciar e Atualizar';
          btnUpdaterAction.className = 'btn btn-primary';
          showToast('📦 Atualização pronta para ser instalada!');
          openUpdaterModal();
          break;

        case 'error':
          updaterCurrentState = 'error';
          if (updaterBadgeDot) {
            updaterBadgeDot.classList.add('hidden');
            updaterBadgeDot.style.display = 'none';
          }
          updaterStatusMessage.textContent = data.message || 'Falha na verificação de atualização.';
          btnUpdaterAction.disabled = false;
          btnUpdaterAction.textContent = 'Tentar Novamente';
          break;
      }
    });
  }

  // Optional: Auto-check for updates silently 5 seconds after startup
  setTimeout(() => {
    if (window.navigatorAPI?.updater?.check) {
      window.navigatorAPI.updater.check().catch(() => {});
    }
  }, 5000);

  // Auto-save session and notes on close or page hide
  window.addEventListener('beforeunload', () => {
    const currentUrls = quadrants.map(q => (q.isClosed ? '' : (q.webview.getURL() || q.urlInput.value || '')));
    localStorage.setItem('4nav_last_session', JSON.stringify(currentUrls));

    if (window.navigatorAPI?.notes?.saveAll) {
      cachedNotes[currentNoteTab] = notesContent.value;
      cachedNotes.lastTab = currentNoteTab;
      window.navigatorAPI.notes.saveAll(cachedNotes);
    }
  });
});

// Toast Helper
function showToast(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
