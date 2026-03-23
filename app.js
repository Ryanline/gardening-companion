const menuToggle = document.getElementById("menu-toggle");
const versionMenu = document.getElementById("version-menu");

if (menuToggle && versionMenu) {
  menuToggle.addEventListener("click", () => {
    const isOpen = !versionMenu.classList.contains("hidden");
    versionMenu.classList.toggle("hidden", isOpen);
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (menuToggle.contains(target) || versionMenu.contains(target)) return;

    versionMenu.classList.add("hidden");
    menuToggle.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    versionMenu.classList.add("hidden");
    menuToggle.setAttribute("aria-expanded", "false");
  });
}