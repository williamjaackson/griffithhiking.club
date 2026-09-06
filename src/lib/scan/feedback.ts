/** What a leader hears and feels on a read.
 *
 *  Three outcomes, three signals, each different in pitch, length and rhythm, so
 *  they can be told apart with the phone at arm's length in daylight without
 *  reading the screen. Sound is made by an oscillator rather than played from a
 *  file: there is nothing to download, nothing to cache and nothing to fail to
 *  load in aeroplane mode.
 *
 *  iOS refuses to start audio until the page has been tapped, so the context is
 *  created in `arm`, which the Start button calls. Vibration is Android only,
 *  which is why it is never the only signal.
 */

/** Go is a check-in or check-out that went through with nothing missing. Wait
 *  is a repeat: already in, or already out. Stop is anything the leader should
 *  look at: a missing number, a stranger's code, someone who never checked in. */
export type Signal = "go" | "wait" | "stop";

interface Note {
  hz: number;
  seconds: number;
}

/** Go rises, wait is flat, and stop is low and long. */
const TONES: Record<Signal, Note[]> = {
  go: [
    { hz: 880, seconds: 0.08 },
    { hz: 1320, seconds: 0.11 },
  ],
  wait: [{ hz: 660, seconds: 0.16 }],
  stop: [{ hz: 220, seconds: 0.3 }],
};

const BUZZ: Record<Signal, number[]> = {
  go: [40],
  wait: [30, 50, 30],
  stop: [180],
};

export class Feedback {
  #context: AudioContext | null = null;

  /** Call from a tap. Creating the context anywhere else leaves it suspended. */
  arm() {
    if (!this.#context && "AudioContext" in window) {
      this.#context = new AudioContext();
    }
    void this.#context?.resume();
  }

  play(signal: Signal) {
    this.#beep(TONES[signal]);
    navigator.vibrate?.(BUZZ[signal]);
  }

  #beep(notes: Note[]) {
    const context = this.#context;
    if (!context) return;

    let start = context.currentTime;
    for (const { hz, seconds } of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = hz;

      // A short ramp at each end, so the note does not click on and off.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.01);
      gain.gain.setValueAtTime(0.25, start + seconds - 0.02);
      gain.gain.linearRampToValueAtTime(0, start + seconds);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + seconds);
      start += seconds;
    }
  }
}
