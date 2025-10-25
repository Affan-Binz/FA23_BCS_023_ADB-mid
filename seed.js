// seed.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config(); // Load .env file

// Import all your models
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Review = require('./models/Review');

// --- READ JSON DATA ---
// Update these filenames to match what you have in your /data folder
const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'users.json'), 'utf-8'));
const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf-8'));
const orders = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'orders.json'), 'utf-8'));
const reviews = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'reviews.json'), 'utf-8'));

// --- DATABASE CONNECTION ---
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected for Seeding...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

// --- IMPORT DATA ---
const importData = async () => {
  try {
    // Clear existing data
    console.log('Clearing data...');
    await Order.deleteMany();
    await Review.deleteMany();
    await Product.deleteMany();
    await User.deleteMany();

    // Insert new data
    // Note: This simple seeder assumes your orders.json and reviews.json
    // already have the correct User and Product _id strings.
    console.log('Importing users...');
    await User.insertMany(users);

    console.log('Importing products...');
    await Product.insertMany(products);

    console.log('Importing reviews...');
    await Review.insertMany(reviews);

    console.log('Importing orders...');
    await Order.insertMany(orders);

    console.log('Data Imported Successfully! ✅');
    process.exit();
  } catch (err) {
    console.error('Error with data import:', err);
    process.exit(1);
  }
};

// --- RUN SCRIPT ---
(async () => {
  await connectDB();
  await importData();
})();