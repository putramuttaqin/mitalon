const searchInput = document.getElementById("searchInput");
const listItems = document.querySelectorAll(".peserta");

function filterList(keyword) {
  const lowerKeyword = keyword.toLowerCase();
  listItems.forEach(item => {
    const name = item.querySelector(".attendee-name").textContent.toLowerCase();
    item.classList.toggle("hidden", !name.includes(lowerKeyword));
  });
}

searchInput.addEventListener("input", () => {
  filterList(searchInput.value);
});

searchInput.addEventListener("focus", () => {
  searchInput.value = '';
  filterList('');
});