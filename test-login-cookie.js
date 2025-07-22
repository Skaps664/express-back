const axios = require("axios");

async function testLogin() {
  try {
    console.log("🔧 Testing login with cookie configuration...");

    const response = await axios.post(
      "http://localhost:3000/api/user/login",
      {
        email: "adnantfw@gmail.com",
        password: "admin123",
      },
      {
        withCredentials: true,
      }
    );

    console.log("✅ Login Response:", response.status);
    console.log("🍪 Set-Cookie Headers:");
    if (response.headers["set-cookie"]) {
      response.headers["set-cookie"].forEach((cookie) => {
        console.log("  ", cookie);
      });
    } else {
      console.log("   No cookies set");
    }

    console.log("📝 Response Data:", JSON.stringify(response.data, null, 2));

    // Extract cookies for next request
    const cookies = response.headers["set-cookie"];
    if (cookies) {
      const cookieString = cookies.join("; ");
      console.log("🔄 Testing authenticated request with cookies...");

      // Test add to cart or similar authenticated endpoint
      const cartResponse = await axios.post(
        "http://localhost:3000/api/cart",
        {
          productId: "507f1f77bcf86cd799439011", // dummy product ID
          quantity: 1,
        },
        {
          headers: {
            Cookie: cookieString,
          },
        }
      );

      console.log("🛒 Cart Response:", cartResponse.status);
      console.log("📝 Cart Data:", JSON.stringify(cartResponse.data, null, 2));
    }
  } catch (error) {
    console.error(
      "❌ Error:",
      error.response?.status,
      error.response?.statusText
    );
    console.error("📝 Error Data:", error.response?.data);
    console.error("🍪 Request Cookies:", error.config?.headers?.Cookie);
  }
}

testLogin();
