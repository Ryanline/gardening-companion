const plantList = document.getElementById("plant-list");
const addPlantBtn = document.getElementById("add-plant-btn");
const openGraphBtn = document.getElementById("open-graph-btn");
const plantPickerBackdrop = document.getElementById("plant-picker-backdrop");
const plantPickerModal = document.getElementById("plant-picker-modal");
const plantPickerOptions = document.getElementById("plant-picker-options");

const STORAGE_KEY = "gardenCompanion.v14.plants";
const GRID_MIN_SLOTS = 9;
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
const IMAGE_CACHE_KEY = "gardenCompanion.v14.imageCache";
const COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php";
const COMMONS_THUMB_WIDTH = 1200;
const WATERING_TIMELINE_WEEKS = 6;

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
let pendingPlantSlotIndex = null;
let plants = loadPlants();
let imageCache = loadImageCache();
const pendingImageRequests = new Set();

renderPlantPickerOptions();
renderPlants();
hydratePlantImages();
window.addEventListener("resize", refreshGardenLayout);

addPlantBtn.addEventListener("click", () => openPlantPicker(null));
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
  if (!raw) return createEmptyGarden();

  try {
    const parsed = JSON.parse(raw);
    return normalizePlants(parsed);
  } catch {
    return createEmptyGarden();
  }
}

function savePlants() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
}

function createEmptyGarden(size = GRID_MIN_SLOTS) {
  return Array.from({ length: size }, () => null);
}

function normalizePlants(value) {
  if (!Array.isArray(value)) return createEmptyGarden();
  const slots = value.map((plant) => (plant && typeof plant === "object" ? plant : null));
  while (slots.length < GRID_MIN_SLOTS) {
    slots.push(null);
  }
  return slots;
}

function countPlants() {
  return plants.filter(Boolean).length;
}

function getFirstEmptySlotIndex() {
  return plants.findIndex((plant) => !plant);
}

function getDisplaySlots() {
  const slots = plants.slice();
  while (slots.length < GRID_MIN_SLOTS) {
    slots.push(null);
  }
  if (!slots.some((plant) => plant === null)) {
    slots.push(null);
  }
  return slots;
}

function ensureSlotExists(slotIndex) {
  while (plants.length <= slotIndex) {
    plants.push(null);
  }
}

function renderPlantPickerOptions() {
  plantPickerOptions.innerHTML = "";

  PRESET_PLANT_OPTIONS.forEach((optionName) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "picker-option";
    button.textContent = optionName;
    button.title = `Add ${optionName}`;
    button.addEventListener("click", () => handlePlantOptionSelect(optionName));
    plantPickerOptions.appendChild(button);
  });
}

function handlePlantOptionSelect(optionName) {
  if (optionName === "Custom plant") {
    const customName = prompt("Enter your plant name:");
    if (!customName) return;

    addPlant(customName, pendingPlantSlotIndex);
    return;
  }

  addPlant(optionName, pendingPlantSlotIndex);
}

function addPlant(name, slotIndex = null) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const requestedSlot = Number.isInteger(slotIndex) && slotIndex >= 0 ? slotIndex : null;
  if (requestedSlot != null) {
    ensureSlotExists(requestedSlot);
  }

  const targetSlot = requestedSlot != null && !plants[requestedSlot]
    ? requestedSlot
    : getFirstEmptySlotIndex();

  if (targetSlot === -1) {
    plants.push(null);
    return addPlant(trimmed, plants.length - 1);
  }

  plants[targetSlot] = {
    id: Date.now(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    lastWatered: null,
    waterLog: [],
    photos: [],
    type: ""
  };

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
  const displaySlots = getDisplaySlots();
  plantList.dataset.slotCount = String(displaySlots.length);

  displaySlots.forEach((plant, slotIndex) => {
    const li = document.createElement("li");
    li.className = "garden-slot";

    if (plant) {
      const waterStatus = getWaterStatus(plant);
      const imageUrl = getCachedPlantImage(plant.name);
      const photoClass = imageUrl ? " plant-card--photo" : "";
      const photoStyle = imageUrl
        ? ` style="background-image: linear-gradient(180deg, rgba(18, 28, 14, 0.1), rgba(18, 28, 14, 0.56)), url('${escapeHtml(imageUrl)}');"`
        : "";

      li.innerHTML = `
        <article class="plant-card${photoClass}"${photoStyle}>
          <div class="plant-card-content">
            <button data-action="delete-plant" data-id="${plant.id}" class="plant-delete" aria-label="Delete ${escapeHtml(plant.name)}" title="Delete ${escapeHtml(plant.name)}">&times;</button>

            <div class="plant-title-row">
              <strong class="plant-name">${escapeHtml(plant.name)}</strong>
              <button data-action="open" data-id="${plant.id}" class="info-button" title="More info" aria-label="More info about ${escapeHtml(plant.name)}">
                <img src="assets/info-icon.svg" alt="" />
              </button>
            </div>

            <div class="plant-footer">
              <div class="water-status ${waterStatus.className}">${escapeHtml(waterStatus.text)}</div>
              <button data-action="water" data-id="${plant.id}" class="icon-button watering-button" type="button" title="Log watering for ${escapeHtml(plant.name)}">
                <img src="assets/watering-pail.png" alt="" />
                <span class="sr-only">Log Watering for ${escapeHtml(plant.name)}</span>
              </button>
            </div>
          </div>
        </article>
      `;
    } else {
      li.innerHTML = `
        <div class="empty-plot is-add-slot">
          <button data-action="open-picker" data-slot-index="${slotIndex}" class="icon-button" type="button" title="Add a plant to this spot">
            <img src="assets/new-plant.png" alt="" />
            <span class="sr-only">Add Plant</span>
          </button>
        </div>
      `;
    }

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

  plantList.querySelectorAll("button[data-action='delete-plant']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = Number(e.currentTarget.dataset.id);
      deletePlant(id);
    });
  });

  plantList.querySelectorAll("button[data-action='open-picker']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const slotIndex = Number(e.currentTarget.dataset.slotIndex);
      openPlantPicker(slotIndex);
    });
  });

  hydratePlantImages();
  refreshGardenLayout();
}

function refreshGardenLayout() {
  const displaySlots = getDisplaySlots();
  const slotCount = displaySlots.length;
  const columns = slotCount <= 9 ? 3 : Math.ceil(Math.sqrt(slotCount));
  const rows = Math.ceil(slotCount / columns);
  const gap = slotCount <= 9 ? 16 : 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const availableWidth = Math.min(1100, viewportWidth - 48);
  const gridTop = plantList.getBoundingClientRect().top;
  const availableHeight = Math.max(260, viewportHeight - gridTop - 24);
  const tileFromWidth = (availableWidth - gap * (columns - 1)) / columns;
  const tileFromHeight = (availableHeight - gap * (rows - 1)) / rows;
  const tileSize = Math.max(96, Math.floor(Math.min(tileFromWidth, tileFromHeight)));

  const infoSize = Math.max(26, Math.min(32, Math.round(tileSize * 0.17)));
  const waterSize = Math.max(40, Math.min(50, Math.round(tileSize * 0.27)));
  const iconSize = Math.max(18, Math.min(24, Math.round(waterSize * 0.47)));

  plantList.style.setProperty("--garden-columns", String(columns));
  plantList.style.setProperty("--garden-gap", `${gap}px`);
  plantList.style.setProperty("--tile-size", `${tileSize}px`);
  plantList.style.setProperty("--card-info-size", `${infoSize}px`);
  plantList.style.setProperty("--card-water-size", `${waterSize}px`);
  plantList.style.setProperty("--card-action-icon-size", `${iconSize}px`);
}

function getPlant(plantId) {
  return plants.find((p) => p?.id === plantId) ?? null;
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
  const index = plants.findIndex((plant) => plant?.id === plantId);
  if (index === -1) return;

  pendingDeletedPlant = {
    plant: structuredClone(plants[index]),
    index
  };

  plants[index] = null;
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

  ensureSlotExists(pendingDeletedPlant.index);
  plants[pendingDeletedPlant.index] = pendingDeletedPlant.plant;
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
        <button class="water-log-delete" type="button" aria-label="Delete watering log" title="Delete this watering log">&times;</button>
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

function openPlantPicker(slotIndex = null) {
  pendingPlantSlotIndex = Number.isInteger(slotIndex) ? slotIndex : getFirstEmptySlotIndex();
  if (pendingPlantSlotIndex === -1) {
    pendingPlantSlotIndex = plants.length;
  }
  plantPickerBackdrop.classList.remove("hidden");
  plantPickerModal.classList.remove("hidden");
}

function closePlantPicker() {
  pendingPlantSlotIndex = null;
  plantPickerBackdrop.classList.add("hidden");
  plantPickerModal.classList.add("hidden");
}

function showInsight(text) {
  modalInsight.textContent = text;
  modalInsight.classList.remove("hidden");
}

function renderGraph() {
  const buckets = buildWeeklyBuckets();
  const plantsWithLogs = plants
    .map((plant, index) => ({ plant, index }))
    .filter(({ plant }) => Boolean(plant) && (plant.waterLog?.length ?? 0) > 0)
    .map(({ plant, index }) => ({
      name: plant.name,
      color: GRAPH_COLORS[index % GRAPH_COLORS.length],
      counts: buckets.map(({ start, end }) => {
        const count = (plant.waterLog ?? []).filter((entry) => {
          const at = new Date(entry.at).getTime();
          return at >= start.getTime() && at < end.getTime();
        }).length;
        return count;
      })
    }));

  graphChart.innerHTML = "";
  graphLegend.innerHTML = "";

  if (plantsWithLogs.length === 0) {
    graphEmpty.classList.remove("hidden");
    return;
  }

  graphEmpty.classList.add("hidden");

  const maxY = Math.max(1, ...plantsWithLogs.flatMap((plant) => plant.counts));
  const width = 720;
  const height = 360;
  const padding = { top: 28, right: 18, bottom: 56, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const groupCount = buckets.length;
  const seriesCount = plantsWithLogs.length;
  const groupWidth = chartWidth / groupCount;
  const innerGroupWidth = Math.min(groupWidth * 0.82, 110);
  const barWidth = Math.max(8, innerGroupWidth / Math.max(seriesCount, 1));

  const yToSvg = (value) => padding.top + chartHeight - (value / maxY) * chartHeight;

  const yTicks = Array.from({ length: maxY + 1 }, (_, index) => index);
  const yGrid = yTicks.map((tick) => {
    const y = yToSvg(tick).toFixed(1);
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e8e3d3" stroke-width="1" />`;
  }).join("");

  const bars = plantsWithLogs.map((plant, plantIndex) => {
    return plant.counts.map((count, bucketIndex) => {
      const groupX = padding.left + groupWidth * bucketIndex + (groupWidth - innerGroupWidth) / 2;
      const x = groupX + barWidth * plantIndex + 1;
      const y = yToSvg(count);
      const barHeight = Math.max(0, height - padding.bottom - y);
      const label = `${plant.name}: ${count} watering${count === 1 ? "" : "s"} during ${formatBucketLabel(buckets[bucketIndex].start)}`;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(4, barWidth - 2).toFixed(1)}" height="${barHeight.toFixed(1)}" rx="4" fill="${plant.color}"><title>${escapeHtml(label)}</title></rect>`;
    }).join("");
  }).join("");

  const xLabels = buckets.map((bucket, index) => {
    const x = padding.left + groupWidth * index + groupWidth / 2;
    return `<text x="${x.toFixed(1)}" y="${height - 18}" text-anchor="middle" font-size="12" fill="#4c5643">${escapeHtml(formatBucketLabel(bucket.start))}</text>`;
  }).join("");

  const yLabels = yTicks.map((tick) => {
    const y = yToSvg(tick).toFixed(1);
    return `<text x="${padding.left - 10}" y="${Number(y) + 4}" text-anchor="end" font-size="12" fill="#4c5643">${tick}</text>`;
  }).join("");

  graphChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Weekly watering timeline chart">
      ${yGrid}
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#7e876f" stroke-width="1.5" />
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#7e876f" stroke-width="1.5" />
      ${bars}
      ${xLabels}
      ${yLabels}
      <text x="${width / 2}" y="${height - 2}" text-anchor="middle" font-size="12" fill="#4c5643">Week</text>
      <text x="16" y="${height / 2}" text-anchor="middle" font-size="12" fill="#4c5643" transform="rotate(-90 16 ${height / 2})">Waterings</text>
    </svg>
  `;

  plantsWithLogs.forEach((plant) => {
    const item = document.createElement("div");
    item.className = "graph-legend-item";
    item.innerHTML = `<span class="graph-legend-swatch" style="background:${plant.color}"></span><span>${escapeHtml(plant.name)}</span>`;
    graphLegend.appendChild(item);
  });
}

function buildWeeklyBuckets() {
  const now = new Date();
  const currentWeekStart = startOfWeek(now);
  const buckets = [];

  for (let offset = WATERING_TIMELINE_WEEKS - 1; offset >= 0; offset -= 1) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    buckets.push({ start, end });
  }

  return buckets;
}

function startOfWeek(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function formatBucketLabel(date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function loadImageCache() {
  const raw = localStorage.getItem(IMAGE_CACHE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveImageCache() {
  localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(imageCache));
}

function normalizePlantKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

function getCachedPlantImage(name) {
  const key = normalizePlantKey(name);
  return imageCache[key] ?? null;
}

function hydratePlantImages() {
  plants.filter(Boolean).forEach((plant) => {
    ensurePlantImageForName(plant.name);
  });
}

async function ensurePlantImageForName(name) {
  const key = normalizePlantKey(name);
  if (!key || Object.prototype.hasOwnProperty.call(imageCache, key) || pendingImageRequests.has(key)) {
    return;
  }

  pendingImageRequests.add(key);

  try {
    const imageUrl = await fetchPlantImageUrl(name);
    imageCache[key] = imageUrl;
    saveImageCache();

    if (imageUrl) {
      renderPlants();
    }
  } catch {
    imageCache[key] = null;
    saveImageCache();
  } finally {
    pendingImageRequests.delete(key);
  }
}

async function fetchPlantImageUrl(name) {
  const queries = [`${name} plant`, name];

  for (const query of queries) {
    const params = new URLSearchParams({
      origin: "*",
      action: "query",
      format: "json",
      generator: "search",
      gsrnamespace: "6",
      gsrlimit: "8",
      gsrsearch: query,
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: String(COMMONS_THUMB_WIDTH)
    });

    const response = await fetch(`${COMMONS_API_URL}?${params.toString()}`);
    if (!response.ok) continue;

    const data = await response.json();
    const pages = Object.values(data?.query?.pages ?? {});
    const match = pages.find((page) => {
      const info = page?.imageinfo?.[0];
      const url = info?.thumburl ?? info?.url ?? "";
      const title = String(page?.title ?? "").toLowerCase();
      return url && !url.toLowerCase().endsWith(".svg") && !title.includes("icon") && !title.includes("logo") && !title.includes("diagram");
    });

    if (match) {
      const info = match.imageinfo?.[0];
      return info?.thumburl ?? info?.url ?? null;
    }
  }

  return null;
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




