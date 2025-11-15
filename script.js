// Get all Mondays in a given month
function getMondaysInMonth(year, month, startDate = null) {
  let mondays = [];
  const date = new Date(year, month, 1);
  while (date.getDay() !== 1) {
    date.setDate(date.getDate() + 1);
  }
  while (date.getMonth() === month) {
    if (!startDate || date >= startDate) {
      mondays.push(new Date(date));
    }
    date.setDate(date.getDate() + 7);
  }
  return mondays;
}

function populateOptions() {
  const today = new Date();
  const slot18 = document.getElementById("slot18");
  const slot19 = document.getElementById("slot19");

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Mondays this month
  const mondaysThisMonth = getMondaysInMonth(currentYear, currentMonth, today);

  // Mondays next month
  let nextMonth = currentMonth + 1;
  let nextYear = currentYear;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear++;
  }
  const mondaysNextMonth = getMondaysInMonth(nextYear, nextMonth);

  const allMondays = mondaysThisMonth.concat(mondaysNextMonth);

  allMondays.forEach((monday) => {
    const dateStr = monday.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    // 18:00 All Levels class
    const option18 = document.createElement("option");
    option18.value = `${dateStr} 18:00 - Group All Levels (Reformer, 10–15 €)`;
    option18.textContent = dateStr;
    slot18.appendChild(option18);

    // 19:00 Trio class
    const option19 = document.createElement("option");
    option19.value = `${dateStr} 19:00 - Trio with Experience (Cadillac, Chair, Ladder Barrel, Reformer, 20–30 €)`;
    option19.textContent = dateStr;
    slot19.appendChild(option19);
  });
}

populateOptions();

// Handle form submission
const form = document.getElementById("bookingForm");
form.addEventListener("submit", function (e) {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const slot18 = document.getElementById("slot18").value;
  const slot19 = document.getElementById("slot19").value;

  const chosenSlot = slot18 || slot19;
  if (!chosenSlot) {
    document.getElementById("message").textContent = "⚠️ Please select a class date.";
    return;
  }

  fetch("https://script.google.com/macros/s/AKfycbxOOWFiDDiqbeDkjPogoWZx4ItJ0UrpfBj_LRPVVhg3bPORuejjfXZ_f0WrYvgkm7G9/exec", {
    method: "POST",
    body: JSON.stringify({ name, email, phone, slot: chosenSlot }),
  })
    .then((response) => response.json())
    .then((data) => {
      document.getElementById("message").textContent = "✅ Booking confirmed for " + chosenSlot;
      form.reset();
    })
    .catch((error) => {
      document.getElementById("message").textContent = "❌ Error. Please try again.";
    });
});
