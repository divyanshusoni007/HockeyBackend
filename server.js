const User = require('./models/User');


require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const cors = require('cors');
app.use(cors());


// Replace with your local or Atlas URI
const mongoURI = process.env.MONGODB_URI;

console.log('👉 Attempting to connect to MongoDB...');
console.log(`MONGODB_URI: ${process.env.MONGODB_URI}`);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });


app.get('/', (req, res) => {
  res.send('Hockey App Backend Running');
});


app.post('/api/users', async (req, res) => {
  try {
    const {
      user_id,
      first_name,
      last_name,
      email,
      password_hash,
      date_of_birth,
      gender,
      phone_number,
      address,
      position,
      join_date,
      jersey_number,
      weight_kg,
      height_cm,
      role_id,
      player_bio
    } = req.body;

    const newUser = new User({
      user_id,
      first_name,
      last_name,
      email,
      password_hash,
      date_of_birth,
      gender,
      phone_number,
      address,
      position,
      join_date,
      jersey_number,
      weight_kg,
      height_cm,
      role_id,
      player_bio
    });

    await newUser.save();

    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});


const PORT = 3000;
console.log(`✅ MONGODB_URI=${process.env.MONGODB_URI}`);
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});



