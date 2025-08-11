const mongoose = require("mongoose");
const { Schema } = mongoose;

const MatchEventSchema = new Schema({
  match_id: {
    type: String,
    required: true,
    index: true,
  },
  team_name: {
    type: String,
    required: true,
  },
  player_name: {
    type: String,
    required: true,
  },
  event_type: {
    type: String,
    enum: ["Goal", "Penalty Corner", "Card"], // Example event types
    required: true,
  },
  quarter: {
    type: String,
    required: true,
  },
  event_time_minutes: {
    type: Number,
    required: true,
  },
  event_time_seconds: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("MatchEvent", MatchEventSchema);