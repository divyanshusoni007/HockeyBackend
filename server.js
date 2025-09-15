require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");

const Match = require("./models/Match");
const MatchLive = require('./models/MatchLive');

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");

// Create socket.io instance
const io = new Server(server, {
  cors: {
    origin: "*", // Change to your frontend URL in production
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());


mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB Atlas");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });


// Root route
app.get("/", (req, res) => {
  res.send("Hockey App Backend Running");
});

// GET all matches for the dashboard
app.get('/api/matches', async (req, res) => {
  try {
    const matches = await MatchLive.find();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/matchlive/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log("📌 MatchId received in API:", matchId);

    // Try finding in MatchLive
    let matchLive = await MatchLive.findOne({
      match_id: mongoose.Types.ObjectId.isValid(matchId)
        ? new mongoose.Types.ObjectId(matchId)
        : matchId
    });

    if (matchLive) {
      console.log("✅ Found in MatchLive");
      return res.json(matchLive);
    }

    console.log("⚠️ Not found in MatchLive, checking Match collection...");

    // If not found, try Match collection
    const match = await Match.findById(matchId);
    if (match) {
      console.log("✅ Found in Match collection");
      return res.json(match);
    }

    console.log("❌ Match not found in either collection");
    return res.status(404).json({ error: "Match not found" });

  } catch (err) {
    console.error("🔥 Error fetching match live data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// POST METHOD FOR ADD USER
app.post("/api/users", async (req, res) => {
  try {
    const {
      full_name,
      email,
      date_of_birth,
      gender,
      phone_number,
      address,
      zip,
      position,
      jersey_number,
      player_bio,
      profile_pic,
    } = req.body;

    // --- Basic input validation ---
    if (!full_name || full_name.length < 2) {
      return res.status(400).json({
        error:
          "Full name must be at least 2 characters long to generate user ID.",
      });
    }
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }
    // Add more validation as needed (e.g., email format, password strength)
    if(!phone_number){
      return res.status(400).json({error: "phone number is required."});
    }

    //  Explicitly check if phone number already exists
    const existingPhone = await User.findOne({ phone_number });
    if (existingPhone) {
      return res.status(409).json({
        error: "This phone number is already registered.",
      });
    }

    // --- Generate user_id ---
    const prefix = full_name.substring(0, 2).toLowerCase(); // Get first two letters, lowercase

    // Find the latest user_id with the same prefix to ensure sequential IDs
    const lastUser = await User.findOne({
      user_id: new RegExp(`^${prefix}\\d+$`, "i"),
    })
      .sort({ user_id: -1 }) // Sort descending to get the highest number
      .exec();

    let nextNumber = 1;
    if (lastUser && lastUser.user_id) {
      const lastNumberMatch = lastUser.user_id.match(/\d+$/); // Extract numeric part
      if (lastNumberMatch) {
        nextNumber = parseInt(lastNumberMatch[0], 10) + 1;
      }
    }
    // Format with leading zeros (e.g., '01', '02')
    const user_id = `${prefix}${String(nextNumber).padStart(2, "0")}`;

    // --- Set join_date to current date (or let schema default handle it) ---
    // It's already set in the schema with `default: Date.now`, so explicitly setting here is redundant but harmless.
    const join_date = new Date();

    const newUser = new User({
      user_id,
      full_name,
      email,
      date_of_birth,
      gender,
      phone_number,
      address,
      zip,
      position,
      join_date,
      jersey_number,
      player_bio,
      profile_pic
    });

    await newUser.save();

    res
      .status(201)
      .json({ message: "User profile created successfully", user: newUser });
  } catch (error) {
    console.error("Error creating user:", error);
    // Handle specific MongoDB duplicate key error (code 11000)
    if (error.code === 11000) {
      let errorMessage = "A user with this data already exists.";
      if (error.keyPattern && error.keyPattern.email) {
        errorMessage =
          "This email is already registered. Please use a different email.";
      } 
      if(error.keyPattern && error.keyPattern.phone_number){
        errorMessage =
          "This phone number is already registered. Please try with different phone number";
      }
      else if (error.keyPattern && error.keyPattern.user_id) {
        errorMessage =
          "Generated user ID already exists. Please try again.";
      } 
      return res.status(409).json({ error: errorMessage });
    }
    res.status(500).json({ error: "Server error: Could not create user." });
  }
});

// POST METHOD FOR ADD MATCH
app.post("/api/match", async (req, res) => {
  try {
    const {
      tournament_name, // Changed from tournament_id
      home_team_name, // Changed from home_team_id
      away_team_name, // Changed from away_team_id
      rounds,
      match_type,
      city,
      venue,
      match_date,
      referee_name_one, // Assuming these are names, not IDs for simplicity
      referee_name_two,
      scorer_name,
      // home_score, away_score, winner_team_id are excluded as they'll be updated later
    } = req.body;

    // --- Fetch tournament_id from tournament_name ---
    if (!tournament_name) {
      return res.status(400).json({ error: "Tournament name is required." });
    }
    const tournament = await AddTournament.findOne({
      tournament_name: tournament_name,
    });
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found." });
    }
    const tournament_id = tournament.tournament_id;

    // --- Fetch home_team_id from home_team_name ---
    if (!home_team_name) {
      return res.status(400).json({ error: "Home team name is required." });
    }
    const homeTeam = await Teams.findOne({ team_name: home_team_name });
    if (!homeTeam) {
      return res
        .status(404)
        .json({ error: `Home team "${home_team_name}" not found.` });
    }
    const home_team_id = homeTeam.team_id;

    // --- Fetch away_team_id from away_team_name ---
    if (!away_team_name) {
      return res.status(400).json({ error: "Away team name is required." });
    }
    const awayTeam = await Teams.findOne({ team_name: away_team_name });
    if (!awayTeam) {
      return res
        .status(404)
        .json({ error: `Away team "${away_team_name}" not found.` });
    }
    const away_team_id = awayTeam.team_id;

    // --- Generate match_id ---
    const homePrefix = home_team_name.substring(0, 3).toLowerCase();
    const awayPrefix = away_team_name.substring(0, 3).toLowerCase();

    // Find the latest match_id with the same prefix combination
    const lastMatch = await Match.findOne({
      match_id: new RegExp(`^${homePrefix}${awayPrefix}\\d+$`, "i"),
    })
      .sort({ match_id: -1 })
      .exec();

    let nextNumber = 1;
    if (lastMatch && lastMatch.match_id) {
      const lastNumberMatch = lastMatch.match_id.match(/\d+$/);
      if (lastNumberMatch) {
        nextNumber = parseInt(lastNumberMatch[0], 10) + 1;
      }
    }
    const match_id = `${homePrefix}${awayPrefix}${String(nextNumber).padStart(
      2,
      "0"
    )}`;

    const newMatch = new Match({
      match_id,
      tournament_id,
      rounds,
      home_team_id,
      away_team_id,
      match_type,
      city,
      venue,
      match_date,
      referee_name_one,
      referee_name_two,
      scorer_name,
      // home_score and away_score will default to 0 as per schema definition
      // winner_team_id will be undefined initially
    });

    await newMatch.save();

    res
      .status(201)
      .json({ message: "Match created successfully", match: newMatch });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      // Duplicate key error
      return res.status(409).json({
        error:
          "A match with this ID already exists. Please try again or adjust team names.",
      });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// GET user by phone number to autofill organizer name
app.get("/api/users/phone/:phone_number", async (req, res) => {
  try {
    const { phone_number } = req.params;
    const user = await User.findOne({ phone_number });

    if (!user) {
      return res.status(404).json({ error: "No user found with this phone number." });
    }

    res.status(200).json({
      user_id: user.user_id,
      full_name: user.full_name,
      phone_number: user.phone_number
    });
  } catch (error) {
    console.error("Error fetching user by phone:", error);
    res.status(500).json({ error: "Server error while fetching user." });
  }
});


// POST METHOD FOR ADD TOURNAMENTS
app.post("/api/addtournaments", async (req, res) => {
  try {
    console.log("Received request to add tournament:", req.body);
    const {
      tournament_name,
      start_date,
      end_date,
      location,
      organizer_id,
      format,
      tournament_category,
      match_type,
    } = req.body;

    // --- Generate tournament_id ---
    const prefix = "TOUR";
    // Find the latest tournament_id to determine the next counter
    const lastTournament = await AddTournament.findOne({
      tournament_id: new RegExp(`^${prefix}\\d+$`, "i"),
    })
      .sort({ tournament_id: -1 }) // Sort descending to get the highest number
      .exec();

    let nextNumber = 1;
    if (lastTournament && lastTournament.tournament_id) {
      const lastNumberMatch = lastTournament.tournament_id.match(/\d+$/); // Extract numeric part
      if (lastNumberMatch) {
        nextNumber = parseInt(lastNumberMatch[0], 10) + 1;
      }
    }
    const tournament_id = `${prefix}${String(nextNumber).padStart(3, "0")}`; // Format with leading zeros (e.g., '001', '010')

    const newTournament = new AddTournament({
      tournament_id, // Auto-generated ID
      tournament_name,
      start_date,
      end_date,
      location,
      organizer_id,
      format,
      tournament_category,
      match_type,
    });
    console.log("New tournament object:", newTournament);

    await newTournament.save();

    res.status(201).json({
      message: "Tournament created successfully",
      tournament: newTournament,
    });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      // Duplicate key error for tournament_id
      return res.status(409).json({
        error: "A tournament with this ID already exists. Please try again.",
      });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// POST METHOD FOR ADD TEAMS
app.post("/api/tournament/:tournament_id/team", async (req, res) => {
  try {
    // Extract tournament_id from URL parameters
    const { tournament_id } = req.params;
    const { team_name, city, logo_url } = req.body; // --- Validate tournament_id from URL ---
   // console.log("Received request to add team:", req.body);

    if (!tournament_id) {
      return res
        .status(400)
        .json({ error: "Tournament ID is missing from the URL." });
    } // Verify if the provided tournament_id actually exists

    const tournaments = await AddTournament.findOne({
      tournament_id: tournament_id,
      
    });
     
   // console.log("Tournament exists:", tournaments);
    if (!tournaments) {
      return res
        .status(404)
        .json({ error: `Tournament with ID "${tournament_id}" not found.` });
    } // Basic validation for team_name and city

    if (!team_name || team_name.trim() === "") {
      return res.status(400).json({ error: "Team name is required." });
    }
    if (!city || city.trim() === "") {
      return res.status(400).json({ error: "City is required." });
    } // --- Generate team_id ---

    const prefix = "T"; // Find the latest team_id to determine the next counter globally
    const lastTeam = await Teams.findOne({
      team_id: new RegExp(`^${prefix}\\d+$`, "i"),
    })
      .sort({ team_id: -1 })
      .exec();

    let nextNumber = 1;
    if (lastTeam && lastTeam.team_id) {
      const lastNumberMatch = lastTeam.team_id.match(/\d+$/);
      if (lastNumberMatch) {
        nextNumber = parseInt(lastNumberMatch[0], 10) + 1;
      }
    }
    const team_id = `${prefix}${String(nextNumber).padStart(3, "0")}`; // Format with leading zeros (e.g., 'T001', 'T010')
    // console.log("Generate tour:", tournaments);
     //console.log("Generate teamer_id:", tournament_id);
    const newTeam = new Teams({
      team_id, // Auto-generated
     tournament_id: tournaments._id, // Fetched from URL
      team_name,
      city,
      logo_url,
    });
   // console.log("New team object:", newTeam);
    await newTeam.save();
    
    res.status(201).json({ message: "Team added successfully", team: newTeam });
  } catch (error) {
    console.error("Error adding team:", error);
    if (error.code === 11000) {
      // Duplicate key error for team_id or team_name
      let errorMessage = "A team with this data already exists.";
      if (error.keyPattern && error.keyPattern.team_name) {
        errorMessage =
          "A team with this name already exists. Please choose a different name.";
      } else if (error.keyPattern && error.keyPattern.team_id) {
        errorMessage =
          "Generated team ID already exists. Please try again (rare conflict).";
      }
      return res.status(409).json({ error: errorMessage });
    }
    res.status(500).json({ error: "Server error: Could not add team." });
  }
});

//  POST METHOD FOR ADDING TEAM MEMBERS
app.post("/api/teams/:team_id/members", async (req, res) => {
  try {
    const { team_id } = req.params; // Get team_id from the URL
    const { phone_number, role } = req.body; // Get phone_number and role from the request body

    // 1. Validate incoming data
    if (!phone_number || phone_number.trim() === "") {
      return res.status(400).json({ error: "Phone number is required." });
    }

    // 2. Validate if the team_id exists
    // The issue is here: You were querying by team_name using team_id from the URL.
    // Instead, query by the actual team_id.
    const team = await Teams.findOne({ team_id: team_id }); 
    if (!team) {
      return res.status(404).json({ error: `Team "${team_id}" not found.` });
    }

    // 3. Search for the user in the User collection by phone number
    const user = await User.findOne({ phone_number: phone_number });

    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found with this phone number." });
    }

    // 4. Check if the user is already a member of this specific team
    const existingMember = await TeamMembers.findOne({
      team_id: team.team_id, // Use the actual team_id from the Teams collection
      user_id: user.user_id,
    });

    if (existingMember) {
      return res
        .status(409)
        .json({ error: "This user is already a member of this team." });
    }

    // 5. Create a new TeamMember entry
    const newTeamMember = new TeamMembers({
      team_id: team.team_id, // Use the actual team's ID
      user_id: user.user_id, // Get user_id from the found user
      phone_number: user.phone_number, // Get phone_number from the found user
      role: role || 'Player', // Use provided role or default to 'Player'
      name: user.full_name, // Get name from the found user (full_name in User model)
      profile_pic: user.profile_pic, // Get profile_pic from the found user
    });

    await newTeamMember.save();

    res.status(201).json({
      message: "Team member added successfully",
      member: newTeamMember,
    });
  } catch (error) {
    console.error("Error adding team member:", error);
    if (error.code === 11000) {
      // Duplicate key error, specifically for phone_number if it's unique in TeamMembersSchema
      return res.status(409).json({
        error: "A member with this phone number already exists in this team.",
      });
    }
    res.status(500).json({ error: "Server error: Could not add team member." });
  }
});

app.get("/api/tournaments/:tournament_id", async (req, res) => {
  try {
    const { tournament_id } = req.params; // Extract match_id from URL parameters
    const tournament = await AddTournament.findOne({
      tournament_id: tournament_id,
    });
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }
    res.status(200).json(tournament); // Send the found match as JSON
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/api/tournaments", async (req, res) => {
  try {
    const tournaments = await AddTournament.find({});
    res.status(200).json(tournaments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/:tournament_id/pool", async (req, res) => {
  try {
    const { tournament_id } = req.params;
    const { pool_name, pool_type, teams } = req.body;
    console.log("Received pool creation request:", req.body);

    // Validate request body
    if (!pool_name || !pool_type || !teams || teams.length === 0) {
      return res.status(400).json({
        error: "Pool name, pool type and teams are required."
      });
    }

    // Find the tournament
    const tournament = await AddTournament.findOne({ tournament_id });
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found." });
    }

    // Check if the pool name already exists in this tournament
    const existingPool = await Teams.findOne({
      tournaments: tournament._id,
      'pool.name': pool_name
    });

    if (existingPool) {
      return res.status(400).json({
        error: "Pool name must be unique within the tournament."
      });
    }

    // Extract team IDs from the request
    const team_ids = teams.map((team) => team.team_id);

    // Validate that all teams exist and belong to the tournament
    const teamsExist = await Teams.find({
      team_id: { $in: team_ids },
      tournament_id: tournament_id
    });

    if (teamsExist.length !== team_ids.length) {
      return res.status(400).json({
        error: "One or more teams are invalid or don't belong to this tournament."
      });
    }

    // Update teams with pool information
    await Teams.updateMany(
      {
        team_id: { $in: team_ids },
        tournaments: tournament._id
      },
      {
        $set: {
          pool: {
            name: pool_name,
            type: pool_type
          }
        }
      }
    );

    res.status(200).json({
      message: "Teams updated with pool information successfully.",
      updated_teams: team_ids,
      pool: {
        name: pool_name,
        type: pool_type
      }
    });

  } catch (error) {
    console.error("Error updating pool information:", error);
    res.status(500).json({ error: "Server error." });
  }
});



app.get("/api/:tournament_id/teams", async (req, res) => {
  try {
     const { tournament_id } = req.params;
    if (!tournament_id) {
      return res
        .status(400)
        .json({ error: "Tournament ID is missing from the URL." });
    } // Verify if the provided tournament_id actually exists

    const tournamentExists = await AddTournament.findOne({
      tournament_id: tournament_id,
    });
    //console.log("Tournament exists:", tournamentExists);
    if (!tournamentExists) {
      return res
        .status(404)
        .json({ error: `Tournament with ID "${tournament_id}" not found.` });
    }
    //console.log("Tournament exists:", tournamentExists._id);
const teams = await Teams.find({ tournament_id: tournamentExists._id });
//console.log("Teams found:", teams);
  res.status(200).json(teams);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
})

app.get("/api/team/:team_id/members", async (req, res) => {
  try {
     const { team_id } = req.params;
    if (!team_id) {
      return res
        .status(400)
        .json({ error: "Team ID is missing from the URL." });
    } // Verify if the provided team_id actually exists

    const teamExists = await Teams.findOne({
      team_id: team_id,
    });

    console.log("Team exists:", teamExists); // Debug log to check if team is found
    if (!teamExists) {
      return res
        .status(404)
        .json({ error: `Team with ID "${team_id}" not found.` });
    }
  const members = await TeamMembers.find({ team_id: team_id });
  res.status(200).json(members);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/users/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params; // Extract match_id from URL parameters
    const user = await User.findOne({ user_id: user_id });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user); // Send the found match as JSON
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update timer state
app.post('/api/matches/:matchId/timer', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { totalSeconds, isPaused } = req.body;

    console.log("Incoming timer update:", { matchId, totalSeconds, isPaused });

    const match = await MatchLive.findOneAndUpdate(
      { match_id: matchId },
      { total_seconds: totalSeconds, is_paused: isPaused },
      //{ new: true }
    );

    if (!match) {
      console.log("Match not found for code:", matchId);
      return res.status(404).json({ error: "Match not found" });
    }

    // ✅ Emit snake_case globally
    io.emit("timerUpdated", {
      match_id: match.match_id,
      total_seconds: match.total_seconds,
      is_paused: match.is_paused,
      status: match.status
    });

    // 🔧 FIXED: Emit to specific room 
    io.to(matchId).emit("timerUpdated", {
      match_id: match.match_id,
      total_seconds: match.total_seconds,
      is_paused: match.is_paused,
      status: match.status
    });

    res.json(match);
  } catch (err) {
    console.error("Error updating timer:", err);
    res.status(500).json({ error: 'Failed to update timer' });
  }
});

// GET a specific match by ID (for the scorer page)
// This route now also fetches the team names
app.get("/api/matches/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = await Match.findOne({ match_id: matchId });
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    // Fetch full team details to get the team names
    const homeTeam = await Teams.findOne({ team_id: match.home_team_id });
    const awayTeam = await Teams.findOne({ team_id: match.away_team_id });
    
    // Combine everything into a single response object
    const responseData = {
      ...match.toObject(),
      home_team_name: homeTeam?.team_name,
      away_team_name: awayTeam?.team_name,
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching match:", error);
    res.status(500).json({ error: "Server error" });
  }
});


// NEW: API endpoint to update the score
app.post("/api/matches/:matchId/score", async (req, res) => {
  try {
    const { matchId } = req.params;
    const { teamName } = req.body;

    const match = await Match.findOne({ match_id: matchId });
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    // Find the team by name to determine which score to update
    const homeTeam = await Teams.findOne({ team_id: match.home_team_id });
    const awayTeam = await Teams.findOne({ team_id: match.away_team_id });

    if (homeTeam && homeTeam.team_name === teamName) {
        match.home_score = (match.home_score || 0) + 1;
    } else if (awayTeam && awayTeam.team_name === teamName) {
        match.away_score = (match.away_score || 0) + 1;
    } else {
        return res.status(400).json({ message: "Invalid team name provided." });
    }
    
    const updatedMatch = await match.save();
    
    // Broadcast the update to all clients
    io.emit("scoreUpdate", {
      matchId,
      homeScore: updatedMatch.home_score,
      awayScore: updatedMatch.away_score,
    });

    res.status(200).json({ message: "Score updated successfully", match: updatedMatch });
  } catch (error) {
    console.error("Error updating score:", error);
    res.status(500).json({ error: "Server error" });
  }
});


io.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});


app.get("/api/users/phone/:phone_number", async (req, res) => {
  try {
    console.log("Received request to get user by phone number:", req.params);
    const { phone_number } = req.params; // Extract phone_number from URL parameters
    const user = await User.findOne({ phone_number: phone_number });
     const users = await User.find(); 
     console.log("All users:", users); // Log all users for debugging
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user); // Send the found match as JSON
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// NEW: API endpoint to update the score
app.post("/api/matches/:matchId/score", async (req, res) => {
  const matchId = req.params.matchId;
  const { teamName } = req.body;
  
  try {
    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });

    if (teamName === match.home_team_name) {
      match.home_score += 1;
    } else if (teamName === match.away_team_name) {
      match.away_score += 1;
    }
    await match.save();

    // ✅ Emit to dashboards
    // io.emit("scoreUpdate", {
    //   matchId,
    //   homeScore: match.home_score,
    //   awayScore: match.away_score
    // });

    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new event to a match
app.post('/api/matches/:matchId/events', async (req, res) => {
  try {
    const { matchId } = req.params;
    const event = req.body;

    console.log("📌 New event for match:", matchId, event);

    const match = await MatchLive.findOneAndUpdate(
      { match_id: matchId },
      { $push: { match_events: event } },
      //{ new: true }   // return updated doc
    );

    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    // ✅ Emit snake_case globally
    io.emit("eventAdded", {
      match_id: match.match_id,
      match_events: [event],
      status: match.status
    });

    // 🔧 FIXED: Emit to specific room
    io.to(matchId).emit("eventAdded", {
      match_id: match.match_id,
      event: event,
      match_events: match.match_events,
      status: match.status
    });

    res.json(match);
  } catch (err) {
    console.error("🔥 Error saving event:", err);
    res.status(500).json({ error: "Failed to save event" });
  }
});

// Update score when a goal is added
app.post('/api/matches/:matchId/score', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { teamName } = req.body;

    const match = await MatchLive.findOne({ match_id: matchId });
    if (!match) return res.status(404).json({ error: "Match not found" });

    if (teamName === match.team1_name) match.team1_score++;
    else if (teamName === match.team2_name) match.team2_score++;

    await match.save();

    // ✅ Emit in snake_case, global emit
    io.emit("scoreUpdated", {
      match_id: match.match_id,
      team1_score: match.team1_score,
      team2_score: match.team2_score,
      status: match.status
    });

    // 🔧 FIXED: Emit to specific room
    io.to(matchId).emit("scoreUpdated", {
      match_id: match.match_id,
      team1_score: match.team1_score,
      team2_score: match.team2_score,
      status: match.status
    });

    console.log("📡 Emitted scoreUpdated:", match.match_id, match.team1_score, match.team2_score);

    res.json(match);
  } catch (err) {
    console.error("🔥 Error updating score:", err);
    res.status(500).json({ error: "Failed to update score" });
  }
});

// 🔧 NEW: Update quarter
app.post('/api/matches/:matchId/quarter', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { currentQuarter } = req.body;

    const match = await MatchLive.findOneAndUpdate(
      { match_id: matchId },
      { current_quarter: currentQuarter },
      { new: true }
    );

    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    io.to(matchId).emit("quarterChanged", {
      match_id: match.match_id,
      current_quarter: match.current_quarter,
      status: match.status
    });

    res.json(match);
  } catch (err) {
    console.error("Error updating quarter:", err);
    res.status(500).json({ error: 'Failed to update quarter' });
  }
});


// 🔧 NEW: Update match status
app.post('/api/matches/:matchId/status', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { status } = req.body;

    const match = await MatchLive.findOneAndUpdate(
      { match_id: matchId },
      { status: status },
      { new: true }
    );

    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    io.to(matchId).emit("matchStatusChanged", {
      match_id: match.match_id,
      status: match.status
    });

    res.json(match);
  } catch (err) {
    console.error("Error updating match status:", err);
    res.status(500).json({ error: 'Failed to update match status' });
  }
});


// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("🔌 New client connected");

  // Join a room per match (so clients only get their match updates)
  socket.on("joinMatch", (matchId) => {
    socket.join(matchId);
    console.log(`✅ Client joined room for match ${matchId}`);
  });

  // 🔧 NEW: Leave match room
  socket.on("leaveMatch", (matchId) => {
    socket.leave(matchId);
    console.log(`❌ Client ${socket.id} left room for match ${matchId}`);
  });

  // Timer update
  socket.on("timerUpdate", ({ matchId, totalSeconds, isPaused, displayMinutes, displaySeconds }) => {
    console.log("Timer update:", { matchId, totalSeconds, isPaused });

    io.emit("timerUpdated", {
      match_id: matchId,
      total_seconds: totalSeconds,
      is_paused: isPaused,
      status: "Live"
    });

    // Broadcast to all clients in this match room
    io.to(matchId).emit("timerUpdated", {
      match_id: matchId,
      total_seconds: totalSeconds,
      is_paused: isPaused,
      display_minutes: displayMinutes,
      display_seconds: displaySeconds,
      status: "Live"
    });
  });

  // Event add
  socket.on("eventAdded", ({ matchId, event }) => {
    console.log("Event added:", { matchId, event });

    io.emit("eventAdded", {
      match_id: matchId,
      match_events: [event],
      status: "Live"
    });

    io.to(matchId).emit("eventAdded", {
      match_id: matchId,
      event: event,
      status: "Live"
    });
  });

  // Score update
  socket.on("scoreUpdated", ({ matchId, team1_score, team2_score }) => {
    console.log("Score update:", { matchId, team1_score, team2_score });

    // emit globally instead of io.to(matchId)
    io.emit("scoreUpdated", {
      match_id: matchId,
      team1_score: team === "team1" ? score : undefined,
      team2_score: team === "team2" ? score : undefined,
      status: "Live"
    });

    io.to(matchId).emit("scoreUpdated", {
      match_id: matchId,
      team1_score: team1_score,
      team2_score: team2_score,
      status: "Live"
    });
  });

  // 🔧 NEW: Handle quarter changes
  socket.on("quarterChanged", ({ matchId, currentQuarter }) => {
    console.log("Quarter changed from client:", { matchId, currentQuarter });

    io.to(matchId).emit("quarterChanged", {
      match_id: matchId,
      current_quarter: currentQuarter,
      status: "Live"
    });
  });

  // 🔧 NEW: Handle match status changes
  socket.on("matchStatusChanged", ({ matchId, status }) => {
    console.log("Match status changed from client:", { matchId, status });

    io.to(matchId).emit("matchStatusChanged", {
      match_id: matchId,
      status: status
    });
  });

  // 🔧 NEW: Handle complete match state updates
  socket.on("matchStateUpdate", (matchState) => {
    console.log("Complete match state update:", matchState.matchId);

    io.to(matchState.matchId).emit("matchStateUpdated", matchState);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected");
  });
});



// API To Send email for contact us page --> MAke sure 2FA is enabled
const nodemailer = require("nodemailer");
const AddTournament = require("./models/AddTournament");
const Teams = require("./models/Teams");
const TeamMembers = require("./models/TeamMembers");
const User = require("./models/User");
app.post("/api/send-email", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Configure transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // your gmail
        pass: process.env.EMAIL_PASS, // your gmail app password
      },
    });

    // Email options
    const mailOptions = {
      from: `"StickStats Contact" <${process.env.EMAIL_USER}>`,
      to: "stickstatsindia@gmail.com", // your email where you want to receive
      subject: `📩 New Contact Form Submission from ${name}`,
      text: `
        Name: ${name}
        Email: ${email}
        Message: ${message}
      `,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Message:</b> ${message}</p>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email." });
  }
});




const PORT = 3000;
console.log(`✅ MONGODB_URI=${process.env.MONGODB_URI}`);
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
