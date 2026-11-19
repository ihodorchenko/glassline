import { describe, expect, it } from "vitest";

import {
  CAPTURE_FOV_DEGREES,
  CAPTURE_SHOT_IDS,
  CAPTURE_SHOTS,
  findCaptureShot,
  parseCaptureRequest,
  SUPPORTED_CAPTURE_LEVEL_ID,
  validateCaptureShots,
} from "../../src/diagnostics/captureShots";

const CANONICAL_IDS = [
  "start-roof",
  "first-gap",
  "wallrun-corridor",
  "service-block",
  "skybridge",
  "finish-roof",
] as const;

describe("parseCaptureRequest", () => {
  it("parses the canonical capture URL", () => {
    const request = parseCaptureRequest("?capture=1&level=prologue&shot=start-roof");

    expect(request).toEqual({
      levelId: "prologue",
      shotId: "start-roof",
      requestedShotId: "start-roof",
      shotKnown: true,
    });
  });

  it("resolves a known shot id", () => {
    const request = parseCaptureRequest("?capture=1&level=prologue&shot=skybridge");

    expect(request).not.toBeNull();
    expect(request?.levelId).toBe(SUPPORTED_CAPTURE_LEVEL_ID);
    expect(request?.shotId).toBe("skybridge");
    expect(request?.requestedShotId).toBe("skybridge");
    expect(request?.shotKnown).toBe(true);
  });

  it("falls back to the first shot when no shot is requested", () => {
    const request = parseCaptureRequest("?capture=1");

    expect(request?.shotId).toBe(CANONICAL_IDS[0]);
    expect(request?.requestedShotId).toBeNull();
    expect(request?.shotKnown).toBe(true);
  });

  it("accepts the `view` alias from the plan document", () => {
    const request = parseCaptureRequest("capture=true&view=finish-roof");

    expect(request?.shotId).toBe("finish-roof");
    expect(request?.shotKnown).toBe(true);
  });

  it("tolerates an unknown shot id by resolving the first shot", () => {
    const request = parseCaptureRequest("?capture=1&shot=not-a-shot");

    expect(request?.shotId).toBe(CANONICAL_IDS[0]);
    expect(request?.requestedShotId).toBe("not-a-shot");
    expect(request?.shotKnown).toBe(false);
  });

  it("ignores the capture flag when disabled or absent", () => {
    expect(parseCaptureRequest("")).toBeNull();
    expect(parseCaptureRequest("?level=prologue")).toBeNull();
    expect(parseCaptureRequest("?capture=0")).toBeNull();
    expect(parseCaptureRequest("?capture=false")).toBeNull();
  });

  it("ignores capture mode for unsupported levels", () => {
    expect(parseCaptureRequest("?capture=1&level=training")).toBeNull();
    expect(parseCaptureRequest("?capture=1&level=prologue")).not.toBeNull();
  });
});

describe("capture shot list", () => {
  it("contains exactly the six canonical Prologue shots in route order", () => {
    expect(CAPTURE_SHOTS).toHaveLength(6);
    expect(CAPTURE_SHOT_IDS).toEqual([...CANONICAL_IDS]);
    expect(new Set(CAPTURE_SHOT_IDS).size).toBe(6);
  });

  it("has finite coordinates, a positive fov, and a distinct look target", () => {
    expect(validateCaptureShots()).toEqual([]);

    for (const shot of CAPTURE_SHOTS) {
      expect(shot.fov).toBe(CAPTURE_FOV_DEGREES);
      expect(shot.fov).toBeGreaterThan(0);

      for (const component of [...shot.position, ...shot.lookAt]) {
        expect(Number.isFinite(component)).toBe(true);
      }

      expect(shot.lookAt).not.toEqual(shot.position);
      expect(shot.title.length).toBeGreaterThan(0);
    }
  });

  it("resolves ids through findCaptureShot", () => {
    expect(findCaptureShot("start-roof")?.id).toBe("start-roof");
    expect(findCaptureShot("finish-roof")?.id).toBe("finish-roof");
    expect(findCaptureShot("nope")).toBeUndefined();
  });

  it("reports structural problems of a broken list", () => {
    const baseShot = findCaptureShot("start-roof");
    const secondShot = findCaptureShot("first-gap");

    if (!baseShot || !secondShot) {
      throw new Error("Capture shot fixtures are missing.");
    }

    const broken = [
      { ...baseShot, fov: 0 },
      { ...secondShot, position: [Number.NaN, 0, 0] as const },
    ];

    const issues = validateCaptureShots(broken);

    expect(issues.some((issue) => issue.includes("Expected exactly 6 shots"))).toBe(true);
    expect(issues.some((issue) => issue.includes("invalid fov"))).toBe(true);
    expect(issues.some((issue) => issue.includes("non-finite"))).toBe(true);
  });
});
