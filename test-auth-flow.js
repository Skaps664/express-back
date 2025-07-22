const axios = require("axios");

async function testAuthFlow() {
  console.log("🧪 Testing Complete Authentication Flow");
  console.log("=====================================");

  const baseURL = "http://localhost:3000";

  try {
    // Test 1: Login
    console.log("1️⃣ Testing Login...");
    const loginResponse = await axios.post(
      `${baseURL}/api/user/login`,
      {
        email: "adnantfw@gmail.com",
        password: "123456",
      },
      {
        withCredentials: true,
        timeout: 10000,
      }
    );

    console.log("✅ Login successful!");
    console.log("📧 User:", loginResponse.data.email);
    console.log("👑 Admin:", loginResponse.data.isAdmin);
    console.log(
      "🍪 Cookies received:",
      loginResponse.headers["set-cookie"] ? "Yes" : "No"
    );

    // Extract cookies for next requests
    const cookies = loginResponse.headers["set-cookie"];

    // Test 2: Access protected endpoint
    console.log("\n2️⃣ Testing Protected Endpoint (/api/user/me)...");
    const meResponse = await axios.get(`${baseURL}/api/user/me`, {
      headers: {
        Cookie: cookies?.join("; ") || "",
      },
      timeout: 10000,
    });

    console.log("✅ Protected endpoint accessible!");
    console.log("👤 User data:", meResponse.data.user?.email);

    // Test 3: Test cart access
    console.log("\n3️⃣ Testing Cart Access...");
    const cartResponse = await axios.get(`${baseURL}/api/cart`, {
      headers: {
        Cookie: cookies?.join("; ") || "",
      },
      timeout: 10000,
    });

    console.log("✅ Cart accessible!");
    console.log("🛒 Cart items:", cartResponse.data.cart?.length || 0);

    console.log("\n🎉 All authentication tests passed!");
    console.log("✅ Login works");
    console.log("✅ Session persistence works");
    console.log("✅ Protected endpoints accessible");
    console.log("✅ Cart functionality works");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
  }
}

testAuthFlow();
