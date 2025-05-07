export const settingValues = {
    // Autocomplete feature settings
    enabled: true,
    maxSuggestions: 10,

    // Similar tags feature settings
    enableSimilarTags: true,
    maxSimilarTags: 20,
    similarTagsDisplayPosition: 'horizontal', // 'horizontal' or 'vertical'

    // Internal logic settings
    _useFallbackAttachmentForEventListener: false, // Fallback to attach event listener if not using jQuery

    // Debugging settings (use internally)
    _hideWhenOutofFocus: false, // Hide UI when the input is out of focus
    _logprocessingTime: true, // Log processing time for debugging
}