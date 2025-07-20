const jwt = require("jsonwebtoken");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

module.exports = { generateToken };
// This code exports a function that generates a JWT token using the user's ID and a secret key from the environment variables.
// The token is set to expire in 7 days. This function can be used in user authentication processes to create tokens for logged-in users.
