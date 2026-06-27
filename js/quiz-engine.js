// Shared quiz renderer. Called via window.initQuiz(data) from quiz.html.
// data.json schema:
//   title, subtitle?, eyebrow, description, subject, storageKey,
//   pointsPerQ?(=100), katex?(=false), tip?, footer?,
//   sections: [{ id, no, title, qs: [question] }]
// question types: single | multi | sort | input
(function () {

const CSS = `
:root{--bg:#0a1626;--bg2:#0e1d33;--card:#15263f;--card2:#1b2f4d;--line:#27406a;--ink:#e7eef7;--muted:#8aa1c0;--dim:#5f7c9c;--teal:#46d6c4;--teal-d:#1f9e90;--amber:#f6b352;--rose:#f06b8e;--good:#5fe0a8;--bad:#f06b8e}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:"Outfit","Noto Sans JP",sans-serif;background:radial-gradient(1100px 600px at 80% -8%,rgba(70,214,196,.10),transparent 55%),radial-gradient(900px 500px at 5% 5%,rgba(246,179,82,.07),transparent 50%),var(--bg);color:var(--ink);line-height:1.6;padding-bottom:80px}
.wrap{max-width:880px;margin:0 auto;padding:0 18px}
header{padding:46px 0 30px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--bg2),transparent)}
.eyebrow{font-size:.72rem;letter-spacing:.34em;text-transform:uppercase;color:var(--teal);font-weight:600;margin-bottom:10px}
h1{font-family:"Fraunces",serif;font-weight:600;font-size:clamp(2rem,6vw,3rem);line-height:1.04}
.sub{color:var(--muted);margin-top:12px;font-size:1rem;max-width:600px}
.scoreboard{position:sticky;top:0;z-index:50;background:rgba(10,22,38,.82);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.scoreboard .wrap{display:flex;align-items:center;gap:14px;padding:11px 18px;flex-wrap:wrap}
.scorenum{font-family:"JetBrains Mono",monospace;font-size:1.05rem;color:var(--teal);font-weight:500}
.scorelbl{color:var(--muted);font-size:.85rem}
.bar{flex:1;min-width:120px;height:7px;background:var(--card2);border-radius:99px;overflow:hidden}
.bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--teal-d),var(--teal));border-radius:99px;transition:width .5s ease}
.resetbtn{font-family:inherit;font-size:.78rem;color:var(--muted);background:none;border:1px solid var(--line);border-radius:8px;padding:5px 11px;cursor:pointer;transition:.2s}
.resetbtn:hover{color:var(--ink);border-color:var(--teal-d)}
nav.toc{display:flex;gap:8px;flex-wrap:wrap;padding:22px 0 6px}
nav.toc a{font-size:.82rem;color:var(--muted);text-decoration:none;padding:7px 13px;border:1px solid var(--line);border-radius:99px;background:var(--card);transition:.2s;white-space:nowrap}
nav.toc a:hover{color:var(--ink);border-color:var(--teal-d);transform:translateY(-1px)}
section{margin-top:44px;scroll-margin-top:64px}
.sec-head{display:flex;align-items:baseline;gap:14px;margin-bottom:6px}
.sec-no{font-family:"JetBrains Mono",monospace;font-size:.9rem;color:var(--teal);letter-spacing:.05em}
.sec-head h2{font-family:"Fraunces",serif;font-weight:600;font-size:1.5rem}
.sec-score{margin-left:auto;font-family:"JetBrains Mono",monospace;font-size:.82rem;color:var(--muted);white-space:nowrap;align-self:center}
.q{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:18px 18px 16px;margin-bottom:14px;transition:border-color .25s}
.q.correct{border-color:var(--teal-d)}
.q.wrong{border-color:var(--rose)}
.q-top{display:flex;gap:12px;align-items:flex-start}
.qn{font-family:"JetBrains Mono",monospace;font-size:.78rem;color:var(--teal);background:rgba(70,214,196,.1);border:1px solid var(--line);border-radius:7px;padding:3px 8px;flex-shrink:0;margin-top:2px;min-width:34px;text-align:center}
.q-body{flex:1}
.prompt{font-size:1.02rem;margin-bottom:4px}
.opts{display:flex;flex-wrap:wrap;gap:8px;margin-top:11px}
.opt{font-family:inherit;font-size:.95rem;color:var(--ink);background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:9px 14px;cursor:pointer;transition:.16s;text-align:left}
.opt:hover:not(:disabled){border-color:var(--teal-d);transform:translateY(-1px)}
.opt:disabled{cursor:default}
.opt.pick-correct{background:rgba(95,224,168,.16);border-color:var(--good);color:#cdfbe5}
.opt.pick-wrong{background:rgba(240,107,142,.14);border-color:var(--bad);color:#ffd6e1}
.opt.reveal{border-color:var(--good);color:#cdfbe5}
.opt .lab{font-family:"JetBrains Mono",monospace;color:var(--teal);margin-right:7px;font-size:.85rem}
.opt.multi-selected{background:rgba(70,214,196,.18);border-color:var(--teal-d)}
.multi-submit{margin-top:8px}
.sort-bank{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;padding:10px;background:var(--bg2);border:1px dashed var(--line);border-radius:10px;min-height:40px}
.sort-item{font-family:inherit;font-size:.88rem;color:var(--ink);background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:7px 12px;cursor:pointer;transition:.16s}
.sort-item:hover{border-color:var(--teal-d)}
.sort-answer{display:flex;flex-direction:column;gap:4px;margin-top:8px}
.sort-answer .slot{font-size:.85rem;padding:6px 10px;background:var(--bg2);border:1px dashed var(--line);border-radius:8px;color:var(--muted);min-height:34px;cursor:pointer}
.sort-answer .slot.filled{color:var(--ink);border-color:var(--teal-d);background:rgba(70,214,196,.08)}
.inrow{display:flex;gap:8px;margin-top:11px;flex-wrap:wrap}
.inrow input{flex:1;min-width:180px;font-family:inherit;font-size:.98rem;color:var(--ink);background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:10px 13px;outline:none;transition:.2s}
.inrow input:focus{border-color:var(--teal-d)}
.inrow input.ok{border-color:var(--good);background:rgba(95,224,168,.08)}
.inrow input.ng{border-color:var(--bad);background:rgba(240,107,142,.07)}
.btn{font-family:inherit;font-size:.9rem;font-weight:500;color:var(--bg);background:var(--teal);border:none;border-radius:10px;padding:10px 16px;cursor:pointer;transition:.2s}
.btn:hover{background:#5fe6d6}
.btn.ghost{background:none;color:var(--muted);border:1px solid var(--line)}
.btn.ghost:hover{color:var(--ink);border-color:var(--teal-d)}
.fb{margin-top:10px;font-size:.9rem;display:none}
.fb.show{display:block}
.fb .verdict{font-weight:600}
.fb .verdict.g{color:var(--good)}
.fb .verdict.b{color:var(--bad)}
.note{color:var(--muted);margin-top:4px;font-size:.88rem}
.tip{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--amber);border-radius:10px;padding:12px 15px;margin-bottom:18px;font-size:.9rem;color:var(--muted)}
.tip b{color:var(--amber)}
footer{margin-top:60px;padding-top:24px;border-top:1px solid var(--line);color:var(--dim);font-size:.82rem;text-align:center}
@media(max-width:560px){.q-top{flex-direction:column;gap:7px}}
`;

// Module-level state
let _data, _sections, _storageKey, _state = {};

function getQ(secId, key) {
  const sec = _sections.find(s => s.id === secId);
  if (!sec) return null;
  const qi = parseInt(key.slice(secId.length + 1));
  return sec.qs[qi];
}

function norm(s) {
  return String(s).replace(/[　\s]/g, '').toLowerCase().replace(/[，,。．.、]/g, '');
}
function matchInput(val, ans) {
  const n = norm(val);
  const list = Array.isArray(ans) ? ans : [ans];
  return list.some(a => { const na = norm(a); return na === n || n.includes(na) || na.includes(n); });
}
function labelChar(i) { return String.fromCharCode(65 + i) + '.'; }

function save() {
  localStorage.setItem(_storageKey, JSON.stringify(_state));
  if (window.progressSave) progressSave(_storageKey, _state);
}

function computeScore() {
  let done = 0, total = 0;
  _sections.forEach(sec => sec.qs.forEach((_, qi) => {
    total++;
    if (_state[`${sec.id}_${qi}`] === 1) done++;
  }));
  return { done, total };
}

function updateScore() {
  const { done, total } = computeScore();
  document.getElementById('sNum').textContent = `${done} / ${total}`;
  document.getElementById('sBar').style.width = total ? `${done / total * 100}%` : '0%';
}

window.resetAll = function () {
  if (!confirm('進捗をリセットしますか？')) return;
  _state = {};
  localStorage.setItem(_storageKey, '{}');
  localStorage.setItem(_storageKey + '_reset', '1');
  if (window.progressSaveNow) progressSaveNow(_storageKey, {});
  location.reload();
};

function typeset(el) {
  if (window.renderMathInElement) {
    try {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    } catch (e) {}
  }
}

function renderAll() {
  const app = document.getElementById('app');
  const toc = document.getElementById('toc');
  toc.innerHTML = ''; app.innerHTML = '';

  _sections.forEach(sec => {
    const a = document.createElement('a');
    a.href = `#${sec.id}`; a.textContent = `${sec.no} ${sec.title}`;
    toc.appendChild(a);

    const el = document.createElement('section');
    el.id = sec.id;
    let secDone = 0;
    sec.qs.forEach((_, qi) => { if (_state[`${sec.id}_${qi}`] === 1) secDone++; });
    el.innerHTML = `<div class="sec-head"><span class="sec-no">${sec.no}</span><h2>${sec.title}</h2><span class="sec-score" id="ss_${sec.id}">${secDone}/${sec.qs.length}</span></div>`;
    sec.qs.forEach((q, qi) => el.appendChild(buildQuestion(q, qi, `${sec.id}_${qi}`, sec.id)));
    app.appendChild(el);
  });

  updateScore();
  typeset(app);
}

function buildQuestion(q, qi, key, secId) {
  const div = document.createElement('div');
  div.className = 'q' + (_state[key] === 1 ? ' correct' : _state[key] === -1 ? ' wrong' : '');
  div.id = `q_${key}`;

  let inner = `<div class="q-top"><span class="qn">Q${qi + 1}</span><div class="q-body"><div class="prompt">${q.q}</div>`;

  if (q.type === 'single') {
    inner += `<div class="opts">`;
    q.opts.forEach((o, oi) => {
      let cls = 'opt';
      if (_state[key] !== undefined) {
        if (o === q.ans) cls += ' reveal';
        if (_state[key + '_pick'] === o && o !== q.ans) cls += ' pick-wrong';
        if (_state[key + '_pick'] === o && o === q.ans) cls += ' pick-correct';
      }
      const dis = _state[key] !== undefined ? 'disabled' : '';
      inner += `<button class="${cls}" ${dis} onclick="pickSingle('${key}','${secId}',${oi})"><span class="lab">${labelChar(oi)}</span>${o}</button>`;
    });
    inner += `</div>`;

  } else if (q.type === 'multi') {
    inner += `<div class="opts">`;
    q.opts.forEach((o, oi) => {
      let cls = 'opt';
      const sel = _state[key + '_sel'] && _state[key + '_sel'].includes(o);
      if (sel) cls += ' multi-selected';
      if (_state[key] !== undefined) {
        if (q.ans.includes(o)) cls += ' reveal';
        if (sel && !q.ans.includes(o)) cls += ' pick-wrong';
        if (sel && q.ans.includes(o)) cls += ' pick-correct';
      }
      const dis = _state[key] !== undefined ? 'disabled' : '';
      inner += `<button class="${cls}" ${dis} onclick="toggleMulti('${key}','${secId}',${oi})"><span class="lab">${labelChar(oi)}</span>${o}</button>`;
    });
    inner += `</div>`;
    if (_state[key] === undefined) {
      inner += `<div class="multi-submit"><button class="btn" onclick="submitMulti('${key}','${secId}')">採点</button></div>`;
    }

  } else if (q.type === 'sort') {
    const placed = _state[key + '_placed'] || [];
    inner += `<div class="sort-bank">`;
    q.items.forEach((item, ii) => {
      if (placed.includes(item)) return;
      inner += `<button class="sort-item" onclick="placeSortItem('${key}','${secId}',${ii})">${item}</button>`;
    });
    inner += `</div><div class="sort-answer">`;
    q.items.forEach((_, ii) => {
      const f = placed[ii] || '';
      inner += `<div class="slot${f ? ' filled' : ''}" onclick="removeSortItem('${key}','${secId}',${ii})">${ii + 1}. ${f || 'ここをタップして削除'}</div>`;
    });
    inner += `</div>`;
    if (placed.length === q.items.length && _state[key] === undefined) {
      inner += `<div class="multi-submit"><button class="btn" onclick="submitSort('${key}','${secId}')">採点</button></div>`;
    }

  } else if (q.type === 'input') {
    const val = _state[key + '_val'] || '';
    const inputCls = _state[key] === 1 ? 'ok' : _state[key] === -1 ? 'ng' : '';
    const dis = _state[key] !== undefined ? 'disabled' : '';
    inner += `<div class="inrow">
      <input id="inp_${key}" type="text" value="${val.replace(/"/g, '&quot;')}" ${dis} class="${inputCls}" placeholder="答えを入力"
        onkeydown="if(event.key==='Enter')submitInput('${key}','${secId}')">
      ${_state[key] === undefined ? `<button class="btn" onclick="submitInput('${key}','${secId}')">採点</button>` : ''}
      ${_state[key] !== undefined && _state[key] !== 1 ? `<button class="btn ghost" onclick="revealInput('${key}','${secId}')">答えを見る</button>` : ''}
    </div>`;
    if (q.hint && _state[key] === undefined) {
      inner += `<div class="note" style="margin-top:6px">💡 ヒント: ${q.hint}</div>`;
    }
  }

  const fbShow = _state[key] !== undefined ? 'show' : '';
  const ok = _state[key] === 1;
  inner += `<div class="fb ${fbShow}"><span class="verdict ${ok ? 'g' : 'b'}">${ok ? '✓ 正解' : '✗ 不正解'}</span>${q.note ? `<div class="note">${q.note}</div>` : ''}</div>`;
  inner += `</div></div>`;
  div.innerHTML = inner;
  return div;
}

function refreshQ(key, secId) {
  const sec = _sections.find(s => s.id === secId);
  if (!sec) return;
  const qi = parseInt(key.slice(secId.length + 1));
  const old = document.getElementById('q_' + key);
  if (!old) return;
  const newCard = buildQuestion(sec.qs[qi], qi, key, secId);
  old.replaceWith(newCard);
  typeset(newCard);
  let done = 0;
  sec.qs.forEach((_, i) => { if (_state[`${secId}_${i}`] === 1) done++; });
  const ss = document.getElementById('ss_' + secId);
  if (ss) ss.textContent = `${done}/${sec.qs.length}`;
  updateScore();
}

function award(key) {
  if (window.addPoints) addPoints(_data.pointsPerQ || 100, _storageKey, key, true, _data.subject);
}

window.pickSingle = function (key, secId, oi) {
  const q = getQ(secId, key); if (!q || _state[key] !== undefined) return;
  const chosen = q.opts[oi];
  if (chosen === q.ans) award(key);
  _state[key] = chosen === q.ans ? 1 : -1;
  _state[key + '_pick'] = chosen;
  save(); refreshQ(key, secId);
};

window.toggleMulti = function (key, secId, oi) {
  const q = getQ(secId, key); if (!q || _state[key] !== undefined) return;
  const opt = q.opts[oi];
  if (!_state[key + '_sel']) _state[key + '_sel'] = [];
  const idx = _state[key + '_sel'].indexOf(opt);
  if (idx > -1) _state[key + '_sel'].splice(idx, 1);
  else _state[key + '_sel'].push(opt);
  save(); refreshQ(key, secId);
};

window.submitMulti = function (key, secId) {
  const q = getQ(secId, key); if (!q || _state[key] !== undefined) return;
  const sel = _state[key + '_sel'] || [];
  const correct = sel.length === q.ans.length && q.ans.every(a => sel.includes(a));
  if (correct) award(key);
  _state[key] = correct ? 1 : -1;
  save(); refreshQ(key, secId);
};

window.placeSortItem = function (key, secId, ii) {
  const q = getQ(secId, key); if (!q || _state[key] !== undefined) return;
  const item = q.items[ii];
  if (!_state[key + '_placed']) _state[key + '_placed'] = [];
  if (_state[key + '_placed'].includes(item)) return;
  _state[key + '_placed'].push(item);
  save(); refreshQ(key, secId);
};

window.removeSortItem = function (key, secId, idx) {
  if (_state[key] !== undefined || !_state[key + '_placed']) return;
  _state[key + '_placed'].splice(idx, 1);
  save(); refreshQ(key, secId);
};

window.submitSort = function (key, secId) {
  const q = getQ(secId, key); if (!q || _state[key] !== undefined) return;
  const placed = _state[key + '_placed'] || [];
  const correct = q.ans.every((a, i) => placed[i] === a);
  if (correct) award(key);
  _state[key] = correct ? 1 : -1;
  save(); refreshQ(key, secId);
};

window.submitInput = function (key, secId) {
  const q = getQ(secId, key); if (!q || _state[key] !== undefined) return;
  const val = (document.getElementById('inp_' + key) || {}).value || '';
  _state[key + '_val'] = val.trim();
  const correct = matchInput(val, q.ans);
  if (correct) award(key);
  _state[key] = correct ? 1 : -1;
  save(); refreshQ(key, secId);
};

window.revealInput = function (key, secId) {
  const q = getQ(secId, key); if (!q) return;
  _state[key + '_val'] = Array.isArray(q.ans) ? q.ans[0] : q.ans;
  _state[key] = -1;
  save(); refreshQ(key, secId);
};

function addScript(src, onload) {
  const s = document.createElement('script');
  s.src = src;
  if (onload) s.onload = onload;
  document.body.appendChild(s);
}

window.initQuiz = function (data) {
  _data = data;
  _sections = data.sections;
  _storageKey = data.storageKey;

  // Inject fonts + CSS
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&family=JetBrains+Mono:wght@500&display=swap';
  document.head.appendChild(fontLink);

  if (data.katex) {
    const kl = document.createElement('link');
    kl.rel = 'stylesheet';
    kl.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
    document.head.appendChild(kl);
  }

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // Build DOM
  document.title = data.title;
  document.body.innerHTML = `
    <div class="scoreboard"><div class="wrap">
      <span class="scorenum" id="sNum">0 / 0</span>
      <span class="scorelbl">正解</span>
      <div class="bar"><i id="sBar"></i></div>
      <button class="resetbtn" onclick="resetAll()">リセット</button>
    </div></div>
    <header><div class="wrap">
      <div class="eyebrow">${data.eyebrow || ''}</div>
      <h1>${data.title}${data.subtitle ? `<br><span style="font-size:.55em;color:var(--teal)">${data.subtitle}</span>` : ''}</h1>
      <p class="sub">${data.description || ''}</p>
    </div></header>
    <div class="wrap">
      <nav class="toc" id="toc"></nav>
      ${data.tip ? `<div class="tip" style="margin-top:18px"><b>使い方：</b>${data.tip}</div>` : ''}
      <div id="app"></div>
      ${data.footer ? `<footer>${data.footer}</footer>` : ''}
    </div>
    <a href="/" style="position:fixed;bottom:20px;left:16px;background:rgba(10,22,38,.9);border:1px solid #27406a;color:#8aa1c0;text-decoration:none;padding:8px 14px;border-radius:99px;font-size:.82rem;z-index:200;backdrop-filter:blur(4px)">← トップへ</a>
  `;

  // Load state
  try { _state = JSON.parse(localStorage.getItem(_storageKey) || '{}'); } catch (e) { _state = {}; }

  renderAll();

  // Set up progress sync before progress.js loads
  window._quizSync = async function () {
    if (localStorage.getItem(_storageKey + '_reset')) {
      localStorage.removeItem(_storageKey + '_reset');
      return;
    }
    const s = await progressLoad(_storageKey);
    if (!s || !Object.keys(s).length) return;
    let chg = false;
    for (const k in s) { if (s[k] && !_state[k]) { _state[k] = s[k]; chg = true; } }
    if (chg) { save(); renderAll(); }
  };

  window.QUIZ_SUBJECT = data.subject;

  // Load external deps: supabase → points.js → progress.js
  addScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', function () {
    addScript('/js/points.js', function () {
      addScript('/js/progress.js');
    });
  });

  // Load KaTeX after render (re-typeset when ready)
  if (data.katex) {
    addScript('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js', function () {
      addScript('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js', function () {
        typeset(document.getElementById('app'));
      });
    });
  }
};

})();
