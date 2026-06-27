(function () {
  const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap');
:root{--bg:#0f1117;--card:#1a1d2e;--card2:#242740;--accent:#7c6af7;--accent2:#56cfb2;--text:#e8eaf6;--muted:#9ca3af;--border:#2d3154}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Segoe UI','Noto Sans JP',sans-serif;font-size:15px;line-height:1.7;padding-bottom:60px}
header{background:linear-gradient(135deg,#1a1d2e,#0d0f1a);border-bottom:2px solid var(--accent);padding:16px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:100}
header h1{font-size:1.2rem;color:var(--accent)}
header small{color:var(--muted);font-size:.8rem}
.back-btn{margin-left:auto;background:var(--card2);border:1px solid var(--border);color:var(--text);padding:6px 14px;border-radius:6px;text-decoration:none;font-size:.85rem;white-space:nowrap}
.score-wrap{max-width:860px;margin:14px auto;padding:0 16px}
.score-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 18px;display:flex;align-items:center;gap:14px}
.score-track{flex:1;height:10px;background:var(--card2);border-radius:99px;overflow:hidden}
.score-fill{height:100%;background:var(--accent2);border-radius:99px;transition:width .4s}
.score-num{font-size:1.05rem;font-weight:700;color:var(--accent2);white-space:nowrap}
.score-label{font-size:.78rem;color:var(--muted);white-space:nowrap}
.reset-btn{background:none;border:1px solid var(--border);color:var(--muted);font-size:.76rem;padding:4px 12px;border-radius:6px;cursor:pointer;font-family:inherit}
.reset-btn:hover{border-color:var(--accent);color:var(--accent)}
main{max-width:860px;margin:0 auto;padding:0 16px}
.prob{background:var(--card);border:1px solid var(--border);border-radius:12px;margin-bottom:14px;overflow:hidden;transition:border-color .2s}
.prob.all-ok{border-color:#4caf50}
.prob.has-ng{border-color:#f44336}
.prob-head{background:var(--card2);padding:9px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border)}
.prob-no{font-weight:700;color:var(--accent);min-width:30px;font-size:.9rem}
.badge{font-size:.7rem;padding:2px 8px;border-radius:20px;font-weight:600}
.b1{background:#3b4fd8;color:#fff}.b2{background:#2e7d32;color:#fff}.b3{background:#e65100;color:#fff}.b4{background:#6a1b9a;color:#fff}
.prob-tag{font-size:.8rem;color:var(--muted);margin-left:auto}
.prob-body{padding:14px 16px}
.prob-q{font-size:.93rem;line-height:1.8;margin-bottom:12px}
.prob-q code{font-family:monospace;background:var(--card2);padding:1px 6px;border-radius:3px;font-size:.88em;color:#a5b4fc}
.part{margin-bottom:8px}
.part-label{font-size:.82rem;color:var(--accent2);font-weight:600;margin-bottom:4px}
.input-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.ans-input{background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.95rem;padding:7px 10px;border-radius:7px;width:130px;font-family:monospace;outline:none;transition:border-color .2s}
.ans-input:focus{border-color:var(--accent)}
.unit{color:var(--muted);font-size:.85rem;font-family:monospace;white-space:nowrap}
.chk-btn{background:var(--accent);border:none;color:#fff;padding:7px 14px;border-radius:7px;cursor:pointer;font-size:.82rem;font-weight:600;font-family:inherit;white-space:nowrap}
.chk-btn:hover{opacity:.85}
.part-fb{font-size:.82rem;font-weight:600;margin-top:3px;min-height:18px}
.part-fb.ok{color:#a5d6a7}.part-fb.ng{color:#ef9a9a}
.prob-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.hint-btn{background:none;border:1px solid var(--border);color:var(--muted);padding:6px 14px;border-radius:7px;cursor:pointer;font-size:.8rem;font-family:inherit;transition:.15s}
.hint-btn:hover{border-color:var(--accent2);color:var(--accent2)}
.reveal-btn{background:none;border:1px solid #333;color:#777;padding:6px 14px;border-radius:7px;cursor:pointer;font-size:.8rem;font-family:inherit;transition:.15s}
.reveal-btn:hover{border-color:#666;color:var(--text)}
.hint-box{background:#1a1a2a;border-left:3px solid var(--accent2);padding:9px 14px;border-radius:0 6px 6px 0;font-size:.85rem;color:#a5b4fc;margin-top:10px;display:none;line-height:1.8;white-space:pre-line}
.hint-box.show{display:block}
.ans-box{background:#1a2a1a;border-left:3px solid #4caf50;padding:9px 14px;border-radius:0 6px 6px 0;font-size:.85rem;color:#a5d6a7;margin-top:8px;display:none;line-height:1.85}
.ans-box.show{display:block}
.prob-svg{margin:0 0 10px;overflow-x:auto}
.prob-svg svg{max-width:100%;height:auto;display:block}
`;

  let _data, _probs, _storageKey, _correct = {}, _total = 0;
  const BADGE = { 1: 'b1', 2: 'b2', 3: 'b3', 4: 'b4' };

  function save() {
    const d = {};
    Object.keys(_correct).forEach(k => { if (_correct[k] === true) d[k] = true; });
    localStorage.setItem(_storageKey, JSON.stringify(d));
    if (window.progressSave) progressSave(_storageKey, d);
  }

  function updateScore() {
    const c = Object.values(_correct).filter(v => v).length;
    document.getElementById('score-fill').style.width = (c / _total * 100) + '%';
    document.getElementById('score-num').textContent = c + ' / ' + _total;
  }

  window.checkPart = function (no, idx) {
    const prob = _probs.find(p => p.no === no);
    const part = prob.parts[idx];
    const inp = document.getElementById('inp-' + no + '-' + idx);
    const fb = document.getElementById('fb-' + no + '-' + idx);
    let val = parseFloat(inp.value);
    if (isNaN(val)) { inp.style.borderColor = '#f44336'; return; }
    if (part.mult) val = val * part.mult;

    let ok;
    if (part.isAngle) {
      ok = Math.abs(val - part.ans) <= 2;
    } else {
      ok = Math.abs(val - part.ans) / Math.abs(part.ans) <= 0.02;
    }
    _correct[no + '-' + idx] = ok;
    fb.className = 'part-fb ' + (ok ? 'ok' : 'ng');
    fb.textContent = ok ? '✓ 正解' : '✗ もう一度';
    inp.style.borderColor = ok ? '#4caf50' : '#f44336';
    if (ok && typeof addPoints === 'function') addPoints(_data.pointsPerPart || 300, _storageKey, no + '-' + idx, true, _data.subject);

    const card = document.getElementById('prob-' + no);
    const allOk = prob.parts.every((_, i) => _correct[no + '-' + i] === true);
    const hasNg = prob.parts.some((_, i) => _correct[no + '-' + i] === false);
    card.className = 'prob' + (allOk ? ' all-ok' : hasNg ? ' has-ng' : '');

    updateScore();
    if (ok) save();
  };

  window.toggleHint = function (no) {
    document.getElementById('hint-' + no).classList.toggle('show');
  };

  window.showReveal = function (no) {
    document.getElementById('reveal-' + no).classList.add('show');
  };

  window.resetNekku = function () {
    Object.keys(_correct).forEach(k => delete _correct[k]);
    localStorage.removeItem(_storageKey);
    localStorage.setItem(_storageKey + '_reset', '1');
    if (window.progressSaveNow) progressSaveNow(_storageKey, {});
    _probs.forEach(p => {
      p.parts.forEach((_, i) => {
        const inp = document.getElementById('inp-' + p.no + '-' + i);
        if (inp) { inp.value = ''; inp.style.borderColor = ''; }
        const fb = document.getElementById('fb-' + p.no + '-' + i);
        if (fb) { fb.className = 'part-fb'; fb.textContent = ''; }
      });
      document.getElementById('hint-' + p.no)?.classList.remove('show');
      document.getElementById('reveal-' + p.no)?.classList.remove('show');
      document.getElementById('prob-' + p.no).className = 'prob';
    });
    updateScore();
  };

  function render() {
    document.getElementById('nq-main').innerHTML = _probs.map(p => `
      <div class="prob" id="prob-${p.no}">
        <div class="prob-head">
          <span class="prob-no">問${p.no}</span>
          <span class="badge ${BADGE[p.chN] || 'b1'}">${p.ch}</span>
          <span class="prob-tag">${p.tag}</span>
        </div>
        <div class="prob-body">
          ${p.svg ? `<div class="prob-svg">${p.svg}</div>` : ''}
          <div class="prob-q">${p.q}</div>
          ${p.parts.map((pt, i) => `
            <div class="part">
              ${pt.label ? `<div class="part-label">${pt.label}</div>` : ''}
              <div class="input-row">
                <input class="ans-input" id="inp-${p.no}-${i}" type="number" step="any" placeholder="答え"
                  onkeydown="if(event.key==='Enter')checkPart(${p.no},${i})">
                <span class="unit">${pt.unit}</span>
                <button class="chk-btn" onclick="checkPart(${p.no},${i})">確認</button>
              </div>
              <div class="part-fb" id="fb-${p.no}-${i}"></div>
            </div>
          `).join('')}
          <div class="prob-actions">
            ${p.hint ? `<button class="hint-btn" onclick="toggleHint(${p.no})">💡 ヒント</button>` : ''}
            ${p.reveal ? `<button class="reveal-btn" onclick="showReveal(${p.no})">📖 解答を見る</button>` : ''}
          </div>
          ${p.hint ? `<div class="hint-box" id="hint-${p.no}">${p.hint}</div>` : ''}
          ${p.reveal ? `<div class="ans-box" id="reveal-${p.no}">${p.reveal.map(s => `<div>${s}</div>`).join('')}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  function typeset(el) {
    if (window.renderMathInElement) renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
  }

  function loadScript(src, cb) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = cb || null;
    document.head.appendChild(s);
  }

  window.initNekku = function (data) {
    _data = data;
    _probs = data.problems;
    _storageKey = data.storageKey;
    _total = _probs.reduce((s, p) => s + p.parts.length, 0);

    // restore state
    try {
      const saved = JSON.parse(localStorage.getItem(_storageKey) || '{}');
      Object.keys(saved).forEach(k => { if (saved[k] === true) _correct[k] = true; });
    } catch (e) {}

    // inject CSS + KaTeX CSS
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const katexCss = document.createElement('link');
    katexCss.rel = 'stylesheet';
    katexCss.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
    katexCss.crossOrigin = 'anonymous';
    document.head.appendChild(katexCss);

    document.title = data.title;

    document.body.innerHTML = `
      <header>
        <div>
          <h1>📝 ${data.title}</h1>
          ${data.subtitle ? `<small>${data.subtitle}</small>` : ''}
        </div>
        <a class="back-btn" href="javascript:history.back()">← 戻る</a>
      </header>
      <div class="score-wrap">
        <div class="score-card">
          <span class="score-label">正解</span>
          <div class="score-track"><div class="score-fill" id="score-fill" style="width:0%"></div></div>
          <span class="score-num" id="score-num">0 / ${_total}</span>
          <button class="reset-btn" onclick="resetNekku()">リセット</button>
        </div>
      </div>
      <main id="nq-main"></main>
    `;

    render();
    updateScore();

    // restore UI state for already-correct answers
    _probs.forEach(p => {
      p.parts.forEach((pt, i) => {
        if (_correct[p.no + '-' + i] === true) {
          const inp = document.getElementById('inp-' + p.no + '-' + i);
          const fb = document.getElementById('fb-' + p.no + '-' + i);
          if (fb) { fb.className = 'part-fb ok'; fb.textContent = '✓ 正解'; }
          if (inp) inp.style.borderColor = '#4caf50';
        }
      });
      const card = document.getElementById('prob-' + p.no);
      if (card) {
        const allOk = p.parts.every((_, i) => _correct[p.no + '-' + i] === true);
        if (allOk && p.parts.length > 0) card.className = 'prob all-ok';
      }
    });

    // set up _quizSync before progress.js loads
    window._quizSync = async function () {
      const d = {};
      Object.keys(_correct).forEach(k => { if (_correct[k] === true) d[k] = true; });
      return d;
    };
    window.QUIZ_SUBJECT = data.subject;

    // load supabase → points.js → progress.js → katex
    loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', function () {
      loadScript('/js/points.js', function () {
        loadScript('/js/progress.js', function () {
          const main = document.getElementById('nq-main');
          if (main) {
            loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js', function () {
              loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js', function () {
                typeset(main);
              });
            });
          }
        });
      });
    });

    // progress restore
    (async function () {
      if (!window.progressLoad) return;
      if (localStorage.getItem(_storageKey + '_reset')) {
        localStorage.removeItem(_storageKey + '_reset');
        return;
      }
      const remote = await progressLoad(_storageKey);
      if (!remote) return;
      Object.keys(remote).forEach(k => { if (remote[k] === true) _correct[k] = true; });
      localStorage.setItem(_storageKey, JSON.stringify(_correct));
    })();
  };
})();
