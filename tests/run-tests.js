const http = require('http');
const path = require('path');
const { fork } = require('child_process');

const PORT = 3000;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;

let serverProcess = null;

async function ensureServerRunning() {
  let isUp = false;
  try {
    const res = await request({ hostname: HOST, port: PORT, path: '/ping', method: 'GET' });
    if (res.status === 200) isUp = true;
  } catch (e) {}

  if (!isUp) {
    try {
      serverProcess = require('../server.js');
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 200));
        try {
          const ping = await request({ hostname: HOST, port: PORT, path: '/ping', method: 'GET' });
          if (ping.status === 200) {
            isUp = true;
            break;
          }
        } catch (e) {}
      }
    } catch (err) {
      serverProcess = fork(path.join(__dirname, '../server.js'), [], { stdio: 'inherit' });
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 300));
        try {
          const ping = await request({ hostname: HOST, port: PORT, path: '/ping', method: 'GET' });
          if (ping.status === 200) {
            isUp = true;
            break;
          }
        } catch (e) {}
      }
    }
    if (!isUp) throw new Error('El servidor no respondió a tiempo en http://127.0.0.1:3000');
  }
}

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body), raw: body });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function pass(name, detail = '') {
  console.log(`  ${colors.green}✔ PASS${colors.reset} - ${colors.bold}${name}${colors.reset} ${detail ? colors.cyan + '(' + detail + ')' + colors.reset : ''}`);
}

function fail(name, error) {
  const errMsg = error ? (error.message || error.code || String(error)) : 'Unknown error';
  console.log(`  ${colors.red}✖ FAIL${colors.reset} - ${colors.bold}${name}${colors.reset}\n    ${colors.red}${errMsg}${colors.reset}`);
}

async function runTestSuite() {
  await ensureServerRunning();

  console.log(`\n======================================================`);
  console.log(`🎄 INICIANDO SUITE DE PRUEBAS: TARJETA NAVIDEÑA QR 🎅`);
  console.log(`> Servidor objetivo: ${BASE_URL}`);
  console.log(`======================================================\n`);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  async function test(name, fn) {
    totalTests++;
    try {
      await fn();
      pass(name);
      passedTests++;
    } catch (err) {
      fail(name, err);
      failedTests++;
    }
  }

  // TEST 1: Servidor activo y página principal
  await test('1. Servidor web activo y sirve el Creador (GET /)', async () => {
    const res = await request({ hostname: HOST, port: PORT, path: '/', method: 'GET' });
    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (!res.raw.includes('linkInput')) throw new Error('No se encontró el input de enlace (#linkInput) en el HTML');
    if (!res.raw.includes('generateCardBtn')) throw new Error('No se encontró el botón de generar (#generateCardBtn)');
    if (!res.raw.includes('previewCard')) throw new Error('No se encontró la tarjeta de preview (#previewCard)');
  });

  // TEST 2: Extracción de imagen referencial desde URL directa de imagen
  await test('2. Extracción de imagen referencial desde enlace directo de imagen', async () => {
    const directImageUrl = 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2';
    const res = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/preview?url=${encodeURIComponent(directImageUrl)}`,
      method: 'GET'
    });
    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (!res.data.image) throw new Error('No se devolvió imagen referencial');
    if (!res.data.url) throw new Error('No se devolvió la URL del artículo');
  });

  // TEST 3: Extracción de imagen referencial desde página web con OpenGraph
  await test('3. Extracción de metadatos e imagen referencial desde página web', async () => {
    const webUrl = 'https://www.wikipedia.org';
    const res = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/preview?url=${encodeURIComponent(webUrl)}`,
      method: 'GET'
    });
    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (!res.data.title) throw new Error('No se extrajo el título del enlace');
    if (!res.data.image) throw new Error('No se generó imagen referencial o fallback');
  });

  // TEST 4: Creación de tarjeta con múltiples enlaces y verificación de QR
  let createdCardId = null;
  let qrCodeDataUrl = null;

  await test('4. Botón de Generar: crear tarjeta con múltiples enlaces y generar QR', async () => {
    const payload = {
      title: 'Deseos de Prueba Navideña 2026',
      recipient: 'Familia Test',
      sender: 'Tester Automatizado',
      message: '¡Prueba de felicitación y deseos navideños!',
      theme: 'classic-red',
      items: [
        {
          order: 1,
          url: 'https://www.amazon.com/dp/B08N5LNQCX',
          title: 'Artículo #1 - Audífonos Inalámbricos',
          image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
          siteName: 'Amazon'
        },
        {
          order: 2,
          url: 'https://www.mercadolibre.com/sueter',
          title: 'Artículo #2 - Suéter Festivo',
          image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2',
          siteName: 'Mercado Libre'
        },
        {
          order: 3,
          url: 'https://www.falabella.com/cafetera',
          title: 'Artículo #3 - Cafetera Espresso',
          image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6',
          siteName: 'Falabella'
        }
      ]
    };

    const res = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/cards',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, payload);

    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (!res.data.success) throw new Error('La respuesta no indicó success: true');
    if (!res.data.id) throw new Error('No se generó ID para la tarjeta');
    if (!res.data.qrCodeDataUrl) throw new Error('No se generó el código QR (qrCodeDataUrl está vacío)');
    if (!res.data.qrCodeDataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('El código QR generado no es un Data URL de imagen PNG válido');
    }

    createdCardId = res.data.id;
    qrCodeDataUrl = res.data.qrCodeDataUrl;
  });

  // TEST 5: Verificación del orden exacto de los artículos en la tarjeta
  await test('5. Al escanear el QR: verificar que los artículos aparezcan según el orden de ingreso', async () => {
    if (!createdCardId) throw new Error('No hay ID de tarjeta creada');
    const res = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/cards/${createdCardId}`,
      method: 'GET'
    });

    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    const items = res.data.items;
    if (!Array.isArray(items) || items.length !== 3) {
      throw new Error(`Se esperaban 3 artículos, se recibieron: ${items ? items.length : 0}`);
    }

    // Verificar orden estricto 1, 2, 3
    if (items[0].order !== 1 || !items[0].title.includes('Artículo #1')) {
      throw new Error(`El primer artículo no coincide con el orden 1: ${items[0].title}`);
    }
    if (items[1].order !== 2 || !items[1].title.includes('Artículo #2')) {
      throw new Error(`El segundo artículo no coincide con el orden 2: ${items[1].title}`);
    }
    if (items[2].order !== 3 || !items[2].title.includes('Artículo #3')) {
      throw new Error(`El tercer artículo no coincide con el orden 3: ${items[2].title}`);
    }

    // Verificar que contengan su imagen referencial y enlace
    for (const item of items) {
      if (!item.image) throw new Error(`El artículo "${item.title}" no tiene imagen referencial`);
      if (!item.url) throw new Error(`El artículo "${item.title}" no tiene enlace`);
    }
  });

  // TEST 6: Verificación de la página visual de la tarjeta navideña (/card/:id)
  await test('6. Vista de la tarjeta navideña (Fondo navideño, música, orden y enlaces)', async () => {
    if (!createdCardId) throw new Error('No hay ID de tarjeta creada');
    const res = await request({
      hostname: HOST,
      port: PORT,
      path: `/card/${createdCardId}`,
      method: 'GET'
    });

    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (!res.raw.includes('cardBody')) throw new Error('Falta el elemento #cardBody con fondo navideño');
    if (!res.raw.includes('cardItemsContainer')) throw new Error('Falta el contenedor de artículos #cardItemsContainer');
    if (!res.raw.includes('snowCanvas')) throw new Error('Falta el canvas de nieve #snowCanvas');
    if (!res.raw.includes('lightrope')) throw new Error('Falta la guirnalda de luces navideñas');
  });

  // TEST 7: Personalización opcional (si se decide no incluir, se omiten esos datos)
  await test('7. Personalización opcional: omitir datos si no se ingresan', async () => {
    const payloadNoPersonalization = {
      title: '',
      recipient: '',
      sender: '',
      message: '',
      theme: 'forest-gold',
      items: [
        {
          order: 1,
          url: 'https://example.com/item-anonimo',
          title: 'Regalo sin datos personales',
          image: '/images/default-gift.svg',
          siteName: 'Tienda'
        }
      ]
    };

    const res = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/cards',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, payloadNoPersonalization);

    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    const cardIdAnon = res.data.id;

    // Verificar en la API que recipient, sender y message estén vacíos
    const getRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/cards/${cardIdAnon}`,
      method: 'GET'
    });

    if (getRes.status !== 200) throw new Error(`Status esperado 200, recibido: ${getRes.status}`);
    if (getRes.data.recipient !== '') throw new Error(`Se esperaba recipient vacío, recibido: "${getRes.data.recipient}"`);
    if (getRes.data.sender !== '') throw new Error(`Se esperaba sender vacío, recibido: "${getRes.data.sender}"`);
    if (getRes.data.message !== '') throw new Error(`Se esperaba message vacío, recibido: "${getRes.data.message}"`);
  });

  // TEST 8: Modos de visualización Horizontal y Vertical responsive
  await test('8. Soporte de lista responsive (Horizontal / Vertical según dispositivo)', async () => {
    const res = await request({
      hostname: HOST,
      port: PORT,
      path: `/card/${createdCardId}`,
      method: 'GET'
    });

    if (!res.raw.includes('layoutVerticalBtn')) throw new Error('Falta el botón de layout vertical (#layoutVerticalBtn)');
    if (!res.raw.includes('layoutHorizontalBtn')) throw new Error('Falta el botón de layout horizontal (#layoutHorizontalBtn)');
    if (!res.raw.includes('carouselArrows')) throw new Error('Falta el contenedor de flechas de navegación horizontal');
    if (!res.raw.includes('carouselPrevBtn') || !res.raw.includes('carouselNextBtn')) {
      throw new Error('Faltan los botones de desplazamiento de carrusel');
    }
  });

  // TEST 9: Descarga de tarjeta portable independiente (.html para WhatsApp / sin red)
  await test('9. Descarga de tarjeta portable autónoma (.html sin servidor)', async () => {
    const res = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/download-card/${createdCardId}`,
      method: 'GET'
    });

    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (!res.raw.includes('EMBEDDED_CARD_DATA')) throw new Error('El archivo generado no contiene EMBEDDED_CARD_DATA');
    if (!res.raw.includes('snowCanvas')) throw new Error('El archivo generado no contiene el snowCanvas');
  });

  // TEST 10: Generación de QR con URL pública personalizada (para ver en cualquier red / 4G)
  await test('10. Generación de QR con URL pública personalizada (4G / cualquier red)', async () => {
    const res = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/qr-custom',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      targetUrl: 'https://mi-tarjeta-navidena-publica.com/card/123'
    });

    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (!res.data.success) throw new Error('La respuesta no fue exitosa');
    if (!res.data.qrCodeDataUrl || !res.data.qrCodeDataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('No se generó el código QR para la URL pública');
    }
  });

  // TEST 11: Registro e Historial de tarjetas generadas (GET /api/cards)
  await test('11. Registro e Historial: listado de tarjetas generadas sin caducidad', async () => {
    const res = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/cards',
      method: 'GET'
    });

    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (!Array.isArray(res.data.cards)) throw new Error('No se devolvió la lista de tarjetas');
    if (res.data.total === undefined || res.data.total < 1) {
      throw new Error('El registro debería tener al menos 1 tarjeta guardada');
    }
  });

  // TEST 12: Eliminación manual de tarjeta por decisión del usuario (DELETE /api/cards/:id)
  await test('12. Eliminación manual: la tarjeta se conserva hasta que el usuario decida borrarla', async () => {
    // 1. Crear una tarjeta temporal para borrar
    const createTemp = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/cards',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: 'Tarjeta Temporal Para Eliminar',
      items: [{ order: 1, url: 'https://example.com', title: 'Item temporal' }]
    });

    const tempId = createTemp.data.id;
    if (!tempId) throw new Error('No se pudo crear la tarjeta temporal');

    // 2. Eliminarla
    const delRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/cards/${tempId}`,
      method: 'DELETE'
    });

    if (delRes.status !== 200) throw new Error(`Status esperado 200, recibido: ${delRes.status}`);
    if (!delRes.data.success) throw new Error('No se confirmó la eliminación');

    // 3. Verificar que ya no existe (404)
    const checkRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/cards/${tempId}`,
      method: 'GET'
    });

    if (checkRes.status !== 404) {
      throw new Error(`Se esperaba 404 para tarjeta eliminada, recibido: ${checkRes.status}`);
    }
  });

  // TEST 13: Opción de subir imagen propia si la imagen no carga o para fotos directas
  await test('13. Subir imagen local (Base64) cuando no carga o por opción del usuario', async () => {
    // 1. Verificar elementos de interfaz en el HTML principal
    const pageRes = await request({ hostname: HOST, port: PORT, path: '/', method: 'GET' });
    if (!pageRes.raw.includes('imageFileInput')) throw new Error('Falta el input de archivo #imageFileInput');
    if (!pageRes.raw.includes('directUploadBtn')) throw new Error('Falta el botón de subir foto directa #directUploadBtn');
    if (!pageRes.raw.includes('imageMissingAlert')) throw new Error('Falta la alerta de imagen faltante #imageMissingAlert');
    if (!pageRes.raw.includes('alertUploadBtn')) throw new Error('Falta el botón de subir foto en la alerta #alertUploadBtn');
    if (!pageRes.raw.includes('previewImgDropZone')) throw new Error('Falta la zona de arrastrar y soltar imagen #previewImgDropZone');
    if (!pageRes.raw.includes('changeImageBtn')) throw new Error('Falta el botón de cambiar imagen #changeImageBtn');

    // 2. Crear una tarjeta con una imagen Base64 (simulando foto subida localmente)
    const base64Pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const cardUploadPayload = {
      title: 'Tarjeta con Foto Subida por el Usuario',
      recipient: 'Abuelita',
      sender: 'Nieto',
      message: '¡Mira la foto del regalo que te elegí!',
      theme: 'classic-red',
      items: [
        {
          order: 1,
          url: 'https://ejemplo.com/tienda/articulo-con-foto-subida',
          title: 'Regalo con Foto Personalizada Subida',
          image: base64Pixel,
          siteName: 'Foto Subida 📁'
        }
      ]
    };

    const createRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/cards',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, cardUploadPayload);

    if (createRes.status !== 200) throw new Error(`Status esperado 200, recibido: ${createRes.status}`);
    const uploadedCardId = createRes.data.id;
    if (!uploadedCardId) throw new Error('No se generó ID para la tarjeta con foto subida');

    // 3. Verificar que la tarjeta almacene y devuelva la imagen Base64
    const getRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/cards/${uploadedCardId}`,
      method: 'GET'
    });

    if (getRes.status !== 200) throw new Error(`Status esperado 200, recibido: ${getRes.status}`);
    const savedItem = getRes.data.items[0];
    if (!savedItem || (!savedItem.image.startsWith('/uploads/') && savedItem.image !== base64Pixel)) {
      throw new Error('La imagen Base64 subida no se guardó o recuperó correctamente');
    }

    // 4. Verificar renderizado en la página pública de la tarjeta
    const viewRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/card/${uploadedCardId}`,
      method: 'GET'
    });
    if (viewRes.status !== 200) throw new Error(`Status esperado 200 al ver la tarjeta con foto subida`);
  });

  // TEST 14: Reconocimiento inteligente de títulos e imágenes de Mercado Libre
  await test('14. Reconocimiento de títulos e imágenes para Mercado Libre (Chile, Argentina, etc.)', async () => {
    const meliUrl = 'https://articulo.mercadolibre.cl/MLC-1417066929-audifonos-inalambricos-bluetooth-f9-5-tws-touch-pantalla-led-_JM';
    const res = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/preview?url=${encodeURIComponent(meliUrl)}`,
      method: 'GET'
    });

    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (!res.data.title || !res.data.title.includes('Audífonos Inalámbricos Bluetooth')) {
      throw new Error(`Título no reconocido correctamente: "${res.data.title}"`);
    }
    if (!res.data.siteName || !res.data.siteName.includes('Mercado Libre')) {
      throw new Error(`Sitio no reconocido: "${res.data.siteName}"`);
    }
    if (!res.data.image || !res.data.image.startsWith('http')) {
      throw new Error(`Imagen referencial no obtenida: "${res.data.image}"`);
    }

    // Probar también formato /p/ de Mercado Libre México o Argentina
    const meliUrl2 = 'https://www.mercadolibre.com.mx/consola-playstation-5-digital-slim/p/MLM24183829';
    const res2 = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/preview?url=${encodeURIComponent(meliUrl2)}`,
      method: 'GET'
    });

    if (res2.status !== 200) throw new Error(`Status esperado 200 para ML México`);
    if (!res2.data.title || !res2.data.title.toLowerCase().includes('playstation 5')) {
      throw new Error(`Título no reconocido para ML México: "${res2.data.title}"`);
    }
    if (!res2.data.image || !res2.data.image.startsWith('http')) {
      throw new Error(`Imagen no obtenida para ML México: "${res2.data.image}"`);
    }
  });

  // TEST 15: Diagnóstico y endpoints de Túnel Universal
  await test('15. Endpoint de diagnóstico /ping y estado del túnel móvil', async () => {
    const pingRes = await request({ hostname: HOST, port: PORT, path: '/ping', method: 'GET' });
    if (pingRes.status !== 200) throw new Error(`Status esperado 200, recibido: ${pingRes.status}`);
    if (!pingRes.data.ok) throw new Error('El endpoint /ping no devolvió ok: true');
    if (!pingRes.data.localNetworkIp) throw new Error('Falta localNetworkIp en /ping');

    const tunnelRes = await request({ hostname: HOST, port: PORT, path: '/api/tunnel/status', method: 'GET' });
    if (tunnelRes.status !== 200) throw new Error(`Status de túnel esperado 200, recibido: ${tunnelRes.status}`);
    if (!tunnelRes.data.status) throw new Error('Falta status en /api/tunnel/status');
  });

  // TEST 16: Protección de seguridad SSRF
  await test('16. Protección SSRF: bloqueo de peticiones a loopback, red local y esquemas inválidos', async () => {
    // 1. Intentar preview hacia 127.0.0.1
    const resLocal = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/preview?url=${encodeURIComponent('http://127.0.0.1:3000/ping')}`,
      method: 'GET'
    });
    if (resLocal.status !== 400) throw new Error(`Se esperaba 400 por SSRF, recibido: ${resLocal.status}`);

    // 2. Intentar preview hacia localhost
    const resLocalhost = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/preview?url=${encodeURIComponent('http://localhost:3000/ping')}`,
      method: 'GET'
    });
    if (resLocalhost.status !== 400) throw new Error(`Se esperaba 400 para localhost, recibido: ${resLocalhost.status}`);

    // 3. Intentar preview hacia IP privada 192.168.1.1
    const resPriv = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/preview?url=${encodeURIComponent('http://192.168.1.1/')}`,
      method: 'GET'
    });
    if (resPriv.status !== 400) throw new Error(`Se esperaba 400 para IP privada, recibido: ${resPriv.status}`);
  });

  // TEST 17: Reserva y liberación de regalos (Claim & Unclaim)
  await test('17. Reserva persistente de deseos: apartar regalo (claim) y liberar (unclaim)', async () => {
    if (!createdCardId) throw new Error('No hay ID de tarjeta creada');
    const getCard = await request({ hostname: HOST, port: PORT, path: `/api/cards/${createdCardId}`, method: 'GET' });
    const targetItem = getCard.data.items[0];
    if (!targetItem) throw new Error('La tarjeta no tiene artículos para probar reserva');

    // Apartar regalo
    const claimRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/cards/${createdCardId}/items/${targetItem.id}/claim`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { claimedBy: 'Tía Claudia' });

    if (claimRes.status !== 200) throw new Error(`Status esperado 200 al apartar regalo, recibido: ${claimRes.status}`);
    if (!claimRes.data.success || !claimRes.data.item.claimed) {
      throw new Error('No se confirmó la reserva del regalo');
    }
    if (claimRes.data.item.claimedBy !== 'Tía Claudia') {
      throw new Error(`Nombre esperado "Tía Claudia", recibido: ${claimRes.data.item.claimedBy}`);
    }

    // Verificar persistencia al recargar la tarjeta
    const verifyRes = await request({ hostname: HOST, port: PORT, path: `/api/cards/${createdCardId}`, method: 'GET' });
    if (!verifyRes.data.items[0].claimed || verifyRes.data.items[0].claimedBy !== 'Tía Claudia') {
      throw new Error('La reserva no persistió en la tarjeta');
    }

    // Liberar reserva (unclaim)
    const unclaimRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/cards/${createdCardId}/items/${targetItem.id}/unclaim`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (unclaimRes.status !== 200) throw new Error(`Status esperado 200 al liberar, recibido: ${unclaimRes.status}`);
    if (unclaimRes.data.item.claimed) throw new Error('El artículo sigue marcado como apartado tras unclaim');
  });

  // TEST 18: Tokens de administración y saneamiento contra XSS
  await test('18. Token de administración (adminToken) y saneamiento XSS', async () => {
    // 1. Crear tarjeta con campos potencialmente maliciosos
    const xssPayload = {
      title: 'Deseos <script>alert("xss")</script>',
      recipient: 'Amigo" onmouseover="alert(1)',
      sender: 'Carlos',
      items: [
        {
          order: 1,
          url: 'javascript:alert("bad")',
          title: 'Regalo con script',
          image: 'https://example.com/pic.jpg',
          siteName: 'Tienda'
        }
      ]
    };

    const createRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/cards',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, xssPayload);

    if (createRes.status !== 200) throw new Error(`Status esperado 200, recibido: ${createRes.status}`);
    const adminToken = createRes.data.adminToken;
    const cardId = createRes.data.id;
    if (!adminToken) throw new Error('No se devolvió adminToken al crear la tarjeta');

    // 2. Comprobar que en GET /api/cards/:id el adminToken se oculta al público
    const publicGet = await request({ hostname: HOST, port: PORT, path: `/api/cards/${cardId}`, method: 'GET' });
    if (publicGet.data.adminToken) throw new Error('El adminToken no debe ser visible públicamente en GET /api/cards/:id');
    // Verificar que la URL javascript: fue saneada a vacía
    if (publicGet.data.items[0].url.startsWith('javascript:')) {
      throw new Error('La URL maliciosa no fue saneada');
    }

    // 3. Eliminar tarjeta usando el token de administración
    const delRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/cards/${cardId}`,
      method: 'DELETE',
      headers: { 'X-Admin-Token': adminToken }
    });
    if (delRes.status !== 200) throw new Error(`No se pudo eliminar con adminToken válido: ${delRes.status}`);
  });

  // TEST 19: Reconocimiento y enlace directo con Google Drive
  await test('19. Extracción y enlace directo desde URLs de Google Drive', async () => {
    const driveUrl = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing';
    const res = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/preview?url=${encodeURIComponent(driveUrl)}`,
      method: 'GET'
    });
    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (!res.data.image) throw new Error('No se generó URL de imagen para Google Drive');
    if (!res.data.image.includes('lh3.googleusercontent.com/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms')) {
      throw new Error(`La URL generada no apunta a la miniatura directa de Drive: ${res.data.image}`);
    }
    if (res.data.siteName !== 'Google Drive') throw new Error(`siteName esperado "Google Drive", recibido: ${res.data.siteName}`);
  });

  // TEST 20: Diagnóstico de integración Google Drive (/api/drive/status)
  await test('20. Estado y diagnóstico de Google Drive (/api/drive/status)', async () => {
    const res = await request({ hostname: HOST, port: PORT, path: '/api/drive/status', method: 'GET' });
    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (res.data.directEmbedSupported !== true) throw new Error('directEmbedSupported debe ser true');
  });

  // TEST 21: Endpoint de Salud Render (/healthz)
  await test('21. Endpoint de verificación de salud para Render (/healthz)', async () => {
    const res = await request({ hostname: HOST, port: PORT, path: '/healthz', method: 'GET' });
    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (res.raw !== 'OK') throw new Error(`Respuesta esperada "OK", recibida: ${res.raw}`);
  });

  // TEST 22: Descarga de Respaldo JSON (/api/backup/download)
  await test('22. Descarga de archivo de respaldo para Google Drive (/api/backup/download)', async () => {
    const res = await request({ hostname: HOST, port: PORT, path: '/api/backup/download', method: 'GET' });
    if (res.status !== 200) throw new Error(`Status esperado 200, recibido: ${res.status}`);
    if (!res.data || typeof res.data !== 'object') throw new Error('El respaldo devuelto no es un objeto JSON');
  });

  // RESUMEN FINAL
  console.log(`\n======================================================`);
  console.log(`📊 RESUMEN DE PRUEBAS:`);
  console.log(`Total tests: ${totalTests}`);
  console.log(`${colors.green}Exitosos: ${passedTests}${colors.reset}`);
  if (failedTests > 0) {
    console.log(`${colors.red}Fallidos: ${failedTests}${colors.reset}`);
  }
  console.log(`Tarjeta creada de prueba: ${BASE_URL}/card/${createdCardId}`);
  console.log(`======================================================\n`);

  if (serverProcess) {
    try {
      if (typeof serverProcess.close === 'function') serverProcess.close();
      else if (typeof serverProcess.kill === 'function') serverProcess.kill();
    } catch {}
  }

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  if (serverProcess) {
    try {
      if (typeof serverProcess.close === 'function') serverProcess.close();
      else if (typeof serverProcess.kill === 'function') serverProcess.kill();
    } catch {}
  }
  console.error('Error fatal al ejecutar pruebas:', err);
  process.exit(1);
});
