# 配置作成プログラム

職員・モダリティ・当番表・休暇・配置表を管理する Web アプリです。

## 技術スタック

- React (Vite)
- Tailwind CSS

## セットアップ

```bash
npm install
npm run dev
```

## Git で新規プロジェクトとして保存する手順

プロジェクトフォルダ（あああ）で **コマンドプロンプト** または **Git Bash** を開き、次を順に実行してください。

### 1. リポジトリの初期化と初回コミット

```bash
cd "C:\Users\yohei\Desktop\あああ"
git init
git add .
git commit -m "Initial commit: 配置作成プログラム"
```

### 2. リモートへ送信（GitHub など）

1. GitHub で新しいリポジトリを作成（空のリポジトリで OK）
2. 以下を実行（`YOUR_USERNAME` と `REPO_NAME` を自分のリポジトリに置き換え）

```bash
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

SSH を使う場合:

```bash
git remote add origin git@github.com:YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

以上で、ローカルとリモートの両方に保存されます。
