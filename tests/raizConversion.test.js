const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const html = fs.readFileSync(require('node:path').join(__dirname,'../public/quiz-cakto.html'),'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const questions ='));
function harness(saved) {
  const nodes = new Map(); const calls = []; const timers = [];
  const storage = new Map(saved ? [['tq',JSON.stringify(saved)]] : []);
  function node(id){
    if(!nodes.has(id)) nodes.set(id,{value:'',textContent:'',innerHTML:'',style:{},hidden:true,
      classList:{add(){},remove(){}},focus(){},appendChild(){},insertAdjacentHTML(){},insertAdjacentElement(){},remove(){},getAttribute(){return null;}});
    return nodes.get(id);
  }
  const context = vm.createContext({console:{log(){},error(){}},URL,TextEncoder,crypto:webcrypto,
    document:{cookie:'',getElementById:node,querySelector:node,querySelectorAll:()=>[],createElement:()=>node('created'),addEventListener(){}},
    sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    setTimeout:(fn,delay)=>{timers.push({fn,delay});},
    fbq:(...args)=>calls.push({pixel:args}),gtag(){},
    fetch:async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return {status:200};},
    window:{location:{href:'https://example.test/raiz'},scrollTo(){}}
  });
  vm.runInContext(script,context);
  return {run:s=>vm.runInContext(s,context),node,calls,storage,timers};
}
test('all three capture fields remain mandatory and concurrent submit emits one lead',async()=>{
  const h=harness();
  h.node('user-name').value='Pessoa Teste'; h.node('user-phone').value='(11) 99999-9999';
  await h.run('submitCapture()'); assert.equal(h.calls.length,0);
  h.node('user-email').value='pessoa@example.test';
  await Promise.all([h.run('submitCapture()'),h.run('submitCapture()')]);
  const leads=h.calls.filter(c=>c.body?.event_name==='Lead'); assert.equal(leads.length,1);
  assert.equal(leads[0].body.email,'pessoa@example.test');
  assert.equal(leads[0].body.nome,'Pessoa Teste');
  assert.equal(leads[0].body.whats,'11999999999');
  assert.equal(h.calls.find(c=>c.pixel?.[1]==='Lead').pixel[3].eventID,leads[0].body.lead_event_id);
});
test('capture refresh keeps answers and qualification without persisting contact data',()=>{
  const h=harness();
  h.run("current=7; scores.E=7; quizAnswers=[{tipo:'E',resposta:'Resposta real'}]; selectedQual.add('jejum'); finishQualification();");
  const saved=JSON.parse(h.storage.get('tq')); assert.equal(saved.qualificationAnswer.items[0],'jejum');
  assert.equal(saved.quizAnswers[0].resposta,'Resposta real');
  assert.deepEqual(Object.keys(saved).sort(),['current','qualificationAnswer','quizAnswers','scores']);
  const restored=harness(saved);
  assert.equal(restored.run('qualificationAnswer.tier'),'cold');
  assert.equal(restored.run('quizAnswers.length'),1);
  assert.equal(restored.calls.length,0);
});
test('each result preserves dossier labels, full answers and matching registration event IDs',()=>{
  const names={E:'A Comedora Emocional',R:'A Comedora Restritiva',S:'A Comedora em Modo Sobrevivência',A:'A Comedora Desconectada'};
  for(const type of Object.keys(names)){
    const h=harness();
    h.run(`scores.${type}=7; quizAnswers=[{tipo:'${type}',resposta:'Uma resposta real'}]; window._leadName='Pessoa'; window._leadEmail='pessoa@example.test'; window._leadPhone='5511999999999'; window._leadEventId='lead-test'; showResult();`);
    const dossier=h.calls.find(c=>c.url.includes('make.com'));
    assert.equal(dossier.body.profileName,names[type]); assert.equal(dossier.body.respostas.length,1);
    assert.equal(dossier.body.email,'pessoa@example.test'); assert.equal(dossier.body.whats,'11999999999');
    assert.equal(h.run(`buildSignals('${type}',quizAnswers).length`),1);
    assert.ok(h.node('first-step-title').textContent); assert.ok(h.node('first-step-copy').textContent);
    const reg=h.calls.find(c=>c.body?.event_name==='CompleteRegistration');
    assert.equal(h.calls.find(c=>c.pixel?.[1]==='CompleteRegistration').pixel[3].eventID,reg.body.lead_event_id);
    assert.equal(reg.body.quiz_lead_event_id,'lead-test');
  }
});
test('checkout retains identity, price, join key and Pixel/CAPI dedup',()=>{
  const h=harness(); h.run("window._leadName='Pessoa'; window._leadEmail='pessoa@example.test'; window._leadPhone='5511999999999'; window._leadEventId='lead-test'; goOffer();");
  const url=new URL(h.run('window.location.href'));
  assert.equal(url.searchParams.get('email'),'pessoa@example.test'); assert.equal(url.searchParams.get('sck'),'lead-test');
  assert.equal(url.searchParams.get('phone'),'+5511999999999');
  const pixel=h.calls.find(c=>c.pixel?.[1]==='InitiateCheckout').pixel;
  assert.equal(pixel[2].value,97);
  assert.equal(pixel[3].eventID,h.calls.find(c=>c.url?.endsWith('initiate-checkout')).body.event_id);
});
test('sticky CTA is revealed only after the offer becomes visible',()=>{
  const h=harness();
  h.run("window.IntersectionObserver=true; var observerCallback; var disconnected=false; var IntersectionObserver=class {constructor(cb){observerCallback=cb;} observe(){} disconnect(){disconnected=true;}}; observeOffer();");
  assert.equal(h.node('sticky-offer').hidden,true);
  h.run('observerCallback([{isIntersecting:false}])'); assert.equal(h.node('sticky-offer').hidden,true);
  h.run('observerCallback([{isIntersecting:true}])'); assert.equal(h.node('sticky-offer').hidden,false);
  assert.equal(h.run('disconnected'),true);
});
