'use strict';
/**
 * Utilidades de red: IPs de la máquina, detección de "dueño local" y hosts privados.
 */
const os = require('os');
const net = require('net');
const { isPrivateIp, normalizeIp } = require('./security');

/** IPs físicas (Wi-Fi / Ethernet), filtrando adaptadores virtuales. Wi-Fi primero. */
function getAllValidNetworkIps() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    const lowerName = name.toLowerCase();
    if (
      lowerName.includes('virtualbox') ||
      lowerName.includes('vmware') ||
      lowerName.includes('vethernet') ||
      lowerName.includes('wsl') ||
      lowerName.includes('loopback') ||
      lowerName.includes('docker') ||
      lowerName.includes('tailscale') ||
      lowerName.includes('zerotier')
    ) {
      continue;
    }

    for (const iface of addrs || []) {
      if (iface.family !== 'IPv4' && iface.family !== 4) continue;
      if (iface.internal) continue;
      if (iface.address.startsWith('169.254.') || iface.address.startsWith('192.168.56.')) continue;

      let priority = 10;
      let typeLabel = 'Red local';
      let kind = 'other';
      if (/wi-?fi|wireless|wlan/.test(lowerName)) {
        priority = 100;
        typeLabel = 'Wi-Fi (recomendado para celulares)';
        kind = 'wifi';
      } else if (lowerName.includes('ethernet') || lowerName.startsWith('eth') || lowerName.startsWith('en')) {
        priority = 50;
        typeLabel = 'Ethernet (cable)';
        kind = 'ethernet';
      }

      candidates.push({
        name,
        ip: iface.address,
        kind,
        label: `${iface.address} - ${typeLabel}`,
        priority
      });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates;
}

function getLocalNetworkIp() {
  const ips = getAllValidNetworkIps();
  return ips.length > 0 ? ips[0].ip : 'localhost';
}

/** Todas las direcciones propias de esta máquina (incluye loopback). */
function getOwnAddresses() {
  const set = new Set(['127.0.0.1', '::1']);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const iface of addrs || []) set.add(normalizeIp(iface.address));
  }
  return set;
}

function hostnameFromHost(hostHeader) {
  const host = String(hostHeader || '').trim().toLowerCase();
  if (!host) return '';
  if (host.startsWith('[')) return host.slice(1, host.indexOf(']'));
  const parts = host.split(':');
  return parts.length > 2 ? host : parts[0]; // IPv6 sin corchetes
}

/**
 * "Dueño local": la petición viene del mismo computador que ejecuta el servidor,
 * sin pasar por un proxy/túnel (cloudflared agrega cabeceras de reenvío y otro Host).
 */
function isLocalOwner(req) {
  const own = getOwnAddresses();
  const remote = normalizeIp(req.socket && req.socket.remoteAddress);
  if (!own.has(remote)) return false;
  const h = req.headers || {};
  if (h['x-forwarded-for'] || h['cf-connecting-ip'] || h['x-real-ip'] || h['forwarded']) return false;
  const hostname = hostnameFromHost(h.host);
  return hostname === 'localhost' || own.has(normalizeIp(hostname));
}

/** ¿El host corresponde a algo local/privado (no accesible desde internet)? */
function isLocalOrPrivateHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (net.isIP(normalizeIp(h))) return isPrivateIp(h);
  return false;
}

module.exports = {
  getAllValidNetworkIps,
  getLocalNetworkIp,
  hostnameFromHost,
  isLocalOwner,
  isLocalOrPrivateHost
};
