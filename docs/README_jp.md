# ComfyUI-Autocomplete-Plus

![ss01](https://github.com/user-attachments/assets/bb139951-ad78-4d87-b290-97aafa1221d7)

## 概要

**ComfyUI-Autocomplete-Plus** は、[ComfyUI](https://github.com/comfyanonymous/ComfyUI) の任意のテキストエリアに複数の入力支援機能を提供するカスタムノードです。現在はDanbooruとe621のタグに対応しています（e621は一部の機能が未対応です）。

## 最近の更新 :fire:
- CSV ファイルの自動・手動更新チェック機能の追加
- Microsoft IMEでオートコンプリート候補が表示されないタイミングがある不具合の修正
- e621タグ CSV の読み込みと表示のサポート

## 特徴

- **:zap:セットアップ不要**: Danbooruタグに最適化された CSV データを自動でダウンロード
- **:mag:オートコンプリート**: テキスト入力中に、入力内容に基づいてタグ候補をリアルタイムで表示
- **:file_cabinet:関連タグ表示機能**: 選択したタグと関連性の高いタグを一覧表示
- **:earth_asia:多言語対応**: 日本語、中国語、韓国語での入力補完をサポート
- **:computer_mouse:直感的な操作**:
    - マウスとキーボードどちらの操作にも対応
    - カーソル位置や既存のテキストを考慮した自然なタグ挿入
- **:art:デザイン**: ComfyUIのライトテーマとダークテーマの両方に対応
- **:pencil:ユーザーCSV**: ユーザーが用意した CSV をオートコンプリート候補に追加可能
- **依存ライブラリゼロ**: 外部ライブラリを使用せず、すべての入力支援処理がブラウザで動作

## インストール

### マニュアル

1. このリポジトリを ComfyUI の `custom_nodes` フォルダにクローンまたはコピーします  
    `git clone https://github.com/newtextdoc1111/ComfyUI-Autocomplete-Plus.git`
3. ComfyUI を起動します。初回起動時のみ、必要な CSV データが HuggingFace から自動的にダウンロードされます

## オートコンプリート

テキスト入力エリアで文字を入力すると、テキストに部分一致するタグを投稿数の多い順で表示します。上下キーで選択、EnterかTabキーで選択したタグを挿入できます。

- タグのエイリアスも検索対象に含まれます。日本語のひらがな、カタカナは区別せず検索されます
- タグのカテゴリ毎に色分けされます。色分けのルールは Danbooru と同じです
- 入力済みのタグはグレーアウトで表示されます
- Danbooruとe621のタグを同時に表示出来ます。設定から優先順位を変更できます

## 関連タグ

![ss02](https://github.com/user-attachments/assets/854571cd-01eb-4e92-a118-2303bec0b175)

テキスト入力エリアの任意のタグを選択すると、関連性の高いタグを一覧表示します。UIは編集中のテキストエリアを基準に位置とサイズが自動で調整されます。

- 表示位置は、テキストエリアの下部を基本とし、空きスペースに応じて上下に自動調整されます
  - ヘッダーの「↕️|↔️」ボタンで上下と左右の表示位置に切り替えられます
- ヘッダーの「📌|🎯」ボタンで表示する関連タグの固定状態を切り替えられます。固定状態で閉じたい場合はEscキーを押します
- 入力済みのタグはグレーアウトで表示されます。グレーアウトしたタグを挿入しようとした場合、代わりに入力済みのタグを選択状態にします
- `Ctrl+Shift+Space` キーでカーソル位置の関連タグを表示できます

## CSV データ

動作には基本となる CSV データが2つ必要です。これらは [HuggingFace](https://huggingface.co/datasets/newtextdoc1111/danbooru-tag-csv) で管理されており、 ComfyUI にインストール後の初回起動時に自動でダウンロードされるのでセットアップは不要です。
基本 CSV ファイルはHuggingFaceで公開されているDanbooruデータセットを元にしているので、Danbooruサイトの投稿数や関連タグの情報と異なる場合があります。

> [!IMPORTANT]
> 基本 CSV にはSFW, NSFW両方のタグが含まれています。

**danbooru_tags.csv**

タグ名、カテゴリ、投稿数、エイリアス（日本語、中国語、韓国語を含む）の情報を持つオートコンプリート用のタグ情報 CSV ファイルです。このカラム構成は [DominikDoom/a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete) で使用されているものと同じです。

タグ情報は以下の条件でフィルタリングされています。
- 投稿数100件以上
- 投稿画像のスコアが5以上
- カテゴリが `general, character, copyright` のいずれか
- タグ名に `(cosplay)` が含まれていない

**danbooru_tags_cooccurrence.**

タグペアとその共起回数を記録した、関連タグ計算用の CSV ファイルです。

タグペアはタグ情報 CSV から、さらに以下の条件でフィルタリングされています。
- 共起回数が100件以上

### e621 CSV

現在、e621用 CSV の自動ダウンロードは未対応なため `danbooru_tags.csv` と同じ構造の CSV を `e621_tags.csv` という名前でデータフォルダーに手動配置してください。  
また、関連タグ表示も同様に未対応です。

### ユーザーCSV

ユーザーが自身で用意した CSV を使用することも可能です。例として、よく使うメタタグを `danbooru_tags_meta.csv` の名前で `data` フォルダーに配置することでオートコンプリート候補に追加できます。  
ヘッダー行はなくても構いません。反映にはブラウザのリロードが必要です。

**メタタグの例**
```csv
tag,category,count,alias
masterpiece,5,9999999,
best_quality,5,9999999,
high_quality,5,9999999,
normal_quality,5,9999999,
low_quality,5,9999999,
worst_quality,5,9999999,
```

>[!NOTE]
> ユーザー CSV が複数ある場合アルファベット順に読み込まれます。同じタグが複数のファイルに存在する場合は先に読み込まれた方が保持されます。基本 CSV は最後にロードされます。

## 設定

### タグソース

> [!TIP]
> Danbooruやe621等のタグデータの提供元を「タグソース」と呼びます

- **Autocomplete Tag Source**: オートコンプリート候補に表示するタグソース。「all」を選択するとロード済みの全てのタグソースを表示します
- **Primary source for 'all' Source**: `Autocomplete Tag Source` が「all」のとき、ここで指定したタグソースが優先して表示されます
- **Tag Source Icon Position**: タグの情報源のアイコンをどの位置に表示するか。「hidden」を選択すると非表示になります

### オートコンプリート

- **Enable Autocomplete**: オートコンプリート機能の有効化/無効化
- **Max suggestions**: オートコンプリート候補の最大表示件数

### 関連タグ

- **Enable Related Tags**: 関連タグ機能の有効化/無効化
- **Max related tags**: 関連タグの最大表示件数
- **Default Display Position**: ComfyUI起動時のデフォルト表示位置
- **Related Tags Trigger Mode** : 関連タグを表示する際、どの操作をトリガーとするか（クリックのみ、Ctrl+クリック）

### その他

- **Check CSV updates**: 「Check Now」ボタンを押すと新しい CSV ファイルがHuggingFaceにあるか確認し、必要に応じてダウンロードを行います

## 既知の問題

### パフォーマンス

- CSV ファイルの容量が大きいため、ブラウザの起動時間が長くなる場合があります
- ブラウザ上で高速に動作させるためにメモリを消費します。ComfyUIが動作するスペックのマシンであれば問題にはならないと思います

### オートコンプリート

### 関連タグ
- ダイナミックプロンプト `from {above|below|side}` をクリックしたときに正しいタグを取得出来ない。これはワイルドカードプロセッサーが実行されるまで正確なタグが確定しないためです

## クレジット

- [ComfyUI-Custom-Node](https://github.com/pythongosssss/ComfyUI-Custom-Scripts)
  - オートコンプリート機能の実装にあたり参考にしました
- [DominikDoom/a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete)
  - オートコンプリートの主要な機能や CSV の仕様で参考にしました
