# ComfyUI-Autocomplete-Plus

![ss01](https://github.com/user-attachments/assets/bb139951-ad78-4d87-b290-97aafa1221d7)

## 概要

**ComfyUI-Autocomplete-Plus** は、[ComfyUI](https://github.com/comfyanonymous/ComfyUI) の任意のテキストエリアに複数の入力支援機能を提供するカスタムノードです。現在はDanbooruとe621のタグに対応しています（e621は一部の機能が未対応です）。

## 特徴

- **:zap:セットアップ不要**: Danbooruタグに最適化された CSV データを自動でダウンロード
- **:mag:オートコンプリート**: テキスト入力中に、入力内容に基づいてタグ候補をリアルタイムで表示
- **:file_cabinet:関連タグ表示機能**: 選択したタグと関連性の高いタグを一覧表示
- **:triangular_ruler:自動フォーマット**: テキストエリアがフォーカスを失った際に、プロンプトテキストを自動的にフォーマットし、余分なスペースやカンマを整理
- **:earth_asia:多言語対応**: 日本語、中国語、韓国語での入力補完をサポート
- **:computer_mouse:直感的な操作**:
    - マウスとキーボードどちらの操作にも対応
    - カーソル位置や既存のテキストを考慮した自然なタグ挿入
- **:art:デザイン**: ComfyUIのライトテーマとダークテーマの両方に対応
- **:pencil:ユーザーCSV**: ユーザーが用意した CSV をオートコンプリート候補に追加可能

## インストール

### ComfyUI-Manager

1. [ComfyUI-Manager](https://github.com/Comfy-Org/ComfyUI-Manager) で `Autocomplete-Plus` と検索して表示されたカスタムノードをインストールし、再起動します
2. 起動時に必要な CSV データが HuggingFace から自動的にダウンロードされます

### マニュアル

1. このリポジトリを ComfyUI の `custom_nodes` フォルダにクローンまたはコピーします  
    `git clone https://github.com/newtextdoc1111/ComfyUI-Autocomplete-Plus.git`
2. ComfyUI を起動します。起動時に必要な CSV データが HuggingFace から自動的にダウンロードされます

## オートコンプリート

テキスト入力エリアで文字を入力すると、テキストに部分一致するタグを投稿数の多い順で表示します。上下キーで選択、EnterかTabキーで選択したタグを挿入できます。

- タグのエイリアスも検索対象に含まれます。日本語のひらがな、カタカナは区別せず検索されます
- タグのカテゴリ毎に色分けされます。色分けのルールは Danbooru と同じです
- 入力済みのタグはグレーアウトで表示されます
- Danbooruとe621のタグを同時に表示出来ます。設定から優先順位を変更できます
- LoraとEmbeddingの入力補完に対応しています。設定から有効・無効を切り替えられます

## 関連タグ

![ss02](https://github.com/user-attachments/assets/854571cd-01eb-4e92-a118-2303bec0b175)

テキスト入力エリアの任意のタグを選択すると、関連性の高いタグを一覧表示します。タグをクリックするか、キーボードの上下キーで選択後にEnterまたはTabキーでタグを挿入出来ます。UIは編集中のテキストエリアを基準に位置とサイズが自動で調整されます。

- 表示位置は、テキストエリアの下部を基本とし、空きスペースに応じて上下に自動調整されます
  - ヘッダーの「↕️|↔️」ボタンで上下と左右の表示位置に切り替えられます
- ヘッダーの「📌|🎯」ボタンで表示する関連タグの固定状態を切り替えられます。固定状態で閉じたい場合はEscキーを押します
- 入力済みのタグはグレーアウトで表示されます。グレーアウトしたタグを挿入しようとした場合、代わりに入力済みのタグを選択状態にします
- `Ctrl+Shift+Space` キーでカーソル位置の関連タグを表示できます

## 自動フォーマット

テキスト入力エリアがフォーカスを失った際（例：外側をクリック、Tabキーを押す）、プロンプトテキストを自動的にフォーマットする機能です。大量のテキストを編集する際に可読性を向上させる事が出来ます。

詳細な動作は以下になります：
- 各タグの後に自動的にカンマとスペースを追加し、適切に区切ります
- タグ間の余分なカンマとスペースを削除します
- キーボードショートカット `Alt+Shift+F` を使って手動でフォーマットすることも出来ます（キーバインドはComfyUIの設定から変更可能です）
- 設定から機能の有効化/無効化を切り替えられます

> [!NOTE]
> 一部のノードはエラーに繋がるため、自動フォーマットは実行されません。
> 例：「Power Puter (rgthree)」の `code` フィールド、「LoraLoaderBlockWeight (Inspire)」の `block_vector` フィールド

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

ユーザーが自身で用意した CSV を使用することも可能です。 CSV ファイルは以下の命名規則に従って `data` フォルダーに配置してください。

- **オートコンプリート用 CSV**: <danbooru | e621>_tags*.csv
- **関連タグ用 CSV**: <danbooru | e621>_tags_cooccurrence*.csv

例として、よく使うメタタグを `danbooru_tags_meta.csv` の名前で `data` フォルダーに配置することでオートコンプリート候補に追加できます。
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

ブラウザリロード時、ロードされる CSV ファイル一覧をComfyUIのコンソールのログで確認出来ます。ログ出力に含まれていない場合はファイル名が命名規則に沿っているか確認してください。

**ComfyUIコンソールログ出力の例:**
```
[Autocomplete-Plus] CSV file status:
  * Danbooru -> base: True, extra: danbooru_tags_meta.csv // ここに表示されていればメタタグを入力補完できます
  * E621     -> base: False, extra: 
```

>[!NOTE]
> ユーザー CSV が複数ある場合アルファベット順に読み込まれます。同じタグが複数のファイルに存在する場合は先に読み込まれた方が保持されます。基本 CSV は最後にロードされます。

### 複数タグの一括挿入機能（疑似 Chants）

`""` （ダブルクォーテーション）で複数タグを囲むことで、よく使うタグを一括で挿入できます。
これは [DominikDoom/a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete?tab=readme-ov-file#chants) で **Chants** と呼ばれる機能に似ています。

例として以下のCSVを用意することで、`<c:Basic-HighQuality>` や `<c:Basic-Negative>` と入力して対応したタグを素早く挿入出来ます。

**`danbooru_tags_chants.csv`:**
```
"masterpiece, best quality, high quality, highres, ultra-detailed",5,9999999,<c:Basic-HighQuality>
"(worst quality, low quality:1.4), normal quality",5,9999999,<c:Basic-Negative>
```

>[!TIP]
> * `""` で囲まれたテキストは `()` （括弧）がエスケープされません。元々括弧が含まれるタグはエスケープした状態でCSVに記述してください。 例： `copyright_(series)` -> `copyright_\(series\)`
> * エイリアス列も `""` に対応しているので、複数のエイリアスを付けられます

## 設定

### タグソース

> [!NOTE]
> Danbooruやe621等のタグデータの提供元を「タグソース」と呼びます

- **Autocomplete Tag Source**: オートコンプリート候補に表示するタグソース。「all」を選択するとロード済みの全てのタグソースを表示します
- **Primary source for 'all' Source**: `Autocomplete Tag Source` が「all」のとき、ここで指定したタグソースが優先して表示されます
- **Tag Source Icon Position**: タグの情報源のアイコンをどの位置に表示するか。「hidden」を選択すると非表示になります

### オートコンプリート

- **Enable Autocomplete**: オートコンプリート機能の有効化/無効化
- **Max Suggestions**: オートコンプリート候補の最大表示件数
- **Auto-Insert Comma**: タグの挿入時、末尾にカンマを追加する
- **Replace '_' with 'Space'**: タグ挿入時にアンダースコアをスペースに置き換えます。この設定は関連タグ表示にも影響します
- **Enable Loras and Embeddings**: LoraとEmbeddingを候補に表示する
- **Use Fast Search**: オートコンプリート候補の検索を高速な処理に切り替える（詳細は [オートコンプリートの高速検索について](#オートコンプリートの高速検索について) を確認してください)

### 関連タグ

- **Enable Related Tags**: 関連タグ機能の有効化/無効化
- **Max related tags**: 関連タグの最大表示件数
- **Default Display Position**: ComfyUI起動時のデフォルト表示位置
- **Related Tags Trigger Mode** : 入力済みのタグの関連タグを表示する際、どの操作をトリガーとするか（クリックのみ、Ctrl+クリック）

### 表示

- **Hide Alias**: オートコンプリートと関連タグで表示されるエイリアス列の非表示/表示を切り替え（デフォルトは表示です）

### 自動フォーマット

- **Enable Auto Format**: テキストエリアがフォーカスを失った際にプロンプトテキストを自動的にフォーマットする機能の有効化/無効化
- **Auto Format Trigger**: フォーマットを適用するタイミングを選択します
  - **自動**: テキスト欄からフォーカスが外れた際に自動でフォーマットします
  - **手動**: キーボードショートカットでのみフォーマットします（デフォルト: `Alt+Shift+F`）

## 上級者向け設定

### 起動時のCSV更新チェックを無効化する

デフォルトの動作では、ComfyUI起動時に一定の間隔で CSV ファイルの更新チェックとダウンロード行います。
インターネットにアクセス出来ない環境で起動した場合、タイムアウトが発生するまで起動が遅延する事があります。

以下の手順を行う事により、ComfyUI起動時のチェック処理をスキップする事が出来ます。

1. このカスタムノードをインストールした状態でComfyUIを一度起動し、 `csv_meta.json` ファイルを生成する  
  `csv_meta.json` はこのカスタムノードのフォルダー直下に作成されます
2. `csv_meat.json` をテキストエディターで開き、`check_updates_on_startup` の値を `true` -> `false` に変更し保存する  
  `check_updates_on_startup` が存在しない場合、 `version` の下に追記してください

**変更後の `csv_meta.json`：**
```json
{
  "version": 1,
  "check_updates_on_startup": false,
  ...
}
```

**補足事項：**
- `check_updates_on_startup` の値を再び `true` にするか、 `version` が切り替わるまでチェック処理は行われなくなります
- `check_updates_on_startup` が `false` でも、Autocompelte Plusの設定から `Check CSV updates` のボタンを押す事で手動チェックが可能です

## 動作に関する詳細

## オートコンプリートの高速検索について

`v1.3.0` にて、オートコンプリートにタグの検索を高速化する機能を追加しました。設定画面から有効にする事でテキスト入力時のタグ検索処理が高速に動作し、応答性が改善されます。  
どのような場面でも高速な動作が期待できますが、特に以下のユースケースで **有効** にすることをお勧めします。

- 読み込む CSV ファイルに大量のタグやエイリアスが含まれている場合。タグの合計が **10万件** を超える場合は特に有用です
- プロンプト入力でタグのカンマ区切りの代わりに自然言語を使う場合

**ブラウザ起動時の動作**

高速検索はタグのインデックス構築が必要なため、ブラウザ起動直後は利用できません。構築が完了するまでは従来の検索処理で動作します。  
`v1.3.0` 時点では構築が完了したタイミングはブラウザーの開発ツールにのみが表示されます。これは将来のバージョンで改善予定です。

例として、約22万件のタグのインデックス構築が完了した際は以下のようなログが記録されます。
```
[Autocomplete-Plus] Building 221787 index for danbooru took 9398.70ms.
```

> [!NOTE]
> - インデックス構築は設定から高速検索を無効にしてもバックグラウンドで行われます
> - 高速検索の実現に全文検索ライブラリの [nextapps-de/flexsearch](https://github.com/nextapps-de/flexsearch) を使用しています 

## 既知の問題

### パフォーマンス

- CSV ファイルの容量が大きいため、ブラウザの起動時間が長くなる場合があります
- ブラウザ上で高速に動作させるためにメモリを消費します。ComfyUIが動作するスペックのマシンであれば問題にはならないと思います

### オートコンプリート

### 関連タグ
- ダイナミックプロンプト `from {above|below|side}` をクリックしたときに正しいタグを取得出来ない。これはワイルドカードプロセッサーが実行されるまで正確なタグが確定しないためです

## クレジット

- [pythongosssss/ComfyUI-Custom-Node](https://github.com/pythongosssss/ComfyUI-Custom-Scripts)
  - オートコンプリート機能の実装にあたり参考にしました
- [DominikDoom/a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete)
  - オートコンプリートの主要な機能や CSV の仕様で参考にしました
- [nextapps-de/flexsearch](https://github.com/nextapps-de/flexsearch)
  - オートコンプリートの高速なタグ検索処理の実装に利用させてもらいました
