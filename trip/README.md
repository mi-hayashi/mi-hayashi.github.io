# 社員旅行ミッション管理システム 🎯

チーム別のミッション達成報告を簡単に管理できるWebアプリケーションです。
HTML/CSS/JavaScriptのみで動作し、GitHub Pagesなどの静的ホスティングで利用できます。

## ✨ 主な機能

### 参加者向け機能
- 🔐 **チームパスワード認証**: チーム専用パスワードで安全にログイン
- 🔄 **チーム変更機能**: 間違えた場合は管理者パスワードで変更可能
- 🔒 **データ分離**: 自チームの報告のみ閲覧可能(他チームの進捗は見えない)
- 📷 **写真・動画アップロード**: 複数枚の写真や動画(10MB以下)を選択
- ✅ **ミッション選択**: 達成したミッションをチェックボックスで選択
- 📊 **進捗確認**: 自チームの達成状況をリアルタイム表示
- 📜 **履歴閲覧**: 自チームの過去の報告を確認可能
- 📡 **GitHub Issues連携**: QRコードでトークン設定、クラウドに自動バックアップ

### 管理者向け機能(別ページ)
- 🎖️ **専用ダッシュボード**: `admin.html`で全チームの進捗状況を確認
- 📈 **統計情報**: 全体進捗率、完了チーム数を表示
- 📸 **全報告閲覧**: すべてのチームの報告を時系列で確認
- 🗑️ **報告削除**: LocalStorageの報告を削除可能

## 🚀 セットアップ手順

### 必須ファイル
- `index.html` - 参加者用チーム報告ページ
- `admin.html` - 管理者用ダッシュボード
- `app.js` - 参加者用ロジック
- `admin.js` - 管理者用ロジック
- `config.js` - チーム設定・パスワード設定
- `styles.css` - スタイル
- `img/` フォルダ - チームロゴ画像

### GitHub連携の準備(オプション)

#### 1. GitHub Personal Access Token取得
1. GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
2. **Generate new token (classic)**
3. Note: `mission-app-token` (任意)
4. Expiration: カスタム(旅行終了日まで)
5. **Scopes**: `repo`, `workflow` にチェック
6. **Generate token**
7. トークンをコピー(例: `ghp_xxxxxxxxxxxxx`)

#### 2. GitHub Secretsに保存
1. リポジトリ > Settings > Secrets and variables > Actions
2. **New repository secret**
3. Name: `XXXX_TOKEN`
4. Secret: コピーしたトークンを貼り付け
5. **Add secret**

#### 3. GitHub Actions Workflowを作成
- `.github/workflows/create_issue.yml` を作成(すでにある場合はスキップ)

#### 4. トークンQRコード作成
1. `setup-token.html` をブラウザで開く
2. トークンを入力してQRコード生成
3. スクリーンショット保存
4. 参加者に配布(初回アクセス時にスキャン)

### 方法1: GitHub Pages(推奨)

1. **GitHubリポジトリを作成**
   ```
   リポジトリ名: mi-hayashi.github.io (任意)
   Public推奨
   ```

2. **ファイルをアップロード**
   - すべてのファイルをルートにアップロード

3. **GitHub Pagesを有効化**
   - Settings > Pages
   - Source: Deploy from a branch
   - Branch: main / root
   - Save

4. **アクセス**
   - 参加者用: `https://あなたのユーザー名.github.io/index.html`
   - 管理者用: `https://あなたのユーザー名.github.io/admin.html`

### 方法2: その他の静的ホスティング

- **Netlify**: ドラッグ&ドロップでデプロイ
- **Vercel**: GitHubリポジトリを連携
- **Firebase Hosting**: `firebase deploy`
- **サーバー**: ファイルをアップロードするだけ

## ⚙️ カスタマイズ方法

### チーム設定を変更

`config.js`を編集:

```javascript
teams: [
    {
        id: 1,
        name: 'うずしおぷくぷくチーム',
        password: 'uzushio2025',  // チーム専用パスワード
        logo: 'img/uzusiopukupuku.png',
        icon: '🌀',
        missions: [
            'バスの中で隣の人と写真を撮る',
            'たこせんべいの里で限定商品を見つける',
            // ... 15個のミッション
        ]
    },
    // 6チーム分設定
],
```

### パスワード一覧(変更推奨)

| チームID | チーム名 | パスワード |
|---------|---------|-----------|
| 1 | うずしおぷくぷくチーム | `uzushio2025` |
| 2 | たまねぎバスターズ | `tamanegi2025` |
| 3 | なると金時レンジャー | `naruto2025` |
| 4 | おっきな橋のポーズ隊 | `hashi2025` |
| 5 | 海風ひゅるるんズ | `umikaze2025` |
| 6 | とくしまニコニコ団 | `nikoniko2025` |
| 管理者 | 管理者ページ | `kanri2025` |

### 達成条件を変更

```javascript
requiredReports: 15,  // 各チーム15個のミッション
```

### GitHub連携設定

```javascript
github: {
    enabled: true,  // GitHub連携ON/OFF
    repo: 'mi-hayashi/mi-hayashi.github.io',  // リポジトリ名
    token: '',  // 空欄でOK(QRコードから入力)
}
```

## 📱 使い方

### 準備(幹事・管理者)

1. **QRコード作成**
   - 参加者用: `index.html`のURL → QRコード化
   - 管理者用: `admin.html`のURL → QRコード化(管理者のみ配布)
   - トークン用: `setup-token.html`でGitHubトークンのQRコード作成

2. **しおりに印刷**
   - 各チームページに自チームのパスワードを記載
   - 参加者用QRコードを全ページに掲載
   - トークンQRコードを全ページに掲載

### 参加者

1. **初回アクセス**
   - しおりのQRコードをスキャン → `index.html`へ
   - GitHubトークンQRをスキャン(カメラまたは画像アップロード)

2. **チーム選択**
   - 自分のチームカードをタップ
   - しおりに記載されたチーム専用パスワードを入力
   - 認証成功 → 以降は自動ログイン

3. **ミッション報告**
   - 達成したミッションにチェック
   - 写真または動画を選択(複数OK)
   - コメント入力(任意)
   - 「✅ 達成報告を送信」ボタン

4. **進捗確認**
   - 報告履歴で自チームの過去の報告を閲覧
   - 📡マークはGitHub Issuesに保存されたデータ

5. **チーム変更(間違えた場合)**
   - 「🔄 チーム変更」ボタンをタップ
   - 管理者を呼んで管理者パスワード(`kanri2025`)を入力してもらう
   - ロックイン解除 → 正しいチームを選び直す

### 管理者

1. **管理者ページアクセス**
   - 管理者専用QRコード → `admin.html`へ
   - GitHubトークンQRをスキャン(初回のみ)
   - パスワード `kanri2025` でログイン

2. **全体確認**
   - 全チームの進捗率をリアルタイム表示
   - 各チームの報告数と達成状況
   - 全報告の時系列リスト

3. **トラブル対応**
   - LocalStorage保存の報告は削除可能
   - GitHub Issues保存の報告は削除不可(GitHub上で手動削除)
   - **チーム変更**: 参加者がチーム間違えた場合、管理者パスワードでロックイン解除

## 💾 データ保存について

### 二重保存システム

#### LocalStorage(標準・必須)
- ブラウザのLocalStorageに即座に保存
- **画像・動画も含む完全なデータ**
- インターネット接続不要で動作
- ブラウザのデータを消すと消える
- デバイス間で共有されない
- 容量: 約5-10MB(ブラウザ依存)

#### GitHub Issues(オプション・推奨)
- GitHubのIssuesにクラウドバックアップ
- **画像もBase64形式で保存**(動画は容量制限で除外)
- インターネット接続が必要
- GitHub Actions経由で安全に保存
- チーム別ラベル(`team-1`など)で自動分類
- 全デバイスから閲覧可能

### セキュリティ設計

#### チーム間データ分離
- **LocalStorage**: チームID(`lockedTeamId`)でフィルタリング
- **GitHub Issues**: チームラベル(`team-{id}`)でフィルタリング
- パスワード認証後は他チームのデータ一切取得しない

#### 管理者のみ全体閲覧
- `admin.html`は全チームのラベルを取得
- パスワード`kanri2025`で保護
- LocalStorage + GitHub Issues両方から統合表示

### データのバックアップ方法

#### LocalStorageエクスポート
ブラウザの開発者ツール(F12)で:
```javascript
// データをエクスポート
const data = localStorage.getItem('missionReports');
console.log(data);  // コピーして保存

// データをインポート
localStorage.setItem('missionReports', 'ここに貼り付け');
```

#### GitHub Issuesバックアップ
- リポジトリのIssuesタブで全データ確認
- ラベル`mission-report`でフィルタ
- JSON形式でエクスポート可能

## 🎨 デザインカスタマイズ

`styles.css`の`:root`セクションで色を変更:

```css
:root {
    --primary: #4a90e2;     /* メインカラー */
    --success: #52c41a;     /* 成功カラー */
    --warning: #faad14;     /* 警告カラー */
    --danger: #f5222d;      /* 危険カラー */
}
```

## 📝 仕様

### 対応ブラウザ
- Chrome/Edge/Safari/Firefox (最新版)
- スマートフォン対応(レスポンシブデザイン)
- QRコードスキャン: カメラ対応ブラウザ必須

### データ制限
- **LocalStorage容量**: 約5-10MB(ブラウザ依存)
- **画像**: 自動的に800px以内にリサイズ、JPEG品質70%
- **動画**: 10MB以下(それ以上はエラー)
- **1報告あたり**: 複数枚の写真・動画OK(合計容量に注意)

### セキュリティ
- **チームパスワード認証**: 初回アクセス時のみ
- **ロックイン機能**: 一度選択したチームから変更不可(管理者パスワードで解除可能)
- **チーム変更救済**: 間違えた場合は幹事が管理者パスワードで変更許可
- **データ分離**: 自チームのデータのみ閲覧
- **管理者ページ**: 別URLでパスワード保護
- **GitHubトークン**: LocalStorageに保存、ソースコードには含まない
- **GitHub Actions**: workflow_dispatch経由で安全にIssue作成
- **HTTPS推奨**: GitHub Pagesは自動的にHTTPS

### アーキテクチャ
- **フロントエンド**: Pure HTML/CSS/JavaScript (フレームワーク不使用)
- **データストア**: LocalStorage + GitHub Issues API
- **認証**: クライアントサイドパスワード(簡易版)
- **画像処理**: Canvas API (ブラウザネイティブ)
- **QRコード**: html5-qrcode@2.3.8 ライブラリ
- **GitHub連携**: REST API v3 + GitHub Actions

### ファイル構成
```
trip/
├── index.html          # 参加者用メインページ
├── admin.html          # 管理者用ダッシュボード
├── app.js              # 参加者用ロジック (984行)
├── admin.js            # 管理者用ロジック
├── config.js           # チーム設定・パスワード設定
├── styles.css          # 共通スタイル
├── setup-token.html    # トークンQRコード生成ページ
├── README.md           # このファイル
├── img/                # チームロゴ画像フォルダ
│   ├── uzusiopukupuku.png
│   ├── tamanegibaster.png
│   └── ...
└── .github/
    └── workflows/
        └── create_issue.yml  # GitHub Actions定義
```

## 🔧 トラブルシューティング

### 写真が送信できない
- **原因1**: LocalStorage容量不足
  - 解決: ブラウザのキャッシュクリア、または枚数を減らす
- **原因2**: 画像サイズが大きすぎる
  - 解決: 自動リサイズされるが、元が極端に大きいとエラー

### 動画が送信できない
- **原因**: 10MB制限超過
  - 解決: 動画を短くする、または圧縮アプリで小さくする

### QRコードがスキャンできない
- **カメラ起動失敗**: ブラウザのカメラ権限を許可
- **読み取れない**: 明るい場所で、QRコード全体を画面に収める
- **PC使用時**: 「🖼️ QRコード画像をアップロード」ボタンでスクリーンショットをアップロード

### パスワードを忘れた
- **チームパスワード**: 管理者に確認(config.jsに記載)
- **管理者パスワード**: config.jsの`adminPassword`を確認

### データが消えた
- **LocalStorage**: ブラウザのキャッシュクリアで消える
  - 予防: GitHub Issues連携を有効化
  - 復旧: GitHub Issuesから再取得(ページリロード)
- **GitHub Issues**: 削除しない限り永続保存

### GitHub連携がうまくいかない
- **401 Unauthorized**: トークンの有効期限切れ、または権限不足
  - 解決: 新しいトークンを生成し直す(`repo`, `workflow`権限)
- **404 Not Found**: リポジトリ名が間違っている
  - 解決: config.jsの`github.repo`を確認
- **Issues作成されない**: GitHub Actions Workflowが動いていない
  - 解決: `.github/workflows/create_issue.yml`が存在するか確認
  - リポジトリのActionsタブでエラー確認

### チームが変更できない
- **仕様です**: セキュリティのため、一度認証したら勝手に変更不可
- **間違えた場合の解決方法**:
  1. 幹事・管理者を呼ぶ
  2. 参加者の端末で「🔄 チーム変更」ボタンをタップ
  3. 管理者パスワード `kanri2025` を入力
  4. ロックイン解除 → 正しいチームを選択
- **緊急の場合**: LocalStorageをクリアして再アクセス
  ```javascript
  localStorage.removeItem('lockedTeamId');
  localStorage.removeItem('selectedTeamId');
  location.reload();
  ```

### 他チームのデータが見える
- **バグの可能性**: ブラウザのConsole(F12)でエラー確認
  - `lockedTeamId`が正しく設定されているか
  - GitHub API呼び出しのラベルフィルタが正しいか

## 🎉 楽しい社員旅行を!

### デバッグ方法
開発者ツール(F12)のConsoleで詳細ログを確認:
```
📦 LocalStorageレポート数: X (チームYのみ)
🔄 GitHub Issuesから取得開始...
🌐 GitHub API呼び出し: https://api.github.com/...
📝 取得したIssue数: X
🔍 Issue解析中: 【チーム名】...
✅ レポート解析成功: チーム名 2025/XX/XX XX:XX:XX
📊 解析完了 - 有効なレポート数: X
✅ 統合完了 - ローカル: X, GitHub: Y, 追加: Z, 合計: W
```

### 旅行終了後の片付け

1. **GitHubトークン削除**
   - GitHub > Settings > Developer settings > Personal access tokens
   - 該当トークンを **Revoke** (無効化)

2. **LocalStorageクリア** (任意)
   ```javascript
   localStorage.clear();
   ```

3. **GitHub Issuesアーカイブ** (任意)
   - Issuesを全てCloseして記録として残す

### カスタマイズ例

#### チーム数を変更
`config.js`の`teams`配列に追加・削除

#### ミッション数を変更
各チームの`missions`配列と`requiredReports`を調整

#### デザイン変更
`styles.css`の`:root`変数を変更

#### 動画サイズ制限変更
`app.js`と`admin.js`の`maxSize`を変更(デフォルト10MB)

---

## 📄 ライセンス

MIT License - 自由に使用・改変可能です

---

**製作者へ**: このシステムは完全にクライアントサイドで動作します。サーバー不要で、コストもかかりません!

**参加者へ**: 楽しい思い出をたくさん残してください! 📸✨
