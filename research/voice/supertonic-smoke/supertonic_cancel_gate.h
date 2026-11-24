#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <utility>

namespace ogam::research {

/**
 * Monotonic generation gate protecting Supertonic synthesis requests against pre-entry
 * cancellation races and late JNI/audio callbacks.
 *
 * Unlike a mutable `bool cancelled = false` reset at `synthesize()` entry, every new request
 * advances a monotonic generation counter and records its own active generation. Any concurrent
 * `cancel(gen)` or `cancel_all()` permanently invalidates that generation (and older ones) before,
 * during, or after native synthesis.
 */
class SupertonicCancelGate {
public:
  /** Begin a new request and capture its unique monotonic generation token (>= 1). */
  uint64_t begin_request() noexcept {
    const uint64_t next_gen = next_generation_.fetch_add(1, std::memory_order_acq_rel) + 1;
    active_generation_.store(next_gen, std::memory_order_seq_cst);
    return next_gen;
  }

  /** Return true if `generation` is no longer the live non-cancelled request. */
  bool is_cancelled(uint64_t generation) const noexcept {
    if (generation == 0) return true;
    return active_generation_.load(std::memory_order_seq_cst) != generation;
  }

  /** Cancel a specific generation cleanly without clobbering a newer request. */
  void cancel(uint64_t generation) noexcept {
    if (generation == 0) return;
    uint64_t expected = generation;
    active_generation_.compare_exchange_strong(
        expected,
        0,
        std::memory_order_seq_cst,
        std::memory_order_seq_cst);
  }

  /** Cancel whichever generation is currently active. */
  void cancel_all() noexcept {
    active_generation_.store(0, std::memory_order_seq_cst);
  }

  /** Mark request complete if it is still the active generation. */
  void finish(uint64_t generation) noexcept {
    cancel(generation);
  }

  /**
   * Wrap a PCM chunk callback so late chunks emitted after cancellation or after a newer
   * generation started are silently dropped before crossing back across JNI.
   */
  template <typename Callback>
  auto wrap_callback(uint64_t generation, Callback&& cb) const {
    return [this, generation, fn = std::forward<Callback>(cb)](
               const float* samples,
               size_t length,
               bool is_final) -> bool {
      if (is_cancelled(generation)) {
        return false;
      }
      fn(samples, length, is_final);
      return !is_cancelled(generation);
    };
  }

private:
  std::atomic<uint64_t> next_generation_{0};
  std::atomic<uint64_t> active_generation_{0};
};

}  // namespace ogam::research
