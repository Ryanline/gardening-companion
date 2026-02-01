// app.js — Garden Companion (plants + persistence + watering + detail modal + insight + photos + toast notifications)

const plantList = document.getElementById("plant-list");
const addPlantBtn = document.getElementById("add-plant-btn");

const STORAGE_KEY = "gardenCompanion.plants";

// ---- Toast elements ----
const toastEl = document.getElementById("toast");
let toastTimer = null;

function showToast(message, ms = 4000) {
  if (!toastEl) return;

  // Clear any previous toast timers
  if (toastTimer) clearTimeout(toastTimer);

  toastEl.textContent = message;
  toastEl.classList.remove("hidden", "fade-out");

  toastTimer = setTimeout(() => {
    toastEl.classList.add("fade-out");

    // Wait for fade animation, then hide
    setTimeout(() => {
      toastEl.classList.add("hidden");
    }, 220);
  }, ms);
}

// ---- Modal elements ----
const modalBackdrop = document.getElementById("modal-backdrop");
const plantModal = document.getElementById("plant-modal");
const modalTitle = document.getElementById("modal-title");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalLastWatered = document.getElementById("modal-last-watered");
const modalWaterBtn = document.getElementById("modal-water-btn");
const modalWaterLog = document.getElementById("modal-water-log");
const modalCareBtn = document.getElementById("modal-care-btn");
const modalFactBtn = document.getElementById("modal-fact-btn");
const modalInsight = document.getElementById("modal-insight");

// ---- Photo elements (inside modal) ----
const photoInput = document.getElementById("photo-input");
const photoGallery = document.getElementById("photo-gallery");

let selectedPlantId = null;

// ---- Persistence helpers ----
function loadPlants() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePlants() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
}

// ---- App state ----
let plants = loadPlants();
renderPlants();

// ---- Main UI actions ----
addPlantBtn.addEventListener("click", () => {
  const name = prompt("Plant name?");
  if (!name) return;

  const trimmed = name.trim();
  if (!trimmed) return;

  plants.push({
    id: Date.now(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    lastWatered: null,
    waterLog: [],
    photos: [],
    type: "" // optional for later expansion
  });

  savePlants();
  renderPlants();
  showToast("Plant added successfully!");
});

// ---- Modal close behavior ----
modalCloseBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// ---- Modal actions ----
modalWaterBtn.addEventListener("click", () => {
  if (selectedPlantId == null) return;
  logWatering(selectedPlantId);
  openPlantModal(selectedPlantId); // refresh modal content
});

modalCareBtn.addEventListener("click", () => {
  if (selectedPlantId == null) return;
  const plant = getPlant(selectedPlantId);
  showInsight(getCareBlurb(plant));
});

modalFactBtn.addEventListener("click", () => {
  if (selectedPlantId == null) return;
  const plant = getPlant(selectedPlantId);
  showInsight(getFunFact(plant));
});

// ---- Photo upload handling ----
photoInput.addEventListener("change", () => {
  if (selectedPlantId == null) return;

  const file = photoInput.files?.[0];
  if (!file) return;

  // Optional safety check: keep localStorage from ballooning too fast
  const MAX_MB = 2.5;
  if (file.size > MAX_MB * 1024 * 1024) {
    alert(`That file is a bit large (${MAX_MB}MB max for this prototype). Try a smaller image.`);
    photoInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const plant = getPlant(selectedPlantId);
    if (!plant) return;

    plant.photos = plant.photos ?? [];
    plant.photos.unshift({
      dataUrl: reader.result, // base64 data URL
      addedAt: new Date().toISOString()
    });

    savePlants();
    openPlantModal(selectedPlantId); // refresh modal content
    showToast("Photo added!");
  };

  reader.readAsDataURL(file);
  photoInput.value = ""; // reset input so you can upload the same file again if desired
});

// ---- Rendering helpers ----
function formatDateTime(isoString) {
  if (!isoString) return "Never";
  const d = new Date(isoString);
  return d.toLocaleString();
}

function renderPlants() {
  plantList.innerHTML = "";

  plants.forEach((plant) => {
    const li = document.createElement("li");
    li.className = "plant-card";

    li.innerHTML = `
      <div class="plant-title" style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
        <strong>${escapeHtml(plant.name)}</strong>
        <button data-action="open" data-id="${plant.id}" title="Details">Details</button>
      </div>

      <div class="plant-meta">
        Last watered: ${formatDateTime(plant.lastWatered)}
      </div>

      <div class="plant-actions">
        <button data-action="water" data-id="${plant.id}">Log Watering</button>
      </div>
    `;

    plantList.appendChild(li);
  });

  // Attach handlers
  plantList.querySelectorAll("button[data-action='water']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = Number(e.currentTarget.dataset.id);
      logWatering(id);
    });
  });

  plantList.querySelectorAll("button[data-action='open']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = Number(e.currentTarget.dataset.id);
      openPlantModal(id);
    });
  });
}

function getPlant(plantId) {
  return plants.find((p) => p.id === plantId) ?? null;
}

// ---- Watering ----
function logWatering(plantId) {
  const plant = getPlant(plantId);
  if (!plant) return;

  const now = new Date().toISOString();
  plant.lastWatered = now;
  plant.waterLog = plant.waterLog ?? [];
  plant.waterLog.unshift({ at: now });

  savePlants();
  renderPlants();
  showToast("Watering logged!");
}

// ---- Modal open/close + content population ----
function openPlantModal(plantId) {
  const plant = getPlant(plantId);
  if (!plant) return;

  selectedPlantId = plantId;

  modalTitle.textContent = plant.name;
  modalLastWatered.textContent = formatDateTime(plant.lastWatered);

  // Watering history
  modalWaterLog.innerHTML = "";
  const log = plant.waterLog ?? [];
  if (log.length === 0) {
    modalWaterLog.innerHTML = `<li><em>No watering logged yet.</em></li>`;
  } else {
    log.forEach((entry) => {
      const li = document.createElement("li");
      li.textContent = formatDateTime(entry.at);
      modalWaterLog.appendChild(li);
    });
  }

  // Photos
  photoGallery.innerHTML = "";
  const photos = plant.photos ?? [];
  if (photos.length === 0) {
    photoGallery.innerHTML = "<em>No photos added yet.</em>";
  } else {
    photos.forEach((photo) => {
      const img = document.createElement("img");
      img.src = photo.dataUrl;
      img.alt = `${plant.name} photo`;
      img.loading = "lazy";
      photoGallery.appendChild(img);
    });
  }

  // Reset insight box
  modalInsight.classList.add("hidden");
  modalInsight.textContent = "";

  // Show modal
  modalBackdrop.classList.remove("hidden");
  plantModal.classList.remove("hidden");
}

function closeModal() {
  selectedPlantId = null;
  modalBackdrop.classList.add("hidden");
  plantModal.classList.add("hidden");
}

function showInsight(text) {
  modalInsight.textContent = text;
  modalInsight.classList.remove("hidden");
}

// ---- “AI-like” content (prototype-friendly) ----
function getCareBlurb(plant) {
  const name = (plant?.name ?? "").toLowerCase();

  if (name.includes("basil")) {
    return "Basil likes bright light (6–8 hours sun), warm temps, and evenly moist soil. Water when the top inch of soil feels dry—avoid waterlogging.";
  }
  if (name.includes("oregano")) {
    return "Oregano likes full sun and well-draining soil. Water when the top inch or two is dry; it tolerates drought better than soggy soil once established.";
  }
  if (name.includes("succulent")) {
    return "Succulents prefer bright light and infrequent deep watering. Let soil dry out completely between waterings; overwatering is the #1 issue.";
  }
  if (name.includes("tomato")) {
    return "Tomatoes love full sun and consistent moisture. Water deeply at the base when the top 1–2 inches are dry; avoid wetting leaves to reduce disease.";
  }
  if (name.includes("pothos")) {
    return "Pothos prefers bright, indirect light but tolerates low light. Water when the top 1–2 inches are dry; it’s better to underwater slightly than overwater.";
  }

  return "General care: give bright indirect light or sun depending on the plant, keep temps moderate, and water when the top inch of soil is dry. Adjust based on wilting vs soggy soil.";
}

function getFunFact(plant) {
  const name = (plant?.name ?? "").toLowerCase();

  if (name.includes("basil")) {
    return "Fun fact: Basil’s aroma comes from essential oils that plants use to deter pests—bruising the leaves releases more of that scent.";
  }
  if (name.includes("oregano")) {
    return "Fun fact: Oregano is in the mint family—many herbs in this family have strong oils that make them aromatic and pest-resistant.";
  }
  if (name.includes("tomato")) {
    return "Fun fact: Botanically, tomatoes are berries—but in cooking they’re treated like vegetables.";
  }
  if (name.includes("succulent")) {
    return "Fun fact: Many succulents store water in leaves or stems, which is why they can survive long dry spells.";
  }
  if (name.includes("pothos")) {
    return "Fun fact: Pothos is nicknamed “devil’s ivy” because it’s famously hard to kill and grows in a wide range of conditions.";
  }

  return "Fun fact: Plants bend toward light (phototropism) by redistributing growth hormones so stems and leaves grow more on one side than the other.";
}

// ---- Basic HTML escaping ----
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}