const asyncHandler = require("express-async-handler");
const User = require("../models/UserModel");
const Order = require("../models/OrderModel");
const Product = require("../models/ProductsModel");
const Brand = require("../models/BrandModel");
const Category = require("../models/CategoryModel");

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/dashboard/stats
 * @access  Admin
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    // Get date range for comparison (default: last 30 days vs previous 30 days)
    const { days = 30 } = req.query;
    const now = new Date();
    const currentPeriodStart = new Date(
      now.getTime() - days * 24 * 60 * 60 * 1000
    );
    const previousPeriodStart = new Date(
      currentPeriodStart.getTime() - days * 24 * 60 * 60 * 1000
    );

    // Parallel execution for better performance
    const [
      // Current period stats
      currentOrders,
      currentRevenue,
      currentUsers,
      totalProducts,
      totalCategories,
      totalBrands,

      // Previous period stats for comparison
      previousOrders,
      previousRevenue,
      previousUsers,

      // Recent orders for display
      recentOrders,

      // Order status breakdown
      orderStatusStats,

      // Monthly revenue trend (last 6 months)
      monthlyRevenue,
    ] = await Promise.all([
      // Current period
      Order.countDocuments({
        createdAt: { $gte: currentPeriodStart },
      }),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: currentPeriodStart },
            status: {
              $in: ["delivered", "confirmed", "processing", "shipped"],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalAmount" },
          },
        },
      ]),
      User.countDocuments({
        createdAt: { $gte: currentPeriodStart },
      }),
      Product.countDocuments(),
      Category.countDocuments(),
      Brand.countDocuments(),

      // Previous period
      Order.countDocuments({
        createdAt: {
          $gte: previousPeriodStart,
          $lt: currentPeriodStart,
        },
      }),
      Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: previousPeriodStart,
              $lt: currentPeriodStart,
            },
            status: {
              $in: ["delivered", "confirmed", "processing", "shipped"],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalAmount" },
          },
        },
      ]),
      User.countDocuments({
        createdAt: {
          $gte: previousPeriodStart,
          $lt: currentPeriodStart,
        },
      }),

      // Recent orders
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate({
          path: "user",
          select: "name email",
        })
        .populate({
          path: "items.product",
          select: "name",
        }),

      // Order status breakdown
      Order.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" },
          },
        },
      ]),

      // Monthly revenue trend (last 6 months)
      Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000),
            },
            status: {
              $in: ["delivered", "confirmed", "processing", "shipped"],
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 },
        },
      ]),
    ]);

    // Calculate percentage changes
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return (((current - previous) / previous) * 100).toFixed(1);
    };

    const currentRevenueAmount = currentRevenue[0]?.total || 0;
    const previousRevenueAmount = previousRevenue[0]?.total || 0;

    // Calculate total revenue
    const totalRevenueResult = await Order.aggregate([
      {
        $match: {
          status: { $in: ["delivered", "confirmed", "processing", "shipped"] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]);
    const totalRevenue = totalRevenueResult[0]?.total || 0;

    // Calculate total orders
    const totalOrders = await Order.countDocuments();

    // Calculate total customers
    const totalCustomers = await User.countDocuments({ role: "user" });

    // Format stats for frontend
    const stats = {
      revenue: {
        total: totalRevenue,
        current: currentRevenueAmount,
        change: calculateChange(currentRevenueAmount, previousRevenueAmount),
        formatted: `$${totalRevenue.toLocaleString()}`,
      },
      orders: {
        total: totalOrders,
        current: currentOrders,
        change: calculateChange(currentOrders, previousOrders),
        formatted: totalOrders.toLocaleString(),
      },
      products: {
        total: totalProducts,
        formatted: totalProducts.toLocaleString(),
      },
      customers: {
        total: totalCustomers,
        current: currentUsers,
        change: calculateChange(currentUsers, previousUsers),
        formatted: totalCustomers.toLocaleString(),
      },
      categories: {
        total: totalCategories,
      },
      brands: {
        total: totalBrands,
      },
    };

    // Format recent orders
    const formattedRecentOrders = recentOrders.map((order) => ({
      id: order.orderNumber || order._id,
      customer: order.user?.name || "N/A",
      email: order.user?.email || "N/A",
      amount: `$${order.totalAmount.toFixed(2)}`,
      status: order.status,
      date: order.createdAt.toISOString().split("T")[0],
      items: order.items.length,
    }));

    // Format order status stats
    const formattedOrderStats = orderStatusStats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        amount: stat.totalAmount,
      };
      return acc;
    }, {});

    // Format monthly revenue for charts
    const formattedMonthlyRevenue = monthlyRevenue.map((item) => ({
      month: `${item._id.year}-${item._id.month.toString().padStart(2, "0")}`,
      revenue: item.revenue,
      orders: item.orders,
    }));

    res.status(200).json({
      success: true,
      data: {
        stats,
        recentOrders: formattedRecentOrders,
        orderStats: formattedOrderStats,
        monthlyRevenue: formattedMonthlyRevenue,
        period: {
          days: parseInt(days),
          currentStart: currentPeriodStart,
          previousStart: previousPeriodStart,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
      error: error.message,
    });
  }
});

/**
 * @desc    Get recent activity for dashboard
 * @route   GET /api/dashboard/activity
 * @access  Admin
 */
const getRecentActivity = asyncHandler(async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get recent orders, new users, and other activities
    const [recentOrders, newUsers, recentProducts] = await Promise.all([
      Order.find()
        .sort({ createdAt: -1 })
        .limit(parseInt(limit) / 3)
        .populate("user", "name email")
        .select("orderNumber status totalAmount createdAt user"),

      User.find({ role: "user" })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit) / 3)
        .select("name email createdAt"),

      Product.find()
        .sort({ createdAt: -1 })
        .limit(parseInt(limit) / 3)
        .select("name slug createdAt"),
    ]);

    // Combine and format activities
    const activities = [
      ...recentOrders.map((order) => ({
        type: "order",
        title: `New order ${order.orderNumber}`,
        description: `Order placed by ${order.user?.name || "Unknown"} - $${
          order.totalAmount
        }`,
        timestamp: order.createdAt,
        status: order.status,
      })),
      ...newUsers.map((user) => ({
        type: "user",
        title: "New customer registered",
        description: `${user.name} (${user.email}) joined`,
        timestamp: user.createdAt,
      })),
      ...recentProducts.map((product) => ({
        type: "product",
        title: "New product added",
        description: `${product.name} was added to catalog`,
        timestamp: product.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));

    res.status(200).json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error("Recent activity error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recent activity",
      error: error.message,
    });
  }
});

module.exports = {
  getDashboardStats,
  getRecentActivity,
};
