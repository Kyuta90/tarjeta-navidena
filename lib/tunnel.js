'use strict';
/**
 * Túnel público gratuito con Cloudflare (trycloudflare.com).
 * Genera una URL https:// accesible desde cualquier red (4G, otra Wi-Fi, etc.)
 * sin abrir puertos ni configurar el router. No requiere cuenta.
 */
const fs = require('fs');
const { spawn } = require('child_process');

let child = null;
let startPromise = null;
let state = { status: 'stopped', url: null, error: null, provider: 'cloudflared', startedAt: null };

function getState() {
  return { ...state };
}

function setState(patch) {
  state = { ...state, ...patch };
}

async function resolveBinary() {
  if (process.env.CLOUDFLARED_PATH && fs.existsSync(process.env.CLOUDFLARED_PATH)) {
    return process.env.CLOUDFLARED_PATH;
  }
  let cf;
  try {
    cf = require('cloudflared');
  } catch {
    throw new Error('Falta el paquete "cloudflared". Ejecuta: npm install');
  }
  if (!fs.existsSync(cf.bin)) {
    console.log('⬇️  Descargando cloudflared (solo la primera vez)...');
    await cf.install(cf.bin);
  }
  return cf.bin;
}

function waitForUrl(proc, timeoutMs) {
  return new Promise((resolve, reject) => {
    let url = null;
    let output = '';
    const timer = setTimeout(() => {
      if (url) resolve(url); // URL creada aunque aún no confirme la conexión
      else reject(new Error('Tiempo de espera agotado al crear el túnel. ¿Hay conexión a internet?'));
    }, timeoutMs);

    const onData = chunk => {
      const text = chunk.toString();
      output = (output + text).slice(-4000);
      if (!url) {
        const m = text.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/i);
        if (m) url = m[0];
      }
      if (url && /Registered tunnel connection|Connection [a-z0-9-]+ registered/i.test(output)) {
        clearTimeout(timer);
        resolve(url);
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.once('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    proc.once('exit', code => {
      clearTimeout(timer);
      const lastLine = output.trim().split(/\r?\n/).pop() || '';
      reject(new Error(`cloudflared terminó inesperadamente (código ${code}). ${lastLine}`.trim()));
    });
  });
}

async function start(port) {
  if (state.status === 'running') return getState();
  if (startPromise) return startPromise;

  setState({ status: 'starting', url: null, error: null });
  startPromise = (async () => {
    try {
      const bin = await resolveBinary();
      child = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], {
        windowsHide: true
      });
      const url = await waitForUrl(child, 45000);

      const current = child;
      current.once('exit', () => {
        if (child === current) {
          child = null;
          setState({ status: 'stopped', url: null, error: 'El túnel se cerró', startedAt: null });
        }
      });

      setState({ status: 'running', url, error: null, startedAt: new Date().toISOString() });
      console.log(`🌐 Túnel público activo: ${url}`);
    } catch (err) {
      if (child) {
        try { child.kill(); } catch {}
        child = null;
      }
      setState({ status: 'error', url: null, error: err.message, startedAt: null });
      console.error('❌ No se pudo iniciar el túnel:', err.message);
    } finally {
      startPromise = null;
    }
    return getState();
  })();
  return startPromise;
}

function stop() {
  if (child) {
    const proc = child;
    child = null;
    try { proc.kill(); } catch {}
  }
  setState({ status: 'stopped', url: null, error: null, startedAt: null });
  return getState();
}

process.once('exit', () => {
  if (child) {
    try { child.kill(); } catch {}
  }
});

module.exports = { start, stop, getState };
