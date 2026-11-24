'use strict';
/**
 * Almacenamiento de tarjetas en JSON con:
 *  - caché en memoria (no se relee el archivo en cada request)
 *  - escrituras serializadas en cola (sin condiciones de carrera)
 *  - escritura atómica (archivo temporal + rename)
 *  - respaldo automático (cards.backup.json)
 */
const fs = require('fs');
const path = require('path');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class CardStore {
  constructor(filePath) {
    this.file = filePath;
    this.backupFile = filePath.replace(/\.json$/i, '') + '.backup.json';
    this.tmpFile = filePath + '.tmp';
    this.cache = null;
    this.queue = Promise.resolve();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  _readJson(file) {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Formato inválido');
    }
    return parsed;
  }

  load() {
    if (this.cache) return this.cache;
    if (!fs.existsSync(this.file)) {
      this.cache = {};
      return this.cache;
    }
    try {
      this.cache = this._readJson(this.file);
    } catch (err) {
      console.error(`⚠️  No se pudo leer ${path.basename(this.file)} (${err.message}). Intentando respaldo...`);
      try {
        this.cache = this._readJson(this.backupFile);
        console.error('✅ Datos recuperados desde el respaldo.');
      } catch {
        // Conservar el archivo dañado para inspección manual
        try {
          fs.copyFileSync(this.file, `${this.file}.corrupt-${Date.now()}`);
        } catch {}
        this.cache = {};
      }
    }
    return this.cache;
  }

  all() {
    return this.load();
  }

  get(id) {
    return Object.prototype.hasOwnProperty.call(this.load(), id) ? this.load()[id] : null;
  }

  set(id, card) {
    this.load()[id] = card;
    return this.persist();
  }

  delete(id) {
    delete this.load()[id];
    return this.persist();
  }

  persist() {
    const snapshot = JSON.stringify(this.load(), null, 2);
    this.queue = this.queue
      .then(() => this._write(snapshot))
      .catch(err => console.error('Error guardando tarjetas:', err));
    return this.queue;
  }

  /** Espera a que terminen las escrituras pendientes. */
  flush() {
    return this.queue;
  }

  async _write(data) {
    await fs.promises.writeFile(this.tmpFile, data, 'utf-8');
    if (fs.existsSync(this.file)) {
      try {
        await fs.promises.copyFile(this.file, this.backupFile);
      } catch {}
    }
    // En Windows el rename puede fallar si un antivirus tiene el archivo abierto: reintentar.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await fs.promises.rename(this.tmpFile, this.file);
        return;
      } catch (err) {
        if (attempt === 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
        await sleep(50 * (attempt + 1));
      }
    }
  }
}

module.exports = { CardStore };
