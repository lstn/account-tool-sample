"use strict";

/**
 * MultiAccount Manager Popup UI
 * Handles UI interactions, account management, and data synchronization
 */
(() => {
    // Global state and utilities
    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    // ==================== Cryptography Functions ====================

    /**
     * Get Web Crypto API
     */
    function getCryptoAPI() {
        if (typeof crypto !== "undefined" && crypto.subtle) {
            return crypto;
        }
        throw new Error("Current environment does not support Web Crypto API (crypto.subtle)");
    }

    /**
     * Convert byte array to base64 string
     */
    function bytesToBase64(bytes) {
        let binaryString = "";
        for (let i = 0; i < bytes.length; i += 1) {
            binaryString += String.fromCharCode(bytes[i]);
        }
        return btoa(binaryString);
    }

    /**
     * Convert base64 string to byte array
     */
    function base64ToBytes(base64String) {
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i += 1) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Derive encryption key from password using PBKDF2
     */
    async function deriveKeyFromPassword(password, salt) {
        const cryptoAPI = getCryptoAPI().subtle;
        const passwordKey = await cryptoAPI.importKey(
            "raw",
            textEncoder.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        return cryptoAPI.deriveKey(
            {
                name: "PBKDF2",
                salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            passwordKey,
            {
                name: "AES-GCM",
                length: 256
            },
            false,
            ["encrypt", "decrypt"]
        );
    }

    /**
     * Initialize encryption key with optional existing salt
     */
    async function initializeEncryptionKey(password, existingSalt) {
        const cryptoAPI = getCryptoAPI();
        const salt = existingSalt
            ? base64ToBytes(existingSalt)
            : (() => {
                  const randomSalt = new Uint8Array(16);
                  cryptoAPI.getRandomValues(randomSalt);
                  return randomSalt;
              })();

        return {
            key: await deriveKeyFromPassword(password, salt),
            saltBase64: bytesToBase64(salt)
        };
    }

    /**
     * Encrypt data using AES-GCM
     */
    async function encryptData(plaintext, encryptionKey) {
        const cryptoAPI = getCryptoAPI();
        const cryptoSubtle = cryptoAPI.subtle;
        const iv = new Uint8Array(12);
        cryptoAPI.getRandomValues(iv);

        const ciphertext = await cryptoSubtle.encrypt(
            {
                name: "AES-GCM",
                iv
            },
            encryptionKey,
            textEncoder.encode(plaintext)
        );

        return {
            cipherText: bytesToBase64(new Uint8Array(ciphertext)),
            iv: bytesToBase64(iv)
        };
    }

    /**
     * Decrypt data using AES-GCM
     */
    async function decryptData(encryptedData, decryptionKey) {
        const cryptoAPI = getCryptoAPI().subtle;
        const ciphertextBytes = base64ToBytes(encryptedData.cipherText);
        const ivBytes = base64ToBytes(encryptedData.iv);

        const plaintext = await cryptoAPI.decrypt(
            {
                name: "AES-GCM",
                iv: ivBytes
            },
            decryptionKey,
            ciphertextBytes
        );

        return textDecoder.decode(plaintext);
    }

    // ==================== Storage Functions ====================

    const ACCOUNTS_STORAGE_KEY = "accounts";

    /**
     * Get data from Chrome storage
     */
    function getFromStorage(keys) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(keys, (result) => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Save data to Chrome storage
     */
    function saveToStorage(data) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set(data, () => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Get all stored accounts
     */
    async function getAllAccounts() {
        const result = await getFromStorage([ACCOUNTS_STORAGE_KEY]);
        const accountsData = result[ACCOUNTS_STORAGE_KEY];
        return accountsData ? (Array.isArray(accountsData) ? accountsData : []) : [];
    }

    /**
     * Save accounts to storage
     */
    async function saveAccounts(accounts) {
        await saveToStorage({
            [ACCOUNTS_STORAGE_KEY]: accounts
        });
    }

    /**
     * Create encrypted backup file
     */
    async function createBackupFile(encryptionKey, saltBase64) {
        const backupData = {
            version: 1,
            sites: await getAllAccounts()
        };

        const backupString = JSON.stringify(backupData);
        const encrypted = await encryptData(backupString, encryptionKey);

        return {
            encryption: {
                salt: saltBase64,
                test: encrypted,
                createdAt: new Date().toISOString()
            },
            encryptedAccounts: encrypted,
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Restore accounts from encrypted backup
     */
    async function restoreFromBackup(backupFile, decryptionKey) {
        if (!backupFile.encryptedAccounts) {
            throw new Error("Invalid backup: missing encrypted data");
        }

        const decryptedString = await decryptData(backupFile.encryptedAccounts, decryptionKey);
        const backupData = JSON.parse(decryptedString);

        if (!backupData || backupData.version !== 1 || !Array.isArray(backupData.sites)) {
            throw new Error("Backup data structure incompatible or corrupted");
        }

        await saveAccounts(backupData.sites);
    }

    // ==================== URL and Hostname Utilities ====================

    /**
     * Extract hostname from URL, filtering out special URLs
     */
    function extractHostnameFromUrl(url) {
        try {
            const parsedUrl = new URL(url);
            if (
                parsedUrl.protocol === "chrome:" ||
                parsedUrl.protocol === "edge:" ||
                parsedUrl.protocol === "about:"
            ) {
                return null;
            }
            return parsedUrl.hostname.toLowerCase();
        } catch {
            return null;
        }
    }

    /**
     * Normalize hostname to lowercase
     */
    function normalizeHostname(hostname) {
        return hostname.toLowerCase();
    }

    /**
     * Create site object from hostname
     */
    function createSiteFromHostname(hostname) {
        return {
            id: normalizeHostname(hostname),
            hostname,
            displayName: hostname
        };
    }

    /**
     * Format timestamp with timezone
     */
    function formatTimestamp(date) {
        const timeMs = date.getTime();
        const timezoneOffsetMs = 480 * 60 * 1000; // +08:00 offset
        return new Date(timeMs + timezoneOffsetMs).toISOString().replace("Z", "+08:00");
    }

    /**
     * Generate unique ID
     */
    function generateUniqueId(prefix = "id") {
        const timestampPart = Date.now().toString(36);
        const randomPart = Math.random().toString(36).slice(2, 8);
        return `${prefix}_${timestampPart}_${randomPart}`;
    }

    /**
     * Get random avatar color
     */
    function getRandomAvatarColor() {
        const colors = [
            "#f87171", "#fb923c", "#facc15", "#a3e635", "#4ade80", "#22c55e",
            "#34d399", "#2dd4bf", "#38bdf8", "#60a5fa", "#3b82f6", "#818cf8",
            "#a78bfa", "#c084fc", "#e879f9", "#f472b6", "#fb7185"
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Generate fingerprint for account to detect duplicates
     */
    function generateAccountFingerprint(account) {
        const username = account.username || "";
        const label = account.label || "";

        const cookieIdentifiers = [
            "user", "username", "uid", "sid", "session", "token"
        ];
        const relevantCookies = account.cookies
            .filter((cookie) => cookieIdentifiers.includes(cookie.name.toLowerCase()))
            .map((cookie) => `${cookie.name}=${cookie.value}`)
            .join(";");

        const relevantStorageItems = ["user", "username", "uid", "token"]
            .map((key) => {
                const value = account.localStorage[key];
                return value ? `${key}=${value}` : "";
            })
            .filter(Boolean)
            .join(";");

        return [username, label, relevantCookies, relevantStorageItems].join("|#|");
    }

    /**
     * Check for duplicate account
     */
    function checkForDuplicateAccount(accountList, newAccount) {
        const newFingerprint = generateAccountFingerprint(newAccount);
        return {
            duplicate: accountList.find((acc) => generateAccountFingerprint(acc) === newFingerprint)
        };
    }

    /**
     * Find site index by ID
     */
    function findSiteIndexById(sites, siteId) {
        return sites.findIndex((site) => site.site.id === siteId);
    }

    /**
     * Get or create site and update with site info
     */
    function getOrCreateSite(sites, hostname, siteInfo) {
        let site = createSiteFromHostname(hostname);

        if (siteInfo) {
            if (siteInfo.title) {
                site.displayName = siteInfo.title;
            }
            if (siteInfo.iconUrl) {
                site.faviconUrl = siteInfo.iconUrl;
            }
        }

        const existingSiteIndex = findSiteIndexById(sites, site.id);
        if (existingSiteIndex >= 0) {
            const existingSite = sites[existingSiteIndex];
            let siteUpdated = false;

            if (siteInfo) {
                // Update display name if it's still the default and we have a better one
                if (
                    existingSite.site.displayName === existingSite.site.hostname &&
                    siteInfo.title &&
                    existingSite.site.displayName !== siteInfo.title
                ) {
                    existingSite.site.displayName = siteInfo.title;
                    siteUpdated = true;
                }

                // Update favicon if available
                if (
                    siteInfo.iconUrl &&
                    existingSite.site.faviconUrl !== siteInfo.iconUrl
                ) {
                    existingSite.site.faviconUrl = siteInfo.iconUrl;
                    siteUpdated = true;
                }
            }

            if (siteUpdated) {
                const updatedSites = [...sites];
                updatedSites[existingSiteIndex] = existingSite;
                return {
                    sites: updatedSites,
                    site: existingSite
                };
            }

            return {
                sites,
                site: existingSite
            };
        }

        // Create new site entry
        const newSiteEntry = {
            site,
            accounts: []
        };

        return {
            sites: [...sites, newSiteEntry],
            site: newSiteEntry
        };
    }

    /**
     * Create account object
     */
    function createAccount(siteId, snapshot, label, username) {
        const timestamp = formatTimestamp(new Date());
        return {
            id: generateUniqueId("acct"),
            siteId,
            label: label || username || "未命名账号",
            username,
            avatarColor: getRandomAvatarColor(),
            createdAt: timestamp,
            updatedAt: timestamp,
            cookies: snapshot.cookies,
            localStorage: snapshot.pageState.localStorage,
            loginInfo: snapshot.pageState.loginInfo
        };
    }

    /**
     * Update account with new data
     */
    function updateAccount(existingAccount, snapshot, newLabel, newUsername) {
        const timestamp = formatTimestamp(new Date());
        return {
            ...existingAccount,
            label: newLabel || existingAccount.label,
            username: newUsername || existingAccount.username,
            updatedAt: timestamp,
            cookies: snapshot.cookies,
            localStorage: snapshot.pageState.localStorage,
            loginInfo: snapshot.pageState.loginInfo
        };
    }

    /**
     * Add or update site in sites list
     */
    function updateSiteInList(sites, updatedSiteEntry) {
        const siteIndex = findSiteIndexById(sites, updatedSiteEntry.site.id);
        if (siteIndex === -1) {
            return [...sites, updatedSiteEntry];
        }

        const updatedSites = [...sites];
        updatedSites[siteIndex] = updatedSiteEntry;
        return updatedSites;
    }

    /**
     * Check for duplicate in site
     */
    function checkSiteDuplicate(siteEntry, newAccount) {
        return checkForDuplicateAccount(siteEntry.accounts, newAccount, siteEntry.site.hostname);
    }

    // ==================== Internationalization ====================

    /**
     * Update all i18n elements on page
     */
    function updateI18nStrings() {
        document.querySelectorAll(
            "[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-tooltip]"
        ).forEach((element) => {
            const i18nKey = element.getAttribute("data-i18n");
            if (i18nKey) {
                const translatedText = chrome.i18n.getMessage(i18nKey);
                if (translatedText) {
                    if (element.hasAttribute("data-i18n-html")) {
                        element.innerHTML = translatedText;
                    } else if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
                        if (element.hasAttribute("placeholder")) {
                            element.placeholder = translatedText;
                        }
                    } else if (element.tagName === "IMG" && element.hasAttribute("alt")) {
                        element.alt = translatedText;
                    } else {
                        element.textContent = translatedText;
                    }
                }
            }

            const i18nTitleKey = element.getAttribute("data-i18n-title");
            if (i18nTitleKey) {
                const titleText = chrome.i18n.getMessage(i18nTitleKey);
                if (titleText) {
                    element.setAttribute("title", titleText);
                }
            }

            const i18nTooltipKey = element.getAttribute("data-i18n-tooltip");
            if (i18nTooltipKey) {
                const tooltipText = chrome.i18n.getMessage(i18nTooltipKey);
                if (tooltipText) {
                    element.setAttribute("data-tooltip", tooltipText);
                }
            }

            const i18nPlaceholderKey = element.getAttribute("data-i18n-placeholder");
            if (i18nPlaceholderKey) {
                const placeholderText = chrome.i18n.getMessage(i18nPlaceholderKey);
                if (placeholderText) {
                    element.placeholder = placeholderText;
                }
            }
        });
    }

    /**
     * Get translated string
     */
    function t(messageKey, substitutions) {
        return chrome.i18n.getMessage(messageKey, substitutions);
    }

    // ==================== Modal Dialog ====================

    /**
     * Modal dialog for alerts, confirms, and prompts
     */
    class Modal {
        constructor() {
            this.resolve = null;
            this.currentType = "alert";
            this.overlay = document.getElementById("modal-overlay");
            this.titleEl = document.getElementById("modal-title");
            this.messageEl = document.getElementById("modal-message");
            this.inputContainer = document.getElementById("modal-input-container");
            this.inputEl = document.getElementById("modal-input");
            this.errorEl = document.getElementById("modal-input-error");
            this.btnConfirm = document.getElementById("modal-btn-confirm");
            this.btnCancel = document.getElementById("modal-btn-cancel");
            this.bindEvents();
        }

        bindEvents() {
            this.btnConfirm.addEventListener("click", () => this.handleConfirm());
            this.btnCancel.addEventListener("click", () => this.handleCancel());

            this.overlay.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    if (this.currentType === "prompt" && document.activeElement !== this.inputEl) {
                        return;
                    }
                    this.handleConfirm();
                } else if (event.key === "Escape") {
                    this.handleCancel();
                }
            });

            this.inputEl.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    this.handleConfirm();
                }
            });
        }

        reset() {
            this.titleEl.textContent = t("modalTitleInfo");
            this.messageEl.textContent = "";
            this.inputEl.value = "";
            this.inputEl.type = "text";
            this.inputEl.placeholder = "";
            this.errorEl.textContent = "";
            this.errorEl.classList.add("hidden");
            this.inputContainer.classList.add("hidden");
            this.btnCancel.classList.remove("hidden");
            this.btnConfirm.textContent = t("confirm");
            this.btnCancel.textContent = t("cancel");
            this.resolve = null;
        }

        show(options) {
            this.reset();
            this.currentType = options.type;

            this.titleEl.textContent = options.title || (
                options.type === "confirm" ? t("modalTitleConfirm") : t("modalTitleInfo")
            );

            this.messageEl.innerHTML = options.message.replace(/\n/g, "<br>");

            if (options.confirmText) {
                this.btnConfirm.textContent = options.confirmText;
            }

            if (options.cancelText) {
                this.btnCancel.textContent = options.cancelText;
            }

            if (options.type === "alert") {
                this.btnCancel.classList.add("hidden");
            } else if (options.type === "prompt") {
                this.inputContainer.classList.remove("hidden");
                if (options.inputType) {
                    this.inputEl.type = options.inputType;
                }
                if (options.inputPlaceholder) {
                    this.inputEl.placeholder = options.inputPlaceholder;
                }
                if (options.defaultValue) {
                    this.inputEl.value = options.defaultValue;
                }
                setTimeout(() => this.inputEl.focus(), 100);
            }

            this.overlay.classList.remove("hidden");

            return new Promise((resolve) => {
                this.resolve = resolve;
            });
        }

        hide() {
            this.overlay.classList.add("hidden");
        }

        handleConfirm() {
            if (!this.resolve) return;

            if (this.currentType === "prompt") {
                const input = this.inputEl.value.trim();
                this.hide();
                this.resolve(input);
            } else if (this.currentType === "confirm") {
                this.hide();
                this.resolve(true);
            } else {
                this.hide();
                this.resolve(true);
            }
        }

        handleCancel() {
            if (!this.resolve) return;

            this.hide();

            if (this.currentType === "prompt") {
                this.resolve(null);
            } else if (this.currentType === "confirm") {
                this.resolve(false);
            } else {
                this.resolve(true);
            }
        }

        async alert(message, title) {
            await this.show({
                type: "alert",
                message,
                title
            });
        }

        async confirm(message, title, confirmText, cancelText) {
            return this.show({
                type: "confirm",
                message,
                title,
                confirmText,
                cancelText
            });
        }

        async prompt(message, defaultValue, title, inputType = "text") {
            return this.show({
                type: "prompt",
                message,
                defaultValue,
                title,
                inputType
            });
        }
    }

    const modal = new Modal();

    // ==================== Feedback Modal ====================

    /**
     * Feedback form modal
     */
    class FeedbackModal {
        constructor() {
            this.STORAGE_KEY = "feedback_draft";
            this.MAX_CHARS = 200;
            this.overlay = document.getElementById("feedback-modal-overlay");
            this.closeBtn = document.getElementById("feedback-btn-close");
            this.submitBtn = document.getElementById("feedback-btn-submit");
            this.input = document.getElementById("feedback-input");
            this.charCount = document.getElementById("feedback-char-count");
            this.errorMsg = document.getElementById("feedback-error");
            this.checkboxes = document.querySelectorAll('input[name="feature"]');
            this.bindEvents();
            this.loadDraft();
        }

        bindEvents() {
            this.closeBtn.addEventListener("click", () => this.hide());

            this.overlay.addEventListener("click", (event) => {
                if (event.target === this.overlay) {
                    this.hide();
                }
            });

            this.input.addEventListener("input", () => {
                this.updateCharCount();
                this.saveDraft();
                this.clearError();
            });

            this.checkboxes.forEach((checkbox) => {
                checkbox.addEventListener("change", () => {
                    this.saveDraft();
                    this.clearError();
                });
            });

            this.submitBtn.addEventListener("click", () => this.handleSubmit());
        }

        show() {
            this.overlay.classList.remove("hidden");
            this.updateCharCount();
        }

        hide() {
            this.overlay.classList.add("hidden");
        }

        updateCharCount() {
            const charCount = this.input.value.length;
            this.charCount.textContent = `${charCount}/${this.MAX_CHARS}`;

            if (charCount >= this.MAX_CHARS) {
                this.charCount.classList.add("error");
                this.input.classList.add("error");
                this.charCount.classList.remove("warning");
                this.input.classList.remove("warning");
            } else if (charCount >= this.MAX_CHARS * 0.9) {
                this.charCount.classList.add("warning");
                this.input.classList.add("warning");
                this.charCount.classList.remove("error");
                this.input.classList.remove("error");
            } else {
                this.charCount.classList.remove("warning", "error");
                this.input.classList.remove("warning", "error");
            }
        }

        saveDraft() {
            const draft = {
                features: Array.from(this.checkboxes)
                    .filter((checkbox) => checkbox.checked)
                    .map((checkbox) => checkbox.value),
                content: this.input.value
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(draft));
        }

        loadDraft() {
            const savedDraft = localStorage.getItem(this.STORAGE_KEY);
            if (!savedDraft) return;

            try {
                const draft = JSON.parse(savedDraft);
                if (draft.content) {
                    this.input.value = draft.content;
                }
                if (draft.features) {
                    this.checkboxes.forEach((checkbox) => {
                        checkbox.checked = draft.features.includes(checkbox.value);
                    });
                }
            } catch (error) {
                console.error("Failed to load feedback draft", error);
            }
        }

        clearDraft() {
            localStorage.removeItem(this.STORAGE_KEY);
            this.input.value = "";
            this.checkboxes.forEach((checkbox) => {
                checkbox.checked = false;
            });
            this.updateCharCount();
        }

        setError(message) {
            this.errorMsg.textContent = message;
            this.errorMsg.classList.remove("hidden");
        }

        clearError() {
            this.errorMsg.classList.add("hidden");
            this.errorMsg.textContent = "";
        }

        async handleSubmit() {
            if (this.submitBtn.disabled) return;

            const selectedFeatures = Array.from(this.checkboxes).filter((checkbox) => checkbox.checked);
            const customText = this.input.value.trim();

            if (selectedFeatures.length === 0 && customText.length === 0) {
                this.setError(t("enterFeedbackContent"));
                return;
            }

            this.setLoading(true);

            try {
                const response = await fetch("https://api-pan.fextool.com/app-api/plugin/feedback/create", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "tenant-id": "163"
                    },
                    body: JSON.stringify({
                        tips: selectedFeatures
                            .map((checkbox) => {
                                return (checkbox.nextElementSibling?.textContent?.trim()) || checkbox.value;
                            })
                            .join(","),
                        customText,
                        deviceInfo: navigator.userAgent,
                        clientIp: ""
                    })
                });

                if (!response.ok) {
                    throw new Error(t("submitFailed"));
                }

                this.setSuccess();
                setTimeout(() => {
                    this.hide();
                    this.clearDraft();
                    this.resetButton();
                }, 3000);
            } catch (error) {
                this.setError(error.message || t("submitFailed"));
                this.setLoading(false);
            }
        }

        setLoading(isLoading) {
            const btnText = this.submitBtn.querySelector(".btn-text");
            const btnLoading = this.submitBtn.querySelector(".btn-loading");

            this.submitBtn.disabled = isLoading;

            if (isLoading) {
                btnText.classList.add("hidden");
                btnLoading.classList.remove("hidden");
                this.clearError();
            } else {
                btnText.classList.remove("hidden");
                btnLoading.classList.add("hidden");
            }
        }

        setSuccess() {
            const btnText = this.submitBtn.querySelector(".btn-text");
            const btnLoading = this.submitBtn.querySelector(".btn-loading");
            const btnSuccess = this.submitBtn.querySelector(".btn-success");

            this.submitBtn.disabled = true;
            this.submitBtn.classList.replace("btn-primary", "btn-success");
            this.submitBtn.style.backgroundColor = "var(--success-color)";
            this.submitBtn.style.borderColor = "transparent";
            btnLoading.classList.add("hidden");
            btnText.classList.add("hidden");
            btnSuccess.classList.remove("hidden");
        }

        resetButton() {
            const btnText = this.submitBtn.querySelector(".btn-text");
            const btnLoading = this.submitBtn.querySelector(".btn-loading");
            const btnSuccess = this.submitBtn.querySelector(".btn-success");

            this.submitBtn.disabled = false;
            this.submitBtn.classList.replace("btn-success", "btn-primary");
            this.submitBtn.style.backgroundColor = "";
            this.submitBtn.style.borderColor = "";
            btnText.classList.remove("hidden");
            btnLoading.classList.add("hidden");
            btnSuccess.classList.add("hidden");
        }
    }

    const feedbackModal = new FeedbackModal();

    // ==================== Error Handling ====================

    /**
     * Handle errors from background operations
     */
    async function handleError(error) {
        const errorMessage = error?.message || String(error);

        if (
            errorMessage.includes("Receiving end does not exist") ||
            errorMessage.includes("Could not establish connection")
        ) {
            const shouldRefresh = await modal.confirm(
                `Failed to Collect account information: The connection to the page has been lost.
This is usually because the page wasn't refreshed after the extension was updated.
Refresh the current page now? (The function will be restored after refreshing.)`,
                "Connection Interrupted",
                "Refresh Page",
                "Cancel"
            );

            if (shouldRefresh) {
                chrome.tabs.reload();
                window.close();
            }
            return;
        }

        if (
            errorMessage.includes("quota exceeded") ||
            errorMessage.includes("QuotaBytes")
        ) {
            await modal.alert(
                `Storage space insufficient.
The currently saved account data has reached the browser extension storage limit.
Please try deleting some infrequently used account backups, or wait for the extension
update to support unlimited storage permissions`,
                "Storage Quota Exceeded"
            );
            return;
        }

        await modal.alert(`Operation failed: ${errorMessage}`);
    }

    // ==================== Ad Service ====================

    const AD_STORAGE_KEY = "ad_data";

    /**
     * Ad service for managing advertisements
     */
    class AdService {
        constructor() {
            this.timer = null;
            this.currentAdData = null;
            this.renderCallback = null;
            this.loadFromStorage();
        }

        start(renderCallback) {
            this.stop();

            this.renderCallback = (adData) => {
                try {
                    renderCallback(adData);
                } catch (error) {
                    console.error("[AdService] Render callback failed", error);
                }
            };

            if (this.currentAdData) {
                this.renderCallback(this.currentAdData);
            }

            const fetchAds = () => this.fetchAds();

            if ("requestIdleCallback" in window) {
                window.requestIdleCallback(fetchAds, { timeout: 2000 });
            } else {
                setTimeout(fetchAds, 100);
            }
        }

        stop() {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
        }

        async fetchAds() {
            try {
                const response = await fetch("https://api-pan.fextool.com/app-api/ads/query");
                if (!response.ok) throw new Error("Failed to fetch ads");

                const data = await response.json();
                this.currentAdData = data;
                this.saveToStorage();

                if (this.renderCallback) {
                    this.renderCallback(data);
                }
            } catch (error) {
                console.error("[AdService] Failed to fetch ads", error);
            }
        }

        loadFromStorage() {
            try {
                const saved = localStorage.getItem(AD_STORAGE_KEY);
                if (saved) {
                    this.currentAdData = JSON.parse(saved);
                }
            } catch (error) {
                console.error("[AdService] Failed to load from storage", error);
            }
        }

        saveToStorage() {
            try {
                localStorage.setItem(AD_STORAGE_KEY, JSON.stringify(this.currentAdData));
            } catch (error) {
                console.error("[AdService] Failed to save to storage", error);
            }
        }
    }

    const adService = new AdService();

    // ==================== Application State ====================

    /**
     * Application state management
     */
    const appState = {
        sites: [],
        currentSiteId: null,
        currentHostname: null,
        isInitialized: false
    };

    // ==================== Message Passing ====================

    /**
     * Send message to background service worker
     */
    function sendMessageToBackground(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Get current active tab
     */
    async function getCurrentTab() {
        const tabs = await new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                resolve(tabs);
            });
        });
        return tabs?.[0];
    }

    /**
     * Capture account snapshot from current tab
     */
    async function captureAccountSnapshot() {
        const currentTab = await getCurrentTab();
        if (!currentTab?.id || !currentTab?.url) {
            throw new Error("Cannot access active tab");
        }

        const response = await sendMessageToBackground({
            type: "CAPTURE_ACCOUNT_SNAPSHOT",
            payload: {
                tabId: currentTab.id,
                url: currentTab.url
            }
        });

        if (!response.success) {
            throw new Error(response.error || "Failed to capture snapshot");
        }

        return response.snapshot;
    }

    /**
     * Apply account snapshot to current tab
     */
    async function applyAccountSnapshot(snapshot) {
        const currentTab = await getCurrentTab();
        if (!currentTab?.id || !currentTab?.url) {
            throw new Error("Cannot access active tab");
        }

        const response = await sendMessageToBackground({
            type: "APPLY_ACCOUNT_SNAPSHOT",
            payload: {
                tabId: currentTab.id,
                url: currentTab.url,
                snapshot
            }
        });

        if (!response.success) {
            throw new Error(response.error || "Failed to apply snapshot");
        }
    }

    /**
     * Open URL and apply snapshot
     */
    async function openUrlAndApplySnapshot(url, snapshot) {
        const response = await sendMessageToBackground({
            type: "OPEN_AND_APPLY_ACCOUNT_SNAPSHOT",
            payload: {
                url,
                snapshot
            }
        });

        if (!response.success) {
            throw new Error(response.error || "Failed to open and apply snapshot");
        }
    }

    // ==================== UI Rendering ====================

    /**
     * Get element by ID
     */
    function getElement(id) {
        return document.getElementById(id);
    }

    /**
     * Render account list for current site
     */
    function renderAccountList(siteEntry) {
        const accountListContainer = getElement("account-list");
        const accountEmptyState = getElement("account-empty");

        accountListContainer.innerHTML = "";

        if (!siteEntry || !siteEntry.accounts || siteEntry.accounts.length === 0) {
            accountListContainer.classList.add("hidden");
            accountEmptyState.classList.remove("hidden");
            return;
        }

        accountListContainer.classList.remove("hidden");
        accountEmptyState.classList.add("hidden");

        siteEntry.accounts.forEach((account) => {
            const accountItem = document.createElement("div");
            accountItem.className = "account-item";

            const avatarLetter = (account.username || account.label).charAt(0).toUpperCase();
            accountItem.innerHTML = `
        <div class="account-avatar" style="background-color: ${account.avatarColor}">
            ${avatarLetter}
        </div>
        <div class="account-info">
            <h3 class="account-label">${account.label}</h3>
            <p class="account-username">${account.username || "-"}</p>
        </div>
        <div class="account-actions">
            <button class="btn btn-sm btn-primary account-apply" data-account-id="${account.id}" title="${t("apply")}">
                ${t("apply")}
            </button>
            <button class="btn btn-sm btn-secondary account-edit" data-account-id="${account.id}" title="${t("edit")}">
                ${t("edit")}
            </button>
            <button class="btn btn-sm btn-secondary account-export" data-account-id="${account.id}" title="${t("export")}">
                ${t("export")}
            </button>
            <button class="btn btn-sm btn-danger account-delete" data-account-id="${account.id}" title="${t("delete")}">
                ${t("delete")}
            </button>
        </div>
    `;

            accountListContainer.appendChild(accountItem);

            // Apply account
            accountItem.querySelector(".account-apply").addEventListener("click", async () => {
                try {
                    await applyAccountSnapshot(account);
                    await modal.alert(t("applySuccess"), t("success"));
                } catch (error) {
                    await handleError(error);
                }
            });

            // Edit account
            accountItem.querySelector(".account-edit").addEventListener("click", async () => {
                const newLabel = await modal.prompt(
                    t("editAccountLabel"),
                    account.label,
                    t("edit")
                );
                if (newLabel !== null && newLabel !== account.label) {
                    account.label = newLabel;
                    await saveAccounts(appState.sites);
                    renderAccountList(siteEntry);
                }
            });

            // Export account
            accountItem.querySelector(".account-export").addEventListener("click", async () => {
                const useEncryption = await modal.confirm(
                    t("encryptAccountExport"),
                    t("export"),
                    t("yes"),
                    t("no")
                );

                if (useEncryption) {
                    const password = await modal.prompt(
                        t("promptExportPassword"),
                        "",
                        t("export"),
                        "password"
                    );
                    if (password === null) return;

                    try {
                        const { key, saltBase64 } = await initializeEncryptionKey(password);
                        const encrypted = await encryptData(JSON.stringify(account), key);
                        const shareData = {
                            type: "share_account",
                            version: 1,
                            encryption: {
                                salt: saltBase64
                            },
                            encryptedData: encrypted
                        };
                        exportAccountToFile(account, shareData);
                    } catch (error) {
                        await handleError(error);
                    }
                } else {
                    const shareData = {
                        type: "share_account",
                        version: 1,
                        account
                    };
                    exportAccountToFile(account, shareData);
                }
            });

            // Delete account
            accountItem.querySelector(".account-delete").addEventListener("click", async () => {
                const confirmed = await modal.confirm(
                    t("confirmDeleteAccount"),
                    t("delete"),
                    t("delete"),
                    t("cancel")
                );
                if (confirmed) {
                    siteEntry.accounts = siteEntry.accounts.filter((a) => a.id !== account.id);
                    appState.sites = updateSiteInList(appState.sites, siteEntry);
                    await saveAccounts(appState.sites);
                    renderAccountList(siteEntry);
                }
            });
        });
    }

    /**
     * Export account to file
     */
    function exportAccountToFile(account, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `account-share-${account.label || "unnamed"}-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Render site list
     */
    function renderSiteList() {
        const siteList = getElement("site-list");
        const siteEmpty = getElement("site-empty");

        siteList.innerHTML = "";

        if (!appState.sites || appState.sites.length === 0) {
            siteList.classList.add("hidden");
            siteEmpty.classList.remove("hidden");
            return;
        }

        siteList.classList.remove("hidden");
        siteEmpty.classList.add("hidden");

        appState.sites.forEach((siteEntry) => {
            const li = document.createElement("li");
            li.className = "site-item";
            if (appState.currentSiteId === siteEntry.site.id) {
                li.classList.add("active");
            }

            li.innerHTML = `
        <div class="site-item-icon">
            ${siteEntry.site.faviconUrl
                ? `<img src="${siteEntry.site.faviconUrl}" alt="" />`
                : "🌐"
            }
        </div>
        <div class="site-item-info">
            <div class="site-item-name">${siteEntry.site.displayName}</div>
            <div class="site-item-count">${siteEntry.accounts.length} ${t("account")}</div>
        </div>
    `;

            li.addEventListener("click", () => {
                appState.currentSiteId = siteEntry.site.id;
                appState.currentHostname = siteEntry.site.hostname;
                renderSiteList();
                renderCurrentSiteView(siteEntry);
            });

            siteList.appendChild(li);
        });
    }

    /**
     * Render current site view
     */
    function renderCurrentSiteView(siteEntry) {
        const siteNameEl = getElement("current-site-name");
        const siteHostEl = getElement("current-site-host");
        const clearDataBtn = getElement("btn-clear-data");
        const importShareBtn = getElement("btn-import-share");

        siteNameEl.textContent = siteEntry.site.displayName;
        siteHostEl.textContent = siteEntry.site.hostname;

        if (clearDataBtn) {
            clearDataBtn.classList.remove("hidden");
        }

        if (importShareBtn) {
            importShareBtn.classList.remove("hidden");
        }

        renderAccountList(siteEntry);
    }

    // ==================== Account Operations ====================

    /**
     * Add new account
     */
    async function addAccount() {
        const currentTab = await getCurrentTab();
        if (!currentTab?.url) {
            await modal.alert(t("noActiveTab"), t("error"));
            return;
        }

        const hostname = extractHostnameFromUrl(currentTab.url);
        if (!hostname) {
            await modal.alert(t("invalidSite"), t("error"));
            return;
        }

        try {
            const snapshot = await captureAccountSnapshot();

            const accountLabel = await modal.prompt(
                t("accountLabelPrompt"),
                "",
                t("add"),
                "text"
            );
            if (accountLabel === null) return;

            const accountUsername = await modal.prompt(
                t("accountUsernamePrompt"),
                "",
                t("add"),
                "text"
            );

            const { sites, site } = getOrCreateSite(appState.sites, hostname, snapshot.siteInfo);
            appState.sites = sites;
            appState.currentSiteId = site.site.id;

            const newAccount = createAccount(site.site.id, snapshot, accountLabel, accountUsername);

            const duplicateCheck = checkSiteDuplicate(site, newAccount);
            if (duplicateCheck.duplicate) {
                const shouldAdd = await modal.confirm(
                    t("duplicateAccountWarning"),
                    t("warning"),
                    t("add"),
                    t("cancel")
                );
                if (!shouldAdd) return;
            }

            site.accounts.push(newAccount);
            appState.sites = updateSiteInList(appState.sites, site);
            await saveAccounts(appState.sites);

            renderSiteList();
            renderCurrentSiteView(site);
            await modal.alert(t("addAccountSuccess"), t("success"));
        } catch (error) {
            await handleError(error);
        }
    }

    /**
     * Import account from share file
     */
    async function importAccountFromFile(file) {
        const fileContent = await file.text();

        try {
            const shareData = JSON.parse(fileContent);

            if (shareData.type !== "share_account" || shareData.version !== 1) {
                throw new Error(t("invalidShareFile"));
            }

            let account;

            if (shareData.encryption && shareData.encryptedData) {
                const password = await modal.prompt(
                    t("promptEncryptedFilePassword"),
                    undefined,
                    t("titleImportShare"),
                    "password"
                );
                if (password === null) return;

                if (!shareData.encryption.salt) {
                    throw new Error(t("missingEncryptionInfo"));
                }

                try {
                    const { key } = await initializeEncryptionKey(password, shareData.encryption.salt);
                    const decrypted = await decryptData(shareData.encryptedData, key);
                    account = JSON.parse(decrypted);
                } catch {
                    throw new Error(t("decryptFailed"));
                }
            } else if (shareData.account) {
                account = shareData.account;
            } else {
                throw new Error(t("incompleteFile"));
            }

            // Extract hostname from account cookies or use current hostname
            let hostname = "";
            if (account.cookies && account.cookies.length > 0 && account.cookies[0].domain) {
                hostname = extractHostnameFromUrl(account.cookies[0].domain);
            }
            if (!hostname) {
                hostname = appState.currentHostname;
            }

            // Get or create site
            let siteId = "";
            if (account.cookies && account.cookies.length > 0 && account.cookies[0].domain) {
                siteId = extractHostnameFromUrl(account.cookies[0].domain);
            }
            if (!siteId) {
                siteId = appState.currentSiteId;
            }

            if (!siteId) {
                throw new Error(t("unknownSiteDomain"));
            }

            const siteInfo = {
                title: siteId,
                iconUrl: ""
            };

            const { sites, site } = getOrCreateSite(appState.sites, siteId, siteInfo);
            appState.sites = sites;

            account.id = crypto.randomUUID();
            account.siteId = site.site.id;
            account.createdAt = new Date().toISOString();
            account.updatedAt = new Date().toISOString();
            account.label = account.label + " (导入)";

            const updatedSite = {
                ...site,
                accounts: [...site.accounts, account]
            };

            appState.sites = updateSiteInList(appState.sites, updatedSite);
            if (appState.currentSiteId !== updatedSite.site.id) {
                appState.currentSiteId = updatedSite.site.id;
            }

            await saveAccounts(appState.sites);
            renderSiteList();
            await modal.alert(t("importSuccess"), t("titleImportSuccess"));
        } catch (error) {
            const errorMsg = error?.message || error;
            await modal.alert(t("importFailed", [errorMsg]));
        }
    }

    /**
     * Export backup
     */
    async function exportBackup() {
        const password = await modal.prompt(
            t("promptBackupPassword"),
            "",
            t("titleExportBackup"),
            "password"
        );
        if (!password) return;

        try {
            const { key, saltBase64 } = await initializeEncryptionKey(password);
            const backupFile = await createBackupFile(key, saltBase64);

            if (!backupFile) {
                await modal.alert(t("noDataToBackup"));
                return;
            }

            const blob = new Blob([JSON.stringify(backupFile, null, 2)], {
                type: "application/json"
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `multi-account-backup-${Date.now()}.json`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            await handleError(error);
        }
    }

    /**
     * Import backup
     */
    async function importBackup(file) {
        const fileContent = await file.text();

        try {
            const backupFile = JSON.parse(fileContent);
            const password = await modal.prompt(
                t("promptRestorePassword"),
                "",
                t("importBackup"),
                "password"
            );

            if (!password) return;

            if (!backupFile.encryption || !backupFile.encryption.salt) {
                throw new Error(t("restoreMissingEncryption"));
            }

            const { key } = await initializeEncryptionKey(password, backupFile.encryption.salt);
            await restoreFromBackup(backupFile, key);

            await modal.alert(t("restoreSuccess"));
            window.location.reload();
        } catch (error) {
            let errorMsg = error?.message || error;

            if (
                errorMsg.toString().includes("OperationError") ||
                errorMsg.toString().includes("operation failed")
            ) {
                errorMsg = t("decryptPasswordIncorrect");
            }

            await modal.alert(t("restoreFailed", [errorMsg]));
        }
    }

    /**
     * Clear site data
     */
    async function clearSiteData() {
        const currentTab = await getCurrentTab();

        if (!currentTab || !currentTab.id || !currentTab.url) {
            return;
        }

        const confirmed = await modal.confirm(
            t("confirmClearData"),
            t("titleClearData")
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await sendMessageToBackground({
                type: "CLEAR_SITE_DATA",
                payload: {
                    tabId: currentTab.id,
                    url: currentTab.url
                }
            });

            if (!response.success) {
                await handleError(response.error || t("clearFailed"));
            }
        } catch (error) {
            await handleError(error);
        }
    }

    // ==================== Event Handlers ====================

    /**
     * Update security status display
     */
    function updateSecurityStatus() {
        const statusEl = getElement("security-status");
        statusEl.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M8 11h8"></path><path d="M12 7v8"></path></svg>
    <span>${t("dataLocalstorage")}</span>
  `;
    }

    /**
     * Setup settings view
     */
    function setupSettingsView() {
        const settingsBtn = getElement("btn-settings");
        const settingsBackBtn = document.getElementById("btn-settings-back");
        const homeView = getElement("view-home");
        const settingsView = getElement("view-settings");
        const sidebar = getElement("sidebar");

        settingsBtn.addEventListener("click", () => {
            if (!settingsView.classList.contains("hidden")) {
                settingsView.classList.add("hidden");
                homeView.classList.remove("hidden");
                sidebar.classList.remove("hidden");
            } else {
                homeView.classList.add("hidden");
                sidebar.classList.add("hidden");
                settingsView.classList.remove("hidden");
            }
        });

        if (settingsBackBtn) {
            settingsBackBtn.addEventListener("click", () => {
                settingsView.classList.add("hidden");
                homeView.classList.remove("hidden");
                sidebar.classList.remove("hidden");
            });
        }
    }

    /**
     * Setup header buttons
     */
    function setupHeaderButtons() {
        const feedbackBtn = getElement("btn-feedback");
        if (feedbackBtn) {
            feedbackBtn.addEventListener("click", () => {
                feedbackModal.show();
            });
        }

        const shareBtn = getElement("btn-share");
        if (shareBtn) {
            shareBtn.addEventListener("click", async () => {
                const shareText = t("shareText");
                try {
                    await navigator.clipboard.writeText(shareText);
                    await modal.alert(t("shareCopied"), t("shareSuccess"));
                } catch (error) {
                    console.error("Failed to copy: ", error);
                    await modal.alert(t("copyFailed"), t("error"));
                }
            });
        }
    }

    /**
     * Render ads
     */
    function renderAds(adData) {
        const topAdContainer = getElement("ad-top-container");
        const bottomAdContainer = getElement("ad-bottom-container");

        if (topAdContainer) {
            if (adData.topAd) {
                topAdContainer.innerHTML = adData.topAd;
                topAdContainer.classList.remove("hidden");
            } else {
                topAdContainer.classList.add("hidden");
            }
        }

        if (bottomAdContainer) {
            if (adData.bottomAd) {
                bottomAdContainer.innerHTML = adData.bottomAd;
                bottomAdContainer.classList.remove("hidden");
            } else {
                bottomAdContainer.classList.add("hidden");
            }
        }
    }

    /**
     * Setup settings backup/restore
     */
    function setupBackupRestore() {
        getElement("btn-backup").addEventListener("click", () => {
            exportBackup().catch((error) => {
                console.error(error);
                modal.alert(t("backupFailed", [error?.message || error]));
            });
        });

        const restoreInput = getElement("input-restore-file");
        restoreInput.addEventListener("change", () => {
            const file = restoreInput.files?.[0];
            if (file) {
                importBackup(file).catch((error) => {
                    console.error(error);
                    modal.alert(t("restoreFailed", [error?.message || error]));
                });
                restoreInput.value = "";
            }
        });
    }

    /**
     * Setup account buttons
     */
    function setupAccountButtons() {
        getElement("btn-add-account").addEventListener("click", () => {
            addAccount().catch((error) => {
                console.error(error);
                modal.alert(t("addAccountFailed", [error?.message || error]));
            });
        });

        const importShareBtn = document.getElementById("btn-import-share");
        const importShareInput = document.getElementById("input-import-share");

        if (importShareBtn && importShareInput) {
            importShareBtn.addEventListener("click", () => {
                importShareInput.click();
            });

            importShareInput.addEventListener("change", () => {
                const file = importShareInput.files?.[0];
                if (file) {
                    importAccountFromFile(file).catch((error) => {
                        console.error(error);
                        modal.alert(t("importShareFailed", [error?.message || error]));
                    });
                    importShareInput.value = "";
                }
            });
        }

        getElement("btn-clear-data").addEventListener("click", () => {
            clearSiteData().catch((error) => {
                console.error(error);
                handleError(error);
            });
        });
    }

    // ==================== Initialization ====================

    /**
     * Initialize application
     */
    async function initialize() {
        try {
            updateI18nStrings();

            // Load data
            appState.sites = await getAllAccounts();

            // Set up UI
            setupAccountButtons();
            setupHeaderButtons();
            setupBackupRestore();
            setupSettingsView();
            updateSecurityStatus();

            // Render initial state
            renderSiteList();
            if (appState.sites.length > 0) {
                renderCurrentSiteView(appState.sites[0]);
                appState.currentSiteId = appState.sites[0].site.id;
            }

            // Start ad service
            adService.start(renderAds);

            appState.isInitialized = true;
        } catch (error) {
            console.error("[Bootstrap] Error during bootstrap:", error);
            throw error;
        }
    }

    /**
     * Start initialization when DOM is ready
     */
    function bootstrap() {
        initialize().catch((error) => {
            console.error("popup init error", error);
        });
    }

    console.log("[Popup] Script loaded (top-level)");

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
    } else {
        bootstrap();
    }
})();
