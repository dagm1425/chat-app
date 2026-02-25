const dns = require("node:dns").promises;
const net = require("node:net");
const { createError } = require("./errors");

const isPrivateIpv4 = (ip) => {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;

  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
};

const isPrivateIpv6 = (ip) => {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mappedIpv4 = normalized.replace("::ffff:", "");
    return net.isIP(mappedIpv4) === 4 ? isPrivateIpv4(mappedIpv4) : true;
  }
  return false;
};

const isPrivateIp = (ip) => {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
};

const isBlockedHostname = (hostname) => {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  );
};

const assertSafeTarget = async (urlString) => {
  const hostname = new URL(urlString).hostname;

  // Block obvious local hostnames first; backend must never fetch internal hosts.
  if (isBlockedHostname(hostname)) {
    throw createError("blocked_hostname");
  }

  // If input is a raw IP (not a domain), reject private/internal ranges directly.
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw createError("blocked_private_ip");
    return;
  }

  let addresses;
  try {
    // Resolve domain -> IPs so we can enforce private/internal IP blocking.
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (_) {
    throw createError("dns_lookup_failed");
  }

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw createError("dns_lookup_empty");
  }

  // If any resolved IP is private/internal, block the target.
  for (const addr of addresses) {
    if (!addr?.address || isPrivateIp(addr.address)) {
      throw createError("blocked_private_ip");
    }
  }
};

module.exports = {
  assertSafeTarget,
};
