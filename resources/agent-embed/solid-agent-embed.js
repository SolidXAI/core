/* SolidX AgentHub Embed SDK v2. No dependencies; credentials stay in memory. */
(function (global) {
  "use strict";
  if (global.SolidAgentEmbed && global.SolidAgentEmbed.version === 2) return;
  var channel = "solidx-agent-embed";
  var hostedUiOrigin = __SOLIDX_AGENT_EMBED_UI_ORIGIN__;
  function debug(instanceId, event, details) {
    if (global.console && typeof global.console.info === "function") global.console.info("[agent-embed][sdk] " + event, Object.assign({ instanceId: instanceId }, details || {}));
  }
  function mount(options) {
    var container = typeof options.container === "string" ? document.querySelector(options.container) : options.container;
    if (!container || !container.appendChild) throw new Error("Provide an existing container element.");
    if (!Number.isSafeInteger(options.agentId) || options.agentId <= 0) throw new Error("Provide a valid agentId.");
    var embedUrl = new URL("/embed/agent/" + options.agentId, hostedUiOrigin);
    var endpoint = new URL(options.tokenEndpoint, location.href);
    if (!/^https?:$/.test(embedUrl.protocol) || !/^https?:$/.test(endpoint.protocol)) throw new Error("Use HTTP or HTTPS URLs.");
    if (embedUrl.username || embedUrl.password || endpoint.username || endpoint.password) throw new Error("Credentials cannot be placed in URLs.");
    if (location.protocol === "https:" && (embedUrl.protocol !== "https:" || endpoint.protocol !== "https:")) throw new Error("Use HTTPS URLs on HTTPS pages.");
    var id = crypto.randomUUID();
    debug(id, "mount", { agentId: options.agentId, hostedUiOrigin: hostedUiOrigin, iframePath: embedUrl.pathname,
      tokenEndpointOrigin: endpoint.origin, tokenEndpointPath: endpoint.pathname, pageOrigin: location.origin });
    embedUrl.searchParams.set("parentOrigin", location.origin);
    embedUrl.searchParams.set("instanceId", id);
    var inputs = JSON.parse(JSON.stringify(options.inputs || {}));
    var destroyed = false, initialized = false, locked = false, open = false, ready = false, tokenFlight = null;
    var pending = new Map();
    var controller = null, loadTimer = null;
    var launcherHost = document.createElement("span");
    container.appendChild(launcherHost);
    var launcherRoot = launcherHost.attachShadow({ mode: "open" });
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = options.label || "Chat with us";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-haspopup", "dialog");
    var buttonStyle = document.createElement("style");
    buttonStyle.textContent = "button{font:600 14px system-ui;cursor:pointer;border:0;border-radius:999px;padding:12px 18px;color:white;background:#202c44}button:focus-visible{outline:3px solid #779bff;outline-offset:3px}";
    launcherRoot.append(buttonStyle, button);
    var popoverHost = document.createElement("div");
    popoverHost.style.cssText = "position:fixed;z-index:2147483000;display:none;";
    document.body.appendChild(popoverHost);
    var root = popoverHost.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = ":host{font:14px system-ui;color:#172033}section{position:relative;height:100%;display:flex;flex-direction:column;background:#fff;border:1px solid #d8dee8;border-radius:14px;box-shadow:0 16px 60px #0003;overflow:hidden;box-sizing:border-box}button{font:inherit;cursor:pointer;border:0;border-radius:8px}button:focus-visible{outline:2px solid #4263eb;outline-offset:2px}iframe{flex:1;min-height:0;width:100%;border:0;background:#fff}.close-button{position:absolute;z-index:2;top:10px;right:10px;width:34px;height:34px;display:grid;place-items:center;padding:0;background:rgba(255,255,255,.94);color:#243247;border:1px solid #dce3eb;border-radius:50%;box-shadow:0 3px 12px #13233a20;font-size:22px;line-height:1;transition:background .15s,transform .15s}.close-button:hover{background:#fff;transform:scale(1.05)}.embed-status{position:absolute;z-index:3;top:54px;left:12px;right:12px;padding:10px 12px;border:1px solid #f0d0ca;border-radius:10px;background:#fff8f6;color:#a13b2b;box-shadow:0 5px 18px #17203314;font-size:13px;line-height:1.45}";
    var panel = document.createElement("section");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", options.title || "Agent chat");
    panel.id = "chat-" + id;
    button.setAttribute("aria-controls", panel.id);
    var closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "close-button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close agent chat");
    closeButton.title = "Close chat";
    var status = document.createElement("div");
    status.className = "embed-status";
    status.setAttribute("role", "alert");
    status.style.display = "none";
    panel.append(closeButton, status);
    root.append(style, panel);
    var frame = document.createElement("iframe");
    frame.title = options.title || "Agent chat";
    frame.referrerPolicy = "no-referrer";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads allow-popups");
    panel.insertBefore(frame, closeButton);
    function emitError(error) {
      if (destroyed) return;
      status.textContent = error.message || String(error);
      status.style.display = "block";
      if (typeof options.onError === "function") options.onError(error);
    }
    function post(type, data) {
      if (!destroyed && frame.contentWindow) frame.contentWindow.postMessage(Object.assign({ channel: channel, version: 1, instanceId: id, type: type }, data || {}), embedUrl.origin);
    }
    function position() {
      if (!open) return;
      var bounds = button.getBoundingClientRect();
      var width = Math.min(Math.max(240, Number(options.width) || 420), Math.max(1, innerWidth - 24));
      var height = Math.min(Math.max(240, Number(options.height) || 600), Math.max(1, innerHeight - 24));
      var left = Math.max(12, Math.min(bounds.right - width, innerWidth - width - 12));
      var top = bounds.top >= height + 20 ? bounds.top - height - 8 : Math.min(bounds.bottom + 8, innerHeight - height - 12);
      popoverHost.style.width = width + "px";
      popoverHost.style.height = height + "px";
      popoverHost.style.left = left + "px";
      popoverHost.style.top = Math.max(12, top) + "px";
    }
    function fetchToken() {
      if (tokenFlight) { debug(id, "token request deduplicated"); return tokenFlight; }
      controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 20000);
      debug(id, "token exchange started", { endpointOrigin: endpoint.origin, endpointPath: endpoint.pathname });
      tokenFlight = Promise.resolve().then(function () {
        var extraHeaders = typeof options.getTokenHeaders === "function" ? options.getTokenHeaders() : (options.tokenHeaders || {});
        debug(id, "sending token exchange", { hasAuthorizationHeader: !!(extraHeaders && extraHeaders.Authorization) });
        return fetch(endpoint.href, { method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
          headers: Object.assign({ "Content-Type": "application/json" }, extraHeaders), body: JSON.stringify({ agentId: options.agentId }) });
      }).then(function (response) {
        debug(id, "token endpoint response", { status: response.status, ok: response.ok, contentType: response.headers.get("content-type") });
        if (!response.ok) throw new Error("Chat authentication failed (HTTP " + response.status + ").");
        return response.json();
      }).then(function (auth) {
        var valid = !!auth && auth.embed === true && auth.agentId === options.agentId && !!auth.agentToken && !!auth.wsUrl && !!auth.httpUrl && Array.isArray(auth.requiredInputs);
        debug(id, "token response validated", { valid: valid, embed: !!auth && auth.embed === true,
          agentIdMatches: !!auth && auth.agentId === options.agentId, hasAgentToken: !!auth && !!auth.agentToken,
          hasWsUrl: !!auth && !!auth.wsUrl, hasHttpUrl: !!auth && !!auth.httpUrl,
          requiredInputsIsArray: !!auth && Array.isArray(auth.requiredInputs) });
        if (!valid) throw new Error("The token endpoint returned an invalid embed response.");
        return auth;
      }).catch(function (error) {
        debug(id, "token exchange failed", { name: error && error.name, message: error && error.message });
        throw error;
      }).finally(function () { clearTimeout(timeout); controller = null; tokenFlight = null; });
      return tokenFlight;
    }
    function receive(event) {
      var data = event.data;
      if (destroyed) return;
      if (event.source !== frame.contentWindow || event.origin !== embedUrl.origin || !data
          || data.channel !== channel || data.version !== 1 || data.instanceId !== id) {
        debug(id, "ignored postMessage", { sourceMatchesFrame: event.source === frame.contentWindow,
          originMatchesHostedUi: event.origin === embedUrl.origin, hasData: !!data,
          channelMatches: !!data && data.channel === channel, versionMatches: !!data && data.version === 1,
          instanceMatches: !!data && data.instanceId === id });
        return;
      }
      debug(id, "received iframe message", { type: data.type, requestId: data.requestId });
      if (data.type === "ready") { ready = true; clearTimeout(loadTimer); debug(id, "iframe ready"); }
      else if (data.type === "close") hide();
      else if (data.type === "token_request") {
        fetchToken().then(function (auth) { debug(id, "sending token bootstrap to iframe", { requestId: data.requestId, inputsCount: Object.keys(inputs).length }); post("token", { requestId: data.requestId, auth: auth, inputs: inputs }); })
          .catch(function (error) { post("token_error", { requestId: data.requestId, error: error.message }); emitError(error); });
      } else if (data.type === "authenticated") { status.style.display = "none"; }
      else if (data.type === "error") emitError(new Error(data.error));
      else if (data.type === "inputs_locked") locked = !!data.locked;
      else if (data.type === "inputs_result") {
        var request = pending.get(data.requestId);
        if (request) { clearTimeout(request.timer); pending.delete(data.requestId); data.ok ? request.resolve() : request.reject(new Error(data.error)); }
      }
    }
    function show() {
      if (destroyed) throw new Error("This embed was destroyed.");
      open = true;
      popoverHost.style.display = "block";
      button.setAttribute("aria-expanded", "true");
      position();
      if (!initialized) {
        initialized = true; debug(id, "opening hosted iframe", { iframeUrl: embedUrl.href }); frame.src = embedUrl.href; panel.appendChild(frame);
        loadTimer = setTimeout(function () { if (!ready) emitError(new Error("The hosted chat did not load. Check its URL and framing policy.")); }, 20000);
      }
      closeButton.focus();
    }
    function hide() { open = false; popoverHost.style.display = "none"; button.setAttribute("aria-expanded", "false"); button.focus(); }
    function escape(event) { if (open && event.key === "Escape") hide(); }
    function toggle() { open ? hide() : show(); }
    button.addEventListener("click", toggle);
    closeButton.addEventListener("click", hide);
    global.addEventListener("message", receive);
    global.addEventListener("resize", position);
    global.addEventListener("scroll", position, true);
    global.addEventListener("keydown", escape);
    return {
      open: show,
      close: hide,
      setInputs: function (next) {
        if (destroyed) return Promise.reject(new Error("This embed was destroyed."));
        if (locked) return Promise.reject(new Error("Start a new chat before changing inputs."));
        var copy = JSON.parse(JSON.stringify(next));
        if (!copy || typeof copy !== "object" || Array.isArray(copy)) return Promise.reject(new Error("inputs must be an object."));
        if (!ready) { inputs = copy; return Promise.resolve(); }
        var requestId = crypto.randomUUID();
        return new Promise(function (resolve, reject) {
          var timer = setTimeout(function () { pending.delete(requestId); reject(new Error("Input update timed out.")); }, 10000);
          pending.set(requestId, { timer: timer, resolve: function () { inputs = copy; resolve(); }, reject: reject });
          post("set_inputs", { requestId: requestId, inputs: copy });
        });
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        clearTimeout(loadTimer);
        if (controller) controller.abort();
        pending.forEach(function (request) { clearTimeout(request.timer); request.reject(new Error("Embed destroyed.")); });
        pending.clear();
        global.removeEventListener("message", receive);
        global.removeEventListener("resize", position);
        global.removeEventListener("scroll", position, true);
        global.removeEventListener("keydown", escape);
        launcherHost.remove(); popoverHost.remove();
      }
    };
  }
  global.SolidAgentEmbed = { version: 2, mount: mount };
})(window);
