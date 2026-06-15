(async () => {
  const SUPABASE_URL      = 'https://gwknnqceiozbmxrqjcae.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_4MgSWSr8bbuUf5Vp_LSD6Q_SI-ciZ2B';

  let _token = null;
  async function getToken() {
    if (_token) return _token;
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
