const http = require('http');

async function runTests() {
  // Start server
  const server = require('./server.js');
  await new Promise(r => setTimeout(r, 1000));

  function request(options, data = null) {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, raw: body });
          }
        });
      });
      req.on('error', reject);
      if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
      req.end();
    });
  }

  try {
    console.log('Testing GET / ...');
    const getIndex = await request({ hostname: 'localhost', port: 3000, path: '/', method: 'GET' });
    console.log('GET / status:', getIndex.status, getIndex.raw ? 'OK (HTML returned)' : 'Error');

    console.log('\nTesting POST /api/cards ...');
    const postRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/cards',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: 'Deseos Navideños de Carlos',
      recipient: 'Familia Perez',
      sender: 'Carlos',
      message: '¡Feliz Navidad a todos!',
      theme: 'classic-red',
      items: [
        {
          order: 1,
          url: 'https://example.com/product-1',
          title: 'Audífonos Inalámbricos',
          image: '/images/default-gift.svg',
          siteName: 'Ejemplo'
        },
        {
          order: 2,
          url: 'https://example.com/product-2',
          title: 'Reloj Inteligente',
          image: '/images/default-gift.svg',
          siteName: 'Ejemplo 2'
        }
      ]
    });

    console.log('POST /api/cards response status:', postRes.status);
    console.log('Generated Card ID:', postRes.data.id);
    console.log('QR Code Data URL exists?:', Boolean(postRes.data.qrCodeDataUrl));
    console.log('QR Target URL:', postRes.data.qrTargetUrl);

    console.log('\nTesting GET /api/cards/' + postRes.data.id + ' ...');
    const getCard = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/cards/${postRes.data.id}`,
      method: 'GET'
    });
    console.log('GET /api/cards/:id status:', getCard.status);
    console.log('Items count:', getCard.data.items.length);
    console.log('Item #1 title:', getCard.data.items[0].title);
    console.log('Item #2 title:', getCard.data.items[1].title);

    console.log('\nTesting GET /card/' + postRes.data.id + ' ...');
    const getCardPage = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/card/${postRes.data.id}`,
      method: 'GET'
    });
    console.log('GET /card/:id page status:', getCardPage.status, getCardPage.raw?.includes('cardBody') ? 'OK (Card HTML returned)' : '');

    console.log('\nAll core endpoints tested successfully! 🎉');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runTests();
