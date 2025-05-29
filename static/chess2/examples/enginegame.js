function engineGame(options) {
    options = options || {}
    var elo = 1200;
    var fixedElo = null;
    var game = new Chess();
    var board;
    ///NOTE: If the WASM binary is not in the expected location, must be added after the hash.
    var engine = typeof STOCKFISH === "function" ? STOCKFISH() : new Worker(options.stockfishjs || 'src/stockfish-17.js');
    var evaler = typeof STOCKFISH === "function" ? STOCKFISH() : new Worker(options.stockfishjs || 'src/stockfish-17.js');
    var engineStatus = {};
    var displayScore = false;
    var time = { wtime: 300, btime: 300000, winc: 2000, binc: 2000 };
    var playerColor = 'white';
    var clockTimeoutID = null;
    var isEngineRunning = false;
    var evaluation_el = document.getElementById("evaluation");
    var announced_game_over;
    var bestScore = null;
    const bestContainer = document.querySelector('.best-container');
    const scoreContainer = document.querySelector('.score-container');
    // do not pick up pieces if the game is over
    // only pick up pieces for White
    var onDragStart = function(source, piece, position, orientation) {
        var re = playerColor == 'white' ? /^b/ : /^w/
            if (game.game_over() ||
                piece.search(re) !== -1) {
                return false;
            }
    };

    setInterval(function ()
    {
        if (announced_game_over) {
            return;
        }
        
        if (game.game_over()) {
            announced_game_over = true;
            const winnerColor = game.turn() === 'w' ? 'b' : 'w';
            const isWin = game.in_checkmate() && winnerColor === playerColor[0];
            setTimeout(() => showGameOverOverlay(isWin), 100);
        }
    }, 500);

    function uciCmd(cmd, which) {
        console.log("UCI: " + cmd);
        
        (which || engine).postMessage(cmd);
    }
    uciCmd('uci');
    
    function displayStatus() {
        var currentElo = fixedElo !== null ? fixedElo : elo;
        var status = 'elo: ' + elo +' Engine: ';
        if(!engineStatus.engineLoaded) {
            status += 'loading...';
        } else if(!engineStatus.engineReady) {
            status += 'loaded...';
        } else {
            status += 'ready.';
        }
        
        if(engineStatus.search) {
            status += '<br>' + engineStatus.search;
            if(engineStatus.score && displayScore) {
                status += (engineStatus.score.substr(0, 4) === "Mate" ? " " : ' Score: ') + engineStatus.score;
            }
        }
        $('#engineStatus').html(status);
        scoreContainer.textContent = currentElo;
    }

    function displayClock(color, t) {
        var isRunning = false;
        if(time.startTime > 0 && color == time.clockColor) {
            t = Math.max(0, t + time.startTime - Date.now());
            isRunning = true;
        }
        var id = color == playerColor ? '#time2' : '#time1';
        var sec = Math.ceil(t / 1000);
        var min = Math.floor(sec / 60);
        sec -= min * 60;
        var hours = Math.floor(min / 60);
        min -= hours * 60;
        var display = hours + ':' + ('0' + min).slice(-2) + ':' + ('0' + sec).slice(-2);
        if(isRunning) {
            display += sec & 1 ? ' <--' : ' <-';
        }
        $(id).text(display);
    }

    function updateClock() {
        displayClock('white', time.wtime);
        displayClock('black', time.btime);
    }

    function clockTick() {
        updateClock();
        var t = (time.clockColor == 'white' ? time.wtime : time.btime) + time.startTime - Date.now();
        var timeToNextSecond = (t % 1000) + 1;
        clockTimeoutID = setTimeout(clockTick, timeToNextSecond);
    }

    function stopClock() {
        if(clockTimeoutID !== null) {
            clearTimeout(clockTimeoutID);
            clockTimeoutID = null;
        }
        if(time.startTime > 0) {
            var elapsed = Date.now() - time.startTime;
            time.startTime = null;
            if(time.clockColor == 'white') {
                time.wtime = Math.max(0, time.wtime - elapsed);
            } else {
                time.btime = Math.max(0, time.btime - elapsed);
            }
        }
    }

    function startClock() {
        if(game.turn() == 'w') {
            time.wtime += time.winc;
            time.clockColor = 'white';
        } else {
            time.btime += time.binc;
            time.clockColor = 'black';
        }
        time.startTime = Date.now();
        clockTick();
    }
    
    function get_moves()
    {
        var moves = '';
        var history = game.history({verbose: true});
        
        for(var i = 0; i < history.length; ++i) {
            var move = history[i];
            moves += ' ' + move.from + move.to + (move.promotion ? move.promotion : '');
        }
        
        return moves;
    }

    function maybeBlunderMove(moves, elo) {
        const blunderChance = Math.max(0, 30 - elo / 100); // 30% на 400, почти 0% на 2600
        if (Math.random() * 100 < blunderChance) {
            // Вернуть рандомный плохой ход
            return pickRandomBadMove(moves);
        }
        return null;
    }

    function pickRandomBadMove(moves) {
        // Просто случайный ход (можно улучшить — взять 3 худших по eval и выбрать из них)
        return moves[Math.floor(Math.random() * moves.length)];
    }

    async function fetchBestScore() {
        try {
            const response = await fetch('/get_high_score?game=chess');
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
    eloInfo.innerText = `ELO противника: ${fixedElo}`;
    eloInfo.style.marginBottom = '15px';
    eloInfo.style.fontSize = '16px';

    const bestContainer = document.querySelector('.best-container');
        const currentBest = (bestScore !== null && !isNaN(bestScore) ? bestScore : 0);

        if (fixedElo > currentBest) {
            bestScore = fixedElo;
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
            body: `score=${score}&game=chess`
        });
    }

    function prepareMove() {
        stopClock();
        $('#pgn').text(game.pgn());
        board.position(game.fen());
        updateClock();

        var turn = game.turn() == 'w' ? 'white' : 'black';
        if(!game.game_over()) {
            if(turn != playerColor) {
                uciCmd('position startpos moves' + get_moves());
                uciCmd('position startpos moves' + get_moves(), evaler);
                evaluation_el.textContent = "";
                uciCmd("eval", evaler);
                
                if (time && time.wtime) {
                    uciCmd("go " + (time.depth ? "depth " + time.depth : "") + " wtime " + time.wtime + " winc " + time.winc + " btime " + time.btime + " binc " + time.binc);
                } else {
                    uciCmd("go " + (time.depth ? "depth " + time.depth : ""));
                }
                isEngineRunning = true;
                const moves = game.moves({ verbose: true });
                const blunder = maybeBlunderMove(moves, elo);
                if (blunder) {
                    game.move(blunder);
                    prepareMove();
                    return;
                }
            }
            if(game.history().length >= 2 && !time.depth && !time.nodes) {
                startClock();
            }
        }
    }
    
    evaler.onmessage = function(event) {
        var line;
        
        if (event && typeof event === "object") {
            line = event.data;
        } else {
            line = event;
        }
        
        console.log("evaler: " + line);
        
        /// Ignore some output.
        if (line === "uciok" || line === "readyok" || line.substr(0, 11) === "option name") {
            return;
        }
        
        if (evaluation_el.textContent) {
            evaluation_el.textContent += "\n";
        }
        evaluation_el.textContent += line;
    }

    engine.onmessage = function(event) {
        var line;
        
        if (event && typeof event === "object") {
            line = event.data;
        } else {
            line = event;
        }
        console.log("Reply: " + line)
        if(line == 'uciok') {
            engineStatus.engineLoaded = true;
        } else if(line == 'readyok') {
            engineStatus.engineReady = true;
        } else {
            var match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);
            /// Did the AI move?
            if(match) {
                isEngineRunning = false;
                game.move({from: match[1], to: match[2], promotion: match[3]});
                prepareMove();
                uciCmd("eval", evaler)
                evaluation_el.textContent = "";
                //uciCmd("eval");
            /// Is it sending feedback?
            } else if(match = line.match(/^info .*\bdepth (\d+) .*\bnps (\d+)/)) {
                engineStatus.search = 'Depth: ' + match[1] + ' Nps: ' + match[2];
            }
            
            /// Is it sending feed back with a score?
            if(match = line.match(/^info .*\bscore (\w+) (-?\d+)/)) {
                var score = parseInt(match[2]) * (game.turn() == 'w' ? 1 : -1);
                /// Is it measuring in centipawns?
                if(match[1] == 'cp') {
                    engineStatus.score = (score / 100.0).toFixed(2);
                /// Did it find a mate?
                } else if(match[1] == 'mate') {
                    engineStatus.score = 'Mate in ' + Math.abs(score);
                }
                
                /// Is the score bounded?
                if(match = line.match(/\b(upper|lower)bound\b/)) {
                    engineStatus.score = ((match[1] == 'upper') == (game.turn() == 'w') ? '<= ' : '>= ') + engineStatus.score
                }
            }
        }
        displayStatus();
    };

    var onDrop = function(source, target) {
        // see if the move is legal
        var move = game.move({
            from: source,
            to: target,
            promotion: document.getElementById("promote").value
        });

        // illegal move
        if (move === null) return 'snapback';

        prepareMove();
    };

    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    var onSnapEnd = function() {
        board.position(game.fen());
    };

    var cfg = {
        showErrors: true,
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };

    board = new ChessBoard('board', cfg);

    return {
        reset: function() {
            fixedElo = null;
            game.reset();
            uciCmd('setoption name Contempt value 0');
            this.setEloLevel(400);
            uciCmd('setoption name King Safety value 0'); /// Agressive 100 (it's now symetric)
        },
        loadPgn: function(pgn) { game.load_pgn(pgn); },
        setPlayerColor: function(color) {
            playerColor = color;
            board.orientation(playerColor);
        },
        setEloLevel: function(newElo) {
        if (fixedElo !== null) {
            console.log("ELO уже зафиксировано. Изменения не применяются.");
            return;
        }
        let skill, depth, err_prob, max_err;
        elo = newElo;

        if (elo < 400) elo = 400;
        if (elo > 2600) elo = 2600;

        // Примерная линейная аппроксимация
        skill = Math.round((elo - 400) / 110); // 0–20
        if (skill < 0) skill = 0;
        if (skill > 20) skill = 20;

        // Глубина по уровням ELO
        if (elo < 800) depth = 1;
        else if (elo < 1300) depth = 2;
        else if (elo < 1800) depth = 3;
        else if (elo < 2300) depth = 5;
        else depth = "";

        time.level = skill;
        time.depth = depth;

        uciCmd('setoption name Skill Level value ' + skill);

        err_prob = Math.round((skill * 6.35) + 1);
        max_err = Math.round((skill * -0.5) + 10);

        uciCmd('setoption name Skill Level Maximum Error value ' + max_err);
        uciCmd('setoption name Skill Level Probability value ' + err_prob);
        displayStatus();
    },
        setTime: function(baseTime, inc) {
            time = { wtime: baseTime * 1000, btime: baseTime * 1000, winc: inc * 1000, binc: inc * 1000 };
        },
        setDepth: function(depth) {
            time = { depth: depth };
        },
        setNodes: function(nodes) {
            time = { nodes: nodes };
        },
        setContempt: function(contempt) {
            uciCmd('setoption name Contempt value ' + contempt);
        },
        setAggressiveness: function(value) {
            uciCmd('setoption name Aggressiveness value ' + value);
        },
        setDisplayScore: function(flag) {
            displayScore = flag;
            displayStatus();
        },
        start: function() {
            fixedElo = elo;
            fetchBestScore();
            uciCmd('ucinewgame');
            uciCmd('isready');
            engineStatus.engineReady = false;
            engineStatus.search = null;
            displayStatus();
            prepareMove();
            announced_game_over = false;
        },
        undo: function() {
            if(isEngineRunning)
                return false;
            game.undo();
            game.undo();
            engineStatus.search = null;
            displayStatus();
            prepareMove();
            return true;
        }
    };
}
