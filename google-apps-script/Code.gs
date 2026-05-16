/**
 * Pilates booking backend — bind this script to your Google Sheet, then deploy
 * as a web app (Execute as: Me, Who has access: Anyone).
 *
 * Capacities:
 *   18:10 Reformer  → 6
 *   19:10 Circuit   → 3
 */

const REFORMER_MARKER = "only reformer";
const REFORMER_TIME = "18:10";
const REFORMER_CAPACITY = 6;

const CIRCUIT_MARKER = "level with experience";
const CIRCUIT_TIME = "19:10";
const CIRCUIT_CAPACITY = 3;

const LEGACY_TRIO_MARKER = "trio with experience";
const LEGACY_TRIO_CAPACITY = 3;

function doPost(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const name = (params.name || "").trim();
    const email = (params.email || "").trim();
    const phone = (params.phone || "").trim();
    const slot = (params.slot || "").trim();

    if (!name || !slot) {
      return jsonResponse({ ok: false, error: "missing_fields" });
    }

    const capacity = getCapacityForSlot(slot);
    if (capacity !== null) {
      const current = countBookingsForSlot(slot);
      if (current >= capacity) {
        return jsonResponse({ ok: false, error: "full", capacity: capacity });
      }
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    sheet.appendRow([new Date(), name, email, phone, slot]);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet() {
  return jsonResponse({ ok: true, message: "Booking endpoint is running." });
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMonthIndex(monthText) {
  const map = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  return Object.prototype.hasOwnProperty.call(map, monthText) ? map[monthText] : null;
}

function parseDateKey(dateText) {
  const match = dateText.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
  if (!match) {
    return null;
  }
  const monthIndex = getMonthIndex(match[2].toLowerCase());
  if (monthIndex === null) {
    return null;
  }
  const date = new Date(Date.UTC(Number(match[3]), monthIndex, Number(match[1])));
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function getSlotKey(slotText, labelMarker, classTime) {
  const normalized = normalizeText(slotText);
  if (!normalized.includes(labelMarker)) {
    return null;
  }
  const match = normalized.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})\s+(\d{2}:\d{2})/);
  if (!match) {
    return null;
  }
  if (match[4] !== classTime) {
    return null;
  }
  const isoDate = parseDateKey(match[1] + " " + match[2] + " " + match[3]);
  if (!isoDate) {
    return null;
  }
  return isoDate + "-" + classTime;
}

function getBookingKey(slotText) {
  const normalized = normalizeText(slotText);
  if (normalized.includes(REFORMER_MARKER)) {
    return getSlotKey(slotText, REFORMER_MARKER, REFORMER_TIME);
  }
  if (normalized.includes(CIRCUIT_MARKER)) {
    return getSlotKey(slotText, CIRCUIT_MARKER, CIRCUIT_TIME);
  }
  if (normalized.includes(LEGACY_TRIO_MARKER)) {
    const match = normalized.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})\s+(\d{2}:\d{2})/);
    if (!match) {
      return null;
    }
    const isoDate = parseDateKey(match[1] + " " + match[2] + " " + match[3]);
    if (!isoDate) {
      return null;
    }
    return isoDate + "-" + match[4];
  }
  return null;
}

function getCapacityForSlot(slotText) {
  const normalized = normalizeText(slotText);
  if (normalized.includes(REFORMER_MARKER) && normalized.includes(REFORMER_TIME)) {
    return REFORMER_CAPACITY;
  }
  if (normalized.includes(CIRCUIT_MARKER) && normalized.includes(CIRCUIT_TIME)) {
    return CIRCUIT_CAPACITY;
  }
  if (normalized.includes(LEGACY_TRIO_MARKER)) {
    return LEGACY_TRIO_CAPACITY;
  }
  return null;
}

function countBookingsForSlot(slotText) {
  const targetKey = getBookingKey(slotText);
  if (!targetKey) {
    return 0;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const values = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 0; i < values.length; i++) {
    const rowSlot = String(values[i][4] || "");
    if (!rowSlot) {
      continue;
    }
    if (getBookingKey(rowSlot) === targetKey) {
      count++;
    }
  }

  return count;
}
