/* SolidX AgentHub Embed SDK v7. No dependencies; credentials stay in memory.
 * mode: "popup" (default) owns its launcher and floating window.
 * mode: "inline" fills the supplied container; the host owns its layout.
 * mountWorkspace owns the host layout around an inline chat.
 */
(function (global) {
  "use strict";
  if (global.SolidAgentEmbed && global.SolidAgentEmbed.version >= 7) return;
  var channel = "solidx-agent-embed";
  var publicProtocolVersion = 2;
  var maxContextBytes = 32 * 1024;
  var hostedUiOrigin = __SOLIDX_AGENT_EMBED_UI_ORIGIN__;
  function debug(instanceId, event, details) {
    if (global.console && typeof global.console.info === "function") global.console.info("[agent-embed][sdk] " + event, Object.assign({ instanceId: instanceId }, details || {}));
  }
  function mount(options) {
    var mode = options.mode === undefined ? "popup" : options.mode;
    if (mode !== "popup" && mode !== "inline") throw new Error("mode must be popup or inline.");
    var inline = mode === "inline";
    var container = typeof options.container === "string" ? document.querySelector(options.container) : options.container;
    if (!container || !container.appendChild) throw new Error("Provide an existing container element.");
    var hasAgentId = options.agentId !== undefined;
    var hasAgentName = options.agentName !== undefined;
    if (hasAgentId === hasAgentName) throw new Error("Provide exactly one of agentId or agentName.");
    if (hasAgentId && (!Number.isSafeInteger(options.agentId) || options.agentId <= 0)) throw new Error("Provide a valid agentId.");
    if (hasAgentName && (typeof options.agentName !== "string" || !options.agentName.trim())) throw new Error("Provide a valid agentName.");
    var resolvedAgentId = hasAgentId ? options.agentId : null;
    var embedUrl = new URL("/embed/agent/" + (resolvedAgentId || ""), hostedUiOrigin);
    var endpoint = new URL(options.tokenEndpoint, location.href);
    if (!/^https?:$/.test(embedUrl.protocol) || !/^https?:$/.test(endpoint.protocol)) throw new Error("Use HTTP or HTTPS URLs.");
    if (embedUrl.username || embedUrl.password || endpoint.username || endpoint.password) throw new Error("Credentials cannot be placed in URLs.");
    if (location.protocol === "https:" && (embedUrl.protocol !== "https:" || endpoint.protocol !== "https:")) throw new Error("Use HTTPS URLs on HTTPS pages.");
    var id = crypto.randomUUID();
    debug(id, "mount", { agentId: resolvedAgentId, agentName: options.agentName, hostedUiOrigin: hostedUiOrigin, iframePath: embedUrl.pathname,
      tokenEndpointOrigin: endpoint.origin, tokenEndpointPath: endpoint.pathname, pageOrigin: location.origin });
    embedUrl.searchParams.set("parentOrigin", location.origin);
    embedUrl.searchParams.set("instanceId", id);
    var inputs = JSON.parse(JSON.stringify(options.inputs || {}));
    var workspaceState = options.workspace || null;
    var destroyed = false, initialized = false, locked = false, open = false, windowMode = "popup", ready = false, tokenFlight = null;
    var pending = new Map();
    var listeners = new Map(), beforeSendListeners = [], contextSnapshots = new Map(), listenerOrder = 0, eventSequence = 0;
    var controller = null, loadTimer = null, bootstrapAuth = null;
    var launcherHost = null, button = null;
    if (!inline) {
      launcherHost = document.createElement("span");
      container.appendChild(launcherHost);
      var launcherRoot = launcherHost.attachShadow({ mode: "open" });
      button = document.createElement("button");
      button.type = "button";
      button.textContent = options.label || "Chat with us";
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-haspopup", "dialog");
      var buttonStyle = document.createElement("style");
      buttonStyle.textContent = "button{font:600 14px system-ui;cursor:pointer;border:0;border-radius:999px;padding:12px 18px;color:white;background:#202c44}button:focus-visible{outline:3px solid #779bff;outline-offset:3px}";
      launcherRoot.append(buttonStyle, button);
    }
    var surfaceHost = document.createElement("div");
    surfaceHost.style.cssText = inline ? "display:none;width:100%;height:100%;min-height:0;" : "position:fixed;z-index:2147483000;display:none;";
    (inline ? container : document.body).appendChild(surfaceHost);
    var root = surfaceHost.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = ":host{font:14px system-ui;color:#172033}section{position:relative;height:100%;display:flex;flex-direction:column;background:#fff;border:1px solid #d8dee8;border-radius:14px;box-shadow:0 16px 60px #0003;overflow:hidden;box-sizing:border-box}button{font:inherit;cursor:pointer;border:0;border-radius:8px}button:focus-visible{outline:2px solid #779bff;outline-offset:2px}.control-bar{position:relative;z-index:2;flex:0 0 34px;display:flex;align-items:center;justify-content:center;background:#f8fafc;border-bottom:1px solid #e7ecf2}.control-group{display:flex;align-items:center;gap:1px;padding:2px;border:1px solid #29364d;border-radius:999px;background:#172033;box-shadow:0 3px 8px #17203326}.window-control{width:25px;height:25px;display:grid;place-items:center;padding:0;border-radius:50%;background:transparent;color:#fff;transition:background .15s,transform .15s}.window-control:hover{background:#ffffff24;transform:scale(1.04)}.window-control svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}iframe{flex:1;min-height:0;width:100%;border:0;background:#fff}.embed-status{position:absolute;z-index:5;top:44px;left:12px;right:12px;padding:10px 12px;border:1px solid #f0d0ca;border-radius:10px;background:#fff8f6;color:#a13b2b;box-shadow:0 5px 18px #17203314;font-size:13px;line-height:1.45}";
    if (inline) style.textContent += "section{border:0;border-radius:0;box-shadow:none}.embed-status{top:12px}";
    var panel = document.createElement("section");
    panel.setAttribute("role", inline ? "region" : "dialog");
    panel.setAttribute("aria-label", options.title || "Agent chat");
    panel.id = "chat-" + id;
    if (button) button.setAttribute("aria-controls", panel.id);
    var minimizeButton, dockLeftButton, maximizeButton, dockRightButton, closeButton;
    if (!inline) {
      var controlBar = document.createElement("div");
      controlBar.className = "control-bar";
      var controlGroup = document.createElement("div");
      controlGroup.className = "control-group";
      function makeControl(label, title, icon) {
        var control = document.createElement("button");
        control.type = "button";
        control.className = "window-control";
        control.setAttribute("aria-label", label);
        control.title = title;
        control.innerHTML = icon;
        return control;
      }
      minimizeButton = makeControl("Minimize agent chat", "Minimize chat", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>');
      dockLeftButton = makeControl("Dock agent chat left", "Dock left", '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>');
      maximizeButton = makeControl("Make agent chat full screen", "Full screen", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>');
      dockRightButton = makeControl("Dock agent chat right", "Dock right", '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>');
      closeButton = makeControl("Close agent chat", "Close chat", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>');
      controlGroup.append(minimizeButton, dockLeftButton, maximizeButton, dockRightButton, closeButton);
      controlBar.appendChild(controlGroup);
      panel.appendChild(controlBar);
    }
    var status = document.createElement("div");
    status.className = "embed-status";
    status.setAttribute("role", "alert");
    status.style.display = "none";
    panel.appendChild(status);
    root.append(style, panel);
    var frame = document.createElement("iframe");
    frame.title = options.title || "Agent chat";
    frame.referrerPolicy = "no-referrer";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads allow-popups");
    panel.appendChild(frame);
    function emitError(error) {
      if (destroyed) return;
      status.textContent = error.message || String(error);
      status.style.display = "block";
      if (typeof options.onError === "function") options.onError(error);
    }
    function emitRecovered() {
      if (destroyed) return;
      status.style.display = "none";
      if (typeof options.onRecovered === "function") options.onRecovered();
    }
    function post(type, data) {
      if (!destroyed && frame.contentWindow) frame.contentWindow.postMessage(Object.assign({ channel: channel, version: 1, instanceId: id, type: type }, data || {}), embedUrl.origin);
    }
    function isPlainObject(value) { return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
    function payloadSize(value) {
      var encoded = JSON.stringify(value);
      return new TextEncoder().encode(encoded).length;
    }
    function isJsonValue(value, depth) {
      if (depth > 16) return false;
      if (value === null || typeof value === "string" || typeof value === "boolean") return true;
      if (typeof value === "number") return Number.isFinite(value);
      if (Array.isArray(value)) return value.length <= 1024 && value.every(function (item) { return isJsonValue(item, depth + 1); });
      if (!isPlainObject(value)) return false;
      return Object.keys(value).every(function (key) { return isJsonValue(value[key], depth + 1); });
    }
    function emit(event, payload) {
      var notification = Object.assign({ protocolVersion: publicProtocolVersion, instanceId: id, agentId: resolvedAgentId,
        eventId: crypto.randomUUID(), sequence: ++eventSequence, occurredAt: new Date().toISOString() }, payload || {});
      (listeners.get(event) || []).slice().forEach(function (entry) {
        try { entry.listener(notification); } catch (error) { debug(id, "public listener failed", { event: event, message: error && error.message }); }
      });
    }
    function collectBeforeSend(request) {
      if (!isPlainObject(request) || typeof request.text !== "string" || !["composer", "sdk", "prefill", "widget"].includes(request.source)
          || !Array.isArray(request.attachments) || request.attachments.length > 5 || payloadSize(request) > 256 * 1024) return Promise.reject(new Error("Invalid before-send request."));
      if (!request.attachments.every(function (item) { return isPlainObject(item) && typeof item.name === "string"
          && typeof item.mimeType === "string" && Number.isFinite(item.size) && item.size >= 0; }))
        return Promise.reject(new Error("Invalid attachment descriptors in before-send request."));
      request.attachments.forEach(function (item) { Object.freeze(item); });
      Object.freeze(request.attachments);
      Object.freeze(request);
      var controller = new AbortController();
      var timeout = Math.min(Math.max(1, Number(options.beforeSendTimeoutMs) || 3000), 10000);
      var timer = setTimeout(function () { controller.abort(); }, timeout);
      var aborted = new Promise(function (_, reject) {
        controller.signal.addEventListener("abort", function () { reject(new Error("Host context preparation timed out.")); }, { once: true });
      });
      var namespaces = Object.create(null);
      return Promise.race([beforeSendListeners.slice().sort(function (a, b) { return a.priority - b.priority || a.order - b.order; })
        .reduce(function (chain, entry) {
          return chain.then(function () {
            if (controller.signal.aborted) throw new Error("Host context preparation timed out.");
            var listenerTimeout = Math.min(Math.max(1, Number(entry.timeoutMs) || timeout), timeout);
            var listenerTimer;
            return Promise.race([
              Promise.resolve(entry.listener(request, controller.signal)),
              new Promise(function (_, reject) { listenerTimer = setTimeout(function () {
                controller.abort(); reject(new Error("Host context listener timed out: " + entry.namespace));
              }, listenerTimeout); })
            ]).finally(function () { clearTimeout(listenerTimer); }).then(function (result) {
              if (controller.signal.aborted) throw new Error("Host context preparation timed out.");
              if (!isPlainObject(result)) throw new Error("Before-send listeners must return a context contribution.");
              if (result.cancelled === true) throw new Error(typeof result.reason === "string" ? result.reason : "Message preparation was cancelled.");
              if (!("context" in result) || !isJsonValue(result.context, 0) || typeof result.revision !== "string"
                  || result.revision.length > 256
                  || (result.displaySummary !== undefined && (typeof result.displaySummary !== "string" || result.displaySummary.length > 1024)))
                throw new Error("A before-send listener returned an invalid contribution.");
              if (Object.prototype.hasOwnProperty.call(namespaces, entry.namespace)) throw new Error("A context namespace was contributed more than once.");
              var contextCopy = JSON.parse(JSON.stringify(result.context));
              namespaces[entry.namespace] = { context: contextCopy, revision: result.revision,
                ...(result.displaySummary !== undefined ? { displaySummary: result.displaySummary } : {}) };
            });
          });
        }, Promise.resolve())
        .then(function () {
          contextSnapshots.forEach(function (snapshot, namespace) {
            if (!Object.prototype.hasOwnProperty.call(namespaces, namespace)
                && !beforeSendListeners.some(function (entry) { return entry.namespace === namespace; })) namespaces[namespace] = snapshot;
          });
          (options.requiredNamespaces || []).forEach(function (namespace) {
            if (!Object.prototype.hasOwnProperty.call(namespaces, namespace)) throw new Error("Required context is unavailable: " + namespace);
          });
          var value = { schemaVersion: 1, namespaces: namespaces };
          if (payloadSize(value) > maxContextBytes) throw new Error("Prepared message context exceeds 32 KiB.");
          return value;
        })
        .finally(function () { clearTimeout(timer); }), aborted]).finally(function () { clearTimeout(timer); });
    }
    function runBeforeSend(data) {
      var requestId = data.requestId;
      if (typeof requestId !== "string" || data.protocolVersion !== publicProtocolVersion) return;
      Promise.resolve().then(function () { return collectBeforeSend(data.request); }).then(function (messageContext) {
        post("before_send_result", { protocolVersion: publicProtocolVersion, requestId: requestId, ok: true, message_context: messageContext });
      }).catch(function (error) {
        post("before_send_result", { protocolVersion: publicProtocolVersion, requestId: requestId, ok: false,
          error: String(error && error.message || "Message context could not be prepared.").slice(0, 1024) });
      });
    }
    function sendCommand(command, payload) {
      if (destroyed) return Promise.reject(new Error("This embed was destroyed."));
      if (!ready) return Promise.reject(new Error("The hosted chat is not ready."));
      var requestId = crypto.randomUUID();
      return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () { pending.delete(requestId); reject(new Error("Embed command timed out.")); }, 10000);
        pending.set(requestId, { timer: timer, resolve: resolve, reject: reject });
        post("command", { protocolVersion: publicProtocolVersion, requestId: requestId, command: command, payload: payload || {} });
      });
    }
    function position() {
      if (!open || inline) return;
      if (windowMode === "fullscreen") {
        var inset = 16;
        surfaceHost.style.width = "calc(100vw - " + inset * 2 + "px)";
        surfaceHost.style.height = "calc(100dvh - " + inset * 2 + "px)";
        surfaceHost.style.left = inset + "px";
        surfaceHost.style.right = "auto";
        surfaceHost.style.top = inset + "px";
        return;
      }
      if (windowMode === "dock-left" || windowMode === "dock-right") {
        var dockInset = 12;
        var dockWidth = Math.min(Math.max(280, Number(options.width) || 420), Math.max(1, innerWidth - dockInset * 2));
        surfaceHost.style.width = dockWidth + "px";
        surfaceHost.style.height = "calc(100dvh - " + dockInset * 2 + "px)";
        surfaceHost.style.left = windowMode === "dock-left" ? dockInset + "px" : "auto";
        surfaceHost.style.right = windowMode === "dock-right" ? dockInset + "px" : "auto";
        surfaceHost.style.top = dockInset + "px";
        return;
      }
      surfaceHost.style.right = "auto";
      var bounds = button.getBoundingClientRect();
      var width = Math.min(Math.max(240, Number(options.width) || 420), Math.max(1, innerWidth - 24));
      var height = Math.min(Math.max(240, Number(options.height) || 600), Math.max(1, innerHeight - 24));
      var left = Math.max(12, Math.min(bounds.right - width, innerWidth - width - 12));
      var top = bounds.top >= height + 20 ? bounds.top - height - 8 : Math.min(bounds.bottom + 8, innerHeight - height - 12);
      surfaceHost.style.width = width + "px";
      surfaceHost.style.height = height + "px";
      surfaceHost.style.left = left + "px";
      surfaceHost.style.top = Math.max(12, top) + "px";
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
          headers: Object.assign({ "Content-Type": "application/json" }, extraHeaders),
          body: JSON.stringify(hasAgentName ? { agentName: options.agentName } : { agentId: options.agentId }) });
      }).then(function (response) {
        debug(id, "token endpoint response", { status: response.status, ok: response.ok, contentType: response.headers.get("content-type") });
        if (!response.ok) throw new Error("Chat authentication failed (HTTP " + response.status + ").");
        return response.json();
      }).then(function (auth) {
        var valid = !!auth && auth.embed === true && Number.isSafeInteger(auth.agentId) && auth.agentId > 0
          && (!hasAgentId || auth.agentId === options.agentId) && !!auth.agentToken && !!auth.wsUrl && !!auth.httpUrl && Array.isArray(auth.requiredInputs);
        debug(id, "token response validated", { valid: valid, embed: !!auth && auth.embed === true,
          agentIdMatches: !!auth && (!hasAgentId || auth.agentId === options.agentId), hasAgentToken: !!auth && !!auth.agentToken,
          hasWsUrl: !!auth && !!auth.wsUrl, hasHttpUrl: !!auth && !!auth.httpUrl,
          requiredInputsIsArray: !!auth && Array.isArray(auth.requiredInputs) });
        if (!valid) throw new Error("The token endpoint returned an invalid embed response.");
        if (resolvedAgentId && resolvedAgentId !== auth.agentId) throw new Error("The token endpoint resolved a different agent.");
        resolvedAgentId = auth.agentId;
        embedUrl.pathname = "/embed/agent/" + resolvedAgentId;
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
      if (event.source !== frame.contentWindow || event.origin !== embedUrl.origin || !isPlainObject(data)
          || data.channel !== channel || data.version !== 1 || data.instanceId !== id) {
        debug(id, "ignored postMessage", { sourceMatchesFrame: event.source === frame.contentWindow,
          originMatchesHostedUi: event.origin === embedUrl.origin, hasData: !!data,
          channelMatches: !!data && data.channel === channel, versionMatches: !!data && data.version === 1,
          instanceMatches: !!data && data.instanceId === id });
        return;
      }
      debug(id, "received iframe message", { type: data.type, requestId: data.requestId });
      if (data.type === "ready") {
        var frameCapabilities = Array.isArray(data.capabilities) ? data.capabilities : [];
        var missing = (options.requiredCapabilities || []).filter(function (name) { return !frameCapabilities.includes(name); });
        if (missing.length) { emitError(new Error("This hosted chat needs an upgrade. Missing capabilities: " + missing.join(", "))); return; }
        ready = true;
        if (workspaceState) post("workspace_state", { workspace: workspaceState });
        clearTimeout(loadTimer);
        emit("onReady", { protocolVersion: publicProtocolVersion, instanceId: id, agentId: resolvedAgentId, capabilities: frameCapabilities });
        debug(id, "iframe ready", { protocolVersion: publicProtocolVersion, capabilities: frameCapabilities });
      }
      else if (data.type === "close") hide();
      else if (data.type === "workspace_request" && inline && typeof data.action === "string") {
        emit("onWorkspaceActionRequested", { action: data.action, agentName: data.agentName });
      }
      else if (data.type === "before_send_request") runBeforeSend(data);
      else if (data.type === "public_event" && data.protocolVersion === publicProtocolVersion
          && typeof data.event === "string" && isPlainObject(data.payload) && payloadSize(data.payload) <= 64 * 1024) {
        if (data.event === "onAfterUserMessageSend") emitRecovered();
        emit(data.event, data.payload);
      }
      else if (data.type === "command_result" && data.protocolVersion === publicProtocolVersion) {
        var command = pending.get(data.requestId);
        if (command) { clearTimeout(command.timer); pending.delete(data.requestId); data.ok ? command.resolve(data.result) : command.reject(new Error(data.error || "Embed command failed.")); }
      }
      else if (data.type === "token_request") {
        (bootstrapAuth ? Promise.resolve(bootstrapAuth) : fetchToken()).then(function (auth) {
          bootstrapAuth = null;
          debug(id, "sending token bootstrap to iframe", { requestId: data.requestId, inputsCount: Object.keys(inputs).length });
          var agentName = hasAgentName ? options.agentName.trim() : (typeof auth.agentName === "string" ? auth.agentName.trim() : undefined);
          post("token", { requestId: data.requestId, auth: auth, inputs: inputs, agentName: agentName, workspace: workspaceState });
        })
          .catch(function (error) { post("token_error", { requestId: data.requestId, error: error.message }); emitError(error); });
      } else if (data.type === "authenticated") { emitRecovered(); emit("onAuthenticationStateChanged", { state: "authenticated" }); }
      else if (data.type === "error") { emit("onAuthenticationStateChanged", { state: "failed", code: "embed_error" }); emitError(new Error(data.error)); }
      else if (data.type === "inputs_locked") locked = !!data.locked;
      else if (data.type === "inputs_result") {
        var request = pending.get(data.requestId);
        if (request) { clearTimeout(request.timer); pending.delete(data.requestId); data.ok ? request.resolve() : request.reject(new Error(data.error)); }
      }
    }
    function show() {
      if (destroyed) throw new Error("This embed was destroyed.");
      if (open && initialized) return;
      var wasOpen = open;
      open = true;
      if (!wasOpen) emit("onPanelVisibilityChanged", { visible: true, reason: "open" });
      surfaceHost.style.display = "block";
      if (button) button.setAttribute("aria-expanded", "true");
      position();
      if (!initialized) {
        initialized = true;
        var openFrame = function () {
          if (destroyed) return;
          debug(id, "opening hosted iframe", { iframeUrl: embedUrl.href }); frame.src = embedUrl.href; panel.appendChild(frame);
          loadTimer = setTimeout(function () { if (!ready) emitError(new Error("The hosted chat did not load. Check its URL and framing policy.")); }, 20000);
        };
        if (hasAgentName) {
          fetchToken().then(function (auth) { bootstrapAuth = auth; openFrame(); })
            .catch(function (error) { initialized = false; emitError(error); });
        } else openFrame();
      }
      if (!inline) closeButton.focus();
    }
    function hide() {
      if (!open) return;
      open = false;
      emit("onPanelVisibilityChanged", { visible: false, reason: "close" });
      surfaceHost.style.display = "none";
      if (button) { button.setAttribute("aria-expanded", "false"); button.focus(); }
      if (typeof options.onClose === "function") options.onClose();
    }
    function toggleMaximize() {
      windowMode = windowMode === "fullscreen" ? "popup" : "fullscreen";
      maximizeButton.innerHTML = windowMode === "fullscreen"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3M5 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
      maximizeButton.setAttribute("aria-label", windowMode === "fullscreen" ? "Restore agent chat size" : "Make agent chat full screen");
      maximizeButton.title = windowMode === "fullscreen" ? "Restore size" : "Full screen";
      position();
    }
    function dock(side) { windowMode = side; position(); }
    function escape(event) { if (open && event.key === "Escape") hide(); }
    function toggle() { open ? hide() : show(); }
    if (!inline) {
      button.addEventListener("click", toggle);
      closeButton.addEventListener("click", hide);
      minimizeButton.addEventListener("click", hide);
      dockLeftButton.addEventListener("click", function () { dock("dock-left"); });
      dockRightButton.addEventListener("click", function () { dock("dock-right"); });
      maximizeButton.addEventListener("click", toggleMaximize);
      global.addEventListener("resize", position);
      global.addEventListener("scroll", position, true);
      global.addEventListener("keydown", escape);
    }
    global.addEventListener("message", receive);
    return {
      open: show,
      close: hide,
      on: function (eventName, listener, hookOptions) {
        if (destroyed) throw new Error("This embed was destroyed.");
        if (typeof eventName !== "string" || typeof listener !== "function") throw new Error("Provide an event name and listener.");
        if (eventName === "onBeforeUserMessageSend") {
          if (!hookOptions || typeof hookOptions.namespace !== "string" || !hookOptions.namespace.trim())
            throw new Error("Before-send listeners require an exclusive namespace.");
          if (beforeSendListeners.some(function (entry) { return entry.namespace === hookOptions.namespace; }))
            throw new Error("A before-send listener already owns namespace " + hookOptions.namespace + ".");
          var hook = { listener: listener, namespace: hookOptions.namespace, priority: Number(hookOptions.priority) || 0,
            timeoutMs: hookOptions.timeoutMs,
            order: ++listenerOrder };
          beforeSendListeners.push(hook);
          return function () { beforeSendListeners = beforeSendListeners.filter(function (entry) { return entry !== hook; }); };
        }
        var entries = listeners.get(eventName) || [];
        var entry = { listener: listener, original: listener, once: false };
        entries.push(entry); listeners.set(eventName, entries);
        return function () { var current = listeners.get(eventName) || []; listeners.set(eventName, current.filter(function (item) { return item !== entry; })); };
      },
      once: function (eventName, listener) {
        if (eventName === "onBeforeUserMessageSend") throw new Error("once is only available for notification events.");
        if (typeof listener !== "function") throw new Error("Provide a listener.");
        var entries = listeners.get(eventName) || [];
        var wrapped = function (payload) { remove(); listener(payload); };
        var entry = { listener: wrapped, original: listener, once: true };
        function remove() { listeners.set(eventName, (listeners.get(eventName) || []).filter(function (item) { return item !== entry; })); }
        entries.push(entry); listeners.set(eventName, entries);
        return remove;
      },
      off: function (eventName, listener) {
        if (eventName === "onBeforeUserMessageSend") {
          beforeSendListeners = beforeSendListeners.filter(function (entry) { return entry.listener !== listener; });
          return;
        }
        listeners.set(eventName, (listeners.get(eventName) || []).filter(function (entry) { return entry.listener !== listener && entry.original !== listener; }));
      },
      setContext: function (namespace, snapshot, revision, displaySummary) {
        if (typeof namespace !== "string" || !namespace.trim() || typeof revision !== "string") return Promise.reject(new Error("Provide a namespace and revision."));
        var contribution = { context: snapshot, revision: revision,
          ...(typeof displaySummary === "string" ? { displaySummary: displaySummary } : {}) };
        try {
          if (!isJsonValue(contribution, 0) || revision.length > 256
              || (displaySummary !== undefined && displaySummary.length > 1024)) throw new Error("Context contains unsupported values.");
          if (payloadSize(contribution) > maxContextBytes) throw new Error("Context exceeds 32 KiB.");
        }
        catch (error) { return Promise.reject(error); }
        contextSnapshots.set(namespace, JSON.parse(JSON.stringify(contribution)));
        emit("onContextChanged", { protocolVersion: publicProtocolVersion, instanceId: id, agentId: resolvedAgentId, namespace: namespace, revision: revision, displaySummary: displaySummary });
        return sendCommand("setContext", { namespace: namespace, contribution: contribution });
      },
      setWorkspaceState: function (next) {
        workspaceState = next;
        if (ready) post("workspace_state", { workspace: next });
      },
      sendMessage: function (message) {
        if (!isPlainObject(message) || typeof message.text !== "string") return Promise.reject(new Error("sendMessage requires text."));
        return sendCommand("sendMessage", { text: message.text, source: message.source || "sdk" });
      },
      prefill: function (text) {
        if (typeof text !== "string") return Promise.reject(new Error("prefill requires text."));
        return sendCommand("prefill", { text: text });
      },
      newChat: function () { return sendCommand("newChat"); },
      cancelTurn: function () { return sendCommand("cancelTurn"); },
      reconnect: function () { return sendCommand("reconnect"); },
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
        emit("onDestroyed", { protocolVersion: publicProtocolVersion, instanceId: id, agentId: resolvedAgentId,
          eventId: crypto.randomUUID(), sequence: ++eventSequence, occurredAt: new Date().toISOString() });
        destroyed = true;
        clearTimeout(loadTimer);
        if (controller) controller.abort();
        pending.forEach(function (request) { clearTimeout(request.timer); request.reject(new Error("Embed destroyed.")); });
        pending.clear();
        listeners.clear();
        beforeSendListeners = [];
        contextSnapshots.clear();
        global.removeEventListener("message", receive);
        global.removeEventListener("resize", position);
        global.removeEventListener("scroll", position, true);
        global.removeEventListener("keydown", escape);
        if (launcherHost) launcherHost.remove();
        surfaceHost.remove();
      }
    };
  }
  function mountWorkspace(options) {
    var container = typeof options.container === "string" ? document.querySelector(options.container) : options.container;
    var content = typeof options.content === "string" ? document.querySelector(options.content) : options.content;
    if (!container || !content || content.parentElement !== container) throw new Error("Provide a workspace container and its content element.");
    var agents = options.agents;
    if (!Array.isArray(agents) || !agents.length || !agents.every(function (agent) {
      return agent && typeof agent.name === "string" && agent.name.trim() && typeof agent.title === "string";
    })) throw new Error("Provide at least one named agent.");
    if (typeof options.tokenEndpoint !== "string" || !options.tokenEndpoint) throw new Error("Provide a token endpoint.");
    var agentNames = agents.map(function (agent) { return agent.name; });
    if (new Set(agentNames).size !== agentNames.length) throw new Error("Agent names must be unique.");
    var defaultAgent = agentNames.includes(options.defaultAgentName) ? options.defaultAgentName : agents[0].name;
    var key = typeof options.persistenceKey === "string" ? options.persistenceKey : "";
    var state = { version: 1, open: false, mode: "docked", agentName: defaultAgent,
      width: 420, floatingWidth: 440, floatingHeight: 720, x: 24, y: 80 };
    try {
      var stored = key && JSON.parse(localStorage.getItem(key) || "null");
      if (stored && stored.version === 1) {
        state.open = stored.open === true;
        state.mode = ["docked", "floating", "fullscreen"].includes(stored.mode) ? stored.mode : "docked";
        state.agentName = agentNames.includes(stored.agentName) ? stored.agentName : defaultAgent;
        ["width", "floatingWidth", "floatingHeight", "x", "y"].forEach(function (field) {
          if (Number.isFinite(stored[field])) state[field] = stored[field];
        });
      }
    } catch (_) { /* Storage is optional. */ }

    var previousContainerStyle = container.style.cssText;
    var previousContentStyle = content.style.cssText;
    var previousChatSpace = document.documentElement.style.getPropertyValue("--agent-chat-space");
    var host = document.createElement("div");
    var launcherHost = document.createElement("div");
    container.appendChild(host);
    document.body.appendChild(launcherHost);
    var root = host.attachShadow({ mode: "open" });
    var launcherRoot = launcherHost.attachShadow({ mode: "open" });
    var css = document.createElement("style");
    css.textContent = ":host{font:13px system-ui;color:#1e293b}*{box-sizing:border-box}button{font:inherit;cursor:pointer}button:focus-visible{outline:2px solid #3b82f6;outline-offset:2px}.panel{position:relative;display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;background:#fff;border-left:1px solid #d8dee8}.floating{border:1px solid #d8dee8;border-radius:12px;box-shadow:0 20px 60px #0004}.chat{flex:1;min-height:0}.drag{display:none;flex:0 0 22px;width:100%;border:0;border-bottom:1px solid #e2e8f0;background:#f8fafc;cursor:grab;touch-action:none}.floating .drag{display:block}.drag:active{cursor:grabbing}.drag:after{display:block;width:36px;height:4px;margin:auto;border-radius:3px;background:#94a3b8;content:''}.dock-resize{position:absolute;z-index:5;top:0;bottom:0;left:0;width:8px;cursor:col-resize;touch-action:none}.float-resize{position:absolute;z-index:5;right:0;bottom:0;width:28px;height:28px;border:0;background:transparent;cursor:nwse-resize;touch-action:none}.float-resize:after{position:absolute;right:6px;bottom:6px;width:10px;height:10px;border-right:2px solid #64748b;border-bottom:2px solid #64748b;content:''}.error{position:absolute;z-index:4;inset:0;overflow:auto;padding:44px 24px 24px;background:#fff}.floating .error{top:22px}.error-inner{max-width:420px;margin:auto}.error-icon{display:grid;width:36px;height:36px;place-items:center;border-radius:11px;background:#fff1ed;color:#c2412f;font-size:21px;font-weight:700}.eyebrow{margin-top:18px;color:#bd4c3d;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.error h2{margin:5px 0 8px;font-size:18px;line-height:1.3}.error p{margin:0;color:#64748b;overflow-wrap:anywhere}.recovery{margin-top:30px}.recovery-label{margin-bottom:8px;color:#475569;font-weight:700}.switch{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;padding:0 12px;border:1px solid #d7e1ef;border-radius:10px;background:#fff;color:#23324b;text-align:left;font-weight:600}.switch:hover{background:#f4f7fc}.menu{margin-top:6px;padding:6px;border:1px solid #dce4ef;border-radius:12px;background:#fff;box-shadow:0 14px 40px #0f172a24}.menu-title{padding:7px 9px 9px;color:#64748b;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}.option{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:6px 9px;border:0;border-radius:8px;background:transparent;color:#25344d;text-align:left;font-weight:600}.option:hover,.option.selected{background:#eff5ff}.avatar{display:grid;flex:0 0 26px;width:26px;height:26px;place-items:center;border-radius:8px;background:#e8f0ff;color:#2864c6}.option-title{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.close{margin-top:20px;padding:0;border:0;background:none;color:#5277b1;font-weight:600}.close:hover{text-decoration:underline}";
    var panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Agent chat");
    var drag = document.createElement("button");
    drag.type = "button"; drag.className = "drag"; drag.setAttribute("aria-label", "Move agent chat");
    drag.title = "Drag or use arrow keys to move chat";
    var chat = document.createElement("div"); chat.className = "chat";
    var dockResize = document.createElement("div"); dockResize.className = "dock-resize";
    dockResize.setAttribute("role", "separator"); dockResize.setAttribute("aria-label", "Resize agent chat");
    var floatResize = document.createElement("button"); floatResize.type = "button";
    floatResize.className = "float-resize"; floatResize.setAttribute("aria-label", "Resize floating agent chat");
    panel.append(drag, chat, dockResize, floatResize); root.append(css, panel);
    var launcherStyle = document.createElement("style");
    launcherStyle.textContent = "button{position:fixed;z-index:2147483000;right:24px;bottom:72px;display:grid;width:56px;height:56px;place-items:center;border:0;border-radius:50%;background:#2563eb;color:#fff;box-shadow:0 10px 30px #2563eb6b;cursor:pointer;font-size:26px}button:focus-visible{outline:2px solid #2563eb;outline-offset:3px}";
    var launcher = document.createElement("button"); launcher.type = "button";
    launcher.setAttribute("aria-label", "Open agent chat"); launcher.textContent = "✧";
    launcherRoot.append(launcherStyle, launcher);

    var instance = null, disposed = false, error = "", restoreMode = "docked", context = null;
    function clamp(value, min, max) { return Math.min(Math.max(value, min), Math.max(min, max)); }
    function save() { if (key) try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) { /* Storage is optional. */ } }
    function workspaceState() { return { mode: state.mode, agents: agents, selectedAgentName: state.agentName }; }
    function selectedAgent() { return agents.find(function (agent) { return agent.name === state.agentName; }); }
    function showError(message) { error = message; render(); }
    function clearError() { if (error) { error = ""; render(); } }
    function setContext(namespace, snapshot, revision, displaySummary) {
      context = { namespace: namespace, snapshot: snapshot, revision: revision, displaySummary: displaySummary };
      return instance ? instance.setContext(namespace, snapshot, revision, displaySummary) : Promise.resolve();
    }
    function connect() {
      if (disposed || instance) return;
      var agent = selectedAgent();
      instance = mount({ mode: "inline", container: chat, agentName: agent.name, title: agent.title,
        tokenEndpoint: options.tokenEndpoint, getTokenHeaders: options.getTokenHeaders,
        requiredCapabilities: ["inlinePanel", "asyncBeforeSend", "messageContextV1", "publicCommands", "workspaceControlsV1"],
        requiredNamespaces: options.namespace ? [options.namespace] : undefined,
        beforeSendTimeoutMs: 3000, workspace: workspaceState(),
        onClose: function () { if (state.open) close(); },
        onError: function (failure) { showError(failure.message || String(failure)); },
        onRecovered: clearError });
      if (options.namespace && typeof options.beforeSend === "function") instance.on("onBeforeUserMessageSend", options.beforeSend,
        { namespace: options.namespace, priority: 0, timeoutMs: 3000 });
      instance.on("onAgentNavigationRequested", function (event) { if (typeof options.onNavigationRequested === "function") options.onNavigationRequested(event); });
      instance.on("onWorkspaceActionRequested", function (event) {
        if (event.action === "close") close();
        else if (event.action === "selectAgent") selectAgent(event.agentName);
        else if (["dock", "float", "fullscreen", "restore"].includes(event.action)) changeMode(event.action);
      });
      if (context) instance.setContext(context.namespace, context.snapshot, context.revision, context.displaySummary).catch(function () {});
      if (state.open) instance.open();
    }
    function selectAgent(name) {
      if (!agentNames.includes(name) || name === state.agentName) return;
      if (instance) { instance.destroy(); instance = null; }
      chat.textContent = "";
      state.agentName = name; error = ""; save(); render();
      if (state.open) connect();
    }
    function changeMode(action) {
      if (action === "fullscreen" && state.mode !== "fullscreen") restoreMode = state.mode;
      state.mode = action === "float" ? "floating" : action === "fullscreen" ? "fullscreen"
        : action === "restore" ? restoreMode : "docked";
      save(); render();
      if (instance) instance.setWorkspaceState(workspaceState());
    }
    function open() { state.open = true; save(); render(); connect(); if (instance) instance.open(); }
    function close() { state.open = false; save(); if (instance) instance.close(); render(); }
    function renderError() {
      var previous = panel.querySelector(".error"); if (previous) previous.remove();
      chat.style.visibility = error ? "hidden" : "visible";
      if (!error) return;
      var view = document.createElement("div"); view.className = "error";
      var inner = document.createElement("div"); inner.className = "error-inner";
      var icon = document.createElement("span"); icon.className = "error-icon"; icon.textContent = "!";
      var eyebrow = document.createElement("div"); eyebrow.className = "eyebrow"; eyebrow.textContent = "Agent unavailable";
      var title = document.createElement("h2"); title.textContent = "Couldn’t start " + selectedAgent().title;
      var message = document.createElement("p"); message.setAttribute("role", "alert"); message.textContent = error;
      inner.append(icon, eyebrow, title, message);
      if (agents.length > 1) {
        var recovery = document.createElement("div"); recovery.className = "recovery";
        var label = document.createElement("div"); label.className = "recovery-label"; label.textContent = "Choose another agent";
        var switcher = document.createElement("button"); switcher.type = "button"; switcher.className = "switch";
        switcher.textContent = selectedAgent().title + "  ⌄"; switcher.setAttribute("aria-label", "Switch agent");
        switcher.setAttribute("aria-expanded", "false");
        var menu = document.createElement("div"); menu.className = "menu"; menu.style.display = "none";
        menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", "Choose agent");
        var menuTitle = document.createElement("div"); menuTitle.className = "menu-title"; menuTitle.textContent = "Choose an agent";
        menu.appendChild(menuTitle);
        agents.forEach(function (agent) {
          var item = document.createElement("button"); item.type = "button"; item.className = "option";
          if (agent.name === state.agentName) item.classList.add("selected");
          item.setAttribute("role", "menuitemradio"); item.setAttribute("aria-checked", String(agent.name === state.agentName));
          var avatar = document.createElement("span"); avatar.className = "avatar"; avatar.textContent = agent.title.trim().charAt(0).toUpperCase();
          var itemTitle = document.createElement("span"); itemTitle.className = "option-title"; itemTitle.textContent = agent.title;
          item.append(avatar, itemTitle); menu.appendChild(item);
          item.addEventListener("click", function () { selectAgent(agent.name); });
        });
        switcher.addEventListener("click", function () {
          var expanded = menu.style.display === "none";
          menu.style.display = expanded ? "block" : "none"; switcher.setAttribute("aria-expanded", String(expanded));
        });
        recovery.append(label, switcher, menu); inner.appendChild(recovery);
      }
      var closeButton = document.createElement("button"); closeButton.type = "button"; closeButton.className = "close";
      closeButton.textContent = "Close chat"; closeButton.addEventListener("click", close);
      inner.appendChild(closeButton); view.appendChild(inner); panel.appendChild(view);
    }
    function render() {
      if (disposed) return;
      var floating = state.open && state.mode === "floating";
      var fullscreen = state.open && state.mode === "fullscreen";
      var width = clamp(state.width, 280, innerWidth - 320);
      var floatWidth = clamp(state.floatingWidth, 280, innerWidth - 32);
      var floatHeight = clamp(state.floatingHeight, 360, innerHeight - 32);
      var dockWidth = state.open && !floating ? fullscreen ? "100%" : width + "px" : "0px";
      container.style.display = "grid"; container.style.gridTemplateColumns = "minmax(0,1fr) " + dockWidth;
      container.style.width = "100%"; container.style.height = "100dvh"; container.style.overflow = "hidden";
      content.style.minWidth = "0"; content.style.height = "100%"; content.style.overflow = "auto";
      content.style.visibility = fullscreen ? "hidden" : ""; content.style.pointerEvents = fullscreen ? "none" : "";
      document.documentElement.style.setProperty("--agent-chat-space", dockWidth);
      launcher.style.display = state.open ? "none" : "grid";
      host.style.display = state.open ? "block" : "none";
      host.style.width = floating ? floatWidth + "px" : "100%";
      host.style.height = floating ? floatHeight + "px" : "100%";
      host.style.position = floating ? "fixed" : "relative";
      host.style.zIndex = floating ? "2147483000" : "300";
      host.style.left = floating ? clamp(state.x, 0, innerWidth - floatWidth) + "px" : "";
      host.style.top = floating ? clamp(state.y, 0, innerHeight - floatHeight) + "px" : "";
      panel.classList.toggle("floating", floating);
      drag.style.display = floating ? "block" : "none";
      dockResize.style.display = state.open && !floating && !fullscreen ? "block" : "none";
      floatResize.style.display = floating ? "block" : "none";
      renderError();
    }
    function onDrag(event) {
      if (!dragStart) return;
      state.x = clamp(dragStart.x + event.clientX - dragStart.clientX, 0, innerWidth - host.offsetWidth);
      state.y = clamp(dragStart.y + event.clientY - dragStart.clientY, 0, innerHeight - host.offsetHeight);
      render();
    }
    function onResize(event) {
      if (!resizeStart) return;
      if (resizeStart.floating) {
        state.floatingWidth = clamp(resizeStart.width + event.clientX - resizeStart.clientX, 280, innerWidth - state.x - 16);
        state.floatingHeight = clamp(resizeStart.height + event.clientY - resizeStart.clientY, 360, innerHeight - state.y - 16);
      } else state.width = clamp(resizeStart.width + resizeStart.clientX - event.clientX, 280, innerWidth - 320);
      render();
    }
    var dragStart = null, resizeStart = null;
    drag.addEventListener("pointerdown", function (event) {
      dragStart = { clientX: event.clientX, clientY: event.clientY, x: state.x, y: state.y };
      drag.setPointerCapture(event.pointerId);
    });
    drag.addEventListener("pointermove", onDrag);
    drag.addEventListener("pointerup", function () { if (dragStart) save(); dragStart = null; });
    drag.addEventListener("pointercancel", function () { dragStart = null; });
    dockResize.addEventListener("pointerdown", function (event) {
      resizeStart = { clientX: event.clientX, width: state.width, floating: false };
      dockResize.setPointerCapture(event.pointerId);
    });
    floatResize.addEventListener("pointerdown", function (event) {
      resizeStart = { clientX: event.clientX, clientY: event.clientY, width: state.floatingWidth,
        height: state.floatingHeight, floating: true };
      floatResize.setPointerCapture(event.pointerId);
    });
    dockResize.addEventListener("pointermove", onResize); floatResize.addEventListener("pointermove", onResize);
    dockResize.addEventListener("pointerup", function () { if (resizeStart) save(); resizeStart = null; });
    floatResize.addEventListener("pointerup", function () { if (resizeStart) save(); resizeStart = null; });
    dockResize.addEventListener("pointercancel", function () { resizeStart = null; });
    floatResize.addEventListener("pointercancel", function () { resizeStart = null; });
    drag.addEventListener("keydown", function (event) {
      var delta = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[event.key];
      if (!delta) return; event.preventDefault();
      state.x = clamp(state.x + delta[0], 0, innerWidth - host.offsetWidth);
      state.y = clamp(state.y + delta[1], 0, innerHeight - host.offsetHeight); save(); render();
    });
    launcher.addEventListener("click", open);
    global.addEventListener("resize", render);
    render(); if (state.open) connect();
    return { open: open, close: close, setContext: setContext, destroy: function () {
      if (disposed) return; disposed = true;
      if (instance) instance.destroy();
      global.removeEventListener("resize", render);
      host.remove(); launcherHost.remove();
      container.style.cssText = previousContainerStyle;
      content.style.cssText = previousContentStyle;
      if (previousChatSpace) document.documentElement.style.setProperty("--agent-chat-space", previousChatSpace);
      else document.documentElement.style.removeProperty("--agent-chat-space");
    } };
  }
  global.SolidAgentEmbed = { version: 7, mount: mount, mountWorkspace: mountWorkspace };
})(window);
