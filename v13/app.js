const plantList = document.getElementById("plant-list");
const addPlantBtn = document.getElementById("add-plant-btn");
const openGraphBtn = document.getElementById("open-graph-btn");
const plantPickerBackdrop = document.getElementById("plant-picker-backdrop");
const plantPickerModal = document.getElementById("plant-picker-modal");
const plantPickerOptions = document.getElementById("plant-picker-options");

const STORAGE_KEY = "gardenCompanion.v13.plants";
const GRID_SIZE = 9;
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
const WARNING_MESSAGE = "Please water me!";
const RECENT_WATERING_DAYS = 7;
const DELETE_UNDO_MS = 10000;
const GRAPH_COLORS = ["#4f7d2f", "#8a5a27", "#2e6c6f", "#8d4378", "#6d7134", "#3f5e95", "#aa7045", "#5b8b5a", "#9b4d4d"];

const toastEl = document.getElementById("toast");
let toastTimer = null;

const deleteBanner = document.getElementById("delete-banner");
const undoDeleteBtn = document.getElementById("undo-delete-btn");
let deleteUndoTimer = null;
let pendingDeletedPlant = null;

const modalBackdrop = document.getElementById("modal-backdrop");
const plantModal = document.getElementById("plant-modal");
const graphModal = document.getElementById("graph-modal");
const graphEmpty = document.getElementById("graph-empty");
const graphChart = document.getElementById("graph-chart");
const graphLegend = document.getElementById("graph-legend");

const modalTitle = document.getElementById("modal-title");
const modalCloseBtn = document.getElementById("modal-close-btn");
const graphCloseBtn = document.getElementById("graph-close-btn");
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
openGraphBtn.addEventListener("click", openGraphModal);
modalCloseBtn.addEventListener("click", closePlantModal);
graphCloseBtn.addEventListener("click", closeGraphModal);
modalBackdrop.addEventListener("click", closeOpenModal);
plantPickerBackdrop.addEventListener("click", closePlantPicker);
undoDeleteBtn.addEventListener("click", undoPlantDelete);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closePlantPicker();
  closeOpenModal();
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
  if (plants.length >= GRID_SIZE) {
    closePlantPicker();
    showToast("Your garden is full.");
    return;
  }

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

  for (let slotIndex = 0; slotIndex < GRID_SIZE; slotIndex += 1) {
    const li = document.createElement("li");
    li.className = "garden-slot";
    const plant = plants[slotIndex];

    if (plant) {
      const waterStatus = getWaterStatus(plant);
      li.innerHTML = `
        <article class="plant-card">
          <button data-action="delete-plant" data-id="${plant.id}" class="plant-delete" aria-label="Delete ${escapeHtml(plant.name)}">&times;</button>

          <div class="plant-title-row">
            <strong class="plant-name">${escapeHtml(plant.name)}</strong>
            <button data-action="open" data-id="${plant.id}" class="info-button" title="More info" aria-label="More info about ${escapeHtml(plant.name)}">
              <img src="assets/info-icon.svg" alt="" />
            </button>
          </div>

          <div class="plant-footer">
            <div class="water-status ${waterStatus.className}">${escapeHtml(waterStatus.text)}</div>
            <button data-action="water" data-id="${plant.id}" class="icon-button watering-button" type="button">
              <img src="assets/watering-pail.png" alt="" />
              <span class="sr-only">Log Watering for ${escapeHtml(plant.name)}</span>
            </button>
          </div>
        </article>
      `;
    } else {
      li.innerHTML = `
        <div class="empty-plot is-add-slot">
          <button data-action="open-picker" class="icon-button" type="button">
            <img src="assets/new-plant.png" alt="" />
            <span class="sr-only">Add Plant</span>
          </button>
        </div>
      `;
    }

    plantList.appendChild(li);
  }

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

  plantList.querySelectorAll("button[data-action='delete-plant']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = Number(e.currentTarget.dataset.id);
      deletePlant(id);
    });
  });

  plantList.querySelectorAll("button[data-action='open-picker']").forEach((btn) => {
    btn.addEventListener("click", openPlantPicker);
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
  if (!graphModal.classList.contains("hidden")) {
    renderGraph();
  }
  showToast("Watering logged!");
}

function deletePlant(plantId) {
  const index = plants.findIndex((plant) => plant.id === plantId);
  if (index === -1) return;

  pendingDeletedPlant = {
    plant: structuredClone(plants[index]),
    index
  };

  plants.splice(index, 1);
  savePlants();
  renderPlants();
  if (!graphModal.classList.contains("hidden")) {
    renderGraph();
  }

  if (selectedPlantId === plantId) {
    closePlantModal();
  }

  showDeleteBanner();
}

function showDeleteBanner() {
  if (deleteUndoTimer) clearTimeout(deleteUndoTimer);
  deleteBanner.classList.remove("hidden");

  deleteUndoTimer = setTimeout(() => {
    pendingDeletedPlant = null;
    deleteBanner.classList.add("hidden");
  }, DELETE_UNDO_MS);
}

function undoPlantDelete() {
  if (!pendingDeletedPlant) return;

  plants.splice(pendingDeletedPlant.index, 0, pendingDeletedPlant.plant);
  pendingDeletedPlant = null;
  if (deleteUndoTimer) clearTimeout(deleteUndoTimer);
  deleteBanner.classList.add("hidden");

  savePlants();
  renderPlants();
  if (!graphModal.classList.contains("hidden")) {
    renderGraph();
  }
  showToast("Plant restored!");
}

function deleteWaterLog(plantId, entryIndex) {
  const plant = getPlant(plantId);
  if (!plant) return;

  plant.waterLog = plant.waterLog ?? [];
  plant.waterLog.splice(entryIndex, 1);
  plant.lastWatered = plant.waterLog[0]?.at ?? null;

  savePlants();
  renderPlants();
  if (!graphModal.classList.contains("hidden")) {
    renderGraph();
  }
  openPlantModal(plantId);
  showToast("Watering log deleted.");
}

function openPlantModal(plantId) {
  const plant = getPlant(plantId);
  if (!plant) return;

  closeGraphModal();
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
    log.forEach((entry, index) => {
      const li = document.createElement("li");
      li.className = "water-log-item";
      li.innerHTML = `
        <button class="water-log-delete" type="button" aria-label="Delete watering log">&times;</button>
        <span>${escapeHtml(formatDateTime(entry.at))}</span>
      `;
      li.querySelector("button").addEventListener("click", () => {
        deleteWaterLog(plantId, index);
      });
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
  plantModal.classList.add("hidden");
  syncBackdrop();
}

function openGraphModal() {
  closePlantModal();
  renderGraph();
  modalBackdrop.classList.remove("hidden");
  graphModal.classList.remove("hidden");
}

function closeGraphModal() {
  graphModal.classList.add("hidden");
  syncBackdrop();
}

function closeOpenModal() {
  closeGraphModal();
  closePlantModal();
}

function syncBackdrop() {
  const shouldShow = !plantModal.classList.contains("hidden") || !graphModal.classList.contains("hidden");
  modalBackdrop.classList.toggle("hidden", !shouldShow);
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

function renderGraph() {
  const series = plants
    .map((plant, index) => ({
      name: plant.name,
      color: GRAPH_COLORS[index % GRAPH_COLORS.length],
      points: (plant.waterLog ?? [])
        .slice()
        .sort((a, b) => new Date(a.at) - new Date(b.at))
        .map((entry, pointIndex) => ({
          x: new Date(entry.at).getTime(),
          y: pointIndex + 1,
          label: entry.at
        }))
    }))
    .filter((plant) => plant.points.length > 0);

  graphChart.innerHTML = "";
  graphLegend.innerHTML = "";

  if (series.length === 0) {
    graphEmpty.classList.remove("hidden");
    return;
  }

  graphEmpty.classList.add("hidden");

  const allPoints = series.flatMap((plant) => plant.points);
  let minX = Math.min(...allPoints.map((point) => point.x));
  let maxX = Math.max(...allPoints.map((point) => point.x));
  const maxY = Math.max(...allPoints.map((point) => point.y), 1);

  if (minX === maxX) {
    minX -= 12 * 60 * 60 * 1000;
    maxX += 12 * 60 * 60 * 1000;
  }

  const width = 640;
  const height = 340;
  const padding = { top: 24, right: 24, bottom: 44, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xToSvg = (value) => padding.left + ((value - minX) / (maxX - minX)) * chartWidth;
  const yToSvg = (value) => padding.top + chartHeight - (value / Math.max(maxY, 1)) * chartHeight;

  const xTicks = [minX, minX + (maxX - minX) / 2, maxX];
  const yTicks = Array.from({ length: maxY + 1 }, (_, index) => index);

  const lines = series.map((plant) => {
    const points = plant.points.map((point) => `${xToSvg(point.x).toFixed(1)},${yToSvg(point.y).toFixed(1)}`).join(" ");
    const circles = plant.points
      .map((point) => `<circle cx="${xToSvg(point.x).toFixed(1)}" cy="${yToSvg(point.y).toFixed(1)}" r="4" fill="${plant.color}" />`)
      .join("");

    return `
      <polyline fill="none" stroke="${plant.color}" stroke-width="3" points="${points}" stroke-linecap="round" stroke-linejoin="round" />
      ${circles}
    `;
  }).join("");

  const yGrid = yTicks.map((tick) => {
    const y = yToSvg(tick).toFixed(1);
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e8e3d3" stroke-width="1" />`;
  }).join("");

  const xLabels = xTicks.map((tick) => {
    const x = xToSvg(tick).toFixed(1);
    const label = new Date(tick).toLocaleDateString();
    return `<text x="${x}" y="${height - 12}" text-anchor="middle" font-size="12" fill="#4c5643">${escapeHtml(label)}</text>`;
  }).join("");

  const yLabels = yTicks.map((tick) => {
    const y = yToSvg(tick).toFixed(1);
    return `<text x="${padding.left - 12}" y="${Number(y) + 4}" text-anchor="end" font-size="12" fill="#4c5643">${tick}</text>`;
  }).join("");

  graphChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Watering history line graph">
      ${yGrid}
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#7e876f" stroke-width="1.5" />
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#7e876f" stroke-width="1.5" />
      ${lines}
      ${xLabels}
      ${yLabels}
      <text x="${width / 2}" y="${height - 2}" text-anchor="middle" font-size="12" fill="#4c5643">Time</text>
      <text x="16" y="${height / 2}" text-anchor="middle" font-size="12" fill="#4c5643" transform="rotate(-90 16 ${height / 2})">Total times watered</text>
    </svg>
  `;

  series.forEach((plant) => {
    const item = document.createElement("div");
    item.className = "graph-legend-item";
    item.innerHTML = `<span class="graph-legend-swatch" style="background:${plant.color}"></span><span>${escapeHtml(plant.name)}</span>`;
    graphLegend.appendChild(item);
  });
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

  return "Give bright indirect light or sun depending on the plant, keep temperatures moderate, and water when the top inch of soil is dry. Adjust based on wilting versus soggy soil.";
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


