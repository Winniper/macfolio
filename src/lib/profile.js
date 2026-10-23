// "Debaditya Barman" → "DB": the avatar fallback until a photo is set.
export const initialsOf = (name) =>
    name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
