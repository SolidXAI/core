(function () {
  "use strict";

  const uiUrl = __SOLIDX_ADMIN_EMBED_UI_URL__;
  const channel = "solidx-admin-embed";
  const collectionViews = ["list", "kanban", "tree", "card"];
  const kebabCase = (value) => value
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();

  function getTarget(options) {
    let route = options.route;
    if (options.type === "solid") {
      const { moduleName, modelName, view } = options;
      if (typeof moduleName !== "string" || !/^[\w-]+$/.test(moduleName) ||
          typeof modelName !== "string" || !/^[\w-]+$/.test(modelName) ||
          !collectionViews.includes(view)) {
        throw new Error("A SolidX view requires a moduleName, modelName, and list, kanban, tree, or card view.");
      }
      route = `/admin/core/${moduleName}/${kebabCase(modelName)}/${view}`;
    } else if (options.type !== "custom") {
      throw new Error("Set the SolidX embed type to custom or solid.");
    }
    if (typeof route !== "string" || !route.startsWith("/admin")) {
      throw new Error("Provide a SolidX /admin route.");
    }
    const target = new URL(route, uiUrl);
    if (target.origin !== new URL(uiUrl).origin || !/^\/admin(?:\/|$)/.test(target.pathname)) {
      throw new Error("Provide a SolidX /admin route.");
    }

    // Context provides defaults. The route query and explicit query options can override them.
    for (const [name, value] of Object.entries(options.context || {})) {
      if (value != null && !target.searchParams.has(name)) {
        target.searchParams.set(name, typeof value === "object" ? JSON.stringify(value) : String(value));
      }
    }
    if (options.context && !target.searchParams.has("actionContext")) {
      target.searchParams.set("actionContext", JSON.stringify(options.context));
    }
    const query = new URLSearchParams(options.query);
    for (const name of new Set(query.keys())) {
      target.searchParams.delete(name);
      for (const value of query.getAll(name)) target.searchParams.append(name, value);
    }
    return target.pathname + target.search + target.hash;
  }

  function mount(options) {
    const container = typeof options.container === "string"
      ? document.querySelector(options.container)
      : options.container;
    if (!(container instanceof Element)) throw new Error("Provide a SolidX embed container.");
    if (typeof options.tokenEndpoint !== "string" || !options.tokenEndpoint) {
      throw new Error("Provide a SolidX token endpoint on your application server.");
    }
    const tokenEndpoint = new URL(options.tokenEndpoint, window.location.href);
    if (tokenEndpoint.origin !== window.location.origin || tokenEndpoint.username || tokenEndpoint.password) {
      throw new Error("The SolidX token endpoint must be on your application's origin.");
    }
    const frameUrl = new URL(uiUrl);
    if (frameUrl.origin === window.location.origin) throw new Error("Host the SolidX embed UI on a separate origin.");
    const instanceId = crypto.randomUUID();
    frameUrl.searchParams.set("parentOrigin", window.location.origin);
    frameUrl.searchParams.set("instanceId", instanceId);
    frameUrl.hash = getTarget(options);

    const iframe = document.createElement("iframe");
    iframe.title = options.title || "SolidX admin screen";
    iframe.referrerPolicy = "no-referrer";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox");
    iframe.style.cssText = "display:block;width:100%;height:100%;border:0";
    iframe.src = frameUrl.href;

    const abort = new AbortController();
    let pending;
    const startupTimer = setTimeout(() => {
      options.onError?.(new Error("The SolidX frame did not start. Check the route and framing policy."));
    }, 30_000);
    async function receive(event) {
      const data = event.data;
      if (event.source !== iframe.contentWindow || event.origin !== frameUrl.origin
          || data?.channel !== channel || data.instanceId !== instanceId
          || data.type !== "token_request" || typeof data.requestId !== "string") return;
      clearTimeout(startupTimer);
      const send = (type, session) => {
        if (!abort.signal.aborted) {
          iframe.contentWindow?.postMessage({ channel, instanceId, type, requestId: data.requestId, session }, frameUrl.origin);
        }
      };
      const load = async () => {
        const response = await fetch(tokenEndpoint, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: abort.signal,
        });
        if (!response.ok) throw new Error("The SolidX token endpoint rejected the request.");
        const payload = await response.json();
        const session = payload?.data ?? payload;
        if (typeof session?.accessToken !== "string" || !session.user) {
          throw new Error("The SolidX token endpoint returned an invalid session.");
        }
        return { accessToken: session.accessToken, user: session.user };
      };
      try {
        pending ??= load().finally(() => { pending = undefined; });
        send("token", await pending);
      } catch (error) {
        send("token_error");
        if (!abort.signal.aborted) options.onError?.(error);
      }
    }

    window.addEventListener("message", receive);
    container.append(iframe);
    return {
      destroy() {
        abort.abort();
        clearTimeout(startupTimer);
        window.removeEventListener("message", receive);
        iframe.remove();
      },
    };
  }

  window.SolidXAdminEmbed = { mount };
})();
