// Cloudflare Pages Function. POST /api/log-search
//
// The one write path outside the static site. Logs every query (not
// just misses) so search quality is a content problem to chip away at
// rather than something to guess at from tuning. Best-effort by
// design: the client already swallows failures here (see
// scripts/lib/query.mjs#logSearchMiss), so this never needs to be
// fast or perfectly reliable, just cheap and safe against a public,
// unauthenticated endpoint.

const MAX_QUERY_LENGTH = 500;
const MAX_SLUG_LENGTH = 200;

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }

  const query = typeof body.query === 'string' ? body.query.slice(0, MAX_QUERY_LENGTH) : null;
  if (!query) {
    return new Response('missing query', { status: 400 });
  }

  const resultCount = Number.isInteger(body.resultCount) && body.resultCount >= 0 ? body.resultCount : 0;

  const clickedComponentSlug =
    typeof body.clickedComponentSlug === 'string'
      ? body.clickedComponentSlug.slice(0, MAX_SLUG_LENGTH)
      : null;

  try {
    await env.DB.prepare(
      `insert into search_miss (query, normalized_query, result_count, clicked_component_slug)
       values (?, ?, ?, ?)`
    )
      .bind(query, normalize(query), resultCount, clickedComponentSlug)
      .run();
  } catch (err) {
    // Logging is best-effort — never surface a 500 for this to the
    // search UI, but don't pretend it succeeded either.
    return new Response('log write failed', { status: 502 });
  }

  return new Response(null, { status: 204 });
}

export async function onRequestGet() {
  return new Response('method not allowed', { status: 405 });
}
