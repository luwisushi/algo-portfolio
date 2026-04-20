(function () {
    const category = document.body.dataset.category;
    if (!category) {
        return;
    }

    const form = document.getElementById("entry-form");
    const titleInput = document.getElementById("title");
    const dateInput = document.getElementById("date");
    const descriptionInput = document.getElementById("description");
    const imageInput = document.getElementById("image");
    const submitButton = document.getElementById("submit-button");
    const cancelEditButton = document.getElementById("cancel-edit");
    const entriesList = document.getElementById("entries-list");

    if (!form || !titleInput || !dateInput || !descriptionInput || !imageInput || !submitButton || !cancelEditButton || !entriesList) {
        return;
    }

    const storageKey = `algo_complexities_${category}`;
    const entries = readEntries();
    let editIndex = -1;

    renderEntries();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const title = titleInput.value.trim();
        const date = dateInput.value;
        const description = descriptionInput.value.trim();
        const file = imageInput.files && imageInput.files[0];

        if (!title || !date || !description) {
            return;
        }

        try {
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
                    alert("Please import an image before adding this entry.");
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
            renderEntries();
        } catch (_error) {
            alert("There was a problem reading the image file. Please try again.");
        }
    });

    cancelEditButton.addEventListener("click", () => {
        resetFormState();
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

    function startEdit(index) {
        const entry = entries[index];
        if (!entry) {
            return;
        }

        editIndex = index;
        titleInput.value = entry.title || "";
        dateInput.value = entry.date || "";
        descriptionInput.value = entry.description || "";
        imageInput.value = "";
        submitButton.textContent = "Update Entry";
        cancelEditButton.hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function deleteEntry(index, title) {
        if (!window.confirm(`Delete "${title}"?`)) {
            return;
        }

        entries.splice(index, 1);
        if (editIndex === index || editIndex >= entries.length) {
            resetFormState();
        } else if (editIndex > index) {
            editIndex -= 1;
        }

        persistEntries();
        renderEntries();
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
            empty.textContent = "No entries yet. Add your first one using the form above.";
            entriesList.appendChild(empty);
            return;
        }

        entries.forEach((entry, index) => {
            const card = document.createElement("article");
            card.className = "entry-card";
            card.style.setProperty("--entry-delay", `${Math.min(index, 8) * 70}ms`);

            const title = document.createElement("h3");
            title.textContent = entry.title;

            const meta = document.createElement("p");
            meta.className = "entry-meta";
            meta.textContent = `Date: ${formatDate(entry.date)}`;

            const description = document.createElement("p");
            description.textContent = entry.description;

            const actions = document.createElement("div");
            actions.className = "entry-actions";

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "card-action card-action-edit";
            editButton.textContent = "Edit";
            editButton.addEventListener("click", () => startEdit(index));

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "card-action card-action-delete";
            deleteButton.textContent = "Delete";
            deleteButton.addEventListener("click", () => deleteEntry(index, entry.title || "this entry"));

            actions.appendChild(editButton);
            actions.appendChild(deleteButton);

            card.appendChild(title);
            card.appendChild(meta);
            card.appendChild(description);
            card.appendChild(actions);

            if (entry.imageData) {
                const image = document.createElement("img");
                image.src = entry.imageData;
                image.alt = `${entry.title} screenshot`;
                card.appendChild(image);
            }

            entriesList.appendChild(card);
        });
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
})();
