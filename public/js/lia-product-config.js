(function (root, factory) {
  var config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.LIA_PRODUCT_CONFIG = config;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return Object.freeze({
    TRIAL_DAYS: 7,
    FIRST_DELIVERABLE: 'a primeira leitura da sua semana',
    PAYMENT_METHODS: 'Cartão, Apple Pay ou Google Pay',
    THANKYOU_URL: 'https://www.evelynliu.com.br/obrigado-lia',
    WHATSAPP_NUMBER: '5511977130088',
    WHATSAPP_TEXT: 'Oi! Quero começar com a LIA.',
    PIXEL_ID: '519946826343805',
    PRICING: Object.freeze({
      monthly: Object.freeze({
        label: 'Mensal', price: 'R$ 49,90', period: '/mês',
        note: 'Menos de R$ 1,70 por dia. Cancele direto com a LIA, no WhatsApp.',
        checkout: 'https://payment.ticto.app/OAC407884',
      }),
      annual: Object.freeze({
        label: 'Anual', price: 'R$ 29,90', period: '/mês',
        note: 'R$ 358,80 uma vez por ano · menos de R$ 1 por dia',
        badge: 'economize 40%', checkout: 'https://payment.ticto.app/O599B4571',
      }),
    }),
  });
});
