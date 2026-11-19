# Firefox WebDriver attempt

Date: 2026-11-19. Firefox installed at `/Applications/Firefox.app`; geckodriver
0.37.1 downloaded to the workspace cache and listening on 127.0.0.1:4444.

Session request:

```json
{"capabilities":{"alwaysMatch":{"browserName":"firefox","moz:firefoxOptions":{
  "args":["-headless"],
  "binary":"/Applications/Firefox.app/Contents/MacOS/firefox"
}}}}
```

Result:

```
HTTP 500
{"value":{"error":"unknown error","message":"Failed to decode response from marionette"}}
```

Firefox parent/child processes exit with signal 11; the log also shows
`NS_ERROR_FILE_ACCESS_DENIED` for the Crash Reports directory. This is a
host-sandbox/Firefox failure, **not** an application error. Playwright Firefox
previously failed the same way (`sandbox_init: Operation not permitted`).

Firefox gameplay remains unverified in this environment. See
`geckodriver.log` for the raw trace.
