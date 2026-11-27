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
    assertTrue(chunker.append("дела?").isEmpty())
    assertEquals(listOf("Как дела?"), chunker.flush())
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
  fun keepsSpacedRussianAbbreviationsInsideTheSameSentence() {
    val chunker = JarvisSpeechChunker()

    assertEquals(
      listOf("В комплект входят винты, гайки и т. д. — всё готово."),
      chunker.append("В комплект входят винты, гайки и т. д. — всё готово. "),
    )
  }

  @Test
  fun closesQuotedSentenceBeforeStartingTheNextSentence() {
    val chunker = JarvisSpeechChunker()

    assertEquals(
      listOf("Он сказал: «Привет!»", "Как дела?"),
      chunker.append("Он сказал: «Привет!» Как дела? "),
    )
    assertEquals(
      listOf("The task is complete.”", "What is next?"),
      chunker.append("The task is complete.” What is next? "),
    )
  }

  @Test
  fun keepsInitialsTogether() {
    val chunker = JarvisSpeechChunker()

    assertEquals(
      listOf("А. С. Пушкин написал стихотворение."),
      chunker.append("А. С. Пушкин написал стихотворение. "),
    )
    assertTrue(chunker.flush().isEmpty())
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
