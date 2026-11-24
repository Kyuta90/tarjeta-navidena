'use strict';
/**
 * Imágenes subidas por el usuario: se guardan como archivos en data/uploads
 * en vez de Base64 dentro de cards.json.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEFAULT_IMAGE } = require('./security');

const MIME_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml'
};

function hasValidSignature(buf, ext) {
  if (buf.length < 12) return false;
  switch (ext) {
    case 'png':
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    case 'jpg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'gif':
      return buf.slice(0, 3).toString('ascii') === 'GIF';
    case 'webp':
      return buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
    default:
      return false;
  }
}

function createUploads(uploadsDir) {
  fs.mkdirSync(uploadsDir, { recursive: true });

  /** Convierte un data:image/...;base64 en archivo y devuelve su ruta pública (/uploads/...). */
  function persistDataImage(dataUrl) {
    const m = String(dataUrl || '').match(/^data:image\/(png|jpe?g|webp|gif);base64,([\s\S]+)$/i);
    if (!m) return DEFAULT_IMAGE;
    let ext = m[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    const buf = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
    if (!buf.length || !hasValidSignature(buf, ext)) return DEFAULT_IMAGE;

    const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32);
    const name = `${hash}.${ext}`;
    const target = path.join(uploadsDir, name);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, buf);
    }
    return `/uploads/${name}`;
  }

  /** Normaliza la imagen de un item: si viene en Base64 la guarda como archivo. */
  function normalizeItemImage(image) {
    return typeof image === 'string' && image.startsWith('data:') ? persistDataImage(image) : image;
  }

  /** Para la tarjeta portable: convierte rutas locales en data URLs autocontenidas. */
  function localImageToDataUrl(publicDir, src) {
    if (typeof src !== 'string') return src;
    let file = null;
    if (/^\/uploads\/[\w\-.]+$/.test(src)) file = path.join(uploadsDir, path.basename(src));
    else if (/^\/images\/[\w\-.]+$/.test(src)) file = path.join(publicDir, 'images', path.basename(src));
    if (!file || !fs.existsSync(file)) return src;
    const ext = path.extname(file).slice(1).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
    return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  }

  return { persistDataImage, normalizeItemImage, localImageToDataUrl };
}

module.exports = { createUploads };
