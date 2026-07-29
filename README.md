# リズム・エクスプレス

音楽に合わせてビート列車を走らせ、3つの世界を旅する小学生向けWebリズムゲームです

- 対象: 小学1〜4年生（中心は小学2年生）
- 対応: PC、タブレット、スマートフォン
- 実装: React 19、TypeScript、Vite、Canvas 2D、Web Audio API
- 保存: `localStorage`
- 公開先: GitHub Pages / OpenAI Sites
- デザイン: 発光レールとスピード感を軸にした「Railwave」
- 音楽: 3路線ごとのドラム、ベース、コード、主旋律、サビをWeb Audioで生成

## ゲーム内容

| 路線 | BPM | 長さ | 主な操作 |
| --- | ---: | ---: | --- |
| はじまりの街 | 96 | 約60秒 | タップ、長押し |
| ジャングル鉄道 | 108 | 約75秒 | タップ、長押し、連打、待つ |
| 月面エクスプレス | 120 | 約90秒 | 全5種、左右の線路切り替え |

難易度は「かんたん」「ふつう」「チャレンジ」の3段階です。ミスをしても途中終了せず、最後の駅まで走れます

各路線・難易度には3つの路線ミッションがあり、全27個のミッションスターを集める「GRAND TOUR」を遊べます。コンボをつなぐとFLOW倍率が上がり、エネルギー80%以上で「FLOW DRIVE」を発動すると、8秒間のスコア2倍と専用の音楽・スピード演出が始まります

4種類の列車には、開始エネルギー増加、ミスのダメージ軽減、連打・長押しの追加チャージ、FLOW DRIVE時間延長という固有能力があります

## 小学2年生が安心して夢中になれる仕組み

- 1回の完走ごとに「わくわく乗車券」へスタンプが1個つき、3個でおみやげシールを獲得
- 全9種類のシール帳で、短い目標と集める楽しさを見える化
- プレイ中は路線ごとの仲間が、成功・ミス・FLOW DRIVEを短い言葉で応援
- 各路線の途中に3つのサプライズが現れ、汽笛・合図・救助などで世界へ働きかける
- サプライズは成功するとその場でスコアとエネルギーが増え、見逃しても減点なし
- 3回ごとに「ひとやすみ駅」を表示し、進捗を失わず休める区切りを用意
- ガチャ、課金、ログイン連続記録、取り逃し、終了を妨げる演出は不使用

## 操作

- `Space`: タップ、長押し
- `←` / `→`: 線路切り替え
- `F`: FLOW DRIVEを発動
- タッチ端末: 画面下部のBEATボタンと左右ボタン
- iPad: 音声開始に失敗した場合に加え、プレイ中に音声時計が止まった場合も、カウントを戻さず自動で「音なし運転」へ切り替えて続行可能
- Quiet区間: 何も押さずに音を聞く

タイトルの「しゅっぱつする」からは、はじまりの街・かんたん・サンライズ号ですぐ運転できます。タップ・長押し・待つを練習したいときは「はじめての運転」を選びます。設定画面では音量、効果の強さ、動きの軽減、タイミング補正を変更できます

## 開発

Node.js 22.13以上を使用します

```bash
npm install
npm run dev
```

通常は `http://localhost:5173/` で起動します

### 品質確認

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run build:sites
npm run test:rendered
```

一括実行:

```bash
npm run test:all
```

77件の自動テストで、走行中サプライズの出現時間、再出現防止、固定ボーナス、判定窓、イベント時刻、重複判定防止、Boosterのリズムスロット、Switch分岐、長押し休止、Quiet、Miss継続、FLOW倍率とFLOW DRIVE、列車能力、路線ミッション、AudioContext基準の時刻管理、4拍カウント、音量ミックス、音階循環、全ステージ譜面、設定移行、進行保存を検証します。iPad Safariの`interrupted`状態、`running`表示のまま進まない音声時計、Pointer Events未対応時のTouch Events切り替え、旧式のMediaQueryListリスナー、Canvasの`roundRect`未対応、音声を復旧できない場合の無音運転も再現しています

## タイミング設計

ゲーム時刻は `requestAnimationFrame` ではなく `AudioContext.currentTime` から算出します。描画はrAF、音楽スケジューリングと判定は音声時計を基準に分離しているため、描画フレームが揺れても判定時刻へ直接影響しません

- `AudioEngine`: 路線別の多層BGMと効果音をWeb Audioで生成・先行予約し、チャンネル別ミックスとリミッターで明瞭さを維持
- `TimingEngine`: 音声時計、ポーズ、端末補正値を管理
- `JudgementEngine`: 難易度別の判定窓を管理
- `ChartEngine`: ノーツ表示、近傍検索、重複解決防止
- `GameSession`: 入力、スコア、コンボ、Quiet、結果を統合
- `ProgressRepository`: 記録、スタンプ、列車、乗客を保存

音源とCanvasビジュアルは外部素材を使わず、このアプリ内で生成しています

## GitHub Pages

`.github/workflows/deploy-pages.yml` を同梱しています

1. GitHubリポジトリの既定ブランチを `main` にする
2. Settings > Pages > Source で `GitHub Actions` を選ぶ
3. `main` へpushする、またはActionsから手動実行する

`npm run build` の成果物は `dist-pages/` に作成されます。Windowsの日本語パスでVite 8が終了する問題を避けるため、`scripts/build-pages.mjs` が一時ASCIIパスでビルドしてから成果物を戻します。GitHub Actions上でも同じコマンドを利用できます

## OpenAI Sites

Sites向けの開発と公開前確認:

```bash
npm run dev:sites
npm run build:sites
npm run test:rendered
```

`build:sites` はソースを一時ASCIIパスへコピーし、既存の `node_modules` をjunctionで共有してVinextを実行します。成果物は `dist/` に戻され、`.openai/hosting.json` も同梱されます。D1やR2などのサーバー保存領域は使わず、ゲームの進行はブラウザの `localStorage` に保存します

SNS共有カードはアクセス中のHostから絶対URLを組み立てて `public/og.png` を参照します。必要な場合は `NEXT_PUBLIC_SITE_URL` で公開元URLを上書きできます

## ブラウザ確認済み

- 375 x 1024（iPad Split View）: 4 → 3 → 2 → 1から走行へ進み、横スクロールなし
- 820 x 1180（iPad縦）: カウントから走行、ポーズ、音声再開まで確認
- 1180 x 820（iPad横）: カウントから走行へ進み、下部操作エリアを常時表示
- 各サイズでBEAT、長押し、左右、FLOW DRIVE、ポーズの操作が画面内
- iPad Safari固有の`interrupted`状態と、`running`表示のまま時計が止まる状態を疑似AudioContextで再現し、自動復旧、プレイ中の無音継続、再試行導線を確認
- 3路線の開始、街ステージ完走、結果保存、列車アンロック、ポーズ再開を確認
- ブラウザConsoleのerror / warningなし

## 端末差

Bluetooth機器や端末固有の音声遅延は完全には統一できません。プレイ前に「タイミングを調整」で補正してください。進行データはブラウザ内保存のため、別端末や別ブラウザへは自動同期されません