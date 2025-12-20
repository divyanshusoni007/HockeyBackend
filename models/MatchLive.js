const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  time: { type: String, required: true },
  team: { type: String, required: true },
  player: { type: String, required: true },
  type: { type: String, required: true },
  quarter: { type: String, required: true }
}, { _id: false }); // don't create _id for each event

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
  team1_players: [String],
  team2_players: [String],
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
