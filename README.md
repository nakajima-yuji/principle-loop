# PRINCIPLE LOOP

> **PRINCIPLE LOOPはAIに答えを出させる装置ではない。AIで探索範囲を広げ、人間が面白いものを選び、必要な思考エンジンを借り、小さく試し、現実の反応を次の観察へ戻す装置である。**

```
INPUT
  ↓
DIARY
  ↓
LIGHT DEEP
  ↓
HUMAN SELECT
  ↓
ENGINE
  ↓
TRANSFORM
  ↓
EXPERIMENT
  ↓
TEST
  ↓
OBSERVE
  └→ DIARY
```

世界・人間・技術・作品・自分自身の観察を集め、人間が面白いものを選び、思考エンジンを借り、小さく試し、その結果をまた観察に戻す ——「創造OS」です。

- **作るのは速く、決めるのは遅く。**
- AI に考え切らせない。毎朝の AI は **3行（LIGHT DEEP）で止まります**。
- 「面白い／もっと掘る／作る／保留／捨てる」を選ぶのは人間です（HUMAN SELECT）。
- 思考エンジン（OKADA・OCHIAI・MATSUOKA・KONDO）は**選んだときだけ**借ります。何も借りないことも選べます。
- 完成品より**最小実験**（紙カード5枚・30秒動画・1画面ゲーム・子どもに1分触ってもらう…）。
- 実験の結果は DIARY に**新しい観察として戻します**。そこからまた選び直します。
- ゲームだけに最適化しません。絵本・物語・映像・おもちゃ・空間・インスタレーション・Web・モノ…も出口です。

---

## 目次

0. [全体の仕組み](#0-全体の仕組み)
   - [コンセプトと例：『サッカー、なのに。』](#コンセプトと例サッカーなのに)
   - [個人データと互換性](#個人データと互換性)
1. [セットアップ](#1-セットアップ)
2. [GitHub Pages（アプリの公開）](#2-github-pagesアプリの公開)
3. [AI の無料枠を設定する](#3-ai-の無料枠を設定する)
4. [メール（SMTP）を設定する](#4-メールsmtpを設定する)
5. [GitHub Secrets と Variables](#5-github-secrets-と-variables)
6. [GitHub Actions（自動運転）](#6-github-actions自動運転)
7. [メールのテスト](#7-メールのテスト)
8. [10日自動停止の仕組み](#8-10日自動停止の仕組み)
9. [再開のしかた](#9-再開のしかた)
10. [トラブル対応](#10-トラブル対応)
11. [完了条件](#11-完了条件)
12. [開発者向けメモ](#12-開発者向けメモ)

---

## 0. 全体の仕組み

| 画面 | やること |
| --- | --- |
| **DAILY** | 毎朝の「今日の7つの観察」（月〜土）。1分野1件 × 6分野 ＋「異物」1件。各カードは **LIGHT DEEP の3行**（何が妙・面白い？／構造・原理候補／どこへ飛ばせそう？）と **HUMAN SELECT**（☆面白い ↓深掘り →試す △保留 ×アーカイブ）。右側は MEMO のすばやい入力と、最近「面白い」と選んだもの |
| **DIARY** | 中心のログ。DAILY・メモ・気づき・観察・アイデア・実験・実験結果・道具の組み合わせ（TOOLCHAIN / CAPABILITY）が**時系列**で並ぶ。種類（ALL / DAILY / MEMO / OBSERVATION / IDEA / DEEP / EXPERIMENT / PRINCIPLE / TOOLCHAIN）と HUMAN SELECT で絞り込み |
| **DEEP** | まず **LIGHT DEEP**（3行＋選ぶ）。「↓深掘り」を選んだものだけ **FULL DEEP**（7つの中心質問：入力／変換／なぜ速い／何を捨てた／トレードオフ／最小構造／元用途を消す ＋ 観察・仮説・反例・境界・逆転・転用・原理候補）へ |
| **CONNECT** | 遠いもの × 遠いもの をぶつける。観察・原理候補だけでなく、思考エンジンやメディアともぶつけられる |
| **EXPERIMENT** | 旧 BUILD。一番上に「何を確かめたいか」。最小実験の形とメディアを選び、やってみて起きたことを **DIARY に新しい観察として戻す**。本当に作りたいときだけ Claude Code / Codex 用プロンプトを**コピー**（自動実行しない） |
| **ENGINES** | 思考エンジンの一覧と中身（概要・質問・処理手順・向いている用途）。OKADA「違和感から構造を抜く」／OCHIAI「前提・境界・観測方法を変える」／MATSUOKA「分ける・つなぐ・ずらす・編集する」／KONDO「1テーマを深く掘り、不確実性を減らす」。TRANSFORM（展開）の操作一覧も |
| ACTIVITY / SETTINGS | 稼働状況・10日自動停止・再開・GitHub 連携・バックアップ |

そのほかの道具：

- **CORE LOCK**（逆側の道具）：何を消したら成立しなくなる？／名前を変えても残る核は？／何を守れば大胆に壊せる？／どこまでは変更できる？ — LIGHT DEEP と DIARY で書けます。
- **原理の段階**は「確定」させません：OBSERVATION → PATTERN → STRUCTURE → PRINCIPLE CANDIDATE → TESTING → VALIDATED。AI は段階を上げません。
- **TOOLCHAIN / CAPABILITY**：「Tripo3D × Blender × Three.js × Codex」「紙芝居 × AI画像 × 音声 × 動画生成」のような、できることを増やす組み合わせ。原理とは別の種類として残します。
- 思考エンジンの名前は「その人の考え方から借りた型」に付けたこのアプリでの呼び名です。本人の思考の正確な再現ではありません。借りたら分解し、混ぜ、原型が分からなくなるまで作り直してかまいません。

**お金をかけない構成**です。

```
GitHub Pages（アプリ）  ←  public/data/*.json（DAILY・索引・activity）
        ↑ 公開
GitHub Actions（月〜土の深夜と朝だけ動く）
  00:30 収集 → 重複除去 → 分類 → 候補抽出 → 7件選定 → LIGHT DEEP（無料枠の AI・1件3行だけ）→ 保存
  07:00〜08:00 メールで配信（送信は Gmail など）
```

- 有料のデータベース・常時動くサーバー・有料バックエンド・ベクトル DB は使いません。
- 日々の処理で **Claude Code / Codex は一切使いません**（GitHub Actions ＋ Node.js ＋ 無料枠の AI だけ）。思考エンジンも自動では実行しません。
- 毎朝の AI は1件につき3行だけ書きます（長いストーリーや7つの質問の下書きは作りません）。そのぶん AI の出力が小さくなり、無料枠に余裕ができます。
- 個人データ（DIARY・DEEP のメモ・CONNECT・EXPERIMENT）は**ブラウザの中**（localStorage）に保存します。
- AI の鍵・メールのパスワードは **GitHub Secrets** にだけ置き、アプリ（ブラウザ）には出しません。

### コンセプトと例：『サッカー、なのに。』

『サッカー、なのに。』は、PRINCIPLE LOOP の考え方が言葉になる前に生まれた**プロトタイプ**です。

普通のサッカーゲームが見るのは、パス・シュート・戦術です。
『サッカー、なのに。』が見たのは、その周辺の妙なところでした。

- 10万人の観客がいる
- 自分の席が分からない
- 試合は進んでいる
- なのに、試合を見られない

ここから取り出せる構造の候補は、

> **ジャンルの中心ではなく、周辺の妙な部分を主役へ動かす。**

DAILY の「何が妙・面白い？」、HUMAN SELECT の「☆面白い」、OKADA エンジンの「違和感を探す → 固有名詞を消す → 関係だけを残す → 別分野へ移す」、そして EXPERIMENT の「1画面ゲーム」や「紙芝居」は、すべてこの動きを毎日くり返すための道具です。
出口はゲームに限りません。同じ構造は、絵本にも、映像にも、展示にもなります。

### 個人データと互換性

- 保存先のキーは以前と同じ `principle-loop.personal.v1` です（変えると今までのデータが見えなくなるため）。中身の `version` が `2` になりました。
- 初めて新しい版を開いたとき、元のデータを `principle-loop.personal.v1.backup` に**そのまま1回だけ**コピーしてから、v2 の形に移します。
- 移すときの対応：
  - 種類：DAILY から保存 → `DAILY`、URL から入れた観察 → `OBSERVATION`、CONNECT → `IDEA`
  - 段階：観察 → `OBSERVATION`、仮説 → `PATTERN`、原理候補 → `PRINCIPLE_CANDIDATE`、原理 → `PRINCIPLE_CANDIDATE`、実験済み → `TESTING`（元の段階は `legacyState` に残り、DIARY の詳細に表示されます）
  - 以前「保存」したものは「☆面白い（INTERESTING）」として扱います
  - 足りない項目（エンジン・CORE LOCK・メディア・系譜など）は空で補います。DEEP のメモ・CONNECT・実験設計はそのまま
- バックアップの読み込みは、古い形（v1）のファイルでも新しい形（v2）のファイルでも使えます。

---

## 1. セットアップ

必要なもの：GitHub アカウント、Google アカウント（AI の無料枠用・メール送信用）、受け取るメールアドレス（Yahoo!メールなど）。

1. このリポジトリの変更を `main` ブランチに取り込みます（Pull Request をマージ）。
2. [2. GitHub Pages](#2-github-pagesアプリの公開) を設定します → アプリが開けるようになります（最初はサンプルの7件）。
3. [3. AI](#3-ai-の無料枠を設定する) と [4. メール](#4-メールsmtpを設定する) の準備をします。
4. [5. Secrets](#5-github-secrets-と-variables) に値を登録します。
5. [7. メールのテスト](#7-メールのテスト) で動作を確認します。
6. スマホやパソコンでアプリを開き、**設定 → GitHub 連携** をします（[8. 10日自動停止](#8-10日自動停止の仕組み)。これをしないと10日後に止まります）。

> AI の鍵が無くても動きます。その間は「AI未設定のため仮のテンプレート」として、収集した記事に分析の枠だけを付けて表示します。

### 手元のパソコンで動かす（任意）

Node.js 22.18 以上（24 推奨）が必要です。

```bash
npm install
npm run dev          # http://localhost:5173 でアプリが開く
npm run check        # 型チェック・テスト・ビルド・公開ファイルの確認
```

---

## 2. GitHub Pages（アプリの公開）

1. GitHub でこのリポジトリを開き、**Settings → Pages** へ。
2. **Build and deployment → Source** を **「GitHub Actions」** にします（これだけ）。
3. **Actions** タブ → **Deploy GitHub Pages** → **Run workflow** を押します（main に push しても自動で動きます）。
4. 1〜2分後、`https://<ユーザー名>.github.io/principle-loop/` で開けます。

- 画面の切り替えは `#/deep?id=20261005-03` のように **# を使う方式**なので、GitHub Pages でも、メールのリンクからでも壊れません。
- スマホでは「ホーム画面に追加」するとアプリのように使えます（PWA。最低限のオフライン表示に対応）。

---

## 3. AI の無料枠を設定する

既定では **Google Gemini API の無料枠**を使います。

1. [Google AI Studio](https://aistudio.google.com/) に Google アカウントでログインします。
2. **Get API key → Create API key** で鍵を作ります（`AIza…` で始まる文字列）。
3. この鍵を GitHub Secrets の **`AI_API_KEY`** に登録します（[5. Secrets](#5-github-secrets-と-variables)）。

**使うモデル**：既定は `gemini-3.1-flash-lite`（2026年10月時点で無料枠の対象）。
無料枠の対象モデルや回数は Google の都合で変わります。[料金ページ](https://ai.google.dev/pricing) と [レート制限](https://ai.google.dev/gemini-api/docs/rate-limits) で、無料枠のある Flash / Flash-Lite 系のモデル名を確認し、変えたいときは Variables の **`AI_MODEL`** に書きます。

**使う回数**：1日あたり「選定 1 回 ＋ 分析 7 回」＝ **約 8 回**です（失敗時の再試行を含めても上限は 1 日 20 回）。

**無料枠を守る安全装置**（`config/pipeline.json`。Variables で上書きできます）

| 設定 | 既定 | 意味 |
| --- | --- | --- |
| `AI_MAX_REQUESTS_PER_RUN` | 12 | 1 回の実行で AI を呼ぶ上限（再試行も 1 回と数える） |
| `AI_MAX_REQUESTS_PER_DAY` | 20 | 1 日の上限。これに近いと生成しない |
| `maxRetries` | 2 | 1 リクエストの再試行の上限 |
| `minIntervalMs` | 6500 | リクエストの間隔（1 分あたりの回数制限を守る） |
| `maxPromptChars` / `maxOutputTokens` | 14000 / 8192 | 送る文字数・受け取る長さの上限 |

> 無料枠では、送った内容が Google のサービス改善に使われることがあります。送るのは公開記事の要約と本文の一部だけで、個人データ（DIARY など）は送りません。

**AI を乗り換える**：`src/ai/` の中で交換できるようになっています。

- `AI_PROVIDER=openai-compatible`・`AI_BASE_URL`・`AI_MODEL`・`AI_API_KEY` を設定すると、OpenAI 互換の API（Groq、OpenRouter、Ollama など）に切り替わります。
- 新しい AI を足すときは `src/ai/provider.ts` の `AIProvider` を満たすファイルを作り、`src/ai/index.ts` に 1 行足します。
- `AI_PROVIDER=mock` にすると AI を使いません（仮のテンプレート）。

---

## 4. メール（SMTP）を設定する

受け取り先（`MAIL_TO`）は Yahoo!メールのアドレスで大丈夫です。**送信**は次のどちらかで行います。

> **注意（2026年の実際の結果）**：Yahoo! JAPAN は不正ログイン対策として、メールソフトなどで**海外から**ログインすることを制限しています。GitHub Actions はアメリカのサーバーで動くため、Yahoo!メールからの送信はログインを断られる（`535 authorization failed`）ことがあります。その場合は **A. Gmail から送る** を使ってください。

### A. Gmail から送る（おすすめ・確実）

1. Google アカウントで **2段階認証プロセス** を有効にします。
2. [アプリ パスワード](https://myaccount.google.com/apppasswords) を作ります（名前は `principle-loop` など）。16 文字のパスワードが表示されます。
3. GitHub に登録します。

| 種類 | 名前 | 入れる値 |
| --- | --- | --- |
| Secret | `MAIL_USERNAME` | Gmail のアドレス |
| Secret | `MAIL_PASSWORD` | 2. のアプリ パスワード（16 文字） |
| Secret | `MAIL_TO` | 受け取るアドレス（Yahoo!メールでも OK。カンマ区切りで最大 5 件） |
| Variable | `MAIL_HOST` | `smtp.gmail.com` |

### B. Yahoo!メールから送る

既定の送信先は Yahoo! JAPAN の Yahoo!メールです（`smtp.mail.yahoo.co.jp`・ポート 465・SSL）。

1. パソコンのブラウザで Yahoo!メールを開き、**設定・利用規約 → メールの設定 → IMAP/POP/SMTPアクセスとメール転送** を開きます。
2. **「許可する」**（Yahoo! JAPAN公式サービス以外からのアクセスも有効にする）を選び、**IMAP（または POP）と SMTP の両方**を「利用する」にして保存します（SMTP だけでは送れません）。
3. Yahoo! JAPAN ID に**パスワードが設定されている**ことを確認します。
4. 「海外からのアクセス制限」が有効だと GitHub Actions からは送れません。無効にすると海外からの不正ログインを防ぐ仕組みが弱くなるので、A の Gmail をおすすめします。
5. Secrets に `MAIL_USERNAME`（Yahoo!メールのアドレス、または Yahoo! JAPAN ID）・`MAIL_PASSWORD`（Yahoo! JAPAN ID のパスワード）・`MAIL_TO` を登録します。

- 失敗した送信は自動で再試行しません（ログイン失敗を重ねてアカウントがロックされないようにするため）。
- 送信元は `MAIL_USERNAME` のアドレスになります。違うときは Variables の `MAIL_FROM` に送信元アドレスを書きます。
- 件名は `PRINCIPLE LOOP DAILY｜今日の7つの原理`。各記事に LIGHT DEEP の3行と **「DEEPで掘る」** リンク（開くと LIGHT DEEP。そこで面白い／深掘り／試す…を選びます）が付きます。

---

## 5. GitHub Secrets と Variables

**Settings → Secrets and variables → Actions** で登録します。

### Secrets（秘密の値。登録後は誰にも見えない）

| 名前 | 必須 | 内容 |
| --- | --- | --- |
| `AI_API_KEY` | ほぼ必須 | AI の API キー（無いと仮のテンプレートで動く） |
| `MAIL_USERNAME` | メールに必須 | 送信に使うメールアドレス（Gmail おすすめ） |
| `MAIL_PASSWORD` | メールに必須 | パスワード |
| `MAIL_TO` | メールに必須 | 送り先 |

### Variables（秘密でない設定。すべて任意）

| 名前 | 例 | 内容 |
| --- | --- | --- |
| `AI_MODEL` | `gemini-3.1-flash-lite` | 使うモデル |
| `AI_PROVIDER` | `gemini` / `openai-compatible` / `mock` | AI の種類 |
| `AI_BASE_URL` | `https://api.groq.com/openai/v1` | OpenAI 互換のときの URL |
| `AI_MAX_REQUESTS_PER_DAY` | `20` | 1 日の AI 上限 |
| `INACTIVITY_LIMIT_DAYS` | `10` | 何日無反応で止めるか |
| `MAIL_HOST` | `smtp.gmail.com` | 送信サーバー（空なら Yahoo!メール） |
| `MAIL_FROM` / `MAIL_PORT` | | メールの細かい設定 |
| `APP_URL` | `https://example.github.io/principle-loop/` | メール内リンクの URL（独自ドメインのとき） |

**守っていること**

- `.env` はコミットしません（`.gitignore` 済み）。鍵やパスワードをコードに書きません。
- 鍵を使うのは GitHub Actions の中だけ。アプリ（GitHub Pages）には一切含めません。ビルドのたびに `scripts/check-dist.ts` が、公開ファイルに鍵らしき文字列や AI・メールのコードが混ざっていないか確かめます。
- エラーメッセージにパスワードが出ないようにしています。

---

## 6. GitHub Actions（自動運転）

`.github/workflows/` に 4 つあります。

| ファイル | いつ動く | やること |
| --- | --- | --- |
| `principle-loop-daily.yml` | 月〜土 00:30・03:10・07:05・07:35（日本時間） | 生成とメール。03:10 と 07:35 は「失敗していたときの再試行」で、済んでいれば何もしない |
| `activity.yml` | アプリから／手動 | 活動の記録（heartbeat）と再開（resume） |
| `pages.yml` | main への push／他から呼ばれたとき | アプリを GitHub Pages に公開 |
| `ci.yml` | push のたび | 型チェック・テスト・ビルド・公開ファイルの確認 |

毎日の処理は、冒頭で必ず次の順に確かめます。

```
今日は日曜？            → はい：終了（収集・AI・メールなし）
一時停止中？            → はい：終了
10日間 反応がない？     → はい：一時停止にして終了（朝に1回だけお知らせ）
                        → いいえ：DAILY の処理を始める
```

- GitHub の cron は UTC なので、日本時間の月〜土に動くよう `0-5`（UTC の日〜金）で書いてあり、スクリプト側でも日本時間の曜日をもう一度確かめます。
- GitHub の混雑で、予定の時刻から数分〜数十分遅れることがあります。00:30 は「00:30 以降に始まる」、メールは 07:05 と 07:35 の 2 回の機会で「7時台に届く」ように組んでいます。
- 手動で動かすとき：**Actions → PRINCIPLE LOOP Daily → Run workflow** で `mode` を選びます。
  - `status`：状態を表示するだけ（何も変えない）
  - `collect`：収集と絞り込みだけ（AI・メールなし）。情報源の調子を見るのに便利
  - `generate` / `mail` / `all`：生成／配信／両方
  - `mail-test`：最新の DAILY をテスト送信
  - `force`：テスト用。日曜・停止中・生成済みでも実行します（AI の 1 日上限は守ります）
- 公開リポジトリの GitHub Actions は無料です。

**情報源**は `config/sources.json` にあります（arXiv、Hacker News、GitHub、Phys.org、ScienceDaily、Quanta、Knowable、PsyPost、MIT News、Dezeen、designboom、ArchDaily、Hackaday、Smithsonian、Public Domain Review、Atlas Obscura、Wikipedia、Reddit、ナゾロジー、カラパイア、GIGAZINE など）。どれか一つが取れなくても全体は止まりません。`enabled: false` で止める、行を足して増やす、ができます。X（旧 Twitter）の API には依存しません。X の投稿は、アプリの **DEEP → URL から掘る** で扱います。

**興味のキーワード**は `config/interests.json` です。合う記事の点数が少し上がります（7件のうち 5 件ほど）。「異物」と、日替わりの「探索枠」1 分野は、あえて興味から遠いものを選びます（およそ 興味 70〜80%：未知 20〜30%）。

**AI に渡す前の絞り込み**（コードで行う）：同一 URL・追跡パラメータ違い・類似タイトル・過去 180 日に扱ったもの・広告・PR・弱い記事（短すぎる・情報が少ない）・人事や株価だけのニュース・古すぎる記事を落とし、分野と情報源の偏りを抑えて約 30 件にします（50〜160 件 → 30 件 → AI で 14 件 → 7 件）。

---

## 7. メールのテスト

1. Secrets（`MAIL_USERNAME`・`MAIL_PASSWORD`・`MAIL_TO`）を登録します。
2. **Actions → PRINCIPLE LOOP Daily → Run workflow** → `mode` を **`mail-test`** にして実行します。
3. 1〜2 分で `[テスト] PRINCIPLE LOOP DAILY｜今日の7つの原理` が届きます。届かないときは迷惑メールフォルダも確認してください。
4. 失敗したときは、その実行のログを開くと理由が書いてあります（[10. トラブル対応](#10-トラブル対応)）。

AI もまとめて試すなら、`mode` を `all`、`force` にチェックを入れて実行します（今日の DAILY を作り直して送ります）。

---

## 8. 10日自動停止の仕組み

**目的**：使っていない間に、AI の無料枠・GitHub Actions・メールを無駄に使わないため。急かすための機能ではありません。

**「反応」に数えるもの**（アプリでの操作だけ）：記事を開く／掘る／☆面白い などを選ぶ／メモを書く／CONNECT を使う／EXPERIMENT を使う／アプリ内を移動して使う／「継続して使う」ボタン。
**数えないもの**：メールが届いたこと（メールを送っただけでは活動日を更新しません）。

**記録するデータ**は `public/data/activity.json` の 3 つだけです。何を読んだかなどの行動履歴は集めません。

```json
{ "lastActive": "2026-10-05T03:12:00.000Z", "inactivityDays": 0, "paused": false }
```

### アプリの反応を GitHub に伝える方法（いちばん単純・安全・無料な方法）

GitHub Pages は読み取り専用なので、ブラウザから直接ファイルを書き換えられません。そこで、

1. あなたが **「このリポジトリの Actions を動かすことだけ」ができるトークン** を作り、アプリの **設定 → GitHub 連携** に貼ります（そのブラウザの中だけに保存されます）。
2. アプリで反応があると、**1 日 1 回だけ**、そのトークンで `activity.yml` を起動します。
3. `activity.yml` が `activity.json` の `lastActive` を今の時刻にして保存します。

**トークンの作り方**（3 分）

1. GitHub の [Fine-grained token 作成画面](https://github.com/settings/personal-access-tokens/new) を開く
2. Token name：`principle-loop activity` など。Expiration：長め（期限が来たら作り直し）
3. **Repository access → Only select repositories → このリポジトリだけ**
4. **Permissions → Repository permissions → Actions：Read and write** だけ（Contents などは付けない）
5. 作ったトークン（`github_pat_…`）を、アプリの **設定 → GitHub 連携** に貼って「保存」→「接続テスト」

**安全性**

- このトークンでできるのは「このリポジトリのワークフローを動かすこと」だけです。コード・Secrets は読めず書けません。ワークフローは決まった処理しかせず、入力は `heartbeat` / `resume` だけを受け付けます。
- 万一漏れても、できるのは「活動の記録」「生成の手動実行」くらいで、生成は 1 日 1 回・AI は 1 日の上限つきです。不安なときは GitHub でトークンを削除すればすぐ無効になります。
- `<ユーザー名>.github.io` の下にある他のページとは保存場所（localStorage）が共有されるので、信頼できないページを同じアカウントの GitHub Pages に置かないでください。共有のパソコンでは設定しないでください。

**トークンを使わない場合（代わりの方法）**：GitHub の **Actions → PRINCIPLE LOOP Activity → Run workflow → `heartbeat`** を、10 日に 1 回押せば継続扱いになります。GitHub のスマホアプリからも押せます。

### 停止するとき

- 最後の反応から **10 日（240 時間）** たった深夜の処理で「PRINCIPLE LOOP PAUSED」になります。
- 止まるもの：深夜収集・AI 生成・DAILY 生成・朝のメール。毎日のワークフロー自体も無効にします。
- 停止した朝に **1 回だけ** 「PRINCIPLE LOOPを一時停止しました。再開したい場合はアプリから再開できます。」というメールを送ります。その後は何も送りません。
- 日数は Variables の `INACTIVITY_LIMIT_DAYS` で変えられます。

---

## 9. 再開のしかた

**アプリから**（GitHub 連携をしている場合）

1. アプリの **統計・アクティビティ**（ベルのアイコン）を開く
2. **「PRINCIPLE LOOPを再開」** を押す
   - 押すと：inactivity を 0・lastActive を今・paused を false にし、毎日のワークフローを有効に戻します。
   - 「再開後すぐに今日の生成とメール配信を試す」にチェックすると、すぐに 1 回動かします（日曜は動かしません）。
3. 1〜2 分で反映されます。チェックしなければ、次の 00:30 から通常運転です。

**GitHub から**（トークンなし）

1. **Actions → PRINCIPLE LOOP Activity → Run workflow** で `action` を **`resume`** にして実行
2. 念のため **Actions → PRINCIPLE LOOP Daily** が「disabled」になっていないか確認し、なっていれば **Enable workflow** を押す

---

## 10. 思考エンジンの構造

思考エンジンは人物由来の型だけを指します。現在は `OKADA`、`AKASEGAWA`、`MINAKATA`、`HAYASHI` に加え、既存の `OCHIAI`、`MATSUOKA`、`KONDO` を保持しています。`観察器変更`、`状態変化探索`、`知らない前提`、`深層掘削`、`反転` などはエンジンではなく、エンジンから選んで使う `operation / technique / lens` です。

ENGINES画面の「任意順序で組み合わせる」から、岡田だけ、岡田→南方、赤瀬川→岡田、南方→林、岡田→状態変化、岡田→知らない前提、岡田→深層掘削などを選べます。固定パイプラインではありません。API相当の純粋関数は `validPipeline`、`pipelineLabel`、`pipelineChatPrompt` です。

`NAKAJIMA FILTER` は人物エンジンとは別レイヤーです。「面白い」「微妙」「育てる」などの個人の反応を保存し、エンジンの定義や問いを書き換えません。既存の `engineIds`、DIARY、DAILY、localStorageデータはそのまま利用できます。

岡田エンジンには、必要なときだけ選べる深層掘削（現象・関係・機構・原因・機能・認知感情・情報・力資源）、状態変化探索（対象×条件→状態変化→新しい性質→再利用）、知らない前提、観測↔被観測のレンズを追加しています。毎回すべてを自動実行せず、人間が必要な段階だけ借ります。

## 11. LUHMANN SYSTEM（明示起動型の独立MVP）

LUHMANN SYSTEMは、岡田・南方・林・赤瀬川などと同列の通常エンジンではありません。通常はOFFで、`npm run luhmann -- --input="..."` を人間が明示的に実行したときだけ、与えた入力1件を処理します。DAILY、DIARY、MEMOを監視せず、結果を自動保存しません。

MVPは `ATOMIC → ABSTRACT → STRUCTURE → NEAR / STRUCTURAL / FAR / OPPOSITE / CAUSAL / CHAIN / TENSION / ANALOGY / INVERSION → BRIDGE → PATTERN → PRINCIPLE CANDIDATE → EMERGENCE` を1回のAPI呼び出しで依頼し、内部の探索結果を圧縮してJSONで返します。結果は一時結果です。

```bash
# OPENAI_API_KEY または既存のAI_API_KEYを環境変数に設定したうえで、明示起動
npm run luhmann -- --input="蜘蛛の巣"

# 保存も人間が明示した場合だけ行う（自動保存ではない）
npm run luhmann -- --input="NARUTOの影分身" --out=/tmp/luhmann-result.json
```

プロバイダーは既存の `AI_PROVIDER` / `AI_MODEL` / `AI_BASE_URL` を使え、LUHMANN専用に `LUHMANN_PROVIDER` / `LUHMANN_MODEL` / `LUHMANN_BASE_URL` で上書きできます。内部結果には接続種別、距離、構造適合度、新規性、説明力、生成力、信頼度を含めます。AIの原理は断定せず、候補として扱います。

コードは `src/systems/luhmann/` に分離し、既存の `scripts/run.ts`、DAILY、DIARY、AUTOの通常経路から呼びません。

## 12. PRINCIPLE LOOP AUTO（7日間限定の実験）

`PRINCIPLE LOOP AUTO` は、当日のDAILYだけを起点に、岡田エンジン → 南方コレクター → 林フィルター → JIMA FILTER の順で、BEST / FAR / WILD の3案と各1枚のコンセプト画像を作ります。1日3案・3画像、合計21画像を上限にし、初回の正常生成日を DAY 1 として8日目以降はOpenAI APIを呼びません。既存のDAILY処理とは別ワークフローです。

### 最初の設定

1. [OpenAI Platform](https://platform.openai.com/) でアカウントを作り、Billing で支払い方法と利用上限を設定します。料金・モデルの最新情報は [公式 Pricing](https://openai.com/api/pricing/) と Usage 画面で確認してください。料金は変更されるため、このREADMEでは固定額を断定しません。
2. API key を作成し、リポジトリの **Settings → Secrets and variables → Actions → New repository secret** に、値を表示せず `OPENAI_API_KEY` として登録します。ソース、Pages、JSON、ログにはキーを書きません。
3. **Actions → PRINCIPLE LOOP AUTO → Run workflow** を選び、まず手動実行します。`dry_run` はAPIを呼んでファイルを書かない確認用です。最初は通常実行を1回だけ行い、ActionsログとOpenAI Usageで確認してください。
4. 使用モデルは Variables の `AUTO_TEXT_MODEL`（既定 `gpt-5-mini`）、`IMAGE_MODEL`（既定 `gpt-image-1`）、`IMAGE_QUALITY`（既定 `low`）で変更できます。画像APIには `OPENAI_API_KEY` だけを渡し、ブラウザには渡しません。

### cron を開始する

手動テスト、生成結果、利用額を確認した後、Repository Variables に `AUTO_CRON_ENABLED=true` を追加します。AUTOは `PRINCIPLE LOOP Daily` の成功完了後だけ起動するため、DAILY更新 → AUTOの順になります。重複実行は日付ファイルと concurrency で防ぎます。

### 状態・停止・終了レポート

- 現在のDAYは `experiment/auto-idea-experiment.json` の `experimentDay1` と当日の日付から計算されます。画像数は `totalImages`、API呼び出し数は `totalTextCalls` / `totalImageCalls` です。
- 緊急停止は Actions で `PRINCIPLE LOOP AUTO` を Disable し、必要なら `OPENAI_API_KEY` の Secret を削除またはローテーションします。コード側も `MAX_EXPERIMENT_DAYS=7`、`MAX_DAILY_IMAGES=3`、`MAX_TOTAL_IMAGES=21`、`MONTHLY_BUDGET_JPY=1500` を上限として二重チェックします。
- 8日目以降、または上限到達後は `7-day experiment completed` をログに残して終了します。画像生成の途中で止まっても、既存画像は再生成せず未生成分だけを処理します。
- 7日後の **7-DAY REPORT** は、保存された `public/data/auto-ideas/*.json`、画像数、`feedback/jima-filter.json`（同期運用時）を材料に人間が作成します。API利用額は推定値ではなく OpenAI Usage の実測値を採用します。

### 保存とJIMA FILTER

案は `public/data/auto-ideas/YYYY-MM-DD.json`、画像は `public/data/auto-images/YYYY-MM-DD-{best,far,wild}.webp` に保存します。DAILY画面の「👍 面白い」「👎 微妙」「★ 育てる」はブラウザの既存localStorage方式で保存され、人物由来モジュールとは混ぜません。

## 13. トラブル対応

| 症状 | 確認すること |
| --- | --- |
| アプリが開かない（404） | Settings → Pages の Source が「GitHub Actions」か。Actions の **Deploy GitHub Pages** が成功しているか |
| Pages の公開が「Get Pages site failed」で失敗 | Pages がまだ有効になっていません。Source を「GitHub Actions」にしてから再実行 |
| DAILY が更新されない | Actions → PRINCIPLE LOOP Daily の履歴。日曜？ 一時停止中？（アプリのベルに点が付く）。`mode=status` で状態を確認 |
| 「AI未設定のため仮のテンプレート」と出る | `AI_API_KEY` が登録されているか。名前の打ち間違い |
| 記事に「作成中止」と出る | AI の分析を作れなかった記事です（AI の混雑・1日の上限・返答が途中で切れた など。理由は画面とメールに出ます）。仮の文章では埋めず、情報源の要約だけを表示します。その場で 1 回頼み直し、それでもだめなら 03:10 の再試行で作り直します。手動で直すときは Actions → PRINCIPLE LOOP Daily を `mode=generate` で実行（生成済みの日は作成中止の記事だけを作り直します） |
| AI のエラー 429 | 無料枠の回数制限。少し待てば回復します。続くなら `AI_MODEL` を無料枠の別モデルに |
| AI のエラー 404 / 400 | モデル名が古い可能性。[モデル一覧](https://ai.google.dev/gemini-api/docs/models) で無料枠のモデル名を確認して `AI_MODEL` に |
| 「候補が○件しかありません」 | 情報源の取得に失敗。`mode=collect` で各情報源の ✓/✗ を確認し、`config/sources.json` を直す |
| メールが届かない（535 authorization failed） | Yahoo!メールから送っている場合は、海外からのアクセス制限で断られている可能性が高いです。[4-A](#a-gmail-から送るおすすめ確実) の Gmail に切り替えてください。Gmail で失敗する場合は、アプリ パスワードと `MAIL_HOST=smtp.gmail.com` を確認 |
| メールが届かない（エラーなし） | 迷惑メールフォルダ。`MAIL_TO` のアドレス |
| 「メールの Secrets が未設定」 | `MAIL_USERNAME`・`MAIL_PASSWORD`・`MAIL_TO` の 3 つすべてが必要 |
| アプリの「接続テスト」が失敗 | 401：トークンの期限切れ・貼り間違い。403：Actions の Read and write が付いていない。404：リポジトリ名の違い、または activity.yml が main にない |
| 反応しているのに止まった | GitHub 連携の設定がこの端末にあるか（端末ごとに必要）。設定画面の「活動通知」がオンか |
| 毎日のワークフローが「disabled」になった | 一時停止で自動的に止めたか、公開リポジトリで 60 日間リポジトリに動きがなかったため GitHub が止めた。再開の手順で戻せます |
| git push に失敗（保存できない） | Settings → Actions → General → Workflow permissions が「Read and write」か。main にブランチ保護がある場合は bot の push を許可 |
| DIARY が消えた | ブラウザのデータ削除・別ブラウザ。定期的に **DIARY → バックアップ** を。読み込みで戻せます |
| 新しい版にしたら DIARY の段階の名前が変わった | 「原理を確定させない」方針で段階の呼び名を変えました（[個人データと互換性](#個人データと互換性)）。元の段階は詳細画面に「前の版での段階」として出ます。元のデータそのものはブラウザの `principle-loop.personal.v1.backup` に残っています |
| DIARY に「アーカイブ」したものが見えない | 標準ではアーカイブ以外を表示します。DIARY の絞り込みで「× アーカイブ」または「全部」を選んでください |

---

## 14. 完了条件

| 条件 | 状態 | どこで |
| --- | --- | --- |
| DAILY に7件表示 | ✅ | `src/views/Daily.tsx` |
| 月〜土運用・日曜完全停止 | ✅ | cron `0-5` ＋ `decideRun`（テストあり） |
| 00:30 以降に処理開始・07:00〜08:00 配信 | ✅ | `principle-loop-daily.yml` |
| DAILY → LIGHT DEEP（3行）→ HUMAN SELECT → DIARY | ✅ | `src/views/LightDeep.tsx`, `src/shared/light-deep.ts`, `src/components/loop.tsx` |
| 深掘りを選んだときだけ FULL DEEP（7つの質問） | ✅ | `src/views/Deep.tsx`, `src/shared/questions.ts` |
| DIARY：時系列・種類の拡張・MEMO／気づきのすばやい入力・絞り込み | ✅ | `src/views/Diary.tsx`, `src/lib/diary-model.ts`, `src/data/store.ts` |
| 既存の localStorage を壊さない（v1 → v2 の移行・バックアップ） | ✅ | `src/lib/diary-model.ts`（テストあり） |
| 思考エンジン（選択式・複数可・自動実行なし）と ENGINES 画面 | ✅ | `src/engines/`, `src/views/Engines.tsx` |
| CORE LOCK・メディア選択・TOOLCHAIN / CAPABILITY | ✅ | `src/shared/loop.ts`, `src/components/loop.tsx` |
| CONNECT | ✅ | `src/views/Connect.tsx`, `src/lib/connect.ts` |
| EXPERIMENT（旧 BUILD）・結果を DIARY へ戻す | ✅ | `src/views/Build.tsx`, `src/lib/experiment.ts`, `src/lib/diary-model.ts` |
| Claude Code 用・Codex 用プロンプト出力（自動実行なし） | ✅ | コピーのみ |
| 日常運転で Claude Code / Codex を使わない | ✅ | Actions ＋ Node.js ＋ 無料枠 AI |
| メール配信（Yahoo!メール宛て。送信は Gmail か Yahoo!） | ✅ | `scripts/mail/` |
| GitHub Pages・GitHub Actions 対応 | ✅ | `.github/workflows/` |
| 無料運用・AI Provider 交換可能・Secrets 管理 | ✅ | `src/ai/`, Secrets |
| レスポンシブ（PC は左サイドバー・スマホは下部タブ） | ✅ | `src/styles/global.css` |
| 過去原理の保存・検索 | ✅ | `public/data/daily/`, `archive/`, 検索画面 |
| 10日無反応で自動停止・停止後は収集/AI/メールすべて停止 | ✅ | `src/shared/activity.ts`（テストあり） |
| ユーザー操作で簡単に再開 | ✅ | ACTIVITY 画面の再開ボタン／Actions |
| README | ✅ | この文書 |

---

## 15. 開発者向けメモ

```
src/                 アプリ（Vite + React + TypeScript）
  views/             DAILY・READ・LIGHT DEEP / FULL DEEP・DIARY・CONNECT・EXPERIMENT（Build.tsx）・ENGINES・ACTIVITY・SETTINGS・SEARCH
  components/loop.tsx  HUMAN SELECT・MEMO・LIGHT DEEP の3行・思考エンジン・CORE LOCK・メディアの部品
  engines/           思考エンジンのデータ（本体とは分けてある）と TRANSFORM の操作
  data/              データ層（公開 JSON の読み込み・個人データ・活動通知）※同期を足すならここ
  lib/               画面に依存しないロジック（DIARY のモデルと移行・検索・CONNECT・実験設計・プロンプト）
  shared/            アプリと夜間処理で共通（型・カテゴリ・LIGHT DEEP・循環のことば・7つの質問・日本時間・10日停止の判定）
  ai/                AI Provider（gemini / openai-compatible / mock）※夜間処理だけが使う
scripts/             夜間処理（Node.js。TypeScript をそのまま実行）
  run.ts             入口（generate / mail / all / mail-test / collect / status）
  activity.ts        heartbeat / resume
  collect/ filter/ generate/ mail/
config/              情報源・興味・上限値
public/data/         公開データ（daily / archive / activity.json）
state/run-state.json 二重実行を防ぐための記録（最終生成日・最終配信日・AI の使用回数）
tests/               node:test のテスト（tests/fixtures は架空のテスト用フィード）
```

```bash
npm run check                                   # 型チェック + テスト + ビルド + 公開ファイル確認
npm run collect -- --fixtures                   # ネットにつながず収集と絞り込みを試す
node scripts/run.ts --mode=generate --fixtures --date=2026-10-05 --dry-run   # 生成を試す（書き込みなし）
node scripts/run.ts --mode=status               # 状態を見る
```

- データの形（DAILY の 1 件）は `src/shared/types.ts` の `DailyItem`。新しい日は `lightDeep`（3行）が中心で、`principleCandidate` には「構造」の行が入ります（索引・検索・CONNECT 用）。古い日は長い分析（`inputTypes`・`boundary` など）を持ち、3行は `getLightDeep()` がその場で補います。
- DIARY の 1 件は `DiaryEntry`（`type`・`state`・`userDecision`・`engineIds`・`coreLock`・`media`・`tools`・`parentId`・`sourceId`・`derivedFrom`・`experimentId` など）。`userDecision`（人間の判断）は AI の点数（`transferability`）とは別に持ちます。
- アプリのルートは `#/deep?id=…`（LIGHT DEEP）、`#/deep?id=…&mode=full`（FULL DEEP）、`#/experiment`（`#/build` も引き続き開けます）、`#/engines?id=okada`。
- 事実と AI の解釈を分けるため、出典の URL・タイトル・日付は AI に書かせず、収集したデータから入れています。
- 依存パッケージは最小限です（react・react-dom・nodemailer、開発用に vite・typescript など）。RSS の読み込みも自前です。
