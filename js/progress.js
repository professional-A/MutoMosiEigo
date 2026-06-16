// サイトロックチェック（クイズページ共通）
fetch('/api/site-status').then(r => r.json()).then(d => {
  if (!d.locked) return;
  document.body.style.cssText = 'margin:0;padding:0;background:#0a1626;color:#e7eef7;font-family:"Outfit",sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center';
  document.body.innerHTML = '<div><div style="font-size:3.5rem;margin-bottom:16px">🔒</div><h2 style="color:#46d6c4;font-size:1.4rem;margin-bottom:10px">アクセス制限中</h2><p style="color:#8aa1c0;line-height:1.7">管理者によりアクセスが制限されています。<br>しばらくお待ちください。</p></div>';
}).catch(() => {});

(async () => {
  const SUPABASE_URL      = 'https://gwknnqceiozbmxrqjcae.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_4MgSWSr8bbuUf5Vp_LSD6Q_SI-ciZ2B';

  let _token = null;
  async function getToken() {
    if (_token) return _token;
    const custom = localStorage.getItem('muto_session');
    if (custom) { _token = custom; return _token; }
    try {
      if (!window.supabase) return null;
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: { session } } = await client.auth.getSession();
      _token = session?.access_token || null;
    } catch (e) {}
    return _token;
  }

  const _timers = {};
  window.progressSave = async function(quizKey, state) {
    clearTimeout(_timers[quizKey]);
    _timers[quizKey] = setTimeout(async () => {
      const token = await getToken();
      if (!token) return;
      try {
        fetch('/api/progress/' + encodeURIComponent(quizKey), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': token },
          body: JSON.stringify({ state })
        });
      } catch (e) {}
    }, 1500);
  };

  window.progressSaveNow = async function(quizKey, state) {
    clearTimeout(_timers[quizKey]);
    const token = await getToken();
    if (!token) return;
    try {
      await fetch('/api/progress/' + encodeURIComponent(quizKey), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ state })
      });
    } catch (e) {}
  };

  window.progressLoad = async function(quizKey) {
    const token = await getToken();
    if (!token) return null;
    try {
      const res = await fetch('/api/progress/' + encodeURIComponent(quizKey), {
        headers: { 'Authorization': token }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.state || null;
    } catch (e) { return null; }
  };

  // 各クイズページが window._quizSync を定義していれば呼び出す
  if (typeof window._quizSync === 'function') window._quizSync();
})();
