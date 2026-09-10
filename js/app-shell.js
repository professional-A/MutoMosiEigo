// 武藤模試 共通シェル（ヘッダーバー＋ハンバーガードロワー＋認証）
//
// 使い方:
//   appShell.mount(document.getElementById('app-shell-bar'), {
//     nav: window.APP_NAV,          // js/nav.js。省略時は空
//     manageAuth: true,            // 既定 true。false にすると認証はページ側の責務（index.html 用）
//     onGoogleLogin, onIdLogin, onLogout, onNotif, onAvatar  // 省略時は既定動作
//                                          // onAvatar 既定＝内蔵のアバター/フレーム/名前変更モーダル
//                                          //   （PUT /api/avatar → refreshAuth()。id は appshell- プレフィックス）
//   });
//   appShell.user   // null | { id, username, email, avatar, frame, points, lifetimePoints, isAdmin, ... }
//   window.addEventListener('appshell:auth', e => { /* e.detail = appShell.user */ });
//   appShell.refreshAuth()  // /api/me を取り直す（ポイント変動後など）
//   appShell.update({ loggedIn, name, points, avatar, frame, isAdmin })  // 表示だけ手動更新したい場合
//
// nav 項目の描画規則:
//   - href があり onClick が無ければ <a href>（通常遷移）
//   - それ以外は <button>（クリックで onClick を呼び、ドロワーを閉じる）
//   - key !== 'home' && key !== 'race' の項目は [data-auth] 付き（未ログイン時に隠す）
//   - adminOnly の項目は [data-admin] 付き（管理者以外は隠す）
(function () {
  var SUPABASE_URL      = 'https://gwknnqceiozbmxrqjcae.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_4MgSWSr8bbuUf5Vp_LSD6Q_SI-ciZ2B';
  var ADMIN_EMAIL = 'kabu6113450@gmail.com';

  var opts = null;
  var els = {};
  var drawer = null, backdrop = null;
  var _sb = null;
  var user = null, token = null;

  function sbClient() {
    if (_sb) return _sb;
    if (!window.supabase) return null;
    try { _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (e) { _sb = null; }
    return _sb;
  }

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

  // ── 認証 ──────────────────────────────────────────────
  function applyUser() {
    window.appShell.user = user;
    window.appShell.token = token;
    window.appShell.update({
      loggedIn: !!user,
      name:     user && user.username,
      points:   user && user.points,
      avatar:   user && user.avatar,
      frame:    user && user.frame,
      isAdmin:  !!(user && user.isAdmin)
    });
    try { window.dispatchEvent(new CustomEvent('appshell:auth', { detail: user })); } catch (e) {}
  }

  function resolveAuth() {
    token = null; user = null;
    var p = Promise.resolve(localStorage.getItem('muto_session'));
    if (!localStorage.getItem('muto_session')) {
      var c = sbClient();
      if (c) p = c.auth.getSession().then(function (r) {
        return (r && r.data && r.data.session && r.data.session.access_token) || null;
      }).catch(function () { return null; });
    }
    return p.then(function (t) {
      token = t || null;
      if (!token || !window.api) { applyUser(); return; }
      return window.api.get('/api/me').then(function (me) {
        user = {
          id: me.id, username: me.username, email: me.email || '',
          avatar: me.avatar || '🐸', frame: me.frame || 'default',
          points: me.points || 0, lifetimePoints: me.lifetime_points || 0,
          unlockedAvatars: me.unlockedAvatars || [], title: me.title || '',
          isAdmin: (me.email || '') === ADMIN_EMAIL
        };
        applyUser();
      }).catch(function (e) {
        if (e && e.status === 401) localStorage.removeItem('muto_session');
        token = null; user = null; applyUser();
      });
    });
  }

  function defaultGoogleLogin() {
    var c = sbClient();
    if (!c) { alert('ログイン機能を読み込めませんでした'); return; }
    c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin, skipBrowserRedirect: true } })
      .then(function (r) {
        if (r.error) { alert('Supabaseエラー: ' + r.error.message); return; }
        if (r.data && r.data.url) location.href = r.data.url;
      });
  }
  function defaultIdLogin() { location.href = '/login.html'; }

  // ── アバター／フレーム／名前 変更モーダル（index.html から移設）─────────────
  // id は index.html の #avatar-modal-bg 等と衝突しないよう appshell- プレフィックス。
  var AVATAR_NAMES = { '😼': 'ひろと', '😏': '考え方やな' };
  var AVATARS = [
    '🐸','🐙','🦑','🪲','🦠','🧟','👁️','🫠','🤡','💀',
    '👾','🫀','🧠','🪳','🦷','🐛','🫁','🤢','🕷️','🦂',
    '🐊','🐀','🧌','👽','🫦','🦴','🩸','🧛','🧜','🧝',
    '🎃','🪄','🌑','🌪️','🫧','🕯️','🪦','🩻','🧿','🫐',
    '🔥','💎','👑','⚡','🌙','☠️','🎭','🗿','🌊','🍄'
  ];
  var FRAMES = [
    { id: 'default', name: 'なし' }, { id: 'silver', name: 'シルバー' },
    { id: 'gold', name: 'ゴールド' }, { id: 'teal', name: 'ティール' },
    { id: 'red', name: 'レッド' }, { id: 'purple', name: 'パープル' },
    { id: 'rainbow', name: 'レインボー' },
    { id: 'worst', name: 'ワースト記念', hidden: true },
    { id: 'baka', name: 'バカ記念', hidden: true }
  ];
  var avModal = null, selAvatar = '🐸', selFrame = 'default';

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function applyFrameEl(el, frame) {
    el.className = el.className.replace(/frame-\S+/g, '').trim();
    el.classList.add('avatar', 'frame-' + (frame || 'default'));
  }

  function buildAvatarModal() {
    if (avModal) return;
    avModal = h('div', { 'class': 'modal-bg', id: 'appshell-avatar-modal' });
    avModal.innerHTML =
      '<div class="modal">' +
        '<h2>アイコンを選ぶ</h2>' +
        '<div style="display:flex;gap:12px;margin-bottom:14px">' +
          '<div style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 14px;flex:1;text-align:center">' +
            '<div style="font-size:.65rem;color:var(--dim);margin-bottom:2px">🏆 シーズンpt</div>' +
            '<div id="appshell-season-pts" style="font-size:1.1rem;font-weight:700;color:var(--teal)">―</div></div>' +
          '<div style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 14px;flex:1;text-align:center">' +
            '<div style="font-size:.65rem;color:var(--dim);margin-bottom:2px">📦 個人pt（累計）</div>' +
            '<div id="appshell-lifetime-pts" style="font-size:1.1rem;font-weight:700;color:var(--amber)">―</div></div>' +
        '</div>' +
        '<div style="margin-bottom:12px"><label style="font-size:.8rem;color:var(--muted);display:block;margin-bottom:4px">プレイヤーネーム</label>' +
          '<input id="appshell-username-input" type="text" maxlength="20" style="width:100%;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-family:inherit;font-size:.95rem"></div>' +
        '<div class="avatar avatar-lg" id="appshell-avatar-preview">🐸</div>' +
        '<div class="avatar-grid" id="appshell-avatar-grid"></div>' +
        '<div class="frame-section"><h3>フレームを選ぶ</h3><div class="frame-grid" id="appshell-frame-grid"></div></div>' +
        '<div class="modal-btns" style="margin-top:16px">' +
          '<button type="button" id="appshell-avatar-save" style="background:var(--teal);color:#0a1626">保存</button>' +
          '<button type="button" id="appshell-avatar-close" style="background:transparent;color:var(--dim);border:1px solid var(--line)">閉じる</button>' +
        '</div>' +
        '<div class="modal-msg" id="appshell-avatar-msg"></div>' +
      '</div>';
    document.body.appendChild(avModal);

    avModal.addEventListener('click', function (e) { if (e.target === avModal) closeAvatarModal(); });
    avModal.querySelector('#appshell-avatar-save').addEventListener('click', saveAvatarModal);
    avModal.querySelector('#appshell-avatar-close').addEventListener('click', closeAvatarModal);
    avModal.querySelector('#appshell-avatar-grid').addEventListener('click', function (e) {
      var d = e.target.closest('[data-av]'); if (d) selectAvatar(d.getAttribute('data-av'));
    });
    avModal.querySelector('#appshell-frame-grid').addEventListener('click', function (e) {
      var d = e.target.closest('[data-fr]'); if (d) selectFrame(d.getAttribute('data-fr'));
    });
  }

  function renderAvatarGrid() {
    var unlocked = (user && user.unlockedAvatars) || [];
    var special = unlocked.filter(function (e) { return AVATARS.indexOf(e) < 0; });
    var specialHtml = special.length ? (
      '<div style="width:100%;font-size:.72rem;color:var(--teal);letter-spacing:.1em;font-weight:600;margin:8px 0 4px">⭐ アンロック済み</div>' +
      special.map(function (e) {
        var label = AVATAR_NAMES[e] || '';
        return '<div class="avatar-opt avatar-opt-named' + (e === selAvatar ? ' selected' : '') + '" data-av="' + escHtml(e) +
          '" style="border-color:var(--amber)">' + e + (label ? '<div class="avatar-opt-label">' + escHtml(label) + '</div>' : '') + '</div>';
      }).join('') +
      '<div style="width:100%;font-size:.72rem;color:var(--dim);letter-spacing:.1em;font-weight:600;margin:8px 0 4px">通常</div>'
    ) : '';
    avModal.querySelector('#appshell-avatar-grid').innerHTML = specialHtml + AVATARS.map(function (e) {
      return '<div class="avatar-opt' + (e === selAvatar ? ' selected' : '') + '" data-av="' + escHtml(e) + '">' + e + '</div>';
    }).join('');
  }
  function renderFrameGrid() {
    avModal.querySelector('#appshell-frame-grid').innerHTML = FRAMES.filter(function (f) { return !f.hidden; }).map(function (f) {
      return '<div class="frame-opt frame-' + f.id + (f.id === selFrame ? ' selected' : '') + '" data-fr="' + f.id + '" title="' + escHtml(f.name) +
        '"><span style="font-size:1.1rem">😀</span></div>';
    }).join('');
  }
  function selectAvatar(emoji) {
    selAvatar = emoji;
    var prev = avModal.querySelector('#appshell-avatar-preview');
    prev.textContent = emoji;
    renderAvatarGrid();
  }
  function selectFrame(id) {
    selFrame = id;
    applyFrameEl(avModal.querySelector('#appshell-avatar-preview'), id);
    renderFrameGrid();
  }
  function openAvatarModal() {
    if (!avModal) buildAvatarModal();
    selAvatar = (user && user.avatar) || '🐸';
    selFrame  = (user && user.frame) || 'default';
    avModal.querySelector('#appshell-username-input').value = (user && user.username) || '';
    avModal.querySelector('#appshell-season-pts').textContent = ((user && user.points) || 0).toLocaleString() + 'pt';
    avModal.querySelector('#appshell-lifetime-pts').textContent = ((user && user.lifetimePoints) || 0).toLocaleString() + 'pt';
    var prev = avModal.querySelector('#appshell-avatar-preview');
    prev.textContent = selAvatar;
    applyFrameEl(prev, selFrame);
    avModal.querySelector('#appshell-avatar-msg').textContent = '';
    renderAvatarGrid();
    renderFrameGrid();
    avModal.classList.add('open');
  }
  function closeAvatarModal() {
    if (avModal) { avModal.classList.remove('open'); avModal.querySelector('#appshell-avatar-msg').textContent = ''; }
  }
  function saveAvatarModal() {
    var msg = avModal.querySelector('#appshell-avatar-msg');
    var newName = avModal.querySelector('#appshell-username-input').value.trim();
    if (!newName) { msg.textContent = '名前を入力してください'; msg.style.color = 'red'; return; }
    if (!window.api) { msg.textContent = '通信できません'; msg.style.color = 'red'; return; }
    window.api.put('/api/avatar', { avatar: selAvatar, frame: selFrame, username: newName }).then(function (data) {
      if (data && data.ok) {
        try {
          localStorage.setItem('muto_avatar', selAvatar);
          localStorage.setItem('muto_frame', selFrame);
        } catch (e) {}
        msg.textContent = '保存した！'; msg.style.color = 'var(--teal)';
        setTimeout(closeAvatarModal, 800);
        window.appShell.refreshAuth();
      } else {
        msg.textContent = (data && data.error) || '保存に失敗しました'; msg.style.color = 'red';
      }
    }).catch(function () { msg.textContent = '通信エラー'; msg.style.color = 'red'; });
  }

  window.appShell = {
    user: null,
    token: null,
    mount: function (host, options) {
      if (!host) { console.warn('[app-shell] mount: host element not found'); return; }
      opts = options || {};
      if (!opts.onGoogleLogin) opts.onGoogleLogin = defaultGoogleLogin;
      if (!opts.onIdLogin)     opts.onIdLogin     = defaultIdLogin;
      if (!opts.onLogout)      opts.onLogout      = function () { window.appShell.logout(); };
      if (!opts.onAvatar)      opts.onAvatar      = openAvatarModal;   // 既定＝内蔵アバターピッカー
      buildBar(host);
      buildDrawer();
      buildAvatarModal();
      this.update({ loggedIn: false });
      if (opts.manageAuth !== false) resolveAuth();
    },
    refreshAuth: function () { return resolveAuth(); },
    logout: function () {
      var c = sbClient();
      var done = function () {
        localStorage.removeItem('muto_session');
        localStorage.removeItem('muto_user');
        localStorage.removeItem('muto_points');
        token = null; user = null; applyUser();
      };
      if (c && c.auth && c.auth.signOut) c.auth.signOut().then(done, done);
      else done();
    },
    update: function (state) {
      state = state || {};
      var on = !!state.loggedIn;
      var ptsStr = (state.points != null ? Number(state.points).toLocaleString() : '0') + 'pt';

      els.idBtn.hidden     = on;
      els.googleBtn.hidden = on;
      // お知らせベルは onNotif を渡したページ（index.html）だけに出す。
      // 独立ページはお知らせパネルを持たないので非表示。
      els.notifBtn.hidden  = !on || !opts.onNotif;
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
