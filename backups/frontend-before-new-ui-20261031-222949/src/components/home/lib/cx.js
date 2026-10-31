
/** Joins class names, skipping anything falsy. */
const cx = (...items) => items.filter(Boolean).join(" ");

export default cx;
