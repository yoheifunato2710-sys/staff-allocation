# 配置作成プログラム

職員・モダリティ・当番表・休暇・配置表を管理する **Electron デスクトップアプリ** です。

## 技術スタック

- Electron
- React (Vite)
- Tailwind CSS

## 開発者向けセットアップ

```bash
npm install
npm run dev
```

Vite の開発サーバーと Electron ウィンドウが起動します。

## 配布用ビルド（Windows インストーラー）

```bash
npm run build
```

`release/` フォルダに `.exe` インストーラーが生成されます。  
他の PC では Node.js 等の環境構築は不要で、インストーラーを実行するだけで利用できます。

> **注意**: コード署名証明書がない場合、初回起動時に Windows SmartScreen の警告が出ることがあります。「詳細情報」→「実行」で進められます。社内配布で警告を減らしたい場合は、将来コード署名証明書の導入を検討してください。

インストーラーを作らず動作確認だけする場合:

```bash
npm run build:dir
```

## プロジェクト構成（改修の入口）

| パス | 役割 |
|------|------|
| `electron/main.cjs` | Electron メインプロセス（ウィンドウ起動・本番読み込み） |
| `electron/preload.cjs` | レンダラーとメインプロセスの安全な橋渡し |
| `utils/storage.js` | localStorage のキー定義・読み書き（データ変更はここから） |
| `utils/backup.js` | バックアップの作成・復元 |
| `utils/holidays.js` | 祝日計算（全画面共通） |
| `utils/weeklyOff.js` | 週休データの正規化・参照 |
| `utils/csv.js` | 職員・モダリティの CSV 出力 |
| `context/DataContext.jsx` | 職員・モダリティの状態管理とバックアップ API |
| `screens/` | 各画面 UI |

データの保存キーは `utils/storage.js` の `STORAGE_KEYS` に集約しています。

## データのバックアップ

メインメニュー左下から、全データまたは職員・モダリティのみを JSON で保存・復元できます。

職員・モダリティ画面では **CSV出力** ボタンから Excel 等で開けるファイルをダウンロードできます。

アプリを終了する前にバックアップを取得してください（終了時に確認ダイアログが表示されます）。
