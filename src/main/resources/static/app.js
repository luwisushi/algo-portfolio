(function () {
    const sfx = setupRetroSound();
    sfx.bindInteractions(document);
    const notifier = createToastNotifier();
    const confirmDialog = createConfirmDialog();

    const category = document.body.dataset.category;
    if (!category) {
        return;
    }

    const form = document.getElementById("entry-form");
    const titleInput = document.getElementById("title");
    const dateInput = document.getElementById("date");
    const descriptionInput = document.getElementById("description");
    const imageInput = document.getElementById("image");
    const toggleFormButton = document.getElementById("toggle-form-button");
    const entrySection = document.getElementById("entry-section");
    const submitButton = document.getElementById("submit-button");
    const cancelEditButton = document.getElementById("cancel-edit");
    const entriesList = document.getElementById("entries-list");

    if (!form || !titleInput || !dateInput || !descriptionInput || !imageInput || !toggleFormButton || !entrySection || !submitButton || !cancelEditButton || !entriesList) {
        return;
    }

    const storageKey = `algo_complexities_${category}`;
    const entries = readEntries();
    let editIndex = -1;
    const entryModal = createEntryModal();

    setFormVisibility(!entrySection.hidden);
    renderEntries();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const title = titleInput.value.trim();
        const date = dateInput.value;
        const description = descriptionInput.value.trim();
        const file = imageInput.files && imageInput.files[0];

        if (!title || !date || !description) {
            sfx.playError();
            notifier.show("error", "Please complete title, date, and description.");
            return;
        }

        try {
            const isUpdating = editIndex >= 0;
            if (isUpdating) {
                const shouldUpdate = await confirmDialog.ask({
                    title: "Confirm Update",
                    message: "Are you sure you want to update this entry?",
                    confirmText: "Update",
                    cancelText: "Cancel",
                    intent: "update"
                });

                if (!shouldUpdate) {
                    notifier.show("info", "Update cancelled.");
                    return;
                }
            }

            if (editIndex >= 0) {
                const existing = entries[editIndex];
                if (!existing) {
                    resetFormState();
                    return;
                }

                const imageData = file ? await readImageAsDataUrl(file) : existing.imageData;
                entries[editIndex] = {
                    ...existing,
                    title,
                    date,
                    description,
                    imageData,
                    updatedAt: Date.now()
                };
            } else {
                if (!file) {
                    sfx.playError();
                    notifier.show("error", "Please import an image before adding this entry.");
                    return;
                }

                const imageData = await readImageAsDataUrl(file);
                entries.unshift({
                    title,
                    date,
                    description,
                    imageData,
                    createdAt: Date.now()
                });
            }

            persistEntries();
            resetFormState();
            setFormVisibility(false, false, true);
            renderEntries();
            sfx.playSuccess();
            notifier.show("success", isUpdating ? "Entry updated successfully." : "Entry added successfully.");
        } catch (_error) {
            sfx.playError();
            notifier.show("error", "There was a problem reading the image file. Please try again.");
        }
    });

    toggleFormButton.addEventListener("click", () => {
        if (entrySection.hidden) {
            setFormVisibility(true, true, true);
            titleInput.focus();
            return;
        }

        resetFormState();
        setFormVisibility(false, false, true);
    });

    cancelEditButton.addEventListener("click", () => {
        resetFormState();
        setFormVisibility(false, false, true);
    });

    document.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) {
            return;
        }

        if (!event.target.closest(".entry-actions")) {
            closeAllEntryMenus();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            if (entryModal.isOpen()) {
                entryModal.close(true);
                return;
            }
            closeAllEntryMenus(true);
        }
    });

    function persistEntries() {
        localStorage.setItem(storageKey, JSON.stringify(entries));
    }

    function resetFormState() {
        editIndex = -1;
        form.reset();
        submitButton.textContent = "Add Entry";
        cancelEditButton.hidden = true;
    }

    function setFormVisibility(visible, scroll = false, withSound = false) {
        entrySection.hidden = !visible;
        toggleFormButton.textContent = visible ? "Hide Form" : "Add Entry";
        toggleFormButton.setAttribute("aria-expanded", String(visible));

        if (visible) {
            entrySection.classList.remove("form-reveal");
            void entrySection.offsetWidth;
            entrySection.classList.add("form-reveal");
            if (scroll) {
                entrySection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }

        if (withSound) {
            if (visible) {
                sfx.playOpen();
            } else {
                sfx.playClose();
            }
        }
    }

    function closeAllEntryMenus(withSound = false) {
        const menus = entriesList.querySelectorAll(".entry-menu");
        let hadOpenMenu = false;
        menus.forEach((menu) => {
            if (!menu.hidden) {
                hadOpenMenu = true;
            }
            menu.hidden = true;
        });

        const toggles = entriesList.querySelectorAll(".entry-menu-toggle");
        toggles.forEach((toggle) => {
            toggle.setAttribute("aria-expanded", "false");
        });

        if (withSound && hadOpenMenu) {
            sfx.playClose();
        }
    }

    async function startEdit(index) {
        const entry = entries[index];
        if (!entry) {
            return;
        }

        const shouldEdit = await confirmDialog.ask({
            title: "Confirm Edit",
            message: `Edit \"${entry.title || "this entry"}\" now?`,
            confirmText: "Edit",
            cancelText: "Cancel",
            intent: "edit"
        });

        if (!shouldEdit) {
            notifier.show("info", "Edit cancelled.");
            return;
        }

        setFormVisibility(true, true, true);
        editIndex = index;
        titleInput.value = entry.title || "";
        dateInput.value = entry.date || "";
        descriptionInput.value = entry.description || "";
        imageInput.value = "";
        submitButton.textContent = "Update Entry";
        cancelEditButton.hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function deleteEntry(index, title) {
        const shouldDelete = await confirmDialog.ask({
            title: "Confirm Delete",
            message: `Are you sure you want to delete \"${title}\"?`,
            confirmText: "Delete",
            cancelText: "Keep",
            intent: "danger"
        });

        if (!shouldDelete) {
            notifier.show("info", "Delete cancelled.");
            return;
        }

        entries.splice(index, 1);
        if (editIndex === index || editIndex >= entries.length) {
            resetFormState();
            setFormVisibility(false);
        } else if (editIndex > index) {
            editIndex -= 1;
        }

        persistEntries();
        renderEntries();
        sfx.playClose();
        notifier.show("success", "Entry deleted successfully.");
    }

    function readEntries() {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return [];
        }

        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_error) {
            return [];
        }
    }

    function renderEntries() {
        entriesList.innerHTML = "";

        if (entries.length === 0) {
            const empty = document.createElement("p");
            empty.className = "empty-state";
            empty.textContent = "No entries yet. Click Add Entry to create your first one.";
            entriesList.appendChild(empty);
            return;
        }

        entries.forEach((entry, index) => {
            const card = document.createElement("article");
            card.className = "entry-card";
            card.style.setProperty("--entry-delay", `${Math.min(index, 8) * 70}ms`);
            card.tabIndex = 0;
            card.setAttribute("role", "button");
            card.setAttribute("aria-label", `Open details for ${entry.title}`);

            const cardTop = document.createElement("div");
            cardTop.className = "entry-card-top";

            const title = document.createElement("h3");
            title.textContent = entry.title;

            const meta = document.createElement("p");
            meta.className = "entry-meta";
            meta.textContent = `Date: ${formatDate(entry.date)}`;

            const description = document.createElement("p");
            description.className = "entry-description";
            description.textContent = entry.description;

            const body = document.createElement("div");
            body.className = "entry-card-body";

            const actions = document.createElement("div");
            actions.className = "entry-actions";

            const menuToggle = document.createElement("button");
            menuToggle.type = "button";
            menuToggle.className = "entry-menu-toggle";
            menuToggle.textContent = "⋮";
            menuToggle.setAttribute("aria-label", `Open actions for ${entry.title}`);
            menuToggle.setAttribute("aria-haspopup", "menu");
            menuToggle.setAttribute("aria-expanded", "false");

            const menu = document.createElement("div");
            menu.className = "entry-menu";
            menu.setAttribute("role", "menu");
            menu.hidden = true;

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "entry-menu-item entry-menu-item-edit";
            editButton.setAttribute("role", "menuitem");
            editButton.textContent = "Edit";
            editButton.addEventListener("click", async () => {
                sfx.playUiClick();
                closeAllEntryMenus();
                await startEdit(index);
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "entry-menu-item entry-menu-item-delete";
            deleteButton.setAttribute("role", "menuitem");
            deleteButton.textContent = "Delete";
            deleteButton.addEventListener("click", async () => {
                sfx.playUiClick();
                closeAllEntryMenus();
                await deleteEntry(index, entry.title || "this entry");
            });

            menuToggle.addEventListener("click", (event) => {
                event.stopPropagation();
                const shouldOpen = menu.hidden;
                closeAllEntryMenus();
                if (shouldOpen) {
                    menu.hidden = false;
                    menuToggle.setAttribute("aria-expanded", "true");
                    sfx.playOpen();
                } else {
                    sfx.playClose();
                }
            });

            menu.addEventListener("click", (event) => {
                event.stopPropagation();
            });

            card.addEventListener("click", (event) => {
                if (!(event.target instanceof Element)) {
                    return;
                }
                if (event.target.closest(".entry-actions")) {
                    return;
                }

                closeAllEntryMenus();
                entryModal.open(entry);
                sfx.playOpen();
            });

            card.addEventListener("keydown", (event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                    return;
                }
                event.preventDefault();
                card.click();
            });

            menu.appendChild(editButton);
            menu.appendChild(deleteButton);
            actions.appendChild(menuToggle);
            actions.appendChild(menu);

            cardTop.appendChild(title);
            cardTop.appendChild(actions);

            body.appendChild(meta);
            body.appendChild(description);

            if (entry.imageData) {
                const image = document.createElement("img");
                image.src = entry.imageData;
                image.alt = `${entry.title} screenshot`;
                body.appendChild(image);
            }

            card.appendChild(cardTop);
            card.appendChild(body);

            entriesList.appendChild(card);
        });
    }

    function createEntryModal() {
        const overlay = document.createElement("div");
        overlay.className = "entry-modal";
        overlay.hidden = true;
        overlay.innerHTML = [
            '<div class="entry-modal-panel" role="dialog" aria-modal="true" aria-labelledby="entry-modal-title">',
            '  <button type="button" class="entry-modal-close" aria-label="Close entry details">Close</button>',
            '  <h3 id="entry-modal-title" class="entry-modal-title"></h3>',
            '  <p class="entry-modal-meta"></p>',
            '  <p class="entry-modal-description"></p>',
            '  <div class="entry-modal-image-wrap">',
            '      <img class="entry-modal-image" alt="">',
            '  </div>',
            '</div>'
        ].join("");

        document.body.appendChild(overlay);

        const panel = overlay.querySelector(".entry-modal-panel");
        const closeButton = overlay.querySelector(".entry-modal-close");
        const titleElement = overlay.querySelector(".entry-modal-title");
        const metaElement = overlay.querySelector(".entry-modal-meta");
        const descriptionElement = overlay.querySelector(".entry-modal-description");
        const imageWrap = overlay.querySelector(".entry-modal-image-wrap");
        const image = overlay.querySelector(".entry-modal-image");
        let lastFocusedElement = null;

        if (!(panel instanceof HTMLElement) || !(closeButton instanceof HTMLButtonElement) || !(titleElement instanceof HTMLElement) || !(metaElement instanceof HTMLElement) || !(descriptionElement instanceof HTMLElement) || !(imageWrap instanceof HTMLElement) || !(image instanceof HTMLImageElement)) {
            return {
                open: () => {},
                close: () => {},
                isOpen: () => false
            };
        }

        closeButton.addEventListener("click", () => {
            close(true);
        });

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
                close(true);
            }
        });

        panel.addEventListener("click", (event) => {
            event.stopPropagation();
        });

        imageWrap.addEventListener("mousemove", (event) => {
            if (overlay.hidden || imageWrap.hidden) {
                return;
            }

            const rect = imageWrap.getBoundingClientRect();
            if (!rect.width || !rect.height) {
                return;
            }

            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;
            image.style.setProperty("--zoom-x", `${x}%`);
            image.style.setProperty("--zoom-y", `${y}%`);
        });

        imageWrap.addEventListener("mouseleave", () => {
            resetModalZoom();
        });

        function resetModalZoom() {
            image.style.setProperty("--zoom-x", "50%");
            image.style.setProperty("--zoom-y", "50%");
        }

        function open(entry) {
            lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            titleElement.textContent = entry.title || "Untitled Entry";
            metaElement.textContent = `Date: ${formatDate(entry.date)}`;
            descriptionElement.textContent = entry.description || "No description available.";
            resetModalZoom();

            if (entry.imageData) {
                image.src = entry.imageData;
                image.alt = `${entry.title || "Entry"} full image`;
                imageWrap.hidden = false;
            } else {
                image.removeAttribute("src");
                imageWrap.hidden = true;
            }

            overlay.hidden = false;
            overlay.classList.remove("is-visible");
            void overlay.offsetWidth;
            overlay.classList.add("is-visible");
            document.body.classList.add("modal-open");
            closeButton.focus();
        }

        function close(withSound = false) {
            if (overlay.hidden) {
                return;
            }

            overlay.classList.remove("is-visible");
            overlay.hidden = true;
            document.body.classList.remove("modal-open");
            image.removeAttribute("src");
            resetModalZoom();

            if (lastFocusedElement) {
                lastFocusedElement.focus();
            }

            if (withSound) {
                sfx.playClose();
            }
        }

        return {
            open,
            close,
            isOpen: () => !overlay.hidden
        };
    }

    function formatDate(isoDate) {
        const date = new Date(isoDate);
        if (Number.isNaN(date.getTime())) {
            return isoDate;
        }
        return date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    function readImageAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Failed to read image."));
            reader.readAsDataURL(file);
        });
    }

    function createToastNotifier() {
        const stack = document.createElement("div");
        stack.className = "toast-stack";
        document.body.appendChild(stack);

        function show(type, message) {
            const toast = document.createElement("div");
            toast.className = `toast toast-${type}`;
            toast.setAttribute("role", "status");
            toast.setAttribute("aria-live", "polite");
            toast.textContent = message;
            stack.appendChild(toast);

            requestAnimationFrame(() => {
                toast.classList.add("is-visible");
            });

            const dismissTimeout = window.setTimeout(() => {
                dismiss(toast);
            }, 2700);

            toast.addEventListener("click", () => {
                window.clearTimeout(dismissTimeout);
                dismiss(toast);
            });
        }

        function dismiss(toast) {
            if (!toast.isConnected) {
                return;
            }

            toast.classList.remove("is-visible");
            toast.classList.add("is-leaving");
            window.setTimeout(() => {
                if (toast.isConnected) {
                    toast.remove();
                }
            }, 180);
        }

        return {
            show
        };
    }

    function createConfirmDialog() {
        const overlay = document.createElement("div");
        overlay.className = "confirm-modal";
        overlay.hidden = true;
        overlay.innerHTML = [
            '<div class="confirm-modal-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">',
            '  <h3 id="confirm-modal-title" class="confirm-modal-title"></h3>',
            '  <p class="confirm-modal-message"></p>',
            '  <div class="confirm-modal-actions">',
            '      <button type="button" class="confirm-modal-cancel">Cancel</button>',
            '      <button type="button" class="confirm-modal-confirm">Confirm</button>',
            '  </div>',
            '</div>'
        ].join("");

        document.body.appendChild(overlay);

        const titleElement = overlay.querySelector(".confirm-modal-title");
        const messageElement = overlay.querySelector(".confirm-modal-message");
        const cancelButton = overlay.querySelector(".confirm-modal-cancel");
        const confirmButton = overlay.querySelector(".confirm-modal-confirm");
        let resolvePending = null;
        let lastFocusedElement = null;

        if (!(titleElement instanceof HTMLElement) || !(messageElement instanceof HTMLElement) || !(cancelButton instanceof HTMLButtonElement) || !(confirmButton instanceof HTMLButtonElement)) {
            return {
                ask: async () => false
            };
        }

        cancelButton.addEventListener("click", () => {
            close(false);
        });

        confirmButton.addEventListener("click", () => {
            close(true);
        });

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
                close(false);
            }
        });

        document.addEventListener("keydown", (event) => {
            if (overlay.hidden) {
                return;
            }

            if (event.key === "Escape") {
                event.preventDefault();
                close(false);
            }
        });

        async function ask({ title, message, confirmText, cancelText, intent }) {
            if (resolvePending) {
                resolvePending(false);
                resolvePending = null;
            }

            titleElement.textContent = title || "Please Confirm";
            messageElement.textContent = message || "Are you sure?";
            confirmButton.textContent = confirmText || "Confirm";
            cancelButton.textContent = cancelText || "Cancel";
            overlay.dataset.intent = intent || "default";

            lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            overlay.hidden = false;
            overlay.classList.remove("is-visible");
            void overlay.offsetWidth;
            overlay.classList.add("is-visible");
            document.body.classList.add("modal-open");
            confirmButton.focus();
            sfx.playOpen();

            return new Promise((resolve) => {
                resolvePending = resolve;
            });
        }

        function close(result) {
            if (overlay.hidden) {
                return;
            }

            overlay.classList.remove("is-visible");
            overlay.hidden = true;
            document.body.classList.remove("modal-open");

            if (lastFocusedElement) {
                lastFocusedElement.focus();
            }

            if (result) {
                sfx.playUiClick();
            } else {
                sfx.playClose();
            }

            if (resolvePending) {
                resolvePending(result);
                resolvePending = null;
            }
        }

        return {
            ask
        };
    }
})();

function setupRetroSound() {
    const storageKey = "algo_retro_sfx_enabled";
    let enabled = true;
    let audioContext = null;
    let lastHoverAt = 0;

    try {
        const stored = localStorage.getItem(storageKey);
        if (stored !== null) {
            enabled = stored === "true";
        }
    } catch (_error) {
        enabled = true;
    }

    const soundToggle = document.createElement("button");
    soundToggle.type = "button";
    soundToggle.className = "sfx-toggle";
    soundToggle.setAttribute("aria-label", "Toggle retro sound effects");
    soundToggle.setAttribute("title", "Toggle retro sound effects");
    updateToggleLabel();
    document.body.appendChild(soundToggle);

    soundToggle.addEventListener("click", () => {
        enabled = !enabled;
        try {
            localStorage.setItem(storageKey, String(enabled));
        } catch (_error) {
            // Ignore storage errors.
        }
        updateToggleLabel();
        if (enabled) {
            unlockAudio();
            playBootSequence();
        }
    });

    soundToggle.addEventListener("mouseenter", () => {
        playHover();
    });

    function handleFirstInteraction() {
        unlockAudio();
        if (enabled) {
            playBootSequence();
        }
        window.removeEventListener("pointerdown", handleFirstInteraction);
        window.removeEventListener("keydown", handleFirstInteraction);
    }

    window.addEventListener("pointerdown", handleFirstInteraction, { passive: true });
    window.addEventListener("keydown", handleFirstInteraction);

    function updateToggleLabel() {
        soundToggle.textContent = enabled ? "SFX: ON" : "SFX: OFF";
        soundToggle.setAttribute("aria-pressed", String(enabled));
    }

    function unlockAudio() {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) {
            return null;
        }
        if (!audioContext) {
            audioContext = new Context();
        }
        if (audioContext.state === "suspended") {
            audioContext.resume().catch(() => {
                // Ignore resume errors.
            });
        }
        return audioContext;
    }

    function playTone({ frequency, endFrequency, duration, volume, type }) {
        if (!enabled) {
            return;
        }
        const ctx = unlockAudio();
        if (!ctx) {
            return;
        }

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now);
        osc.frequency.linearRampToValueAtTime(endFrequency, now + duration);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    function playHover() {
        const now = performance.now();
        if (now - lastHoverAt < 85) {
            return;
        }
        lastHoverAt = now;
        playTone({
            frequency: 760,
            endFrequency: 880,
            duration: 0.035,
            volume: 0.012,
            type: "square"
        });
    }

    function playUiClick() {
        playTone({
            frequency: 240,
            endFrequency: 380,
            duration: 0.07,
            volume: 0.018,
            type: "square"
        });
    }

    function playOpen() {
        playTone({
            frequency: 300,
            endFrequency: 520,
            duration: 0.09,
            volume: 0.02,
            type: "triangle"
        });
    }

    function playClose() {
        playTone({
            frequency: 500,
            endFrequency: 260,
            duration: 0.08,
            volume: 0.017,
            type: "triangle"
        });
    }

    function playSuccess() {
        playTone({
            frequency: 360,
            endFrequency: 620,
            duration: 0.08,
            volume: 0.02,
            type: "square"
        });
        setTimeout(() => {
            playTone({
                frequency: 620,
                endFrequency: 780,
                duration: 0.07,
                volume: 0.015,
                type: "square"
            });
        }, 50);
    }

    function playError() {
        playTone({
            frequency: 340,
            endFrequency: 200,
            duration: 0.12,
            volume: 0.018,
            type: "sawtooth"
        });
    }

    function playBootSequence() {
        playTone({
            frequency: 280,
            endFrequency: 400,
            duration: 0.06,
            volume: 0.017,
            type: "square"
        });
        setTimeout(() => {
            playTone({
                frequency: 460,
                endFrequency: 700,
                duration: 0.07,
                volume: 0.017,
                type: "square"
            });
        }, 62);
        setTimeout(() => {
            playTone({
                frequency: 760,
                endFrequency: 930,
                duration: 0.06,
                volume: 0.014,
                type: "triangle"
            });
        }, 130);
    }

    function bindInteractions(root) {
        const links = root.querySelectorAll(".category-card, .home-button, .retro-list a");
        links.forEach((element) => {
            if (element.dataset.sfxBound === "true") {
                return;
            }

            element.addEventListener("mouseenter", () => {
                playHover();
            });

            element.addEventListener("click", () => {
                playUiClick();
            });

            element.dataset.sfxBound = "true";
        });
    }

    return {
        bindInteractions,
        playUiClick,
        playOpen,
        playClose,
        playSuccess,
        playError
    };
}
