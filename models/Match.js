const mongoose = require("mongoose");

const MatchSchema = new mongoose.Schema({
  match_id: String,
  home_team: String,
  away_team: String,
  venue: String,
  date: String,
  time: String,

  home_score: {
    type: Number,
    default: 0,
  },
  away_score: {
    type: Number,
    default: 0,
  },
  remaining_time: {
    type: String,
    default: "15:00", // or whatever match duration you use
  },
  timer_running: {
    type: Boolean,
    default: false,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Match", MatchSchema);
