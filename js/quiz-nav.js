// 模試ページ（quiz.html / quiz-engine.js）専用のナビゲーションドロワー。
// quiz-engine.js の initQuiz から window.quizNav.mount(data) で呼ばれる。
// 依存: window.APP_NAV（js/nav.js）。js/util.js には依存しない（esc を内蔵）。
// フル app-shell は使わない。見た目は styles/theme.css の .appshell-drawer 系を流用。
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 現在ページの ?d= の値（例: tests/2026-xxx/data.json）
  function currentD() {
    return new URLSearchParams(location.search).get('d') || '';
  }

  // 前提: /api/tests の path は d= が唯一かつ未エンコードのクエリ（server が /quiz.html?d=tests/<dir>/data.json を発行）。
  // /api/tests のエントリ path（/quiz.html?d=tests/xxx/data.json）から d= を取り出す
  function entryD(path) {
    var m = /[?&]d=([^&]+)/.exec(path || '');
    return m ? decodeURIComponent(m[1]) : '';
  }

  var drawer, backdrop, burger, onKeyRef, _prevFocus;

  function openDrawer() {
    if (drawer.classList.contains('open')) return;
    drawer.classList.add('open');
    backdrop.classList.add('open');
    drawer.inert = false;
    drawer.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    _prevFocus = document.activeElement;
    var firstFocusable = drawer.querySelector('a, [aria-current="page"], button');
    if (firstFocusable) firstFocusable.focus();
    onKeyRef = function (e) { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKeyRef);
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    if (onKeyRef) { document.removeEventListener('keydown', onKeyRef); onKeyRef = null; }
    drawer.inert = true;
    if (_prevFocus && typeof _prevFocus.focus === 'function') _prevFocus.focus();
    _prevFocus = null;
  }

  function toggleDrawer() {
    if (drawer.classList.contains('open')) closeDrawer(); else openDrawer();
  }

  function groupHtml(label, itemsHtml) {
    return '<div class="appshell-drawer-group">' + esc(label) + '</div>' + itemsHtml;
  }

  // グループ3: APP_NAV の分離ページ（adminOnly は除外）
  function menuHtml() {
    var nav = window.APP_NAV || [];
    var items = nav.filter(function (it) { return !it.adminOnly; }).map(function (it) {
      return '<a href="' + esc(it.href) + '">' +
        '<span class="appshell-drawer-ico">' + esc(it.icon || '') + '</span>' +
        esc(it.label || '') + '</a>';
    }).join('');
    return items ? groupHtml('メニュー', items) : '';
  }

  // グループ1+2: 同じ試験（year/grade/exam 完全一致）の模試
  function siblingsHtml(tests, data) {
    if (!data || data.year == null || data.grade == null || data.exam == null) return '';
    if (!Array.isArray(tests)) return '';

    var cd = currentD();
    var same = tests.filter(function (t) {
      return t.year === data.year && t.grade === data.grade && t.exam === data.exam;
    });
    var sameSubject = same.filter(function (t) { return t.subject === data.subject; });
    var otherSubject = same.filter(function (t) { return t.subject !== data.subject; });

    var html = '';

    // グループ1: 同じ試験・同じ科目。現在の模試はリンクにせず「（表示中）」。
    var g1 = sameSubject.map(function (t) {
      var label = t.title || t.subject || '';
      if (entryD(t.path) === cd) {
        return '<span aria-current="page" tabindex="-1">' + esc(label) + '（表示中）</span>';
      }
      return '<a href="' + esc(t.path) + '">' + esc(label) + '</a>';
    }).join('');
    if (g1) html += groupHtml('同じ試験・' + (data.subject || ''), g1);

    // グループ2: 同じ試験・他の科目
    if (otherSubject.length) {
      var g2 = otherSubject.map(function (t) {
        var label = (t.subject || '') + ' — ' + (t.title || t.subject || '');
        return '<a href="' + esc(t.path) + '">' + esc(label) + '</a>';
      }).join('');
      html += groupHtml('同じ試験・他の科目', g2);
    }

    return html;
  }

  function render(tests, data) {
    drawer.innerHTML = siblingsHtml(tests, data) + menuHtml();
    var links = drawer.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', closeDrawer);
    }
  }

  function mount(data) {
    var bar = document.querySelector('.scoreboard .wrap');
    if (!bar || document.querySelector('.appshell-drawer')) return; // 採点バー未描画 / 二重 mount 防止

    burger = document.createElement('button');
    burger.className = 'appshell-hamburger';
    burger.type = 'button';
    burger.setAttribute('aria-label', 'メニュー');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-controls', 'quiz-nav-drawer');
    burger.textContent = '☰';
    burger.addEventListener('click', toggleDrawer);
    bar.appendChild(burger);

    backdrop = document.createElement('div');
    backdrop.className = 'appshell-backdrop';
    backdrop.addEventListener('click', closeDrawer);
    document.body.appendChild(backdrop);

    drawer = document.createElement('nav');
    drawer.className = 'appshell-drawer';
    drawer.id = 'quiz-nav-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(drawer);
    drawer.inert = true;

    // まずメニューだけで描画 → /api/tests が返ったら3グループに差し替え
    render(null, data);
    fetch('/api/tests')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (tests) { render(tests, data); })
      .catch(function () { /* メニューのみのまま。移動手段は確保される */ });
  }

  window.quizNav = { mount: mount };
})();
