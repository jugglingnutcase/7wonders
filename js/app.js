document.addEventListener('DOMContentLoaded', function() {
  var gData
  // https://docs.google.com/spreadsheets/d/1Whyq_IPIWrm7L6qTeu4IuSQ2RWnwtfwWiVwhA-jGEtQ/pubhtml
  var key = 'https://docs.google.com/spreadsheet/pub?key=0AmhWglGO45rldFBiek84a1FHRmhPQjZaVzRSRGJZbXc&output=html'
  Tabletop.init({
    key: key,
    callback: loaded
  });
});

var models
  , games = []
  , people = []
  , winners = []
  , players
  , locations
  , gameDateFormat = d3.time.format('%Y-%m-%d')

function loaded(data, tabletop) {
  // i'm getting TableTop models because i want to see all the sheets
  models = data;

  // Enumerate through the sheets
  for (var key in models) {
    // Discard the template sheet
    if (models.hasOwnProperty(key) && key !== 'Template') {

      var date = gameDateFormat.parse(key.slice(0, 10));
      var gameNumberString = (key.length > 10) ? key.slice(10): 1;

      var game = {
        "date": date,
        "gameNumber": gameNumberString,
        "players": models[key].elements,
        "totalPoints": models[key].elements.reduce(function(prev, curr) {
          return prev + +curr.total; 
        }, 0)
      };

      var highScore = d3.max(game.players, function(player) {
        return player.total
      })

      winners.push({ 'date': game.date,
                     'winner': game.players.filter(function (player) { return player.total === highScore })[0],
                     'score': highScore });
      people = people.concat(models[key].elements);
      games.push(game);
    }
  }

  // Show the games calendar
  createGameCalendar(games);

  // Boil down locations
  locations = d3.nest()
    .key(function(player) {
      return player.location
    })
    .entries(people);

  // Show the player blocks
  players = d3.nest()
    .key(function(player) { return player.name })
    .sortKeys(d3.ascending)
    .entries(people);

  // Slice up players into pairs for smaller blocks
  var slicedPlayers = [],
      playersPerGroup = 3;

  for (var i = 0; i < players.length + playersPerGroup; i = i + playersPerGroup) {
    slicedPlayers.push(players.slice(i, i + playersPerGroup));
  }

  // Now we get to the fun part?
  d3.select('#totalPoints')
    .text(games.reduce(function(prev, curr) {
      return prev + curr.totalPoints;
    }, 0))
    .attr('class', 'bold');

  d3.select('#totalGames')
    .text(games.length)
    .attr('class', 'bold');

  d3.select('#totalPlayers')
    .text(players.length)
    .attr('class', 'bold');

  d3.select('#totalLocations')
    .text(locations.length)
    .attr('class', 'bold');

  // Winning wonders
  winnings = d3.nest()
    .key(function(win) {
      return win.winner.wonder
    })
    .entries(winners);

  // Which wonder wins the most?
  var maxGamesWon = d3.max(winnings, function(win) { return win.values.length })
  var winningWondersString = winnings.filter(function(winning) {
      return winning.values.length == maxGamesWon
    })
    .map(function(win) {
      return win.key
    })
    .reduce(function(a, b) {
      return a + ', ' + b
    });

  d3.select('#winningWonder')
    .text(winningWondersString)
    .attr('class', 'bold');

  d3.select('#winningWonderPercentage')
    .text(((maxGamesWon / games.length) * 100) + '%')
    .attr('class', 'bold');

  var playerList = d3.select('#players')
    .append('div')
    .attr('id', 'playerList')

  // Create a row for every two players
  var playerRow = playerList.selectAll('div')
      .data(slicedPlayers)
    .enter().append('div')
      .attr('class', 'grid')

  // Each player gets their own little block with their own geopattern
  var playerBlock = playerRow.selectAll('div')
      .data(function(d) { return d; })
    .enter().append('div')
      .attr('class', 'unit one-third')
    .append('div')
      .attr('class', 'player rounded center-text')
      .style('background-image', function(player) {
        var pattern = GeoPattern.generate(player.key);
        return pattern.toDataUrl()
      })

    playerBlock.append('h3').append('a')
      .style('color', 'white')
      .attr('class', 'player')
      .attr('href', function(player) {
        return '#' + player.key
      })
      .text(function(player) {
        return player.key
      })
      .on('click', showUser)

  playerBlock.append('h4')
      .text(function(player) {
        var plural = (player.values.length > 1) ? 's' : ''
        return player.values.length + ' game' + plural
      })

  playerBlock.append('p')
      .text(function(player) {
        var totalPoints = player.values.reduce(function(prev, curr) {
          return prev + (+curr.total)
        }, 0);
        return totalPoints + ' points'
      })

  playerBlock.append('p')
      .text(function(player) {
        var totalPoints = player.values.reduce(function(prev, curr) {
          return prev + (+curr.total)
        }, 0);

        var avgPointsPerGame = totalPoints / player.values.length
        return numeral(avgPointsPerGame).format('0[.]00') + ' points per game'
      })
}

function showUser(data) {
  console.log(data);

  var selectedPlayer = d3.select('#selectedPlayer');
}

// Game calendar. Cribbed from http://bl.ocks.org/mbostock/4063318
function createGameCalendar(games) {
  var width = 960,
      height = 136,
      cellSize = 17; // cell size

  var day = d3.time.format("%w"),
      week = d3.time.format("%U"),
      format = d3.time.format("%Y-%m-%d");

  var color = d3.scale.quantize()
      .domain([-.05, .05])
      .range(d3.range(11).map(function(d) { return "q" + d + "-11"; }));

  // Get date range of games
  var byYear = function(game) {
    return game.date.getUTCFullYear();
  }

  var yearRange = d3.range(d3.min(games, byYear),
                           d3.max(games, byYear) + 1);

  // Make a calendar for each year in our game date range
  var svg = d3.select("#calendar").selectAll("svg")
      .data(yearRange)
    .enter().append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("class", "RdYlGn")
    .append("g")
      .attr("transform", "translate(" + ((width - cellSize * 53) / 2) + "," + (height - cellSize * 7 - 1) + ")");

  svg.append("text")
      .attr("transform", "translate(-6," + cellSize * 3.5 + ")rotate(-90)")
      .style("text-anchor", "middle")
      .text(function(d) { return d; });

  var rect = svg.selectAll(".day")
      .data(function(d) { return d3.time.days(new Date(d, 0, 1), new Date(d + 1, 0, 1)); })
    .enter().append("rect")
      .attr("class", "day")
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("x", function(d) { return week(d) * cellSize; })
      .attr("y", function(d) { return day(d) * cellSize; })
      .datum(format);

  rect.append("title")
      .text(function(d) { return d; });

  svg.selectAll(".month")
      .data(function(d) { return d3.time.months(new Date(d, 0, 1), new Date(d + 1, 0, 1)); })
    .enter().append("path")
      .attr("class", "month")
      .attr("d", monthPath);

  // Fill in the calendar day rects
  var gameDates = games.map(function(game) {
    return format(game.date)
  });

  rect.filter(function(d) {
        return gameDates.indexOf(d) !== -1
      })
      .attr("class", function(d) {
        var gameCount = games.filter(function(game) { return format(game.date) == d })
        return "day " + color(gameCount.length);
      })
    .select("title")
      .text(function(d) {
        var gameCount = games.filter(function(game) { return format(game.date) == d })
        return d + ": " + gameCount.length + ' ' + ((gameCount.length > 1) ? 'games': 'game');
      });

  function monthPath(t0) {
    var t1 = new Date(t0.getFullYear(), t0.getMonth() + 1, 0),
        d0 = +day(t0), w0 = +week(t0),
        d1 = +day(t1), w1 = +week(t1);
    return "M" + (w0 + 1) * cellSize + "," + d0 * cellSize
        + "H" + w0 * cellSize + "V" + 7 * cellSize
        + "H" + w1 * cellSize + "V" + (d1 + 1) * cellSize
        + "H" + (w1 + 1) * cellSize + "V" + 0
        + "H" + (w0 + 1) * cellSize + "Z";
  }

  // d3.select(self.frameElement).style("height", "2910px");
}
