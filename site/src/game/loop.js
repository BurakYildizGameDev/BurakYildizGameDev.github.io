// requestAnimationFrame loop with pause/resume. Several things can pause the game at once
// (an open card, a hidden tab, the list view), so pauses are tracked by reason and the loop only
// runs while there are none.

export function createLoop(update, render) {
  const reasons = new Set();
  let raf = 0;
  let last = 0;
  let started = false;

  function frame(now) {
    // Clamp the step so a long frame (tab switch, GC pause) doesn't teleport everything.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    const shouldRun = started && reasons.size === 0;
    if (shouldRun && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!shouldRun && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  return {
    start() {
      started = true;
      sync();
    },
    stop() {
      started = false;
      sync();
    },
    pause(reason) {
      reasons.add(reason);
      sync();
    },
    resume(reason) {
      reasons.delete(reason);
      sync();
    },
    get running() {
      return raf !== 0;
    },
  };
}
