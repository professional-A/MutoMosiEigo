// 全ページ共通のナビゲーション設定。app-shell.mount({ nav: window.APP_NAV }) で使う。
// href は各機能の独立ページ（Phase 3 で順次作成）。
// index.html は当面モーダルを開くため、mount 時に onClick を上書きする（Phase 3 batch 6 で撤去予定）。
window.APP_NAV = [
  { key: 'home',    icon: '🏠', label: 'ホーム',       href: '/' },
  { key: 'test',    icon: '📋', label: 'テスト予測',   href: '/predict.html' },
  { key: 'scores',  icon: '📊', label: '成績',         href: '/scores.html' },
  { key: 'clrank',  icon: '🏆', label: 'クラス順位',   href: '/clrank.html' },
  { key: 'battle',  icon: '⚔️', label: 'バトル',       href: '/battle.html' },
  { key: 'race',    icon: '🏁', label: 'レース',       href: '/race.html', id: 'race-view-btn' },
  { key: 'members', icon: '👥', label: 'メンバー',     href: '/members.html' },
  { key: 'admin',   icon: '🛠', label: '管理',         href: '/admin.html', adminOnly: true }
];
