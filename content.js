"use strict";

/**
 * Content script for MultiAccount Manager
 * Handles page state capture and restoration
 */
(() => {
    // Default detection rule - checks localStorage for user info
    const defaultRule = {
        id: "default",
        match: () => true,
        detect: ({ localStorageSnapshot }) => {
            const username = localStorageSnapshot.username || localStorageSnapshot.user || localStorageSnapshot.account || "";
            return {
                state: username ? "logged_in" : "unknown",
                username: username || undefined,
                hint: username 
                    ? `Detected username in local storage: ${username}` 
                    : "No login information detected (can be extended in the rule engine)",
                detectedAt: new Date().toISOString()
            };
        }
    };

    // Example rule for detecting login state on websites
    const exampleRule = {
        id: "example.com",
        match: (hostname) => hostname.endsWith("example.com"),
        detect: ({ document }) => {
            const loginLink = document.querySelector("a[href*='login']");
            const logoutLink = document.querySelector("a[href*='logout'], a[href*='signout']");
            let state = "unknown";
            let hint = "Example rule: Please adjust according to the actual site structure";

            if (logoutLink) {
                state = "logged_in";
                hint = "Exit/Sign out link found on the page";
            } else if (loginLink) {
                state = "logged_out";
                hint = "Login link found on the page";
            }

            return {
                state,
                hint,
                detectedAt: new Date().toISOString()
            };
        }
    };

    const detectionRules = [exampleRule, defaultRule];

    /**
     * Find applicable detection rule for hostname
     */
    function findRule(hostname) {
        const lowerHostname = hostname.toLowerCase();
        for (const rule of detectionRules) {
            if (rule.match(lowerHostname)) {
                return rule;
            }
        }
        return defaultRule;
    }

    /**
     * Detect login state for the current site
     */
    function detectLoginState(hostname, document, windowState) {
        return findRule(hostname).detect({
            hostname,
            document,
            localStorageSnapshot: windowState.localStorage
        });
    }

    /**
     * Extract clean site name from page title
     */
    function extractSiteName(pageTitle) {
        if (!pageTitle) return "Unnamed website";
        
        const trimmed = pageTitle.trim();
        if (!trimmed) return "Unnamed website";

        const separators = [" - ", " | ", " _ ", " — ", "："];
        for (const separator of separators) {
            if (trimmed.includes(separator)) {
                const parts = trimmed.split(separator);
                if (parts[0] && parts[0].trim().length > 0) {
                    return parts[0].trim();
                }
            }
        }
        
        return trimmed.length <= 20 ? trimmed : trimmed.slice(0, 20) + "...";
    }

    /**
     * Extract favicon URL from page
     */
    function extractFaviconUrl(document) {
        const iconLinks = document.querySelectorAll("link[rel*='icon']");
        for (let i = 0; i < iconLinks.length; i++) {
            const link = iconLinks[i];
            if (link.href) return link.href;
        }

        try {
            return new URL("/favicon.ico", document.location.origin).href;
        } catch {
            return null;
        }
    }

    /**
     * Extract site information from current page
     */
    function extractSiteInfo() {
        const title = extractSiteName(document.title);
        const iconUrl = extractFaviconUrl(document);
        return {
            title,
            iconUrl
        };
    }

    /**
     * Logging utility
     */
    function log(...args) {
        console.log("[MultiAccount][cs]", ...args);
    }

    /**
     * Capture all localStorage data
     */
    function captureLocalStorage() {
        const storage = {};
        try {
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (key) {
                    try {
                        const value = localStorage.getItem(key);
                        if (value != null) {
                            storage[key] = value;
                        }
                    } catch {
                        // Skip items that can't be accessed
                    }
                }
            }
        } catch (error) {
            log("capture localStorage error", error);
        }
        return storage;
    }

    /**
     * Apply localStorage data to page
     */
    function applyLocalStorage(storageData) {
        try {
            localStorage.clear();
            Object.entries(storageData).forEach(([key, value]) => {
                try {
                    localStorage.setItem(key, value);
                } catch {
                    // Skip items that can't be set
                }
            });
        } catch (error) {
            log("apply localStorage error", error);
            throw error;
        }
    }

    /**
     * Handle messages from background script
     */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || typeof message.type !== "string") {
            return;
        }

        if (message.type === "PING") {
            sendResponse({ ok: true });
            return;
        }

        if (message.type === "CAPTURE_PAGE_STATE") {
            try {
                const hostname = window.location.hostname;
                const pageState = {
                    localStorage: captureLocalStorage()
                };

                try {
                    pageState.loginInfo = detectLoginState(hostname, document, pageState);
                } catch (error) {
                    log("detect login state error", error);
                }

                try {
                    pageState.siteInfo = extractSiteInfo();
                } catch (error) {
                    log("extract site info error", error);
                }

                sendResponse(pageState);
            } catch (error) {
                log("capture page state error", error);
                sendResponse(null);
            }
            return true;
        }

        if (message.type === "APPLY_PAGE_STATE") {
            try {
                const { localStorage: storageData } = message.payload;
                applyLocalStorage(storageData);
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({
                    success: false,
                    error: error?.message || String(error)
                });
            }
            return true;
        }

        if (message.type === "DEBUG_LOG") {
            const { message: debugMessage, level } = message.payload;
            const prefix = "[MultiAccount][Popup]";
            if (level === "error") {
                console.error(prefix, debugMessage);
            } else if (level === "warn") {
                console.warn(prefix, debugMessage);
            } else {
                console.log(prefix, debugMessage);
            }
            sendResponse({ success: true });
            return true;
        }
    });

    log("content script loaded");
})();