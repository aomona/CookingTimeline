// このファイルはモジュール化されたファイルから各機能を再エクスポートするインデックスファイルです
// 元の機能は以下のファイルに分離されました：
// - views/menu.js: メニュー一覧表示
// - views/timeline.js: タイムライン表示とインタラクション
// - views/recipe.js: レシピ詳細表示
// - views/navigation.js: セクション切り替えとホーム表示

// メニュー機能
export { populateMenuSelect } from './views/menu.js';

// ナビゲーション機能
export { showSection, renderHome } from './views/navigation.js';

// タイムライン機能
export { renderTimeline, setupTimelineInteractions } from './views/timeline.js';

// レシピ表示機能
export { renderRecipeView, renderRecipeById } from './views/recipe.js';

// 調理再生ビュー
export { renderCookingById } from './views/cooking.js';

// 初期化時にタイムラインのインタラクションを設定
import { setupTimelineInteractions } from './views/timeline.js';
setupTimelineInteractions();
