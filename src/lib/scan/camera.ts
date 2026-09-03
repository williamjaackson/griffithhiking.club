/** The back camera, and the loop that reads codes off it.
 *
 *  `BarcodeDetector` is the browser's own reader where it has one (Chrome on
 *  Android, recent Safari). Where it does not, `barcode-detector` registers a
 *  ZXing build compiled to WebAssembly under the same name, so this file has
 *  one code path. The polyfill only steps in when the native one is missing.
 *
 *  ZXing's loader fetches its `.wasm` from a CDN by default. That is the one
 *  request guaranteed to fail at a trailhead, so the file is imported here as a
 *  build asset and the loader is told to use that URL. The page lists the same
 *  URL for the service worker to cache.
 */
import "barcode-detector/polyfill";
import { prepareZXingModule } from "barcode-detector/ponyfill";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

export { wasmUrl };

prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith(".wasm") ? wasmUrl : prefix + path,
  },
});

export interface Camera {
  stream: MediaStream;
  /** Whether the track can light its torch. */
  hasTorch: boolean;
  setTorch: (on: boolean) => Promise<void>;
  stop: () => void;
}

/** Run one detection against the frame currently shown in the viewfinder. */
export const readNow = async (video: HTMLVideoElement): Promise<string[]> => {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return [];

  const detector = new BarcodeDetector({ formats: ["qr_code"] });
  try {
    return (await detector.detect(video))
      .map((code) => code.rawValue)
      .filter((value): value is string => Boolean(value));
  } catch {
    return [];
  }
};

/** Roughly 720p and the back camera. A QR code the size of a phone screen
 *  needs no more than that, and every extra pixel slows the WebAssembly path. */
export const openCamera = async (video: HTMLVideoElement): Promise<Camera> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });

  video.srcObject = stream;
  await video.play();

  const [track] = stream.getVideoTracks();
  // `torch` is in the spec's capabilities dictionary but not every TypeScript
  // lib, and not every browser reports it.
  const capabilities = (track?.getCapabilities?.() ?? {}) as {
    torch?: boolean;
  };

  return {
    stream,
    hasTorch: capabilities.torch === true,
    setTorch: async (on) => {
      if (!track) return;
      await track.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
      });
    },
    stop: () => {
      for (const t of stream.getTracks()) t.stop();
      video.srcObject = null;
    },
  };
};

/** Read codes off the video for as long as the returned function has not been
 *  called. Each frame waits for the last detection to finish, so the loop runs
 *  as fast as the detector can and no faster. */
export const watch = (
  video: HTMLVideoElement,
  onCode: (raw: string) => void,
): (() => void) => {
  const detector = new BarcodeDetector({ formats: ["qr_code"] });
  let live = true;

  const next = () => {
    if (!live) return;
    if ("requestVideoFrameCallback" in video) {
      video.requestVideoFrameCallback(() => void tick());
    } else {
      requestAnimationFrame(() => void tick());
    }
  };

  const tick = async () => {
    if (!live) return;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        for (const code of await detector.detect(video)) {
          if (code.rawValue) onCode(code.rawValue);
        }
      } catch {
        // A frame the detector could not use. The next one usually can.
      }
    }
    next();
  };

  next();
  return () => {
    live = false;
  };
};
