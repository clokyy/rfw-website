// JSON-only writes plus browser origin checks supplement SameSite=Strict cookies.
function checkWrite(event) {
 if (['GET','HEAD','OPTIONS'].includes(event.httpMethod)) return null;
 const h = event.headers || {};
 if (h['sec-fetch-site'] === 'cross-site') return 'Cross-site request rejected';
 if (h.origin) {
  try {
   const origin = new URL(h.origin), host = h.host || (event.rawUrl && new URL(event.rawUrl).host);
   if (!host || origin.host !== host || !['https:','http:'].includes(origin.protocol)) return 'Cross-site request rejected';
  } catch { return 'Invalid request origin'; }
 }
 if (event.httpMethod !== 'DELETE' && (h['content-type'] || '').toLowerCase().split(';')[0].trim() !== 'application/json') return 'Send an application/json request';
 return null;
}
module.exports = {checkWrite};
