// seed.js
const mongoose = require('mongoose');
const Match = require('./models/Match'); // adjust path if needed

mongoose.connect('mongodb+srv://sonidiv2000:jJ8wOTaY8RnMVaOM@clusterhockey.j8jqh1h.mongodb.net/test?retryWrites=true&w=majority&appName=ClusterHockey')
.then(async () => {
  console.log('Connected to Atlas');

  await Match.deleteMany({}); // clear old data

  await Match.insertMany([
    {
      match_id: 'M001',
      home_team_name: 'Team A',
      away_team_name: 'Team B',
      venue: 'National Stadium',
      match_date: '2025-08-11',
      match_time: '15:00',
      status: 'Live',
      home_score: 2,
      away_score: 1,
      remaining_time: '12:34',
      timer_running: true
    },
    {
      match_id: 'M002',
      home_team_name: 'Team C',
      away_team_name: 'Team D',
      venue: 'City Arena',
      match_date: '2025-08-12',
      match_time: '17:30',
      status: 'Upcoming'
    },
    {
      match_id: 'M003',
      home_team_name: 'Team E',
      away_team_name: 'Team F',
      venue: 'Olympic Field',
      match_date: '2025-08-10',
      match_time: '19:00',
      status: 'Finished',
      home_score: 4,
      away_score: 2
    },
    {
      match_id: 'M004',
      home_team_name: 'Team J',
      away_team_name: 'Team F',
      venue: 'Olympic Field',
      match_date: '2025-08-10',
      match_time: '19:00',
      status: 'Live',
      home_score: 0,
      away_score: 0,
      remaining_time: '12:34',
      timer_running: true
    }
  ]);

  console.log('Sample matches inserted');
  process.exit();
})
.catch(err => console.error(err));
