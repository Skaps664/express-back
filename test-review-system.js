const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, 'config.env') });

// Import models
const Order = require('./models/OrderModel');
const Product = require('./models/ProductsModel');
const Review = require('./models/ReviewModel');
const User = require('./models/UserModel');

// Test review system functionality
async function testReviewSystem() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.DB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Find a delivered order
    console.log('\n📦 Looking for delivered orders...');
    const deliveredOrders = await Order.find({ 
      orderStatus: 'Delivered' 
    })
    .populate('orderItems.product')
    .populate('user')
    .limit(5);
    
    console.log(`Found ${deliveredOrders.length} delivered orders`);
    
    if (deliveredOrders.length > 0) {
      const order = deliveredOrders[0];
      console.log(`\nOrder ID: ${order._id}`);
      console.log(`User: ${order.user?.firstname} ${order.user?.lastname}`);
      console.log(`Items: ${order.orderItems.length}`);
      
      // Show order items
      order.orderItems.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.product?.title} (Qty: ${item.quantity})`);
        console.log(`     Already reviewed: ${item.reviewed || false}`);
      });
    }

    // 2. Check existing reviews
    console.log('\n⭐ Checking existing reviews...');
    const totalReviews = await Review.countDocuments();
    console.log(`Total reviews in database: ${totalReviews}`);
    
    if (totalReviews > 0) {
      const recentReviews = await Review.find()
        .populate('user', 'firstname lastname')
        .populate('product', 'title')
        .sort({ createdAt: -1 })
        .limit(3);
        
      console.log('\nRecent reviews:');
      recentReviews.forEach((review, index) => {
        console.log(`  ${index + 1}. ${review.user?.firstname} reviewed "${review.product?.title}"`);
        console.log(`     Rating: ${review.rating}/5, Comment: "${review.comment}"`);
        console.log(`     Verified Purchase: ${review.verifiedPurchase}`);
      });
    }

    // 3. Check products with reviews
    console.log('\n🛍️ Checking products with reviews...');
    const productsWithReviews = await Product.aggregate([
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'product',
          as: 'reviews'
        }
      },
      {
        $match: {
          'reviews.0': { $exists: true }
        }
      },
      {
        $project: {
          title: 1,
          reviewCount: { $size: '$reviews' },
          avgRating: { $avg: '$reviews.rating' }
        }
      },
      {
        $sort: { reviewCount: -1 }
      },
      {
        $limit: 5
      }
    ]);

    console.log(`Found ${productsWithReviews.length} products with reviews:`);
    productsWithReviews.forEach((product, index) => {
      console.log(`  ${index + 1}. ${product.title}`);
      console.log(`     Reviews: ${product.reviewCount}, Avg Rating: ${product.avgRating?.toFixed(1) || 'N/A'}/5`);
    });

    // 4. Test review eligibility for a user
    if (deliveredOrders.length > 0) {
      const testOrder = deliveredOrders[0];
      const userId = testOrder.user._id;
      
      console.log(`\n🔍 Checking review eligibility for user ${userId}...`);
      
      // Find eligible products (delivered but not reviewed)
      const eligibleProducts = await Order.aggregate([
        {
          $match: {
            user: userId,
            orderStatus: 'Delivered'
          }
        },
        {
          $unwind: '$orderItems'
        },
        {
          $match: {
            'orderItems.reviewed': { $ne: true }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'orderItems.product',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $unwind: '$product'
        },
        {
          $project: {
            orderId: '$_id',
            orderItemId: '$orderItems._id',
            productId: '$product._id',
            productTitle: '$product.title',
            quantity: '$orderItems.quantity',
            deliveredAt: '$deliveredAt'
          }
        }
      ]);

      console.log(`User has ${eligibleProducts.length} products eligible for review:`);
      eligibleProducts.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.productTitle} (Order: ${item.orderId})`);
      });
    }

    console.log('\n✅ Review system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the test
testReviewSystem();