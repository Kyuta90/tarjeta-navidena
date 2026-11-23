const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const axios = require('axios');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
const cardsFilePath = path.join(dataDir, 'cards.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(cardsFilePath)) {
  fs.writeFileSync(cardsFilePath, JSON.stringify({}, null, 2), 'utf-8');
}

// Helpers to read/write cards storage
function readCards() {
  try {
    const raw = fs.readFileSync(cardsFilePath, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Error reading cards file:', err);
    return {};
  }
}

function saveCards(cards) {
  try {
    fs.writeFileSync(cardsFilePath, JSON.stringify(cards, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving cards file:', err);
  }
}

// Helper to discover real physical network IPs (filtering out VirtualBox, VMware, Docker, etc.)
function getAllValidNetworkIps() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    const lowerName = name.toLowerCase();

    // Skip virtual machine or container adapters
    if (
      lowerName.includes('virtualbox') ||
      lowerName.includes('vmware') ||
      lowerName.includes('vethernet') ||
      lowerName.includes('wsl') ||
      lowerName.includes('loopback')
    ) {
      continue;
    }

    for (const iface of addrs) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Skip APIPA (169.254.x.x) and VirtualBox host-only network (192.168.56.x)
        if (iface.address.startsWith('169.254.') || iface.address.startsWith('192.168.56.')) {
          continue;
        }

        let priority = 10;
        let typeLabel = 'Red Local';

        // Wi-Fi is ideal for mobile scanning
        if (lowerName.includes('wi-fi') || lowerName.includes('wireless') || lowerName.includes('wlan')) {
          priority = 100;
          typeLabel = 'Wi-Fi (Recomendado para celulares)';
        } else if (lowerName.includes('ethernet')) {
          priority = 50;
          typeLabel = 'Ethernet (Cable)';
        }

        candidates.push({
          name,
          ip: iface.address,
          label: `${iface.address} - ${typeLabel}`,
          priority
        });
      }
    }
  }

  // Sort descending by priority so Wi-Fi is default
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates;
}

// Helper to get primary Local Area Network IP for mobile phone scanning
function getLocalNetworkIp() {
  const ips = getAllValidNetworkIps();
  if (ips.length > 0) {
    return ips[0].ip;
  }
  return 'localhost';
}

// Endpoint: Get all available network IPs
app.get('/api/network-ips', (req, res) => {
  const ips = getAllValidNetworkIps();
  res.json({
    defaultIp: ips.length > 0 ? ips[0].ip : 'localhost',
    port: PORT,
    candidates: ips
  });
});

// Helper to match referential HD product image by keyword
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

  return '/images/default-gift.svg';
}

// Specialized metadata extractor for Mercado Libre links
async function extractMercadoLibreData(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    const isMeli = /(?:mercadolibre|mercadolivre)\./i.test(hostname);
    if (!isMeli) return null;

    let siteName = 'Mercado Libre';
    let siteId = 'MLC';
    if (hostname.endsWith('.cl')) {
      siteName = 'Mercado Libre Chile';
      siteId = 'MLC';
    } else if (hostname.endsWith('.com.ar')) {
      siteName = 'Mercado Libre Argentina';
      siteId = 'MLA';
    } else if (hostname.endsWith('.com.mx')) {
      siteName = 'Mercado Libre México';
      siteId = 'MLM';
    } else if (hostname.endsWith('.com.co')) {
      siteName = 'Mercado Libre Colombia';
      siteId = 'MCO';
    } else if (hostname.endsWith('.com.pe')) {
      siteName = 'Mercado Libre Perú';
      siteId = 'MPE';
    } else if (hostname.endsWith('.com.uy')) {
      siteName = 'Mercado Libre Uruguay';
      siteId = 'MLU';
    } else if (hostname.endsWith('.com.br')) {
      siteName = 'Mercado Livre Brasil';
      siteId = 'MLB';
    } else if (hostname.endsWith('.com.ec')) {
      siteName = 'Mercado Libre Ecuador';
      siteId = 'MEC';
    } else if (hostname.endsWith('.com.ve')) {
      siteName = 'Mercado Libre Venezuela';
      siteId = 'MLV';
    }

    const pathname = decodeURIComponent(parsed.pathname);
    let rawTitle = '';

    // Pattern 1: /MLC-12345678-titulo-del-producto-_JM or /MCO-123456-titulo...
    const matchArticulo = pathname.match(/\/M[A-Z]{2}[-_]?\d+[-_](.+?)(?:[-_]JM|\.html|\?|#|$)/i);
    if (matchArticulo && matchArticulo[1]) {
      rawTitle = matchArticulo[1];
    }

    // Pattern 2: /titulo-del-producto/p/MLC...
    if (!rawTitle) {
      const matchPdp = pathname.match(/\/([^\/]+)\/p\/M[A-Z]{2}\d+/i);
      if (matchPdp && matchPdp[1]) {
        rawTitle = matchPdp[1];
      }
    }

    // Pattern 3: /p/MLC12345678
    if (!rawTitle) {
      const matchPonly = pathname.match(/\/p\/(M[A-Z]{2}\d+)/i);
      if (matchPonly) {
        rawTitle = `Artículo en ${siteName} (${matchPonly[1]})`;
      }
    }

    // Pattern 4: /listado.mercadolibre.../busqueda
    if (!rawTitle && hostname.startsWith('listado.')) {
      const segs = pathname.split('/').filter(Boolean);
      if (segs.length > 0) {
        rawTitle = segs[0];
      }
    }

    // Pattern 5: Generic slug from pathname
    if (!rawTitle) {
      const segs = pathname.split('/').filter(Boolean);
      if (segs.length > 0) {
        rawTitle = segs[segs.length - 1];
        rawTitle = rawTitle.replace(/^M[A-Z]{2}[-_]?\d+[-_]?/i, '');
        rawTitle = rawTitle.replace(/[-_]JM$/i, '');
      }
    }

    // Clean up rawTitle into human readable title
    let cleanTitle = rawTitle
      .replace(/[-_]+/g, ' ')
      .replace(/\b(JM|pdp|filters|category)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const accentsMap = {
      'audifonos': 'Audífonos',
      'auriculares': 'Auriculares',
      'inalambricos': 'Inalámbricos',
      'inalambrico': 'Inalámbrico',
      'sueter': 'Suéter',
      'navideno': 'Navideño',
      'navidena': 'Navideña',
      'arbol': 'Árbol',
      'cafe': 'Café',
      'camara': 'Cámara',
      'telefono': 'Teléfono',
      'electronica': 'Electrónica',
      'musica': 'Música',
      'pantalla': 'Pantalla',
      'bateria': 'Batería',
      'optica': 'Óptica',
      'lampara': 'Lámpara',
      'articulo': 'Artículo',
      'tws': 'TWS',
      'led': 'LED',
      'rgb': 'RGB',
      'usb': 'USB',
      'hd': 'HD',
      '4k': '4K',
      'ps5': 'PS5',
      'ps4': 'PS4',
      'pro': 'Pro',
      'max': 'Max',
      'plus': 'Plus',
      'bluetooth': 'Bluetooth'
    };

    cleanTitle = cleanTitle
      .split(' ')
      .map(word => {
        const lower = word.toLowerCase();
        if (accentsMap[lower]) return accentsMap[lower];
        if (word.length <= 2 && !['de', 'en', 'la', 'el', 'y', 'con', 'al', 'un', 'o'].includes(lower)) {
          return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ')
      .trim();

    if (!cleanTitle) {
      cleanTitle = 'Artículo en ' + siteName;
    }

    let image = null;
    let categoryName = '';
    try {
      const discoveryRes = await axios.get(
        `https://api.mercadolibre.com/sites/${siteId}/domain_discovery/search?q=${encodeURIComponent(cleanTitle.slice(0, 60))}`,
        { timeout: 2500 }
      );
      if (discoveryRes.data && discoveryRes.data[0]) {
        categoryName = discoveryRes.data[0].category_name || '';
        const catId = discoveryRes.data[0].category_id;
        if (catId) {
          const catRes = await axios.get(`https://api.mercadolibre.com/categories/${catId}`, { timeout: 2500 });
          if (catRes.data?.picture) {
            image = catRes.data.picture;
          }
        }
      }
    } catch {}

    if (!image) {
      image = getReferentialImage(cleanTitle, categoryName);
    }

    return {
      url: rawUrl,
      title: cleanTitle,
      description: `Artículo de ${siteName}`,
      image,
      siteName
    };
  } catch (err) {
    console.error('Error in extractMercadoLibreData:', err);
    return null;
  }
}

// Endpoint: Scrape link preview (referential image, title, description)
app.get('/api/preview', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Falta el parámetro url' });
  }

  // Normalize URL
  targetUrl = targetUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: 'URL inválida' });
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
    } catch {
      // continue to general scraping
    }
  }

  // Specialized extractor for Mercado Libre
  try {
    const parsed = new URL(targetUrl);
    if (/(?:mercadolibre|mercadolivre)\./i.test(parsed.hostname)) {
      const meliData = await extractMercadoLibreData(targetUrl);
      if (meliData) {
        return res.json(meliData);
      }
    }
  } catch {}

  // 1. Attempt primary scrape with custom browser headers
  try {
    const response = await axios.get(targetUrl, {
      timeout: 7000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"'
      },
      maxRedirects: 5
    });

    const html = response.data;
    if (typeof html === 'string') {
      const $ = cheerio.load(html);
      const parsedUrl = new URL(targetUrl);

      // Extract title
      let title =
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('meta[name="title"]').attr('content') ||
        $('title').text() ||
        $('h1').first().text() ||
        parsedUrl.hostname;
      title = title.trim();

      // Extract description
      let description =
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="twitter:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        '';
      description = description.trim();

      // Extract image
      let image =
        $('meta[property="og:image:secure_url"]').attr('content') ||
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image:src"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        $('link[rel="image_src"]').attr('href') ||
        $('meta[itemprop="image"]').attr('content') ||
        '';

      // Fallback: check Schema.org JSON-LD
      if (!image) {
        $('script[type="application/ld+json"]').each((_, elem) => {
          try {
            const json = JSON.parse($(elem).html() || '{}');
            const findImg = (obj) => {
              if (!obj) return null;
              if (obj.image) {
                if (typeof obj.image === 'string') return obj.image;
                if (Array.isArray(obj.image) && obj.image.length > 0) {
                  return typeof obj.image[0] === 'string' ? obj.image[0] : obj.image[0].url;
                }
                if (obj.image.url) return obj.image.url;
              }
              return null;
            };
            const found = findImg(json);
            if (found && !image) image = found;
          } catch {}
        });
      }

      // Fallback: first significant img on page
      if (!image) {
        $('img').each((_, elem) => {
          const src = $(elem).attr('src') || $(elem).attr('data-src');
          if (src && !image) {
            // Avoid tiny icons, tracking pixels, badges
            const width = parseInt($(elem).attr('width') || '100', 10);
            const height = parseInt($(elem).attr('height') || '100', 10);
            if (width >= 80 && height >= 80 && !src.includes('logo') && !src.includes('icon')) {
              image = src;
            }
          }
        });
      }

      // Resolve relative image URLs to absolute
      if (image && !/^https?:\/\//i.test(image)) {
        try {
          image = new URL(image, targetUrl).href;
        } catch {}
      }

      const siteName =
        $('meta[property="og:site_name"]').attr('content') ||
        parsedUrl.hostname.replace(/^www\./, '');

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
  } catch (directErr) {
    console.log(`Direct scrape failed for ${targetUrl} (${directErr.message}). Trying Microlink fallback...`);
  }

  // 2. Fallback to public Microlink API (handles JS-rendered pages and bot-protected sites)
  try {
    const microlinkRes = await axios.get(
      `https://api.microlink.io?url=${encodeURIComponent(targetUrl)}`,
      { timeout: 7000 }
    );
    if (microlinkRes.data && microlinkRes.data.status === 'success' && microlinkRes.data.data) {
      const data = microlinkRes.data.data;
      const parsedUrl = new URL(targetUrl);
      const img = data.image?.url || data.logo?.url || null;
      return res.json({
        url: targetUrl,
        title: data.title || parsedUrl.hostname,
        description: data.description || '',
        image: img || '/images/default-gift.svg',
        siteName: data.publisher || parsedUrl.hostname.replace(/^www\./, '')
      });
    }
  } catch (microlinkErr) {
    console.log(`Microlink fallback failed (${microlinkErr.message})`);
  }

  // 3. Graceful fallback if scraping didn't yield an image
  try {
    const parsedUrl = new URL(targetUrl);
    return res.json({
      url: targetUrl,
      title: parsedUrl.hostname.replace(/^www\./, '') + ' - Artículo de regalo',
      description: 'Enlace guardado en la lista de deseos navideños',
      image: '/images/default-gift.svg',
      siteName: parsedUrl.hostname.replace(/^www\./, ''),
      needsManualImage: true
    });
  } catch {
    return res.json({
      url: targetUrl,
      title: 'Regalo Navideño',
      description: '',
      image: '/images/default-gift.svg',
      siteName: 'Enlace web',
      needsManualImage: true
    });
  }
});

// Endpoint: Create a new Christmas Wishlist Card
app.post('/api/cards', async (req, res) => {
  try {
    const {
      title,
      recipient,
      sender,
      message,
      theme,
      items
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debes incluir al menos un enlace o regalo en la lista.' });
    }

    // Generate unique card ID
    const id = 'navidad-' + crypto.randomBytes(3).toString('hex');
    const createdAt = new Date().toISOString();

    const cardData = {
      id,
      title: (title && title.trim()) ? title.trim() : 'Mis Deseos Navideños 🎄',
      recipient: (recipient && recipient.trim()) ? recipient.trim() : '',
      sender: (sender && sender.trim()) ? sender.trim() : '',
      message: (message && message.trim()) ? message.trim() : '',
      theme: theme || 'classic-red', // classic-red, winter-night, forest-gold
      items: items.map((it, idx) => ({
        id: it.id || `item-${idx + 1}`,
        order: idx + 1,
        url: it.url,
        title: it.title || `Deseo #${idx + 1}`,
        description: it.description || '',
        image: it.image || '/images/default-gift.svg',
        siteName: it.siteName || ''
      })),
      createdAt
    };

    // Save to storage
    const cards = readCards();
    cards[id] = cardData;
    saveCards(cards);

    // Build URLs (Auto-detect Render or Cloud hosting vs Local)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const hostHeader = req.get('host') || '';
    const isCloudHost = process.env.RENDER || process.env.RENDER_EXTERNAL_URL || 
      (hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1') && !hostHeader.includes('192.168.') && !hostHeader.includes('10.'));

    let localUrl = `http://localhost:${PORT}/card/${id}`;
    let lanUrl = `http://${getLocalNetworkIp()}:${PORT}/card/${id}`;
    let qrTargetUrl;

    if (isCloudHost) {
      const publicBase = process.env.RENDER_EXTERNAL_URL || `${protocol}://${hostHeader}`;
      qrTargetUrl = `${publicBase}/card/${id}`;
      localUrl = qrTargetUrl;
      lanUrl = qrTargetUrl;
    } else {
      const requestedIp = req.body.selectedIp;
      const lanIp = (requestedIp && requestedIp !== 'localhost') ? requestedIp : getLocalNetworkIp();
      lanUrl = `http://${lanIp}:${PORT}/card/${id}`;
      qrTargetUrl = lanIp !== 'localhost' ? lanUrl : localUrl;
    }

    // Generate QR Code as DataURL with Christmas colors
    const qrCodeDataUrl = await QRCode.toDataURL(qrTargetUrl, {
      width: 450,
      margin: 2,
      color: {
        dark: '#991b1b', // Festive dark red
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });

    return res.json({
      success: true,
      id,
      card: cardData,
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
    if (!cardId) {
      return res.status(400).json({ error: 'Falta cardId' });
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const hostHeader = req.get('host') || '';
    const isCloudHost = process.env.RENDER || process.env.RENDER_EXTERNAL_URL || 
      (hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1') && !hostHeader.includes('192.168.') && !hostHeader.includes('10.'));

    let targetUrl;
    if (isCloudHost) {
      const publicBase = process.env.RENDER_EXTERNAL_URL || `${protocol}://${hostHeader}`;
      targetUrl = `${publicBase}/card/${cardId}`;
    } else {
      const targetIp = selectedIp || getLocalNetworkIp();
      targetUrl = targetIp !== 'localhost'
        ? `http://${targetIp}:${PORT}/card/${cardId}`
        : `http://localhost:${PORT}/card/${cardId}`;
    }

    const qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 450,
      margin: 2,
      color: {
        dark: '#991b1b',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });

    return res.json({
      success: true,
      targetUrl,
      qrCodeDataUrl
    });
  } catch (err) {
    console.error('Error generating QR:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint: Generate QR for an arbitrary custom URL (public tunnel, ngrok, etc.)
app.post('/api/qr-custom', async (req, res) => {
  try {
    const { targetUrl } = req.body;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Falta targetUrl' });
    }

    const qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 450,
      margin: 2,
      color: {
        dark: '#991b1b',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });

    res.json({
      success: true,
      targetUrl,
      qrCodeDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Get all generated cards (Registry / History)
app.get('/api/cards', (req, res) => {
  const cards = readCards();
  const list = Object.values(cards).map(c => ({
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
    total: list.length,
    cards: list
  });
});

// Endpoint: Delete a card
app.delete('/api/cards/:id', (req, res) => {
  const cards = readCards();
  const cardId = req.params.id;
  if (!cards[cardId]) {
    return res.status(404).json({ error: 'Tarjeta navideña no encontrada' });
  }

  delete cards[cardId];
  saveCards(cards);

  return res.json({
    success: true,
    message: `Tarjeta ${cardId} eliminada exitosamente.`
  });
});

// Endpoint: Get Card by ID
app.get('/api/cards/:id', (req, res) => {
  const cards = readCards();
  const card = cards[req.params.id];
  if (!card) {
    return res.status(404).json({ error: 'Tarjeta navideña no encontrada' });
  }
  return res.json(card);
});

// Route for direct card view: /card/:id
app.get('/card/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'card.html'));
});

// Endpoint: Download standalone portable HTML card (works anywhere, no server or network needed!)
app.get('/api/download-card/:id', (req, res) => {
  const cards = readCards();
  const card = cards[req.params.id];
  if (!card) {
    return res.status(404).send('Tarjeta no encontrada');
  }

  try {
    let html = fs.readFileSync(path.join(__dirname, 'public', 'card.html'), 'utf-8');
    const css = fs.readFileSync(path.join(__dirname, 'public', 'css', 'style.css'), 'utf-8');
    const snowJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'snow.js'), 'utf-8');
    const audioJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'audio.js'), 'utf-8');
    const cardJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'card.js'), 'utf-8');

    // Inline CSS
    html = html.replace('<link rel="stylesheet" href="/css/style.css">', `<style>${css}</style>`);

    // Inject embedded card data and inline scripts
    const embeddedPayload = `
      <script>window.EMBEDDED_CARD_DATA = ${JSON.stringify(card)};</script>
      <script>${snowJs}</script>
      <script>${audioJs}</script>
      <script>${cardJs}</script>
    `;

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

// Start server listening on all network interfaces (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
  const ips = getAllValidNetworkIps();
  console.log(`\n==============================================`);
  console.log(`🎄 SERVIDOR DE TARJETA NAVIDEÑA ACTIVO 🎅`);
  console.log(`> Local:     http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`> Móvil Wi-Fi: http://${ips[0].ip}:${PORT} (Recomendado para el QR)`);
    if (ips.length > 1) {
      console.log(`> Otras redes disponibles:`);
      for (let i = 1; i < ips.length; i++) {
        console.log(`  - ${ips[i].label}: http://${ips[i].ip}:${PORT}`);
      }
    }
  }
  console.log(`==============================================\n`);
});
