'use strict';
/**
 * Utilidades de seguridad:
 *  - Protección SSRF (bloqueo de IPs privadas/loopback, también tras DNS y redirecciones)
 *  - Saneamiento de datos de tarjetas (XSS / datos inválidos)
 *  - Tokens y comparación en tiempo constante
 */
const net = require('net');
const dns = require('dns');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const DEFAULT_IMAGE = '/images/default-gift.svg';
const ALLOWED_THEMES = ['classic-red', 'winter-night', 'forest-gold'];
const ALLOWED_PRIORITIES = ['alta', 'normal'];
const MAX_ITEMS = 50;
const MAX_DATA_IMAGE_LENGTH = 3_000_000; // ~2.2 MB binarios

// ---------------------------------------------------------------------------
// Rangos de red privados / reservados
// ---------------------------------------------------------------------------
const blockList = new net.BlockList();
[
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]
].forEach(([addr, prefix]) => blockList.addSubnet(addr, prefix, 'ipv4'));
[
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]
].forEach(([addr, prefix]) => blockList.addSubnet(addr, prefix, 'ipv6'));

function normalizeIp(ip) {
  let addr = String(ip || '').trim().replace(/^\[|\]$/g, '');
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) addr = mapped[1];
  return addr;
}

function isPrivateIp(ip) {
  const addr = normalizeIp(ip);
  const type = net.isIP(addr);
  if (type === 4) return blockList.check(addr, 'ipv4');
  if (type === 6) return blockList.check(addr, 'ipv6');
  return true; // no es una IP válida => tratar como no confiable
}

function isBlockedHostname(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) {
    return true;
  }
  if (net.isIP(h)) return isPrivateIp(h);
  return false;
}

/** Valida que la URL sea http(s) y no apunte a la red local. Lanza Error si no. */
function assertPublicHttpUrl(raw) {
  const u = new URL(raw);
  if (!/^https?:$/.test(u.protocol)) {
    throw new Error('Solo se permiten enlaces http o https');
  }
  if (isBlockedHostname(u.hostname)) {
    throw new Error('No se permiten direcciones locales o privadas');
  }
  return u;
}

/** lookup DNS que rechaza resoluciones hacia IPs privadas (evita DNS rebinding). */
function guardedLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err);
    const list = Array.isArray(address) ? address : [{ address, family }];
    if (list.length === 0 || list.some(a => isPrivateIp(a.address))) {
      const blocked = new Error(`Destino bloqueado por seguridad: ${hostname}`);
      blocked.code = 'EBLOCKED';
      return callback(blocked);
    }
    return callback(null, address, family);
  });
}

const safeHttpAgent = new http.Agent({ lookup: guardedLookup, keepAlive: false });
const safeHttpsAgent = new https.Agent({ lookup: guardedLookup, keepAlive: false });

function beforeRedirect(options) {
  const host = options.hostname || options.host;
  if (isBlockedHostname(host)) {
    throw new Error('Redirección bloqueada hacia una dirección privada');
  }
}

/** Opciones para axios que aplican la protección SSRF (incluye redirecciones). */
const safeAxiosOptions = {
  httpAgent: safeHttpAgent,
  httpsAgent: safeHttpsAgent,
  beforeRedirect,
  maxContentLength: 5 * 1024 * 1024
};

// ---------------------------------------------------------------------------
// Saneamiento de datos
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function cleanText(value, max) {
  if (value === undefined || value === null) return '';
  return String(value).replace(CONTROL_CHARS, '').trim().slice(0, max);
}

function cleanHttpUrl(value) {
  const s = cleanText(value, 2048);
  if (!s) return '';
  try {
    const u = new URL(s);
    return /^https?:$/.test(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}

const DATA_IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;

function cleanImage(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return DEFAULT_IMAGE;
  if (DATA_IMAGE_RE.test(s)) {
    return s.length <= MAX_DATA_IMAGE_LENGTH ? s : DEFAULT_IMAGE;
  }
  if (/^\/(images|uploads)\/[\w\-.]+$/.test(s) && !s.includes('..')) return s;
  return cleanHttpUrl(s) || DEFAULT_IMAGE;
}

function cleanId(value, fallback) {
  const s = cleanText(value, 64);
  return /^[\w-]+$/.test(s) ? s : fallback;
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.slice(0, MAX_ITEMS).map((raw, idx) => {
    const it = raw && typeof raw === 'object' ? raw : {};
    let id = cleanId(it.id, `item-${idx + 1}`);
    if (seen.has(id)) id = `${id}-${idx + 1}`;
    seen.add(id);
    return {
      id,
      order: idx + 1,
      url: cleanHttpUrl(it.url),
      title: cleanText(it.title, 200) || `Deseo #${idx + 1}`,
      description: cleanText(it.description, 500),
      image: cleanImage(it.image),
      siteName: cleanText(it.siteName, 80),
      price: cleanText(it.price, 40),
      priority: ALLOWED_PRIORITIES.includes(it.priority) ? it.priority : 'normal'
    };
  });
}

function sanitizeCardInput(body) {
  const b = body && typeof body === 'object' ? body : {};
  return {
    title: cleanText(b.title, 120) || 'Mis Deseos Navideños 🎄',
    recipient: cleanText(b.recipient, 80),
    sender: cleanText(b.sender, 80),
    message: cleanText(b.message, 1000),
    theme: ALLOWED_THEMES.includes(b.theme) ? b.theme : 'classic-red',
    items: sanitizeItems(b.items)
  };
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[ch]));
}

/** JSON seguro para incrustar dentro de <script type="application/json">. */
function safeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
function newToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

module.exports = {
  DEFAULT_IMAGE,
  ALLOWED_THEMES,
  MAX_ITEMS,
  normalizeIp,
  isPrivateIp,
  isBlockedHostname,
  assertPublicHttpUrl,
  safeAxiosOptions,
  cleanText,
  cleanHttpUrl,
  cleanImage,
  sanitizeItems,
  sanitizeCardInput,
  escapeHtml,
  safeJsonForHtml,
  newToken,
  safeEqual
};
