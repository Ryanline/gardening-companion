const plantList = document.getElementById("plant-list");
const addPlantBtn = document.getElementById("add-plant-btn");
const plantPickerBackdrop = document.getElementById("plant-picker-backdrop");
const plantPickerModal = document.getElementById("plant-picker-modal");
const plantPickerOptions = document.getElementById("plant-picker-options");

const STORAGE_KEY = "gardenCompanion.v9.plants";
const PRESET_PLANT_OPTIONS = [
  "Custom plant",
  "Strawberry",
  "Carrot",
  "Tomato",
  "Basil",
  "Lettuce",
  "Pepper",
  "Rosemary"
];
const WARNING_MESSAGE = "This plant may need watering. You may have already watered the plant but the system failed to display it -- in this case, we apologize for the inconvenience and please contact support!";
const RECENT_WATERING_DAYS = 7;

const toastEl = document.getElementById("toast");
let toastTimer = null;

const modalBackdrop = document.getElementById("modal-backdrop");
const plantModal = document.getElementById("plant-modal");
const modalTitle = document.getElementById("modal-title");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalStatus = document.getElementById("modal-status");
const modalWaterBtn = document.getElementById("modal-water-btn");
const modalWaterLog = document.getElementById("modal-water-log");
const modalCareBtn = document.getElementById("modal-care-btn");
const modalFactBtn = document.getElementById("modal-fact-btn");
const modalInsight = document.getElementById("modal-insight");

const photoInput = document.getElementById("photo-input");
const photoGallery = document.getElementById("photo-gallery");

let selectedPlantId = null;
let plants = loadPlants();

renderPlantPickerOptions();
renderPlants();

addPlantBtn.addEventListener("click", openPlantPicker);
modalCloseBtn.addEventListener("click", closePlantModal);
modalBackdrop.addEventListener("click", closePlantModal);
plantPickerBackdrop.addEventListener("click", closePlantPicker);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closePlantPicker();
  closePlantModal();
});

modalWaterBtn.addEventListener("click", () => {
  if (selectedPlantId == null) return;
  logWatering(selectedPlantId);
  openPlantModal(selectedPlantId);
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

photoInput.addEventListener("change", () => {
  if (selectedPlantId == null) return;

  const file = photoInput.files?.[0];
  if (!file) return;

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
      dataUrl: reader.result,
      addedAt: new Date().toISOString()
    });

    savePlants();
    openPlantModal(selectedPlantId);
    showToast("Photo added!");
  };

  reader.readAsDataURL(file);
  photoInput.value = "";
});

function showToast(message, ms = 4000) {
  if (!toastEl) return;

  if (toastTimer) clearTimeout(toastTimer);

  toastEl.textContent = message;
  toastEl.classList.remove("hidden", "fade-out");

  toastTimer = setTimeout(() => {
    toastEl.classList.add("fade-out");

    setTimeout(() => {
      toastEl.classList.add("hidden");
    }, 220);
  }, ms);
}

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

function renderPlantPickerOptions() {
  plantPickerOptions.innerHTML = "";

  PRESET_PLANT_OPTIONS.forEach((optionName) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "picker-option";
    button.textContent = optionName;
    button.addEventListener("click", () => handlePlantOptionSelect(optionName));
    plantPickerOptions.appendChild(button);
  });
}

function handlePlantOptionSelect(optionName) {
  if (optionName === "Custom plant") {
    const customName = prompt("Enter your plant name:");
    if (!customName) return;

    addPlant(customName);
    return;
  }

  addPlant(optionName);
}

function addPlant(name) {
  const trimmed = name.trim();
  if (!trimmed) return;

  plants.push({
    id: Date.now(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    lastWatered: null,
    waterLog: [],
    photos: [],
    type: ""
  });

  closePlantPicker();
  savePlants();
  renderPlants();
  showToast(`${trimmed} added to your garden!`);
}

function formatDateTime(isoString) {
  if (!isoString) return "Never";
  const d = new Date(isoString);
  return d.toLocaleString();
}

function getWaterStatus(plant) {
  if (!plant?.lastWatered) {
    return {
      text: WARNING_MESSAGE,
      className: "status-warning"
    };
  }

  const wateredAt = new Date(plant.lastWatered);
  const diffMs = Date.now() - wateredAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= RECENT_WATERING_DAYS) {
    return {
      text: `Last watered: ${formatDateTime(plant.lastWatered)}`,
      className: "status-ok"
    };
  }

  return {
    text: WARNING_MESSAGE,
    className: "status-warning"
  };
}

function renderPlants() {
  plantList.innerHTML = "";

  plants.forEach((plant) => {
    const li = document.createElement("li");
    li.className = "plant-card";
    const waterStatus = getWaterStatus(plant);

    li.innerHTML = `
      <div class="plant-card-top">
        <div class="plant-title-row">
          <strong class="plant-name">${escapeHtml(plant.name)}</strong>
          <button data-action="open" data-id="${plant.id}" class="info-button" title="More info" aria-label="More info about ${escapeHtml(plant.name)}">
            <img src="assets/info-icon.svg" alt="" />
          </button>
        </div>
      </div>

      <div class="plant-footer">
        <div class="water-status ${waterStatus.className}">${escapeHtml(waterStatus.text)}</div>

        <div class="plant-actions">
          <button data-action="water" data-id="${plant.id}">Log Watering</button>
        </div>
      </div>
    `;

    plantList.appendChild(li);
  });

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

function openPlantModal(plantId) {
  const plant = getPlant(plantId);
  if (!plant) return;

  selectedPlantId = plantId;
  const waterStatus = getWaterStatus(plant);

  modalTitle.textContent = plant.name;
  modalStatus.textContent = waterStatus.text;
  modalStatus.className = `water-status ${waterStatus.className}`;

  modalWaterLog.innerHTML = "";
  const log = plant.waterLog ?? [];
  if (log.length === 0) {
    modalWaterLog.innerHTML = "<li><em>No watering logged yet.</em></li>";
  } else {
    log.forEach((entry) => {
      const li = document.createElement("li");
      li.textContent = formatDateTime(entry.at);
      modalWaterLog.appendChild(li);
    });
  }

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

  modalInsight.classList.add("hidden");
  modalInsight.textContent = "";

  modalBackdrop.classList.remove("hidden");
  plantModal.classList.remove("hidden");
}

function closePlantModal() {
  selectedPlantId = null;
  modalBackdrop.classList.add("hidden");
  plantModal.classList.add("hidden");
}

function openPlantPicker() {
  plantPickerBackdrop.classList.remove("hidden");
  plantPickerModal.classList.remove("hidden");
}

function closePlantPicker() {
  plantPickerBackdrop.classList.add("hidden");
  plantPickerModal.classList.add("hidden");
}

function showInsight(text) {
  modalInsight.textContent = text;
  modalInsight.classList.remove("hidden");
}

function getCareBlurb(plant) {
  const name = (plant?.name ?? "").toLowerCase();

  if (name.includes("basil")) {
    return "Basil likes bright light (6-8 hours of sun), warm temperatures, and evenly moist soil. Water when the top inch of soil feels dry and avoid waterlogging.";
  }
  if (name.includes("oregano")) {
    return "Oregano likes full sun and well-draining soil. Water when the top inch or two is dry; it handles drought better than soggy soil once established.";
  }
  if (name.includes("succulent")) {
    return "Succulents prefer bright light and infrequent deep watering. Let the soil dry out completely between waterings because overwatering is the most common issue.";
  }
  if (name.includes("tomato")) {
    return "Tomatoes love full sun and consistent moisture. Water deeply at the base when the top 1-2 inches are dry and avoid wetting the leaves to reduce disease.";
  }
  if (name.includes("pothos")) {
    return "Pothos prefers bright, indirect light but tolerates low light. Water when the top 1-2 inches are dry; slight underwatering is usually safer than overwatering.";
  }

  return "General care: give bright indirect light or sun depending on the plant, keep temperatures moderate, and water when the top inch of soil is dry. Adjust based on wilting versus soggy soil.";
}

function getFunFact(plant) {
  const name = (plant?.name ?? "").toLowerCase();

  if (name.includes("basil")) {
    return "Fun fact: Basil's aroma comes from essential oils that help deter pests, and bruising the leaves releases even more scent.";
  }
  if (name.includes("oregano")) {
    return "Fun fact: Oregano is in the mint family, and many herbs in that family have strong oils that make them aromatic and pest resistant.";
  }
  if (name.includes("tomato")) {
    return "Fun fact: Botanically, tomatoes are berries even though we usually cook with them like vegetables.";
  }
  if (name.includes("succulent")) {
    return "Fun fact: Many succulents store water in their leaves or stems, which is why they can survive long dry spells.";
  }
  if (name.includes("pothos")) {
    return "Fun fact: Pothos is nicknamed devil's ivy because it is famously hard to kill and grows in a wide range of conditions.";
  }

  return "Fun fact: Plants bend toward light through phototropism, shifting growth hormones so one side grows faster than the other.";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}