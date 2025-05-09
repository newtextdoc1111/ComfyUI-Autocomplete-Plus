export const settingValues = {
    // Autocomplete feature settings
    enabled: true,
    maxSuggestions: 10,

    // Related tags feature settings
    enableRelatedTags: true,
    maxRelatedTags: 20,
    relatedTagsDisplayPosition: 'horizontal', // 'horizontal' or 'vertical'
    relatedTagsTriggerMode: 'click', // Options: 'click', 'ctrl+Click'


    // Internal logic settings
    _useFallbackAttachmentForEventListener: false, // Fallback to attach event listener if not using jQuery

    // Debugging settings (use internally)
    _hideWhenOutofFocus: false, // Hide UI when the input is out of focus
    _logprocessingTime: true, // Log processing time for debugging
}