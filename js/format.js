export function sheetText(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (Number.isInteger(value) || Math.round(value) === value) return String(Math.round(value));
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-US");
  }
  let text = String(value).trim();
  if (/e[+-]?\d+$/i.test(text)) {
    const number = Number(text);
    if (Number.isFinite(number) && Math.round(number) === number) return String(Math.round(number));
  }
  if (/^-?\d+\.0+$/.test(text)) return text.replace(/\.0+$/, "");
  return text;
}

export function formatCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return String(Math.round(number));
}

export function formatPhone(value) {
  const raw = sheetText(value);
  if (!raw) return "";
  const plus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (plus && digits && digits[0] !== "1") return `+${digits}`;
  if (digits.length === 11 && digits[0] === "1") digits = digits.slice(1);
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return raw;
}

export function formatPostal(value) {
  const raw = sheetText(value);
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 4) digits = `0${digits}`;
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  if (digits.length === 5) return digits;
  return raw;
}

export function formatGroupCode(value) {
  const raw = sheetText(value);
  if (!raw) return "";
  return /^\d+$/.test(raw) ? raw : raw.toUpperCase();
}

export function formatGuest(row) {
  const group = formatGroupCode(row.group_code || row.access_code);
  return {
    ...row,
    party: sheetText(row.party),
    access_code: group,
    group_code: group,
    first_name: sheetText(row.first_name),
    last_name: sheetText(row.last_name),
    phone: formatPhone(row.phone),
    email: sheetText(row.email),
    street: sheetText(row.street),
    apt: sheetText(row.apt),
    city: sheetText(row.city),
    region: sheetText(row.region),
    postal: formatPostal(row.postal),
  };
}
