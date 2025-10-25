// generateData.js
const { faker } = require('@faker-js/faker');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// --- SETTINGS ---
const NUM_USERS = 50;
const NUM_PRODUCTS = 100;
const NUM_ORDERS = 150;
const NUM_REVIEWS = 200;
// ------------------

const dataDir = path.join(__dirname, 'data');

// Helper function to create the /data directory if it doesn't exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Helper function to save data to a JSON file
const saveData = (filename, data) => {
  fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2));
  console.log(`✅ Generated ${data.length} records and saved to /data/${filename}`);
};

// Helper function to get a random item from an array
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --- 1. GENERATE USERS ---
const users = [];
const userIds = [];
for (let i = 0; i < NUM_USERS; i++) {
  const userId = new mongoose.Types.ObjectId();
  userIds.push(userId);
  users.push({
    _id: userId,
    name: faker.person.fullName(),
    email: faker.internet.email(),
    location: faker.location.city(),
    createdAt: faker.date.past({ years: 2 }),
    updatedAt: new Date(),
  });
}
saveData('users.json', users);

// --- 2. GENERATE PRODUCTS ---
const products = [];
const productIds = [];
const categories = ['Electronics', 'Books', 'Clothing', 'Home', 'Sports', 'Toys'];
for (let i = 0; i < NUM_PRODUCTS; i++) {
  const productId = new mongoose.Types.ObjectId();
  productIds.push(productId);
  products.push({
    _id: productId,
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    category: getRandom(categories),
    price: parseFloat(faker.commerce.price({ min: 10, max: 2000 })),
    brand: faker.company.name(),
    rating: faker.number.float({ min: 1, max: 5, precision: 0.1 }),
    stock: faker.number.int({ min: 0, max: 100 }),
    purchaseCount: faker.number.int({ min: 0, max: 500 }), // For popularity
    createdAt: faker.date.past({ years: 2 }),
    updatedAt: new Date(),
  });
}
saveData('products.json', products);

// --- 3. GENERATE REVIEWS ---
const reviews = [];
for (let i = 0; i < NUM_REVIEWS; i++) {
  reviews.push({
    _id: new mongoose.Types.ObjectId(),
    user: getRandom(userIds),
    product: getRandom(productIds),
    rating: faker.number.int({ min: 1, max: 5 }),
    text: faker.lorem.paragraph(),
    createdAt: faker.date.recent({ days: 365 }),
    updatedAt: new Date(),
  });
}
saveData('reviews.json', reviews);

// --- 4. GENERATE ORDERS ---
const orders = [];
for (let i = 0; i < NUM_ORDERS; i++) {
  const items = [];
  let totalCost = 0;
  const numItemsInOrder = faker.number.int({ min: 1, max: 5 });

  for (let j = 0; j < numItemsInOrder; j++) {
    const product = getRandom(products);
    const quantity = faker.number.int({ min: 1, max: 3 });
    const price = product.price; // Use the product's actual price

    items.push({
      product: product._id,
      quantity: quantity,
      price: price,
    });
    totalCost += price * quantity;
  }

  orders.push({
    _id: new mongoose.Types.ObjectId(),
    user: getRandom(userIds),
    items: items,
    totalCost: parseFloat(totalCost.toFixed(2)),
    createdAt: faker.date.past({ years: 1 }),
    updatedAt: new Date(),
  });
}
saveData('orders.json', orders);

console.log('\n🎉 All sample data generated successfully!');