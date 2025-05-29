document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('.grid');
  const flagsLeft = document.querySelector('#flags-left');
  const result = document.querySelector('#result');
  const timeDisplay = document.querySelector('#time');
  const bestContainer = document.querySelector('.best-container');

  let width;
  let bombAmount;
  let flags = 0;
  let squares = [];
  let isGameOver = false;
  let firstClick = true;
  let currentDifficulty = 'easy';
  let timer;
  let seconds = 0;
  let gameState = null;
  let loadedBestTimes = {
    easy: null,
    medium: null,
    hard: null,
    veryHard: null
  };


  const difficulties = {
    easy: { width: 8, bombs: 10 },
    medium: { width: 10, bombs: 16 },
    hard: { width: 12, bombs: 35 },
    veryHard: { width: 15, bombs: 50 }
  };

  // Загружаем состояние из localStorage

  loadGameState();

  document.querySelector('.js-generate-board-btn--easy')
    .addEventListener('click', () => startGame('easy'));
  document.querySelector('.js-generate-board-btn--medium')
    .addEventListener('click', () => startGame('medium'));
  document.querySelector('.js-generate-board-btn--hard')
    .addEventListener('click', () => startGame('hard'));
  document.querySelector('.js-generate-board-btn--very-hard')
    .addEventListener('click', () => startGame('veryHard'));

  document.getElementById('hint-btn').addEventListener('click', logicHint);

/*function giveHint() {
  if (isGameOver) return;
  // Находим все неоткрытые и не заминированные клетки
  let safeCells = squares.filter(sq =>
    !sq.classList.contains('checked') &&
    !sq.classList.contains('bomb') &&
    !sq.classList.contains('flag')
  );
  if (safeCells.length === 0) return;
  // Можно выбрать случайную, а можно первую
  const toOpen = safeCells[Math.floor(Math.random() * safeCells.length)];
  click(toOpen);
  // Можно добавить анимацию подсказки (например, подсветить клетку)
  toOpen.style.boxShadow = '0 0 8px 4px #BEEE62';
  setTimeout(() => toOpen.style.boxShadow = '', 1000);
}*/
  function logicHint() {
  for (let i = 0; i < squares.length; i++) {
    let sq = squares[i];
    if (!sq.classList.contains('checked')) continue;
    let number = parseInt(sq.getAttribute('data'));
    if (!number || number === 0) continue;

    // Посчитать флаги и неизвестные вокруг
    let neighbors = getNeighbors(i);
    let flagsCount = neighbors.filter(n => n.classList.contains('flag')).length;
    let unknowns = neighbors.filter(n =>
      !n.classList.contains('checked') &&
      !n.classList.contains('flag')
    );
    if (unknowns.length === 0) continue;

    // Если все неизвестные — мины
    if (number - flagsCount === unknowns.length) {
      unknowns.forEach(n => {
        n.style.boxShadow = '0 0 10px 2px #FF5722';
        // Можно автоматически поставить флаг: addFlag(n);
        setTimeout(() => n.style.boxShadow = '', 1000);
      });
      return;
    }
    // Если все флаги поставлены, остальные безопасны
    if (flagsCount === number) {
      unknowns.forEach(n => {
        n.style.boxShadow = '0 0 10px 2px #BEEE62';
        // Можно автоматически открыть: click(n);
        setTimeout(() => n.style.boxShadow = '', 1000);
      });
      return;
    }
  }
}

// Вспомогательная функция для поиска соседей
function getNeighbors(idx) {
  const neighbors = [];
  const row = Math.floor(idx / width);
  const col = idx % width;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      let nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < width && nc >= 0 && nc < width) {
        neighbors.push(squares[nr * width + nc]);
      }
    }
  }
  return neighbors;
}

  function startGame(level, isInitialLoad = false) {
    // Плавно скрываем текущий оверлей, если он есть
    const overlay = document.querySelector('.game-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }

        if (!isInitialLoad && currentDifficulty !== level) {
          localStorage.removeItem('minesweeperGameState');
          gameState = null;
        }

    currentDifficulty = level;
    updateBestTimeDisplay();
    const config = difficulties[level];
    width = config.width;
    bombAmount = config.bombs;
    flags = 0;
    squares = [];
    isGameOver = false;
    firstClick = true;
    result.innerHTML = '';
    flagsLeft.innerHTML = bombAmount;
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${width}, auto)`;

    // Восстанавливаем состояние игры, если есть сохраненное
    if (isInitialLoad || (gameState && gameState.difficulty === level)) {
      restoreGameState();
    } else {
      resetTimer();
      updateBestTimeDisplay();
      createBoard();
    }
  }

  function resetTimer() {
    clearInterval(timer);
    seconds = 0;
    timeDisplay.textContent = '0с';
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      seconds++;
      timeDisplay.textContent = `${seconds}с`;
      saveGameState(); // Сохраняем состояние каждую секунду
    }, 1000);
  }

  async function loadBestTimesFromDB() {
    try {
      const response = await fetch('/get_best_times?game=minesweeper');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          // Сохраняем полученные рекорды в памяти
          loadedBestTimes.easy = data.easy !== null ? parseInt(data.easy) : null;
          loadedBestTimes.medium = data.medium !== null ? parseInt(data.medium) : null;
          loadedBestTimes.hard = data.hard !== null ? parseInt(data.hard) : null;
          loadedBestTimes.veryHard = data.veryHard !== null ? parseInt(data.veryHard) : null;

          // Обновляем localStorage только если там нет данных или данные устарели
          const localBestTimes = getBestTimes();
          let needUpdateLocalStorage = false;

          for (const difficulty in loadedBestTimes) {
            if (loadedBestTimes[difficulty] !== null &&
                (localBestTimes[difficulty] === null || loadedBestTimes[difficulty] < localBestTimes[difficulty])) {
              localBestTimes[difficulty] = loadedBestTimes[difficulty];
              needUpdateLocalStorage = true;
            }
          }

          if (needUpdateLocalStorage) {
            localStorage.setItem('minesweeperBestTimes', JSON.stringify(localBestTimes));
          }
        }
      }
    } catch (error) {
      console.error('Error loading best times from DB:', error);
    }

    // Обновляем отображение рекордов после загрузки
    updateBestTimeDisplay();
  }

  function updateBestTimeDisplay() {
    const bestTimes = getBestTimes();
    const bestTime = bestTimes[currentDifficulty];
    bestContainer.textContent = bestTime !== null ? `${bestTime}с` : '-';
  }

  function getBestTimes() {
    // Проверяем localStorage
    const bestTimesStr = localStorage.getItem('minesweeperBestTimes');
    if (bestTimesStr) {
      return JSON.parse(bestTimesStr);
    }

    // Если в localStorage нет данных, используем загруженные из БД
    return {
      easy: loadedBestTimes.easy,
      medium: loadedBestTimes.medium,
      hard: loadedBestTimes.hard,
      veryHard: loadedBestTimes.veryHard
    };
  }

  function setBestTime(difficulty, time) {
    const bestTimes = getBestTimes();
    if (bestTimes[difficulty] === null || time < bestTimes[difficulty]) {
      bestTimes[difficulty] = time;
      localStorage.setItem('minesweeperBestTimes', JSON.stringify(bestTimes));
      updateBestTimeDisplay();
      saveBestTimeToDB(difficulty, time);
    }
  }

 async function saveBestTimeToDB(difficulty, time) {
  try {
    const response = await fetch('/update_best_time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        difficulty: difficulty,
        time: time,
        game: 'minesweeper'
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    // Обновляем локальные данные только после успешного сохранения
    loadedBestTimes[difficulty] = time;
    return true;
  } catch (error) {
    console.error('Save failed, storing locally:', error);
    // Сохраняем в localStorage для последующей синхронизации
    const localTimes = JSON.parse(localStorage.getItem('minesweeperBestTimes') || '{}');
    localTimes[difficulty] = time;
    localStorage.setItem('minesweeperBestTimes', JSON.stringify(localTimes));
    return false;
  }
}

  function saveGameState() {
    if (isGameOver) return; // Не сохраняем завершенные игры

    const state = {
      difficulty: currentDifficulty,
      width,
      bombAmount,
      flags,
      squares: [],
      isGameOver,
      firstClick,
      seconds,
      board: []
    };

    // Сохраняем состояние каждой клетки
    squares.forEach(sq => {
      state.squares.push({
        id: sq.id,
        classes: Array.from(sq.classList),
        content: sq.innerHTML,
        data: sq.getAttribute('data')
      });
    });

    // Сохраняем расположение бомб (на случай если игра не начата)
    const bombs = [];
    squares.forEach(sq => {
      if (sq.classList.contains('bomb')) {
        bombs.push(parseInt(sq.id));
      }
    });
    state.board = bombs;

    localStorage.setItem('minesweeperGameState', JSON.stringify(state));
  }

  async function loadGameState() {
  try {
    await loadBestTimesFromDB();
  } catch (error) {
    console.error('Failed to load best times:', error);
    // Используем данные из localStorage, если не удалось загрузить из БД
    const localTimes = localStorage.getItem('minesweeperBestTimes');
    if (localTimes) {
      const times = JSON.parse(localTimes);
      Object.assign(loadedBestTimes, times);
    }
  }

  const stateStr = localStorage.getItem('minesweeperGameState');
  if (stateStr) {
    try {
      gameState = JSON.parse(stateStr);
      if (difficulties[gameState.difficulty]) {
          currentDifficulty = gameState.difficulty;
        startGame(gameState.difficulty, true);
        return;
      }
    } catch (e) {
      console.error('Error parsing saved state:', e);
    }
  }
  startGame('easy');
}

  function restoreGameState() {
    if (!gameState) return;

    width = gameState.width;
    bombAmount = gameState.bombAmount;
    flags = gameState.flags;
    isGameOver = gameState.isGameOver;
    firstClick = gameState.firstClick;
    seconds = gameState.seconds;
    flagsLeft.innerHTML = bombAmount - flags;
    timeDisplay.textContent = `${seconds}с`;


    // Восстанавливаем таймер, если игра начата
    if (!firstClick && !isGameOver) {
      startTimer();
    }

    // Создаем доску
    createBoard();

    // Восстанавливаем состояние клеток
    setTimeout(() => {
      gameState.squares.forEach(sqState => {
        const square = document.getElementById(sqState.id);
        if (square) {
          square.className = '';
          sqState.classes.forEach(cls => square.classList.add(cls));
          square.innerHTML = sqState.content;
          if (sqState.data) square.setAttribute('data', sqState.data);
        }
      });
    }, 10);
  }

  function createBoard() {
    // Если есть сохраненное состояние и бомбы, используем его
    if (gameState && gameState.board && gameState.board.length === bombAmount) {
      createBoardFromState();
    } else {
      createNewBoard();
    }
  }

  function createNewBoard() {
    const bombsArray = Array(bombAmount).fill('bomb');
    const emptyArray = Array(width * width - bombAmount).fill('valid');
    const gameArray = emptyArray.concat(bombsArray).sort(() => Math.random() - 0.5);

    for (let i = 0; i < width * width; i++) {
      const square = document.createElement('div');
      square.setAttribute('id', i);
      square.classList.add(gameArray[i]);
      grid.appendChild(square);
      squares.push(square);

      square.addEventListener('click', () => click(square));
      square.oncontextmenu = function(e) {
        e.preventDefault();
        addFlag(square);
      };
    }

    calculateNumbers();
  }

  function createBoardFromState() {
    for (let i = 0; i < width * width; i++) {
      const square = document.createElement('div');
      square.setAttribute('id', i);
      square.classList.add(gameState.board.includes(i) ? 'bomb' : 'valid');
      grid.appendChild(square);
      squares.push(square);

      square.addEventListener('click', () => click(square));
      square.oncontextmenu = function(e) {
        e.preventDefault();
        addFlag(square);
      };
    }

    calculateNumbers();
  }

  function calculateNumbers() {
    for (let i = 0; i < squares.length; i++) {
      let total = 0;
      const isLeftEdge = (i % width === 0);
      const isRightEdge = (i % width === width - 1);

      if (squares[i].classList.contains('valid')) {
        if (i > 0 && !isLeftEdge && squares[i - 1].classList.contains('bomb')) total++;
        if (i > width - 1 && !isRightEdge && squares[i + 1 - width].classList.contains('bomb')) total++;
        if (i >= width && squares[i - width].classList.contains('bomb')) total++;
        if (i >= width + 1 && !isLeftEdge && squares[i - 1 - width].classList.contains('bomb')) total++;
        if (i < width * width - 1 && !isRightEdge && squares[i + 1].classList.contains('bomb')) total++;
        if (i < width * (width - 1) && !isLeftEdge && squares[i - 1 + width].classList.contains('bomb')) total++;
        if (i < width * (width - 1) - 1 && !isRightEdge && squares[i + 1 + width].classList.contains('bomb')) total++;
        if (i < width * (width - 1) && squares[i + width].classList.contains('bomb')) total++;
        squares[i].setAttribute('data', total);
      }
    }
  }

  function addFlag(square) {
    if (isGameOver) return;
    if (!square.classList.contains('checked') && flags < bombAmount) {
      if (!square.classList.contains('flag')) {
        square.classList.add('flag');
        square.innerHTML = '🚩';
        flags++;
        flagsLeft.innerHTML = bombAmount - flags;
        saveGameState();
      } else {
        square.classList.remove('flag');
        square.innerHTML = '';
        flags--;
        flagsLeft.innerHTML = bombAmount - flags;
        saveGameState();
      }
    }
  }

  function click(square) {
    const currentId = parseInt(square.id);
    if (isGameOver || square.classList.contains('checked') || square.classList.contains('flag')) return;

    if (firstClick) {
      firstClick = false;
      startTimer();
      if (square.classList.contains('bomb')) {
        square.classList.remove('bomb');
        placeBomb(square);
      }
      openNeighbors(square);
    }

    if (square.classList.contains('bomb')) {
      gameOver(square);
    } else {
      let total = square.getAttribute('data');
      if (total != 0) {
        square.classList.add('checked');
        square.innerHTML = total;
        checkForWin();
      } else {
        openNeighbors(square);
      }
    }

    square.classList.add('checked');
    saveGameState();
  }

  function openNeighbors(square) {
    const id = parseInt(square.id);
    const isLeftEdge = id % width === 0;
    const isRightEdge = id % width === width - 1;

    setTimeout(() => {
      const neighbors = [
        id - 1, id + 1,
        id - width, id + width,
        id - width - 1, id - width + 1,
        id + width - 1, id + width + 1
      ];

      neighbors.forEach(nId => {
        if (nId >= 0 && nId < width * width) {
          const neighbor = squares[nId];
          const nIsLeft = nId % width === 0;
          const nIsRight = nId % width === width - 1;

          if (
            (!isLeftEdge || ![id - 1, id - width - 1, id + width - 1].includes(nId)) &&
            (!isRightEdge || ![id + 1, id - width + 1, id + width + 1].includes(nId)) &&
            !neighbor.classList.contains('checked') &&
            !neighbor.classList.contains('bomb')
          ) {
            click(neighbor);
          }
        }
      });
    }, 10);
  }

  function placeBomb(firstClickedSquare) {
    let empty = squares.filter(sq =>
      !sq.classList.contains('bomb') && !sq.classList.contains('flag') && sq !== firstClickedSquare);
    let random = empty[Math.floor(Math.random() * empty.length)];
    random.classList.add('bomb');
    updateNumbers();
    saveGameState();
  }

  function updateNumbers() {
    for (let i = 0; i < squares.length; i++) {
      let total = 0;
      const isLeftEdge = (i % width === 0);
      const isRightEdge = (i % width === width - 1);

      if (squares[i].classList.contains('valid')) {
        if (i > 0 && !isLeftEdge && squares[i - 1].classList.contains('bomb')) total++;
        if (i > width - 1 && !isRightEdge && squares[i + 1 - width].classList.contains('bomb')) total++;
        if (i >= width && squares[i - width].classList.contains('bomb')) total++;
        if (i >= width + 1 && !isLeftEdge && squares[i - 1 - width].classList.contains('bomb')) total++;
        if (i < width * width - 1 && !isRightEdge && squares[i + 1].classList.contains('bomb')) total++;
        if (i < width * (width - 1) && !isLeftEdge && squares[i - 1 + width].classList.contains('bomb')) total++;
        if (i < width * (width - 1) - 1 && !isRightEdge && squares[i + 1 + width].classList.contains('bomb')) total++;
        if (i < width * (width - 1) && squares[i + width].classList.contains('bomb')) total++;
        squares[i].setAttribute('data', total);
      }
    }
  }

  function showGameOverOverlay(isWin) {
    const grid = document.querySelector('.grid');
    const container = document.querySelector('.container');

    // Рассчитываем реальные размеры grid
    const gridRect = grid.getBoundingClientRect();

    // Создаем оверлей
    const overlay = document.createElement('div');
    overlay.className = 'game-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = `${grid.offsetTop}px`;
    overlay.style.left = `${grid.offsetLeft}px`;
    overlay.style.width = `${gridRect.width}px`;
    overlay.style.height = `${gridRect.height}px`;
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '100';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease-out';
    overlay.style.pointerEvents = 'auto';
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
    msg.innerText = isWin ? 'Поздравляем! Вы победили!' : 'Игра окончена!';
    msg.style.margin = '0 0 20px 0';
    msg.style.fontSize = '24px';
    msg.style.fontWeight = 'bold';

    // Иконка результата
    const icon = document.createElement('div');
    icon.style.fontSize = '40px';
    icon.style.marginTop = '10px';
    icon.style.lineHeight = '1';
    icon.innerText = isWin ? '🏆' : '💥';

    // Собираем элементы
    box.appendChild(icon);
    box.appendChild(msg);

    // Добавляем информацию о времени только при победе
    if (isWin) {
      const timeMsg = document.createElement('div');
      timeMsg.innerText = `Ваше время: ${seconds}с`;
      timeMsg.style.marginBottom = '20px';
      timeMsg.style.fontSize = '18px';
      box.appendChild(timeMsg);

      // Проверяем, является ли текущее время рекордом
      const bestTimes = getBestTimes();
      const currentBest = bestTimes[currentDifficulty];
      if (currentBest === null || seconds < currentBest) {
        const bestMsg = document.createElement('div');
        bestMsg.innerText = currentBest === null ?
          'Новый рекорд!' :
          `Новый рекорд! Предыдущий: ${currentBest}с`;
        bestMsg.style.marginBottom = '20px';
        bestMsg.style.fontSize = '18px';
        bestMsg.style.fontWeight = 'bold';
        box.appendChild(bestMsg);

        // Сохраняем новый рекорд
        setBestTime(currentDifficulty, seconds);
      } else if (currentBest !== null) {
        const bestMsg = document.createElement('div');
        bestMsg.innerText = `Лучшее время: ${currentBest}с`;
        bestMsg.style.marginBottom = '20px';
        bestMsg.style.fontSize = '18px';
        box.appendChild(bestMsg);
      }

      // Добавляем кнопку "Играть ещё" только при победе
      const playAgainBtn = document.createElement('button');
      playAgainBtn.innerText = 'Играть ещё';
      playAgainBtn.style.padding = '12px 24px';
      playAgainBtn.style.fontSize = '18px';
      playAgainBtn.style.cursor = 'pointer';
      playAgainBtn.style.background = 'rgba(255,255,255,0.2)';
      playAgainBtn.style.color = 'white';
      playAgainBtn.style.border = '2px solid white';
      playAgainBtn.style.borderRadius = '6px';
      playAgainBtn.style.transition = 'all 0.2s';
      playAgainBtn.style.marginTop = '0';
      playAgainBtn.style.fontFamily = '"Clear Sans", "Helvetica Neue", Arial, sans-serif';

      playAgainBtn.addEventListener('mouseover', () => {
          playAgainBtn.style.background = 'rgba(255,255,255,0.3)';
      });

      playAgainBtn.addEventListener('mouseout', () => {
          playAgainBtn.style.background = 'rgba(255,255,255,0.2)';
      });

      playAgainBtn.addEventListener('click', () => {
          overlay.style.opacity = '0';
          setTimeout(() => {
              overlay.remove();
              startGame(currentDifficulty);
          }, 300);
      });

      box.appendChild(playAgainBtn);
    } else {
      // При поражении можно закрыть оверлей кликом
      overlay.addEventListener('click', () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
      });
    }

    overlay.appendChild(box);
    container.appendChild(overlay);

    // Анимация появления
    setTimeout(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'scale(1)';
    }, 10);

    // Закрытие по ESC
    overlay.tabIndex = 0;
    overlay.focus();
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        }
    });

    // Обработчик ресайза
    const handleResize = () => {
        const gridRect = grid.getBoundingClientRect();
        overlay.style.top = `${grid.offsetTop}px`;
        overlay.style.left = `${grid.offsetLeft}px`;
        overlay.style.width = `${gridRect.width}px`;
        overlay.style.height = `${gridRect.height}px`;
    };

    window.addEventListener('resize', handleResize);

    // Удаляем обработчик при закрытии
    const originalRemove = overlay.remove;
    overlay.remove = function() {
        window.removeEventListener('resize', handleResize);
        originalRemove.call(this);
    };
  }

  function gameOver(square) {
    isGameOver = true;
    clearInterval(timer);
    localStorage.removeItem('minesweeperGameState'); // Удаляем сохраненную игру

    // Показываем все мины
    squares.forEach(sq => {
        if (sq.classList.contains('bomb')) {
            sq.innerHTML = '💣';
            sq.classList.remove('bomb');
            sq.classList.add('checked');
        }
    });

    // Показываем оверлей через небольшой таймаут
    setTimeout(() => showGameOverOverlay(false), 100);
  }

  function checkForWin() {
  // Победа, если количество открытых ("checked") клеток равно числу всех не-мин
    let opened = 0;
    for (let i = 0; i < squares.length; i++) {
      if (squares[i].classList.contains('checked')) opened++;
    }
    if (opened === width * width - bombAmount) {
      isGameOver = true;
      clearInterval(timer);
      localStorage.removeItem('minesweeperGameState');
      setTimeout(() => showGameOverOverlay(true), 500);
    }
  }

  // Сохраняем состояние при закрытии страницы
  window.addEventListener('beforeunload', () => {
    if (!isGameOver) {
      saveGameState();
    }
  });
});