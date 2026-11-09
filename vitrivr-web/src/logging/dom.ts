import {interactionLogger} from "./index.ts";
import type {InteractionLogger} from "./logger.ts";
import type {LogContext} from "./types.ts";
import {editingPeriods} from "./editing.ts";

function element(target: EventTarget | null): Element | null {
    return target instanceof Element ? target : target instanceof Document ? target.documentElement : null;
}
function isPrivate(node: Element | null): boolean {
    return Boolean(node?.closest('[data-log-private],input[type="password"],input[autocomplete="one-time-code"]'));
}
function isTextEntry(node: Element | null): boolean {
    return Boolean((node as HTMLElement | null)?.isContentEditable) || node instanceof HTMLTextAreaElement || (node instanceof HTMLInputElement &&
        ["text", "search", "email", "url", "tel", "password"].includes(node.type));
}
function controlLabel(target: Element, label: Element | null): string {
    if (label) {
        // A wrapping label can contain a textarea's default text. Exclude the
        // controls so identifying an edit never stores the draft accidentally.
        const clone = label.cloneNode(true) as Element;
        clone.querySelectorAll("input,textarea,select").forEach(control => control.remove());
        return clone.textContent ?? "";
    }
    return isTextEntry(target) ? "" : target.textContent ?? "";
}
function resultInfo(node: Element | null) {
    const result = node?.closest<HTMLElement>("[data-log-result-id]");
    if (!result) return {};
    const group = result.closest<HTMLElement>("[data-log-video-group-rank]");
    return {resultId: result.dataset.logResultId, mediaName: result.dataset.logMediaName,
        area: result.closest(".vp-povGroups") ? "pov" : result.closest(".sc-resultsGrid") ? "search-results" : "video-neighbours",
        frameRank: Number(result.dataset.logFrameRank) || undefined,
        videoRank: Number(result.dataset.logVideoRank ?? group?.dataset.logVideoGroupRank) || undefined,
        groupPosition: Number(group?.dataset.logVideoGroupRank) || undefined,
        displayPosition: Number(result.dataset.logPosition) || undefined,
        start: Number(result.dataset.logStart) || 0, end: Number(result.dataset.logEnd) || 0};
}
function targetInfo(node: Element | null) {
    if (!node) return null;
    const control = node.closest<HTMLElement>('button,a,input,textarea,select,summary,[role="button"],[role="option"],[data-log-action]');
    const target = control ?? node;
    const labels = "labels" in target ? (target as HTMLInputElement).labels : null;
    return {tag: target.tagName.toLowerCase(), id: target.id || undefined, classes: target.getAttribute("class"),
        name: target.getAttribute("name"), type: target.getAttribute("type"),
        role: target.getAttribute("role"), title: target.getAttribute("title"), expanded: target.getAttribute("aria-expanded"), selected: target.getAttribute("aria-selected"),
        queryBlockId: node.closest<HTMLElement>("[data-log-query-block]")?.dataset.logQueryBlock,
        area: node.closest<HTMLElement>("[data-log-area]")?.dataset.logArea,
        label: (target.getAttribute("aria-label") || (control ? controlLabel(target, labels?.[0] ?? null) : "")).trim().slice(0, 240),
        href: target instanceof HTMLAnchorElement ? target.href : undefined, ...resultInfo(node)};
}
function inputValue(node: Element | null): unknown {
    if (isPrivate(node)) return "[REDACTED]";
    if (node instanceof HTMLInputElement) {
        if (node.type === "file") return [...node.files ?? []];
        return {value: node.value, checked: node.checked};
    }
    if (node instanceof HTMLSelectElement) return {value: node.value, selected: [...node.selectedOptions].map(option => option.value)};
    if (node instanceof HTMLTextAreaElement) return {value: node.value};
    if ((node as HTMLElement | null)?.isContentEditable) return {value: node?.textContent};
    return null;
}

/** Native capture listeners cover controls added later, including dialogs and custom widgets. */
export function installDomLogging(logger: InteractionLogger = interactionLogger): () => void {
    const cleanups: (() => void)[] = [];
    const listen = (target: EventTarget, type: string, handler: (event: Event) => void, capture = true) => {
        const safe = (event: Event) => { try { if (logger.getSnapshot().enabled) handler(event); } catch { /* Instrumentation cannot affect interaction. */ } };
        target.addEventListener(type, safe, {capture, passive: true});
        cleanups.push(() => target.removeEventListener(type, safe, capture));
    };
    // Preserve individual events; batching the worker transport does not sample them.
    for (const type of ["keydown", "keyup"]) listen(document, type, event => {
        const node = element(event.target);
        if (isPrivate(node)) return;
        const key = event as KeyboardEvent;
        logger.record(`ui.${type}`, {target: targetInfo(node), key: key.key, code: key.code,
            location: key.location, repeat: key.repeat, composing: key.isComposing,
            ctrl: key.ctrlKey, shift: key.shiftKey, alt: key.altKey, meta: key.metaKey, nativeTimestamp: event.timeStamp});
    });
    for (const type of ["beforeinput", "input", "compositionstart", "compositionupdate", "compositionend"]) listen(document, type, event => {
        const node = element(event.target);
        if (!node || isPrivate(node)) return;
        const input = event as InputEvent;
        const field = node as HTMLInputElement;
        logger.record(`ui.${type}`, {target: targetInfo(node), data: input.data, inputType: input.inputType,
            composing: input.isComposing, value: inputValue(node), selectionStart: field.selectionStart,
            selectionEnd: field.selectionEnd, selectionDirection: field.selectionDirection, nativeTimestamp: event.timeStamp});
    });
    for (const type of ["pointerdown", "pointerup", "pointermove", "pointercancel", "wheel"]) listen(document, type, event => {
        const node = element(event.target);
        if (isPrivate(node)) return;
        const pointer = event as PointerEvent;
        const wheel = event as WheelEvent;
        logger.record(`ui.${type}`, {target: targetInfo(node), x: pointer.clientX, y: pointer.clientY,
            button: pointer.button, buttons: pointer.buttons, pointerId: pointer.pointerId, pointerType: pointer.pointerType,
            pressure: pointer.pressure, deltaX: wheel.deltaX, deltaY: wheel.deltaY, deltaMode: wheel.deltaMode,
            nativeTimestamp: event.timeStamp}, resultInfo(node));
    });
    listen(document, "selectionchange", event => {
        const node = document.activeElement;
        const selection = window.getSelection();
        const anchor = selection?.anchorNode?.parentElement ?? null;
        const focus = selection?.focusNode?.parentElement ?? null;
        if (isPrivate(node) || isPrivate(anchor) || isPrivate(focus)) return;
        const field = node as HTMLInputElement | null;
        logger.record("ui.selection", {target: targetInfo(node), selectionStart: field?.selectionStart,
            selectionEnd: field?.selectionEnd, selectionDirection: field?.selectionDirection,
            anchor: targetInfo(anchor), focus: targetInfo(focus), anchorOffset: selection?.anchorOffset,
            focusOffset: selection?.focusOffset, text: selection?.toString(), nativeTimestamp: event.timeStamp});
    });
    for (const type of ["focusin", "focusout", "paste", "cut"]) listen(document, type, event => {
        const node = element(event.target);
        if (!isPrivate(node)) logger.record(`ui.${type}`, {target: targetInfo(node)});
    });
    for (const type of ["click", "dblclick", "contextmenu"]) listen(document, type, event => {
        const mouse = event as MouseEvent;
        const node = element(event.target);
        const action = type === "click" ? node?.closest<HTMLElement>("[data-log-action]")?.dataset.logAction : undefined;
        if (action === "query.submit" || action === "qa.submit") editingPeriods.reset();
        logger.record(action || `ui.${type}`, {target: targetInfo(node), x: mouse.clientX, y: mouse.clientY,
            button: mouse.button, buttons: mouse.buttons, ctrl: mouse.ctrlKey, shift: mouse.shiftKey, alt: mouse.altKey, meta: mouse.metaKey}, resultInfo(node));
    });
    for (const type of ["pointerover", "pointerout"]) listen(document, type, event => {
        const pointer = event as PointerEvent;
        const node = element(event.target)?.closest("[data-log-result-id]") ?? null;
        if (!node || node.contains(pointer.relatedTarget as Node | null)) return;
        logger.record(type === "pointerover" ? "result.hover_enter" : "result.hover_leave", {target: targetInfo(node)}, resultInfo(node));
    });
    listen(document, "input", event => {
        const node = element(event.target);
        if (!logger.getSnapshot().enabled || !node || isPrivate(node) || !isTextEntry(node)) return;
        if (editingPeriods.start(node)) logger.record("ui.editing_started", {target: targetInfo(node)});
    });
    listen(document, "change", event => {
        const node = element(event.target);
        if (isPrivate(node)) return;
        logger.record("ui.change", {target: targetInfo(node), value: inputValue(node)});
    });
    listen(document, "focusout", event => {
        const node = element(event.target);
        if (node) editingPeriods.end(node);
    });
    listen(document, "invalid", event => {
        const node = element(event.target);
        logger.record("ui.validation_error", {target: targetInfo(node),
            message: node && "validationMessage" in node ? node.validationMessage : undefined});
    });
    for (const type of ["submit", "copy"]) listen(document, type, event => {
        if (type === "submit") editingPeriods.reset();
        logger.record(`ui.${type}`, {target: targetInfo(element(event.target))});
    });
    listen(document, "drop", event => {
        const drag = event as DragEvent;
        logger.record("ui.drop", {target: targetInfo(element(event.target)), x: drag.clientX, y: drag.clientY,
            files: drag.dataTransfer ? [...drag.dataTransfer.files] : [], types: drag.dataTransfer ? [...drag.dataTransfer.types] : []});
    });
    listen(document, "toggle", event => {
        if (event.target instanceof HTMLDetailsElement) logger.record("ui.toggle", {summary: event.target.querySelector("summary")?.textContent, open: event.target.open});
    });
    listen(document, "scroll", event => {
        const node = event.target instanceof Document ? document.scrollingElement : element(event.target);
        if (!node || isPrivate(node)) return;
        logger.record("ui.scroll", {target: targetInfo(node), x: node.scrollLeft, y: node.scrollTop,
            scrollHeight: node.scrollHeight, scrollWidth: node.scrollWidth, width: node.clientWidth, height: node.clientHeight,
            nativeTimestamp: event.timeStamp});
    });
    for (const type of ["play", "playing", "pause", "seeking", "seeked", "timeupdate", "ended", "ratechange", "volumechange", "loadstart", "loadedmetadata", "loadeddata", "durationchange", "progress", "suspend", "abort", "emptied", "waiting", "stalled", "error", "enterpictureinpicture", "leavepictureinpicture", "webkitbeginfullscreen", "webkitendfullscreen"]) {
        listen(document, type, event => {
            const video = event.target;
            // Exclude detached frame-capture decoders: they are not user inspections.
            if (!(video instanceof HTMLMediaElement) || !video.isConnected) return;
            const metadata = (video as HTMLElement).dataset;
            logger.record(`media.${type}`, {target: targetInfo(video), src: metadata.logMediaSrc || video.currentSrc || video.getAttribute("src"),
                currentSrc: video.currentSrc, fallbackSrc: metadata.logFallbackSrc, requestedStart: metadata.logStartTime,
                time: video.currentTime, duration: video.duration, paused: video.paused, rate: video.playbackRate,
                volume: video.volume, muted: video.muted, readyState: video.readyState,
                error: video.error ? {code: video.error.code, message: video.error.message} : null}, resultInfo(video));
        });
    }
    listen(document, "fullscreenchange", () => logger.record("media.fullscreen", {target: targetInfo(document.fullscreenElement)}));
    for (const type of ["focus", "blur", "resize", "online", "offline"]) listen(window, type, () => {
        logger.record(`window.${type}`, {width: window.innerWidth, height: window.innerHeight, online: navigator.onLine});
    }, false);
    listen(window, "error", event => {
        if (event instanceof ErrorEvent) logger.record("app.error", {message: event.message, filename: event.filename, line: event.lineno, column: event.colno, error: event.error});
        else logger.record("app.resource_error", {target: targetInfo(element(event.target))});
    });
    listen(window, "unhandledrejection", event => logger.record("app.unhandled_rejection", (event as PromiseRejectionEvent).reason), false);

    const visible = new Map<Element, {started: number; context: LogContext; data: ReturnType<typeof resultInfo>}>();
    const leave = (node: Element) => {
        const view = visible.get(node);
        if (!view) return;
        visible.delete(node);
        logger.record("result.leave_viewport", {...view.data, dwellMs: performance.now() - view.started}, {context: view.context, ...view.data});
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (entry.isIntersecting && document.visibilityState === "visible") {
                if (visible.has(entry.target)) {
                    const view = visible.get(entry.target)!;
                    logger.record("result.visibility", {...view.data, ratio: entry.intersectionRatio}, {context: view.context, ...view.data});
                    continue;
                }
                const data = resultInfo(entry.target);
                visible.set(entry.target, {started: performance.now(), context: logger.getContext(), data});
                const {x, y, width, height} = entry.boundingClientRect;
                logger.record("result.enter_viewport", {...data, ratio: entry.intersectionRatio, bounds: {x, y, width, height}}, data);
            } else leave(entry.target);
        }
    }, {threshold: [0, 0.5, 1]});
    const results = (node: Node): Element[] => node instanceof Element ? [
        ...(node.matches("[data-log-result-id]") ? [node] : []), ...node.querySelectorAll("[data-log-result-id]"),
    ] : [];
    const themeObserver = new MutationObserver(records => {
        for (const record of records) if (record.target instanceof Element) logger.snapshot("settings.theme", {dark: record.target.classList.contains("search-shell--dark")});
    });
    const watchTheme = (shell: Element | null) => { if (shell) themeObserver.observe(shell, {attributes: true, attributeFilter: ["class"]}); };
    watchTheme(document.querySelectorAll(".search-shell")[0] ?? null);
    const mutation = new MutationObserver(records => {
        const changedControls = new Set<Element>();
        const changedResults = new Set<Element>();
        const changedMessages = new Set<Element>();
        const messageSelector = '[role="alert"],[role="status"],.flash,.vp-message,.alert--error';
        for (const record of records) {
            if (record.type === "attributes" && record.target instanceof Element) {
                if (record.attributeName === "aria-expanded" || record.attributeName === "aria-selected") changedControls.add(record.target);
                else for (const result of results(record.target)) if (visible.has(result)) changedResults.add(result);
            }
            const parent = record.target instanceof Element ? record.target : record.target.parentElement;
            const message = parent?.closest(messageSelector);
            if (message) changedMessages.add(message);
            for (const added of record.addedNodes) for (const result of results(added)) observer?.observe(result);
            for (const added of record.addedNodes) if (added instanceof Element) {
                const shell = added.matches(".search-shell") ? added : added.querySelector(".search-shell");
                if (shell) { watchTheme(shell); logger.snapshot("settings.theme", {dark: shell.classList.contains("search-shell--dark")}); }
                const messages = [...(added.matches(messageSelector) ? [added] : []), ...added.querySelectorAll(messageSelector)];
                for (const message of messages) changedMessages.add(message);
            }
            for (const removed of record.removedNodes) for (const result of results(removed)) { leave(result); observer?.unobserve(result); }
        }
        for (const node of changedControls) if (node.isConnected && !isPrivate(node)) {
            logger.record("ui.control_state", {target: targetInfo(node)});
        }
        for (const node of changedResults) {
            const view = visible.get(node);
            if (!view || !node.isConnected) continue;
            const data = resultInfo(node);
            if (JSON.stringify(view.data) === JSON.stringify(data)) continue;
            logger.record("result.presentation_changed", {previous: view.data, current: data, previousDwellMs: performance.now() - view.started}, data);
            visible.set(node, {data, started: performance.now(), context: logger.getContext()});
        }
        for (const message of changedMessages) if (message.isConnected && !isPrivate(message)) {
            logger.record("app.message", {text: message.textContent, role: message.getAttribute("role"), classes: message.className});
        }
    });
    mutation.observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ["aria-expanded", "aria-selected", "data-log-result-id", "data-log-media-name", "data-log-frame-rank",
            "data-log-video-rank", "data-log-position", "data-log-video-group-rank", "data-log-start", "data-log-end"]});
    document.querySelectorAll("[data-log-result-id]").forEach(node => observer?.observe(node));
    let recordingEnabled = logger.getSnapshot().enabled;
    const unsubscribe = logger.subscribe(() => {
        const enabled = logger.getSnapshot().enabled;
        if (enabled === recordingEnabled) return;
        recordingEnabled = enabled;
        editingPeriods.reset();
        visible.clear();
        if (enabled) document.querySelectorAll("[data-log-result-id]").forEach(node => { observer?.unobserve(node); observer?.observe(node); });
    });
    listen(document, "visibilitychange", () => {
        logger.record("window.visibility", {state: document.visibilityState});
        if (document.visibilityState !== "visible") {
            [...visible.keys()].forEach(leave);
            void logger.flush();
        } else document.querySelectorAll("[data-log-result-id]").forEach(node => { observer?.unobserve(node); observer?.observe(node); });
    });
    listen(window, "pagehide", event => {
        [...visible.keys()].forEach(leave);
        logger.record("session.pagehide", {persisted: (event as PageTransitionEvent).persisted});
        void logger.flush();
    }, false);
    listen(window, "pageshow", event => logger.record("session.pageshow", {persisted: (event as PageTransitionEvent).persisted}), false);
    return () => { themeObserver.disconnect(); editingPeriods.reset(); unsubscribe(); cleanups.forEach(cleanup => cleanup()); [...visible.keys()].forEach(leave); observer?.disconnect(); mutation.disconnect(); void logger.flush(); };
}
