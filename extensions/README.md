# CORE Chrome 拡張機能 (Phase 1 MVP)

`extensions/prism/` と `extensions/iris/` の 2 本立て。Manifest V3。

## 何ができる

### Prism 拡張
- Alt+P で開くツールバー popup
- 「Prism に取り込む」: 現在のページのタイトル + URL + 選択テキストを Prism に渡す
- 「13 CXO に相談する」: 同じ内容を CXO ProposalCard に流す
- 右クリックメニュー (ページ・選択・リンク・画像)

### Iris 拡張
- Alt+I で開くツールバー popup
- 「DM スクショから案件に変える」: Iris の案件キャプチャを直接開く
- 「プロフィールを Iris に取り込む」: プロフィール URL をフックに
- Instagram ページに常駐する「💗 Iris に保存」ピル (右下)
- 右クリックメニュー

## どうやって動く

1. 拡張側 → `https://core-prism-app.vercel.app/?capture=BASE64(JSON)` を新タブで開く
2. アプリの `main.tsx` が `?capture=` を検知して `localStorage` + `core:extension-capture` イベントを発火
3. `ExtensionCaptureToast` が左下に出てきて、ユーザーが次のアクション (案件登録 / CXO 相談 / メモ) を選ぶ

## ローカル動作確認

1. Chrome → `chrome://extensions/` を開く
2. 右上「デベロッパー モード」ON
3. 「パッケージ化されていない拡張機能を読み込む」→ `extensions/prism` または `extensions/iris` を選択
4. ツールバーにアイコンが出る (`Alt+P` / `Alt+I` でも開く)
5. 適当なページで popup を開いて「取り込む」 → Prism/Iris アプリ側でトーストが出るのを確認

## ストア配布の前にやること (Phase 2)

- [ ] 1024x500 のプロモタイル PNG
- [ ] スクリーンショット 5 枚 (1280x800)
- [ ] privacy policy URL (現状 `https://core-prism-app.vercel.app/privacy` が必要)
- [ ] manifest の version を 1.0.0 に
- [ ] CWS デベロッパー登録 (US$5、1 回限り)
- [ ] レビュー耐性のため `permissions` を最小化済み (activeTab + storage + contextMenus + scripting)

## 規約注意

- Instagram の content script はあくまで「ピルを表示するだけ」で、scraping や DOM 改変はしない
- DM の中身は Instagram からは抜き取らず、ユーザーが手動でスクショを撮って Iris にドロップする方式 (Meta TOS 準拠)
- ホスト権限は `core-prism-app.vercel.app` + `instagram.com` のみ
