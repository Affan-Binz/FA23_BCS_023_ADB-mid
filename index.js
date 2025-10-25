// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// --- MODEL IMPORTS ---
// We import them here to use in our routes
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Review = require('./models/Review');
const { ObjectId } = mongoose.Types; // Helper for validating IDs
const { Types } = require('mongoose'); // For aggregation

// --- APP & DB SETUP ---
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allows requests from other origins
app.use(express.json()); // Parses incoming JSON payloads

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// --- API ROUTES ---

// Root: Check if server is running
app.get('/', (req, res) => {
  res.send('E-commerce API is running');
});


/*
 * ========================================
 * Q2.2: Implement 3 APIs
 * ========================================
 */

// API 1: /orders/<id>
app.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Order ID' });
    }

    const order = await Order.findById(id)
      .populate('user', 'name email') // Populate user with only name and email
      .populate('items.product', 'name price brand'); // Populate product info

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// API 2: /users/<id>/orders
app.get('/users/:id/orders', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid User ID' });
    }

    // Check if user exists first
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find orders and populate product details
    const orders = await Order.find({ user: id })
      .sort({ createdAt: -1 }) // Show newest orders first
      .populate('items.product', 'name price');

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// API 3: /products/<id>/reviews
app.get('/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Product ID' });
    }

    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Find reviews and populate user details
    const reviews = await Review.find({ product: id })
      .sort({ createdAt: -1 })
      .populate('user', 'name location'); // Show who wrote the review

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});


/*
 * ========================================
 * Q2.3: Implement Search Endpoint (Keyword + Fuzzy)
 * ========================================
 */
app.get('/products/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }

    // 1. Keyword Search (using the $text index you defined in product.js)
    // This is fast and uses stemming (e.g., "laptops" matches "laptop")
    const textResults = await Product.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } } // Add relevance score
    ).sort({ score: { $meta: 'textScore' } }); // Sort by relevance

    if (textResults.length > 0) {
      return res.json({
        method: 'text_search',
        count: textResults.length,
        results: textResults
      });
    }

    // 2. Fallback: Basic Fuzzy Search (if no $text results)
    // This uses a regular expression to catch misspellings.
    // 'i' means case-insensitive.
    // This is "fuzzy" but not true "similarity" (e.g., 'leptop' will NOT match 'laptop')
    // For "hp leptop" -> "HP Laptop", you need Atlas Search ($search operator)
    const regex = new RegExp(query, 'i');

    const regexResults = await Product.find({
      $or: [
        { name: { $regex: regex } },
        { description: { $regex: regex } },
        { brand: { $regex: regex } }
      ]
    }).limit(20); // Limit regex search as it can be slow

    res.json({
      method: 'regex_fallback',
      count: regexResults.length,
      results: regexResults
    });

  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});


/*
 * ========================================
 * Q1.4: Aggregation Pipeline
 * ========================================
 */
app.get('/reports/top-products', async (req, res) => {
  try {
    // 1. Get the date 30 days ago
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    // 2. Define the aggregation pipeline
    const pipeline = [
      {
        // Stage 1: Filter orders from the last 30 days
        $match: {
          createdAt: { $gte: oneMonthAgo }
        }
      },
      {
        // Stage 2: De-normalize the 'items' array
        $unwind: '$items'
      },
      {
        // Stage 3: Group by product ID and sum quantities
        $group: {
          _id: '$items.product',
          totalPurchased: { $sum: '$items.quantity' }
        }
      },
      {
        // Stage 4: Sort by total purchased (descending)
        $sort: {
          totalPurchased: -1
        }
      },
      {
        // Stage 5: Look up product details (name, category)
        $lookup: {
          from: 'products', // The *collection name* (plural, lowercase)
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        // Stage 6: $lookup returns an array, unwind it
        $unwind: '$productDetails'
      },
      {
        // Stage 7: Group by category
        $group: {
          _id: '$productDetails.category', // Group by the category name
          products: {
            // Push the top products into an array
            $push: {
              productId: '$_id',
              name: '$productDetails.name',
              totalPurchased: '$totalPurchased'
            }
          }
        }
      },
      {
        // Stage 8: Project to get only the Top 5 from each category's array
        $project: {
          _id: 0, // Don't show the _id
          category: '$_id',
          top5Products: {
            $slice: ['$products', 5] // Get the first 5 elements
          }
        }
      },
      {
        // Stage 9: Sort by category name (A-Z)
        $sort: {
          category: 1
        }
      }
    ];

    // 3. Run the aggregation
    const result = await Order.aggregate(pipeline);
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Aggregation Error', error: err.message });
  }
});


// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});