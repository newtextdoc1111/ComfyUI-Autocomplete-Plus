# ComfyUI-Autocomplete-Plus

## English •  [日本語](docs/README_jp.md)

![ss01](https://github.com/user-attachments/assets/bb139951-ad78-4d87-b290-97aafa1221d7)

## Overview

**ComfyUI-Autocomplete-Plus** is a custom node that provides multiple input assistance features for any text area in [ComfyUI](https://github.com/comfyanonymous/ComfyUI). Currently, it supports Danbooru and e621 tags (e621 does not support some functions).

## Features

- **:zap:No setup required**: Automatically downloads CSV data optimized for Danbooru tags.
- **:mag:Autocomplete**: Displays tag suggestions in real-time based on your input as you type.
- **:file_cabinet:Related Tags Display**: Shows a list of tags highly related to the selected tag.
- **:earth_asia:Multilingual Support**: Supports input completion in Japanese, Chinese, and Korean.
- **:computer_mouse:Intuitive Operation**:
    - Supports both mouse and keyboard operations.
    - Natural tag insertion that considers cursor position and existing text.
- **:art:Design**: Supports both light and dark themes of ComfyUI.
- **:pencil:User CSV**: Allows users to add their own CSV files for autocomplete suggestions.
- **Zero Dependencies**: All input assistance processing works in the browser without external libraries.

## Installation

### ComfyUI-Manager

1. Search for `Autocomplete-Plus` in [ComfyUI-Manager](https://github.com/Comfy-Org/ComfyUI-Manager), install the custom node that appears, and restart.
2. The necessary CSV data will be automatically downloaded from HuggingFace upon startup.

### Manual

1. Clone or copy this repository into the `custom_nodes` folder of ComfyUI.
   `git clone https://github.com/newtextdoc1111/ComfyUI-Autocomplete-Plus.git`
2. Launch ComfyUI. The necessary CSV data will be automatically downloaded from HuggingFace upon startup.

## Autocomplete

When you type in a text input area, tags that partially match the text are displayed in descending order of post count. You can select a tag with the up and down keys, and insert the selected tag by pressing Enter or Tab.

- Tag aliases are also included in the search. Japanese hiragana and katakana are searched without distinction.
- Tags are color-coded by category. The color-coding rules are the same as Danbooru.
- Tags that have already been entered are displayed grayed out.
- You can display Danbooru and e621 tags at the same time. You can also change the priority from the settings.

## Related Tags

![ss02](https://github.com/user-attachments/assets/854571cd-01eb-4e92-a118-2303bec0b175)

When you select any tag in a text input area, a list of highly related tags is displayed. You can insert a tag by clicking it or by selecting it with the up/down arrow keys and then pressing Enter or Tab. The UI's position and size are automatically adjusted based on the text area being edited.

- The display position is primarily at the bottom of the text area and automatically adjusts vertically based on available space.
  - You can switch between vertical and horizontal display positions using the "↕️|↔️" button in the header.
- You can toggle the pinned state of the displayed related tags using the "📌|🎯" button in the header. To close the UI when pinned, press the Esc key.
- Tags that have already been entered are displayed grayed out. If you try to insert a grayed-out tag, the already entered tag will instead be selected.
- You can display related tags for the cursor position by pressing `Ctrl+Shift+Space`.

## CSV Data

Two basic CSV data files are required for operation. These are managed on [HuggingFace](https://huggingface.co/datasets/newtextdoc1111/danbooru-tag-csv) and are automatically downloaded when ComfyUI is first launched after installation, so no setup is required.  
Since the basic CSV files are based on the Danbooru dataset publicly available on HuggingFace, the post counts and related tag information may differ from the Danbooru website.

> [!IMPORTANT]
> The basic CSV contains both SFW and NSFW tags.

**danbooru_tags.csv**

This is a tag information CSV file for autocomplete, containing tag names, categories, post counts, and aliases (including Japanese, Chinese, and Korean). The column structure is the same as that used in [DominikDoom/a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete).

Tag information is filtered under the following conditions:
- Post count of 100 or more
- Image score of 5 or more
- Category is `general, character, or copyright`
- Tag name does not contain `(cosplay)`

**danbooru_tags_cooccurrence.csv**

This is a CSV file for related tag calculation, recording tag pairs and their co-occurrence counts.

Tag pairs are further filtered from the tag information CSV under the following conditions:
- Co-occurrence count of 100 or more

### e621 CSV

Currently, automatic download of CSV for e621 is not supported, so please manually place a CSV with the same structure as `danbooru_tags.csv` in the data folder with the name `e621_tags.csv`.
Also, displaying related tags is not supported.

### User CSV

Users can also use their own CSV files. CSV files should be placed in the `data` folder according to the following naming convention:

- **CSV for Autocomplete**: `<danbooru | e621>_tags*.csv`
- **CSV for Related Tags**: `<danbooru | e621>_tags_cooccurrence*.csv`

For example, you can add frequently used meta tags to the autocomplete suggestions by placing a file named `danbooru_tags_meta.csv` in the `data` folder.
A header row is not required. A browser reload is necessary to apply the changes.

**Example of meta tags:**
```csv
tag,category,count,alias
masterpiece,5,9999999,
best_quality,5,9999999,
high_quality,5,9999999,
normal_quality,5,9999999,
low_quality,5,9999999,
worst_quality,5,9999999,
```

When the browser is reloaded, you can check the list of loaded CSV files in the ComfyUI console log. If a file is not included in the log output, please verify that the file name follows the naming convention.

**Example of ComfyUI console log output:**
```
[Autocomplete-Plus] CSV file status:
  * Danbooru -> base: True, extra: danbooru_tags_meta.csv // If displayed here, meta tags can be autocompleted
  * E621 -> base: False, extra:
```

>[!NOTE]
> If there are multiple user CSV files, they are loaded in alphabetical order. If the same tag exists in multiple files, the one loaded first is retained. The basic CSV is loaded last.

## Settings

### Tag Source

> [!TIP]
> The source of tag data such as Danbooru or e621 is called the "tag source".

- **Autocomplete Tag Source**: The tag source to display in the autocomplete suggestions. Select "all" to display all loaded tag sources.
- **Primary source for 'all' Source**: When `Autocomplete Tag Source` is set to "all", the tag source specified here will be displayed with priority.
- **Tag Source Icon Position**: Where to display the icon of the tag source. Select "hidden" to hide it.

### Autocomplete

- **Enable Autocomplete**: Enable/disable the autocomplete feature.
- **Max suggestions**: Maximum number of autocomplete suggestions to display.

### Related Tags

- **Enable Related Tags**: Enable/disable the related tags feature.
- **Max related tags**: Maximum number of related tags to display.
- **Default Display Position**: Default display position when ComfyUI starts.
- **Related Tags Trigger Mode**: Which action will trigger displaying related tags (click only, Ctrl+click)

### Miscellaneous

- **Check CSV updates**: Click the "Check Now" button to check if new CSV files are available in HuggingFace and download them if necessary.

## Advanced Settings

### Disabling CSV Update Check on Startup

By default, ComfyUI performs CSV file update checks and downloads at regular intervals during startup.
When starting in an environment without internet access, startup may be delayed until a timeout occurs.

You can skip the check process during ComfyUI startup by following these steps:

1. Start ComfyUI once with this custom node installed to generate the `csv_meta.json` file  
  The `csv_meta.json` file is created directly under this custom node's folder
2. Open `csv_meta.json` in a text editor and change the value of `check_updates_on_startup` from `true` to `false` and save

Additional notes:
- The check process will not be performed until the value of `check_updates_on_startup` is changed back to `true` or the `version` is switched
- Even when `check_updates_on_startup` is `false`, manual checking is still possible by pressing the `Check CSV updates` button in the Autocomplete Plus settings

## Known Issues

### Performance

- Due to the large size of the CSV files, browser startup time may be longer.
- It consumes memory to operate quickly in the browser. This should not be an issue on machines with specs capable of running ComfyUI.

### Autocomplete

### Related Tags
- Cannot retrieve the correct tag when clicking on a dynamic prompt like `from {above|below|side}`. This is because the exact tag is not determined until the wildcard processor is executed.

## Credits

- [ComfyUI-Custom-Node](https://github.com/pythongosssss/ComfyUI-Custom-Scripts)
  - Referenced for implementing the autocomplete function.
- [DominikDoom/a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete)
  - Referenced for autocomplete function and CSV specifications.