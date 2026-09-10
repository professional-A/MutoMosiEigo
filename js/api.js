// 認証付き fetch の共通ラッパ。window.api を生やす。
// トークン規則は js/points.js / js/progress.js の getToken() と同一
// （localStorage.muto_session 優先 → 無ければ Supabase セッション）。
// ヘッダーは Authorization: <token>（"Bearer " プレフィックスは付けない。既存APIに合わせる）。
// フェーズ1では配置のみ。呼び出し元はフェーズ2以降で移行する。
(function () {
  var SUPABASE_URL      = 'https://gwknnqceiozbmxrqjcae.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_4MgSWSr8bbuUf5Vp_LSD6Q_SI-ciZ2B';
  var _token = null;

  async function getToken() {
    if (_token) return _token;
    var custom = localStorage.getItem('muto_session');
    if (custom) { _token = custom; return _token; }
    try {
      if (!window.supabase) return null;
      var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      var r = await client.auth.getSession();
      _token = (r.data && r.data.session && r.data.session.access_token) || null;
    } catch (e) { /* 未ログイン扱い */ }
    return _token;
  }

  async function request(method, path, body) {
    var headers = {};
    var token = await getToken();
    if (token) headers['Authorization'] = token;
    var init = { method: method, headers: headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    var res  = await fetch(path, init);
    var text = await res.text();
    var data = null;
    if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
    if (!res.ok) {
      var err = new Error('HTTP ' + res.status + ' ' + method + ' ' + path);
      err.status = res.status;
      err.body   = data;
      throw err;
    }
    return data;
  }

  window.api = {
    get:  function (p)    { return request('GET', p); },
    post: function (p, b) { return request('POST', p, b === undefined ? {} : b); },
    put:  function (p, b) { return request('PUT', p, b === undefined ? {} : b); },
    del:  function (p)    { return request('DELETE', p); },
    _resetToken: function () { _token = null; }
  };
})();
