const mongoose = require('mongoose');

const AddTournamentSchema = new mongoose.Schema({
  tournament_id: { type: Number, unique: true, required: true },
  tournament_name: { type: String, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true},
  location: { type: String, required: true },
  organizer_id: { type: Number, required: true },
  format: { type: String },
  tournament_category: { type: String },
  match_type: { type: String },
  referee_id: { type: Number},
  scorer_id: { type: Number},
  
});

module.exports = mongoose.model('AddTournament', AddTournamentSchema);
