#include "supertonic_cancel_gate.h"

#include <atomic>
#include <cassert>
#include <cstdint>
#include <iostream>
#include <thread>
#include <vector>

namespace {

using ogam::research::SupertonicCancelGate;

void test_pre_entry_cancellation_never_emits_or_starts() {
  SupertonicCancelGate gate;
  const uint64_t gen = gate.begin_request();
  gate.cancel(gen);

  assert(gate.is_cancelled(gen));
  int emitted = 0;
  auto cb = gate.wrap_callback(gen, [&](const float*, size_t, bool) { ++emitted; });
  const float sample = 0.25f;
  assert(!cb(&sample, 1, true));
  assert(emitted == 0);
}

void test_concurrent_entry_barrier_stress() {
  SupertonicCancelGate gate;
  std::atomic<int> leaked_after_cancel_done{0};
  std::atomic<int> leaked_after_join{0};
  std::atomic<int> missed_epoch_cancels{0};

  for (int iter = 0; iter < 2000; ++iter) {
    const uint64_t gen = gate.begin_request();
    std::atomic<uint64_t> cancel_epoch{0};
    std::atomic<bool> start_flag{false};
    std::atomic<bool> cancel_done{false};
    std::atomic<bool> entered_synthesis{false};
    std::atomic<uint64_t> captured_out{0};
    std::atomic<bool> cancel_done_observed{false};
    std::atomic<bool> in_post_join{false};

    auto cb = gate.wrap_callback(gen, [&](const float*, size_t, bool) {
      if (in_post_join.load(std::memory_order_acquire)) {
        leaked_after_join.fetch_add(1, std::memory_order_relaxed);
      } else if (cancel_done_observed.load(std::memory_order_acquire)) {
        leaked_after_cancel_done.fetch_add(1, std::memory_order_relaxed);
      }
    });

    std::thread synth_worker([&]() {
      while (!start_flag.load(std::memory_order_acquire)) {}
      const uint64_t captured_epoch = cancel_epoch.load(std::memory_order_seq_cst);
      if (gate.is_cancelled(gen)) return;
      entered_synthesis.store(true, std::memory_order_release);
      captured_out.store(captured_epoch, std::memory_order_release);

      const float pcm[4] = {0.1f, -0.1f, 0.2f, -0.2f};
      for (int step = 0; step < 8; ++step) {
        if (gate.is_cancelled(gen) ||
            cancel_epoch.load(std::memory_order_seq_cst) != captured_epoch) {
          return;
        }
        const bool already_cancelled = cancel_done.load(std::memory_order_acquire);
        cancel_done_observed.store(already_cancelled, std::memory_order_relaxed);
        const bool emitted = cb(pcm, 4, step == 7);
        if (already_cancelled) {
          if (emitted) {
            leaked_after_cancel_done.fetch_add(1, std::memory_order_relaxed);
          }
          return;
        }
        if (!emitted) return;
      }
    });

    std::thread barge_in_thread([&]() {
      while (!start_flag.load(std::memory_order_acquire)) {}
      gate.cancel(gen);
      cancel_epoch.fetch_add(1, std::memory_order_seq_cst);
      cancel_done.store(true, std::memory_order_release);
    });

    start_flag.store(true, std::memory_order_release);
    synth_worker.join();
    barge_in_thread.join();

    if (entered_synthesis.load(std::memory_order_acquire) &&
        cancel_epoch.load(std::memory_order_seq_cst) == captured_out.load(std::memory_order_acquire)) {
      missed_epoch_cancels.fetch_add(1, std::memory_order_relaxed);
    }

    in_post_join.store(true, std::memory_order_release);
    const float post_pcm[4] = {0.1f, -0.1f, 0.2f, -0.2f};
    if (cb(post_pcm, 4, true)) {
      leaked_after_join.fetch_add(1, std::memory_order_relaxed);
    }
  }

  assert(leaked_after_cancel_done.load() == 0);
  assert(leaked_after_join.load() == 0);
  assert(missed_epoch_cancels.load() == 0);
}

void test_newer_generation_cannot_be_cancelled_by_stale_token() {
  SupertonicCancelGate gate;
  const uint64_t g1 = gate.begin_request();
  const uint64_t g2 = gate.begin_request();

  assert(gate.is_cancelled(g1));
  assert(!gate.is_cancelled(g2));

  // Late cancel targeting g1 must NOT invalidate g2.
  gate.cancel(g1);
  assert(!gate.is_cancelled(g2));

  int g2_chunks = 0;
  auto cb2 = gate.wrap_callback(g2, [&](const float*, size_t len, bool) {
    assert(len == 2);
    ++g2_chunks;
  });
  const float pair[2] = {0.5f, -0.5f};
  assert(cb2(pair, 2, true));
  assert(g2_chunks == 1);

  gate.finish(g2);
  assert(gate.is_cancelled(g2));
}

void test_ode_mid_loop_stop_and_stale_callback_suppression() {
  SupertonicCancelGate gate;
  const uint64_t gen = gate.begin_request();
  std::vector<int> steps_executed;

  auto cb = gate.wrap_callback(gen, [&](const float*, size_t, bool) {});
  const float pcm[1] = {0.0f};
  for (int step = 0; step < 8; ++step) {
    if (step == 3) gate.cancel(gen);
    if (gate.is_cancelled(gen)) break;
    steps_executed.push_back(step);
    cb(pcm, 1, false);
  }
  assert(steps_executed.size() == 3);
  assert(!cb(pcm, 1, true));
}

}  // namespace

int main() {
  test_pre_entry_cancellation_never_emits_or_starts();
  test_concurrent_entry_barrier_stress();
  test_newer_generation_cannot_be_cancelled_by_stale_token();
  test_ode_mid_loop_stop_and_stale_callback_suppression();
  std::cout << "supertonic_cancel_race_test: all 4 stress scenarios passed\n";
  return 0;
}
