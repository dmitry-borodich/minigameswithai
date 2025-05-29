let bestScore = null;

$(function() {
  //The initial setup
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  async function fetchBestScore() {
        try {
            const response = await fetch('/get_high_score?game=checkers');
            const data = await response.json();
            const bestContainer = document.querySelector('.best-container');

            // Обрабатываем ответ сервера
            if (data.high_score !== undefined && data.high_score !== null && data.high_score !== 0) {
                const dbBestScore = parseInt(data.high_score);
                bestScore = dbBestScore;
                bestContainer.textContent = bestScore;
            } else {
                bestContainer.textContent = "-";
            }
        } catch (error) {
            console.error('Error fetching high score:', error);
        }
    }

    function showGameOverOverlay(isWin) {
    // Получаем позицию доски
    const boardElement = document.getElementById('board');
    const boardRect = boardElement.getBoundingClientRect();

    // Создаем оверлей
    const overlay = document.createElement('div');
    overlay.className = 'game-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = `${boardRect.top}px`;
    overlay.style.left = `${boardRect.left}px`;
    overlay.style.width = `${boardRect.width}px`;
    overlay.style.height = `${boardRect.height}px`;
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '100';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease-out';
    overlay.style.border = '10px solid #dcd6bc';
    overlay.style.boxSizing = 'border-box';

    // Контейнер сообщения
    const box = document.createElement('div');
    box.className = 'game-over-box';
    box.style.background = isWin ? 'rgba(60, 191, 113, 0.95)' : 'rgba(255, 60, 60, 0.95)';
    box.style.padding = '20px';
    box.style.borderRadius = '8px';
    box.style.textAlign = 'center';
    box.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
    box.style.maxWidth = '80%';
    box.style.transform = 'scale(0.9)';
    box.style.transition = 'all 0.3s ease-out';
    box.style.color = 'white';
    box.style.fontFamily = '"Clear Sans", "Helvetica Neue", Arial, sans-serif';

    // Текст сообщения
    const msg = document.createElement('h2');
    msg.innerText = isWin ? 'Поздравляем! Вы победили!' : 'Игра окончена! Вы проиграли!';
    msg.style.margin = '0 0 20px 0';
    msg.style.fontSize = '24px';
    msg.style.fontWeight = 'bold';

    // Иконка результата
    const icon = document.createElement('div');
    icon.style.fontSize = '40px';
    icon.style.marginTop = '10px';
    icon.style.lineHeight = '1';
    icon.innerText = isWin ? '🏆' : '❌';


    box.appendChild(icon);
    box.appendChild(msg);

    if (isWin) {
        const eloInfo = document.createElement('div');
    eloInfo.innerText = `Уровень игры противника: ${skill-2}`;
    eloInfo.style.marginBottom = '15px';
    eloInfo.style.fontSize = '16px';

    const bestContainer = document.querySelector('.best-container');
        const currentBest = (bestScore !== null && !isNaN(bestScore) ? bestScore : 0);

        if (skill-2 > currentBest) {
            bestScore = skill-2;
            bestContainer.textContent = bestScore;

            saveBestScore(bestScore);

            const bestScoreInfo = document.createElement('div');
            bestScoreInfo.innerText = 'Новый рекорд!';
            bestScoreInfo.style.color = '#ff5722';
            bestScoreInfo.style.fontWeight = 'bold';
            bestScoreInfo.style.marginBottom = '15px';
            box.appendChild(bestScoreInfo);
        }
        box.appendChild(eloInfo);
    }
    // Собираем элементы
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Анимация появления
    setTimeout(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'scale(1)';
    }, 10);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        }
    });

    // Закрытие по ESC
    overlay.tabIndex = 0;
    overlay.focus();
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        }
    });

     overlay.addEventListener('click', () => {
			overlay.style.opacity = '0';
			setTimeout(() => overlay.remove(), 300);
		  });

    // Обработчик ресайза
    const handleResize = () => {
        const newBoardRect = boardElement.getBoundingClientRect();
        overlay.style.top = `${newBoardRect.top}px`;
        overlay.style.left = `${newBoardRect.left}px`;
        overlay.style.width = `${newBoardRect.width}px`;
        overlay.style.height = `${newBoardRect.height}px`;
    };

    window.addEventListener('resize', handleResize);

    // Удаляем обработчик при закрытии
    const originalRemove = overlay.remove;
    overlay.remove = function() {
        window.removeEventListener('resize', handleResize);
        originalRemove.call(this);
    };
}

function saveBestScore(score) {
        return fetch('/update_score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `score=${score}&game=checkers`
        });
    }

var gameBoard = [
  [0, 2, 0, 2, 0, 2, 0, 2],
  [2, 0, 2, 0, 2, 0, 2, 0],
  [0, 2, 0, 2, 0, 2, 0, 2],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 1, 0, 1, 0, 1, 0],
  [0, 1, 0, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 0]
];
  //arrays to store the instances
  var pieces = [];
  var tiles = [];

  //distance formula
  var dist = function (x1, y1, x2, y2) {
    return Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2));
  }

  var skill = 5;
  const bestContainer = document.querySelector('.best-container');
  const scoreContainer = document.querySelector('.score-container');

  fetchBestScore();
  scoreContainer.textContent = skill;
  //Piece object - there are 24 instances of them in a checkers game
  function Piece(element, position) {
    // when jump exist, regular move is not allowed
    // since there is no jump at round 1, all pieces are allowed to move initially
    this.allowedtomove = true;
    //linked DOM element
    this.element = element;
    //positions on gameBoard array in format row, column
    this.position = position;
    //which player's piece i it
    this.player = '';
    //figure out player by piece id
    if (this.element.attr("id") < 12)
      this.player = 2;
    else
      this.player = 1;
    //makes object a king
    this.king = false;
    this.makeKing = function () {
      this.element.css("backgroundImage", "url('img/king" + this.player + ".png')");
      this.king = true;
    }
    //moves the piece
   this.move = function(tile) {
    this.element.removeClass('selected');
    if (!Board.isValidPlacetoMove(tile.position[0], tile.position[1])) {
      console.log("Invalid move: Tile is occupied or out of bounds");
      return false;
    }

    // Проверка направления (игрок 1 ходит вверх, ИИ — вниз)
    if (this.player === 1 && !this.king && tile.position[0] > this.position[0]) {
      console.log("Invalid move: Player 1 can only move up");
      return false;
    }
    if (this.player === 2 && !this.king && tile.position[0] < this.position[0]) {
      console.log("Invalid move: AI can only move down");
      return false;
    }

    // Обновляем доску и DOM
    Board.board[this.position[0]][this.position[1]] = 0;
    Board.board[tile.position[0]][tile.position[1]] = this.player;
    this.position = [tile.position[0], tile.position[1]];

    this.element.css({
      top: Board.dictionary[this.position[0]],
      left: Board.dictionary[this.position[1]]
    });

    if (!this.king && (this.position[0] === 0 || this.position[0] === 7)) {
      this.makeKing();
    }
    return true;
  };

    //tests if piece can jump anywhere
    this.canJumpAny = function () {
      return (this.canOpponentJump([this.position[0] + 2, this.position[1] + 2]) ||
          this.canOpponentJump([this.position[0] + 2, this.position[1] - 2]) ||
          this.canOpponentJump([this.position[0] - 2, this.position[1] + 2]) ||
          this.canOpponentJump([this.position[0] - 2, this.position[1] - 2]))
    };

    //tests if an opponent jump can be made to a specific place
    this.canOpponentJump = function(newPosition) {
      var dx = newPosition[1] - this.position[1];
      var dy = newPosition[0] - this.position[0];

      // Проверка направления
      if (!this.king) {
        if (this.player === 1 && dy > 0) return false; // Игрок (снизу) ходит вверх (dy < 0)
        if (this.player === 2 && dy < 0) return false; // ИИ (сверху) ходит вниз (dy > 0)
      }

      // Проверка границ
      if (newPosition[0] > 7 || newPosition[1] > 7 || newPosition[0] < 0 || newPosition[1] < 0)
        return false;

      var tileToCheckx = this.position[1] + dx / 2;
      var tileToChecky = this.position[0] + dy / 2;

      if (tileToCheckx > 7 || tileToChecky > 7 || tileToCheckx < 0 || tileToChecky < 0)
        return false;

      if (!Board.isValidPlacetoMove(tileToChecky, tileToCheckx) &&
          Board.isValidPlacetoMove(newPosition[0], newPosition[1])) {
        for (let pieceIndex in pieces) {
          if (pieces[pieceIndex].position[0] == tileToChecky &&
              pieces[pieceIndex].position[1] == tileToCheckx &&
              this.player != pieces[pieceIndex].player) {
            return pieces[pieceIndex];
          }
        }
      }
      return false;
    };

    this.opponentJump = function (tile) {
      var pieceToRemove = this.canOpponentJump(tile.position);
      //if there is a piece to be removed, remove it
      if (pieceToRemove) {
        pieceToRemove.remove();
        return true;
      }
      return false;
    };

    this.remove = function () {
      //remove it and delete it from the gameboard
      this.element.css("display", "none");
      if (this.player == 1) {
        $('#player2').append("<div class='capturedPiece'></div>");
        Board.score.player2 += 1;
      }
      if (this.player == 2) {
        $('#player1').append("<div class='capturedPiece'></div>");
        Board.score.player1 += 1;
      }
      Board.board[this.position[0]][this.position[1]] = 0;
      //reset position so it doesn't get picked up by the for loop in the canOpponentJump method
      this.position = [];
      var playerWon = Board.checkifAnybodyWon();
      if (playerWon) {
        let isWin = playerWon === 1;
        showGameOverOverlay(isWin);
      }
    }
  }

  function Tile(element, position) {
    //linked DOM element
    this.element = element;
    //position in gameboard
    this.position = position;
    //if tile is in range from the piece
    this.inRange = function (piece) {
      for (let k of pieces)
        if (k.position[0] == this.position[0] && k.position[1] == this.position[1]) return 'wrong';
      if (!piece.king && piece.player == 1 && this.position[0] > piece.position[0]) return 'wrong';
      if (!piece.king && piece.player == 2 && this.position[0] < piece.position[0]) return 'wrong';
      if (dist(this.position[0], this.position[1], piece.position[0], piece.position[1]) == Math.sqrt(2)) {
        //regular move
        return 'regular';
      } else if (dist(this.position[0], this.position[1], piece.position[0], piece.position[1]) == 2 * Math.sqrt(2)) {
        //jump move
        return 'jump';
      }
    };
  }

  //Board object - controls logistics of game
  var Board = {
    board: gameBoard,
    score: {
      player1: 0,
      player2: 0
    },
    playerTurn: 1,
    jumpexist: false,
    continuousjump: false,
    tilesElement: $('div.tiles'),
    //dictionary to convert position in Board.board to the viewport units
    dictionary: ["0px", "62.5px", "125px", "187.5px", "250px", "312.5px", "375px", "437.5px"],
    //initialize the 8x8 board
    initalize: function () {
      var countPieces = 0;
      var countTiles = 0;
      for (let row in this.board) { //row is the index
        for (let column in this.board[row]) { //column is the index
          //whole set of if statements control where the tiles and pieces should be placed on the board
          if (row % 2 == 1) {
            if (column % 2 == 0) {
              countTiles = this.tileRender(row, column, countTiles)
            }
          } else {
            if (column % 2 == 1) {
              countTiles = this.tileRender(row, column, countTiles)
            }
          }
          if (this.board[row][column] == 1) {
            countPieces = this.playerPiecesRender(1, row, column, countPieces)
          } else if (this.board[row][column] == 2) {
            countPieces = this.playerPiecesRender(2, row, column, countPieces)
          }
        }
      }
    },
    setSkillLevel: function(newSkill) {
        skill = newSkill;

        if (skill < 1) skill = 1;
        if (skill > 10) skill = 10;

        scoreContainer.textContent = skill;
        skill+=2;
    },
     makeAIMove: async function() {
      if (this.playerTurn === 2 && !this.checkifAnybodyWon()) {
        setTimeout(async () => {
          var bestMove = this.findBestMove(skill);
          if (bestMove) {
            await this.executeAIMove(bestMove);
            $('.turn').css("background", "linear-gradient(to right, #BEEE62 50%, transparent 50%)");
          }
        }, 500);
      }
    },

    // Находит лучший ход с помощью алгоритма Minimax
    findBestMove: function(depth) {
      var validMoves = this.getAllValidMoves(2);
      var bestScore = -Infinity;
      var bestMove = null;

      for (var i = 0; i < validMoves.length; i++) {
        var move = validMoves[i];
        // Применяем ход
        var originalBoard = JSON.parse(JSON.stringify(this.board));
        var originalPieces = this.clonePiecesState();

        this.applyMove(move);

        // Оцениваем ход
        var score = this.minimax(depth - 1, false, -Infinity, Infinity);

        // Отменяем ход
        this.revertMove(move, originalBoard, originalPieces);

        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }

      return bestMove;
    },

    // Алгоритм Minimax с альфа-бета отсечением
    minimax: function(depth, isMaximizing, alpha, beta) {
    if (depth === 0) {
      return this.evaluateBoard();
    }

    var currentPlayer = isMaximizing ? 2 : 1;
    var validMoves = this.getAllValidMoves(currentPlayer);

    if (validMoves.length === 0) {
      return isMaximizing ? -1000 : 1000; // Шах и мат
    }

    if (isMaximizing) {
      var maxEval = -Infinity;
      for (var i = 0; i < validMoves.length; i++) {
        var move = validMoves[i];
        var boardCopy   = JSON.parse(JSON.stringify(this.board));
        var piecesCopy  = this.clonePiecesState();

        this.applyMove(move);
        var eval = this.minimax(depth - 1, false, alpha, beta);
        this.revertMove(move, boardCopy, piecesCopy);

        maxEval = Math.max(maxEval, eval);
        alpha = Math.max(alpha, eval);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      var minEval = Infinity;
      for (var i = 0; i < validMoves.length; i++) {
        var move = validMoves[i];
        var boardCopy   = JSON.parse(JSON.stringify(this.board));
        var piecesCopy  = this.clonePiecesState();
        this.applyMove(move);
        var eval = this.minimax(depth - 1, true, alpha, beta);
        this.revertMove(move, boardCopy, piecesCopy);

        minEval = Math.min(minEval, eval);
        beta = Math.min(beta, eval);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  },

    // Оценка текущего состояния доски
    evaluateBoard: function() {
      var score = 0;

      for (var i = 0; i < pieces.length; i++) {
        var piece = pieces[i];
        if (piece.position.length === 0) continue; // Пропускаем съеденные фигуры

        var value = piece.king ? 3 : 1;
        if (piece.player === 2) { // Бот
          score += value;
          // Дополнительные очки за центральные позиции
          if (piece.position[0] >= 3 && piece.position[0] <= 4 &&
              piece.position[1] >= 3 && piece.position[1] <= 4) {
            score += 0.1;
          }
        } else { // Игрок
          score -= value;
        }
      }

      return score;
    },

    // Получает все возможные ходы для игрока
    getAllValidMoves: function(player) {
      var moves = [];
      var hasJump = false;

      // Сначала проверяем есть ли обязательные прыжки
      for (var i = 0; i < pieces.length; i++) {
        var piece = pieces[i];
        if (piece.position.length === 0 || piece.player !== player) continue;

        if (piece.canJumpAny()) {
          hasJump = true;
          break;
        }
      }

      // Собираем все возможные ходы
      for (var i = 0; i < pieces.length; i++) {
        var piece = pieces[i];
        if (piece.position.length === 0 || piece.player !== player) continue;

        // Проверяем все возможные направления
        var directions = [];
        if (piece.king || player === 1) directions.push([-1, 1], [-1, -1]);
        if (piece.king || player === 2) directions.push([1, 1], [1, -1]);

        for (var j = 0; j < directions.length; j++) {
          var dir = directions[j];
          var newRow = piece.position[0] + dir[0];
          var newCol = piece.position[1] + dir[1];

          // Проверяем обычный ход
          if (!hasJump && this.isValidPlacetoMove(newRow, newCol)) {
            moves.push({
              piece: piece,
              to: [newRow, newCol],
              isJump: false
            });
          }

          // Проверяем прыжок
          var jumpRow = piece.position[0] + 2 * dir[0];
          var jumpCol = piece.position[1] + 2 * dir[1];
          if (this.isValidPlacetoMove(jumpRow, jumpCol)) {
            var midRow = piece.position[0] + dir[0];
            var midCol = piece.position[1] + dir[1];
            if (!this.isValidPlacetoMove(midRow, midCol)) {
              for (var k = 0; k < pieces.length; k++) {
                var otherPiece = pieces[k];
                if (otherPiece.position.length > 0 &&
                    otherPiece.position[0] === midRow &&
                    otherPiece.position[1] === midCol &&
                    otherPiece.player !== player) {
                  moves.push({
                    piece: piece,
                    to: [jumpRow, jumpCol],
                    isJump: true,
                    captured: otherPiece
                  });
                  break;
                }
              }
            }
          }
        }
      }

      // Если есть прыжки, оставляем только их
      if (hasJump) {
        moves = moves.filter(move => move.isJump);
      }

      return moves;
    },

    // Применяет ход к доске (для Minimax)
   applyMove: function(move) {
    var piece = move.piece;
    var to = move.to;

    // Обновляем доску
    this.board[piece.position[0]][piece.position[1]] = 0;
    this.board[to[0]][to[1]] = piece.player;

    // Обновляем позицию фигуры
    piece.position = [to[0], to[1]];

    // Если был прыжок, удаляем съеденную фигуру
    if (move.isJump && move.captured) {
      move.captured.originalPosition = move.captured.position.slice();
      move.captured.position = [];
      this.board[move.captured.originalPosition[0]][move.captured.originalPosition[1]] = 0;
    }

    // Проверяем, стала ли фигура дамкой
    if (!piece.king && (to[0] === 0 || to[0] === 7)) {
      piece.king = true;
    }
  },

    // Отменяет ход (для Minimax)
    revertMove: function(move, originalBoard, originalPieces) {
      // Восстановление доски
      this.board = JSON.parse(JSON.stringify(originalBoard));

      // Восстановление фигур
      for (let i = 0; i < pieces.length; i++) {
        pieces[i].position = originalPieces[i].position.slice();
        pieces[i].king = originalPieces[i].king;
      }
    },

    // Клонирует состояние фигур (для Minimax)
    clonePiecesState: function() {
      return pieces.map(p => ({
        position: p.position.slice(),
        king: p.king,
        player: p.player
      }));
    },

    // Выполняет ход бота
   executeAIMove: async function(move) {
      var piece = move.piece;
      var tile = this.findTileByPosition(move.to[0], move.to[1]);
      $('.piece').removeClass('selected');
      piece.element.addClass('selected');
      if (move.isJump) {
        piece.opponentJump(tile);
      }
      piece.move(tile);
      await sleep(300);
      if (move.isJump && piece.canJumpAny()) {
        var nextJump = this.findNextJump(piece);
        if (nextJump) {
          await this.executeAIMove(nextJump);
          return;
        }
      }
      this.playerTurn = 1;
    },

    // Находит плитку по позиции
    findTileByPosition: function(row, col) {
      for (var i = 0; i < tiles.length; i++) {
        if (tiles[i].position[0] === row && tiles[i].position[1] === col) {
          return tiles[i];
        }
      }
      return null;
    },

    // Находит следующий прыжок для фигуры
    findNextJump: function(piece) {
      var moves = this.getAllValidMoves(piece.player);
      for (var i = 0; i < moves.length; i++) {
        if (moves[i].piece === piece && moves[i].isJump) {
          return moves[i];
        }
      }
      return null;
    },
    tileRender: function (row, column, countTiles) {
      this.tilesElement.append("<div class='tile' id='tile" + countTiles + "' style='top:" + this.dictionary[row] + ";left:" + this.dictionary[column] + ";'></div>");
      tiles[countTiles] = new Tile($("#tile" + countTiles), [parseInt(row), parseInt(column)]);
      return countTiles + 1
    },

    playerPiecesRender: function (playerNumber, row, column, countPieces) {
      $(`.player${playerNumber}pieces`).append("<div class='piece' id='" + countPieces + "' style='top:" + this.dictionary[row] + ";left:" + this.dictionary[column] + ";'></div>");
      pieces[countPieces] = new Piece($("#" + countPieces), [parseInt(row), parseInt(column)]);
      return countPieces + 1;
    },
    //check if the location has an object
    isValidPlacetoMove: function (row, column) {
      // console.log(row); console.log(column); console.log(this.board);
      if (row < 0 || row > 7 || column < 0 || column > 7) return false;
      if (this.board[row][column] == 0) {
        return true;
      }
      return false;
    },
    //change the active player - also changes div.turn's CSS
    changePlayerTurn: function() {
      // Clear any selections
      $('.piece').removeClass('selected');

      if (this.playerTurn == 1) {
        this.playerTurn = 2;
        $('.turn').css("background", "linear-gradient(to right, transparent 50%, #BEEE62 50%)");
        this.makeAIMove();
      } else {
        this.playerTurn = 1;
        $('.turn').css("background", "linear-gradient(to right, #BEEE62 50%, transparent 50%)");
        // Reset jump flags for player's turn
        this.jumpexist = false;
        this.continuousjump = false;
        this.check_if_jump_exist();
      }
    },
    checkifAnybodyWon: function () {
      if (this.score.player1 == 12) {
        return 1;
      } else if (this.score.player2 == 12) {
        return 2;
      }
      return false;
    },

    //reset the game
    clear: function () {
      Board.setSkillLevel(parseInt(document.getElementById("skillLevel").value, 10));
      $('.piece').remove();
      $('.tile').remove();
      $('.capturedPiece').remove();
      $('#winner').html('');

      // Сброс начальной доски
      Board.board = [
        [0, 2, 0, 2, 0, 2, 0, 2],
        [2, 0, 2, 0, 2, 0, 2, 0],
        [0, 2, 0, 2, 0, 2, 0, 2],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 1, 0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0, 1, 0, 1],
        [1, 0, 1, 0, 1, 0, 1, 0]
      ];

      // Очистка массивов и счёта
      pieces.length = 0;
      tiles.length = 0;
      Board.score.player1 = 0;
      Board.score.player2 = 0;
      Board.playerTurn = 1;
      Board.jumpexist = false;
      Board.continuousjump = false;

      // Повторная инициализация
      Board.initalize();
    },
   check_if_jump_exist: function() {
      this.jumpexist = false;
      this.continuousjump = false;

      // First reset all pieces
      for (let k of pieces) {
        k.allowedtomove = false;
      }

      // Check for jumps
      for (let k of pieces) {
        if (k.position.length != 0 && k.player == this.playerTurn && k.canJumpAny()) {
          this.jumpexist = true;
          k.allowedtomove = true;
        }
      }

      // If no jumps, allow all pieces to move
      if (!this.jumpexist) {
        for (let k of pieces) {
          if (k.position.length != 0 && k.player == this.playerTurn) {
            k.allowedtomove = true;
          }
        }
      }
    },
    // Possibly helpful for communication with back-end.
    str_board: function () {
      ret = ""
      for (let i in this.board) {
        for (let j in this.board[i]) {
          var found = false
          for (let k of pieces) {
            if (k.position[0] == i && k.position[1] == j) {
              if (k.king) ret += (this.board[i][j] + 2)
              else ret += this.board[i][j]
              found = true
              break
            }
          }
          if (!found) ret += '0'
        }
      }
      return ret
    }
  }

  //initialize the board
  Board.initalize();

  /***
   Events
   ***/

  //select the piece on click if it is the player's turn
  /*$('.piece').on("click", function () {
    if (Board.playerTurn === 2) return;
    var selected;
    var isPlayersTurn = ($(this).parent().attr("class").split(' ')[0] == "player" + Board.playerTurn + "pieces");
    if (isPlayersTurn) {
      if (!Board.continuousjump && pieces[$(this).attr("id")].allowedtomove) {
        if ($(this).hasClass('selected')) selected = true;
        $('.piece').each(function (index) {
          $('.piece').eq(index).removeClass('selected')
        });
        if (!selected) {
          $(this).addClass('selected');
        }
      } else {
        let exist = "jump exist for other pieces, that piece is not allowed to move"
        let continuous = "continuous jump exist, you have to jump the same piece"
        let message = !Board.continuousjump ? exist : continuous
        console.log(message)
      }
    }
  });*/
  $('.player1pieces, .player2pieces').on("click", ".piece", function () {
  if (Board.playerTurn === 2) return;

  // Обновляем флаги перед выбором
  Board.check_if_jump_exist();

  const id = $(this).attr("id");
  const isPlayersTurn = $(this).parent().hasClass("player" + Board.playerTurn + "pieces");
  if (!isPlayersTurn) return;

  // Если нет «продолжающегося» прыжка и эта фигура ходить может
  if (!Board.continuousjump && pieces[id].allowedtomove) {
    // Снимаем выделение со всех, ставим на эту
    $('.piece').removeClass('selected');
    $(this).addClass('selected');
  } else {
    const msg = Board.continuousjump
      ? "continuous jump exist, you have to jump the same piece"
      : "jump exist for other pieces, that piece is not allowed to move";
    console.log(msg);
  }
});


  //reset game when clear button is pressed
  $('#cleargame').on("click", function () {
    Board.clear();
  });

  //move piece when tile is clicked
  $('.tiles').on("click", ".tile", function () {
    if (Board.playerTurn === 2) return;

    var selectedPiece = $('.selected');
    if (selectedPiece.length !== 0) {
      var tileID = $(this).attr("id").replace(/tile/, '');
      var tile = tiles[tileID];
      var piece = pieces[selectedPiece.attr("id")];
      var inRange = tile.inRange(piece);

      if (inRange === 'wrong') return;

      if (inRange === 'jump') {
        if (piece.opponentJump(tile)) {
          if (piece.move(tile)) {
            if (piece.canJumpAny()) {
              Board.continuousjump = true;
              piece.element.addClass('selected');
            } else {
              Board.changePlayerTurn();
            }
          }
        }
      } else if (inRange === 'regular') {
        if (!Board.jumpexist && piece.move(tile)) {
          Board.changePlayerTurn();
        }
      }
    }
  });

});