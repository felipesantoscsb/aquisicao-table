'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = readFileSync(join(__dirname, '..', 'public', 'Funil', 'links-bio.html'), 'utf8');

test('/links declara canonical, descrição e política de indexação', () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.evelynliu\.com\.br\/links"\/>/);
  assert.match(html, /<meta name="description"/);
  assert.match(html, /<meta name="robots" content="noindex,follow"\/>/);
  assert.match(html, /<meta property="og:title"/);
});

test('/links tem estrutura semântica, foco e movimento reduzido', () => {
  assert.match(html, /<main class="container">/);
  assert.match(html, /<h1 class="name">Evelyn Liu<\/h1>/);
  assert.match(html, /a:focus-visible/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /href="\/legal">Privacidade e termos<\/a>/);
  assert.doesNotMatch(html, /target="_blank"\s+onclick=/);
});

test('/links preserva o CTA rastreável que abre o WhatsApp', () => {
  assert.match(html, /wa\.me\/5511963934151\?text=[^"]*Vim%20pela%20bio/);
  assert.match(html, /class="link-primary"/);
});

test('/links exibe prova social compacta, manual e vinculada à fonte central', () => {
  assert.match(html, /class="social-proof" id="social-proof"/);
  assert.match(html, /Trecho de avaliação no Google/);
  assert.match(html, /Conheça as avaliações da Table/);
  assert.match(html, /tableclinic\.com\.br\/js\/google-reviews\.v1\.js/);
  assert.match(html, /approvedPages\.includes\('links'\)/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /setInterval|setTimeout/);
});
