// 武藤模試 共通シェル（ヘッダーバー＋ハンバーガードロワー）
// ダムなビュー。認証状態は各ページ側が保持し update() で流し込む。fetch はしない。
//
// 使い方:
//   appShell.mount(document.getElementById('app-shell-bar'), {
//     nav: [{ key, icon, label, href?, onClick?, id?, adminOnly? }],
//     onGoogleLogin, onIdLogin, onLogout, onNotif, onAvatar   // すべて既存関数を渡す
//   });
//   appShell.update({ loggedIn, name, points, avatar, frame, isAdmin });
//
// nav 項目の描画規則:
//   - href があり onClick が無ければ <a href>（通常遷移）
//   - それ以外は <button>（クリックで onClick を呼び、ドロワーを閉じる）
//   - key !== 'home' && key !== 'race' の項目は [data-auth] 付き（未ログイン時に隠す）
//   - adminOnly の項目は [data-admin] 付き（管理者以外は隠す）
(function () {
  var opts = null;
  var els = {};
  var drawer = null, backdrop = null;

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class')      el.className = attrs[k];
      else if (k === 'text')  el.textContent = attrs[k];
      else if (k === 'html')  el.innerHTML = attrs[k];
      else                    el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function buildBar(host) {
    host.className = 'appshell-bar';
    host.innerHTML = '';

    var brand  = h('a',   { 'class': 'appshell-brand', href: '/', text: '武藤模試' });
    var spacer = h('span', { 'class': 'appshell-spacer' });

    var idBtn = h('button', { 'class': 'appshell-btn', type: 'button', text: 'IDでログイン' });
    idBtn.addEventListener('click', function () { opts.onIdLogin && opts.onIdLogin(); });

    var googleBtn = h('button', { 'class': 'appshell-btn primary', type: 'button', text: 'Googleでログイン' });
    googleBtn.addEventListener('click', function () { opts.onGoogleLogin && opts.onGoogleLogin(); });

    var notifBtn = h('button', { 'class': 'notif-btn appshell-icon', type: 'button', title: 'お知らせ' });
    notifBtn.innerHTML = '🔔<span class="notif-badge" id="notif-badge">2</span>';
    notifBtn.addEventListener('click', function () { opts.onNotif && opts.onNotif(); });

    var avatar = h('div', { 'class': 'avatar', id: 'auth-avatar', title: 'アイコン変更', text: '🐸' });
    avatar.addEventListener('click', function () { opts.onAvatar && opts.onAvatar(); });
    var nameB   = h('b',    { 'data-role': 'name' });
    var pointsS = h('span', { 'data-role': 'points' });
    var nameWrap = h('span', { 'class': 'appshell-name' }, [avatar, nameB, pointsS]);

    var burger = h('button', {
      'class': 'appshell-hamburger', type: 'button',
      'aria-label': 'メニュー', 'aria-expanded': 'false', text: '☰'
    });
    burger.addEventListener('click', toggleDrawer);

    [brand, spacer, idBtn, googleBtn, notifBtn, nameWrap, burger].forEach(function (n) { host.appendChild(n); });

    els = {
      idBtn: idBtn, googleBtn: googleBtn, notifBtn: notifBtn,
      nameWrap: nameWrap, avatar: avatar, nameB: nameB, pointsS: pointsS, burger: burger
    };
  }

  function buildDrawer() {
    backdrop = h('div', { 'class': 'appshell-backdrop' });
    backdrop.addEventListener('click', closeDrawer);

    drawer = h('nav', { 'class': 'appshell-drawer', 'aria-hidden': 'true' });

    var head = h('div', { 'class': 'appshell-drawer-head', 'data-role': 'drawer-head' });
    drawer.appendChild(head);
    els.drawerHead = head;

    (opts.nav || []).forEach(function (item) {
      var inner = [
        h('span', { 'class': 'appshell-drawer-ico', text: item.icon || '' }),
        item.label || ''
      ];
      var node;
      if (item.href && !item.onClick) {
        node = h('a', { href: item.href }, inner);
        node.addEventListener('click', function () { closeDrawer(); });
      } else {
        node = h('button', { type: 'button' }, inner);
        node.addEventListener('click', function () {
          closeDrawer();
          if (item.onClick) item.onClick();
        });
      }
      if (item.id) node.id = item.id;
      if (item.adminOnly) node.setAttribute('data-admin', '1');
      if (item.key !== 'home' && item.key !== 'race') node.setAttribute('data-auth', '1');
      drawer.appendChild(node);
    });

    var logout = h('button', {
      'class': 'appshell-drawer-logout', type: 'button', 'data-role': 'logout', text: 'ログアウト'
    });
    logout.addEventListener('click', function () {
      closeDrawer();
      if (opts.onLogout) opts.onLogout();
    });
    drawer.appendChild(logout);
    els.logout = logout;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
  }

  function openDrawer() {
    drawer.classList.add('open');
    backdrop.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    els.burger.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKey);
    var first = drawer.querySelector('a:not([hidden]),button:not([hidden])');
    if (first) first.focus();
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    els.burger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey);
  }
  function toggleDrawer() {
    if (drawer.classList.contains('open')) closeDrawer(); else openDrawer();
  }
  function onKey(e) { if (e.key === 'Escape') closeDrawer(); }

  window.appShell = {
    mount: function (host, options) {
      if (!host) { console.warn('[app-shell] mount: host element not found'); return; }
      opts = options || {};
      buildBar(host);
      buildDrawer();
      this.update({ loggedIn: false });
    },
    update: function (state) {
      state = state || {};
      var on = !!state.loggedIn;
      var ptsStr = (state.points != null ? Number(state.points).toLocaleString() : '0') + 'pt';

      els.idBtn.hidden     = on;
      els.googleBtn.hidden = on;
      els.notifBtn.hidden  = !on;
      els.nameWrap.hidden  = !on;
      els.logout.hidden    = !on;
      els.drawerHead.hidden = !on;

      els.nameB.textContent   = state.name || '';
      els.pointsS.textContent = ptsStr;
      if (state.avatar) els.avatar.textContent = state.avatar;
      els.avatar.className = 'avatar frame-' + (state.frame || 'default');
      els.drawerHead.textContent =
        (state.avatar || '🐸') + ' ' + (state.name || '') + ' ・ ' + ptsStr;

      drawer.querySelectorAll('[data-auth]').forEach(function (n) { n.hidden = !on; });
      drawer.querySelectorAll('[data-admin]').forEach(function (n) { n.hidden = !(on && state.isAdmin); });
    },
    setBadge: function (n) {
      var b = document.getElementById('notif-badge');
      if (b) b.textContent = n;
    }
  };
})();
