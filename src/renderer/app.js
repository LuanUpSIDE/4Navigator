// 4Navigator — Main Renderer Application Logic

document.addEventListener('DOMContentLoaded', () => {
  const PRESETS = {
    classics: [
      'https://orteil.dashnet.org/cookieclicker/',
      'https://www.decisionproblem.com/paperclips/',
      'https://candybox2.github.io/',
      'https://adarkroom.doublespeakgames.com/'
    ],
    progression: [
      'https://trimps.github.io/',
      'https://pmotschmann.github.io/Evolve/',
      'https://crank.ncase.me/',
      'https://melvoridle.com/'
    ],
    'sci-fi': [
      'https://ivark.github.io/AntimatterDimensions/',
      'https://pseudonian.github.io/SynergismOfficial/',
      'https://sparticle999.github.io/SpaceCompany/',
      'https://swarmsim.github.io/'
    ]
  };

  const quadrants = [];
  let isGlobalMuted = false;
  let lastFocusedQuadId = 1;

  // Initialize Quadrants 1 through 4
  for (let id = 1; id <= 4; id++) {
    const el = document.getElementById(`quadrant-${id}`);
    if (!el) continue;

    const webview = el.querySelector('.game-webview');
    const urlInput = el.querySelector('.url-input');
    const btnGo = el.querySelector('.btn-go');
    const btnBack = el.querySelector('.btn-back');
    const btnForward = el.querySelector('.btn-forward');
    const btnReload = el.querySelector('.btn-reload');
    const btnMute = el.querySelector('.btn-mute');
    const btnBookmark = el.querySelector('.btn-bookmark');
    const btnAutoclick = el.querySelector('.btn-autoclick');
    const autoclickBadge = el.querySelector('.autoclick-badge');
    const btnZoomIn = el.querySelector('.btn-zoom-in');
    const btnZoomOut = el.querySelector('.btn-zoom-out');
    const zoomLevelEl = el.querySelector('.zoom-level');
    const btnDevtools = el.querySelector('.btn-devtools');
    const btnExpand = el.querySelector('.btn-expand');
    const loadingBar = el.querySelector('.loading-bar');
    const emptyState = el.querySelector('.empty-state-overlay');
    const webviewWrapper = el.querySelector('.webview-wrapper');

    let currentZoom = 1.0;
    let autoClickerInterval = null;
    let clickCoords = { x: 200, y: 200 };

    el.addEventListener('focusin', () => { lastFocusedQuadId = id; });
    el.addEventListener('mousedown', () => { lastFocusedQuadId = id; });

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
      btnMute,
      btnBookmark,
      emptyState,
      navigateTo(url) {
        if (!url) return;
        let finalUrl = url.trim();
        if (!/^https?:\/\//i.test(finalUrl)) {
          finalUrl = 'https://' + finalUrl;
        }
        urlInput.value = finalUrl;
        webview.src = finalUrl;
        if (emptyState) emptyState.classList.add('hidden');
      },
      setMuted(muted) {
        webview.setAudioMuted(muted);
        if (muted) {
          btnMute.textContent = '🔇';
          btnMute.classList.add('active-mute');
          btnMute.title = 'Desmutar este jogo';
        } else {
          btnMute.textContent = '🔊';
          btnMute.classList.remove('active-mute');
          btnMute.title = 'Mutar este jogo';
        }
      },
      isMuted() {
        return webview.isAudioMuted();
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

            // DOM backup click
            webview.executeJavaScript(`
              (()=>{
                const el = document.elementFromPoint(${targetX}, ${targetY});
                if (el) el.click();
              })()
            `).catch(() => {});
          }, delay);

          showToast(`Painel ${id}: Auto-Clicker Ativado (${cps} CPS)`);
        }
      }
    };

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

    // Bookmark Action for this quadrant
    if (btnBookmark) {
      btnBookmark.addEventListener('click', () => {
        toggleBookmarkForQuadrant(quad);
      });
    }

    // Auto-Clicker Toggle
    btnAutoclick.addEventListener('click', () => {
      quad.toggleAutoClicker(20);
    });

    // Mute Action
    btnMute.addEventListener('click', () => {
      const willMute = !quad.isMuted();
      quad.setMuted(willMute);
      showToast(`Painel ${id}: ${willMute ? 'Áudio Silenciado' : 'Áudio Ativado'}`);
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

    // Webview Event Listeners
    webview.addEventListener('did-start-loading', () => {
      if (loadingBar) {
        loadingBar.style.opacity = '1';
        loadingBar.style.width = '70%';
      }
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
      }
    });

    webview.addEventListener('did-navigate', (event) => {
      if (event.url && event.url !== 'about:blank') {
        urlInput.value = event.url;
        if (emptyState) emptyState.classList.add('hidden');
        updateBookmarkButtons();
      }
    });

    // Quick suggestion chips
    el.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const targetUrl = chip.getAttribute('data-url');
        quad.navigateTo(targetUrl);
      });
    });

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
  // ================= Global Controls =================
  const btnOptionsMenu = document.getElementById('btn-options-menu');
  const optionsMenu = document.getElementById('options-menu');
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
      optionsMenu.classList.add('hidden');
    });

    optionsMenu.addEventListener('click', (e) => e.stopPropagation());
  }

  // Load Preset Function
  function loadPreset(urls) {
    if (!urls || urls.length === 0) return;
    urls.slice(0, 4).forEach((url, idx) => {
      if (quadrants[idx]) {
        quadrants[idx].navigateTo(url);
      }
    });
    if (optionsMenu) optionsMenu.classList.add('hidden');
  }

  // Built-in presets clicks
  if (optionsMenu) {
    optionsMenu.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-preset');
        const list = PRESETS[key];
        if (list) {
          loadPreset(list);
          showToast(`Preset carregado com sucesso!`);
        }
      });
    });
  }

  // Custom Preset: Save
  const btnSaveCustomPreset = document.getElementById('btn-save-custom-preset');
  if (btnSaveCustomPreset) {
    btnSaveCustomPreset.addEventListener('click', () => {
      const currentUrls = quadrants.map(q => q.webview.getURL() || q.urlInput.value || '');
      localStorage.setItem('4nav_custom_preset', JSON.stringify(currentUrls));
      if (optionsMenu) optionsMenu.classList.add('hidden');
      showToast('💾 Quarteto de jogos atual salvo como seu preset!');
    });
  }

  // Custom Preset: Load
  const btnLoadCustomPreset = document.getElementById('btn-load-custom-preset');
  if (btnLoadCustomPreset) {
    btnLoadCustomPreset.addEventListener('click', () => {
      const saved = localStorage.getItem('4nav_custom_preset');
      if (!saved) {
        showToast('⚠️ Nenhum preset personalizado salvo ainda.');
        return;
      }
      try {
        const urls = JSON.parse(saved);
        loadPreset(urls);
        showToast('📂 Seu preset personalizado foi carregado com sucesso!');
      } catch (e) {
        showToast('❌ Erro ao ler preset salvo.');
      }
    });
  }

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

  // ================= Screen Count Selector (1 to 4 screens) =================
  let currentScreenCount = Number(localStorage.getItem('4nav_screen_count')) || 4;

  function setScreenCount(count) {
    currentScreenCount = Math.max(1, Math.min(4, Number(count) || 4));
    localStorage.setItem('4nav_screen_count', currentScreenCount);

    if (quadrantsViewport) {
      quadrantsViewport.className = `quadrants-grid layout-screens-${currentScreenCount}`;
    }

    // Update active button state
    screenCountBtns.forEach(btn => {
      const btnScreens = Number(btn.getAttribute('data-screens'));
      btn.classList.toggle('active', btnScreens === currentScreenCount);
    });

    // Update HUD slots visibility to match active screen count
    for (let id = 1; id <= 4; id++) {
      const slotEl = document.getElementById(`hud-p${id}`);
      if (slotEl) {
        slotEl.classList.toggle('hidden', id > currentScreenCount);
      }
    }

    const labels = {
      1: '1 Tela Cheia (Solo)',
      2: '2 Telas Divididas (Lado a Lado)',
      3: '3 Telas (1 Principal + 2)',
      4: '4 Telas (Grade 2x2)'
    };
    showToast(`Visualização: ${labels[currentScreenCount]}`);
  }

  screenCountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const count = Number(btn.getAttribute('data-screens')) || 4;
      setScreenCount(count);
    });
  });

  // Apply initial screen count preference
  setScreenCount(currentScreenCount);

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

  // Notes Drawer Logic
  function loadNote(tab) {
    const text = localStorage.getItem(`4nav_notes_${tab}`) || '';
    notesContent.value = text;
    notesCharCount.textContent = `${text.length} caracteres`;
  }

  function saveCurrentNote() {
    localStorage.setItem(`4nav_notes_${currentNoteTab}`, notesContent.value);
    notesCharCount.textContent = `${notesContent.value.length} caracteres`;
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
      notesTabs.forEach(t => t.classList.remove('active'));
      tabBtn.classList.add('active');
      currentNoteTab = tabBtn.getAttribute('data-tab');
      loadNote(currentNoteTab);
    });
  });

  notesContent.addEventListener('input', () => {
    saveCurrentNote();
  });

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
      saveCurrentNote();
      showToast('Anotações limpas.');
    }
  });

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

  // Fetch current version on load
  if (window.navigatorAPI?.updater?.getCurrentVersion) {
    window.navigatorAPI.updater.getCurrentVersion().then(ver => {
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
        updaterStatusMessage.textContent = `Não foi possível verificar: ${res.error}`;
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

  if (btnUpdaterAction) {
    btnUpdaterAction.addEventListener('click', async () => {
      if (updaterCurrentState === 'idle' || updaterCurrentState === 'error' || updaterCurrentState === 'not-available') {
        await triggerCheckForUpdates();
      } else if (updaterCurrentState === 'available') {
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

      switch (data.state) {
        case 'checking':
          updaterCurrentState = 'checking';
          updaterStatusMessage.textContent = 'Conectando ao repositório para verificar novidades...';
          btnUpdaterAction.disabled = true;
          btnUpdaterAction.textContent = 'Verificando...';
          break;

        case 'available':
          updaterCurrentState = 'available';
          updaterBadgeDot?.classList.remove('hidden');
          updaterTargetVersion?.classList.remove('hidden');
          if (updaterNewVersion && data.version) updaterNewVersion.textContent = `v${data.version}`;
          updaterStatusMessage.textContent = `Uma nova versão (v${data.version}) foi encontrada!`;
          if (data.releaseNotes && updaterReleaseNotes) {
            updaterReleaseNotes.textContent = data.releaseNotes;
            updaterNotesContainer?.classList.remove('hidden');
          }
          btnUpdaterAction.disabled = false;
          btnUpdaterAction.textContent = 'Baixar Atualização';
          showToast(`🚀 Nova versão v${data.version} disponível!`);
          break;

        case 'not-available':
          updaterCurrentState = 'not-available';
          updaterBadgeDot?.classList.add('hidden');
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
          updaterStatusMessage.textContent = `Falha na verificação de atualização: ${data.message || 'Erro de rede'}`;
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

  // Auto-save session on close or page hide
  window.addEventListener('beforeunload', () => {
    const currentUrls = quadrants.map(q => q.webview.getURL() || q.urlInput.value || '');
    localStorage.setItem('4nav_last_session', JSON.stringify(currentUrls));
  });
});

// Toast Helper
function showToast(message) {
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
  }, 3000);
}
