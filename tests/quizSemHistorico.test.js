// A pergunta de histórico saiu do quiz /raiz em 16/10/2026 (fricção na
// captação; o dado não era usado no tratamento de quem não compra).
//
// Ela não era só uma pergunta: era a ponte para a página de captura e a ÚNICA
// fonte de tier/score do quiz. Estes testes travam as duas coisas que podem
// quebrar em silêncio depois.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const quiz = readFileSync(join(root, 'public/quiz-cakto.html'), 'utf8');
const server = readFileSync(join(root, 'src/server.js'), 'utf8');

const arrayPerguntas = quiz.slice(
  quiz.indexOf('const questions = ['),
  quiz.indexOf('\n];', quiz.indexOf('const questions = ['))
);

test('o quiz tem 7 perguntas e nenhuma de qualificação', () => {
  const blocos = arrayPerguntas.match(/^  \{$/gm) || [];
  assert.equal(blocos.length, 7);
  assert.ok(!/qualification:\s*true/.test(quiz), 'etapa de qualificação voltou');
});

test('a contagem prometida na capa bate com o número de perguntas', () => {
  // "8 perguntas diretas" com 7 perguntas é quebra de promessa na primeira tela.
  const m = quiz.match(/(\d+) perguntas diretas/);
  assert.ok(m, 'frase da promessa não encontrada');
  assert.equal(Number(m[1]), 7);
});

test('a última pergunta leva à captura, não a questions[undefined]', () => {
  // Quem fazia essa ponte era finishQualification(). Sem a guarda, responder a
  // 7ª pergunta renderiza undefined e o quiz morre na última tela.
  const fn = quiz.slice(quiz.indexOf('function selectAndAdvance'));
  assert.match(fn, /if\(current >= questions\.length\)\{[\s\S]{0,120}goTo\('page-capture'\)/);
  const posGuarda = fn.indexOf('current >= questions.length');
  const posRender = fn.indexOf('renderQuestion()');
  assert.ok(posGuarda > 0 && posGuarda < posRender, 'a guarda precisa vir antes de renderizar');
});

test('retomada após refresh na última etapa cai na captura', () => {
  assert.match(quiz, /_saved\.current >= questions\.length\)\{\s*goTo\('page-capture'\)/);
});

test('as integrações recebem tier null, não "cold"', () => {
  // 'cold' seria uma afirmação falsa: o agente do SDR manda cold direto para o
  // Protocolo Raiz, e isso derrubaria agendamento de pré-consulta.
  assert.match(quiz, /const tierIntegracao = qualificationAnswer \? qualificationAnswer\.tier : null/);
  assert.match(quiz, /tier: tierIntegracao,/);
  assert.ok(!/^\s*tier: tier,$/m.test(quiz), 'payload ainda manda o tier de exibição');
});

test('a página ainda escolhe copy genérica sem presumir histórico', () => {
  // A variante 'cold' é a única que não afirma nada sobre o que a pessoa tentou.
  assert.match(quiz, /const tier = qualificationAnswer \? qualificationAnswer\.tier : 'cold'/);
  assert.match(quiz, /tierCopy\[tier\] \|\| tierCopy\.cold/);
});

test('nada mais referencia o código que morreu com a pergunta', () => {
  for (const nome of ['toggleQualification', 'selectedQual', 'qualificationScore']) {
    const usos = (quiz.match(new RegExp(nome, 'g')) || []).length;
    assert.equal(usos, 0, `${nome} ainda aparece ${usos}x — ReferenceError em produção`);
  }
});

test('qualificationAnswer continua existindo, sempre null', () => {
  // Make, CAPI e o SDR-forward leem esse campo; remover a variável quebraria
  // os pontos de leitura em vez de entregar ausência.
  assert.match(quiz, /let qualificationAnswer = null;/);
});

test('o servidor monta histórico vazio sem estourar', () => {
  // body.qualification vem null agora: o acesso precisa seguir opcional.
  assert.match(server, /body\.qualification\?\.items \|\| \[\]/);
  assert.match(server, /historico:\s+historico \|\| '',/);
});

test('o link da bio vai direto ao WhatsApp com a frase que o agente reconhece', () => {
  const bio = readFileSync(join(root, 'public/Funil/links-bio.html'), 'utf8');
  assert.match(bio, /wa\.me\/5511963934151\?text=/);
  // A frase é o único carregador de origem: o WhatsApp não passa UTM.
  assert.match(bio, /Vim%20pela%20bio/);
  assert.ok(!/evelynliu\.com\.br\/conversa/.test(bio), 'ainda aponta para o formulário');
});
