"use strict";
(() => {
    var l = {
            id: "default",
            match: () => !0,
            detect: t => {
                let {
                    localStorageSnapshot: e
                } = t, o = e.username || e.user || e.account || "";
                return {
                    state: o ? "logged_in" : "unknown",
                    username: o || void 0,
                    hint: o ? `Detected username in local storage: ${o}` : "No login information detected (can be extended in the rule engine)",
                    detectedAt: new Date()
                        .toISOString()
                }
            }
        },
        g = {
            id: "example.com",
            match: t => t.endsWith("example.com"),
            detect: t => {
                let e = t.document.querySelector("a[href*='login']"),
                    o = t.document.querySelector("a[href*='logout'], a[href*='signout']"),
                    r = "unknown",
                    n = "Example rule: Please adjust according to the actual site structure";
                return o ? (r = "logged_in", n = "Exit/Sign out link found on the page") : e && (r = "logged_out", n = "Login link found on the page"), {
                    state: r,
                    hint: n,
                    detectedAt: new Date()
                        .toISOString()
                }
            }
        },
        f = [g, l];
    function p(t) {
        let e = t.toLowerCase();
        for (let o of f)
            if (o.match(e)) return o;
        return l
    }
    function s(t, e, o) {
        return p(t)
            .detect({
                hostname: t,
                document: e,
                localStorageSnapshot: o.localStorage
            })
    }
    function S(t) {
        if (!t) return "Unnamed website";
        let e = t.trim();
        if (!e) return "Unnamed website";
        let o = [" - ", " | ", " _ ", " — ", "："];
        for (let r of o)
            if (e.includes(r)) {
                let n = e.split(r);
                if (n[0] && n[0].trim()
                    .length > 0) return n[0].trim()
            } return e.length <= 20 ? e : e.slice(0, 20) + "..."
    }
    function d(t) {
        let e = t.querySelectorAll("link[rel*='icon']");
        for (let o = 0; o < e.length; o++) {
            let r = e[o];
            if (r.href) return r.href
        }
        try {
            return new URL("/favicon.ico", t.location.origin)
                .href
        } catch {
            return null
        }
    }
    function u() {
        let t = S(document.title),
            e = d(document);
        return {
            title: t,
            iconUrl: e
        }
    }
    function i(...t) {
        console.log("[MultiAccount][cs]", ...t)
    }
    function h() {
        let t = {};
        try {
            for (let e = 0; e < localStorage.length; e += 1) {
                let o = localStorage.key(e);
                if (o) try {
                    let r = localStorage.getItem(o);
                    r != null && (t[o] = r)
                } catch {}
            }
        } catch (e) {
            i("capture localStorage error", e)
        }
        return t
    }
    function m(t) {
        try {
            localStorage.clear(), Object.entries(t)
                .forEach(([e, o]) => {
                    try {
                        localStorage.setItem(e, o)
                    } catch {}
                })
        } catch (e) {
            throw i("apply localStorage error", e), e
        }
    }
    chrome.runtime.onMessage.addListener((t, e, o) => {
        if (!(!t || typeof t.type != "string")) {
            if (t.type === "PING") {
                o({
                    ok: !0
                });
                return
            }
            if (t.type === "CAPTURE_PAGE_STATE") {
                try {
                    let r = window.location.hostname,
                        c = {
                            localStorage: h()
                        };
                    try {
                        c.loginInfo = s(r, document, c)
                    } catch (a) {
                        i("detect login state error", a)
                    }
                    try {
                        c.siteInfo = u()
                    } catch (a) {
                        i("extract site info error", a)
                    }
                    o(c)
                } catch (r) {
                    i("capture page state error", r), o(null)
                }
                return !0
            }
            if (t.type === "APPLY_PAGE_STATE") {
                try {
                    let {
                        localStorage: r
                    } = t.payload;
                    m(r), o({
                        success: !0
                    })
                } catch (r) {
                    o({
                        success: !1,
                        error: (r == null ? void 0 : r.message) || String(r)
                    })
                }
                return !0
            }
            if (t.type === "DEBUG_LOG") {
                let {
                    message: r,
                    level: n
                } = t.payload, c = "[MultiAccount][Popup]";
                return n === "error" ? console.error(c, r) : n === "warn" ? console.warn(c, r) : console.log(c, r), o({
                    success: !0
                }), !0
            }
        }
    });
    i("content script loaded");
})();