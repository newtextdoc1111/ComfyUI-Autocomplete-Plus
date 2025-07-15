export const settingValues = {
    // Tag source settings
    tagSource: 'all', // 'danbooru', 'e621', 'all'
    primaryTagSource: 'danbooru', // 'danbooru', 'e621'
    tagSourceIconPosition: 'left', // 'left', 'right', 'hidden'

    // Autocomplete feature settings
    enabled: true,
    maxSuggestions: 10,
    useFastSearch: false,

    // Related tags feature settings
    enableRelatedTags: true,
    maxRelatedTags: 20,
    relatedTagsDisplayPosition: 'horizontal', // 'horizontal' or 'vertical'
    relatedTagsTriggerMode: 'click', // Options: 'click', 'ctrl+Click'


    // Internal logic settings
    _useFallbackAttachmentForEventListener: false, // Fallback to attach event listener when somthing goes wrong

    // Debugging settings (use internally)
    _hideWhenOutofFocus: true, // Hide UI when the input is out of focus
    _logprocessingTime: false, // Log processing time for debugging
}