// Run: node --test giao_dien/admin.test.cjs
// DOM/API doubles verify behavior; browser layout and MySQL need separate checks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function setup() {
  const elements = new Map();
  class Element {
    constructor(tag) {
      this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {};
      this.classes = new Set(); this.textContent = ''; this.hidden = false;
      this.classList = {
        toggle: (name, force) => {
          const on = force ?? !this.classes.has(name);
          on ? this.classes.add(name) : this.classes.delete(name); return on;
        },
        remove: name => this.classes.delete(name)
      };
    }
    set id(value) { this._id = value; elements.set(value, this); }
    get id() { return this._id; }
    set value(value) { this._value = String(value); }
    get value() { return this._value ?? (this.tag === 'select' ? this.children[0]?.value : '') ?? ''; }
    set className(value) { this.classes = new Set(value.split(' ')); }
    get className() { return [...this.classes].join(' '); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = []; if (this.tag === 'select') delete this._value; this.append(...children); }
    setAttribute(key, value) { this.attrs[key] = value; }
    removeAttribute(key) { delete this.attrs[key]; }
    querySelectorAll(selector) {
      const tags = selector.split(',');
      return this.children.flatMap(child => [
        ...(tags.includes(child.tag) ? [child] : []), ...child.querySelectorAll(selector)
      ]);
    }
    createTHead() { const e = new Element('thead'); this.append(e); return e; }
    createTBody() { const e = new Element('tbody'); this.append(e); return e; }
    insertRow() { const e = new Element('tr'); this.append(e); return e; }
    insertCell() { const e = new Element('td'); this.append(e); return e; }
    click() { this.clicked = true; }
  }
  for (const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const element = new Element(match[1]); element.id = match[2];
  }
  const calls = [], storage = new Map();
  const document = {
    getElementById: id => elements.get(id),
    createElement: tag => new Element(tag),
    createElementNS: (namespaceURI, tag) => Object.assign(new Element(tag), { namespaceURI }),
    createTextNode: text => Object.assign(new Element('#text'), { textContent: text }),
    querySelectorAll: () => [], addEventListener() {}
  };
  const context = vm.createContext({
    document, URLSearchParams, location: { origin: 'http://127.0.0.1:8102', port: '8102', protocol: 'http:', search: '?service=identity', hash: '#workspace' },
    sessionStorage: { getItem: key => storage.get(key), setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    URL, AbortSignal, setTimeout: callback => callback(), window: { addEventListener() {} },
    confirm: () => true,
    fetch: async (url, options) => {
      calls.push({ path: new URL(url).pathname + new URL(url).search, ...options });
      return context.reply(new URL(url), options);
    },
    reply: () => response({})
  });
  // Skip only automatic network startup. Run the same functions and event handlers as the page.
  vm.runInContext(source.slice(0, source.lastIndexOf('renderServices();showView();(async()=>')), context);
  const run = code => vm.runInContext(code, context);
  const $ = id => elements.get(id);
  return { context, run, $, calls, storage, event: { preventDefault() {} } };
}
function response(data, status = 200, type = 'application/json') {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => type }, json: async () => data };
}
function actionsFor(name) {
  if (['identity', 'ledger'].includes(name)) {
    const source = fs.readFileSync(path.join(root, 'python', name, 'main.py'), 'utf8');
    const literal = source.match(/\}, (\[[\s\S]*?\])\)/)[1];
    return JSON.parse(literal.replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/,\s*\]/g, ']'));
  }
  return JSON.parse(fs.readFileSync(path.join(root, ['fx', 'reporting'].includes(name) ? 'php' : 'javascript', name, 'service.json'), 'utf8')).actions;
}
function configure(t, name, data = { Example: [{ id: 7, user_id: 1, name: 'Ví chính' }] }) {
  const services = ['identity','ledger','planning','recurring','fx','reporting'].map((n,i) => ({name:n, url:'http://127.0.0.1:'+(8101+i)+'/admin'}));
  t.context.reply = url => url.pathname === '/auth/me' ? response({role:'admin',email:'qa@example.test'})
    : url.pathname === '/admin/actions' ? response({service:name,actions:actionsFor(name),services})
    : url.pathname === '/admin/data' ? response(data)
    : response({id:8});
  t.run("token='qa-token';");
}

test('all six source action lists render typed fields, ID helpers and query dates', async () => {
  for (const name of ['identity','ledger','planning','recurring','fx','reporting']) {
    const t = setup(); configure(t, name); await t.run('openAdmin()');
    assert.equal(t.$('action-count').textContent, String(actionsFor(name).length).padStart(2,'0'));
    assert.equal(t.$('nav').children.length, 6);
    assert.equal(t.$('service-cards').children.length, 6);
    for (const [i,a] of actionsFor(name).entries()) {
      t.$('action').value = i; t.run('selectAction()');
      assert.equal(t.$('path').value, a.path);
      assert.equal(t.$('fields').querySelectorAll('input,select').length, Object.keys(a.body || {}).length);
      for (const input of t.$('parameters').querySelectorAll('input,select')) {
        if (input.dataset.param === 'id') { input.value = '17'; input.oninput(); assert.ok(t.$('path').value.includes('/17')); }
        else assert.equal(input.type, 'date');
      }
    }
  }
});
test('login, create transaction with decimal string, filter tables, logout clears data', async () => {
  const t = setup(); configure(t, 'ledger', { 'Ví tiền': [{id:7,name:'Ví chính'}, {id:8,name:'Tiết kiệm'}] });
  const reply = t.context.reply;
  t.context.reply = (url,options) => url.pathname === '/auth/login' ? response({access_token:'qa-token'}) : reply(url,options);
  t.$('email').value = 'qa@example.test'; t.$('password').value = 'test-only';
  await t.$('login-form').onsubmit(t.event);
  assert.equal(t.run('authenticated'), true); assert.equal(t.$('password').value, '');
  assert.equal(t.storage.get('token'), 'qa-token');
  t.$('action').value = 2; t.run('selectAction()'); t.$('body-amount').value = '10.50';
  await t.$('action-form').onsubmit(t.event);
  const call = t.calls.find(c => c.path === '/transactions');
  const body = JSON.parse(call.body); assert.equal(body.amount,'10.50'); assert.equal(body.wallet_id,1);
  assert.equal(t.$('result-state').textContent,'Thành công');
  t.$('table-search').value = 'Tiết'; t.run('renderData()');
  assert.equal(t.$('tables').children[0].children[1].textContent, '1 / 2 dòng đã tải');
  await t.$('logout').onclick();
  assert.equal(t.run('authenticated'),false); assert.equal(t.storage.has('token'),false);
  assert.equal(t.$('tables').children.length,0); assert.equal(t.$('login-box').hidden,false);
});
test('boolean remains boolean; path ID produces correct PATCH', async () => {
  const t=setup();configure(t,'identity');await t.run('openAdmin()');
  t.$('action').value=1;t.run('selectAction()');
  t.$('id-id').value='12';t.$('id-id').oninput();
  await t.$('action-form').onsubmit(t.event);
  const call=t.calls.find(c=>c.path==='/users/12');
  assert.equal(call.method,'PATCH');assert.equal(JSON.parse(call.body).active,false);
});
test('report query fields drive GET dates and currency summary', async () => {
  const t=setup();configure(t,'reporting');await t.run('openAdmin()');
  t.$('query-start').value='2026-11-01';t.$('query-start').oninput();
  const reply=t.context.reply;t.context.reply=(u,o)=>u.pathname==='/dashboard'?response({by_currency:{USD:{income:'10.50',expense:'2.00',net:'8.50'}}}):reply(u,o);
  await t.$('action-form').onsubmit(t.event);
  const call=t.calls.find(c=>c.path.startsWith('/dashboard'));
  assert.ok(call.path.includes('start=2026-11-01'));assert.equal(call.body,undefined);
  assert.equal(t.$('result-view').children[0].children[0].children[1].textContent,'10.50 USD');
});
test('external paths and missing IDs never send authenticated requests', async () => {
  const t=setup();configure(t,'identity');await t.run('openAdmin()');
  for(const p of ['//evil.test/steal','/\\evil.test/steal','/users/{id}','/%7Bid%7D']) {
    t.$('path').value=p;const before=t.calls.length;await t.$('action-form').onsubmit(t.event);assert.equal(t.calls.length,before);
  }
  await assert.rejects(()=>t.run("request('https://evil.test/steal')"),/(Đường dẫn API|Chỉ gọi API)/);
});
test('401 expires local session; regular users cannot enter admin', async () => {
  const t=setup();configure(t,'identity');await t.run('openAdmin()');
  t.context.reply=()=>response({detail:'Cần đăng nhập'},401);
  await assert.rejects(()=>t.run("request('/admin/data')"),/Cần đăng nhập/);
  assert.equal(t.run('authenticated'),false);assert.equal(t.$('tables').children.length,0);
  t.context.reply=()=>response({role:'user'});
  await assert.rejects(()=>t.run('openAdmin()'),/admin/);
});
test('a successful mutation stays visible if table reload fails; errors do not claim success', async () => {
  const t=setup();configure(t,'identity');await t.run('openAdmin()');
  t.context.reply=u=>u.pathname==='/admin/data'?response({detail:'DB unavailable'},500):response({id:9});
  await t.$('action-form').onsubmit(t.event);
  assert.equal(t.$('result-state').textContent,'Thành công');assert.match(t.$('status').textContent,/Thao tác đã thành công/);
  t.context.reply=()=>response({detail:'Dữ liệu trùng'},409);
  await t.$('action-form').onsubmit(t.event);
  assert.equal(t.$('result-state').textContent,'Không thành công');assert.equal(t.$('submit').disabled,false);
});
test('current health derives custom service ports without claiming other services are online', async () => {
  const t=setup();t.context.reply=()=>response({service:'ledger',status:'ok'});await t.run('checkService()');
  assert.equal(t.$('current-name').textContent,'Ledger');assert.equal(t.$('nav').children[0].href,'http://127.0.0.1:8090/admin?service=identity#overview');
  assert.equal(t.$('service-cards').children[0].children[0].children[1].textContent,'Đã xây dựng');
  t.context.location.hash='#toString';t.run('showView()');assert.equal(t.$('title').textContent,'Tổng quan services');
});
test('DELETE cancellation and duplicate submit protection', async () => {
  const t=setup();configure(t,'planning');await t.run('openAdmin()');
  t.$('action').value=4;t.run('selectAction()');t.$('id-id').value='3';t.$('id-id').oninput();
  t.context.confirm=()=>false;const before=t.calls.length;await t.$('action-form').onsubmit(t.event);assert.equal(t.calls.length,before);
  t.run('busy=true');await t.$('action-form').onsubmit(t.event);assert.equal(t.calls.length,before);
});
test('logout failure keeps the session available to retry', async () => {
  const t=setup();configure(t,'identity');await t.run('openAdmin()');
  t.context.reply=()=>response({detail:'Identity unavailable'},503);await t.$('logout').onclick();
  assert.equal(t.run('authenticated'),true);assert.match(t.$('status').textContent,/Chưa xác nhận/);
});
