// Private Cloudflare Pages runtime. App assets live only in the Worker bundle,
// never in public static storage. A fail-open Functions quota fallback can
// therefore display only the inert locked page, not the application.
export function createPrivateWorker(assets, passwordHash, logSearch = {}) {
  if (!/^[a-f0-9]{64}$/.test(passwordHash)) throw new Error('A SHA-256 access password digest is required.');
  const headers = {
    'Cache-Control':'private, no-store',
    'X-Robots-Tag':'noindex, noarchive',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'X-Frame-Options':'DENY',
  };
  const locked = () => new Response('Private Roof-Wiki. Enter the supplied username and access password.', {
    status:401, headers:{...headers,'Content-Type':'text/plain; charset=utf-8','WWW-Authenticate':'Basic realm="Private Roof-Wiki", charset="UTF-8"'}
  });
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.protocol !== 'https:' && url.hostname !== 'localhost') return locked();
      const auth = request.headers.get('Authorization') || '';
      if (!/^Basic /i.test(auth) || auth.length > 512) return locked();
      let username, password;
      try {
        const decoded = atob(auth.slice(6));
        const colon = decoded.indexOf(':');
        if (colon < 0) return locked();
        username = decoded.slice(0, colon);
        password = decoded.slice(colon + 1);
      } catch { return locked(); }
      if (username !== 'roofwiki' || !password) return locked();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)));
      const actual = Array.from(digest, b => b.toString(16).padStart(2,'0')).join('');
      let different = actual.length ^ passwordHash.length;
      for (let i = 0; i < actual.length; i++) different |= actual.charCodeAt(i) ^ passwordHash.charCodeAt(i);
      if (different !== 0) return locked();
      if (url.pathname === '/api/log-search') {
        const handler = logSearch[request.method];
        if (!handler) return new Response('Method not allowed', {status:405, headers});
        let response;
        try { response = await handler({request,env}); }
        catch { return new Response('Search logging is unavailable', {status:502, headers}); }
        const secured = new Response(response.body, response);
        for (const [name,value] of Object.entries(headers)) secured.headers.set(name,value);
        return secured;
      }
      if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed', {status:405, headers});
      const path = url.pathname === '/' ? '/index.html' : url.pathname.replace(/\/$/,'');
      const asset = assets[path] || (!path.split('/').at(-1).includes('.') ? assets[path + '.html'] : null);
      if (!asset) return new Response('Not found', {status:404, headers});
      const body = asset.base64 ? Uint8Array.from(atob(asset.body), c => c.charCodeAt(0)) : asset.body;
      return new Response(request.method === 'HEAD' ? null : body, {headers:{...headers,'Content-Type':asset.type}});
    }
  };
}
