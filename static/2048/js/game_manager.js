function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.usedHint = false;
  this.startTiles     = 2;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

  this.setup(true);
}

// Restart the game
GameManager.prototype.restart = function () {
  this.usedHint = false;
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup(false);
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function (check_bestscore) {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;

    // Add the initial tiles
    this.addStartTiles();
  }

  if(check_bestscore)
  fetch('/get_high_score?game=2048')
  .then(response => response.json())
  .then(data => {
    this.storageManager.setBestScore(data.high_score || 0);
    this.actuate();
  });


  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  var currentBestScore = this.storageManager.getBestScore();

  if (this.score > currentBestScore) {
  this.storageManager.setBestScore(this.score);

  fetch('/update_score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `score=${this.score}&game=2048`
  });
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.isGameTerminated(),
    usedHint:   this.usedHint
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};

function scoreGrid(grid) {
  return (
    grid.availableCells().length * 10000 +
    getSmoothness(grid) * 1000 +
    getMonotonicity(grid) * 100 +
    getMaxTile(grid)
  );
}

function getSmoothness(grid) {
  // Чем меньше разрывов между соседями — тем лучше
  let smoothness = 0;
  for (let x = 0; x < grid.size; x++) {
    for (let y = 0; y < grid.size; y++) {
      let tile = grid.cells[x][y];
      if (!tile) continue;
      let value = Math.log2(tile.value);
      // Соседи справа и вниз
      for (let d of [{dx: 1, dy: 0}, {dx: 0, dy: 1}]) {
        let nx = x + d.dx, ny = y + d.dy;
        if (nx < grid.size && ny < grid.size && grid.cells[nx][ny]) {
          let neighborValue = Math.log2(grid.cells[nx][ny].value);
          smoothness -= Math.abs(value - neighborValue);
        }
      }
    }
  }
  return smoothness;
}

function getMonotonicity(grid) {
  // Чем ровнее увеличиваются/уменьшаются значения по строкам/столбцам — тем лучше
  let totals = [0, 0, 0, 0];
  for (let x = 0; x < grid.size; x++) {
    let current = 0;
    let next = current + 1;
    while (next < grid.size) {
      while (next < grid.size && !grid.cells[x][next]) next++;
      if (next >= grid.size) break;
      let currentValue = grid.cells[x][current] ? Math.log2(grid.cells[x][current].value) : 0;
      let nextValue = grid.cells[x][next] ? Math.log2(grid.cells[x][next].value) : 0;
      if (currentValue > nextValue) {
        totals[0] += nextValue - currentValue;
      } else if (nextValue > currentValue) {
        totals[1] += currentValue - nextValue;
      }
      current = next;
      next++;
    }
  }
  // Аналогично по столбцам (можно добавить)
  return Math.max(totals[0], totals[1]);
}

function getMaxTile(grid) {
  let max = 0;
  grid.eachCell(function(x, y, tile){
    if (tile && tile.value > max) max = tile.value;
  });
  return max;
}

function expectimax(grid, depth, isPlayerTurn) {
  if (depth === 0 || !grid.cellsAvailable()) {
    return scoreGrid(grid);
  }

  if (isPlayerTurn) {
    // Ходы игрока
    let max = -Infinity;
    for (let dir = 0; dir < 4; dir++) {
      let result = grid.testMove(dir);
      if (!result.moved) continue;
      let score = expectimax(result.grid, depth - 1, false);
      if (score > max) max = score;
    }
    return max;
  } else {
    // Ходы случайной плитки (2 и 4)
    let cells = grid.availableCells();
    if (!cells.length) return scoreGrid(grid);

    let totalScore = 0;
    let count = 0;
    for (let i = 0; i < cells.length; i++) {
      // Для 2
      let grid2 = grid.clone();
      let tile2 = new Tile(cells[i], 2);
      grid2.insertTile(tile2);
      totalScore += 0.9 * expectimax(grid2, depth - 1, true);
      count++;

      // Для 4
      let grid4 = grid.clone();
      let tile4 = new Tile(cells[i], 4);
      grid4.insertTile(tile4);
      totalScore += 0.1 * expectimax(grid4, depth - 1, true);
      count++;
    }
    return totalScore / (cells.length * (0.9+0.1)); // Нормируем на число ходов и вероятности
  }
}

// Главная функция поиска лучшего хода через expectimax
function findBestMoveExpectimax(grid, depth) {
  window.gameManager.usedHint = true;
  let bestDir = -1, bestScore = -Infinity;
  for (let dir = 0; dir < 4; dir++) {
    let result = grid.testMove(dir);
    if (!result.moved) continue;
    let score = expectimax(result.grid, depth - 1, false);
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  return bestDir;
}

document.querySelector('.hint-btn').addEventListener('click', function(){
  let bestMove = findBestMoveExpectimax(window.gameManager.grid, 5);
  if (bestMove !== -1) {
    window.gameManager.move(bestMove);
  }
});