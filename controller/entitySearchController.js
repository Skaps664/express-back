const asyncHandler = require("express-async-handler");
const Analytics = require("../models/AnalyticsModel");
const Product = require("../models/ProductsModel");
const Brand = require("../models/BrandModel");

// Search entities with analytics data
const searchEntities = asyncHandler(async (req, res) => {
  const { search, type = "product" } = req.query;

  if (!search) {
    return res.json({ success: true, data: [] });
  }

  try {
    // Create search regex
    const searchRegex = new RegExp(
      search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"),
      "i"
    );

    // Get the Model based on type
    const Model = type === "product" ? Product : Brand;

    // Search in the respective collection
    const results = await Model.find({
      $or: [
        { name: searchRegex },
        { slug: searchRegex },
        ...(type === "product"
          ? [
              { description: searchRegex },
              { tags: searchRegex },
              { "specifications.items.value": searchRegex },
            ]
          : []),
      ],
    })
      .select("name slug brand category")
      .populate("brand", "name")
      .populate("category", "name")
      .limit(10);

    // Get analytics data for these entities
    const entityIds = results.map((result) => result._id);
    const analyticsData = await Analytics.aggregate([
      {
        $match: {
          entityId: { $in: entityIds },
          entityType: type,
        },
      },
      {
        $group: {
          _id: "$entityId",
          totalViews: { $sum: "$metrics.views" },
        },
      },
    ]);

    // Merge results with analytics data
    const enrichedResults = results.map((result) => {
      const analytics = analyticsData.find(
        (a) => a._id.toString() === result._id.toString()
      );

      return {
        _id: result._id,
        name: result.name,
        slug: result.slug,
        brand: result.brand?.name,
        category: result.category?.name,
        viewCount: analytics?.totalViews || 0,
      };
    });

    // Sort by view count
    enrichedResults.sort((a, b) => b.viewCount - a.viewCount);

    res.json({
      success: true,
      data: enrichedResults,
    });
  } catch (error) {
    console.error("Search entities error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching entities",
    });
  }
});

module.exports = {
  searchEntities,
};
