/**
 * Escapes a user-typed search string so it can be safely dropped into a
 * MongoDB $regex without being interpreted as regex syntax.
 *
 * This matters a lot here specifically because every search box in this
 * app (extension popup, extension vault, admin dashboard) searches live
 * as the employee types, debounced by ~250ms — it queries the *partial*,
 * still-being-typed string on every keystroke, not just the final text.
 *
 * Client/business names very commonly contain regex-special characters
 * — "XYZ Enterprises (P) Ltd", "R.K. & Sons", "Verma [Textiles]" — and
 * the instant an opening bracket/parenthesis is typed but not yet closed,
 * the partial string is an invalid regular expression
 * (e.g. "Sharma & Sons (Text" -> "Unterminated group"). Mongo/Node then
 * throws, the request 500s, and the search silently stops returning
 * anything until the rest of the name is typed — which looks exactly
 * like "search / login detection isn't working".
 *
 * Escaping every regex metacharacter in the raw input makes the term
 * match itself literally, so partial, unbalanced input is always a
 * valid (if sometimes empty) match instead of a crash.
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
