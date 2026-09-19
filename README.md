# Brain Training

暗算の回答タイムを計測・分析・共有する脳トレアプリです。現在は、アプリ開発とGitHub Pagesへのデプロイに必要な基盤を提供しています。

## 使用技術

- Vue 3 / TypeScript / Vite
- Vue Router（Hash History）/ Pinia
- Vuetify / Material Design Icons SVG（`@mdi/js`）
- VueUse
- Vite PWA Plugin
- Vitest / Playwright
- ESLint / Oxlint / Prettier
- GitHub Actions / GitHub Pages

## 必要環境

Node.jsのバージョン管理に[Volta](https://volta.sh/)を使用します。このプロジェクトで使用するNode.jsの正確なバージョンは、`package.json`の`volta.node`に固定されています。Voltaをインストールした環境で以下を実行してください。

## セットアップ

```sh
npm install
npx playwright install
```

## 主なコマンド

```sh
# 開発サーバー
npm run dev

# TypeScriptチェック
npm run type-check

# 本番ビルド
npm run build

# 単体テスト
npm run test:unit

# E2Eテスト
npm run test:e2e

# lint
npm run lint

# フォーマット
npm run format
```

## GitHub Pages

公開先は <https://tatsuya0903.github.io/brain-training/> です。Viteの`base`、PWAのmanifest / Service Worker、Playwrightはすべて`/brain-training/`配下に合わせています。

GitHub PagesでのSPAの直接アクセスや再読み込み時の404を避けるため、Vue RouterはHash Historyを使用しています。そのため、将来の結果画面のURLも`/brain-training/#/...`形式で共有できます。

`.github/workflows/deploy.yml`は`main`へのpushまたは手動実行で`dist`をビルドし、GitHub公式Pages Actionsでデプロイします。初回デプロイ前に、リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。
