# ComfyUI-Autocomplete-Plus

> [!WARNING]
> このカスタムノードは現在ベータ版です。予告なく機能が変更されたり不具合が発生する場合があります。

## 概要

**ComfyUI-Autocomplete-Plus** は、[ComfyUI](https://github.com/comfyanonymous/ComfyUI) の任意のテキストエリアに複数の入力支援機能を提供するカスタムノードです。現在は主にDanbooruスタイルのタグ入力に対応しています。

## 特徴

- **オートコンプリート**: テキスト入力中に、入力内容に基づいてタグ候補をリアルタイムで表示
- **関連タグ表示機能**: 選択したタグと関連性の高いタグを一覧表示
- **直感的な操作**:
    - マウスとキーボードどちらの操作にも対応
    - カーソル位置や既存のテキストを考慮した自然なタグ挿入
- **デザイン**:
    - ComfyUIのライトテーマとダークテーマの両方に対応
- **依存ライブラリゼロ**: 外部ライブラリを使用せず、すべての入力支援処理がクライアントで動作

## インストール

ベータ版では以下の手順でインストールできます。
1. このリポジトリを ComfyUI の `custom_nodes` フォルダにクローンまたはコピーします
2. ComfyUI を起動します。初回起動時のみ、必要な CSV データが HuggingFace から自動的にダウンロードされます

## オートコンプリート

テキスト入力エリアで文字を入力すると、テキストに部分一致するタグを投稿数の多い順で表示します。EnterかTabキーで選択したタグを挿入できます。

- タグのエイリアスも検索対象に含まれます。日本語のひらがな、カタカナは区別せず検索されます
- タグのカテゴリ毎に色分けされます。色分けのルールは Danbooru と同じです

## 関連タグ

テキスト入力エリアの任意のタグを選択すると、関連性の高いタグを表示します。UIは編集中のテキストエリアを基準に位置とサイズが自動で調整されます。

- 表示位置は、テキストエリアの下部を基本とし、空きスペースに応じて上下に自動調整されます
  - ヘッダーの「↕️|↔️」ボタンで上下と左右の表示位置に切り替えられます
- ヘッダーの「📌|🎯」ボタンで表示する関連タグの固定状態を切り替えられます。固定状態で閉じたい場合はEscキーを押します
- `Ctrl+Shift+Space` キーでカーソル位置の関連タグを表示できます

## CSV データ

動作には基本となるCSVデータが2つ必要です。これらは [HuggingFace](https://huggingface.co/datasets/newtextdoc1111/danbooru-tag-csv) で管理されており、 ComfyUI にインストール後の初回起動時に自動でダウンロードされます。  
基本CSVファイルはHuggingFaceで公開されているDanbooruデータセットを元に作成しているので、Danbooruサイトの投稿数や関連タグの情報と異なる場合があります。

**danbooru_tags.csv**

カテゴリ、投稿数、エイリアス（日本語、中国語、韓国語を含む）を収録したオートコンプリート用の CSV ファイルです。カラム構成は [DominikDoom/a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete) で使用されているものと同じです。

掲載タグは以下の条件でフィルタリングされています
- 投稿数100件以上
- 投稿画像のスコアが5以上
- カテゴリが `general, character, copyright` のいずれか
- タグ名に `(cosplay)` が含まれていない

**danbooru_tags_cooccurrence.csv**

- タグペアとその共起回数を収録した、関連タグ計算用のCSVファイルです。

タグペアは以下の条件でフィルタリングされています
- 共起回数が100件以上

### ユーザーCSV

ユーザーが自身で用意したCSVを使用することも可能です。例として、よく使うメタタグを `danbooru_tags_meta.csv` の名前で `data` フォルダーに配置することでオートコンプリート候補に追加できます。  
反映にはブラウザのリロードが必要です。

**メタタグの例**
```
tag,category,count,alias
masterpiece,5,9999999,
best_quality,5,9999999,
high_quality,5,9999999,
normal_quality,5,9999999,
low_quality,5,9999999,
worst_quality,5,9999999,
```

>[!NOTE]
> ユーザーCSVが複数ある場合アルファベット順に読み込まれます。同じタグが複数のファイルに存在する場合は先に読み込まれた方が保持されます。基本CSVは最後にロードされます。

## 設定

### オートコンプリート

- **Enable Autocomplete**: オートコンプリート機能の有効化/無効化
- **Max suggestions**: オートコンプリート候補の最大表示件数

### 関連タグ

- **Enable Related Tags**: 関連タグ機能の有効化/無効化
- **Max related tags**: 関連タグの最大表示件数
- **Default Display Position**: ComfyUI起動時のデフォルト表示位置
- **Related Tags Trigger Mode** : 関連タグの表示トリガー（クリック、Ctrl+クリック）


## 既知の問題

### 全般

- csvファイルの容量が大きいため、ブラウザの起動時間が長くなる場合があります

### オートコンプリート

### 関連タグ
- UIをピン留めしたときのキーボード入力時で、一部のキー以外はテキストエリアに入力されてしまう場合があります


## クレジット

- [ComfyUI-Custom-Node](https://github.com/pythongosssss/ComfyUI-Custom-Scripts)
  - オートコンプリート機能の実装にあたり参考にしました
- [DominikDoom/a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete)
  - オートコンプリートの主要な機能やCSVの仕様で参考にしました