import { handleRoute } from './lib/router.js';

// エントリポイント: 初期レンダーとハッシュ変更監視
document.addEventListener('DOMContentLoaded', () => {
  handleRoute();
  window.addEventListener('hashchange', handleRoute);
});
