'use strict';
/**
 * Módulo de integración con Google Drive para Tarjeta Navideña Digital:
 *  - Reconocimiento y extracción directa de fotos/archivos desde enlaces de Google Drive.
 *  - Respaldo automático de tarjetas en la nube para evitar pérdidas en Render (disco efímero).
 *  - Soporte de sincronización con Google Apps Script / Webhook de Google Drive.
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

let lastSyncTime = null;
let lastSyncStatus = 'idle';
let lastSyncError = null;

/**
 * Extrae ID de archivo y genera URL directa de visualización para enlaces de Google Drive
 */
function extractGoogleDriveData(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('drive.google.com') && !host.includes('docs.google.com')) {
      return null;
    }

    let fileId = null;
    // Formatos:
    // https://drive.google.com/file/d/FILE_ID/view...
    // https://drive.google.com/open?id=FILE_ID
    // https://drive.google.com/uc?id=FILE_ID
    // https://docs.google.com/document/d/FILE_ID/...
    // https://docs.google.com/spreadsheets/d/FILE_ID/...
    const m = parsed.pathname.match(/\/(?:file\/d|document\/d|spreadsheets\/d|presentation\/d|d)\/([a-zA-Z0-9_-]+)/i);
    if (m && m[1]) {
      fileId = m[1];
    } else if (parsed.searchParams.has('id')) {
      fileId = parsed.searchParams.get('id');
    }

    if (!fileId) {
      return {
        url: rawUrl,
        title: 'Carpeta o Archivo de Google Drive',
        description: 'Enlace compartido en Google Drive',
        image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=700&auto=format&fit=crop&q=80',
        siteName: 'Google Drive'
      };
    }

    // URL directa de alta resolución de Google CDN para miniaturas / fotos públicas de Drive
    const directImageUrl = `https://lh3.googleusercontent.com/d/${fileId}=s1600`;

    return {
      url: rawUrl,
      title: 'Foto / Artículo en Google Drive',
      description: 'Imagen o archivo referencial compartido desde Google Drive',
      image: directImageUrl,
      fileId: fileId,
      siteName: 'Google Drive'
    };
  } catch {
    return null;
  }
}

/**
 * Obtiene el estado actual de la integración con Google Drive
 */
function getDriveStatus() {
  const webhookConfigured = Boolean(process.env.GDRIVE_WEBHOOK_URL || process.env.GOOGLE_DRIVE_BACKUP_URL);
  return {
    configured: webhookConfigured,
    provider: webhookConfigured ? 'Google Drive Webhook / Script' : 'Local con exportación a Google Drive',
    lastSyncTime,
    lastSyncStatus,
    lastSyncError,
    directEmbedSupported: true,
    tip: webhookConfigured
      ? 'Respaldo automático en Google Drive activado'
      : 'Puedes configurar GDRIVE_WEBHOOK_URL para respaldo automático continuo en Google Drive.'
  };
}

/**
 * Sincroniza la base de datos de tarjetas con Google Drive mediante Webhook
 */
async function syncCardsToDrive(cardsData) {
  const webhookUrl = process.env.GDRIVE_WEBHOOK_URL || process.env.GOOGLE_DRIVE_BACKUP_URL;
  if (!webhookUrl) {
    return {
      success: false,
      message: 'GDRIVE_WEBHOOK_URL no configurado. Puedes exportar el archivo JSON y subirlo a Drive manualmente.'
    };
  }

  try {
    lastSyncStatus = 'syncing';
    const payload = {
      action: 'backup',
      timestamp: new Date().toISOString(),
      cardsCount: Object.keys(cardsData || {}).length,
      cards: cardsData
    };

    const res = await axios.post(webhookUrl, payload, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    });

    lastSyncTime = new Date().toISOString();
    lastSyncStatus = 'success';
    lastSyncError = null;

    return {
      success: true,
      timestamp: lastSyncTime,
      response: res.data
    };
  } catch (err) {
    lastSyncStatus = 'error';
    lastSyncError = err.message;
    console.error('Error al sincronizar con Google Drive:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Intenta restaurar tarjetas desde Google Drive si el disco local está vacío (ej. reinicio de Render)
 */
async function restoreCardsFromDrive() {
  const webhookUrl = process.env.GDRIVE_WEBHOOK_URL || process.env.GOOGLE_DRIVE_BACKUP_URL;
  if (!webhookUrl) return null;

  try {
    console.log('🔄 Verificando respaldo en Google Drive para restaurar tarjetas...');
    const res = await axios.get(`${webhookUrl}?action=get_backup`, { timeout: 12000 });
    if (res.data && res.data.cards && typeof res.data.cards === 'object') {
      const count = Object.keys(res.data.cards).length;
      console.log(`✅ ${count} tarjetas recuperadas exitosamente desde Google Drive.`);
      return res.data.cards;
    }
  } catch (err) {
    console.warn('⚠️ No se pudo recuperar respaldo previo desde Google Drive:', err.message);
  }
  return null;
}

module.exports = {
  extractGoogleDriveData,
  getDriveStatus,
  syncCardsToDrive,
  restoreCardsFromDrive
};
