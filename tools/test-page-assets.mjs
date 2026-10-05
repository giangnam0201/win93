import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { pageAssetResponse } from '../42/api/os/network/pageAssets.js';

const path = '/c/libs/test/library.js';
const original = Buffer.from('export const answer = 42;\n'.repeat(4000));
const compressed = gzipSync(original);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (url === '/asset-map.json') return Response.json({[path]: {url: path + '.gz', size: original.length}});
  assert.equal(url, path + '.gz');
  return new Response(compressed);
};
try {
  const request = new Request('https://example.test' + path);
  const full = await pageAssetResponse(path, request);
  assert.equal(full.status, 200);
  assert.match(full.headers.get('Content-Type'), /javascript/);
  assert.equal(full.headers.get('Content-Length'), String(original.length));
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), original);
  for (const [range, start, end] of [['bytes=7-19', 7, 19], ['bytes=-10', original.length - 10, original.length - 1]]) {
    const partial = await pageAssetResponse(path, new Request(request, {headers: {Range: range}}));
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('Content-Range'), `bytes ${start}-${end}/${original.length}`);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), original.subarray(start, end + 1));
  }
  const invalid = await pageAssetResponse(path, new Request(request, {headers: {Range: 'bytes=999999-'}}));
  assert.equal(invalid.status, 416);
  assert.equal(await pageAssetResponse('/c/missing.js', request), undefined);
  assert.equal(await pageAssetResponse('/42/core.js', request), undefined);
  console.log('Compressed assets: original bytes, MIME type, ranges, and missing-file fallthrough verified');
} finally {
  globalThis.fetch = realFetch;
}
