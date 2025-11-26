export const settingValues = {
    // Tag source settings
    tagSource: 'all', // 'danbooru', 'e621', 'all'
    primaryTagSource: 'danbooru', // 'danbooru', 'e621'
    tagSourceIconPosition: 'left', // 'left', 'right', 'hidden'

    // Autocomplete feature settings
    enabled: true,
    maxSuggestions: 10,
    enableModels: true, // Enable Lora and Embedding suggestions
    useFastSearch: false,
    replaceUnderscoreWithSpace: true, // Replace underscores with spaces in tag insertion
    autoInsertComma: true,

    // Related tags feature settings
    enableRelatedTags: true,
    maxRelatedTags: 20,
    relatedTagsDisplayPosition: 'horizontal', // 'horizontal' or 'vertical'
    relatedTagsTriggerMode: 'click', // Options: 'click', 'ctrl+Click'

    // Display settings
    hideAlias: false, // Hide alias in the autocomplete and related tags display

    // Auto format settings
    enableAutoFormat: true,
    autoFormatTrigger: 'auto', // Options: 'auto' (format on blur + shortcut), 'manual' (shortcut only)
    useTrailingComma: false, // Whether to add comma at the end of each line


    // Internal logic settings
    _useFallbackAttachmentForEventListener: false, // Fallback to attach event listener when somthing goes wrong
    _maxTagLength: 100, // Maximum tag length to prevent performance issues with long text input

    // Debugging settings (use internally)
    _hideWhenOutofFocus: true, // Hide UI when the input is out of focus
    _logprocessingTime: false, // Log processing time for debugging
}

/**
 * Update the maximum tag length setting value.
 * This function ensures that the maximum tag length is always at least as long as the new length provided.
 * @param {number} newLength 
 */
export function updateMaxTagLength(newLength) {
    if(isNaN(newLength)) return;
    settingValues._maxTagLength = Math.max(settingValues._maxTagLength, newLength);
}
