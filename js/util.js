// 全ページ共通の小ヘルパ。<script src="/js/util.js"> で読む。
// index.html からの切り出し（フェーズ3 バッチ2）。定義は index.html:1709-1749 / 1827-1833 と同一。
(function () {
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function tu(s){ const str = s ? String(s) : ''; return str.length > 10 ? str.slice(0,10)+'…' : str; }
  function titleBadge(u){
    const cls = u.title_class || '';
    const syms = {
      'title-tanaka':'✦','title-hiroto':'❄','title-hasegawa':'♡',
      'title-pro':'♟','title-arashi':'⚠','title-eye':'☠',
      'title-hatano':'☣','title-honari':'…','title-mitts':'»',
      'title-kawakami':'〜','title-yoshi':'☁','title-shimesaba':'🌾',
      'title-ya':'⛔','title-masami':'♛'
    };
    const sym = syms[cls] || '◆';
    const rotateCls = new Set(['title-masami','title-pro']);
    let inner;
    if (cls === 'title-mitts') {
      inner = `<span class="ti-scroll">${sym} ${esc(u.title)}</span>`;
    } else if (rotateCls.has(cls) && u.title && u.title.includes('/')) {
      const parts = u.title.split('/');
      const items = parts.map((p, i) =>
        `<span class="ti-rotate-item${i===0?' active':''}">${esc(p.trim())}</span>`
      ).join('');
      const rotateMod = cls === 'title-pro' ? ' ti-instant' : '';
      inner = `${sym} <span class="ti-rotate${rotateMod}">${items}</span>`;
    } else {
      inner = `${sym} ${esc(u.title)}`;
    }
    return `<span class="shogou${cls?' '+cls:''}">${inner}</span>`;
  }

  function _rotateTick(sel) {
    document.querySelectorAll(sel).forEach(el => {
      const items = el.querySelectorAll('.ti-rotate-item');
      if (!items.length) return;
      let cur = 0;
      items.forEach((it, i) => { if (it.classList.contains('active')) cur = i; });
      items.forEach(it => it.classList.remove('active'));
      items[(cur + 1) % items.length].classList.add('active');
    });
  }
  setInterval(() => _rotateTick('.ti-rotate:not(.ti-instant)'), 3000);
  setInterval(() => _rotateTick('.ti-instant'), 2250);

  function showPointToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#46d6c4;color:#0a1626;font-weight:700;padding:10px 20px;border-radius:99px;font-size:1rem;z-index:9999;pointer-events:none;transition:opacity .4s';
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 2500);
  }

  window.esc = esc;
  window.tu = tu;
  window.titleBadge = titleBadge;
  window._rotateTick = _rotateTick;
  window.showPointToast = showPointToast;
})();
