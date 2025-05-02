/**
 * Registers event handlers for dynamically added and existing textareas in the DOM.
 * This function uses a MutationObserver to monitor changes in the DOM and attaches
 * event listeners to elements matching specified selectors.
 *
 * @param {Object} eventHandlers - An object containing the event handler functions.
 * @param {Function} eventHandlers.handleInput - Function to handle the 'input' event.
 * @param {Function} eventHandlers.handleFocus - Function to handle the 'focus' event.
 * @param {Function} eventHandlers.handleBlur - Function to handle the 'blur' event.
 * @param {Function} eventHandlers.handleKeyDown - Function to handle the 'keydown' event.
 * @param {Function} eventHandlers.handleMouseMove - Function to handle the 'mousemove' event.
 * @param {Function} eventHandlers.handleClick - Function to handle the 'click' event.
 */
export function registerEventHandlers(eventHandlers) {
    // Find relevant textareas (e.g., prompt inputs)
    // This selector might need adjustment based on ComfyUI's structure
    const targetSelectors = [
        '.comfy-multiline-input',
        // Add other selectors if needed
    ];

    // Use MutationObserver to detect dynamically added textareas
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    targetSelectors.forEach(selector => {
                        // Check if the added node itself matches or contains matching elements
                        if (node.matches(selector)) {
                            attachListeners(node);
                        } else {
                            node.querySelectorAll(selector).forEach(attachListeners);
                        }
                    });
                }
            });
        });
    });

    // Function to attach listeners
    function attachListeners(element) {
        if (element.dataset.autocompleteAttached) return; // Prevent double attachment

        element.addEventListener('input', eventHandlers.handleInput);
        element.addEventListener('focus', eventHandlers.handleFocus);
        element.addEventListener('blur', eventHandlers.handleBlur);
        element.addEventListener('keydown', eventHandlers.handleKeyDown);

        // Add new event listeners for similar tags feature
        element.addEventListener('mousemove', eventHandlers.handleMouseMove);
        element.addEventListener('click', eventHandlers.handleClick);

        element.dataset.autocompleteAttached = 'true';
    }

    // Initial scan for existing elements
    targetSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(attachListeners);
    });

    // Start observing the document body for changes
    observer.observe(document.body, { childList: true, subtree: true });
}