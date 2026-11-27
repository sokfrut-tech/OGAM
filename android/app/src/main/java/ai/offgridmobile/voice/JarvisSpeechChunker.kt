package ai.offgridmobile.voice

/**
 * Incremental sentence chunker for assistant text streams.
 *
 * It delays a trailing punctuation mark until the next fragment or flush so
 * abbreviations and decimal numbers are not split prematurely. It preserves
 * punctuation and never splits a word when enforcing [maxChunkChars].
 */
internal class JarvisSpeechChunker(
  private val maxChunkChars: Int = DEFAULT_MAX_CHUNK_CHARS,
) {
  private val pending = StringBuilder()

  init {
    require(maxChunkChars >= MIN_MAX_CHUNK_CHARS) {
      "maxChunkChars must be at least $MIN_MAX_CHUNK_CHARS"
    }
  }

  fun append(fragment: String): List<String> {
    if (fragment.isNotEmpty()) pending.append(fragment)
    return drain(force = false)
  }

  fun flush(): List<String> = drain(force = true)

  fun reset() {
    pending.clear()
  }

  private fun drain(force: Boolean): List<String> {
    val ready = mutableListOf<String>()

    while (pending.isNotEmpty()) {
      val boundary = findSentenceBoundary(force)
      if (boundary > 0) {
        emitPrefix(boundary, ready)
        continue
      }

      if (pending.length > maxChunkChars) {
        val split = findSafeLengthBoundary()
        if (split > 0) {
          emitPrefix(split, ready)
          continue
        }
      }

      break
    }

    if (force && pending.isNotEmpty()) {
      emitPrefix(pending.length, ready)
    }
    return ready
  }

  /**
   * Returns an exclusive end index, or -1 when no safe sentence boundary is
   * available. For non-forced streaming, punctuation at the very end waits
   * for the next fragment to distinguish a sentence end from an abbreviation.
   */
  private fun findSentenceBoundary(force: Boolean): Int {
    for (index in pending.indices) {
      val char = pending[index]
      if (char == '\n' || char == '\r') {
        var end = index + 1
        while (end < pending.length && (pending[end] == '\n' || pending[end] == '\r')) end++
        return end
      }

      if (char != '.' && char != '!' && char != '?' && char != '…') continue
      var end = index + 1
      while (end < pending.length &&
        (pending[end] == '!' || pending[end] == '?' || pending[end] == '…')
      ) end++
      while (end < pending.length && pending[end] in CLOSING_QUOTES_AND_BRACKETS) end++

      if (end == pending.length && !force) continue
      if (end < pending.length && !pending[end].isWhitespace()) continue
      if (char == '.' && isNonTerminalPeriod(index)) continue

      while (end < pending.length && pending[end].isWhitespace()) end++
      return end
    }
    return -1
  }

  private fun isNonTerminalPeriod(index: Int): Boolean {
    if (index > 0 && index + 1 < pending.length &&
      pending[index - 1].isDigit() && pending[index + 1].isDigit()
    ) return true

    val tokenStart = run {
      var cursor = index - 1
      while (cursor >= 0 && !pending[cursor].isWhitespace()) cursor--
      cursor + 1
    }
    val token = pending.substring(tokenStart, index).trimEnd(',', '(', '[', '"', '\'').lowercase()
    if (token in ABBREVIATIONS || isSpacedRussianAbbreviationPeriod(index)) return true

    // Initials such as "А. С. Пушкин" and "J. R. R. Tolkien".
    val isSingleLetter = token.length == 1 && token[0].isLetter()
    if (isSingleLetter && index + 2 < pending.length &&
      pending[index + 1].isWhitespace() && pending[index + 2].isLetter() &&
      pending[index + 2].isUpperCase()
    ) return true

    return false
  }

  /**
   * Handles spaced Russian abbreviations such as "т. д.", "т. п." and
   * "и т. д.". Both dots in the abbreviation must be protected from splitting.
   */
  private fun isSpacedRussianAbbreviationPeriod(index: Int): Boolean {
    val prefix = pending.substring(0, index)
    val suffix = pending.substring(index + 1)
    val lastToken = prefix.trim().split(Regex("\\s+")).lastOrNull().orEmpty()

    if (lastToken.equals("т", ignoreCase = true)) {
      return Regex("^\\s*[дпек]\\.", RegexOption.IGNORE_CASE).containsMatchIn(suffix)
    }

    if (lastToken.equals("и", ignoreCase = true)) {
      return Regex("^\\s*т\\.\\s*[дп]\\.", RegexOption.IGNORE_CASE).containsMatchIn(suffix)
    }

    return Regex("(?:^|\\s)(?:и\\s+)?т\\.\\s*[дпек]$", RegexOption.IGNORE_CASE)
      .containsMatchIn(prefix)
  }

  private fun findSafeLengthBoundary(): Int {
    val limit = maxChunkChars
    var split = -1
    for (index in 0 until minOf(limit, pending.length)) {
      if (pending[index].isWhitespace()) split = index
    }
    if (split > 0) return split

    // A single unusually long token should remain intact. Otherwise split at
    // the first following whitespace, keeping the word whole.
    for (index in limit until pending.length) {
      if (pending[index].isWhitespace()) return index
    }
    return -1
  }

  private fun emitPrefix(endExclusive: Int, output: MutableList<String>) {
    val raw = pending.substring(0, endExclusive)
    pending.delete(0, endExclusive)
    val text = raw.trim()
    if (text.isNotEmpty()) output += text
    trimLeadingWhitespace()
  }

  private fun trimLeadingWhitespace() {
    while (pending.isNotEmpty() && pending[0].isWhitespace()) {
      pending.deleteCharAt(0)
    }
  }

  companion object {
    const val DEFAULT_MAX_CHUNK_CHARS = 220
    const val MIN_MAX_CHUNK_CHARS = 40

    private val CLOSING_QUOTES_AND_BRACKETS = setOf('»', '”', '’', '"', '\'', ')', ']', '}')

    private val ABBREVIATIONS = setOf(
      "г", "ул", "д", "стр", "т.д", "т.п", "т.е", "т.к", "см", "рис",
      "им", "проф", "акад", "др", "руб", "коп", "млн", "тыс", "кг",
      "мм", "км", "мин", "сек", "ч", "mr", "mrs", "ms", "dr", "prof",
      "vs", "etc", "e.g", "i.e", "fig", "no",
    )
  }
}
