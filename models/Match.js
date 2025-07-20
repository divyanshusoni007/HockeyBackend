const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
 match_id:{ type: String, unique: true }, // Ensure match_id is unique
 tournament_id: { type: Number},
 rounds:{type:String},
 home_team_id:{ type: Number },
 away_team_id: { type: Number },
 match_type:{type:String},
 city: { type: String },
 venue:{type:String},
 match_date: { type: Date },
 referee_name_one: {type:String},
 referee_name_two: {type:String},
 scorer_name: {type:String},
 home_score:{type:Number, default: 0}, // Default to 0
 away_score: {type:Number, default: 0}, // Default to 0
 winner_team_id: {type:Number},
});

module.exports = mongoose.model('Match', MatchSchema);