/**
 * Format the prompt text: add a comma and space after each tag, and remove extra spaces.
 * Preserve special syntax such as weights (tag:1.2), parentheses, and wildcards.
 * @param {string} text - The original text.
 * @returns {string} - The formatted text.
 */
export function formatPromptText(text) {
  if (!text || text.trim().length === 0) return text;

  // Split text into individual lines for processing
  const lines = text.split('\n');
  const formattedLines = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Keep empty lines unchanged
    if (trimmedLine.length === 0) {
      formattedLines.push('');
      continue;
    }

    // Split the line by commas into raw tag segments
    const rawTags = trimmedLine.split(',');

    const cleanedTags = [];
    for (const tag of rawTags) {
      // Trim spaces around each tag
      const trimmedTag = tag.trim();

      // Keep only non-empty tags
      if (trimmedTag.length > 0) {
        cleanedTags.push(trimmedTag);
      }
    }

    // Rejoin cleaned tags with ", "
    let formattedLine = cleanedTags.join(', ');

    // Add a trailing comma and space if the line contains valid tags
    if (formattedLine.length > 0) {
      formattedLine += ', ';
    }

    formattedLines.push(formattedLine);
  }

  // Rejoin all lines with newline characters
  return formattedLines.join('\n');
}

/**
 * Format the content of a textarea when it loses focus.
 * @param {HTMLTextAreaElement} textarea - The target textarea element.
 */
export function formatTextareaOnBlur(textarea) {
  const originalText = textarea.value;
  const formattedText = formatPromptText(originalText);

  if (originalText !== formattedText) {
    const cursorPos = textarea.selectionStart;
    textarea.value = formattedText;

    // Try to preserve cursor position
    const newCursorPos = Math.min(cursorPos, formattedText.length);
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  }
}
