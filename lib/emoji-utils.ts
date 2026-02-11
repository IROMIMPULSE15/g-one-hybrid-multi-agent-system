/**
 * Emoji Utility Functions
 * Strips emojis and special characters from text for text-to-speech
 */

/**
 * Remove all emojis and special Unicode characters from text
 * Preserves regular text, numbers, and basic punctuation
 */
export function removeEmojis(text: string): string {
  if (!text) return text

  return text
    // Remove emoji ranges (comprehensive coverage)
    .replace(
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2764}]|[\u{1F600}-\u{1F64F}]|[\u{1F910}-\u{1F9FF}]/gu,
      ''
    )
    // Remove zero-width characters and other formatting chars
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Remove variation selectors
    .replace(/[\uFE0F\uFE0E]/g, '')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if text contains emojis
 */
export function hasEmojis(text: string): boolean {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2764}]/gu
  return emojiRegex.test(text)
}

/**
 * Remove emojis and prepare text for text-to-speech
 */
export function prepareTextForSpeech(text: string): string {
  return removeEmojis(text)
}
