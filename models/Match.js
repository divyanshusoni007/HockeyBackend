const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  match_id:{ type: Number, unique: true, required: true },
  tournament_id: { type: Number},
  home_team_id:{ type: Number },
  away_team_id: { type: Number },
  match_date: { type: Date },
  venue: { type: String },
  home_score:{type:Number},
  away_score: {type:Number},
  winner_team_id: {type:Number},
  referee_id: {type:Number},
  scorer_id: {type:Number},

});

module.exports = mongoose.model('Match', MatchSchema);
