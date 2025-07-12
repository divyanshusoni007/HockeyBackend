const User = require('./models/User');
const Match=require('./models/Match');
const AddTournament=require('./models/AddTournament');
const Teams=require('./models/Teams');

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const cors = require('cors');
// const Tournament = require('./models/AddTournament');
app.use(cors());


// Replace with your local or Atlas URI
// const mongoURI = process.env.MONGODB_URI;
// const mongoURI = "mongodb+srv://mahfijulfadil:9MKKoqio5DqNTMAj@clusterhockey.j8jqh1h.mongodb.net/?retryWrites=true&w=majority&appName=ClusterHockey"
// const mongoURI = "mongodb+srv://<db_username>:<db_password>@clusterhockey.j8jqh1h.mongodb.net/?retryWrites=true&w=majority&appName=ClusterHockey"
console.log('👉 Attempting to connect to MongoDB...');
console.log(`MONGODB_URI: ${process.env.MONGODB_URI}`);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });


app.get('/', (req, res) => {
  res.send('Hockey App Backend Running');
});


app.post('/api/users', async (req, res) => {
  try {
    const {
      user_id,
      first_name,
      last_name,
      email,
      password_hash,
      date_of_birth,
      gender,
      phone_number,
      address,
      position,
      join_date,
      jersey_number,
      weight_kg,
      height_cm,
      role_id,
      player_bio
    } = req.body;

    const newUser = new User({
      user_id,
      first_name,
      last_name,
      email,
      password_hash,
      date_of_birth,
      gender,
      phone_number,
      address,
      position,
      join_date,
      jersey_number,
      weight_kg,
      height_cm,
      role_id,
      player_bio
    });

    await newUser.save();

    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});


app.post('/api/events', async (req, res)=> {
  try {
    const {
      match_id,
      tournament_id,
      home_team_id,
      away_team_id,
      match_date,
      venue,
      home_score,
      away_score,
      winner_team_id,
      referee_id,
      scorer_id
    } = req.body;

    const newMatch = new Match({
      match_id,
      tournament_id,
      home_team_id,
      away_team_id,
      match_date,
      venue,
      home_score,
      away_score,
      winner_team_id,
      referee_id,
      scorer_id
    });

    await newMatch.save();

    res.status(201).json({message: 'Match created successfully', match: newMatch });
  } catch(error){
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/addtournaments', async (req, res)=> {
  try {
    const {
      tournament_id,
      tournament_name,
      start_date,
      end_date,
      location,
      organizer_id,
      format,
      tournament_category,
      match_type,
      referee_id,
      scorer_id,
    } = req.body;

    const newTournament = new AddTournament({
      tournament_id,
      tournament_name,
      start_date,
      end_date,
      location,
      organizer_id,
      format,
      tournament_category,
      match_type,
      referee_id,
      scorer_id,
    });

    await newTournament.save();

    res.status(201).json({message: 'Tournament created successfully', tournament: newTournament });
  } catch(error){
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});



app.post('/api/team', async (req, res)=> {
  try {
    const {
      team_id,
      team_name,
      city,
      state,
      country,
      logo_url,
      creation_date,
      coach_id,
    } = req.body;

    const newTeam = new Teams({
      team_id,
      team_name,
      city,
      state,
      country,
      logo_url,
      creation_date,
      coach_id,
    });

    await newTeam.save();

    res.status(201).json({message: 'Team added successfully', team: newTeam });
  } catch(error){
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});




app.get('/api/events/:match_id', async (req, res) => {
    try {
        const { match_id } = req.params; // Extract match_id from URL parameters
        const match = await Match.findOne({ match_id: match_id });
        if (!match) {
            return res.status(404).json({ message: 'Match not found' });
        }
        res.status(200).json(match); // Send the found match as JSON
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});


app.get('/api/tournaments/:tournament_id', async (req, res) => {
    try {
        const { tournament_id } = req.params; // Extract match_id from URL parameters  
        const tournament = await AddTournament.findOne({ tournament_id: tournament_id });
        if (!tournament) {
            return res.status(404).json({ message: 'Tournament not found' });
        }
        res.status(200).json(tournament); // Send the found match as JSON
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/users/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params; // Extract match_id from URL parameters  
        const user = await User.findOne({ user_id: user_id });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user); // Send the found match as JSON
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});


const PORT = 3000;
console.log(`✅ MONGODB_URI=${process.env.MONGODB_URI}`);
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});



