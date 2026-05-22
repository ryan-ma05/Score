const db = require('./db')

const OFFICIAL_GAMES = [
  // ── Drinking games ──────────────────────────────────────────────────────────
  {
    name: 'Beer Pong',
    category: 'Drinking game',
    specific_game: 'Cup Pong',
    player_count: '2–4 (teams of 1–2)',
    round_count: 'Until one team eliminates all cups',
    scoring_system:
      'Each cup sunk = 1 point. First team to sink all 10 opponent cups wins. Bonus: opponent re-racks on 6 and 3 cups remaining.',
    rules:
      'Arrange 10 cups in a triangle at each end of the table and fill each with a drink. Teams alternate throwing a ping-pong ball toward the opposing rack. When a cup is made, the defending team drinks it and removes it from the rack. If both teammates sink a cup on the same turn, the balls are returned and they shoot again ("heating up" / "on fire"). A player may call "Island" once per game when targeting a lone isolated cup — a make eliminates two cups; a miss forfeits the call. When the last cup is sunk the defending team gets a redemption round. If they tie, sudden-death overtime begins with 3 cups per side.',
  },
  {
    name: 'Flip Cup',
    category: 'Drinking game',
    specific_game: 'Flip Cup',
    player_count: '6–12 (teams of 3–6)',
    round_count: 'Best of 3 or first to agreed wins',
    scoring_system:
      'One point per round won. First team to win the agreed number of rounds wins the match. Track cumulative round wins.',
    rules:
      'Two equal teams line up on opposite sides of a table. Each player fills their cup with a set amount of drink. On "Go," the first player on each team drinks their cup, then places it face-up on the edge of the table and uses one hand to flip it so it lands face-down. Once their cup lands correctly, the next player on that team begins. The first team with all cups flipped wins the round. A player may keep trying on their own cup until it lands. No helping teammates. After each round, refill and repeat.',
  },
  {
    name: 'Kings Cup',
    category: 'Drinking game',
    specific_game: 'Kings Cup',
    player_count: '3–10',
    round_count: 'Until all 4 Kings are drawn',
    scoring_system:
      'No numeric score — last player to draw a King must drink the Kings Cup (penalty = 1). Track Kings drawn per player; drawing the 4th King = full Kings Cup.',
    rules:
      'Spread a shuffled deck face-down around a full cup in the center. Players take turns drawing. Ace = Waterfall (everyone drinks; you choose when to stop, then the next player can stop, etc.). 2 = You (pick someone to drink). 3 = Me (you drink). 4 = Floor (last to touch floor drinks). 5 = Guys drink. 6 = Girls drink. 7 = Heaven (last hand up drinks). 8 = Mate (choose a drinking buddy for the round). 9 = Rhyme (say a word; go around rhyming — first to fail drinks). 10 = Categories (name a category item; first to fail drinks). Jack = Make a Rule (lasts the game; breaking it = drink). Queen = Questions (start a question chain; first to answer non-question drinks). King = Pour some drink into the Kings Cup — whoever draws the 4th King drinks it all.',
  },
  // ── Card games ──────────────────────────────────────────────────────────────
  {
    name: 'Hearts',
    category: 'Card game',
    specific_game: 'Hearts',
    player_count: '4',
    round_count: 'Until any player reaches 100 points',
    scoring_system:
      'Each heart = 1 penalty point. Queen of Spades = 13 penalty points. Shooting the Moon: take all 13 hearts + Queen of Spades to give every other player 26 points instead. Lowest score wins.',
    rules:
      'Deal all 52 cards (13 each). Before each hand, players pass 3 cards: left → right → across → no pass, cycling each hand. The player holding the 2 of Clubs leads the first trick; everyone else must follow suit if possible. If unable to follow suit, any card may be played. Hearts may not be led until the suit is "broken" (a heart has been discarded on a previous trick, or a player has only hearts left). After all 13 tricks, count penalty cards. If one player takes all 13 hearts AND the Queen of Spades, that is "Shooting the Moon" — all others score 26 instead. Play until any player hits 100; the player with the lowest score wins.',
  },
  {
    name: 'Spades',
    category: 'Card game',
    specific_game: 'Spades',
    player_count: '4 (2 teams of 2)',
    round_count: 'First team to 500 points',
    scoring_system:
      'Meet bid: 10 × bid points + 1 per overtrick (bag). Every 10 accumulated bags = −100 points. Nil bid success = +100; failure = −100. Blind nil = ±200. First team to 500 points wins.',
    rules:
      'Deal 13 cards each. Each player bids the number of tricks they expect to win; partners\' bids add together. Spades always trump; they cannot lead until broken (spades played as a discard). Highest card of the led suit wins unless trumped. If a team meets their combined bid they score 10 × bid. Extra tricks ("bags") score 1 each but are dangerous: every 10 bags deduct 100 points. Nil bid: a player bids 0 — if they take no tricks, +100 for their team; any trick taken means −100. Blind Nil: bid before looking at cards for ±200. If a team fails their bid, no points are scored that round.',
  },
  {
    name: 'Cribbage',
    category: 'Card game',
    specific_game: 'Cribbage',
    player_count: '2–4',
    round_count: 'First to 121 points (or 61 in short game)',
    scoring_system:
      'Pegging: 2 for 15, 2 for pair, 6 for three-of-a-kind, 12 for four-of-a-kind, 1 per card in run of 3+, 2 for hitting 31, 1 for last card (Go). Hand count: same combos + flush (4+ of same suit). Nobs = 1 pt (Jack of starter suit in hand). Nibs = 2 pts (cut Jack).',
    rules:
      'Two players: deal 6 cards each; each discards 2 to the Crib (dealer\'s bonus hand). Cut the deck for the starter card — if it\'s a Jack, dealer pegs 2 (Nibs). Players alternate playing cards face-up, calling the running total aloud (must not exceed 31). Peg points for 15s, 31s, pairs, and runs as you go. Say "Go" when you can\'t play without exceeding 31; opponent finishes pegging then pegs 1 for last card. After all cards are played, count your hand using the starter card, then dealer counts the Crib. Move pegs on the board. First to reach or pass 121 wins — you can win mid-hand or mid-peg.',
  },
  // ── Sports ───────────────────────────────────────────────────────────────────
  {
    name: 'Pig',
    category: 'Sports',
    specific_game: 'Pig',
    player_count: '2–8',
    round_count: 'Until one player remains',
    scoring_system:
      'Players accumulate letters spelling P-I-G. Each missed challenge shot = one letter. Spelling PIG = eliminated. Last player standing wins. (Use H-O-R-S-E for a longer game.)',
    rules:
      'The starting player calls and successfully makes any shot from anywhere on the court. All other players must attempt the exact same shot from the exact same spot. Any player who misses earns the next letter in PIG. If the lead player misses their called shot, no letter is earned and the turn passes to the left — that player now calls the next shot. A player who spells PIG is out. If playing HORSE, spell all 5 letters. Special shots are allowed (behind the back, eyes closed, etc.) but must be exactly replicated. The last player without PIG wins.',
  },
  {
    name: 'Cornhole',
    category: 'Sports',
    specific_game: 'Cornhole',
    player_count: '2–4 (1v1 or 2v2)',
    round_count: 'First team/player to exactly 21 points',
    scoring_system:
      'Bag through the hole = 3 points. Bag resting on the board = 1 point. Cancellation scoring: subtract smaller total from larger total — only the leading side scores each round. First to exactly 21 wins; going over resets to 15 (bust rule).',
    rules:
      'Place boards 27 feet apart (hole end to hole end). In doubles, partners stand at opposite boards. Players alternate throwing 4 bags each toward the far board. A bag counts only if it was airborne before hitting the board; bags that bounce up from the ground are removed. After all 8 bags are thrown, apply cancellation scoring: each team totals their points, the lower total cancels the same amount from the higher total, and the net difference is awarded to the leading team. Bags hanging partially in the hole count as on-board (1 pt). Leaning bags count if they would fall in on their own; otherwise they are on-board. First team to reach exactly 21 wins. If a team goes over 21, they bust back to 15.',
  },
]

const insert = db.prepare(`
  INSERT OR IGNORE INTO games
    (name, category, specific_game, player_count, round_count, scoring_system, rules, source, moderation_status)
  VALUES
    (@name, @category, @specific_game, @player_count, @round_count, @scoring_system, @rules, 'official', 'approved')
`)

const seedAll = db.transaction(() => {
  let seeded = 0
  for (const game of OFFICIAL_GAMES) {
    const result = insert.run(game)
    if (result.changes > 0) seeded++
  }
  return seeded
})

const count = seedAll()
if (count > 0) {
  console.log(`Seeded ${count} official game(s).`)
}
