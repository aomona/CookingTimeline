# CookingTimeline

## ファイル構成

**pasta.json（レシピ本体）**
- ファイル: `src/recipes/pasta.json`
- 役割: 1つのレシピを完全に表現するJSON。
- 主なフィールド:
  - version: スキーマのバージョン番号。
  - id/title: レシピの識別子と表示名。
  - servings: 何人分か。
  - tags: タグ配列（例: pasta/basic/quick）。
  - author/updatedAt: 作成者と更新日。
  - materials: 材料の配列。各要素は `{ id, name, amount }` を持ちます。
    - id は手順で利用する参照キー（`steps[].uses` と紐付く）です。
  - steps: 手順の配列。各手順は以下を持ちます。
    - id/label: 手順IDと表示名。
    - timeline: `{ start, end }` 形式の予定時刻（分）。他手順と重複して同時進行可能です。
    - time: 手順の所要分数（`end - start` と一致する想定）。
    - req: リソース要求（例: `{"stove":1,"hands":1}`）。
    - after: 依存する手順ID配列（開始順序の制約）。
    - uses: 使用する材料ID配列（`materials[].id` を参照）。
    - instructions: 手順の具体的な説明テキスト。

**manifest.json（レシピ一覧メタ）**
- ファイル: `src/recipes/manifest.json`
- 役割: 一覧表示や読み込み用の軽量メタデータ。UI はまずこのファイルを読み、選択後に対象レシピJSONを取得します。
- 主なフィールド:
  - version/generatedAt: マニフェストのスキーマ版と生成日。
  - recipes: レシピメタの配列。各要素は以下を含みます。
    - id/title: レシピの識別子と表示名。
    - file: レシピ本体JSONのファイル名（相対パス、例: `pasta.json`）。
    - servings/tags: 一覧表示用の補助情報。
    - makespan: 予定の最短所要時間（例: 最終手順の `timeline.end`）。
    - sumStepTime: 全手順の `time` 合計（並列性を無視した総作業時間の目安）。
    - order: 表示順制御などに使える数値。

## コードモジュール構成

**libディレクトリ内のモジュール**
- `views.js`: メインインデックスファイル（全viewsモジュールを再エクスポート）
- `views/menu.js`: レシピメニュー一覧表示機能
- `views/timeline.js`: タイムライン表示とインタラクション機能
- `views/recipe.js`: レシピ詳細表示機能
- `views/navigation.js`: セクション切り替えとホーム表示機能
- `data.js`: データ取得機能
- `router.js`: ルーティング機能

このモジュール分割により、コードの保守性と可読性が向上し、各機能を独立して編集・テストできるようになっています。views関連の機能は`views/`ディレクトリに整理されており、より直感的な構造になっています。

**新しいレシピを追加する手順**
- `src/recipes/` に `<id>.json` を作成（`pasta.json` を雛形に流用可）。
- `src/recipes/manifest.json` の `recipes` 配列にメタ情報を1件追加。
- `file` は通常 `<id>.json` を指します。`id` はURLハッシュ（`#<id>`）にも使われます。
