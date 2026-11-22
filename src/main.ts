import "./styles/main.css";

import { Application } from "./app/Application";
import { DEFAULT_APPLICATION_CONFIG } from "./app/ApplicationConfig";
import { BootLoader } from "./boot/BootLoader";

const bootLoader = new BootLoader();
const application = new Application({
  ...DEFAULT_APPLICATION_CONFIG,
  onBootStage: (stage) => bootLoader.setStage(stage),
});

async function bootstrap(): Promise<void> {
  try {
    // Dev-only deterministic screenshot boot (`?capture=1&level=prologue&shot=<id>`).
    // The dynamic import keeps CaptureMode out of the production bundle entirely.
    const capture = import.meta.env.DEV
      ? (await import("./diagnostics/CaptureMode")).prepareCaptureMode()
      : null;

    // Dev-only playable level boot (`?dev=first_section`). It starts the normal
    // gameplay lifecycle and is never loaded in production. The deterministic
    // capture contract owns the page when both are requested, because capture
    // mode deliberately freezes the camera and world for screenshots.
    const devLaunch =
      import.meta.env.DEV && capture === null
        ? (await import("./diagnostics/DevLaunch")).prepareDevLaunch()
        : null;

    await application.initialize();
    bootLoader.complete();
    application.start();

    if (capture) {
      await capture.activate(application);
    }

    if (devLaunch?.kind === "launch") {
      await devLaunch.handle.activate(application);
    }
  } catch (error) {
    bootLoader.fail(error);
    console.error("[Glassline] Fatal startup error.", error);
  }
}

window.addEventListener("error", (event) => {
  console.error("[Glassline] Unhandled error.", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Glassline] Unhandled promise rejection.", event.reason);
});

window.addEventListener("beforeunload", () => {
  application.dispose();
});

void bootstrap();

if (import.meta.env.DEV) {
  (window as Window & { __glassline?: Application }).__glassline = application;

  void import("./audio/audioDemo").then((module) => {
    (
      window as Window & {
        __glasslineAudioDemo?: typeof module.renderAudioDemo;
        __glasslineHighRouteAudioDemo?: typeof module.renderHighRouteAudioDemo;
      }
    ).__glasslineAudioDemo = module.renderAudioDemo;
    (
      window as Window & {
        __glasslineHighRouteAudioDemo?: typeof module.renderHighRouteAudioDemo;
      }
    ).__glasslineHighRouteAudioDemo = module.renderHighRouteAudioDemo;
  });
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    application.dispose();
  });
}
