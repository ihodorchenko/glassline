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

    await application.initialize();
    bootLoader.complete();
    application.start();

    if (capture) {
      await capture.activate(application);
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
