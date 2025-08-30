// insertMatchLive.js
const mongoose = require("mongoose");
require("dotenv").config();

// Import your MatchLive schema
const MatchLive = require("./models/MatchLive"); // change path if needed

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

// Insert sample data
async function insertMatchLive() {
  try {
    const newMatchLive = new MatchLive({
      match_id: "M001", // change to real match_id
      home_team: "Team Alpha",
      away_team: "Team Beta",
      home_score: 0,
      away_score: 0,
      quarter: 1,
      time_remaining: "15:00",
      status: "Live"
    });

    const savedMatchLive = await newMatchLive.save();
    console.log("✅ MatchLive inserted:", savedMatchLive);
  } catch (error) {
    console.error("❌ Error inserting MatchLive:", error);
  } finally {
    mongoose.connection.close();
  }
}

insertMatchLive();
