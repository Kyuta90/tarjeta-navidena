/**
 * Creator Studio App Logic - Tarjeta Navideña de Deseos con QR
 */
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const linkInput = document.getElementById('linkInput');
  const pasteClipboardBtn = document.getElementById('pasteClipboardBtn');
  const fetchPreviewBtn = document.getElementById('fetchPreviewBtn');
  const previewLoading = document.getElementById('previewLoading');
  const previewCard = document.getElementById('previewCard');
  const previewImg = document.getElementById('previewImg');
  const previewTitleInput = document.getElementById('previewTitleInput');
  const previewImageUrlInput = document.getElementById('previewImageUrlInput');
  const previewOriginalUrl = document.getElementById('previewOriginalUrl');
  const previewSiteName = document.getElementById('previewSiteName');
  const cancelPreviewBtn = document.getElementById('cancelPreviewBtn');
  const addItemToListBtn = document.getElementById('addItemToListBtn');

  const itemsListContainer = document.getElementById('itemsListContainer');
  const emptyListState = document.getElementById('emptyListState');
  const itemsCounterBadge = document.getElementById('itemsCounterBadge');
  const sampleItemsBtn = document.getElementById('sampleItemsBtn');
  const emptyStateSampleBtn = document.getElementById('emptyStateSampleBtn');

  const generateCardBtn = document.getElementById('generateCardBtn');
  const cardRecipient = document.getElementById('cardRecipient');
  const cardSender = document.getElementById('cardSender');
  const cardMessage = document.getElementById('cardMessage');

  // Modal elements
  const qrModal = document.getElementById('qrModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalQrImage = document.getElementById('modalQrImage');
  const modalShareUrlInput = document.getElementById('modalShareUrlInput');
  const copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
  const downloadQrBtn = document.getElementById('downloadQrBtn');
  const openCardDirectBtn = document.getElementById('openCardDirectBtn');
  const modalIpSelector = document.getElementById('modalIpSelector');
  const customUrlContainer = document.getElementById('customUrlContainer');
  const customPublicUrlInput = document.getElementById('customPublicUrlInput');
  const applyCustomUrlBtn = document.getElementById('applyCustomUrlBtn');
  const downloadStandaloneBtn = document.getElementById('downloadStandaloneBtn');

  // Mobile Simulator elements
  const openMobileSimulatorBtn = document.getElementById('openMobileSimulatorBtn');
  const mobileSimulatorModal = document.getElementById('mobileSimulatorModal');
  const mobileSimulatorFrame = document.getElementById('mobileSimulatorFrame');
  const closeMobileSimulatorBtn = document.getElementById('closeMobileSimulatorBtn');

  let currentCardId = null;

  // Load physical network IPs so the user can easily select Wi-Fi / LAN
  async function loadNetworkIps() {
    try {
      const res = await fetch('/api/network-ips');
      const data = await res.json();
      const candidates = data.candidates || [];
      if (modalIpSelector && candidates.length > 0) {
        modalIpSelector.innerHTML = '';
        candidates.forEach(cand => {
          const opt = document.createElement('option');
          opt.value = cand.ip;
          opt.textContent = cand.label;
          modalIpSelector.appendChild(opt);
        });

        // Add localhost
        const locOpt = document.createElement('option');
        locOpt.value = 'localhost';
        locOpt.textContent = 'localhost (Solo esta computadora)';
        modalIpSelector.appendChild(locOpt);

        // Add custom public URL option
        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = '🌐 Ingresar URL pública personalizada (ngrok / túnel)...';
        modalIpSelector.appendChild(customOpt);
      }
    } catch (err) {
      console.warn('No se pudieron cargar las IPs de red:', err);
    }
  }
  loadNetworkIps();

  // Listen to IP changes in QR Modal to regenerate QR on the fly
  if (modalIpSelector) {
    modalIpSelector.addEventListener('change', async () => {
      if (!currentCardId) return;
      const selectedVal = modalIpSelector.value;

      if (selectedVal === 'custom') {
        if (customUrlContainer) customUrlContainer.classList.remove('hidden');
        if (customPublicUrlInput) customPublicUrlInput.focus();
        return;
      } else {
        if (customUrlContainer) customUrlContainer.classList.add('hidden');
      }

      await updateQrWithIp(selectedVal);
    });
  }

  // Apply custom public URL
  if (applyCustomUrlBtn && customPublicUrlInput) {
    applyCustomUrlBtn.addEventListener('click', async () => {
      let customUrl = customPublicUrlInput.value.trim();
      if (!customUrl) {
        alert('Por favor ingresa una URL válida (ej. https://mi-tunel.com)');
        return;
      }
      if (!/^https?:\/\//i.test(customUrl)) {
        customUrl = 'https://' + customUrl;
      }
      const targetCardUrl = `${customUrl.replace(/\/$/, '')}/card/${currentCardId}`;
      await updateQrWithCustomUrl(targetCardUrl);
    });
  }

  async function updateQrWithIp(selectedIp) {
    try {
      const res = await fetch('/api/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: currentCardId, selectedIp })
      });
      const data = await res.json();
      if (data.success) {
        applyQrData(data.qrCodeDataUrl, data.targetUrl);
      }
    } catch (err) {
      console.error('Error al actualizar el QR:', err);
    }
  }

  async function updateQrWithCustomUrl(targetUrl) {
    try {
      const res = await fetch('/api/qr-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl })
      });
      const data = await res.json();
      if (data.success) {
        applyQrData(data.qrCodeDataUrl, targetUrl);
      }
    } catch (err) {
      console.error('Error al generar QR personalizado:', err);
    }
  }

  function applyQrData(qrDataUrl, targetUrl) {
    modalQrImage.src = qrDataUrl;
    modalShareUrlInput.value = targetUrl;
    downloadQrBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = qrDataUrl;
      a.download = `tarjeta-navidena-qr-${currentCardId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
  }

  // Mobile Simulator handlers
  if (openMobileSimulatorBtn && mobileSimulatorModal && mobileSimulatorFrame) {
    openMobileSimulatorBtn.addEventListener('click', () => {
      if (currentCardId) {
        mobileSimulatorFrame.src = `/card/${currentCardId}`;
        mobileSimulatorModal.classList.remove('hidden');
      }
    });
  }

  if (closeMobileSimulatorBtn && mobileSimulatorModal && mobileSimulatorFrame) {
    closeMobileSimulatorBtn.addEventListener('click', () => {
      mobileSimulatorModal.classList.add('hidden');
      mobileSimulatorFrame.src = 'about:blank';
    });
  }

  if (mobileSimulatorModal) {
    mobileSimulatorModal.addEventListener('click', (e) => {
      if (e.target === mobileSimulatorModal) {
        mobileSimulatorModal.classList.add('hidden');
        if (mobileSimulatorFrame) mobileSimulatorFrame.src = 'about:blank';
      }
    });
  }

  // Music button
  const musicToggleBtn = document.getElementById('musicToggleBtn');
  if (musicToggleBtn && window.HolidayAudio) {
    musicToggleBtn.addEventListener('click', () => {
      window.HolidayAudio.toggle();
    });
  }

  // State
  let items = [];
  let currentPreview = null;

  // Sample items to showcase
  const SAMPLE_ITEMS = [
    {
      id: 'sample-1',
      url: 'https://www.amazon.com/dp/B08N5LNQCX',
      title: 'Audífonos Bluetooth Inalámbricos con Cancelación de Ruido',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80',
      siteName: 'Amazon',
      description: 'Sonido envolvente para disfrutar villancicos y música favorita'
    },
    {
      id: 'sample-2',
      url: 'https://www.mercadolibre.com/sueter-navideno',
      title: 'Suéter Navideño Festivo de Renos y Copos de Nieve',
      image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=500&auto=format&fit=crop&q=80',
      siteName: 'Mercado Libre',
      description: 'Ideal para la cena de Nochebuena y fotos familiares'
    },
    {
      id: 'sample-3',
      url: 'https://www.falabella.com/cafetera-espresso',
      title: 'Cafetera Espresso para Café Caliente en Invierno',
      image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=500&auto=format&fit=crop&q=80',
      siteName: 'Falabella',
      description: 'Para compartir un chocolate o café caliente estas navidades'
    }
  ];

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function getSelectedTheme() {
    const radio = document.querySelector('input[name="cardTheme"]:checked');
    return radio ? radio.value : 'classic-red';
  }

  // Update background theme live in editor when user switches
  document.querySelectorAll('input[name="cardTheme"]').forEach(input => {
    input.addEventListener('change', (e) => {
      document.body.className = `theme-${e.target.value} min-h-screen relative text-slate-100 flex flex-col selection:bg-red-500 selection:text-white`;
    });
  });

  // -------------------------------------------------------------
  // Paste & Preview Extraction
  // -------------------------------------------------------------
  // Paste from clipboard button
  if (pasteClipboardBtn) {
    pasteClipboardBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            linkInput.value = text.trim();
            fetchLinkPreview(text.trim());
          }
        } else {
          linkInput.focus();
          linkInput.select();
        }
      } catch {
        linkInput.focus();
      }
    });
  }

  // Detect automatically on paste event in the input
  linkInput.addEventListener('paste', (e) => {
    setTimeout(() => {
      const val = linkInput.value.trim();
      if (val) {
        fetchLinkPreview(val);
      }
    }, 50);
  });

  // Also trigger when clicking Detectar
  fetchPreviewBtn.addEventListener('click', () => {
    const val = linkInput.value.trim();
    if (!val) {
      alert('Por favor pega primero un enlace en el campo de texto.');
      linkInput.focus();
      return;
    }
    fetchLinkPreview(val);
  });

  // Fetch link preview from server
  async function fetchLinkPreview(url) {
    if (!url) return;

    previewCard.classList.add('hidden');
    previewLoading.classList.remove('hidden');

    try {
      const resp = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
      const data = await resp.json();

      if (!resp.ok || data.error) {
        throw new Error(data.error || 'No se pudo obtener información del enlace');
      }

      currentPreview = {
        url: data.url || url,
        title: data.title || 'Artículo de Regalo',
        image: data.image || '/images/default-gift.svg',
        siteName: data.siteName || '',
        description: data.description || ''
      };

      // Populate preview UI
      previewImg.src = currentPreview.image;
      previewImg.onerror = () => {
        previewImg.src = '/images/default-gift.svg';
      };
      previewTitleInput.value = currentPreview.title;
      previewImageUrlInput.value = currentPreview.image;
      previewOriginalUrl.textContent = currentPreview.url;
      previewOriginalUrl.href = currentPreview.url;
      previewSiteName.textContent = currentPreview.siteName || new URL(currentPreview.url).hostname;

      previewLoading.classList.add('hidden');
      previewCard.classList.remove('hidden');

      // Sync image URL edit
      previewImageUrlInput.oninput = () => {
        const customImg = previewImageUrlInput.value.trim();
        if (customImg) {
          previewImg.src = customImg;
          currentPreview.image = customImg;
        }
      };

      // Sync title edit
      previewTitleInput.oninput = () => {
        currentPreview.title = previewTitleInput.value.trim();
      };

    } catch (err) {
      console.error(err);
      previewLoading.classList.add('hidden');
      
      // Fallback preview
      currentPreview = {
        url: url,
        title: 'Artículo deseado (' + (new URL(url).hostname || 'Enlace') + ')',
        image: '/images/default-gift.svg',
        siteName: 'Enlace web',
        description: ''
      };

      previewImg.src = currentPreview.image;
      previewTitleInput.value = currentPreview.title;
      previewImageUrlInput.value = currentPreview.image;
      previewOriginalUrl.textContent = url;
      previewOriginalUrl.href = url;
      previewSiteName.textContent = 'Enlace web';

      previewCard.classList.remove('hidden');
    }
  }

  // Cancel preview
  cancelPreviewBtn.addEventListener('click', () => {
    previewCard.classList.add('hidden');
    currentPreview = null;
    linkInput.value = '';
  });

  // Add Item to Wishlist
  addItemToListBtn.addEventListener('click', () => {
    if (!currentPreview) return;

    // Use edited values if modified
    const itemToAdd = {
      id: 'item-' + Date.now(),
      order: items.length + 1,
      url: currentPreview.url,
      title: previewTitleInput.value.trim() || currentPreview.title || `Deseo #${items.length + 1}`,
      image: previewImageUrlInput.value.trim() || currentPreview.image || '/images/default-gift.svg',
      siteName: currentPreview.siteName,
      description: currentPreview.description
    };

    items.push(itemToAdd);
    renderItemsList();

    // Trigger celebration confetti
    if (window.confetti) {
      window.confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 }
      });
    }

    // Reset preview
    previewCard.classList.add('hidden');
    currentPreview = null;
    linkInput.value = '';
    linkInput.focus();
  });

  // -------------------------------------------------------------
  // Render Items List (Maintaining strict entry order)
  // -------------------------------------------------------------
  function renderItemsList() {
    itemsCounterBadge.textContent = `${items.length} ${items.length === 1 ? 'regalo' : 'regalos'}`;

    if (items.length === 0) {
      emptyListState.classList.remove('hidden');
      itemsListContainer.innerHTML = '';
      itemsListContainer.appendChild(emptyListState);
      return;
    }

    emptyListState.classList.add('hidden');
    itemsListContainer.innerHTML = '';

    items.forEach((item, index) => {
      // Re-assign 1-based order
      item.order = index + 1;

      const cardElem = document.createElement('div');
      cardElem.className = 'group relative bg-stone-900/90 border border-white/20 hover:border-amber-400/70 rounded-xl p-3 shadow-md transition-all flex items-center gap-3';
      cardElem.innerHTML = `
        <!-- Badge de Orden (#1, #2, etc.) -->
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-red-800 text-amber-200 border border-amber-400/50 flex items-center justify-center font-bold text-xs shadow">
          #${item.order}
        </div>

        <!-- Imagen Referencial Thumbnail -->
        <div class="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">
          <img src="${item.image}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover" onerror="this.src='/images/default-gift.svg'">
        </div>

        <!-- Título y Enlace -->
        <div class="flex-grow min-w-0 pr-1">
          <h4 class="text-sm font-semibold text-white truncate group-hover:text-amber-200 transition-colors">
            ${escapeHtml(item.title)}
          </h4>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-[11px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
              ${escapeHtml(item.siteName || 'Enlace')}
            </span>
            <a href="${item.url}" target="_blank" class="text-[11px] text-blue-300 hover:underline truncate max-w-[140px] sm:max-w-[180px]">
              Ver link original ↗
            </a>
          </div>
        </div>

        <!-- Acciones: Subir, Bajar, Eliminar -->
        <div class="flex-shrink-0 flex items-center gap-1">
          <button type="button" class="move-up-btn p-1 text-slate-400 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none rounded transition-colors text-xs" title="Mover arriba" ${index === 0 ? 'disabled' : ''}>
            ▲
          </button>
          <button type="button" class="move-down-btn p-1 text-slate-400 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none rounded transition-colors text-xs" title="Mover abajo" ${index === items.length - 1 ? 'disabled' : ''}>
            ▼
          </button>
          <button type="button" class="delete-item-btn p-1 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded transition-colors text-sm ml-1" title="Eliminar regalo">
            🗑️
          </button>
        </div>
      `;

      // Event handlers for actions
      const moveUpBtn = cardElem.querySelector('.move-up-btn');
      const moveDownBtn = cardElem.querySelector('.move-down-btn');
      const deleteItemBtn = cardElem.querySelector('.delete-item-btn');

      moveUpBtn.addEventListener('click', () => {
        if (index > 0) {
          const temp = items[index - 1];
          items[index - 1] = items[index];
          items[index] = temp;
          renderItemsList();
        }
      });

      moveDownBtn.addEventListener('click', () => {
        if (index < items.length - 1) {
          const temp = items[index + 1];
          items[index + 1] = items[index];
          items[index] = temp;
          renderItemsList();
        }
      });

      deleteItemBtn.addEventListener('click', () => {
        items.splice(index, 1);
        renderItemsList();
      });

      itemsListContainer.appendChild(cardElem);
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
  }

  // Load sample items
  function loadSampleItems() {
    items = JSON.parse(JSON.stringify(SAMPLE_ITEMS));
    renderItemsList();
    if (window.confetti) {
      window.confetti({ particleCount: 50, spread: 70 });
    }
  }

  if (sampleItemsBtn) sampleItemsBtn.addEventListener('click', loadSampleItems);
  if (emptyStateSampleBtn) emptyStateSampleBtn.addEventListener('click', loadSampleItems);

  // -------------------------------------------------------------
  // Generate Christmas Card & QR Code
  // -------------------------------------------------------------
  generateCardBtn.addEventListener('click', async () => {
    if (items.length === 0) {
      alert('¡Por favor agrega al menos un enlace o regalo a tu lista de deseos antes de generar la tarjeta!');
      linkInput.focus();
      return;
    }

    const payload = {
      title: 'Mis Deseos Navideños 🎄',
      recipient: cardRecipient.value.trim(),
      sender: cardSender.value.trim(),
      message: cardMessage.value.trim(),
      theme: getSelectedTheme(),
      items: items
    };

    generateCardBtn.disabled = true;
    generateCardBtn.innerHTML = `
      <span class="animate-spin text-2xl">❄️</span>
      <span>Generando Tarjeta y QR Navideño...</span>
    `;

    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al generar la tarjeta');
      }

      // Success! Show QR Modal
      currentCardId = data.id;
      const targetUrl = data.qrTargetUrl || data.lanUrl || data.localUrl;
      modalQrImage.src = data.qrCodeDataUrl;
      modalShareUrlInput.value = targetUrl;
      openCardDirectBtn.href = `/card/${data.id}`;

      // Set standalone downloadable HTML button
      if (downloadStandaloneBtn) {
        downloadStandaloneBtn.href = `/api/download-card/${data.id}`;
      }

      // Select active IP in dropdown if matching
      if (modalIpSelector && data.lanUrl) {
        try {
          const lanHostname = new URL(data.lanUrl).hostname;
          modalIpSelector.value = lanHostname;
        } catch {}
      }

      // Set download QR button
      downloadQrBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = data.qrCodeDataUrl;
        a.download = `tarjeta-navidena-qr-${data.id}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      // Show modal
      qrModal.classList.remove('hidden');

      // Celebration confetti fireworks!
      if (window.confetti) {
        const count = 200;
        const defaults = { origin: { y: 0.7 } };
        function fire(particleRatio, opts) {
          window.confetti(Object.assign({}, defaults, opts, {
            particleCount: Math.floor(count * particleRatio)
          }));
        }
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
      }

    } catch (err) {
      console.error(err);
      alert('Hubo un error al generar la tarjeta: ' + err.message);
    } finally {
      generateCardBtn.disabled = false;
      generateCardBtn.innerHTML = `
        <span class="text-2xl animate-spin">❄️</span>
        <span>GENERAR QR DE LA TARJETA</span>
        <span class="text-2xl">🎁</span>
      `;
    }
  });

  // Modal Actions
  closeModalBtn.addEventListener('click', () => {
    qrModal.classList.add('hidden');
  });

  copyShareUrlBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(modalShareUrlInput.value);
      copyShareUrlBtn.textContent = '¡Copiado! ✓';
      copyShareUrlBtn.classList.replace('bg-amber-500', 'bg-emerald-500');
      setTimeout(() => {
        copyShareUrlBtn.textContent = 'Copiar';
        copyShareUrlBtn.classList.replace('bg-emerald-500', 'bg-amber-500');
      }, 2000);
    } catch {
      modalShareUrlInput.select();
      document.execCommand('copy');
      copyShareUrlBtn.textContent = '¡Copiado! ✓';
    }
  });

});
