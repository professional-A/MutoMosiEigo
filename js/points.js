// 共有ポイント送信スクリプト
(async () => {
  const SUPABASE_URL     = 'https://gwknnqceiozbmxrqjcae.supabase.co';
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

  window.addPoints = async function(amount) {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (data.ok) showPointsToast(`+${amount.toLocaleString()}pt`);
    } catch (e) {}
  };

  window.showPointsToast = function(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#46d6c4;color:#0a1626;font-weight:700;padding:10px 20px;border-radius:99px;font-size:1rem;z-index:9999;pointer-events:none;transition:opacity .4s';
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 1800);
  };
})();
