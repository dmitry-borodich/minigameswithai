function Grid(size, previousState) {
  this.size = size;
  this.cells = previousState ? this.fromState(previousState) : this.empty();
}

// Build a grid of the specified size
Grid.prototype.empty = function () {
  var cells = [];

  for (var x = 0; x < this.size; x++) {
    var row = cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(null);
    }
  }

  return cells;
};

Grid.prototype.fromState = function (state) {
  var cells = [];

  for (var x = 0; x < this.size; x++) {
    var row = cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      var tile = state[x][y];
      row.push(tile ? new Tile(tile.position, tile.value) : null);
    }
  }

  return cells;
};

// Find the first available random position
Grid.prototype.randomAvailableCell = function () {
  var cells = this.availableCells();

  if (cells.length) {
    return cells[Math.floor(Math.random() * cells.length)];
  }
};

Grid.prototype.availableCells = function () {
  var cells = [];

  this.eachCell(function (x, y, tile) {
    if (!tile) {
      cells.push({ x: x, y: y });
    }
  });

  return cells;
};

// Call callback for every cell
Grid.prototype.eachCell = function (callback) {
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      callback(x, y, this.cells[x][y]);
    }
  }
};

// Check if there are any cells available
Grid.prototype.cellsAvailable = function () {
  return !!this.availableCells().length;
};

// Check if the specified cell is taken
Grid.prototype.cellAvailable = function (cell) {
  return !this.cellOccupied(cell);
};

Grid.prototype.cellOccupied = function (cell) {
  return !!this.cellContent(cell);
};

Grid.prototype.cellContent = function (cell) {
  if (this.withinBounds(cell)) {
    return this.cells[cell.x][cell.y];
  } else {
    return null;
  }
};

// Inserts a tile at its position
Grid.prototype.insertTile = function (tile) {
  this.cells[tile.x][tile.y] = tile;
};

Grid.prototype.removeTile = function (tile) {
  this.cells[tile.x][tile.y] = null;
};

Grid.prototype.withinBounds = function (position) {
  return position.x >= 0 && position.x < this.size &&
         position.y >= 0 && position.y < this.size;
};

Grid.prototype.serialize = function () {
  var cellState = [];

  for (var x = 0; x < this.size; x++) {
    var row = cellState[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(this.cells[x][y] ? this.cells[x][y].serialize() : null);
    }
  }

  return {
    size: this.size,
    cells: cellState
  };
};

Grid.prototype.clone = function() {
  var newGrid = new Grid(this.size);
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      var tile = this.cells[x][y];
      if (tile) {
        newGrid.cells[x][y] = new Tile({x: x, y: y}, tile.value);
      } else {
        newGrid.cells[x][y] = null;
      }
    }
  }
  return newGrid;
};

// Возвращает true, если что-то изменилось
Grid.prototype.testMove = function(direction) {
  // Клонируем текущий grid
  var testManager = {
    grid: this.clone(),
    score: 0
  };

  // Копируем логику move из GameManager, но:
  // - НЕ добавляем случайную плитку
  // - НЕ трогаем this, только testManager

  var moved = false;
  var vector     = GameManager.prototype.getVector(direction);
  var traversals = GameManager.prototype.buildTraversals.call({size: this.size}, vector);

  // Save the current tile positions and remove merger information
  testManager.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });

  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      var cell = { x: x, y: y };
      var tile = testManager.grid.cellContent(cell);

      if (tile) {
        var positions = GameManager.prototype.findFarthestPosition.call({grid: testManager.grid}, cell, vector);
        var next      = testManager.grid.cellContent(positions.next);

        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];
          testManager.grid.insertTile(merged);
          testManager.grid.removeTile(tile);
          tile.updatePosition(positions.next);
          testManager.score += merged.value;
        } else {
          testManager.grid.cells[tile.x][tile.y] = null;
          testManager.grid.cells[positions.farthest.x][positions.farthest.y] = tile;
          tile.updatePosition(positions.farthest);
        }

        if (cell.x !== tile.x || cell.y !== tile.y) {
          moved = true;
        }
      }
    });
  });

  // Возвращаем новый grid и новые очки
  return {
    grid: testManager.grid,
    score: testManager.score,
    moved: moved
  };
};
