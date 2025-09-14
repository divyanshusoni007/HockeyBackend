const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  team_id: { type: String, unique: true, required: true }, // e.g. "T001"
  team_name: { type: String, required: true, unique: true },
  short_name: { type: String }, // e.g. "IND"
  logo_url: { type: String },

  coach_name: { type: String },
  manager_name: { type: String },

  // Reference players from User collection
  players: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],

  // Optional captain reference
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Tournament participation
tournament_id: { type: mongoose.Schema.Types.ObjectId, ref: "AddTournament"},

  pool: {
    name: { type: String },
    type: { type: String }
  },
  // Matches played
  matches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  }],

  location: { type: String }, // City or region
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Team', TeamSchema);
