package ai.offgridmobile.voice

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisSpeechChunkerTest {
  @Test
  fun emitsOnlyAfterACompleteSentenceAndHandlesFragmentBoundaries() {
    val chunker = JarvisSpeechChunker()

    assertTrue(chunker.append("Привет, ").isEmpty())
    assertEquals(listOf("Привет, мир."), chunker.append("мир. Как "))
    assertEquals(listOf("Как дела?"), chunker.append("дела?"))
  }

  @Test
  fun doesNotSplitRussianAbbreviationsOrDecimalNumbers() {
    val chunker = JarvisSpeechChunker()

    assertTrue(chunker.append("Встретимся в г. ").isEmpty())
    assertEquals(
      listOf("Встретимся в г. Бонн завтра."),
      chunker.append("Бонн завтра. "),
    )
    assertEquals(listOf("Температура 21.5 градуса."), chunker.append("Температура 21.5 градуса. "))
  }

  @Test
  fun keepsInitialsTogether() {
    val chunker = JarvisSpeechChunker()

    assertTrue(chunker.append("А. С. Пушкин написал стихотворение. ").isNotEmpty())
    assertEquals(listOf("А. С. Пушкин написал стихотворение."), chunker.flush())
  }

  @Test
  fun flushEmitsAnUnterminatedFinalFragment() {
    val chunker = JarvisSpeechChunker()

    assertTrue(chunker.append("Ответ без точки").isEmpty())
    assertEquals(listOf("Ответ без точки"), chunker.flush())
    assertTrue(chunker.flush().isEmpty())
  }

  @Test
  fun splitsLongTextAtWhitespaceWithoutBreakingWords() {
    val chunker = JarvisSpeechChunker(maxChunkChars = 40)
    val chunks = chunker.append("Это длинное предложение должно делиться на безопасные фрагменты без разрыва слов ")
      .toMutableList()
    chunks += chunker.flush()

    assertTrue(chunks.size >= 2)
    assertTrue(chunks.all { it.isNotBlank() })
    assertTrue(chunks.none { it.endsWith(" ") || it.startsWith(" ") })
    assertEquals(
      "Это длинное предложение должно делиться на безопасные фрагменты без разрыва слов",
      chunks.joinToString(" "),
    )
  }

  @Test
  fun resetDiscardsStaleTextFromAnInterruptedAssistantTurn() {
    val chunker = JarvisSpeechChunker()
    chunker.append("Старый ответ, который")
    chunker.reset()

    assertEquals(listOf("Новый ответ."), chunker.append("Новый ответ. "))
  }
}
