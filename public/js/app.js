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

  // Image Upload elements
  const imageFileInput = document.getElementById('imageFileInput');
  const directUploadBtn = document.getElementById('directUploadBtn');
  const imageMissingAlert = document.getElementById('imageMissingAlert');
  const alertUploadBtn = document.getElementById('alertUploadBtn');
  const previewImgDropZone = document.getElementById('previewImgDropZone');
  const changeImageBtn = document.getElementById('changeImageBtn');

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

  // Priority, Price & Tunnel Elements
  const previewPrioritySelect = document.getElementById('previewPrioritySelect');
  const previewPriceInput = document.getElementById('previewPriceInput');
  const tunnelHeaderToggleBtn = document.getElementById('tunnelHeaderToggleBtn');
  const tunnelHeaderStatusText = document.getElementById('tunnelHeaderStatusText');
  const toggleTunnelBtn = document.getElementById('toggleTunnelBtn');
  const toggleTunnelBtnText = document.getElementById('toggleTunnelBtnText');
  const tunnelStatusDot = document.getElementById('tunnelStatusDot');
  const tunnelStatusTitle = document.getElementById('tunnelStatusTitle');
  const tunnelStatusDesc = document.getElementById('tunnelStatusDesc');
  const qrNetworkAlert = document.getElementById('qrNetworkAlert');
  const alertActiveIpText = document.getElementById('alertActiveIpText');

  // Mobile Simulator elements
  const openMobileSimulatorBtn = document.getElementById('openMobileSimulatorBtn');
  const mobileSimulatorModal = document.getElementById('mobileSimulatorModal');
  const mobileSimulatorFrame = document.getElementById('mobileSimulatorFrame');
  const closeMobileSimulatorBtn = document.getElementById('closeMobileSimulatorBtn');

  let currentCardId = null;
  let activeTunnelUrl = null;

  // Load physical network IPs so the user can easily select Wi-Fi / LAN / Tunnel
  async function loadNetworkIps() {
    try {
      const res = await fetch('/api/network-ips');
      const data = await res.json();
      const candidates = data.candidates || [];
      const currentSelected = modalIpSelector ? modalIpSelector.value : '';

      if (modalIpSelector) {
        modalIpSelector.innerHTML = '';

        // If tunnel is active, place it as the FIRST recommended choice
        if (data.tunnel && data.tunnel.status === 'running' && data.tunnel.url) {
          activeTunnelUrl = data.tunnel.url;
          const tunnelOpt = document.createElement('option');
          tunnelOpt.value = data.tunnel.url;
          tunnelOpt.textContent = `🌐 ${data.tunnel.url} - Túnel Universal 4G (Recomendado)`;
          modalIpSelector.appendChild(tunnelOpt);
        } else {
          activeTunnelUrl = null;
        }

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

        if (currentSelected && modalIpSelector.querySelector(`option[value="${currentSelected}"]`)) {
          modalIpSelector.value = currentSelected;
        } else if (activeTunnelUrl) {
          modalIpSelector.value = activeTunnelUrl;
        }
      }
    } catch (err) {
      console.warn('No se pudieron cargar las IPs de red:', err);
    }
  }

  function updateQrNetworkAlert() {
    if (!qrNetworkAlert) return;
    const selected = modalIpSelector ? modalIpSelector.value : '';
    if (selected && selected.startsWith('http') && selected.includes('trycloudflare.com')) {
      qrNetworkAlert.className = 'text-[11px] p-2.5 rounded-xl border border-emerald-500/50 bg-emerald-950/60 text-emerald-200';
      qrNetworkAlert.innerHTML = `<span>✅ <strong>Túnel Universal Activo:</strong> Este QR se puede escanear desde <strong>cualquier celular y cualquier red (4G, 5G o Wi-Fi)</strong> en cualquier lugar del mundo.</span>`;
    } else if (selected === 'localhost') {
      qrNetworkAlert.className = 'text-[11px] p-2.5 rounded-xl border border-red-500/50 bg-red-950/60 text-red-200';
      qrNetworkAlert.innerHTML = `<span>⚠️ <strong>Aviso:</strong> "localhost" solo funciona en este computador. Los celulares no podrán abrir la tarjeta con esta dirección.</span>`;
    } else {
      qrNetworkAlert.className = 'text-[11px] p-2.5 rounded-xl border border-amber-400/40 bg-amber-950/40 text-amber-200';
      qrNetworkAlert.innerHTML = `<span>⚠️ <strong>Aviso de red Wi-Fi:</strong> Este QR apunta a tu red local (<span class="font-mono font-bold">${selected || 'Wi-Fi'}</span>). Tu celular <strong>debe estar en la misma red Wi-Fi</strong> para que cargue. Para que funcione en cualquier lugar (4G), activa el <em>Túnel Universal</em> arriba.</span>`;
    }
  }

  async function syncTunnelUI() {
    try {
      const res = await fetch('/api/tunnel/status');
      const data = await res.json();
      const isRunning = data.status === 'running' && data.url;
      activeTunnelUrl = isRunning ? data.url : null;

      if (isRunning) {
        if (tunnelHeaderStatusText) tunnelHeaderStatusText.textContent = 'Túnel 4G: Activo ✓';
        if (tunnelHeaderToggleBtn) {
          tunnelHeaderToggleBtn.classList.replace('bg-emerald-600/30', 'bg-emerald-500');
          tunnelHeaderToggleBtn.classList.replace('text-emerald-300', 'text-stone-950');
        }
        if (toggleTunnelBtnText) toggleTunnelBtnText.textContent = 'Desactivar Túnel';
        if (toggleTunnelBtn) toggleTunnelBtn.classList.replace('bg-emerald-600', 'bg-stone-700');
        if (tunnelStatusDot) tunnelStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-pulse';
        if (tunnelStatusTitle) tunnelStatusTitle.textContent = '🌐 Túnel Universal 4G Activo';
        if (tunnelStatusDesc) tunnelStatusDesc.innerHTML = `<span class="text-emerald-300 font-mono font-bold">${data.url}</span> — ¡Cualquier celular puede escanear tu QR desde cualquier lugar!`;
      } else {
        if (tunnelHeaderStatusText) tunnelHeaderStatusText.textContent = 'Activar Túnel 4G';
        if (tunnelHeaderToggleBtn) {
          tunnelHeaderToggleBtn.classList.replace('bg-emerald-500', 'bg-emerald-600/30');
          tunnelHeaderToggleBtn.classList.replace('text-stone-950', 'text-emerald-300');
        }
        if (toggleTunnelBtnText) toggleTunnelBtnText.textContent = 'Activar Túnel';
        if (toggleTunnelBtn) toggleTunnelBtn.classList.replace('bg-stone-700', 'bg-emerald-600');
        if (tunnelStatusDot) tunnelStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-500 inline-block';
        if (tunnelStatusTitle) tunnelStatusTitle.textContent = 'Túnel Universal 4G (Recomendado)';
        if (tunnelStatusDesc) tunnelStatusDesc.textContent = 'Genera una URL segura accesible desde cualquier celular y red móvil sin configurar tu router.';
      }

      await loadNetworkIps();
      updateQrNetworkAlert();
    } catch (e) {
      console.warn('Error sincronizando túnel:', e);
    }
  }

  async function toggleTunnel() {
    try {
      const isRunning = Boolean(activeTunnelUrl);
      const endpoint = isRunning ? '/api/tunnel/stop' : '/api/tunnel/start';

      if (toggleTunnelBtn) toggleTunnelBtn.disabled = true;
      if (toggleTunnelBtnText) toggleTunnelBtnText.textContent = isRunning ? 'Deteniendo...' : 'Activando túnel...';

      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      await syncTunnelUI();

      if (currentCardId) {
        if (!isRunning && data.url) {
          modalIpSelector.value = data.url;
          await updateQrWithIp(data.url);
        } else {
          const selectedVal = modalIpSelector ? modalIpSelector.value : null;
          await updateQrWithIp(selectedVal);
        }
      }
    } catch (err) {
      alert('Error con el túnel: ' + err.message);
    } finally {
      if (toggleTunnelBtn) toggleTunnelBtn.disabled = false;
    }
  }

  if (toggleTunnelBtn) toggleTunnelBtn.addEventListener('click', toggleTunnel);
  if (tunnelHeaderToggleBtn) tunnelHeaderToggleBtn.addEventListener('click', toggleTunnel);

  syncTunnelUI();

  // Listen to IP changes in QR Modal to regenerate QR on the fly
  if (modalIpSelector) {
    modalIpSelector.addEventListener('change', async () => {
      if (!currentCardId) return;
      const selectedVal = modalIpSelector.value;
      updateQrNetworkAlert();

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
    updateQrNetworkAlert();
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

  // -------------------------------------------------------------
  // Image Upload, Drag & Drop, and Compression (Base64)
  // -------------------------------------------------------------
  function openImageFileDialog() {
    if (imageFileInput) {
      imageFileInput.value = '';
      imageFileInput.click();
    }
  }

  if (directUploadBtn) directUploadBtn.addEventListener('click', openImageFileDialog);
  if (alertUploadBtn) alertUploadBtn.addEventListener('click', openImageFileDialog);
  if (changeImageBtn) changeImageBtn.addEventListener('click', openImageFileDialog);

  if (previewImgDropZone) {
    previewImgDropZone.addEventListener('click', () => {
      openImageFileDialog();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      previewImgDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        previewImgDropZone.classList.add('border-amber-400', 'bg-amber-950/40');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      previewImgDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        previewImgDropZone.classList.remove('border-amber-400', 'bg-amber-950/40');
      });
    });

    previewImgDropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        processUploadedImageFile(files[0]);
      }
    });
  }

  if (imageFileInput) {
    imageFileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processUploadedImageFile(files[0]);
      }
    });
  }

  function processUploadedImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        // Redimensionar a un tamaño óptimo (máx 800px) para mantener calidad nítida sin sobrecargar memoria
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        applyUploadedImage(dataUrl, file.name);
      };
      img.onerror = () => {
        alert('No se pudo procesar la imagen seleccionada.');
      };
      img.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  }

  function applyUploadedImage(imageDataUrl, fileName) {
    const rawName = fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Foto de Regalo';
    const cleanTitle = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    if (!currentPreview) {
      currentPreview = {
        url: linkInput.value.trim() || '#',
        title: cleanTitle,
        image: imageDataUrl,
        siteName: 'Foto Subida',
        description: 'Imagen subida desde dispositivo'
      };
      previewTitleInput.value = currentPreview.title;
      previewOriginalUrl.textContent = currentPreview.url !== '#' ? currentPreview.url : 'Archivo local subido';
      previewOriginalUrl.href = currentPreview.url;
      previewSiteName.textContent = 'Foto Subida 📁';
    } else {
      currentPreview.image = imageDataUrl;
      if (!previewTitleInput.value.trim()) {
        previewTitleInput.value = cleanTitle;
        currentPreview.title = cleanTitle;
      }
    }

    previewImg.src = imageDataUrl;
    previewImageUrlInput.value = imageDataUrl;

    if (imageMissingAlert) {
      imageMissingAlert.classList.add('hidden');
    }

    previewLoading.classList.add('hidden');
    previewCard.classList.remove('hidden');
  }

  // Fetch link preview from server
  async function fetchLinkPreview(url) {
    if (!url) return;

    previewCard.classList.add('hidden');
    if (imageMissingAlert) imageMissingAlert.classList.add('hidden');
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
        if (imageMissingAlert) imageMissingAlert.classList.remove('hidden');
      };
      previewImg.onload = () => {
        if (!previewImg.src.includes('default-gift.svg') && imageMissingAlert) {
          imageMissingAlert.classList.add('hidden');
        }
      };

      if (!data.image || data.image.includes('default-gift.svg')) {
        if (imageMissingAlert) imageMissingAlert.classList.remove('hidden');
      } else {
        if (imageMissingAlert) imageMissingAlert.classList.add('hidden');
      }

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

      if (imageMissingAlert) {
        imageMissingAlert.classList.remove('hidden');
      }

      previewCard.classList.remove('hidden');
    }
  }

  // Cancel preview
  cancelPreviewBtn.addEventListener('click', () => {
    previewCard.classList.add('hidden');
    if (imageMissingAlert) imageMissingAlert.classList.add('hidden');
    currentPreview = null;
    linkInput.value = '';
  });

  // Add Item to Wishlist
  addItemToListBtn.addEventListener('click', () => {
    if (!currentPreview) return;

    const priority = (previewPrioritySelect && previewPrioritySelect.value) ? previewPrioritySelect.value : 'normal';
    const price = (previewPriceInput && previewPriceInput.value) ? previewPriceInput.value.trim() : '';

    // Use edited values if modified
    const itemToAdd = {
      id: 'item-' + Date.now(),
      order: items.length + 1,
      url: currentPreview.url,
      title: previewTitleInput.value.trim() || currentPreview.title || `Deseo #${items.length + 1}`,
      image: previewImageUrlInput.value.trim() || currentPreview.image || '/images/default-gift.svg',
      siteName: currentPreview.siteName,
      description: currentPreview.description,
      priority,
      price
    };

    items.push(itemToAdd);
    renderItemsList();

    if (previewPriceInput) previewPriceInput.value = '';
    if (previewPrioritySelect) previewPrioritySelect.value = 'normal';

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
    if (imageMissingAlert) imageMissingAlert.classList.add('hidden');
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
            ${item.priority === 'alta' ? '<span class="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-400/40">⭐ Muy Querido</span>' : ''}
            ${item.price ? `<span class="text-[10px] font-medium text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">🏷️ ${escapeHtml(item.price)}</span>` : ''}
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

      // Save adminToken for management
      if (data.adminToken) {
        const tokens = JSON.parse(localStorage.getItem('navidad_admin_tokens') || '{}');
        tokens[data.id] = data.adminToken;
        localStorage.setItem('navidad_admin_tokens', JSON.stringify(tokens));
      }

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

      // Refresh cards registry
      loadCardsRegistry();

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

  // -------------------------------------------------------------
  // Registro e Historial de Tarjetas Generadas
  // -------------------------------------------------------------
  const registryListContainer = document.getElementById('registryListContainer');
  const registryCountBadge = document.getElementById('registryCountBadge');
  const headerCardCount = document.getElementById('headerCardCount');
  const refreshRegistryBtn = document.getElementById('refreshRegistryBtn');

  async function loadCardsRegistry() {
    if (!registryListContainer) return;

    try {
      const res = await fetch('/api/cards');
      const data = await res.json();
      const serverCards = data.cards || [];

      // Combine with localStorage to ensure maximum persistence
      const localStored = JSON.parse(localStorage.getItem('navidad_cards_history') || '[]');
      const cardMap = new Map();

      // Put server cards in map
      serverCards.forEach(c => cardMap.set(c.id, c));
      // Put local cards in map if not present
      localStored.forEach(c => {
        if (!cardMap.has(c.id)) {
          cardMap.set(c.id, c);
        }
      });

      const allCards = Array.from(cardMap.values()).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      // Update badge counts
      const countStr = `${allCards.length} ${allCards.length === 1 ? 'guardada' : 'guardadas'}`;
      if (registryCountBadge) registryCountBadge.textContent = countStr;
      if (headerCardCount) headerCardCount.textContent = allCards.length;

      // Update local storage backup
      localStorage.setItem('navidad_cards_history', JSON.stringify(allCards));

      if (allCards.length === 0) {
        registryListContainer.innerHTML = `
          <div class="text-center py-10 px-4 border-2 border-dashed border-white/20 rounded-2xl">
            <span class="text-3xl block mb-2 opacity-70">📜</span>
            <p class="text-sm font-semibold text-slate-200">No hay tarjetas registradas todavía</p>
            <p class="text-xs text-slate-400 mt-1">Crea tu primera tarjeta arriba y quedará guardada aquí para siempre.</p>
          </div>
        `;
        return;
      }

      registryListContainer.innerHTML = '';

      allCards.forEach(card => {
        const itemElem = document.createElement('div');
        itemElem.className = 'bg-stone-900/90 border border-white/20 hover:border-amber-400/60 rounded-2xl p-4 shadow-lg transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4';

        // Format date
        const dateObj = new Date(card.createdAt);
        const dateFormatted = !isNaN(dateObj) 
          ? dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : 'Fecha desconocida';

        itemElem.innerHTML = `
          <!-- Info de la Tarjeta -->
          <div class="flex-grow min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <span class="text-xs font-mono font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                ${escapeHtml(card.id)}
              </span>
              <span class="text-xs text-slate-400">
                📅 ${dateFormatted}
              </span>
              <span class="text-xs bg-red-900/60 text-red-200 px-2 py-0.5 rounded-full border border-red-500/30">
                🎁 ${card.itemCount || 0} ${(card.itemCount === 1 ? 'deseo' : 'deseos')}
              </span>
            </div>

            <h4 class="text-base font-bold text-white truncate">
              ${escapeHtml(card.title || 'Mis Deseos Navideños')}
            </h4>

            <div class="text-xs text-slate-300 mt-0.5 flex flex-wrap gap-x-4">
              ${card.recipient ? `<span><strong>Para:</strong> ${escapeHtml(card.recipient)}</span>` : ''}
              ${card.sender ? `<span><strong>De:</strong> ${escapeHtml(card.sender)}</span>` : ''}
              <span class="text-emerald-400 font-medium">● Activa (sin caducidad)</span>
            </div>
          </div>

          <!-- Acciones: Ver, Ver QR, Eliminar -->
          <div class="flex-shrink-0 flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
            <a href="/card/${card.id}" target="_blank" class="bg-white/10 hover:bg-white/25 text-white font-medium text-xs px-3 py-2 rounded-xl border border-white/20 transition-all flex items-center gap-1.5 shadow-sm" title="Ver la tarjeta navideña">
              <span>👁️</span> <span class="hidden md:inline">Ver</span> Tarjeta
            </a>

            <button type="button" class="view-qr-btn bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-sm" title="Ver y descargar código QR">
              <span>📱</span> <span class="hidden md:inline">Ver</span> QR
            </button>

            <button type="button" class="delete-card-btn bg-red-950/80 hover:bg-red-800 text-red-300 hover:text-white border border-red-600/40 text-xs px-2.5 py-2 rounded-xl transition-all flex items-center gap-1" title="Eliminar tarjeta">
              <span>🗑️</span>
            </button>
          </div>
        `;

        // Event listener: View QR
        const viewQrBtn = itemElem.querySelector('.view-qr-btn');
        viewQrBtn.addEventListener('click', async () => {
          await openQrModalForCard(card.id);
        });

        // Event listener: Delete Card
        const deleteCardBtn = itemElem.querySelector('.delete-card-btn');
        deleteCardBtn.addEventListener('click', async () => {
          const confirmDel = confirm(`¿Estás seguro de que deseas eliminar permanentemente la tarjeta "${card.title || card.id}"? Esta acción no se puede deshacer.`);
          if (!confirmDel) return;

          try {
            const tokens = JSON.parse(localStorage.getItem('navidad_admin_tokens') || '{}');
            const token = tokens[card.id] || '';

            const delRes = await fetch(`/api/cards/${card.id}`, {
              method: 'DELETE',
              headers: { 'X-Admin-Token': token }
            });
            if (!delRes.ok) {
              const errData = await delRes.json().catch(() => ({}));
              throw new Error(errData.error || 'No se pudo eliminar');
            }
            
            // Remove from local storage
            const updatedLocal = allCards.filter(c => c.id !== card.id);
            localStorage.setItem('navidad_cards_history', JSON.stringify(updatedLocal));

            loadCardsRegistry();
          } catch (err) {
            console.error(err);
            alert('Error al eliminar la tarjeta: ' + err.message);
          }
        });

        registryListContainer.appendChild(itemElem);
      });

    } catch (err) {
      console.error('Error cargando registro de tarjetas:', err);
    }
  }

  async function openQrModalForCard(cardId) {
    try {
      const res = await fetch(`/api/cards/${cardId}`);
      if (!res.ok) throw new Error('Tarjeta no encontrada');
      const data = await res.json();

      currentCardId = cardId;
      openCardDirectBtn.href = `/card/${cardId}`;
      if (downloadStandaloneBtn) {
        downloadStandaloneBtn.href = `/api/download-card/${cardId}`;
      }

      // Generate or update QR
      const selectedIp = modalIpSelector ? modalIpSelector.value : null;
      await updateQrWithIp(selectedIp);

      qrModal.classList.remove('hidden');
    } catch (err) {
      alert('No se pudo abrir el QR: ' + err.message);
    }
  }

  if (refreshRegistryBtn) {
    refreshRegistryBtn.addEventListener('click', loadCardsRegistry);
  }

  const btnBackupDrive = document.getElementById('btnBackupDrive');
  if (btnBackupDrive) {
    btnBackupDrive.addEventListener('click', async () => {
      try {
        const driveRes = await fetch('/api/drive/status').then(r => r.json());
        const confirmDownload = confirm(
          `📁 Sincronización con Google Drive / Respaldo en la Nube\n\n` +
          `• Estado: ${driveRes.provider}\n` +
          `• Enlaces de Google Drive: Soportados directamente (al pegar enlaces de fotos o archivos de Drive en la lista de deseos, se extraen automáticamente).\n` +
          `• Protección Render: Monitoreo activo en /healthz y /ping con auto-keepalive.\n\n` +
          `¿Deseas descargar el archivo de respaldo .JSON de todas tus tarjetas para guardarlo en tu Google Drive?`
        );
        if (confirmDownload) {
          window.location.href = '/api/backup/download';
        }
      } catch (err) {
        window.location.href = '/api/backup/download';
      }
    });
  }

  // Load registry on startup
  loadCardsRegistry();

});
