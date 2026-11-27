'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cheerio = require('cheerio');
const axios = require('axios');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { CardStore } = require('./lib/storage');
const { createUploads } = require('./lib/uploads');
const { getAllValidNetworkIps, getLocalNetworkIp, isLocalOwner, isLocalOrPrivateHost } = require('./lib/network');
const tunnel = require('./lib/tunnel');
const gdrive = require('./lib/gdrive');
const {
  safeAxiosOptions,
  assertPublicHttpUrl,
  sanitizeCardInput,
  escapeHtml,
  safeJsonForHtml,
  newToken,
  safeEqual,
  cleanText,
  cleanHttpUrl,
  DEFAULT_IMAGE
} = require('./lib/security');

// Crash prevention for Render / Production
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception interceptada:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection interceptada:', reason);
});

const app = express();
const PORT = process.env.PORT || 3000;

// Storage & Uploads paths
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(dataDir, 'uploads');
const cardsFilePath = path.join(dataDir, 'cards.json');

const cardStore = new CardStore(cardsFilePath);
const uploads = createUploads(uploadsDir);

// -------------------------------------------------------------
// Middlewares
// -------------------------------------------------------------
app.set('trust proxy', 1);

app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: false, // Permitir fuentes locales, data: images y Web Audio API sin bloqueo
    crossOriginEmbedderPolicy: false
  })
);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

// Rate limiters
const previewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de vista previa. Intenta nuevamente en un minuto.' }
});

const cardsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite de creación de tarjetas alcanzado. Espera unos minutos.' }
});

// -------------------------------------------------------------
// Diagnostic & Tunnel Endpoints
// -------------------------------------------------------------
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/ping', (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    localNetworkIp: getLocalNetworkIp(),
    tunnel: tunnel.getState(),
    drive: gdrive.getDriveStatus()
  });
});

app.get('/api/drive/status', (req, res) => {
  res.json(gdrive.getDriveStatus());
});

app.post('/api/drive/sync', async (req, res) => {
  const result = await gdrive.syncCardsToDrive(cardStore.all());
  res.json(result);
});

app.get('/api/backup/download', (req, res) => {
  const cards = cardStore.all();
  const jsonStr = JSON.stringify(cards, null, 2);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="tarjetas_navidad_backup_${Date.now()}.json"`);
  res.send(jsonStr);
});

app.post('/api/backup/restore', (req, res) => {
  if (!isLocalOwner(req)) {
    const adminToken = req.headers['x-admin-token'];
    if (!adminToken) return res.status(403).json({ error: 'No autorizado para restaurar respaldo' });
  }
  const cards = req.body;
  if (!cards || typeof cards !== 'object' || Array.isArray(cards)) {
    return res.status(400).json({ error: 'Formato de respaldo JSON inválido' });
  }
  Object.entries(cards).forEach(([id, card]) => {
    cardStore.set(id, card);
  });
  res.json({ success: true, count: Object.keys(cards).length });
});

app.get('/api/tunnel/status', (req, res) => {
  res.json(tunnel.getState());
});

app.post('/api/tunnel/start', async (req, res) => {
  try {
    const state = await tunnel.start(PORT);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tunnel/stop', (req, res) => {
  const state = tunnel.stop();
  res.json(state);
});

// Helper to determine the best public base URL
function getBaseUrl(req, requestedIp) {
  const tunnelState = tunnel.getState();
  if (tunnelState.status === 'running' && tunnelState.url) {
    return tunnelState.url;
  }
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/$/, '');
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
  }

  const hostHeader = req.get('host') || '';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';

  // If request arrives from outside via custom domain or proxy
  if (hostHeader && !isLocalOrPrivateHost(hostHeader.split(':')[0])) {
    return `${protocol}://${hostHeader}`;
  }

  const ip = (requestedIp && requestedIp !== 'localhost') ? requestedIp : getLocalNetworkIp();
  return (ip !== 'localhost') ? `http://${ip}:${PORT}` : `http://localhost:${PORT}`;
}

// Endpoint: Get available network IPs & Tunnel status
app.get('/api/network-ips', (req, res) => {
  const ips = getAllValidNetworkIps();
  const tunnelState = tunnel.getState();
  res.json({
    defaultIp: ips.length > 0 ? ips[0].ip : 'localhost',
    port: PORT,
    candidates: ips,
    tunnel: tunnelState,
    isLocalOwner: isLocalOwner(req)
  });
});

// -------------------------------------------------------------
// Referential Image Matcher (Unsplash)
// -------------------------------------------------------------
function getReferentialImage(title, categoryName = '') {
  const text = `${title} ${categoryName}`.toLowerCase();

  if (/aud[ií]fono|auricular|headphone|airpod|earbud/i.test(text)) {
    return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80';
  }
  if (/su[eé]ter|ropa|vestid|poler|chaqueta|abrigo|camisa|pantal[oó]n|navide[ñn]o/i.test(text)) {
    return 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=700&auto=format&fit=crop&q=80';
  }
  if (/cafeter|caf[eé]|espresso|capuchino|barista/i.test(text)) {
    return 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=700&auto=format&fit=crop&q=80';
  }
  if (/playstation|ps5|ps4|xbox|nintendo|switch|consola|gamer|joystick|gamepad|videojuego/i.test(text)) {
    return 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=700&auto=format&fit=crop&q=80';
  }
  if (/celular|smart|phone|iphone|samsung|xiaomi|motorola|m[oó]vil|huawei/i.test(text)) {
    return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=700&auto=format&fit=crop&q=80';
  }
  if (/reloj|smartwatch|band|garmin|apple watch/i.test(text)) {
    return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&auto=format&fit=crop&q=80';
  }
  if (/perfume|fragancia|colonia|locion|aroma/i.test(text)) {
    return 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=700&auto=format&fit=crop&q=80';
  }
  if (/zapatilla|calzado|zapato|sneaker|bota|chala/i.test(text)) {
    return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700&auto=format&fit=crop&q=80';
  }
  if (/termo|stanley|botella|mug|vaso|vasos/i.test(text)) {
    return 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=700&auto=format&fit=crop&q=80';
  }
  if (/notebook|laptop|computador|pc|teclado|monitor|mouse/i.test(text)) {
    return 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=700&auto=format&fit=crop&q=80';
  }
  if (/mochila|bolso|cartera|maleta|morral/i.test(text)) {
    return 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=700&auto=format&fit=crop&q=80';
  }
  if (/bicicleta|scooter|patin|monopat[ií]n/i.test(text)) {
    return 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=700&auto=format&fit=crop&q=80';
  }
  if (/libro|novela|lectura|manga|comic|kindle/i.test(text)) {
    return 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=700&auto=format&fit=crop&q=80';
  }
  if (/juguete|lego|mu[ñn]ec|peluche|figura|juego de mesa/i.test(text)) {
    return 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=700&auto=format&fit=crop&q=80';
  }
  if (/c[aá]mara|foto|lente|gopro|dron/i.test(text)) {
    return 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=700&auto=format&fit=crop&q=80';
  }
  if (/guitarra|piano|teclado musical|instrumento|bater[ií]a/i.test(text)) {
    return 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=700&auto=format&fit=crop&q=80';
  }
  if (/herramienta|taladro|soldadora|set destornillador/i.test(text)) {
    return 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=700&auto=format&fit=crop&q=80';
  }
  if (/maquillaje|labial|sombras|cosmetico|skincare/i.test(text)) {
    return 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=700&auto=format&fit=crop&q=80';
  }
  if (/vino|cerveza|whisky|licor|champagne|espumante/i.test(text)) {
    return 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=700&auto=format&fit=crop&q=80';
  }

  return DEFAULT_IMAGE;
}

// -------------------------------------------------------------
// Mercado Libre Metadata Extractor
// -------------------------------------------------------------
async function extractMercadoLibreData(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    const isMeli = /(?:mercadolibre|mercadolivre)\./i.test(hostname);
    if (!isMeli) return null;

    let siteName = 'Mercado Libre';
    let siteId = 'MLC';
    if (hostname.endsWith('.cl')) { siteName = 'Mercado Libre Chile'; siteId = 'MLC'; }
    else if (hostname.endsWith('.com.ar')) { siteName = 'Mercado Libre Argentina'; siteId = 'MLA'; }
    else if (hostname.endsWith('.com.mx')) { siteName = 'Mercado Libre México'; siteId = 'MLM'; }
    else if (hostname.endsWith('.com.co')) { siteName = 'Mercado Libre Colombia'; siteId = 'MCO'; }
    else if (hostname.endsWith('.com.pe')) { siteName = 'Mercado Libre Perú'; siteId = 'MPE'; }
    else if (hostname.endsWith('.com.uy')) { siteName = 'Mercado Libre Uruguay'; siteId = 'MLU'; }
    else if (hostname.endsWith('.com.br')) { siteName = 'Mercado Livre Brasil'; siteId = 'MLB'; }
    else if (hostname.endsWith('.com.ec')) { siteName = 'Mercado Libre Ecuador'; siteId = 'MEC'; }
    else if (hostname.endsWith('.com.ve')) { siteName = 'Mercado Libre Venezuela'; siteId = 'MLV'; }

    const pathname = decodeURIComponent(parsed.pathname);
    let rawTitle = '';

    const matchArticulo = pathname.match(/\/M[A-Z]{2}[-_]?\d+[-_](.+?)(?:[-_]JM|\.html|\?|#|$)/i);
    if (matchArticulo && matchArticulo[1]) rawTitle = matchArticulo[1];

    if (!rawTitle) {
      const matchPdp = pathname.match(/\/([^\/]+)\/p\/M[A-Z]{2}\d+/i);
      if (matchPdp && matchPdp[1]) rawTitle = matchPdp[1];
    }
    if (!rawTitle) {
      const matchPonly = pathname.match(/\/p\/(M[A-Z]{2}\d+)/i);
      if (matchPonly) rawTitle = `Artículo en ${siteName} (${matchPonly[1]})`;
    }
    if (!rawTitle) {
      const segs = pathname.split('/').filter(Boolean);
      if (segs.length > 0) {
        rawTitle = segs[segs.length - 1].replace(/^M[A-Z]{2}[-_]?\d+[-_]?/i, '').replace(/[-_]JM$/i, '');
      }
    }

    let cleanTitle = rawTitle.replace(/[-_]+/g, ' ').replace(/\b(JM|pdp|filters|category)\b/gi, '').replace(/\s+/g, ' ').trim();

    const accentsMap = {
      audifonos: 'Audífonos', auriculares: 'Auriculares', inalambricos: 'Inalámbricos', inalambrico: 'Inalámbrico',
      sueter: 'Suéter', navideno: 'Navideño', navidena: 'Navideña', arbol: 'Árbol', cafe: 'Café', camara: 'Cámara',
      telefono: 'Teléfono', electronica: 'Electrónica', musica: 'Música', pantalla: 'Pantalla', bateria: 'Batería',
      optica: 'Óptica', lampara: 'Lámpara', tws: 'TWS', led: 'LED', rgb: 'RGB', usb: 'USB', hd: 'HD', '4k': '4K',
      ps5: 'PS5', ps4: 'PS4', pro: 'Pro', max: 'Max', plus: 'Plus', bluetooth: 'Bluetooth'
    };

    cleanTitle = cleanTitle.split(' ').map(word => {
      const lower = word.toLowerCase();
      if (accentsMap[lower]) return accentsMap[lower];
      if (word.length <= 2 && !['de', 'en', 'la', 'el', 'y', 'con', 'al', 'un', 'o'].includes(lower)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ').trim();

    if (!cleanTitle) cleanTitle = 'Artículo en ' + siteName;

    let image = null;
    let categoryName = '';
    try {
      const discoveryRes = await axios.get(
        `https://api.mercadolibre.com/sites/${siteId}/domain_discovery/search?q=${encodeURIComponent(cleanTitle.slice(0, 60))}`,
        { ...safeAxiosOptions, timeout: 2500 }
      );
      if (discoveryRes.data && discoveryRes.data[0]) {
        categoryName = discoveryRes.data[0].category_name || '';
        const catId = discoveryRes.data[0].category_id;
        if (catId) {
          const catRes = await axios.get(`https://api.mercadolibre.com/categories/${catId}`, { ...safeAxiosOptions, timeout: 2500 });
          if (catRes.data?.picture) image = catRes.data.picture;
        }
      }
    } catch {}

    if (!image) image = getReferentialImage(cleanTitle, categoryName);

    return { url: rawUrl, title: cleanTitle, description: `Artículo de ${siteName}`, image, siteName };
  } catch (err) {
    return null;
  }
}

// -------------------------------------------------------------
// Endpoint: Scrape link preview (Protected against SSRF)
// -------------------------------------------------------------
app.get('/api/preview', previewLimiter, async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Falta el parámetro url' });

  targetUrl = targetUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;

  try {
    assertPublicHttpUrl(targetUrl);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'URL inválida o restringida' });
  }

  // Quick check: If the URL directly points to an image
  const imageExtensions = /\.(jpg|jpeg|png|webp|gif|svg|avif)(\?.*)?$/i;
  if (imageExtensions.test(targetUrl)) {
    try {
      const parsed = new URL(targetUrl);
      const filename = parsed.pathname.split('/').pop() || 'Imagen del artículo';
      return res.json({
        url: targetUrl,
        title: decodeURIComponent(filename).replace(/\.[^/.]+$/, ''),
        description: 'Enlace directo a imagen',
        image: targetUrl,
        siteName: parsed.hostname
      });
    } catch {}
  }

  // Specialized extractor for Google Drive
  try {
    const gdriveData = gdrive.extractGoogleDriveData(targetUrl);
    if (gdriveData) return res.json(gdriveData);
  } catch {}

  // Specialized extractor for Mercado Libre
  try {
    const parsed = new URL(targetUrl);
    if (/(?:mercadolibre|mercadolivre)\./i.test(parsed.hostname)) {
      const meliData = await extractMercadoLibreData(targetUrl);
      if (meliData) return res.json(meliData);
    }
  } catch {}

  // 1. Primary scrape with browser headers & SSRF protection
  try {
    const response = await axios.get(targetUrl, {
      ...safeAxiosOptions,
      timeout: 7000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      maxRedirects: 5
    });

    const html = response.data;
    if (typeof html === 'string') {
      const $ = cheerio.load(html);
      const parsedUrl = new URL(targetUrl);

      let title =
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('meta[name="title"]').attr('content') ||
        $('title').text() ||
        $('h1').first().text() ||
        parsedUrl.hostname;
      title = (title || '').trim();

      let description =
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="twitter:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        '';
      description = (description || '').trim();

      let image =
        $('meta[property="og:image:secure_url"]').attr('content') ||
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image:src"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        $('link[rel="image_src"]').attr('href') ||
        $('meta[itemprop="image"]').attr('content') ||
        '';

      if (!image) {
        $('script[type="application/ld+json"]').each((_, elem) => {
          try {
            const json = JSON.parse($(elem).html() || '{}');
            const findImg = (obj) => {
              if (!obj) return null;
              if (obj.image) {
                if (typeof obj.image === 'string') return obj.image;
                if (Array.isArray(obj.image) && obj.image.length > 0) return typeof obj.image[0] === 'string' ? obj.image[0] : obj.image[0].url;
                if (obj.image.url) return obj.image.url;
              }
              return null;
            };
            const found = findImg(json);
            if (found && !image) image = found;
          } catch {}
        });
      }

      if (image && !/^https?:\/\//i.test(image)) {
        try { image = new URL(image, targetUrl).href; } catch {}
      }

      const siteName = $('meta[property="og:site_name"]').attr('content') || parsedUrl.hostname.replace(/^www\./, '');

      if (image) {
        return res.json({
          url: targetUrl,
          title: title || 'Artículo deseado',
          description,
          image,
          siteName
        });
      }
    }
  } catch (err) {}

  // 2. Fallback to public Microlink API
  try {
    const microlinkRes = await axios.get(
      `https://api.microlink.io?url=${encodeURIComponent(targetUrl)}`,
      { ...safeAxiosOptions, timeout: 6000 }
    );
    if (microlinkRes.data?.status === 'success' && microlinkRes.data.data) {
      const data = microlinkRes.data.data;
      const parsedUrl = new URL(targetUrl);
      const img = data.image?.url || data.logo?.url || null;
      return res.json({
        url: targetUrl,
        title: data.title || parsedUrl.hostname,
        description: data.description || '',
        image: img || DEFAULT_IMAGE,
        siteName: data.publisher || parsedUrl.hostname.replace(/^www\./, '')
      });
    }
  } catch {}

  // 3. Fallback referencial
  try {
    const parsedUrl = new URL(targetUrl);
    return res.json({
      url: targetUrl,
      title: parsedUrl.hostname.replace(/^www\./, '') + ' - Artículo de regalo',
      description: 'Enlace guardado en la lista de deseos navideños',
      image: DEFAULT_IMAGE,
      siteName: parsedUrl.hostname.replace(/^www\./, ''),
      needsManualImage: true
    });
  } catch {
    return res.json({
      url: targetUrl,
      title: 'Regalo Navideño',
      description: '',
      image: DEFAULT_IMAGE,
      siteName: 'Enlace web',
      needsManualImage: true
    });
  }
});

// -------------------------------------------------------------
// Card Endpoints: Create, Get, Update, Claim, Delete
// -------------------------------------------------------------
app.post('/api/cards', cardsLimiter, async (req, res) => {
  try {
    const sanitized = sanitizeCardInput(req.body);
    if (sanitized.items.length === 0) {
      return res.status(400).json({ error: 'Debes incluir al menos un enlace o regalo en la lista.' });
    }

    // Persist any uploaded base64 images as disk files
    sanitized.items.forEach(it => {
      it.image = uploads.normalizeItemImage(it.image);
    });

    const id = 'navidad-' + crypto.randomBytes(4).toString('hex');
    const adminToken = newToken();
    const createdAt = new Date().toISOString();

    const cardData = {
      id,
      adminToken,
      ...sanitized,
      createdAt,
      updatedAt: createdAt
    };

    cardStore.set(id, cardData);

    // Compute URLs
    const baseUrl = getBaseUrl(req, req.body.selectedIp);
    const localUrl = `http://localhost:${PORT}/card/${id}`;
    const lanUrl = `http://${getLocalNetworkIp()}:${PORT}/card/${id}`;
    const qrTargetUrl = `${baseUrl}/card/${id}`;

    // Generate festive QR code
    const qrCodeDataUrl = await QRCode.toDataURL(qrTargetUrl, {
      width: 450,
      margin: 2,
      color: {
        dark: '#991b1b',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });

    // Public card object without secret admin token
    const publicCard = { ...cardData };
    delete publicCard.adminToken;

    return res.json({
      success: true,
      id,
      adminToken,
      card: publicCard,
      localUrl,
      lanUrl,
      qrTargetUrl,
      qrCodeDataUrl
    });
  } catch (err) {
    console.error('Error creating card:', err);
    return res.status(500).json({ error: 'Error al generar la tarjeta navideña' });
  }
});

// Endpoint: Regenerate QR for a specific IP or custom URL
app.post('/api/qr', async (req, res) => {
  try {
    const { cardId, selectedIp } = req.body;
    if (!cardId) return res.status(400).json({ error: 'Falta cardId' });

    let baseUrl = getBaseUrl(req, selectedIp);
    if (selectedIp === 'localhost') {
      baseUrl = `http://localhost:${PORT}`;
    } else if (selectedIp && selectedIp.startsWith('http')) {
      baseUrl = selectedIp.replace(/\/$/, '');
    }

    const targetUrl = `${baseUrl}/card/${cardId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 450,
      margin: 2,
      color: { dark: '#991b1b', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    });

    return res.json({ success: true, targetUrl, qrCodeDataUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint: Generate QR for arbitrary custom URL
app.post('/api/qr-custom', async (req, res) => {
  try {
    const { targetUrl } = req.body;
    if (!targetUrl) return res.status(400).json({ error: 'Falta targetUrl' });

    const qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 450,
      margin: 2,
      color: { dark: '#991b1b', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    });

    return res.json({ success: true, targetUrl, qrCodeDataUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint: List cards (filtered if not local owner)
app.get('/api/cards', (req, res) => {
  const allCards = cardStore.all();
  const filterIds = req.query.ids ? String(req.query.ids).split(',').map(s => s.trim()) : null;
  const isOwner = isLocalOwner(req);

  let list = Object.values(allCards);

  if (filterIds && filterIds.length > 0) {
    const set = new Set(filterIds);
    list = list.filter(c => set.has(c.id));
  } else if (!isOwner) {
    // If remote visitor and no explicit ID filter provided, return empty to prevent global scraping
    list = [];
  }

  const sanitizedList = list.map(c => ({
    id: c.id,
    title: c.title || 'Deseos Navideños',
    recipient: c.recipient || '',
    sender: c.sender || '',
    theme: c.theme || 'classic-red',
    itemCount: Array.isArray(c.items) ? c.items.length : 0,
    items: c.items || [],
    createdAt: c.createdAt || new Date().toISOString()
  })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.json({
    total: sanitizedList.length,
    cards: sanitizedList
  });
});

// Endpoint: Get Card by ID
app.get('/api/cards/:id', (req, res) => {
  const card = cardStore.get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Tarjeta navideña no encontrada' });

  const publicCard = { ...card };
  delete publicCard.adminToken;
  return res.json(publicCard);
});

// Endpoint: Claim / Reserve a gift item
app.post('/api/cards/:id/items/:itemId/claim', (req, res) => {
  const card = cardStore.get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Tarjeta no encontrada' });

  const item = (card.items || []).find(it => String(it.id) === String(req.params.itemId));
  if (!item) return res.status(404).json({ error: 'Artículo no encontrado' });

  const claimedBy = cleanText(req.body.claimedBy, 60) || 'Alguien con cariño';
  item.claimed = true;
  item.claimedBy = claimedBy;
  item.claimedAt = new Date().toISOString();

  card.updatedAt = new Date().toISOString();
  cardStore.set(card.id, card);

  return res.json({ success: true, item });
});

// Endpoint: Unclaim / Release a gift item
app.post('/api/cards/:id/items/:itemId/unclaim', (req, res) => {
  const card = cardStore.get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Tarjeta no encontrada' });

  const item = (card.items || []).find(it => String(it.id) === String(req.params.itemId));
  if (!item) return res.status(404).json({ error: 'Artículo no encontrado' });

  item.claimed = false;
  item.claimedBy = '';
  item.claimedAt = null;

  card.updatedAt = new Date().toISOString();
  cardStore.set(card.id, card);

  return res.json({ success: true, item });
});

// Endpoint: Delete a card (requires Admin Token or Local Owner)
app.delete('/api/cards/:id', (req, res) => {
  const card = cardStore.get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Tarjeta navideña no encontrada' });

  const providedToken = req.headers['x-admin-token'] || req.query.token;
  const isAuthorized = isLocalOwner(req) || (card.adminToken && safeEqual(providedToken, card.adminToken));

  if (!isAuthorized) {
    return res.status(403).json({ error: 'No autorizado para eliminar esta tarjeta' });
  }

  cardStore.delete(req.params.id);
  return res.json({ success: true, message: `Tarjeta ${req.params.id} eliminada exitosamente.` });
});

// -------------------------------------------------------------
// Web Route: /card/:id with dynamic Open Graph tags
// -------------------------------------------------------------
app.get('/card/:id', (req, res) => {
  const card = cardStore.get(req.params.id);
  const cardHtmlPath = path.join(__dirname, 'public', 'card.html');

  if (!fs.existsSync(cardHtmlPath)) {
    return res.status(404).send('Página no encontrada');
  }

  let html = fs.readFileSync(cardHtmlPath, 'utf-8');

  if (card) {
    const cardTitle = `${escapeHtml(card.title || 'Mis Deseos Navideños 🎄')}${card.recipient ? ' - Para: ' + escapeHtml(card.recipient) : ''}`;
    const cardDesc = card.message
      ? escapeHtml(card.message)
      : `Mira la lista de ${card.items ? card.items.length : 0} deseos navideños preparados con cariño.`;

    // Dynamic OpenGraph meta injection
    html = html.replace(/<title>.*?<\/title>/i, `<title>${cardTitle}</title>`);
    html = html.replace(/<meta property="og:title" content=".*?">/i, `<meta property="og:title" content="${cardTitle}">`);
    html = html.replace(/<meta property="og:description" content=".*?">/i, `<meta property="og:description" content="${cardDesc}">`);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// -------------------------------------------------------------
// Endpoint: Download standalone portable HTML card
// (Embeds all CSS, scripts, and converts images into Base64 so it works 100% offline)
// -------------------------------------------------------------
app.get('/api/download-card/:id', (req, res) => {
  const card = cardStore.get(req.params.id);
  if (!card) return res.status(404).send('Tarjeta no encontrada');

  try {
    let html = fs.readFileSync(path.join(__dirname, 'public', 'card.html'), 'utf-8');
    const tailwindCss = fs.existsSync(path.join(__dirname, 'public', 'css', 'tailwind.css'))
      ? fs.readFileSync(path.join(__dirname, 'public', 'css', 'tailwind.css'), 'utf-8')
      : '';
    const styleCss = fs.readFileSync(path.join(__dirname, 'public', 'css', 'style.css'), 'utf-8');
    const confettiJs = fs.readFileSync(path.join(__dirname, 'public', 'vendor', 'confetti.browser.js'), 'utf-8');
    const snowJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'snow.js'), 'utf-8');
    const audioJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'audio.js'), 'utf-8');
    const cardJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'card.js'), 'utf-8');

    // Create self-contained copy of card with local images converted to data URLs
    const portableCard = JSON.parse(JSON.stringify(card));
    delete portableCard.adminToken;
    portableCard.items = (portableCard.items || []).map(it => ({
      ...it,
      image: uploads.localImageToDataUrl(path.join(__dirname, 'public'), it.image)
    }));

    // Inline CSS
    html = html.replace('<link rel="stylesheet" href="/css/tailwind.css">', `<style>${tailwindCss}</style>`);
    html = html.replace('<link rel="stylesheet" href="/css/style.css">', `<style>${styleCss}</style>`);

    // Inlined embedded scripts
    const embeddedPayload = `
      <script>window.EMBEDDED_CARD_DATA = ${safeJsonForHtml(portableCard)};</script>
      <script>${confettiJs}</script>
      <script>${snowJs}</script>
      <script>${audioJs}</script>
      <script>${cardJs}</script>
    `;

    html = html.replace('<script src="/vendor/confetti.browser.js"></script>', '');
    html = html.replace('<script src="/js/snow.js"></script>', '');
    html = html.replace('<script src="/js/audio.js"></script>', '');
    html = html.replace('<script src="/js/card.js"></script>', embeddedPayload);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Tarjeta_Navidena_${card.id}.html"`);
    res.send(html);
  } catch (err) {
    console.error('Error generating standalone card:', err);
    res.status(500).send('Error al generar archivo portable');
  }
});

// -------------------------------------------------------------
// Render Keep-Alive: evita que el servicio en Render se duerma
// -------------------------------------------------------------
const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
if (KEEP_ALIVE_URL) {
  const intervalMs = 9 * 60 * 1000; // cada 9 minutos (Render Free suspende tras 15 min)
  console.log(`⏱️ Auto-KeepAlive configurado hacia: ${KEEP_ALIVE_URL} (cada 9 min)`);
  setInterval(async () => {
    try {
      await axios.get(`${KEEP_ALIVE_URL.replace(/\/$/, '')}/ping`, { timeout: 15000 });
      console.log(`💓 Keep-alive ping enviado exitosamente a ${KEEP_ALIVE_URL}/ping`);
    } catch (err) {
      console.warn(`⚠️ Keep-alive ping no respondió: ${err.message}`);
    }
  }, intervalMs);
}

// -------------------------------------------------------------
// Start Server
// -------------------------------------------------------------
const serverInstance = app.listen(PORT, '0.0.0.0', () => {
  // Sincronizar respaldo en la nube al iniciar si el disco está vacío
  cardStore.initCloudSync().catch(() => {});
  const ips = getAllValidNetworkIps();
  console.log(`\n==============================================`);
  console.log(`🎄 SERVIDOR DE TARJETA NAVIDEÑA SEGURO ACTIVO 🎅`);
  console.log(`> Local:       http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`> Móvil Wi-Fi: http://${ips[0].ip}:${PORT} (Misma red)`);
    if (ips.length > 1) {
      console.log(`> Otras redes disponibles:`);
      for (let i = 1; i < ips.length; i++) {
        console.log(`  - ${ips[i].label}: http://${ips[i].ip}:${PORT}`);
      }
    }
  }
  console.log(`> Diagnóstico: http://localhost:${PORT}/ping`);
  console.log(`==============================================\n`);
});

module.exports = serverInstance;
