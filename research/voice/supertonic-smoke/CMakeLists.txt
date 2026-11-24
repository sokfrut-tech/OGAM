cmake_minimum_required(VERSION 3.22.1)
project(ogam_supertonic_smoke LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

option(BUILD_HOST_RACE_TEST "Build standalone C++ generation-cancellation race stress test (no Android NDK required)" OFF)

if(BUILD_HOST_RACE_TEST)
  add_executable(supertonic_cancel_race_test
    ${CMAKE_CURRENT_SOURCE_DIR}/supertonic_cancel_race_test.cpp
  )
  find_package(Threads REQUIRED)
  target_include_directories(supertonic_cancel_race_test PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
  target_link_libraries(supertonic_cancel_race_test PRIVATE Threads::Threads)
  return()
endif()

if(NOT DEFINED SPEECH_CORE_DIR OR NOT EXISTS "${SPEECH_CORE_DIR}/src/models/litert/litert_supertonic_tts.cpp")
  message(FATAL_ERROR "SPEECH_CORE_DIR must point to pinned soniqo/speech-core@59b9d790 with supertonic-generation-cancel.patch applied")
endif()

if(NOT DEFINED UTF8PROC_DIR OR NOT EXISTS "${UTF8PROC_DIR}/utf8proc.c")
  message(FATAL_ERROR "UTF8PROC_DIR must point to JuliaStrings/utf8proc@d7bf128df773c2a1a7242eb80e51e91a769fc985")
endif()

if(NOT DEFINED LITERT_LIB_PATH OR NOT EXISTS "${LITERT_LIB_PATH}")
  message(FATAL_ERROR "LITERT_LIB_PATH must point to extracted jni/arm64-v8a/libLiteRt.so (SHA-256 6acacb3c...)")
endif()

add_library(utf8proc STATIC
  "${UTF8PROC_DIR}/utf8proc.c"
)
target_compile_definitions(utf8proc PUBLIC UTF8PROC_STATIC)
target_include_directories(utf8proc PUBLIC "${UTF8PROC_DIR}")

add_library(litert SHARED IMPORTED)
set_target_properties(litert PROPERTIES
  IMPORTED_LOCATION "${LITERT_LIB_PATH}"
  INTERFACE_INCLUDE_DIRECTORIES "${SPEECH_CORE_DIR}/third_party/litert"
)

# Isolated Supertonic-3 TTS-only closure: ZERO ONNX Runtime, ZERO libcurl, ZERO ASR/VAD/unrelated models.
add_library(jarvis_supertonic_smoke SHARED
  "${CMAKE_CURRENT_SOURCE_DIR}/supertonic_tts_smoke_jni.cpp"
  "${SPEECH_CORE_DIR}/src/models/litert/litert_supertonic_tts.cpp"
  "${SPEECH_CORE_DIR}/src/models/litert/supertonic_tokenizer.cpp"
  "${SPEECH_CORE_DIR}/src/util/text_chunker.cpp"
  "${SPEECH_CORE_DIR}/src/tts_synthesis_options.cpp"
  "${SPEECH_CORE_DIR}/src/audio/offline_spectral_de_esser.cpp"
  "${SPEECH_CORE_DIR}/third_party/fftooura/ooura_fft_engine.cpp"
  "${SPEECH_CORE_DIR}/third_party/fftooura/fft4g.cpp"
)

target_include_directories(jarvis_supertonic_smoke PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}"
  "${SPEECH_CORE_DIR}/include"
  "${SPEECH_CORE_DIR}/src"
  "${SPEECH_CORE_DIR}/third_party/litert"
  "${SPEECH_CORE_DIR}/third_party/fftooura"
)

target_compile_definitions(jarvis_supertonic_smoke PRIVATE
  _USE_MATH_DEFINES
  SPEECH_CORE_WITH_LITERT=1
)

find_library(ANDROID_LOG_LIB log REQUIRED)

target_link_libraries(jarvis_supertonic_smoke PRIVATE
  utf8proc
  litert
  ${ANDROID_LOG_LIB}
)

# Align ELF PT_LOAD segments to 16 KB pages (0x4000) for Android 15+/16 device compatibility.
target_link_options(jarvis_supertonic_smoke PRIVATE
  -Wl,-z,max-page-size=16384
)
