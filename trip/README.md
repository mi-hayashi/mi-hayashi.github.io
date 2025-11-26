# 社員旅行ミッション管理システム 🎯

チーム別のミッション達成報告を簡単に管理できるWebアプリケーションです。
HTML/CSS/JavaScriptのみで動作し、GitHub Pagesなどの静的ホスティングで利用できます。

## ✨ 主な機能

### 参加者向け機能
- 📱 **チーム選択**: 自分のチームを選んで報告画面へ
- 📷 **写真アップロード**: 複数枚の写真を選択してプレビュー表示
- ✏️ **コメント入力**: 任意でコメントを追加可能
- 📊 **進捗確認**: チームの達成状況をリアルタイム表示
- 📜 **履歴閲覧**: 過去の報告を確認可能

### 管理者向け機能
- 🎖️ **ダッシュボード**: 全チームの進捗状況を一目で確認
- 📈 **統計情報**: 全体進捗率、完了チーム数を表示
- 📸 **全報告閲覧**: すべてのチームの報告を時系列で確認

## 🚀 セットアップ手順

### 方法1: GitHub Pages(推奨)

1. **GitHubリポジトリを作成**
   ```
   リポジトリ名: mission-app (任意)
   Public/Private: どちらでもOK
   ```

2. **ファイルをアップロード**
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`
   - `README.md`

3. **GitHub Pagesを有効化**
   - リポジトリの Settings > Pages
   - Source: Deploy from a branch
   - Branch: main / root
   - Save

4. **アクセス**
   - `https://あなたのユーザー名.github.io/リポジトリ名/`

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
        name: 'チーム赤',
        icon: '🔴',
        mission: '会場の名所3箇所で記念撮影'
    },
    // 追加・編集・削除
],
```

### 達成条件を変更

```javascript
requiredReports: 3,  // 必要な報告回数
```

### 管理者パスワードを変更

```javascript
adminPassword: 'kanri2025',  // お好きなパスワードに変更
```

### GitHub連携(オプション)

LocalStorage以外にGitHub Issuesにもバックアップしたい場合:

1. **Personal Access Tokenを取得**
   - GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
   - Generate new token
   - `repo`スコープにチェック
   - トークンをコピー

2. **config.jsを編集**
   ```javascript
   github: {
       enabled: true,
       repo: 'yourname/mission-app',
       token: 'ghp_xxxxxxxxxxxx',  // 取得したトークン
   }
   ```

⚠️ **注意**: トークンは公開リポジトリに含めないでください!

## 📱 使い方

### 参加者

1. URLにアクセス
2. 自分のチームを選択
3. 写真を選んで送信ボタンをタップ
4. 達成!

### 幹事(管理者)

1. トップページで「🔑 管理者ページ」をクリック
2. パスワードを入力してログイン
3. 全チームの進捗を確認

## 💾 データ保存について

### LocalStorage(標準)
- ブラウザのLocalStorageに保存
- インターネット接続不要で動作
- ブラウザのデータを消すと消える
- デバイス間で共有されない

### GitHub Issues(オプション)
- GitHubのIssuesにバックアップ保存
- 画像はLocalStorageのみ
- インターネット接続が必要

### データのバックアップ方法

ブラウザの開発者ツール(F12)で:
```javascript
// データをエクスポート
const data = localStorage.getItem('missionReports');
console.log(data);  // コピーして保存

// データをインポート
localStorage.setItem('missionReports', 'ここに貼り付け');
```

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

### データ制限
- LocalStorage容量: 約5-10MB(ブラウザ依存)
- 画像は自動的に800px以内にリサイズ
- 1報告あたり複数枚の写真OK

### セキュリティ
- 管理者ページはパスワード保護
- データはクライアント側に保存
- HTTPS推奨

## 🔧 トラブルシューティング

### 写真が送信できない
- ブラウザのLocalStorage容量を確認
- 画像サイズが大きすぎる場合は枚数を減らす

### データが消えた
- ブラウザのキャッシュクリアで消える可能性があります
- 定期的にバックアップ推奨

### GitHub連携がうまくいかない
- トークンの権限を確認
- リポジトリ名が正しいか確認
- インターネット接続を確認

## 📄 ライセンス

MIT License - 自由に使用・改変可能です

## 🎉 楽しい社員旅行を!

何か問題があれば、開発者ツール(F12)のConsoleでエラーを確認してください。

---

**製作者へ**: このシステムは完全にクライアントサイドで動作します。サーバー不要で、コストもかかりません!
