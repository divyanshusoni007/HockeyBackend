const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  time: { type: String, required: true },
  team: { type: String, required: true },

  // 🔑 NEW: canonical reference
  player_id: { type: String, required: true }, // e.g. "ri02"

  // 🧾 Display-only (safe to change later)
  player_name: { type: String, required: true }, // e.g. "Player G2"

  type: { type: String, required: true },
  quarter: { type: String, required: true }
}, { _id: false });

const playerRefSchema = new mongoose.Schema({
  player_id: { type: String, required: true },   // ri02
  player_name: { type: String, required: true }  // Player G2
}, { _id: false });

const MatchLiveSchema = new mongoose.Schema({
  match_id: { type: String, required: true, unique: true },
  tournament_id: { type: String }, // store tournament identifier like 'TOUR001'

  // Match basics
  team1_name: String,
  team2_name: String,
  venue: String,
  match_date: String,
  match_time: String,

  // Status
  status: {
    type: String,
    enum: ['Live', 'Upcoming', 'Finished'],
    default: 'Upcoming'
  },

  // Scores
  team1_score: { type: Number, default: 0 },
  team2_score: { type: Number, default: 0 },

  // Quarters
  quarters: { type: [String], default: ['Q1', 'Q2', 'Q3', 'Q4'] },
  current_quarter: { type: String, default: 'Q1' },

  // Players
  team1_players: [playerRefSchema],
  team2_players: [playerRefSchema],
  // Optional team ids (useful to link to Teams collection)
  team1_id: { type: String },
  team2_id: { type: String },

  // Timer
  total_seconds: { type: Number, default: 0 }, // Remaining time in seconds
  is_paused: { type: Boolean, default: true },

  // Match events history
  match_events: [eventSchema],

  // Timestamps
  updated_at: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('MatchLive', MatchLiveSchema);
