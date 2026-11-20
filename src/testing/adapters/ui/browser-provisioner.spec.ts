import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  headlessShellDirectory,
  isBrowserInstallComplete,
  isChromiumBundleComplete,
  playwrightBrowserDirectory,
  readPlaywrightBrowsersJson,
} from "./browser-provisioner";

describe("browser install check", () => {
  let root: string;

  /** Creates `<root>/<folder>/<relative>` as an empty file and returns its path. */
  const makeExecutable = (folder: string, relative = "chrome-mac/Chromium.app/Contents/MacOS/Chromium") => {
    const executable = path.join(root, folder, relative);
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(executable, "");
    return executable;
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "solid-browser-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("is not installed when the executable is missing", () => {
    expect(isBrowserInstallComplete(path.join(root, "chromium-1228", "chrome"))).toBe(false);
  });

  it("is not installed when the executable exists but the completion marker does not", () => {
    // An install interrupted during extraction: the executable is there, the marker never was.
    const executable = makeExecutable("chromium-1228");
    expect(isBrowserInstallComplete(executable)).toBe(false);
  });

  it("is installed when the executable and the completion marker both exist", () => {
    const executable = makeExecutable("chromium-1228");
    fs.writeFileSync(path.join(root, "chromium-1228", "INSTALLATION_COMPLETE"), "");
    expect(isBrowserInstallComplete(executable)).toBe(true);
  });

  it("also requires the marker for a headless shell folder", () => {
    const executable = makeExecutable("chromium_headless_shell-1228", "chrome-headless-shell-mac/chrome-headless-shell");
    expect(isBrowserInstallComplete(executable)).toBe(false);
    fs.writeFileSync(path.join(root, "chromium_headless_shell-1228", "INSTALLATION_COMPLETE"), "");
    expect(isBrowserInstallComplete(executable)).toBe(true);
  });

  it("trusts the executable alone when it is outside a Playwright browser folder", () => {
    const executable = makeExecutable("my-own-chrome");
    expect(isBrowserInstallComplete(executable)).toBe(true);
  });

  it("finds the browser folder from deep inside it, and returns null elsewhere", () => {
    const executable = makeExecutable("chromium-1228");
    expect(playwrightBrowserDirectory(executable)).toBe(path.join(root, "chromium-1228"));
    expect(playwrightBrowserDirectory(path.join(root, "my-own-chrome", "chrome"))).toBeNull();
  });
});

describe("chromium and its headless shell", () => {
  const browsersJson = {
    browsers: [
      { name: "chromium", revision: "1228" },
      { name: "chromium-headless-shell", revision: "1228" },
    ],
  };
  let root: string;
  let chromium: string;

  const touch = (file: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "");
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "solid-browser-"));
    chromium = path.join(root, "chromium-1228", "chrome-mac", "Chromium");
    touch(chromium);
    touch(path.join(root, "chromium-1228", "INSTALLATION_COMPLETE"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("finds the headless shell folder next to the Chromium folder, by the revision in browsers.json", () => {
    expect(headlessShellDirectory(chromium, browsersJson)).toBe(path.join(root, "chromium_headless_shell-1228"));
  });

  it("has no headless shell to check for a Chromium outside a Playwright folder, or without browsers.json", () => {
    expect(headlessShellDirectory(path.join(root, "my-own-chrome", "chrome"), browsersJson)).toBeNull();
    expect(headlessShellDirectory(chromium, null)).toBeNull();
    expect(headlessShellDirectory(chromium, { browsers: [{ name: "chromium", revision: "1228" }] })).toBeNull();
  });

  it("is not complete while the headless shell is missing", () => {
    expect(isChromiumBundleComplete(chromium, browsersJson)).toBe(false);
  });

  it("is not complete when the headless shell was interrupted before its marker", () => {
    touch(path.join(root, "chromium_headless_shell-1228", "chrome-headless-shell-mac", "chrome-headless-shell"));
    expect(isChromiumBundleComplete(chromium, browsersJson)).toBe(false);
  });

  it("is complete when Chromium and the headless shell both have their markers", () => {
    touch(path.join(root, "chromium_headless_shell-1228", "chrome-headless-shell-mac", "chrome-headless-shell"));
    touch(path.join(root, "chromium_headless_shell-1228", "INSTALLATION_COMPLETE"));
    expect(isChromiumBundleComplete(chromium, browsersJson)).toBe(true);
  });

  it("is not complete when Chromium itself is interrupted, even with a finished headless shell", () => {
    touch(path.join(root, "chromium_headless_shell-1228", "INSTALLATION_COMPLETE"));
    fs.rmSync(path.join(root, "chromium-1228", "INSTALLATION_COMPLETE"));
    expect(isChromiumBundleComplete(chromium, browsersJson)).toBe(false);
  });

  it("checks only Chromium when browsers.json cannot say where the headless shell is", () => {
    expect(isChromiumBundleComplete(chromium, null)).toBe(true);
  });

  it("reads browsers.json from the installed Playwright", () => {
    const json = readPlaywrightBrowsersJson();
    expect(json?.browsers?.some((browser) => browser.name === "chromium")).toBe(true);
  });
});
