# CookingTimeline

料理の工程を「タイムライン」で見える化し、複数レシピの同時進行を計画・最適化・再生できる、静的フロントエンドアプリです。資源（コンロ/手作業/オーブン）上限に基づく衝突検知、進行中タスクの提示、デスクトップ通知に対応します。

## 特長

- 複数レシピの結合タイムライン: 選んだレシピを1本の時間軸に統合
- 資源制約の可視化: 上限超過区間を赤帯で表示（衝突検知）
- シンプルなスケジューリング: 後方寄せ→貪欲配置→レベリングのパイプライン
- 調理の「再生」: 速度変更・現在のタスク・残り時間・通知
- すべて静的ファイル: どこでも配信できる（GitHub Pages 等）

> 注意: 収録レシピはAI生成です。実際の調理では適宜ご判断ください。

## クイックスタート

前提: Node.js 18 以上推奨

1) 依存関係をインストール

```
npm install
```

2) CSS をビルド（監視）

```
npm run dev
```

3) 静的サーバで `index.html` を配信

- Python: `python -m http.server 8000`
- または Node: `npx http-server -p 8000`（任意）

4) ブラウザで開く

```
http://localhost:8000/
```

本番用ビルド（最小化）

```
npm run build
```

## 使い方（画面とルーティング）

- ホーム `#`
  - レシピ一覧。ジャンルで絞り込み（選択は `localStorage: ct.genre` に保持）
  - 複数選択 → 「選択して計画」でプラン画面へ

- レシピ詳細/プレビュー `#<id>`
  - 材料、タイムライン、手順を表示
  - 「計画する」→ `#plan/<id>` / 「調理を開始」→ `#cook/<id>`

- 複数レシピの計画 `#plan/<id[,id...]>`
  - キッチン資源の上限（コンロ/手作業/オーブン）を設定・保存（`ct-capacity`）
  - 結合タイムラインのバーをドラッグで移動、行の並べ替えも可能
  - 赤帯で資源衝突を可視化。全体表示長さも調整可
  - 「調理を開始」で `#cook/<id[,id...]>` へ

- 調理の再生 `#cook/<id[,id...]>`
  - 速度 1x/10x/60x、進捗バー、ライブタイムライン
  - 「今やること」を上位から提示（材料も表示）
  - 工程終了時にデスクトップ通知＋トースト表示

## データ仕様（Schema v2）

レシピは JSON で管理します。複数レシピの一覧は `recipes/manifest.json` を読み、選択後に各 `recipes/<id>.json` を取得します。

### `recipes/manifest.json`

- version / generatedAt: スキーマ版と生成日時
- recipes[]: レシピのメタデータ
  - id / title / file / servings / tags / genre
  - makespan: タイムラインの最終終了時刻（分）
  - sumStepTime: `steps[].time` の総和（並列性を無視した延べ作業時間）
  - order: 一覧の表示順指定

### `recipes/<id>.json`

- version, id, title, servings, tags, genre, author, updatedAt
- materials[]: `{ id, name, amount }`
- steps[]:
  - id, label
  - timeline: `{ start, end }`（分）
  - time: 所要分数（通常は `end - start`）
  - req: リソース要求（例: `{ "stove": 1, "hands": 1 }`）
  - after: 依存する手順ID配列（開始順序を制約）
  - uses: 使用する材料ID配列（`materials[].id` を参照）
  - instructions: 説明文
  - kind: `prep|cook|finish` などカテゴリ
  - slack: 許容遅延（開始を元の `start` からどれだけ後ろにずらせるか, 分）

備考:

- 複数レシピ結合時は手順IDを `<recipeId>:<stepId>` にユニーク化します。
- リソースキーは任意ですが UI ラベルは `stove/hands/oven` を想定（他キーはそのまま表示）。

### レシピを追加する

1) `recipes/<id>.json` を作成（`recipes/pasta.json` を雛形に）
2) `recipes/manifest.json` の `recipes[]` にメタを追加（`file` が `<id>.json` を指す）

## スケジューリングと衝突検知（`lib/scheduler.js`）

- `computeConflicts(steps, capacity)`: 資源ごとの使用過多区間を返す（`res,start,end,usage,cap,culprits`）
- `scheduleBackward(...)`: 依存関係を崩さず slack 範囲で後方寄せ（任意の `targetEnd` 指定可）
- `scheduleGreedy(...)`: 容量を超えない範囲で順に配置（見つからない場合は最短に強制配置）
- `levelResources(...)`: 改善が見込める工程を後ろへずらし、衝突やピークを低減
- `schedulePipeline(...)`: 上記の後方→貪欲→レベリングを順に適用

目的（objective）は `min_conflicts` または `min_peak_hands` を選択できます（UI 連携は今後拡張余地あり）。

## プロジェクト構成

- `index.html` / `main.js`: エントリ
- `lib/router.js`: ハッシュルーティング（`home/preview/plan/cook`）
- `lib/views/`: 各ビュー
  - `menu.js` 一覧と複数選択、ジャンル絞り込み
  - `recipe.js` レシピ詳細
  - `timeline.js` タイムライン描画＋ドラッグ/折りたたみ
  - `cooking.js` 単一レシピの再生
  - `multi-timeline.js` 複数レシピの結合タイムライン
  - `multi-cooking.js` 複数レシピの再生
- `lib/data.js`: マニフェスト/レシピ取得と簡易キャッシュ
- `lib/scheduler.js`: 衝突検知・スケジューリング
- `recipes/`: マニフェストとレシピ本体
- `input.css` → `output.css`: Tailwind v4 CLI で生成
- `test.html`: UI プロトタイプ（アプリ本体とは分離）

## ローカルストレージ

- `ct.genre`: ホームのジャンル絞り込み
- `ct-capacity`: 複数レシピ計画時の資源上限

## ライセンス

MIT License（`LICENSE` を参照）

## 今後の改善候補

- 目的関数のUI連携（衝突最小/ピーク抑制の切替）
- slack や依存関係を考慮したドラッグ制約
- タイムライン編集からレシピJSONへの差分書き戻し
- スマホ向けのドラッグ操作改善
