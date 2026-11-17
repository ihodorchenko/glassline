import "./styles/main.css";

import { Application } from "./app/Application";

const application = new Application();

async function bootstrap(): Promise<void> {
  try {
    await application.initialize();
    application.start();
  } catch (error) {
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
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    application.dispose();
  });
}
