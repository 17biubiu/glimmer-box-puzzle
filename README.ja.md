# きらめきメモリーボックス · ペット倉庫番

[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md)

ペットメモリアルをテーマにした小さな 3D 倉庫番ゲームです。Nuxt 3 と素の Three.js で作られており、ペットと一緒に光るメモリーボックスを星の位置まで運びます。

背景情報や関連コンテンツは[paw & ever](https://www.pawandever.com/?ref=box-puzzle-readme)でもご覧いただけます。

## 実行

```bash
npm install
npm run dev
npm run dev:clean
npm run dev -- --port 7100 --host 127.0.0.1
npm run dev:host
npm run build
npm run preview
npm test
node scripts/regression-red.mjs
npm run test:levels
npm run typecheck
npm run test:ui
```

## 操作

- PC: 方向キー / WASD で移動、`Z` または `U` で取り消し（最大 4 手）
- モバイル: 盤面をスワイプ、または盤面下の方向パッドを使用
- 上部 HUD: 歩数、押した回数、取り消し、やり直し、ミュート、ヒント、ステージ選択
- ボタンは Tab / Enter / Space に対応。ダイアログはフォーカスを保持し、Escape で確認ダイアログやヒントカードを閉じられます
- 移動 140ms、押し 180ms。ペットはカメラに安定して向き、足の動きは控えめです
- OS で「視覚効果を減らす」が有効な場合、装飾アニメーションを抑えます

## ルールとシステム

- 1 回に 1 個だけ押せるクラシック倉庫番です。引くことはできません
- 星評価: `歩数 ≤ par` で 3★、`≤ round(par × 1.5)` で 2★、それ以外は 1★
- 取り消し履歴は最大 4 手
- 進行状況は localStorage の `glimmer-box-puzzle.v2` に保存され、旧セーブも移行対応します
- 難易度パックは 4 つ。Tutorial 10、Easy 40、Medium 55、Hard 50、合計 155 面
- 猫、犬、うさぎ、とかげの 4 体はすべて手続き生成モデルです
- 各ペットは各面の初回クリア時に星数に応じて 1 から 3 個の報酬を獲得します
- 音は Web Audio によるリアルタイム合成で、外部音声ファイルを使いません
- UI と知識カードは i18n 化されており、中国語、英語、日本語、フランス語、ドイツ語に対応しています

## ステージ難易度

正式コースは 155 面で、回転、鏡像、開始位置だけが違う等価面を除外しています。  
難易度スコアは `最少押し回数 × 4 + 参考解の歩数 + 箱数 × 6` で計算し、各パック内で段階的に並べています。

| パック | 参考歩数 | 最少押し回数 |
| --- | --- | --- |
| Tutorial | 1-10 | 1-4 |
| Easy | 6-24 | 2-8 |
| Medium | 15-38 | 7-11 |
| Hard | 22-60 | 8-21 |

Hard パックには 12 面の追加チャレンジがあります。ソルバーはまず押し回数を最小化し、その解の中で歩数を最小化します。

## プロジェクト構成

```text
game/core/        TypeScript 製のゲームコア
game/render/      Three.js 描画レイヤー
game/audio/       Web Audio 手続き音声
pages/            ホーム / ステージ選択 / プレイ画面
components/       ペット表示、報酬、ネイティブダイアログ、知識カード、言語切替
composables/      セーブと i18n のラッパー
i18n/locales/     zh / en / ja / fr / de の言語ファイル
public/levels/    正式コースの level ソースと保留した旧盤面
scripts/          ツール、回帰テスト、コース編成スクリプト
```

## ツール

```bash
./node_modules/.bin/esbuild scripts/box-puzzle-tools.ts --bundle --platform=node --format=esm --outfile=.tmp/tools.mjs
./node_modules/.bin/esbuild scripts/engine-check.ts --bundle --platform=node --format=esm --outfile=.tmp/check.mjs

node .tmp/tools.mjs solve
node .tmp/tools.mjs gen 100 5 8 8 3 1 6 4 9
node .tmp/check.mjs
```

ブラウザテストには Chrome が必要です。`.tmp/` にはスクリーンショットや失敗時の出力が保存されます。

## ライセンス

コードは [MIT](./LICENSE) で公開しています。音声は Web Audio のプロシージャル合成、ペットモデルはプロシージャルジオメトリで、外部素材は含みません。レベルは `tutorial/1.xsb` を除きすべて本プロジェクトのオリジナル（手作業またはリポジトリ内ジェネレーターで生成）です。`tutorial/1.xsb` の盤面は David W. Skinner の Microban レベル集（#44 'Duh!'）に由来し、作者の条件に基づきクレジットを表示して使用しています。詳細は [public/levels/LICENSE-NOTE.md](./public/levels/LICENSE-NOTE.md) を参照してください。
