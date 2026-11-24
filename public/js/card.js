/**
 * Recipient Christmas Card Logic - Tarjeta Navideña de Deseos
 */
document.addEventListener('DOMContentLoaded', async () => {
  const cardBody = document.getElementById('cardBody');
  const cardTitle = document.getElementById('cardTitle');
  const deParaContainer = document.getElementById('deParaContainer');
  const recipientBox = document.getElementById('recipientBox');
  const recipientName = document.getElementById('recipientName');
  const senderBox = document.getElementById('senderBox');
  const senderName = document.getElementById('senderName');
  const messageContainer = document.getElementById('messageContainer');
  const cardMessageText = document.getElementById('cardMessageText');
  const itemsTotalBadge = document.getElementById('itemsTotalBadge');
  const cardItemsContainer = document.getElementById('cardItemsContainer');
  const cardLoading = document.getElementById('cardLoading');
  const cardError = document.getElementById('cardError');

  // Layout Controls
  const layoutVerticalBtn = document.getElementById('layoutVerticalBtn');
  const layoutHorizontalBtn = document.getElementById('layoutHorizontalBtn');
  const carouselArrows = document.getElementById('carouselArrows');
  const carouselPrevBtn = document.getElementById('carouselPrevBtn');
  const carouselNextBtn = document.getElementById('carouselNextBtn');
  const shareCardBtn = document.getElementById('shareCardBtn');

  // Lightbox
  const imageLightboxModal = document.getElementById('imageLightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');

  // Claim Modal
  const claimModal = document.getElementById('claimModal');
  const closeClaimModalBtn = document.getElementById('closeClaimModalBtn');
  const claimItemTitle = document.getElementById('claimItemTitle');
  const claimNameInput = document.getElementById('claimNameInput');
  const confirmClaimBtn = document.getElementById('confirmClaimBtn');

  let activeCardId = null;
  let activeClaimTarget = null; // { itemId, itemTitle, buttonElem }

  // Music button
  const musicToggleBtn = document.getElementById('musicToggleBtn');
  if (musicToggleBtn && window.HolidayAudio) {
    musicToggleBtn.addEventListener('click', () => {
      window.HolidayAudio.toggle();
    });
  }

  // Current Layout Mode: 'vertical' or 'horizontal'
  let currentLayout = window.innerWidth >= 768 ? 'horizontal' : 'vertical';
  let userManuallySetLayout = false;

  function updateLayoutUI() {
    if (!cardItemsContainer) return;
    if (currentLayout === 'horizontal') {
      cardItemsContainer.classList.remove('wishlist-vertical');
      cardItemsContainer.classList.add('wishlist-horizontal');

      if (layoutHorizontalBtn) layoutHorizontalBtn.className = 'px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 bg-amber-400 text-stone-950 shadow';
      if (layoutVerticalBtn) layoutVerticalBtn.className = 'px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 text-slate-300 hover:text-white';
      if (carouselArrows) carouselArrows.classList.remove('hidden');
    } else {
      cardItemsContainer.classList.remove('wishlist-horizontal');
      cardItemsContainer.classList.add('wishlist-vertical');

      if (layoutVerticalBtn) layoutVerticalBtn.className = 'px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 bg-amber-400 text-stone-950 shadow';
      if (layoutHorizontalBtn) layoutHorizontalBtn.className = 'px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 text-slate-300 hover:text-white';
      if (carouselArrows) carouselArrows.classList.add('hidden');
    }
  }

  if (layoutVerticalBtn && layoutHorizontalBtn) {
    layoutVerticalBtn.addEventListener('click', () => {
      currentLayout = 'vertical';
      userManuallySetLayout = true;
      updateLayoutUI();
    });

    layoutHorizontalBtn.addEventListener('click', () => {
      currentLayout = 'horizontal';
      userManuallySetLayout = true;
      updateLayoutUI();
    });
  }

  // Carousel navigation arrows
  if (carouselPrevBtn && carouselNextBtn) {
    carouselPrevBtn.addEventListener('click', () => {
      cardItemsContainer.scrollBy({ left: -320, behavior: 'smooth' });
    });
    carouselNextBtn.addEventListener('click', () => {
      cardItemsContainer.scrollBy({ left: 320, behavior: 'smooth' });
    });
  }

  // Auto-adapt layout on device resize or orientation change
  window.addEventListener('resize', () => {
    if (!userManuallySetLayout) {
      const newLayout = window.innerWidth >= 768 ? 'horizontal' : 'vertical';
      if (newLayout !== currentLayout) {
        currentLayout = newLayout;
        updateLayoutUI();
      }
    }
  });

  // Share button handler
  if (shareCardBtn) {
    shareCardBtn.addEventListener('click', async () => {
      const shareUrl = window.location.href;
      const shareTitle = document.title || 'Tarjeta Navideña de Deseos 🎄';
      const shareText = cardMessageText && cardMessageText.textContent
        ? `${cardMessageText.textContent} 🎄 Mira la lista de deseos:`
        : '¡Mira mi lista de deseos navideños! 🎄✨';

      if (navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
          });
          return;
        } catch (err) {
          if (err.name !== 'AbortError') console.warn('Error en share:', err);
        }
      }

      // Fallback: copy link
      try {
        await navigator.clipboard.writeText(shareUrl);
        const originalText = shareCardBtn.innerHTML;
        shareCardBtn.innerHTML = `<span>✓</span> <span>¡Copiado!</span>`;
        setTimeout(() => { shareCardBtn.innerHTML = originalText; }, 2000);
      } catch {
        prompt('Copia este enlace para compartir:', shareUrl);
      }
    });
  }

  // 1. Check if card data is embedded directly (Standalone portable file)
  if (window.EMBEDDED_CARD_DATA) {
    activeCardId = window.EMBEDDED_CARD_DATA.id;
    renderCard(window.EMBEDDED_CARD_DATA);
    return;
  }

  // 2. Check if card data is passed in URL hash (Universal serverless card)
  if (window.location.hash && window.location.hash.includes('data=')) {
    try {
      const b64 = window.location.hash.split('data=')[1];
      const json = decodeURIComponent(escape(atob(b64)));
      const parsedData = JSON.parse(json);
      if (parsedData && parsedData.items) {
        activeCardId = parsedData.id;
        renderCard(parsedData);
        return;
      }
    } catch (e) {
      console.warn('Error reading hash data:', e);
    }
  }

  // 3. Get Card ID from path or query and fetch from server
  function getCardId() {
    const pathParts = window.location.pathname.split('/');
    const cardIdx = pathParts.indexOf('card');
    if (cardIdx !== -1 && pathParts[cardIdx + 1]) {
      return pathParts[cardIdx + 1].trim();
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  const cardId = getCardId();
  activeCardId = cardId;
  if (!cardId) {
    showError('No se especificó ningún código de tarjeta navideña.');
    return;
  }

  try {
    const res = await fetch(`/api/cards/${encodeURIComponent(cardId)}`);
    if (!res.ok) {
      throw new Error('Tarjeta no encontrada');
    }
    const cardData = await res.json();
    renderCard(cardData);
  } catch (err) {
    console.error(err);
    showError('No se pudo encontrar o cargar esta tarjeta navideña.');
  }

  function showError(msg) {
    cardLoading.classList.add('hidden');
    cardError.classList.remove('hidden');
    if (msg) {
      const errP = cardError.querySelector('p');
      if (errP) errP.textContent = msg;
    }
  }

  function renderCard(data) {
    cardLoading.classList.add('hidden');

    // 1. Apply festive theme
    if (data.theme) {
      cardBody.className = `theme-${data.theme} min-h-screen relative text-slate-100 flex flex-col selection:bg-red-500 selection:text-white`;
    }

    // 2. Set Header Data and Omit empty optional fields
    cardTitle.textContent = data.title || 'Mis Deseos Navideños';

    // Recipient & Sender Handling (Omit if empty)
    const hasRecipient = Boolean(data.recipient && data.recipient.trim());
    const hasSender = Boolean(data.sender && data.sender.trim());

    if (hasRecipient) {
      recipientName.textContent = data.recipient.trim();
      recipientBox.classList.remove('hidden');
    } else {
      recipientBox.classList.add('hidden');
    }

    if (hasSender) {
      senderName.textContent = data.sender.trim();
      senderBox.classList.remove('hidden');
    } else {
      senderBox.classList.add('hidden');
    }

    if (!hasRecipient && !hasSender) {
      deParaContainer.classList.add('hidden');
    } else {
      deParaContainer.classList.remove('hidden');
    }

    // Message Handling (Omit if empty)
    if (data.message && data.message.trim()) {
      cardMessageText.textContent = data.message.trim();
      messageContainer.classList.remove('hidden');
    } else {
      messageContainer.classList.add('hidden');
    }

    document.title = `${data.title || 'Tarjeta Navideña'} ${hasRecipient ? '- Para: ' + data.recipient : ''}`;

    // 3. Render items strictly in order of entry
    const items = data.items || [];
    itemsTotalBadge.textContent = `${items.length} ${items.length === 1 ? 'deseo' : 'deseos'}`;

    cardItemsContainer.innerHTML = '';

    if (items.length === 0) {
      cardItemsContainer.innerHTML = `
        <div class="col-span-full text-center py-8 text-slate-300">
          No hay artículos agregados en esta tarjeta.
        </div>
      `;
      return;
    }

    // Sort by order just in case
    items.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Local tracker of items claimed on this client
    const myClaimedMap = JSON.parse(localStorage.getItem(`navidad_claims_${data.id}`) || '{}');

    items.forEach((item, index) => {
      const orderNum = item.order || (index + 1);
      const isClaimed = Boolean(item.claimed);
      const isMyClaim = Boolean(myClaimedMap[item.id]);
      const safeImageSrc = sanitizeImageSrc(item.image);
      const safeLink = sanitizeLink(item.url);

      const itemCard = document.createElement('div');
      itemCard.className = `wishlist-item-card relative bg-stone-900/90 border-2 ${isClaimed ? 'border-emerald-500/60 ring-2 ring-emerald-500/20' : 'border-amber-400/40 hover:border-amber-400'} rounded-2xl p-5 shadow-2xl backdrop-blur-sm transition-all duration-300 flex flex-col justify-between group`;
      itemCard.dataset.itemId = item.id;

      itemCard.innerHTML = `
        <!-- Cinta con número de orden (#1, #2, etc.) -->
        <div class="ribbon-badge">
          🎁 Deseo #${orderNum}
        </div>

        <div>
          <!-- Contenedor de la Imagen Referencial con efecto zoom -->
          <div class="relative w-full h-52 sm:h-56 rounded-xl overflow-hidden bg-black/50 border border-white/10 mb-4 flex items-center justify-center cursor-pointer group-hover:shadow-lg transition-all image-preview-trigger">
            <img src="${safeImageSrc}" alt="${escapeHtml(item.title)}" class="w-full h-full object-contain p-2 rounded-xl transition-transform duration-300 group-hover:scale-105" onerror="this.src='/images/default-gift.svg'">
            <div class="absolute bottom-2 right-2 bg-black/75 hover:bg-black text-[11px] text-amber-300 px-2 py-1 rounded-md border border-white/20 flex items-center gap-1">
              <span>🔍</span> Ampliar
            </div>
            ${item.priority === 'alta' ? `
            <div class="absolute top-2 right-2 bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow border border-amber-300">
              ⭐ ¡Muy Querido!
            </div>
            ` : ''}
          </div>

          <!-- Título y Tienda -->
          <div class="mb-4">
            <div class="flex flex-wrap items-center gap-1.5 mb-1">
              <span class="text-[11px] uppercase font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                ${escapeHtml(item.siteName || 'Enlace')}
              </span>
              <span class="text-[11px] text-slate-400">#${orderNum}</span>
              ${item.price ? `
              <span class="text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                🏷️ ${escapeHtml(item.price)}
              </span>
              ` : ''}
            </div>
            <h3 class="text-base sm:text-lg font-bold text-white leading-snug group-hover:text-amber-200 transition-colors">
              ${escapeHtml(item.title)}
            </h3>
            ${item.description ? `<p class="text-xs text-slate-300 mt-1 line-clamp-2">${escapeHtml(item.description)}</p>` : ''}
          </div>
        </div>

        <!-- Botones de Acción (Enlace y Elegir Regalo) -->
        <div class="pt-3 border-t border-white/10 flex flex-col gap-2">
          <!-- Botón de Enlace al Artículo o Foto -->
          ${safeLink ? `
          <a href="${safeLink}" target="_blank" rel="noopener noreferrer" class="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2">
            <span>🔗</span> Ver artículo en la tienda
          </a>
          ` : `
          <button type="button" class="view-item-photo-btn w-full bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-400/30 font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2">
            <span>📸</span> Ver foto del deseo
          </button>
          `}

          <!-- Botón Interactivo de Reserva: "¡Yo te regalo este!" -->
          <button type="button" class="claim-gift-btn w-full ${isClaimed ? 'bg-emerald-700 text-white border-emerald-400' : 'bg-white/10 hover:bg-emerald-600 text-emerald-300 hover:text-white border-emerald-500/40'} border font-semibold py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm">
            ${isClaimed 
              ? `<span>🎁</span> Apartado ${item.claimedBy ? 'por ' + escapeHtml(item.claimedBy) : '✓'}`
              : `<span>🎁</span> ¡Yo elijo regalarte este!`
            }
          </button>
        </div>
      `;

      // Lightbox click on image or photo button
      const imgTrigger = itemCard.querySelector('.image-preview-trigger');
      const photoBtn = itemCard.querySelector('.view-item-photo-btn');
      const openLightbox = () => {
        lightboxImg.src = safeImageSrc;
        lightboxCaption.textContent = `#${orderNum} - ${item.title}`;
        imageLightboxModal.classList.remove('hidden');
      };
      if (imgTrigger) imgTrigger.addEventListener('click', openLightbox);
      if (photoBtn) photoBtn.addEventListener('click', openLightbox);

      // Claim Gift button interaction
      const claimBtn = itemCard.querySelector('.claim-gift-btn');
      claimBtn.addEventListener('click', () => {
        handleClaimClick(item, claimBtn, itemCard, data.id);
      });

      cardItemsContainer.appendChild(itemCard);
    });

    // Update Layout Classes
    updateLayoutUI();

    // Initial festive welcome confetti
    setTimeout(() => {
      if (window.confetti) {
        window.confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.3 }
        });
      }
    }, 500);
  }

  // Claim click handler (handles both claim modal and unclaim if already chosen)
  function handleClaimClick(item, btn, itemCard, cardId) {
    const isAlreadyClaimed = Boolean(item.claimed);

    if (isAlreadyClaimed) {
      const confirmUnclaim = confirm(`Este regalo ya está marcado como apartado${item.claimedBy ? ' por ' + item.claimedBy : ''}. ¿Deseas liberar la reserva para que alguien más pueda elegirlo?`);
      if (!confirmUnclaim) return;

      unclaimGift(item, btn, itemCard, cardId);
      return;
    }

    // Open claim modal
    activeClaimTarget = { item, btn, itemCard, cardId };
    if (claimItemTitle) claimItemTitle.textContent = item.title;
    if (claimNameInput) claimNameInput.value = localStorage.getItem('navidad_user_name') || '';
    if (claimModal) claimModal.classList.remove('hidden');
    if (claimNameInput) claimNameInput.focus();
  }

  // Confirm claim in modal
  if (confirmClaimBtn) {
    confirmClaimBtn.addEventListener('click', async () => {
      if (!activeClaimTarget) return;
      const { item, btn, itemCard, cardId } = activeClaimTarget;
      const claimedBy = claimNameInput ? claimNameInput.value.trim() : '';
      if (claimedBy) {
        localStorage.setItem('navidad_user_name', claimedBy);
      }

      confirmClaimBtn.disabled = true;
      confirmClaimBtn.innerHTML = `<span>❄️</span> Apartando...`;

      try {
        const res = await fetch(`/api/cards/${encodeURIComponent(cardId)}/items/${encodeURIComponent(item.id)}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimedBy })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.error || 'No se pudo apartar el regalo');
        }

        // Success: update state
        item.claimed = true;
        item.claimedBy = claimedBy;

        const myClaims = JSON.parse(localStorage.getItem(`navidad_claims_${cardId}`) || '{}');
        myClaims[item.id] = true;
        localStorage.setItem(`navidad_claims_${cardId}`, JSON.stringify(myClaims));

        btn.className = 'claim-gift-btn w-full bg-emerald-700 text-white border border-emerald-400 font-semibold py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm';
        btn.innerHTML = `<span>🎁</span> Apartado ${claimedBy ? 'por ' + escapeHtml(claimedBy) : '✓'}`;
        itemCard.classList.add('border-emerald-500/60', 'ring-2', 'ring-emerald-500/20');

        if (window.confetti) {
          window.confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
        }
      } catch (err) {
        alert(err.message);
      } finally {
        confirmClaimBtn.disabled = false;
        confirmClaimBtn.innerHTML = `<span>✓</span> Confirmar Elección`;
        if (claimModal) claimModal.classList.add('hidden');
        activeClaimTarget = null;
      }
    });
  }

  // Unclaim gift
  async function unclaimGift(item, btn, itemCard, cardId) {
    try {
      const res = await fetch(`/api/cards/${encodeURIComponent(cardId)}/items/${encodeURIComponent(item.id)}/unclaim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'No se pudo liberar');

      item.claimed = false;
      item.claimedBy = '';

      const myClaims = JSON.parse(localStorage.getItem(`navidad_claims_${cardId}`) || '{}');
      delete myClaims[item.id];
      localStorage.setItem(`navidad_claims_${cardId}`, JSON.stringify(myClaims));

      btn.className = 'claim-gift-btn w-full bg-white/10 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 font-semibold py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm';
      btn.innerHTML = `<span>🎁</span> ¡Yo elijo regalarte este!`;
      itemCard.classList.remove('border-emerald-500/60', 'ring-2', 'ring-emerald-500/20');
    } catch (err) {
      alert(err.message);
    }
  }

  // Close modals
  if (closeClaimModalBtn && claimModal) {
    closeClaimModalBtn.addEventListener('click', () => {
      claimModal.classList.add('hidden');
      activeClaimTarget = null;
    });
  }
  if (claimModal) {
    claimModal.addEventListener('click', (e) => {
      if (e.target === claimModal) {
        claimModal.classList.add('hidden');
        activeClaimTarget = null;
      }
    });
  }

  // Lightbox Close
  if (closeLightboxBtn) {
    closeLightboxBtn.addEventListener('click', () => {
      imageLightboxModal.classList.add('hidden');
    });
  }
  if (imageLightboxModal) {
    imageLightboxModal.addEventListener('click', (e) => {
      if (e.target === imageLightboxModal) {
        imageLightboxModal.classList.add('hidden');
      }
    });
  }

  function sanitizeImageSrc(src) {
    if (!src || typeof src !== 'string') return '/images/default-gift.svg';
    const s = src.trim();
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/images/') || s.startsWith('/uploads/') || s.startsWith('data:image/')) {
      return s;
    }
    return '/images/default-gift.svg';
  }

  function sanitizeLink(url) {
    if (!url || typeof url !== 'string') return '';
    const u = url.trim();
    return (/^https?:\/\//i.test(u)) ? u : '';
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
});
