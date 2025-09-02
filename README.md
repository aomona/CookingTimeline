# CookingTimeline

## ファイル構成

**pasta.json（レシピ本体）**
- ファイル: `recipes/pasta.json`
- 役割: 1つのレシピを完全に表現するJSON。
- 主なフィールド:
  - version: スキーマのバージョン番号。
  - id/title: レシピの識別子と表示名。
  - servings: 何人分か。
  - tags: タグ配列（例: pasta/basic/quick）。
  - genre: 料理のジャンル（例: japanese/chinese/italian/western/other）。
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
- ファイル: `recipes/manifest.json`
- 役割: 一覧表示や読み込み用の軽量メタデータ。UI はまずこのファイルを読み、選択後に対象レシピJSONを取得します。
- 主なフィールド:
  - version/generatedAt: マニフェストのスキーマ版と生成日。
  - recipes: レシピメタの配列。各要素は以下を含みます。
    - id/title: レシピの識別子と表示名。
    - file: レシピ本体JSONのファイル名（相対パス、例: `pasta.json`）。
    - servings/tags/genre: 一覧表示用の補助情報。
    - makespan: 予定の最短所要時間（例: 最終手順の `timeline.end`）。
    - sumStepTime: 全手順の `time` 合計（並列性を無視した総作業時間の目安）。
    - order: 表示順制御などに使える数値。

### ホーム画面のジャンル絞り込み
- メニュー上部の「ジャンル」セレクトで一覧を絞り込み可能。
- 選択状態はローカルに保存され、ホーム再訪時も維持されます。

## コードモジュール構成

**libディレクトリ内のモジュール**
- `views.js`: メインインデックスファイル（全viewsモジュールを再エクスポート）
- `views/menu.js`: レシピメニュー一覧表示機能
- `views/timeline.js`: タイムライン表示とインタラクション機能
- `views/recipe.js`: レシピ詳細表示機能
- `views/navigation.js`: セクション切り替えとホーム表示機能
- `data.js`: データ取得機能
- `router.js`: ルーティング機能

### 複数レシピ対応 (MVP)
- ルート:
  - `#plan/<id,id,...>` で結合タイムライン（プラン画面）
  - `#cook/<id,id,...>` で一括再生（調理画面）
- `views/multi-timeline.js`: 複数レシピのステップを結合して表示。資源（コンロ/手作業/オーブン）上限を指定し、衝突検知・最適化に対応。
- `views/multi-cooking.js`: 結合ステップの再生（速度変更/通知）。
- `scheduler.js`: 資源制約付きのスケジューラと衝突検知ロジック（貪欲 + 後方スケジュール + レベリング）。
- 資源上限はローカルストレージ `ct-capacity` に保存/復元。

#### 複数レシピ最適化の使い方
- 目的: 「衝突最小化」または「手作業ピーク抑制」を選択
- 提供時刻(分): 任意で目標終了時刻を指定（後方スケジュールで寄せる）
- 最適化して衝突解消: 上記の条件でスケジュールを再計算
- タイムライン上部の灰色バーに赤い帯で衝突区間を可視化

### スキーマ v2（後方互換なし）
- `steps[].kind`: `prep|cook|finish` などのカテゴリ
- `steps[].slack`: その工程の開始を元の `timeline.start` から後ろにずらせる許容分数
- 既存フィールド（`timeline`, `time`, `req`, `after`）は維持

このモジュール分割により、コードの保守性と可読性が向上し、各機能を独立して編集・テストできるようになっています。views関連の機能は`views/`ディレクトリに整理されており、より直感的な構造になっています。

**新しいレシピを追加する手順**
- `recipes/` に `<id>.json` を作成（`pasta.json` を雛形に流用可）。
- `recipes/manifest.json` の `recipes` 配列にメタ情報を1件追加。
- `file` は通常 `<id>.json` を指します。`id` はURLハッシュ（`#<id>`）にも使われます。
