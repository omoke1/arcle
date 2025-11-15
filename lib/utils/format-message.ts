/**
 * Remove markdown formatting from messages
 * Strips **bold**, *italic*, and other markdown syntax
 */
export function removeMarkdownFormatting(text: string): string {
  if (!text) return text;
  
  // Remove **bold** formatting (most common)
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  
  // Remove *italic* formatting (but preserve bullet points)
  text = text.replace(/(?<!\n)\*([^*\n]+)\*(?!\*)/g, '$1');
  
  // Remove other markdown patterns if needed
  text = text.replace(/`([^`]+)`/g, '$1'); // Remove inline code
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Remove links but keep text
  
  return text.trim();
}
