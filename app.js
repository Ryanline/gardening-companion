const plantList = document.getElementById("plant-list");
const addPlantBtn = document.getElementById("add-plant-btn");

let plants = [];

addPlantBtn.addEventListener("click", () => {
  const name = prompt("Plant name?");
  if (!name) return;

  plants.push({
    id: Date.now(),
    name,
    lastWatered: null
  });

  renderPlants();
});

function renderPlants() {
  plantList.innerHTML = "";

  plants.forEach(plant => {
    const li = document.createElement("li");
    li.className = "plant-card";
    li.innerHTML = `
      <strong>${plant.name}</strong><br/>
      Last watered: ${plant.lastWatered ?? "Never"}
    `;
    plantList.appendChild(li);
  });
}