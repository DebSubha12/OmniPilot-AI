/**
 * validator.js
 * ------------------------------------------------------------------
 * Centralized input validation & sanitization for every agent tool call.
 * No agent ever receives raw, unvalidated user input. This is the first
 * line of defense in OmniPilot AI's security model.
 * ------------------------------------------------------------------
 */

const MAX_STRING_LEN = 2000;
const MAX_ARRAY_LEN = 200;

/** Strip HTML/script tags, control characters, and clamp length. */
function sanitizeString(value, maxLen = MAX_STRING_LEN) {
  if (typeof value !== "string") return "";
  let out = value
    .replace(/<[^>]*>/g, "")           // strip HTML/script tags
    .replace(/[\u0000-\u001F\u007F]/g, "") // strip control chars
    .trim();
  if (out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidDateString(v) {
  if (!isNonEmptyString(v)) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

/** Generic schema-based validator. Returns { valid, errors, data } */
function validateSchema(input, schema) {
  const errors = [];
  const data = {};

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: false, errors: ["Input must be a JSON object."], data: null };
  }

  for (const [key, rule] of Object.entries(schema)) {
    const raw = input[key];

    if (raw === undefined || raw === null) {
      if (rule.required) {
        errors.push(`Missing required field: "${key}"`);
      } else if (rule.default !== undefined) {
        data[key] = rule.default;
      }
      continue;
    }

    switch (rule.type) {
      case "string": {
        if (typeof raw !== "string") {
          errors.push(`Field "${key}" must be a string.`);
          break;
        }
        const clean = sanitizeString(raw, rule.maxLen);
        if (rule.required && clean.length === 0) {
          errors.push(`Field "${key}" cannot be empty.`);
        }
        data[key] = clean;
        break;
      }
      case "number": {
        const num = typeof raw === "number" ? raw : Number(raw);
        if (!isFiniteNumber(num)) {
          errors.push(`Field "${key}" must be a valid number.`);
          break;
        }
        if (rule.min !== undefined && num < rule.min) {
          errors.push(`Field "${key}" must be >= ${rule.min}.`);
          break;
        }
        if (rule.max !== undefined && num > rule.max) {
          errors.push(`Field "${key}" must be <= ${rule.max}.`);
          break;
        }
        data[key] = num;
        break;
      }
      case "date": {
        if (!isValidDateString(raw)) {
          errors.push(`Field "${key}" must be a valid date string.`);
          break;
        }
        data[key] = raw;
        break;
      }
      case "array": {
        if (!Array.isArray(raw)) {
          errors.push(`Field "${key}" must be an array.`);
          break;
        }
        if (raw.length > (rule.maxLen || MAX_ARRAY_LEN)) {
          errors.push(`Field "${key}" exceeds max length of ${rule.maxLen || MAX_ARRAY_LEN}.`);
          break;
        }
        if (rule.items === "string") {
          data[key] = raw.map((v) => sanitizeString(String(v), 300)).filter(Boolean);
        } else if (rule.items === "object" && rule.itemSchema) {
          const items = [];
          for (const item of raw) {
            const sub = validateSchema(item, rule.itemSchema);
            if (!sub.valid) {
              errors.push(`Invalid item in "${key}": ${sub.errors.join("; ")}`);
            } else {
              items.push(sub.data);
            }
          }
          data[key] = items;
        } else {
          data[key] = raw;
        }
        break;
      }
      case "enum": {
        if (!rule.values.includes(raw)) {
          errors.push(`Field "${key}" must be one of: ${rule.values.join(", ")}`);
          break;
        }
        data[key] = raw;
        break;
      }
      default:
        data[key] = raw;
    }
  }

  return { valid: errors.length === 0, errors, data };
}

module.exports = {
  sanitizeString,
  isNonEmptyString,
  isFiniteNumber,
  isValidDateString,
  validateSchema,
};
