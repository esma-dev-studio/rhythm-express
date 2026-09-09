import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://rhythm.example/", {
      headers: {
        accept: "text/html",
        "x-forwarded-host": "rhythm.example",
        "x-forwarded-proto": "https",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the complete rhythm game shell and social metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*\blang=["']ja["'][^>]*>/i);
  assert.match(html, /<title>リズム・エクスプレス<\/title>/i);
  assert.match(html, /リズム・エクスプレス/);
  assert.match(html, /data-testid="start-adventure"/);
  assert.match(html, /いきさきを えらぶ/);
  assert.match(html, /おみやげシールまで あと/);
  for (const theme of ["city", "jungle", "moon"]) {
    assert.match(html, new RegExp(`route-${theme}\\.jpg`));
  }
  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']viewport["'])(?=[^>]*\bcontent=["'][^"']*viewport-fit=cover[^"']*["'])[^>]*>/i,
    "iPadのSafe Areaを有効にするviewport-fit=coverが必要です",
  );
  assert.match(
    html,
    /<meta(?=[^>]*\bproperty=["']og:image["'])(?=[^>]*\bcontent=["']https:\/\/rhythm\.example\/og\.png["'])[^>]*>/i,
  );
  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']twitter:image["'])(?=[^>]*\bcontent=["']https:\/\/rhythm\.example\/og\.png["'])[^>]*>/i,
  );
  assert.doesNotMatch(
    html,
    /codex-preview|Your site is taking shape|Building your site|react-loading-skeleton/i,
  );
});

test("packages Sites hosting metadata without unused storage bindings", async () => {
  const hosting = JSON.parse(
    await readFile(
      new URL("../dist/.openai/hosting.json", import.meta.url),
      "utf8",
    ),
  );

  assert.equal(hosting.d1, null);
  assert.equal(hosting.r2, null);
  if (hosting.project_id !== undefined) {
    assert.equal(typeof hosting.project_id, "string");
    assert.ok(hosting.project_id.length > 0);
  }
});
