"use strict";

/**
 * Background service worker for MultiAccount Manager
 * Manages cookies, tabs, and coordinates with content scripts
 */
(() => {
    /**
     * Logging utility
     */
    function log(...args) {
        console.log("[MultiAccount][bg]", ...args);
    }

    /**
     * Extract hostname from URL
     */
    function extractHostname(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return "";
        }
    }

    /**
     * Get all cookies for a URL (including domain cookies)
     */
    function getAllCookies(url) {
        return new Promise(async (resolve, reject) => {
            try {
                // Get cookies specific to the URL
                const urlCookiesPromise = new Promise((resolve) => {
                    chrome.cookies.getAll({ url }, (cookies) => {
                        resolve(chrome.runtime.lastError ? [] : cookies);
                    });
                });

                const hostname = extractHostname(url);
                if (!hostname) {
                    const urlCookies = await urlCookiesPromise;
                    resolve(formatCookies(urlCookies));
                    return;
                }

                // Split hostname to get domain
                const hostParts = hostname.split(".");
                const domain = hostParts.length > 1 ? hostParts.slice(-2).join(".") : hostname;

                // Get cookies for the domain
                const domainCookiesPromise = new Promise((resolve) => {
                    chrome.cookies.getAll({ domain }, (cookies) => {
                        resolve(chrome.runtime.lastError ? [] : cookies);
                    });
                });

                const [urlCookies, domainCookies] = await Promise.all([urlCookiesPromise, domainCookiesPromise]);
                const allCookies = [...urlCookies];
                const cookieSet = new Set(urlCookies.map((c) => getCookieKey(c)));

                // Add domain cookies that aren't already in the URL cookies
                for (const cookie of domainCookies) {
                    const key = getCookieKey(cookie);
                    if (!cookieSet.has(key)) {
                        allCookies.push(cookie);
                        cookieSet.add(key);
                    }
                }

                resolve(formatCookies(allCookies));
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate unique key for a cookie
     */
    function getCookieKey(cookie) {
        return `${cookie.storeId}::${cookie.name}::${cookie.domain}::${cookie.path}`;
    }

    /**
     * Format cookies into a consistent structure
     */
    function formatCookies(cookies) {
        return cookies.map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate,
            sameSite: cookie.sameSite,
            storeId: cookie.storeId
        }));
    }

    /**
     * Clear all cookies for a URL
     */
    function clearCookies(url) {
        return new Promise((resolve, reject) => {
            try {
                chrome.cookies.getAll({ url }, (cookies) => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        reject(lastError);
                        return;
                    }

                    const totalCount = cookies.length;
                    if (!totalCount) {
                        resolve();
                        return;
                    }

                    let removedCount = 0;
                    cookies.forEach((cookie) => {
                        chrome.cookies.remove({ url, name: cookie.name }, () => {
                            removedCount += 1;
                            if (removedCount === totalCount) {
                                resolve();
                            }
                        });
                    });
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Set cookies for a URL
     */
    function setCookies(url, cookies) {
        return new Promise((resolve, reject) => {
            try {
                if (!cookies.length) {
                    resolve();
                    return;
                }

                let pendingCount = cookies.length;
                cookies.forEach((cookie) => {
                    let targetUrl = url;

                    if (cookie.domain) {
                        const protocol = cookie.secure ? "https://" : "http://";
                        const domain = cookie.domain.startsWith(".") ? cookie.domain.substring(1) : cookie.domain;
                        targetUrl = `${protocol}${domain}${cookie.path || "/"}`;
                    }

                    const cookieDetails = {
                        url: targetUrl,
                        name: cookie.name,
                        value: cookie.value,
                        path: cookie.path,
                        secure: cookie.secure,
                        httpOnly: cookie.httpOnly,
                        expirationDate: cookie.expirationDate,
                        sameSite: cookie.sameSite,
                        storeId: cookie.storeId
                    };

                    if (cookie.domain) {
                        cookieDetails.domain = cookie.domain;
                    }

                    chrome.cookies.set(cookieDetails, () => {
                        pendingCount -= 1;
                        if (pendingCount === 0) {
                            resolve();
                        }
                    });
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Send message to content script
     */
    function sendMessageToTab(tabId, message) {
        return new Promise((resolve, reject) => {
            try {
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(error);
                    } else {
                        resolve(response);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Inject content script if not already present
     */
    async function injectContentScript(tabId) {
        if (chrome.scripting) {
            // Manifest v3
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ["content.js"]
            });
        } else {
            // Fallback for Manifest v2
            return new Promise((resolve, reject) => {
                chrome.tabs.executeScript(tabId, { file: "content.js" }, () => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        }
    }

    /**
     * Ensure content script is available on tab
     */
    async function ensureContentScript(tabId) {
        try {
            await sendMessageToTab(tabId, { type: "PING" });
        } catch (error) {
            const errorMsg = error?.message || "";
            if (errorMsg.includes("Receiving end does not exist") || errorMsg.includes("Could not establish connection")) {
                log("Content script not found, trying to inject...", tabId);
                await injectContentScript(tabId);
                // Wait a bit for script to load
                await new Promise((resolve) => setTimeout(resolve, 100));
            } else {
                throw error;
            }
        }
    }

    /**
     * Capture page state (cookies and localStorage) from a tab
     */
    async function capturePageState(tabId) {
        await ensureContentScript(tabId);
        const pageState = await sendMessageToTab(tabId, { type: "CAPTURE_PAGE_STATE" });
        if (!pageState) {
            throw new Error("The content script is not responding; the current site may not support it or it may not have been injected yet.");
        }
        return pageState;
    }

    /**
     * Apply page state (localStorage) to a tab
     */
    async function applyPageState(tabId, pageState) {
        await ensureContentScript(tabId);
        await sendMessageToTab(tabId, {
            type: "APPLY_PAGE_STATE",
            payload: {
                localStorage: pageState ? pageState.localStorage : {}
            }
        });
    }

    /**
     * Handle CAPTURE_ACCOUNT_SNAPSHOT message
     */
    async function handleCaptureSnapshot(message) {
        const { tabId, url } = message.payload;
        try {
            const [cookies, pageState] = await Promise.all([
                getAllCookies(url),
                capturePageState(tabId)
            ]);
            return {
                success: true,
                snapshot: {
                    cookies,
                    pageState
                }
            };
        } catch (error) {
            log("capture error", error);
            return {
                success: false,
                error: error?.message || String(error)
            };
        }
    }

    /**
     * Apply snapshot (cookies and page state) to a tab
     */
    async function applySnapshot(tabId, url, snapshot) {
        await clearCookies(url);
        await setCookies(url, snapshot.cookies);
        await applyPageState(tabId, snapshot.pageState);
        chrome.tabs.reload(tabId);
    }

    /**
     * Handle APPLY_ACCOUNT_SNAPSHOT message
     */
    async function handleApplySnapshot(message) {
        const { tabId, url, snapshot } = message.payload;
        try {
            await applySnapshot(tabId, url, snapshot);
            return { success: true };
        } catch (error) {
            log("apply error", error);
            return {
                success: false,
                error: error?.message || String(error)
            };
        }
    }

    /**
     * Handle OPEN_AND_APPLY_ACCOUNT_SNAPSHOT message
     */
    async function handleOpenAndApplySnapshot(message) {
        const { url, snapshot } = message.payload;
        try {
            const newTab = await chrome.tabs.create({ url, active: true });
            if (!newTab.id) throw new Error("Failed to create tab");

            // Wait for tab to load (with timeout)
            await new Promise((resolve) => {
                const listener = (tabId, changeInfo) => {
                    if (tabId === newTab.id && changeInfo.status === "complete") {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
                setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }, 15000); // 15 second timeout
            });

            await applySnapshot(newTab.id, url, snapshot);
            return { success: true };
        } catch (error) {
            log("open apply error", error);
            return {
                success: false,
                error: error?.message || String(error)
            };
        }
    }

    /**
     * Handle CLEAR_SITE_DATA message
     */
    async function handleClearSiteData(message) {
        const { tabId, url } = message.payload;
        try {
            await clearCookies(url);
            await applyPageState(tabId, null);
            chrome.tabs.reload(tabId);
            return { success: true };
        } catch (error) {
            log("clear data error", error);
            return {
                success: false,
                error: error?.message || String(error)
            };
        }
    }

    /**
     * Main message handler
     */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || typeof message.type !== "string") {
            return;
        }

        if (message.type === "PING") {
            sendResponse({ ok: true });
            return;
        }

        (async () => {
            if (message.type === "CAPTURE_ACCOUNT_SNAPSHOT") {
                const response = await handleCaptureSnapshot(message);
                sendResponse(response);
                return;
            }

            if (message.type === "APPLY_ACCOUNT_SNAPSHOT") {
                const response = await handleApplySnapshot(message);
                sendResponse(response);
                return;
            }

            if (message.type === "OPEN_AND_APPLY_ACCOUNT_SNAPSHOT") {
                const response = await handleOpenAndApplySnapshot(message);
                sendResponse(response);
                return;
            }

            if (message.type === "CLEAR_SITE_DATA") {
                const response = await handleClearSiteData(message);
                sendResponse(response);
                return;
            }

            if (message.type === "DEBUG_LOG") {
                const { message: debugMessage, level } = message.payload;
                console.log(`[Forwarded][${level || "info"}] ${debugMessage}`);
                try {
                    const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                    if (activeTabs && activeTabs.length > 0 && activeTabs[0].id) {
                        chrome.tabs.sendMessage(activeTabs[0].id, message).catch(() => {});
                    }
                } catch {
                    // Ignore errors
                }
                sendResponse({ success: true });
                return;
            }
        })().catch((error) => {
            log("unhandled error", error);
            sendResponse({
                success: false,
                error: error?.message || String(error)
            });
        });

        return true;
    });

    log("background loaded");
})();