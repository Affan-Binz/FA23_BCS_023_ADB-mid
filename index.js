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

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));


app.get('/', (req, res) => {
  res.send('E-commerce API is running');
});

 // Q2.2

// API 1
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

// API 2
app.get('/users/:id/orders', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid User ID' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const orders = await Order.find({ user: id })
      .sort({ createdAt: -1 }) // Show newest orders first
      .populate('items.product', 'name price');

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// API 3
app.get('/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Product ID' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const reviews = await Review.find({ product: id })
      .sort({ createdAt: -1 })
      .populate('user', 'name location'); // Show who wrote the review

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});



 // Q2.3
app.get('/products/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }

    const textResults = await Product.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } });

    if (textResults.length > 0) {
      return res.json({
        method: 'text_search',
        count: textResults.length,
        results: textResults
      });
    }

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

// Q1.4
app.get('/reports/top-products', async (req, res) => {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    const pipeline = [
      {

        $match: {
          createdAt: { $gte: oneMonthAgo }
        }
      },
      {
        $unwind: '$items'
      },
      {
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
/*
 * ========================================
 * Q2. BONUS: Hybrid Ranking Search
 * ========================================
 */
app.get('/products/search/hybrid', async (req, res) => {
  try {
    const { query, budget } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }

    // --- 1. Define Weights ---
    // These come from the prompt (40%, 40%, 20%)
    const simWeight = 0.4;
    const popWeight = 0.4;
    const priceWeight = 0.2;
    const userBudget = parseFloat(budget) || null;

    // --- 2. Build Aggregation Pipeline ---

    // Stage 1: $search for text similarity
    // This is where the "hp leptop" -> "HP Laptop" magic happens
    const searchStage = {
      $search: {
        index: 'hybrid_search_index', // The index you just created in Atlas
        text: {
          query: query,
          path: ['name', 'description'],
          fuzzy: {
            maxEdits: 2,       // Allows for 2 misspellings or letter changes
            prefixLength: 2  // The first 2 letters must be correct
          }
        }
      }
    };

    // Stage 2: $project to get the similarity score
    const projectStage = {
      $project: {
        // Include all original fields
        _id: 1, name: 1, description: 1, category: 1, price: 1,
        brand: 1, rating: 1, stock: 1, purchaseCount: 1, createdAt: 1,

        // 1. Get the Similarity Score (from $search)
        similarityScore: { $meta: 'searchScore' }
      }
    };

    // Stage 3: $addFields to calculate the other scores
    const addFieldsStage = {
      $addFields: {

      popularityScore: { $ln: { $add: [1, '$purchaseCount'] } },

        // 3. Calculate Price Score (if budget is provided)
        priceScore: userBudget ? {
          // Uses Gaussian decay: score is 1.0 when price == budget,
          // and decays as it gets further away.
          $exp: {
            $divide: [
              { $pow: [{ $subtract: ['$price', userBudget] }, 2] },
              -2 * Math.pow(userBudget * 0.5, 2) // 'scale' is 50% of budget
            ]
          }
        } : 0 // If no budget is provided, price relevance is 0
      }
    };

    // Stage 4: $addFields again to combine them into a final score
    // (We need a separate stage because finalScore depends on the fields above)
    const finalScoreStage = {
       $addFields: {
         // 4. Calculate Final Weighted Score
         finalScore: {
           $add: [
             { $multiply: ['$similarityScore', simWeight] },
             { $multiply: ['$popularityScore', popWeight] },
             { $multiply: ['$priceScore', priceWeight] }
           ]
         }
       }
    };

    // Stage 5: Sort by our new finalScore and limit the results
    const sortStage = { $sort: { finalScore: -1 } };
    const limitStage = { $limit: 20 };

    // --- 3. Run the Pipeline ---
    const pipeline = [
      searchStage,
      projectStage,
      addFieldsStage,
      finalScoreStage,
      sortStage,
      limitStage
    ];

    const products = await Product.aggregate(pipeline);
    res.json(products);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});



// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});