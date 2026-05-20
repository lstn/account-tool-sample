"use strict";
(() => {
    function c(...t) {
        console.log("[MultiAccount][bg]", ...t)
    }
    function C(t) {
        try {
            return new URL(t)
                .hostname
        } catch {
            return ""
        }
    }
    function k(t) {
        return new Promise(async (o, r) => {
            try {
                let e = new Promise(s => {
                        chrome.cookies.getAll({
                            url: t
                        }, p => {
                            s(chrome.runtime.lastError ? [] : p)
                        })
                    }),
                    a = C(t);
                if (!a) {
                    let s = await e;
                    o(S(s));
                    return
                }
                let n = a.split("."),
                    i = n.length > 1 ? n.slice(-2)
                    .join(".") : a,
                    u = new Promise(s => {
                        chrome.cookies.getAll({
                            domain: i
                        }, p => {
                            s(chrome.runtime.lastError ? [] : p)
                        })
                    }),
                    [l, m] = await Promise.all([e, u]),
                    d = [...l],
                    g = new Set(l.map(s => y(s)));
                for (let s of m) {
                    let p = y(s);
                    g.has(p) || (d.push(s), g.add(p))
                }
                o(S(d))
            } catch (e) {
                r(e)
            }
        })
    }
    function y(t) {
        return `${t.storeId}::${t.name}::${t.domain}::${t.path}`
    }
    function S(t) {
        return t.map(o => ({
            name: o.name,
            value: o.value,
            domain: o.domain,
            path: o.path,
            secure: o.secure,
            httpOnly: o.httpOnly,
            expirationDate: o.expirationDate,
            sameSite: o.sameSite,
            storeId: o.storeId
        }))
    }
    function f(t) {
        return new Promise((o, r) => {
            try {
                chrome.cookies.getAll({
                    url: t
                }, e => {
                    let a = chrome.runtime.lastError;
                    if (a) {
                        r(a);
                        return
                    }
                    let n = e.length;
                    if (!n) {
                        o();
                        return
                    }
                    e.forEach(i => {
                        chrome.cookies.remove({
                            url: t,
                            name: i.name
                        }, () => {
                            n -= 1, n || o()
                        })
                    })
                })
            } catch (e) {
                r(e)
            }
        })
    }
    function b(t, o) {
        return new Promise((r, e) => {
            try {
                if (!o.length) {
                    r();
                    return
                }
                let a = o.length;
                o.forEach(n => {
                    let i = t;
                    if (n.domain) {
                        let l = n.secure ? "https://" : "http://",
                            m = n.domain.startsWith(".") ? n.domain.substring(1) : n.domain;
                        i = `${l}${m}${n.path||"/"}`
                    }
                    let u = {
                        url: i,
                        name: n.name,
                        value: n.value,
                        path: n.path,
                        secure: n.secure,
                        httpOnly: n.httpOnly,
                        expirationDate: n.expirationDate,
                        sameSite: n.sameSite,
                        storeId: n.storeId
                    };
                    n.domain && (u.domain = n.domain), chrome.cookies.set(u, l => {
                        a -= 1, a || r()
                    })
                })
            } catch (a) {
                e(a)
            }
        })
    }
    function h(t, o) {
        return new Promise((r, e) => {
            try {
                chrome.tabs.sendMessage(t, o, a => {
                    let n = chrome.runtime.lastError;
                    n ? e(n) : r(a)
                })
            } catch (a) {
                e(a)
            }
        })
    }
    async function T(t) {
        if (chrome.scripting) await chrome.scripting.executeScript({
            target: {
                tabId: t
            },
            files: ["content.js"]
        });
        else return new Promise((o, r) => {
            chrome.tabs.executeScript(t, {
                file: "content.js"
            }, () => {
                let e = chrome.runtime.lastError;
                e ? r(e) : o()
            })
        })
    }
    async function A(t) {
        try {
            await h(t, {
                type: "PING"
            })
        } catch (o) {
            let r = (o == null ? void 0 : o.message) || "";
            if (r.includes("Receiving end does not exist") || r.includes("Could not establish connection")) c("Content script not found, trying to inject...", t), await T(t), await new Promise(e => setTimeout(e, 100));
            else throw o
        }
    }
    async function M(t) {
        await A(t);
        let o = await h(t, {
            type: "CAPTURE_PAGE_STATE"
        });
        if (!o) throw new Error("The content script is not responding; the current site may not support it or it may not have been injected yet.");
        return o
    }
    async function P(t, o) {
        await A(t), await h(t, {
            type: "APPLY_PAGE_STATE",
            payload: {
                localStorage: o ? o.localStorage : {}
            }
        })
    }
    async function E(t) {
        let {
            tabId: o,
            url: r
        } = t.payload;
        try {
            let [e, a] = await Promise.all([k(r), M(o)]);
            return {
                success: !0,
                snapshot: {
                    cookies: e,
                    pageState: a
                }
            }
        } catch (e) {
            return c("capture error", e), {
                success: !1,
                error: (e == null ? void 0 : e.message) || String(e)
            }
        }
    }
    async function w(t, o, r) {
        await f(o), await b(o, r.cookies), await P(t, r.pageState), chrome.tabs.reload(t)
    }
    async function O(t) {
        let {
            tabId: o,
            url: r,
            snapshot: e
        } = t.payload;
        try {
            return await w(o, r, e), {
                success: !0
            }
        } catch (a) {
            return c("apply error", a), {
                success: !1,
                error: (a == null ? void 0 : a.message) || String(a)
            }
        }
    }
    async function _(t) {
        let {
            url: o,
            snapshot: r
        } = t.payload;
        try {
            let e = await chrome.tabs.create({
                url: o,
                active: !0
            });
            if (!e.id) throw new Error("Failed to create tab");
            return await new Promise(a => {
                let n = (i, u) => {
                    i === e.id && u.status === "complete" && (chrome.tabs.onUpdated.removeListener(n), a())
                };
                chrome.tabs.onUpdated.addListener(n), setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(n), a()
                }, 15e3)
            }), await w(e.id, o, r), {
                success: !0
            }
        } catch (e) {
            return c("open apply error", e), {
                success: !1,
                error: (e == null ? void 0 : e.message) || String(e)
            }
        }
    }
    async function D(t) {
        let {
            tabId: o,
            url: r
        } = t.payload;
        try {
            return await f(r), await P(o, null), chrome.tabs.reload(o), {
                success: !0
            }
        } catch (e) {
            return c("clear data error", e), {
                success: !1,
                error: (e == null ? void 0 : e.message) || String(e)
            }
        }
    }
    chrome.runtime.onMessage.addListener((t, o, r) => {
        if (!(!t || typeof t.type != "string")) {
            if (t.type === "PING") {
                r({
                    ok: !0
                });
                return
            }
            return (async () => {
                    if (t.type === "CAPTURE_ACCOUNT_SNAPSHOT") {
                        let e = await E(t);
                        r(e);
                        return
                    }
                    if (t.type === "APPLY_ACCOUNT_SNAPSHOT") {
                        let e = await O(t);
                        r(e);
                        return
                    }
                    if (t.type === "OPEN_AND_APPLY_ACCOUNT_SNAPSHOT") {
                        let e = await _(t);
                        r(e);
                        return
                    }
                    if (t.type === "CLEAR_SITE_DATA") {
                        let e = await D(t);
                        r(e);
                        return
                    }
                    if (t.type === "DEBUG_LOG") {
                        let {
                            message: e,
                            level: a
                        } = t.payload;
                        console.log(`[Forwarded][${a||"info"}] ${e}`);
                        try {
                            let n = await chrome.tabs.query({
                                active: !0,
                                lastFocusedWindow: !0
                            });
                            n && n.length > 0 && n[0].id && chrome.tabs.sendMessage(n[0].id, t)
                                .catch(() => {})
                        } catch {}
                        r({
                            success: !0
                        });
                        return
                    }
                })()
                .catch(e => {
                    c("unhandled error", e), r({
                        success: !1,
                        error: (e == null ? void 0 : e.message) || String(e)
                    })
                }), !0
        }
    });
    c("background loaded");
})();