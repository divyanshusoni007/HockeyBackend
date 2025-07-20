const mongoose = require("mongoose");

const AddTournamentSchema = new mongoose.Schema({
  tournament_id: { type: String, unique: true }, // Ensure uniqueness for auto-generated ID
  tournament_name: { type: String, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  location: { type: String, required: true },
  organizer_id: { type: Number, required: true },
  format: { type: String },
  tournament_category: { type: String },
  match_type: { type: String },
  // Removed referee_id and scorer_id from schema based on your provided schema
});

module.exports = mongoose.model("AddTournament", AddTournamentSchema);
