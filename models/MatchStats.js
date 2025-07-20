const mongoose = require('mongoose');

const matchStatsSchema = new mongoose.Schema({
  match_id: Number,
  team_id: Number,
  goals: Number,
  FG: Number,
  PC: Number,
  PS: Number,
  shots_on_goal: Number,
  shots: Number,
  penalty_corners_awarded: Number,
  penalty_corners_scored: Number,
  penalty_strokes_awarded: Number,
  penalty_strokes_scored: Number,
  circle_penetrations: Number,
  yellow_cards: Number,
  red_cards: Number,
  goals_conceded: Number
});

module.exports = mongoose.model('MatchStats', matchStatsSchema);
