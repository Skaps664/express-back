/**
 * Validates if the provided ID is a valid MongoDB ObjectId format
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid, throws error if invalid
 */
function validateMongoId(id) {
  if (!id || typeof id !== "string" || !/^[a-fA-F0-9]{24}$/.test(id)) {
    throw new Error("Invalid MongoDB ObjectId");
  }
  return true;
}

module.exports = validateMongoId;
