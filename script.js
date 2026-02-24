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

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7pPKmyxkjuKnU0BshXLpKc9PUHtMvRc8czQb7gWNGTBIvLZX1L5nfRiYqeah0FnGddLomYpgtsSLw/pub?gid=0&single=true&output=csv";
const TRIO_LABEL = "Trio with Experience (Cadillac, Chair, Ladder Barrel, Reformer, 20–30 €)";
const TRIO_LABEL_BASE = "Trio with Experience (Cadillac, Chair, Ladder Barrel, Reformer";
const TRIO_LABEL_MARKER = "trio with experience";
const TRIO_TIMES = ["19:00", "20:00"];
const TRIO_CAPACITY = 3;

function populateOptions() {
  const today = new Date();
  const slot19 = document.getElementById("slot19");
  const slot20 = document.getElementById("slot20");

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

    // 19:00 Trio class
    const option19 = document.createElement("option");
    option19.value = `${dateStr} 19:00 - ${TRIO_LABEL}`;
    option19.textContent = dateStr;
    slot19.appendChild(option19);

    // 20:00 Trio class
    const option20 = document.createElement("option");
    option20.value = `${dateStr} 20:00 - ${TRIO_LABEL}`;
    option20.textContent = dateStr;
    slot20.appendChild(option20);
  });
}

populateOptions();
markFullTrioClasses();

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/);
  if (rows.length <= 1) {
    return [];
  }
  const splitRegex = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
  const headers = rows[0].split(splitRegex).map((h) => h.replace(/^"|"$/g, "").trim());
  return rows
    .slice(1)
    .filter((row) => row.trim().length > 0)
    .map((row) => {
      const cells = row.split(splitRegex).map((cell) => cell.replace(/^"|"$/g, "").trim());
      const entry = {};
      headers.forEach((header, idx) => {
        entry[header] = cells[idx] || "";
      });
      return entry;
    });
}

async function isTrioSlotAvailable(slotValue) {
  const cacheBustedUrl = `${SHEET_CSV_URL}&cb=${Date.now()}`;
  const response = await fetch(cacheBustedUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to fetch sheet data");
  }
  const csvText = await response.text();
  const counts = countTrioBookingsFromCsv(csvText);
  const key = getTrioKey(slotValue);
  if (!key) {
    return true;
  }
  return (counts[key] || 0) < TRIO_CAPACITY;
}

async function markFullTrioClasses() {
  try {
    const cacheBustedUrl = `${SHEET_CSV_URL}&initial=${Date.now()}`;
    const response = await fetch(cacheBustedUrl, { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const csvText = await response.text();
    const counts = countTrioBookingsFromCsv(csvText);
    ["slot19", "slot20"].forEach((id) => {
      const select = document.getElementById(id);
      if (!select) {
        return;
      }
      Array.from(select.options).forEach((option) => {
        if (!option.value) {
          return;
        }
        const key = getTrioKey(option.value);
        if (!key) {
          return;
        }
        if ((counts[key] || 0) >= TRIO_CAPACITY) {
          option.disabled = true;
          option.textContent = `${option.textContent} (Full)`;
        }
      });
    });
  } catch (error) {
    console.error("Failed to mark full trio classes", error);
  }
}

function countTrioBookings(bookings) {
  const counts = {};
  bookings.forEach((entry) => {
    const slotText = getSlotValue(entry);
    const key = getTrioKey(slotText);
    if (!key) {
      return;
    }
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function countTrioBookingsFromCsv(csvText) {
  const rows = csvText.trim().split(/\r?\n/);
  if (rows.length <= 1) {
    return {};
  }
  const counts = {};
  // Some sheets have a header row, some do not.
  // We safely iterate ALL rows and only count lines that actually
  // look like a Trio booking (they contain TRIO_LABEL_MARKER and a date+time).
  rows.forEach((row) => {
    const normalized = normalizeText(row);
    if (!normalized.includes(TRIO_LABEL_MARKER)) {
      return;
    }
    const match = normalized.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})\s+(\d{2}:\d{2})/);
    if (!match) {
      return;
    }
    const datePart = `${match[1]} ${match[2]} ${match[3]}`;
    const timePart = match[4];
    if (!TRIO_TIMES.includes(timePart)) {
      return;
    }
    const isoDate = parseDateKey(datePart);
    if (!isoDate) {
      return;
    }
    const key = `${isoDate}-${timePart}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function getTrioKey(slotText) {
  if (!slotText) {
    return null;
  }
  const normalized = normalizeText(slotText);
  if (!normalized.includes(TRIO_LABEL_MARKER)) {
    return null;
  }
  const match = normalized.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})\s+(\d{2}:\d{2})/);
  if (!match) {
    return null;
  }
  const datePart = `${match[1]} ${match[2]} ${match[3]}`.trim();
  const timePart = match[4];
  if (!TRIO_TIMES.includes(timePart)) {
    return null;
  }
  const isoDate = parseDateKey(datePart);
  if (!isoDate) {
    return null;
  }
  return `${isoDate}-${timePart}`;
}

function getSlotValue(entry) {
  if (entry.Slot) {
    return entry.Slot;
  }
  const key = Object.keys(entry).find((k) => k.trim().toLowerCase() === "slot");
  if (key && entry[key]) {
    return entry[key];
  }
  const values = Object.values(entry);
  const match = values.find((value) => normalizeText(value).includes(TRIO_LABEL_MARKER));
  return match || "";
}

function includesNormalizedLabel(text, label) {
  return normalizeText(text).includes(normalizeText(label));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/â€“|â€”/g, "-")
    .replace(/â‚¬/g, "€")
    .replace(/[–—]/g, "-")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateKey(dateText) {
  const match = dateText.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const monthText = match[2].toLowerCase();
  const year = Number(match[3]);
  const monthIndex = getMonthIndex(monthText);
  if (!Number.isFinite(day) || !Number.isFinite(year) || monthIndex === null) {
    return null;
  }
  const date = new Date(Date.UTC(year, monthIndex, day));
  return date.toISOString().split("T")[0];
}

function getMonthIndex(monthText) {
  const map = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };
  return Object.prototype.hasOwnProperty.call(map, monthText) ? map[monthText] : null;
}

// Handle form submission
const form = document.getElementById("bookingForm");
form.addEventListener("submit", async function (e) {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const slot19 = document.getElementById("slot19").value;
  const slot20 = document.getElementById("slot20").value;

  const chosenSlot = slot19 || slot20;
  if (!chosenSlot) {
    document.getElementById("message").textContent = "⚠️ Please select a class date.";
    return;
  }

  const trioKey = getTrioKey(chosenSlot);
  if (trioKey) {
    document.getElementById("message").textContent = "Checking availability...";
    try {
      const available = await isTrioSlotAvailable(chosenSlot);
      if (!available) {
        document.getElementById("message").textContent =
          "⚠️ Sorry, that class already has 3 bookings.";
        return;
      }
    } catch (err) {
      document.getElementById("message").textContent =
        "❌ Could not verify availability. Please try again.";
      return;
    }
  }

  // Send as URL-encoded form data so the Apps Script can read e.parameter values
  const payload = new URLSearchParams({ name, email, phone, slot: chosenSlot });

  try {
    const response = await fetch(
      "https://script.google.com/macros/s/AKfycbzg-krqF9oVBq1rRniX_lzSPz1ajoKtCkwysscDtABZ66DmzOJp7yhaWGyuvCqVtr-W/exec",
      {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload.toString(),
      }
    );

    // Apps Script sometimes returns opaque responses; treat them as success
    const isOpaque = response.type === "opaque";
    const isOk = response.ok || isOpaque;

    if (isOk) {
      const contentType = response.headers?.get("content-type") || "";
      if (contentType.includes("application/json")) {
        await response.json();
      } else {
        await response.text();
      }
      document.getElementById("message").textContent = "✅ Booking confirmed for " + chosenSlot;
      form.reset();
      return;
    }

    const errorText = await response.text().catch(() => "");
    throw new Error(`Request failed: ${response.status} ${response.statusText} ${errorText}`);
  } catch (error) {
    console.error("Booking submission failed", error);
    document.getElementById("message").textContent =
      "❌ Error. Please try again or contact us directly.";
  }
});
