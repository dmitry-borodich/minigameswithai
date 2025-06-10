
(function(){
    var state = 1;
    var puzzle = document.getElementById('puzzle');
    var moveCount = 0;
    var scoreDisplay = document.querySelector('.score-container');
    var bestScore = null;
    let usedHint = false;

    // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
    function getCell(row, col) {
        return document.getElementById('cell-'+row+'-'+col);
    }

    function getEmptyCell() {
        return puzzle.querySelector('.empty');
    }

    function getAdjacentCells(cell) {
        var id = cell.id.split('-');
        var row = parseInt(id[1]);
        var col = parseInt(id[2]);
        var adjacent = [];
        if(row < 3) adjacent.push(getCell(row+1, col));
        if(row > 0) adjacent.push(getCell(row-1, col));
        if(col < 3) adjacent.push(getCell(row, col+1));
        if(col > 0) adjacent.push(getCell(row, col-1));
        return adjacent;
    }

    function getEmptyAdjacentCell(cell) {
        var adjacent = getAdjacentCells(cell);
        for(var i = 0; i < adjacent.length; i++) {
            if(adjacent[i].className == 'empty') {
                return adjacent[i];
            }
        }
        return false;
    }

    function rand(from, to) {
        return Math.floor(Math.random() * (to - from + 1)) + from;
    }

    // ========== ФУНКЦИИ ДЛЯ РАБОТЫ С СОСТОЯНИЕМ ==========
    function saveGameState() {
        const cells = [];
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                const cell = getCell(i, j);
                cells.push({
                    id: cell.id,
                    className: cell.className,
                    textContent: cell.textContent,
                    left: cell.style.left,
                    top: cell.style.top
                });
            }
        }
        localStorage.setItem('15-puzzle-state', JSON.stringify({
            moveCount: moveCount,
            cells: cells,
            bestScore: bestScore
        }));
    }

    function loadGameState() {
        const savedState = localStorage.getItem('15-puzzle-state');
        const bestContainer = document.querySelector('.best-container');

        // Всегда сначала устанавливаем "-"
        bestContainer.textContent = "-";
        bestScore = null;

        if (savedState) {
            try {
                const parsedState = JSON.parse(savedState);
                moveCount = parsedState.moveCount || 0;
                scoreDisplay.textContent = moveCount;

                // Обрабатываем bestScore только если он есть и не 0
                if (parsedState.bestScore !== undefined && parsedState.bestScore !== null && parsedState.bestScore !== 0) {
                    const parsedBest = parseInt(parsedState.bestScore);
                    if (!isNaN(parsedBest)) {
                        bestScore = parsedBest;
                        bestContainer.textContent = bestScore;
                    }
                }

                if (parsedState.cells && parsedState.cells.length === 16) {
                    restorePuzzle(parsedState.cells);
                }
            } catch (e) {
                console.error('Failed to load saved state:', e);
            }
        }
        else {
            fetchBestScore();
            solve();
            scramble();
        }
    }

    async function fetchBestScore() {
        try {
            const response = await fetch('/get_high_score?game=15-puzzle');
            const data = await response.json();
            const bestContainer = document.querySelector('.best-container');

            // Обрабатываем ответ сервера
            if (data.high_score !== undefined && data.high_score !== null && data.high_score !== 0) {
                const dbBestScore = parseInt(data.high_score);
                bestScore = dbBestScore;
                bestContainer.textContent = bestScore;
                saveGameState();

            } else {
                bestContainer.textContent = "-";
            }
        } catch (error) {
            console.error('Error fetching high score:', error);
        }
    }

    function restorePuzzle(savedCells) {
        puzzle.innerHTML = '';
        savedCells.forEach(cellData => {
            const cell = document.createElement('span');
            cell.id = cellData.id;
            cell.className = cellData.className;
            cell.textContent = cellData.textContent;
            cell.style.left = cellData.left;
            cell.style.top = cellData.top;
            puzzle.appendChild(cell);
        });
    }

    // ========== ОСНОВНЫЕ ФУНКЦИИ ИГРЫ ==========
    function solve() {
        if(state == 0) return;
        usedHint = true;

        puzzle.innerHTML = '';
        // moveCount = 0;
        // scoreDisplay.textContent = moveCount;

        var n = 1;
        for(var i = 0; i <= 3; i++) {
            for(var j = 0; j <= 3; j++) {
                var cell = document.createElement('span');
                cell.id = 'cell-'+i+'-'+j;
                cell.style.left = (j*80+1*j+1)+'px';
                cell.style.top = (i*80+1*i+1)+'px';

                if(n <= 15) {
                    cell.classList.add('number');
                    cell.classList.add((i%2==0 && j%2>0 || i%2>0 && j%2==0) ? 'dark' : 'light');
                    cell.innerHTML = (n++).toString();
                } else {
                    cell.className = 'empty';
                }

                puzzle.appendChild(cell);
            }
        }
        saveGameState();
    }

    function shiftCell(cell) {
        if(cell.className != 'empty') {
            var emptyCell = getEmptyAdjacentCell(cell);
            if(emptyCell) {
                var tmp = {style: cell.style.cssText, id: cell.id};
                cell.style.cssText = emptyCell.style.cssText;
                cell.id = emptyCell.id;
                emptyCell.style.cssText = tmp.style;
                emptyCell.id = tmp.id;

                if(state == 1) {
                    moveCount++;
                    scoreDisplay.textContent = moveCount;
                    setTimeout(checkOrder, 150);
                }
                saveGameState();
            }
        }
    }

    function checkOrder() {
        if(getCell(3, 3).className != 'empty') return;

        var n = 1;
        for(var i = 0; i <= 3; i++) {
            for(var j = 0; j <= 3; j++) {
                if(n <= 15 && getCell(i, j).innerHTML != n.toString()) {
                    return;
                }
                n++;
            }
        }
        showWinOverlay();
    }

    function scramble() {
        if(state == 0) return;
        usedHint = flase;
        puzzle.removeAttribute('class');
        state = 0;
		moveCount = 0;
		scoreDisplay.textContent = moveCount;

        var previousCell;
        var i = 1;
        var interval = setInterval(function() {
            if(i <= 100) {
                var adjacent = getAdjacentCells(getEmptyCell());
                if(previousCell) {
                    for(var j = adjacent.length-1; j >= 0; j--) {
                        if(adjacent[j].innerHTML == previousCell.innerHTML) {
                            adjacent.splice(j, 1);
                        }
                    }
                }
                previousCell = adjacent[rand(0, adjacent.length-1)];
                shiftCell(previousCell);
                i++;
            } else {
                clearInterval(interval);
                state = 1;
            }
        }, 5);
    }


function showWinOverlay() {
    // Создаем оверлей с анимацией
    const overlay = document.createElement('div');
    overlay.className = 'win-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10';
    overlay.style.borderRadius = '4px';
    overlay.style.opacity = '0';

    // Анимация появления
    setTimeout(() => {
        overlay.style.transition = 'opacity 0.3s ease-out';
        overlay.style.opacity = '1';
    }, 10);

    // Создаем контейнер для сообщения
    const box = document.createElement('div');
    box.className = 'win-box';
    box.style.background = '#fff';
    box.style.padding = '20px 30px';
    box.style.borderRadius = '6px';
    box.style.textAlign = 'center';
    box.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
    box.style.maxWidth = '80%';
    box.style.transform = 'scale(0.9)';
    box.style.transition = 'transform 0.3s ease-out';

    setTimeout(() => {
        box.style.transform = 'scale(1)';
    }, 50);

    // Текст сообщения
    const msg = document.createElement('div');
    msg.innerText = 'Поздравляем! Вы решили головоломку!';
    msg.style.marginBottom = '15px';
    msg.style.fontSize = '18px';
    msg.style.fontWeight = 'bold';

    // Добавляем информацию о количестве ходов
    const movesInfo = document.createElement('div');
    movesInfo.innerText = `Количество ходов: ${moveCount}`;
    movesInfo.style.marginBottom = '15px';
    movesInfo.style.fontSize = '16px';

    // Проверяем и обновляем лучший счет
     const bestContainer = document.querySelector('.best-container');
        const currentBest = (bestScore !== null && !isNaN(bestScore) ? bestScore : Infinity);

        if (moveCount < currentBest) {
            bestScore = moveCount;
            bestContainer.textContent = bestScore;

            saveBestScore(bestScore);

            const bestScoreInfo = document.createElement('div');
            bestScoreInfo.innerText = 'Новый рекорд!';
            bestScoreInfo.style.color = '#ff5722';
            bestScoreInfo.style.fontWeight = 'bold';
            bestScoreInfo.style.marginBottom = '15px';
            box.appendChild(bestScoreInfo);
        }
    // Кнопка "Сыграть снова"
    const btn = document.createElement('button');
    btn.className = 'win-button';
    btn.innerText = 'Сыграть снова';
    btn.style.padding = '10px 20px';
    btn.style.fontSize = '16px';
    btn.style.cursor = 'pointer';
    btn.style.background = '#8f7a66';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '4px';
    btn.style.marginTop = '10px';
    btn.style.transition = 'background 0.2s';

    btn.addEventListener('mouseover', () => {
        btn.style.background = '#9f8b77';
    });

    btn.addEventListener('mouseout', () => {
        btn.style.background = '#8f7a66';
    });

    // Обработчик клика по кнопке
    btn.addEventListener('click', () => {
        overlay.style.opacity = '0';
        box.style.transform = 'scale(0.9)';
        setTimeout(() => {
            overlay.remove();
            scramble();
            moveCount = 0;
            scoreDisplay.textContent = moveCount;
        }, 300);
    });

    // Собираем все элементы вместе
    box.appendChild(msg);
    box.appendChild(movesInfo);
    box.appendChild(btn);
    overlay.appendChild(box);

    sendGameResult();

    if (getComputedStyle(puzzle).position === 'static') {
        puzzle.style.position = 'relative';
    }

    puzzle.appendChild(overlay);

    overlay.tabIndex = 0;
    overlay.focus();
}

async function sendGameResult() {
		  const data = {
			game: '15-puzzle',
			usedHint: usedHint,
			moveCount: moveCount
		  };
		  try {
			const response = await fetch('/api/game_result', {
			  method: 'POST',
			  headers: {'Content-Type': 'application/json'},
			  body: JSON.stringify(data)
			});
			if (response.ok) {
			  const res = await response.json();
			  if (res.coins !== undefined) {
			  window.parent.postMessage(
				  { type: 'toast', message: `Вы получили ${res.coins} ${res.pluralize_word}!`, toastType: 'success' },
				  '*'
				);
			  }
			}
		  } catch (e) {
		  }
		}

function bfsBestMove(board, empty, depth) {
    const queue = [];
    const visited = new Set();
    queue.push({board, empty, path: []});
    visited.add(board.join(','));

    let best = {score: manhattan(board), move: null};

    while (queue.length) {
        const {board: curBoard, empty: curEmpty, path} = queue.shift();
        if (path.length >= depth) continue;
        for (const move of getPossibleMoves(curBoard, curEmpty)) {
            // Получаем новое состояние
            const nextBoard = curBoard.slice();
            [nextBoard[curEmpty], nextBoard[move]] = [nextBoard[move], nextBoard[curEmpty]];
            const key = nextBoard.join(',');
            if (visited.has(key)) continue;
            visited.add(key);

            const newPath = path.concat([move]);
            const score = manhattan(nextBoard);
            if (score < best.score) {
                best = {score, move: newPath[0]};
            }
            queue.push({board: nextBoard, empty: move, path: newPath});
        }
    }
    return best.move;
}

document.getElementById('hint-btn').addEventListener('click', function() {
    if (state !== 1) return;
    const board = getBoardState();
    const empty = board.indexOf(0);
    const depth = 13; // ← больше глубина = больше вариантов, но медленнее!
    const move = bfsBestMove(board, empty, depth);
    if (move !== undefined && move !== null) {
        const row = Math.floor(move / 4);
        const col = move % 4;
        const cell = getCell(row, col);
        cell.style.boxShadow = '0 0 16px 6px #b5e61d';
        setTimeout(() => {
            cell.style.boxShadow = '';
            shiftCell(cell);
        }, 350);
    }
});

    // Манхэттенская эвристика
function manhattan(arr) {
    let sum = 0;
    for (let i = 0; i < 16; i++) {
        if (arr[i] === 0) continue;
        const target = arr[i] - 1;
        sum += Math.abs(Math.floor(i / 4) - Math.floor(target / 4))
             + Math.abs(i % 4 - target % 4);
    }
    return sum;
}

// Получить массив возможных индексов для сдвига
function getPossibleMoves(board, emptyIdx) {
    const moves = [];
    const row = Math.floor(emptyIdx / 4);
    const col = emptyIdx % 4;
    if (row > 0) moves.push(emptyIdx - 4);
    if (row < 3) moves.push(emptyIdx + 4);
    if (col > 0) moves.push(emptyIdx - 1);
    if (col < 3) moves.push(emptyIdx + 1);
    return moves;
}

// Получить текущее поле как массив
function getBoardState() {
    const board = [];
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            const cell = getCell(i, j);
            if (cell.className === 'empty') {
                board.push(0);
            } else {
                board.push(parseInt(cell.textContent, 10));
            }
        }
    }
    return board;
}

function saveBestScore(score) {
        return fetch('/update_score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `score=${score}&game=15-puzzle`
        });
    }

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    loadGameState();
    puzzle.addEventListener('click', function(e) {
        if(state == 1) {
            puzzle.className = 'animate';
            shiftCell(e.target);
        }
    });
    document.getElementById('solve').addEventListener('click', solve);
    document.getElementById('scramble').addEventListener('click', scramble);
    window.addEventListener('beforeunload', saveGameState);
})();