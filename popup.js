"use strict";
(() => {
    var X = new TextEncoder,
        pt = new TextDecoder;
    function I() {
        if (typeof crypto < "u" && crypto.subtle) return crypto;
        throw new Error("Current environment does not support Web Crypto API (crypto.subtle)")
    }
    function K(n) {
        let t = "";
        for (let e = 0; e < n.length; e += 1) t += String.fromCharCode(n[e]);
        return btoa(t)
    }
    function _(n) {
        let t = atob(n),
            e = new Uint8Array(t.length);
        for (let i = 0; i < t.length; i += 1) e[i] = t.charCodeAt(i);
        return e
    }
    async function mt(n, t) {
        let e = I()
            .subtle,
            i = await e.importKey("raw", X.encode(n), {
                name: "PBKDF2"
            }, !1, ["deriveKey"]);
        return e.deriveKey({
            name: "PBKDF2",
            salt: t,
            iterations: 1e5,
            hash: "SHA-256"
        }, i, {
            name: "AES-GCM",
            length: 256
        }, !1, ["encrypt", "decrypt"])
    }
    async function C(n, t) {
        let e = I(),
            i = t ? _(t) : (() => {
                let c = new Uint8Array(16);
                return e.getRandomValues(c), c
            })();
        return {
            key: await mt(n, i),
            saltBase64: K(i)
        }
    }
    async function B(n, t) {
        let e = I(),
            i = e.subtle,
            s = new Uint8Array(12);
        e.getRandomValues(s);
        let c = await i.encrypt({
            name: "AES-GCM",
            iv: s
        }, t, X.encode(n));
        return {
            cipherText: K(new Uint8Array(c)),
            iv: K(s)
        }
    }
    async function M(n, t) {
        let e = I()
            .subtle,
            i = _(n.cipherText),
            s = _(n.iv),
            c = await e.decrypt({
                name: "AES-GCM",
                iv: s
            }, t, i);
        return pt.decode(c)
    }
    var j = "accounts";
    function ht(n) {
        return new Promise((t, e) => {
            try {
                chrome.storage.local.get(n, i => {
                    let s = chrome.runtime.lastError;
                    s ? e(s) : t(i)
                })
            } catch (i) {
                e(i)
            }
        })
    }
    function ft(n) {
        return new Promise((t, e) => {
            try {
                chrome.storage.local.set(n, () => {
                    let i = chrome.runtime.lastError;
                    i ? e(i) : t()
                })
            } catch (i) {
                e(i)
            }
        })
    }
    async function $() {
        let t = (await ht([j]))[j];
        return t ? Array.isArray(t) ? t : [] : []
    }
    async function b(n) {
        await ft({
            [j]: n
        })
    }
    async function W(n, t) {
        let i = {
                version: 1,
                sites: await $()
            },
            s = JSON.stringify(i),
            c = await B(s, n);
        return {
            encryption: {
                salt: t,
                test: c,
                createdAt: new Date()
                    .toISOString()
            },
            encryptedAccounts: c,
            exportedAt: new Date()
                .toISOString()
        }
    }
    async function Z(n, t) {
        if (!n.encryptedAccounts) throw new Error("Invalid backup: missing encrypted data");
        let e = await M(n.encryptedAccounts, t),
            i = JSON.parse(e);
        if (!i || i.version !== 1 || !Array.isArray(i.sites)) throw new Error("Backup data structure incompatible or corrupted");
        await b(i.sites)
    }
    function E(n) {
        try {
            let t = new URL(n);
            return t.protocol === "chrome:" || t.protocol === "edge:" || t.protocol === "about:" ? null : t.hostname.toLowerCase()
        } catch {
            return null
        }
    }
    function gt(n) {
        return n.toLowerCase()
    }
    function Q(n) {
        return {
            id: gt(n),
            hostname: n,
            displayName: n
        }
    }
    function q(n) {
        let t = n.getTime(),
            e = 480 * 60 * 1e3;
        return new Date(t + e)
            .toISOString()
            .replace("Z", "+08:00")
    }
    function tt(n = "id") {
        let t = Date.now()
            .toString(36),
            e = Math.random()
            .toString(36)
            .slice(2, 8);
        return `${n}_${t}_${e}`
    }
    function et() {
        let n = ["#f87171", "#fb923c", "#facc15", "#a3e635", "#4ade80", "#22c55e", "#34d399", "#2dd4bf", "#38bdf8", "#60a5fa", "#3b82f6", "#818cf8", "#a78bfa", "#c084fc", "#e879f9", "#f472b6", "#fb7185"];
        return n[Math.floor(Math.random() * n.length)]
    }
    function nt(n) {
        let t = n.username || "",
            e = n.label || "",
            i = ["user", "username", "uid", "sid", "session", "token"],
            s = n.cookies.filter(l => i.includes(l.name.toLowerCase()))
            .map(l => `${l.name}=${l.value}`)
            .join(";"),
            a = ["user", "username", "uid", "token"].map(l => {
                let u = n.localStorage[l];
                return u ? `${l}=${u}` : ""
            })
            .filter(Boolean)
            .join(";");
        return [t, e, s, a].join("|#|")
    }
    function it(n, t, e) {
        let i = nt(t);
        return {
            duplicate: n.find(c => nt(c) === i)
        }
    }
    function st(n, t) {
        return n.findIndex(e => e.site.id === t)
    }
    function V(n, t, e) {
        let i = Q(t);
        e && (e.title && (i.displayName = e.title), e.iconUrl && (i.faviconUrl = e.iconUrl));
        let s = st(n, i.id);
        if (s >= 0) {
            let a = n[s],
                l = !1;
            if (e && (a.site.displayName === a.site.hostname && e.title && a.site.displayName !== e.title && (a.site.displayName = e.title, l = !0), e.iconUrl && a.site.faviconUrl !== e.iconUrl && (a.site.faviconUrl = e.iconUrl, l = !0)), l) {
                let u = [...n];
                return u[s] = a, {
                    sites: u,
                    site: a
                }
            }
            return {
                sites: n,
                site: a
            }
        }
        let c = {
            site: i,
            accounts: []
        };
        return {
            sites: [...n, c],
            site: c
        }
    }
    function rt(n, t, e, i) {
        let s = q(new Date);
        return {
            id: tt("acct"),
            siteId: n,
            label: e || i || "未命名账号",
            username: i,
            avatarColor: et(),
            createdAt: s,
            updatedAt: s,
            cookies: t.cookies,
            localStorage: t.pageState.localStorage,
            loginInfo: t.pageState.loginInfo
        }
    }
    function at(n, t, e, i) {
        let s = q(new Date);
        return {
            ...n,
            label: e || n.label,
            username: i || n.username,
            updatedAt: s,
            cookies: t.cookies,
            localStorage: t.pageState.localStorage,
            loginInfo: t.pageState.loginInfo
        }
    }
    function J(n, t) {
        let e = st(n, t.site.id);
        if (e === -1) return [...n, t];
        let i = [...n];
        return i[e] = t, i
    }
    function ot(n, t) {
        return it(n.accounts, t, n.site.hostname)
    }
    function ct() {
        document.querySelectorAll("[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-tooltip]")
            .forEach(t => {
                let e = t.getAttribute("data-i18n");
                if (e) {
                    let a = chrome.i18n.getMessage(e);
                    a && (t.hasAttribute("data-i18n-html") ? t.innerHTML = a : t.tagName === "INPUT" || t.tagName === "TEXTAREA" ? (t.hasAttribute("placeholder"), t.placeholder = a) : t.tagName === "IMG" && t.hasAttribute("alt") ? t.alt = a : t.textContent = a)
                }
                let i = t.getAttribute("data-i18n-title");
                if (i) {
                    let a = chrome.i18n.getMessage(i);
                    a && t.setAttribute("title", a)
                }
                let s = t.getAttribute("data-i18n-tooltip");
                if (s) {
                    let a = chrome.i18n.getMessage(s);
                    a && t.setAttribute("data-tooltip", a)
                }
                let c = t.getAttribute("data-i18n-placeholder");
                if (c) {
                    let a = chrome.i18n.getMessage(c);
                    a && (t.placeholder = a)
                }
            })
    }
    function r(n, t) {
        return chrome.i18n.getMessage(n, t)
    }
    var Y = class {
            constructor() {
                this.resolve = null;
                this.currentType = "alert";
                this.overlay = document.getElementById("modal-overlay"), this.titleEl = document.getElementById("modal-title"), this.messageEl = document.getElementById("modal-message"), this.inputContainer = document.getElementById("modal-input-container"), this.inputEl = document.getElementById("modal-input"), this.errorEl = document.getElementById("modal-input-error"), this.btnConfirm = document.getElementById("modal-btn-confirm"), this.btnCancel = document.getElementById("modal-btn-cancel"), this.bindEvents()
            }
            bindEvents() {
                this.btnConfirm.addEventListener("click", () => this.handleConfirm()), this.btnCancel.addEventListener("click", () => this.handleCancel()), this.overlay.addEventListener("keydown", t => {
                    if (t.key === "Enter") {
                        if (this.currentType === "prompt" && document.activeElement !== this.inputEl) return;
                        this.handleConfirm()
                    } else t.key === "Escape" && this.handleCancel()
                }), this.inputEl.addEventListener("keydown", t => {
                    t.key === "Enter" && this.handleConfirm()
                })
            }
            reset() {
                this.titleEl.textContent = r("modalTitleInfo"), this.messageEl.textContent = "", this.inputEl.value = "", this.inputEl.type = "text", this.inputEl.placeholder = "", this.errorEl.textContent = "", this.errorEl.classList.add("hidden"), this.inputContainer.classList.add("hidden"), this.btnCancel.classList.remove("hidden"), this.btnConfirm.textContent = r("confirm"), this.btnCancel.textContent = r("cancel"), this.resolve = null
            }
            show(t) {
                return this.reset(), this.currentType = t.type, this.titleEl.textContent = t.title || (t.type === "confirm" ? r("modalTitleConfirm") : r("modalTitleInfo")), this.messageEl.innerHTML = t.message.replace(/\n/g, "<br>"), t.confirmText && (this.btnConfirm.textContent = t.confirmText), t.cancelText && (this.btnCancel.textContent = t.cancelText), t.type === "alert" ? this.btnCancel.classList.add("hidden") : t.type === "prompt" && (this.inputContainer.classList.remove("hidden"), t.inputType && (this.inputEl.type = t.inputType), t.inputPlaceholder && (this.inputEl.placeholder = t.inputPlaceholder), t.defaultValue && (this.inputEl.value = t.defaultValue), setTimeout(() => this.inputEl.focus(), 100)), this.overlay.classList.remove("hidden"), new Promise(e => {
                    this.resolve = e
                })
            }
            hide() {
                this.overlay.classList.add("hidden")
            }
            handleConfirm() {
                if (this.resolve)
                    if (this.currentType === "prompt") {
                        let t = this.inputEl.value.trim();
                        this.hide(), this.resolve(t)
                    } else this.currentType === "confirm" ? (this.hide(), this.resolve(!0)) : (this.hide(), this.resolve(!0))
            }
            handleCancel() {
                this.resolve && (this.hide(), this.currentType === "prompt" ? this.resolve(null) : this.currentType === "confirm" ? this.resolve(!1) : this.resolve(!0))
            }
            async alert(t, e) {
                await this.show({
                    type: "alert",
                    message: t,
                    title: e
                })
            }
            async confirm(t, e, i, s) {
                return this.show({
                    type: "confirm",
                    message: t,
                    title: e,
                    confirmText: i,
                    cancelText: s
                })
            }
            async prompt(t, e, i, s = "text") {
                return this.show({
                    type: "prompt",
                    message: t,
                    defaultValue: e,
                    title: i,
                    inputType: s
                })
            }
        },
        d = new Y;
    var D = class {
        constructor() {
            this.STORAGE_KEY = "feedback_draft";
            this.MAX_CHARS = 200;
            this.overlay = document.getElementById("feedback-modal-overlay"), this.closeBtn = document.getElementById("feedback-btn-close"), this.submitBtn = document.getElementById("feedback-btn-submit"), this.input = document.getElementById("feedback-input"), this.charCount = document.getElementById("feedback-char-count"), this.errorMsg = document.getElementById("feedback-error"), this.checkboxes = document.querySelectorAll('input[name="feature"]'), this.bindEvents(), this.loadDraft()
        }
        bindEvents() {
            this.closeBtn.addEventListener("click", () => this.hide()), this.overlay.addEventListener("click", t => {
                t.target === this.overlay && this.hide()
            }), this.input.addEventListener("input", () => {
                this.updateCharCount(), this.saveDraft(), this.clearError()
            }), this.checkboxes.forEach(t => {
                t.addEventListener("change", () => {
                    this.saveDraft(), this.clearError()
                })
            }), this.submitBtn.addEventListener("click", () => this.handleSubmit())
        }
        show() {
            this.overlay.classList.remove("hidden"), this.updateCharCount()
        }
        hide() {
            this.overlay.classList.add("hidden")
        }
        updateCharCount() {
            let t = this.input.value.length;
            this.charCount.textContent = `${t}/${this.MAX_CHARS}`, t >= this.MAX_CHARS ? (this.charCount.classList.add("error"), this.input.classList.add("error"), this.charCount.classList.remove("warning"), this.input.classList.remove("warning")) : t >= this.MAX_CHARS * .9 ? (this.charCount.classList.add("warning"), this.input.classList.add("warning"), this.charCount.classList.remove("error"), this.input.classList.remove("error")) : (this.charCount.classList.remove("warning", "error"), this.input.classList.remove("warning", "error"))
        }
        saveDraft() {
            let t = {
                features: Array.from(this.checkboxes)
                    .filter(e => e.checked)
                    .map(e => e.value),
                content: this.input.value
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(t))
        }
        loadDraft() {
            let t = localStorage.getItem(this.STORAGE_KEY);
            if (t) try {
                let e = JSON.parse(t);
                e.content && (this.input.value = e.content), e.features && this.checkboxes.forEach(i => {
                    i.checked = e.features.includes(i.value)
                })
            } catch (e) {
                console.error("Failed to load feedback draft", e)
            }
        }
        clearDraft() {
            localStorage.removeItem(this.STORAGE_KEY), this.input.value = "", this.checkboxes.forEach(t => t.checked = !1), this.updateCharCount()
        }
        setError(t) {
            this.errorMsg.textContent = t, this.errorMsg.classList.remove("hidden")
        }
        clearError() {
            this.errorMsg.classList.add("hidden"), this.errorMsg.textContent = ""
        }
        async handleSubmit() {
            if (this.submitBtn.disabled) return;
            let t = Array.from(this.checkboxes)
                .filter(i => i.checked),
                e = this.input.value.trim();
            if (t.length === 0 && e.length === 0) {
                this.setError(r("enterFeedbackContent"));
                return
            }
            this.setLoading(!0);
            try {
                if (!(await fetch("https://api-pan.fextool.com/app-api/plugin/feedback/create", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "tenant-id": "163"
                        },
                        body: JSON.stringify({
                            tips: t.map(s => {
                                    var c, a;
                                    return ((a = (c = s.nextElementSibling) == null ? void 0 : c.textContent) == null ? void 0 : a.trim()) || s.value
                                })
                                .join(","),
                            customText: e,
                            deviceInfo: navigator.userAgent,
                            clientIp: ""
                        })
                    }))
                    .ok) throw new Error(r("submitFailed"));
                this.setSuccess(), setTimeout(() => {
                    this.hide(), this.clearDraft(), this.resetButton()
                }, 3e3)
            } catch (i) {
                this.setError(i.message || r("submitFailed")), this.setLoading(!1)
            }
        }
        setLoading(t) {
            let e = this.submitBtn.querySelector(".btn-text"),
                i = this.submitBtn.querySelector(".btn-loading");
            this.submitBtn.disabled = t, t ? (e.classList.add("hidden"), i.classList.remove("hidden"), this.clearError()) : (e.classList.remove("hidden"), i.classList.add("hidden"))
        }
        setSuccess() {
            let t = this.submitBtn.querySelector(".btn-text"),
                e = this.submitBtn.querySelector(".btn-loading"),
                i = this.submitBtn.querySelector(".btn-success");
            this.submitBtn.disabled = !0, this.submitBtn.classList.replace("btn-primary", "btn-success"), this.submitBtn.style.backgroundColor = "var(--success-color)", this.submitBtn.style.borderColor = "transparent", e.classList.add("hidden"), t.classList.add("hidden"), i.classList.remove("hidden")
        }
        resetButton() {
            let t = this.submitBtn.querySelector(".btn-text"),
                e = this.submitBtn.querySelector(".btn-loading"),
                i = this.submitBtn.querySelector(".btn-success");
            this.submitBtn.disabled = !1, this.submitBtn.classList.replace("btn-success", "btn-primary"), this.submitBtn.style.backgroundColor = "", this.submitBtn.style.borderColor = "", t.classList.remove("hidden"), e.classList.add("hidden"), i.classList.add("hidden")
        }
    };
    async function N(n) {
        let t = (n == null ? void 0 : n.message) || String(n);
        if (t.includes("Receiving end does not exist") || t.includes("Could not establish connection")) {
            await d.confirm(`Failed to Collect account information: The connection to the page has been lost.
                              This is usually because the page wasn't refreshed after the extension was updated.
                              Refresh the current page now? (The function will be restored after refreshing.)`, 
                              "Connection Interrupted", 
                              "Refresh Page", 
                              "Cancel"
            ) && (chrome.tabs.reload(), window.close());
            return
        }
        if (t.includes("quota exceeded") || t.includes("QuotaBytes")) {
            await d.alert(`Storage space insufficient.
                            The currently saved account data has reached the browser extension storage limit. 
                            Please try deleting some infrequently used account backups, or wait for the extension 
                            update to support unlimited storage permissions`, 
                            "Storage Quota Exceeded"
            );
            return
        }
        await d.alert(`Operation failed: ${t}`)
    }
    var lt = "ad_data";
    var P = class {
        constructor() {
            this.timer = null;
            this.currentAdData = null;
            this.renderCallback = null;
            this.loadFromStorage()
        }
        start(t) {
            this.stop(), this.renderCallback = i => {
                try {
                    t(i)
                } catch (s) {
                    console.error("[AdService] Render callback failed", s)
                }
            }, this.currentAdData && this.renderCallback(this.currentAdData);
            let e = () => this.fetchAds();
            "requestIdleCallback" in window ? window.requestIdleCallback(e, {
                timeout: 2e3
            }) : setTimeout(e, 200), this.timer = window.setInterval(() => {
                this.fetchAds()
            }, 6e4)
        }
        stop() {
            this.timer && (clearInterval(this.timer), this.timer = null)
        }
        loadFromStorage() {
            try {
                let t = localStorage.getItem(lt);
                t && (this.currentAdData = JSON.parse(t))
            } catch (t) {
                console.error("Failed to load ad data from storage", t)
            }
        }
        async fetchAds() {
            var t;
            try {
                let e = await fetch("https://api-pan.fextool.com/app-api/plugin/ad-banner/get", {
                    method: "GET",
                    headers: {
                        "tenant-id": "163"
                    },
                    cache: "no-store"
                });
                if (!e.ok) throw new Error(`HTTP error! status: ${e.status}`);
                let i = await e.json();
                if (i.code !== 0 || !i.data) return;
                let s = {
                    timestamp: i.data.timestamp,
                    topAd: this.normalizeAdContent(i.data.topAd || ""),
                    bottomAd: this.normalizeAdContent(i.data.bottomAd || "")
                };
                if (!this.isValidAdData(s)) {
                    console.warn("Invalid ad data received", s);
                    return
                }
                let c = ((t = this.currentAdData) == null ? void 0 : t.timestamp) || 0;
                s.timestamp > c && this.updateAds(s)
            } catch (e) {
                console.error("Failed to fetch ads", e)
            }
        }
        normalizeAdContent(t) {
            if (!t) return "";
            if (t.includes("&lt;") && t.includes("&gt;")) try {
                let e = document.createElement("div");
                e.innerHTML = t;
                let i = e.textContent || "";
                if (i.trim()
                    .startsWith("<") && i.includes(">")) return i.replace(/\\"/g, '"')
            } catch {}
            return t
        }
        updateAds(t) {
            this.currentAdData = t, localStorage.setItem(lt, JSON.stringify(t)), this.renderCallback && this.renderCallback(t)
        }
        isValidAdData(t) {
            return t && typeof t.timestamp == "number" && typeof t.topAd == "string" && typeof t.bottomAd == "string"
        }
    };
    var o = {
            sites: [],
            currentHostname: null,
            currentSiteId: null,
            cloud: null
        },
        yt = new D,
        bt = new P;
    function f(n) {
        let t = document.getElementById(n);
        if (!t) throw new Error(`Missing element #${n}`);
        return t
    }
    function H(n, t) {
        let e = document.getElementById(n);
        e && (e.textContent = t)
    }
    function y(n, t) {
        let e = document.getElementById(n);
        e && (t ? e.classList.remove("hidden") : e.classList.add("hidden"))
    }
    function O() {
        return new Promise(n => {
            try {
                chrome.tabs.query({
                    active: !0,
                    currentWindow: !0
                }, t => {
                    n(t && t[0] ? t[0] : null)
                })
            } catch {
                n(null)
            }
        })
    }
    function R(n) {
        return new Promise((t, e) => {
            try {
                chrome.runtime.sendMessage(n, i => {
                    let s = chrome.runtime.lastError;
                    s ? e(s) : t(i)
                })
            } catch (i) {
                e(i)
            }
        })
    }
    async function vt() {
        ct();
        let t = chrome.runtime.getManifest()
            .version || "";
        H("app-version", `v${t}`)
    }
    async function St() {
        try {
            o.sites = await $()
        } catch (n) {
            console.error("load accounts error", n), o.sites = []
        }
        await Et(), v()
    }
    async function Et() {
        let n = await O();
        if (!n || !n.url) {
            o.currentHostname = null, o.currentSiteId = null;
            return
        }
        let t = E(n.url);
        o.currentHostname = t, o.currentSiteId = t || null
    }
    function v() {
        wt(), Bt()
    }
    function wt() {
        let n = f("site-list");
        if (n.innerHTML = "", !o.sites.length) {
            y("site-list", !1), y("site-empty", !0);
            return
        }
        y("site-list", !0), y("site-empty", !1);
        let t = o.currentSiteId;
        o.sites.forEach(e => {
            let i = document.createElement("li");
            i.className = "site-item" + (e.site.id === t ? " active" : ""), i.dataset.siteId = e.site.id, i.draggable = !0, i.addEventListener("dragstart", At), i.addEventListener("dragover", Ct), i.addEventListener("drop", kt), i.addEventListener("dragend", Lt);
            let s = document.createElement("div");
            if (s.className = "site-avatar", e.site.faviconUrl) {
                let m = document.createElement("img");
                m.src = e.site.faviconUrl, m.style.width = "100%", m.style.height = "100%", m.style.borderRadius = "50%", m.style.objectFit = "cover", s.style.backgroundColor = "transparent", m.onerror = () => {
                    m.style.display = "none", s.style.backgroundColor = "", s.textContent = (e.site.displayName || e.site.hostname || "?")
                        .charAt(0)
                        .toUpperCase()
                }, s.appendChild(m)
            } else s.textContent = (e.site.displayName || e.site.hostname || "?")
                .charAt(0)
                .toUpperCase();
            let c = document.createElement("div");
            c.className = "site-meta";
            let a = document.createElement("span");
            a.className = "site-name", a.textContent = e.site.displayName || e.site.hostname;
            let l = document.createElement("span");
            l.className = "site-host", l.textContent = e.site.hostname, c.appendChild(a), c.appendChild(l);
            let u = document.createElement("div");
            u.className = "site-item-actions";
            let p = document.createElement("button");
            p.className = "btn-icon-xs" + (e.site.isPinned ? " pinned" : ""), p.title = e.site.isPinned ? r("unpinSite") : r("pinSite"), p.innerHTML = e.site.isPinned ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #3b82f6;"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>', p.addEventListener("click", m => {
                m.stopPropagation(), xt(e.site.id)
            });
            let h = document.createElement("button");
            h.className = "btn-icon-xs", h.title = r("titleDeleteSite"), h.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>', h.addEventListener("click", async m => {
                m.stopPropagation(), await d.confirm(r("confirmDeleteSite", [e.site.displayName]), r("titleDeleteSite")) && It(e.site.id)
            }), u.appendChild(p), u.appendChild(h), i.appendChild(s), i.appendChild(c), i.appendChild(u), i.addEventListener("click", () => {
                o.currentSiteId = e.site.id, v()
            }), n.appendChild(i)
        })
    }
    var L = null;
    function At(n) {
        let t = n.currentTarget;
        L = t.dataset.siteId || null, n.dataTransfer.effectAllowed = "move", n.dataTransfer.setData("text/plain", L || ""), t.classList.add("dragging")
    }
    function Ct(n) {
        n.preventDefault && n.preventDefault(), n.dataTransfer.dropEffect = "move";
        let t = n.currentTarget.closest(".site-item");
        if (t) return t.classList.add("drag-over"), !1
    }
    function Lt(n) {
        n.currentTarget.classList.remove("dragging"), document.querySelectorAll(".site-item")
            .forEach(i => {
                i.classList.remove("drag-over")
            })
    }
    async function kt(n) {
        n.stopPropagation && n.stopPropagation();
        let t = n.currentTarget.closest(".site-item");
        if (!t || !L) return !1;
        let e = t.dataset.siteId;
        return L === e || await Tt(L, e), !1
    }
    async function Tt(n, t) {
        let e = o.sites.findIndex(p => p.site.id === n),
            i = o.sites.findIndex(p => p.site.id === t);
        if (e === -1 || i === -1) return;
        let s = o.sites[e],
            c = o.sites[i];
        s.site.isPinned !== c.site.isPinned && (s.site.isPinned = c.site.isPinned), [...o.sites].splice(e, 1);
        let l = o.sites.filter(p => p.site.id !== n),
            u = l.findIndex(p => p.site.id === t);
        l.splice(u, 0, s), o.sites = l, await b(o.sites), v()
    }
    async function xt(n) {
        let t = o.sites.findIndex(i => i.site.id === n);
        if (t === -1) return;
        let e = o.sites[t];
        e.site.isPinned = !e.site.isPinned, o.sites.sort((i, s) => i.site.isPinned === s.site.isPinned ? 0 : i.site.isPinned ? -1 : 1), await b(o.sites), v()
    }
    async function It(n) {
        var t;
        o.sites = o.sites.filter(e => e.site.id !== n), o.currentSiteId === n && (o.currentSiteId = ((t = o.sites[0]) == null ? void 0 : t.site.id) || null), await b(o.sites), v()
    }
    function Bt() {
        var c;
        let n = f("account-list");
        n.innerHTML = "";
        let t = o.currentSiteId ? o.sites.find(a => a.site.id === o.currentSiteId) : null;
        if (!t) {
            H("current-site-name", o.currentHostname || r("currentSiteUnsupported")), H("current-site-host", ""), y("account-empty", !0), y("btn-clear-data", !1);
            return
        }
        let e = f("current-site-name");
        e.textContent = t.site.displayName, e.title = r("clickToEditSiteName"), e.style.cursor = "pointer";
        let i = e.cloneNode(!0);
        (c = e.parentNode) == null || c.replaceChild(i, e), i.addEventListener("click", async () => {
            let a = await d.prompt(r("promptNewSiteName"), t.site.displayName, r("titleEditSiteName"));
            if (a && a !== t.site.displayName) {
                let l = o.sites.findIndex(u => u.site.id === t.site.id);
                l !== -1 && (o.sites[l].site.displayName = a, await b(o.sites), v())
            }
        }), H("current-site-host", t.site.hostname);
        let s = o.currentHostname === t.site.hostname;
        if (y("btn-clear-data", s), !t.accounts.length) {
            y("account-list", !1), y("account-empty", !0);
            return
        }
        y("account-list", !0), y("account-empty", !1), t.accounts.forEach(a => {
            let l = document.createElement("div");
            l.className = "account-card";
            let u = document.createElement("div");
            u.className = "account-avatar", u.textContent = (a.label || a.username || "?")
                .charAt(0)
                .toUpperCase(), a.avatarColor && (u.style.backgroundColor = a.avatarColor, u.style.color = "#fff");
            let p = document.createElement("div");
            p.className = "account-main";
            let h = document.createElement("div");
            h.className = "account-title-row";
            let m = document.createElement("span");
            m.className = "account-label", m.textContent = a.label, m.title = r("clickToEditAccountName"), m.style.cursor = "pointer", m.addEventListener("click", async g => {
                g.stopPropagation();
                let F = await d.prompt(r("promptNewAccountName"), a.label, r("titleEditAccountName"));
                if (F && F !== a.label && o.currentSiteId) {
                    let U = o.sites.findIndex(G => G.site.id === o.currentSiteId);
                    if (U !== -1) {
                        let z = o.sites[U].accounts.findIndex(ut => ut.id === a.id);
                        z !== -1 && (o.sites[U].accounts[z].label = F, await b(o.sites), v())
                    }
                }
            }), h.appendChild(m);
            let S = document.createElement("div");
            S.className = "account-meta-row";
            let w = document.createElement("span");
            w.textContent = `${r("updatedAt")}${a.updatedAt.slice(0,19).replace("T"," ")}`, S.appendChild(w), p.appendChild(h), p.appendChild(S);
            let A = document.createElement("div");
            A.className = "account-actions";
            let k = document.createElement("button");
            k.className = "btn btn-primary btn-xs", k.textContent = r("switch"), k.addEventListener("click", () => {
                Nt(a)
                    .catch(g => {
                        console.error(g), d.alert(r("switchFailed", [(g == null ? void 0 : g.message) || g]))
                    })
            });
            let T = document.createElement("button");
            T.className = "btn btn-outline btn-xs", T.textContent = r("share"), T.addEventListener("click", () => {
                Pt(a)
                    .catch(g => {
                        console.error(g), d.alert(r("shareFailed", [(g == null ? void 0 : g.message) || g]))
                    })
            });
            let x = document.createElement("button");
            x.className = "btn btn-secondary btn-xs", x.textContent = r("delete"), x.addEventListener("click", async () => {
                await d.confirm(r("confirmDeleteAccount"), r("confirmDeleteTitle")) && Mt(a.id)
            }), A.appendChild(k), A.appendChild(T), A.appendChild(x), l.appendChild(u), l.appendChild(p), l.appendChild(A), n.appendChild(l)
        })
    }
    async function Mt(n) {
        if (!o.currentSiteId) return;
        let t = o.sites.findIndex(a => a.site.id === o.currentSiteId);
        if (t === -1) return;
        let e = o.sites[t],
            i = e.accounts.filter(a => a.id !== n),
            s = {
                ...e,
                accounts: i
            },
            c = [...o.sites];
        c[t] = s, o.sites = c, await b(o.sites), v()
    }
    async function Dt() {
        var h, m;
        let n = await O();
        if (!n || !n.id || !n.url) {
            await d.alert(r("errorGetTabInfo"));
            return
        }
        let t = E(n.url);
        if (!t) {
            await d.alert(r("errorNotManageableSite"));
            return
        }
        let e = await R({
            type: "CAPTURE_ACCOUNT_SNAPSHOT",
            payload: {
                tabId: n.id,
                url: n.url
            }
        });
        if (!e.success || !e.snapshot) {
            await N(e.error || r("unknownError"));
            return
        }
        let {
            sites: i,
            site: s
        } = V(o.sites, t, e.snapshot.pageState.siteInfo);
        o.sites = i;
        let c = ((h = e.snapshot.pageState.loginInfo) == null ? void 0 : h.username) || ((m = e.snapshot.pageState.loginInfo) == null ? void 0 : m.hint) || "",
            a = rt(s.site.id, e.snapshot, t, c),
            l = ot(s, a),
            u = a,
            p = s;
        l.duplicate ? await d.confirm(r("duplicateAccountDetected"), r("duplicateCheckTitle"), r("update"), r("addNew")) ? (u = at(l.duplicate, e.snapshot, t, c), p = {
            ...s,
            accounts: s.accounts.map(w => w.id === l.duplicate.id ? u : w)
        }) : p = {
            ...s,
            accounts: [...s.accounts, a]
        } : p = {
            ...s,
            accounts: [...s.accounts, a]
        }, o.sites = J(o.sites, p), o.currentSiteId = p.site.id, await b(o.sites), v(), await d.alert(r("addAccountSuccess"), r("titleAddSuccess"))
    }
    async function Nt(n) {
        let t = await O();
        if (!t || !t.id || !t.url) 
          throw new Error("Unable to obtain information about the current tab, possibly due to an unsupported page type.");
        let e = E(t.url),
            i = o.sites.find(a => a.site.id === n.siteId),
            s = i ? i.site.hostname : n.siteId;
        if (!e || e !== s) {
            let a = `https://${s}`,
                l = await R({
                    type: "OPEN_AND_APPLY_ACCOUNT_SNAPSHOT",
                    payload: {
                        url: a,
                        snapshot: {
                            cookies: n.cookies,
                            pageState: {
                                localStorage: n.localStorage,
                                loginInfo: n.loginInfo
                            }
                        }
                    }
                });
            if (!l.success) throw new Error(l.error || r("switchFailed", [r("unknownError")]));
            return
        }
        let c = await R({
            type: "APPLY_ACCOUNT_SNAPSHOT",
            payload: {
                tabId: t.id,
                url: t.url,
                snapshot: {
                    cookies: n.cookies,
                    pageState: {
                        localStorage: n.localStorage,
                        loginInfo: n.loginInfo
                    }
                }
            }
        });
        if (!c.success) throw new Error(c.error || r("switchFailed", [r("unknownError")]))
    }
    async function Pt(n) {
        let t = await d.prompt(r("promptSharePassword"), void 0, r("titleShareAccount"), "password");
        if (t === null) return;
        let e;
        if (t) {
            let {
                key: a,
                saltBase64: l
            } = await C(t), u = JSON.stringify(n), p = await B(u, a);
            e = {
                version: 1,
                type: "share_account",
                encryption: {
                    salt: l,
                    createdAt: new Date()
                        .toISOString()
                },
                encryptedData: p
            }
        } else e = {
            version: 1,
            type: "share_account",
            account: n
        };
        let i = new Blob([JSON.stringify(e, null, 2)], {
                type: "application/json"
            }),
            s = URL.createObjectURL(i),
            c = document.createElement("a");
        c.href = s, c.download = `account-share-${n.label||"unnamed"}-${Date.now()}.json`, c.click(), URL.revokeObjectURL(s)
    }
    async function Ht(n) {
        let t = await n.text();
        try {
            let e = JSON.parse(t);
            if (e.type !== "share_account" || e.version !== 1) throw new Error(r("invalidShareFile"));
            let i;
            if (e.encryption && e.encryptedData) {
                let h = await d.prompt(r("promptEncryptedFilePassword"), void 0, r("titleImportShare"), "password");
                if (h === null) return;
                if (!e.encryption.salt) throw new Error(r("missingEncryptionInfo"));
                try {
                    let {
                        key: m
                    } = await C(h, e.encryption.salt), S = await M(e.encryptedData, m);
                    i = JSON.parse(S)
                } catch {
                    throw new Error(r("decryptFailed"))
                }
            } else if (e.account) i = e.account;
            else throw new Error(r("incompleteFile"));
            let s = "";
            i.cookies && i.cookies.length > 0 && i.cookies[0].domain && (s = E(i.cookies[0].domain)), !s && o.currentHostname && (s = o.currentHostname);
            let c = "";
            if (i.cookies && i.cookies.length > 0 && i.cookies[0].domain && (c = E(i.cookies[0].domain)), !c && o.currentSiteId) {
                let h = o.sites.find(m => m.site.id === o.currentSiteId);
                h && (c = h.site.hostname)
            }
            if (!c) throw new Error(r("unknownSiteDomain"));
            let a = {
                    title: c,
                    iconUrl: ""
                },
                {
                    sites: l,
                    site: u
                } = V(o.sites, c, a);
            o.sites = l, i.id = crypto.randomUUID(), i.siteId = u.site.id, i.createdAt = new Date()
                .toISOString(), i.updatedAt = new Date()
                .toISOString(), i.label = i.label + " (导入)";
            let p = {
                ...u,
                accounts: [...u.accounts, i]
            };
            o.sites = J(o.sites, p), o.currentSiteId === p.site.id || (o.currentSiteId = p.site.id), await b(o.sites), v(), await d.alert(r("importSuccess"), r("titleImportSuccess"))
        } catch (e) {
            let i = (e == null ? void 0 : e.message) || e;
            await d.alert(r("importFailed", [i]))
        }
    }
    async function Rt() {
        let n = await d.prompt(r("promptBackupPassword"), void 0, r("titleExportBackup"), "password");
        if (!n) return;
        let {
            key: t,
            saltBase64: e
        } = await C(n), i = await W(t, e);
        if (!i) {
            await d.alert(r("noDataToBackup"));
            return
        }
        let s = new Blob([JSON.stringify(i, null, 2)], {
                type: "application/json"
            }),
            c = URL.createObjectURL(s),
            a = document.createElement("a");
        a.href = c, a.download = `multi-account-backup-${Date.now()}.json`, a.click(), URL.revokeObjectURL(c)
    }
    async function Ot(n) {
        let t = await n.text();
        try {
            let e = JSON.parse(t),
                i = await d.prompt(r("promptRestorePassword"), void 0, r("importBackup"), "password");
            if (!i) return;
            if (!e.encryption || !e.encryption.salt) throw new Error(r("restoreMissingEncryption"));
            let {
                key: s
            } = await C(i, e.encryption.salt);
            await Z(e, s), await d.alert(r("restoreSuccess")), window.location.reload()
        } catch (e) {
            let i = (e == null ? void 0 : e.message) || e;
            (i.toString()
                .includes("OperationError") || i.toString()
                .includes("operation failed")) && (i = r("decryptPasswordIncorrect")), await d.alert(r("restoreFailed", [i]))
        }
    }
    async function Ft() {
        let n = await O();
        if (!(!n || !n.id || !n.url) && await d.confirm(r("confirmClearData"), r("titleClearData"))) {
            let t = await R({
                type: "CLEAR_SITE_DATA",
                payload: {
                    tabId: n.id,
                    url: n.url
                }
            });
            t.success || await N(t.error || r("clearFailed"))
        }
    }
    function Ut() {
        let n = f("security-status");
        n.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M8 11h8"></path><path d="M12 7v8"></path></svg>
    <span>${r("dataLocalstorage")}</span>
  `
    }
    function Kt() {
        let n = f("btn-settings"),
            t = document.getElementById("btn-settings-back"),
            e = f("view-home"),
            i = f("view-settings"),
            s = f("sidebar");
        n.addEventListener("click", () => {
            !i.classList.contains("hidden") ? (i.classList.add("hidden"), e.classList.remove("hidden"), s.classList.remove("hidden")) : (e.classList.add("hidden"), s.classList.add("hidden"), i.classList.remove("hidden"))
        }), t && t.addEventListener("click", () => {
            i.classList.add("hidden"), e.classList.remove("hidden"), s.classList.remove("hidden")
        })
    }
    function _t() {
        let n = f("btn-feedback");
        n && n.addEventListener("click", () => {
            yt.show()
        });
        let t = f("btn-share");
        t && t.addEventListener("click", async () => {
            let e = r("shareText");
            try {
                await navigator.clipboard.writeText(e), await d.alert(r("shareCopied"), r("shareSuccess"))
            } catch (i) {
                console.error("Failed to copy: ", i), await d.alert(r("copyFailed"), r("error"))
            }
        })
    }
    function jt(n) {
        let t = document.getElementById("ad-top-container"),
            e = document.getElementById("ad-bottom-container");
        t && (n.topAd ? (t.innerHTML = n.topAd, t.classList.remove("hidden")) : t.classList.add("hidden")), e && (n.bottomAd ? (e.innerHTML = n.bottomAd, e.classList.remove("hidden")) : e.classList.add("hidden"))
    }
    function $t() {
        f("btn-backup")
            .addEventListener("click", () => {
                Rt()
                    .catch(e => {
                        console.error(e), d.alert(r("backupFailed", [(e == null ? void 0 : e.message) || e]))
                    })
            });
        let t = f("input-restore-file");
        t.addEventListener("change", () => {
            let e = t.files && t.files[0];
            e && (Ot(e)
                .catch(i => {
                    console.error(i), d.alert(r("restoreFailed", [(i == null ? void 0 : i.message) || i]))
                }), t.value = "")
        })
    }
    function qt() {
        f("btn-add-account")
            .addEventListener("click", () => {
                Dt()
                    .catch(s => {
                        console.error(s), d.alert(r("addAccountFailed", [(s == null ? void 0 : s.message) || s]))
                    })
            });
        let t = document.getElementById("btn-import-share"),
            e = document.getElementById("input-import-share");
        t && e && (t.addEventListener("click", () => {
                e.click()
            }), e.addEventListener("change", () => {
                let s = e.files && e.files[0];
                s && (Ht(s)
                    .catch(c => {
                        console.error(c), d.alert(r("importShareFailed", [(c == null ? void 0 : c.message) || c]))
                    }), e.value = "")
            })), f("btn-clear-data")
            .addEventListener("click", () => {
                Ft()
                    .catch(s => {
                        console.error(s), N(s)
                    })
            })
    }
    console.log("[Popup] Script loaded (top-level)");
    async function Vt() {
        try {
            await vt(), qt(), _t(), $t(), Kt(), Ut(), bt.start(jt), await St()
        } catch (n) {
            throw console.error("[Bootstrap] Error during bootstrap:", n), n
        }
    }
    function dt() {
        Vt()
            .catch(n => {
                console.error("popup init error", n)
            })
    }
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", dt) : dt();
})();