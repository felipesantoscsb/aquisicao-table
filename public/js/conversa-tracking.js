(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ConversaTracking = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
  const FIRST_COOKIE = 'table_attr_first';
  const LATEST_COOKIE = 'table_attr_latest';
  const MAX_AGE = 60 * 60 * 24 * 90;
  const PIXEL_ID = '989971718548782'; // mesmo Pixel principal usado pelo /raiz
  // O /raiz, /raiz-cakto, /raiz-vi e /raiz-google disparam 'Lead' neste mesmo
  // pixel. Enquanto o /conversa tambem usava 'Lead', o Meta somava os quatro
  // funis num balde so: a campanha de pre-consulta era creditada por cadastro
  // do quiz e otimizava para o publico errado. 'SubmitApplication' e evento
  // padrao, o /raiz nao usa, e descreve o que acontece aqui: formulario
  // enviado. 'Schedule' fica reservado para quando a pre-consulta for de fato
  // agendada, o que da um funil de dois passos no pixel.
  // Trocar aqui exige trocar junto o evento de conversao do conjunto no Meta.
  const CONVERSION_EVENT = 'SubmitApplication';
  let initialized = false;
  let intentTracked = false;
  let pixelReady = false;

  function parseCookies(cookieString) {
    return String(cookieString || '').split(';').reduce((result, part) => {
      const index = part.indexOf('=');
      if (index < 0) return result;
      const key = part.slice(0, index).trim();
      try { result[key] = decodeURIComponent(part.slice(index + 1)); } catch { result[key] = part.slice(index + 1); }
      return result;
    }, {});
  }

  function safeJson(value) {
    try { return JSON.parse(value || '{}'); } catch { return {}; }
  }

  function captureValues(search, cookieString, nowMs) {
    const params = new URLSearchParams(search || '');
    const cookies = parseCookies(cookieString);
    const values = {};
    ATTR_KEYS.forEach((key) => {
      const value = params.get(key);
      if (value && value.trim()) values[key] = value.trim().slice(0, 250);
    });
    if (cookies._fbp) values.fbp = cookies._fbp;
    if (cookies._fbc) values.fbc = cookies._fbc;
    if (values.fbclid && !values.fbc) values.fbc = `fb.1.${nowMs}.${values.fbclid}`;
    if (Object.keys(values).length) values.captured_at = Math.floor(nowMs / 1000);
    return values;
  }

  function mergeFirst(first, incoming) {
    const result = { ...(first || {}) };
    Object.entries(incoming || {}).forEach(([key, value]) => {
      if (value !== '' && value != null && !result[key]) result[key] = value;
    });
    return result;
  }

  function cookieOptions() {
    return `Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${root.location?.protocol === 'https:' ? '; Secure' : ''}`;
  }

  function setCookie(name, value) {
    if (!root.document) return;
    root.document.cookie = `${name}=${encodeURIComponent(value)}; ${cookieOptions()}`;
  }

  function persistAttribution() {
    if (!root.document || !root.location) return { first: {}, latest: {} };
    const cookies = parseCookies(root.document.cookie);
    const incoming = captureValues(root.location.search, root.document.cookie, Date.now());
    const first = mergeFirst(safeJson(cookies[FIRST_COOKIE]), incoming);
    const latest = Object.keys(incoming).length ? incoming : safeJson(cookies[LATEST_COOKIE]);
    if (incoming.fbc && !cookies._fbc) setCookie('_fbc', incoming.fbc);
    if (Object.keys(first).length) setCookie(FIRST_COOKIE, JSON.stringify(first));
    if (Object.keys(latest).length) setCookie(LATEST_COOKIE, JSON.stringify(latest));
    return { first, latest };
  }

  function getAttribution() {
    const persisted = persistAttribution();
    return { ...persisted.first, latest: persisted.latest };
  }

  function createEventId() {
    if (root.crypto?.randomUUID) return root.crypto.randomUUID();
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }

  function installPixel(pixelId) {
    if (!pixelId || pixelReady) return;
    if (!root.fbq) {
      const fbq = root.fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
      if (!root._fbq) root._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      const script = root.document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      const firstScript = root.document.getElementsByTagName('script')[0];
      firstScript.parentNode.insertBefore(script, firstScript);
    }
    root.fbq('init', pixelId);
    root.fbq('track', 'PageView');
    root.fbq('track', 'ViewContent', { content_name: 'Conversa' });
    pixelReady = true;
  }

  function init() {
    if (initialized) return;
    initialized = true;
    persistAttribution();
    installPixel(PIXEL_ID);
  }

  function trackIntent() {
    if (intentTracked || !pixelReady || !root.fbq) return;
    intentTracked = true;
    root.fbq('track', 'Contact', { content_name: 'Conversa - formulário iniciado' });
  }

  // Nome mantido: para o negocio isto e um lead. O que muda e o evento do
  // pixel, para nao se misturar com o do quiz.
  function trackLead(eventId) {
    if (!pixelReady || !root.fbq || !eventId) return;
    root.fbq('track', CONVERSION_EVENT, { content_name: 'Conversa' }, { eventID: eventId });
  }

  return { parseCookies, captureValues, mergeFirst, persistAttribution, getAttribution, createEventId, init, trackIntent, trackLead, CONVERSION_EVENT };
});
