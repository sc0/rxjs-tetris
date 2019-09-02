const GRID_SIZE = 20;
const WIDTH = 10;
const HEIGHT = 20;
const BLOCKS = [
  [
    [1, 1, 1, 1],
  ],
  [
    [2, 0, 0],
    [2, 2, 2],
  ],
  [
    [0, 0, 3],
    [3, 3, 3],
  ],
  [
    [0, 4, 4],
    [4, 4, 0],
  ],
  [
    [5, 5, 0],
    [0, 5, 5],
  ],
  [
    [0, 6, 0],
    [6, 6, 6],
  ],
  [
    [7, 7],
    [7, 7],
  ],
];
const COLORS = [
  'red', 'lime', 'deepskyblue', 'yellow', 'orange', 'magenta', 'cyan'
];

const FIRST_BLOCK = Math.floor(Math.random() * 7);

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
ctx.translate(.5, .5);

const drawGrid = () => {
  ctx.beginPath();

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'black';

  ctx.clearRect(0, 0, GRID_SIZE * WIDTH, GRID_SIZE * HEIGHT);
  ctx.strokeRect(0, 0, GRID_SIZE * WIDTH - 1, GRID_SIZE * HEIGHT - 1);

  ctx.strokeStyle = 'lightgray';

  for (let i = 1; i < WIDTH; i++) {
    ctx.moveTo(i * GRID_SIZE, 0);
    ctx.lineTo(i * GRID_SIZE, HEIGHT * GRID_SIZE);
  }

  for (let i = 1; i < HEIGHT; i++) {
    ctx.moveTo(0, i * GRID_SIZE);
    ctx.lineTo(WIDTH * GRID_SIZE, i * GRID_SIZE);
  }

  ctx.stroke();
  ctx.closePath();

};

const blockNumber$ = new rxjs.BehaviorSubject(FIRST_BLOCK);
const collision$ = new rxjs.Subject();

const rotateBlock = (block, rotation) => {
  let toBeRotated = BLOCKS[block].slice();
  let rotated = BLOCKS[block].slice();

  for (let r = 0; r < rotation; r++) {
    rotated = [];
    for (let y = 0; y < toBeRotated[0].length; y++) {
      rotated.push([]);
      for (let x = 0; x < toBeRotated.length; x++) {
        rotated[y][x] = 0;
      }
    }

    for (let y = 0; y < toBeRotated.length; y++) {
      for (let x = 0; x < toBeRotated[0].length; x++) {
        rotated[x][y] = toBeRotated[toBeRotated.length - 1 - y][x];
      }
    }
    toBeRotated = rotated.slice();
  }

  return rotated;
};

const drawBlock = (x, y, block) => {
  ctx.strokeStyle = 'black';

  block.forEach((row, rowIdx) => {
    row.forEach((col, colIdx) => {
      if (col > 0) {
        ctx.fillStyle = COLORS[col - 1];
        ctx.fillRect((x + colIdx) * GRID_SIZE + 1, (y + rowIdx) * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
        ctx.strokeRect((x + colIdx) * GRID_SIZE, (y + rowIdx) * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      }
    })
  })
};

const drawBoard = (board) => {
  board.forEach((row, yoffset) => {
    row.forEach((cell, xoffset) => {
      if (cell > 0) {
        ctx.fillStyle = COLORS[cell - 1];
        ctx.strokeStyle = 'black';
        ctx.strokeRect(xoffset * GRID_SIZE, yoffset * GRID_SIZE, GRID_SIZE, GRID_SIZE);
        ctx.fillRect(xoffset * GRID_SIZE + 1, yoffset * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
      }
    });
  });
};

const checkVerticalCollision = (x, y, block, rot, gameState) => {
  const blk = rotateBlock(block, rot);
  if (y + blk.length >= HEIGHT) {
    return true;
  }

  let result = false;
  blk.forEach((row, yoffset) => {
    row.forEach((cell, xoffset) => {
      if (cell > 0) {
        if (gameState[y + yoffset + 1][x + xoffset] > 0) {
          result = true;
        }
      }
    });
  });

  return result;
};

const checkHorizontalCollision = (x, y, block, rot, gameState) => {
  const blk = rotateBlock(block, rot);
  if (x < 0 || x + blk[0].length > WIDTH) {
    return true;
  }

  for (let yoffset = 0; yoffset < blk.length; yoffset++) {
    for (let xoffset = 0; xoffset < blk[yoffset].length; xoffset++) {
      if (blk[yoffset][xoffset] > 0) {
        if (gameState[y + yoffset][x + xoffset] > 0) {
          return true;
        }
      }
    }
  }

  return false;
};

const rotation$ =
  rxjs.merge(
    rxjs.fromEvent(document, 'keydown')
      .pipe(
        rxjs.operators.filter(e => e.code === 'Space'),
        rxjs.operators.map(e => 1),
        rxjs.operators.scan((sum, e) => (sum + e) % 4),
      ),
    rxjs.Observable.create(observer => {
      observer.next(0);
      observer.complete();
    })
  );


const verticalPosition$ =
  rxjs.merge(
    rxjs.merge(
      rxjs.interval(500),
      rxjs.fromEvent(document, 'keydown').pipe(
        rxjs.operators.filter(e => e.code === 'ArrowDown'),
      ),
    ).pipe(
      rxjs.operators.mapTo(1)
    ),
    blockNumber$.pipe(
      rxjs.operators.distinctUntilChanged(),
      rxjs.operators.mapTo(-1)
    )
  ).pipe(
    rxjs.operators.withLatestFrom(blockNumber$, rotation$),
    rxjs.operators.scan((acc, [e, block, rot]) => {
      if (e > 0 && acc + e + rotateBlock(block, rot).length >= HEIGHT) {
        return HEIGHT - rotateBlock(block, rot).length;
      }
      return e < 0 ? 0 : acc + e;
    }, 0)
  );

const boardState$ =
  rxjs.Observable.create(observer => {
    const row = [];
    for (let i = 0; i < WIDTH; i++) {
      row.push(0);
    }
    let gameState = [];
    for (let i = 0; i < HEIGHT; i++) {
      gameState.push(row.slice());
    }
    observer.next(gameState);

    collision$.subscribe(([x, y, block, rotation]) => {
      const blk = rotateBlock(block, rotation);
      blk.forEach((row, yoffset) => {
        row.forEach((cell, xoffset) => {
          if (cell > 0) {
            gameState[y + yoffset][x + xoffset] = cell;
          }
        });
      });

      let clearedState = [];
      gameState.forEach((row) => {
        const isFull = row.reduce((isFull, cell) => isFull && cell, true);
        if(!isFull) {
          clearedState.push(row);
        }
      });
      const l = clearedState.length;
      for (let i = 0; i < gameState.length - l; i++) {
        const row = [];
        gameState[0].forEach(_ => row.push(0));
        const rev = clearedState.reverse();
        rev.push(row);
        clearedState = rev.reverse();
      }
      gameState = clearedState;
      observer.next(gameState);
      blockNumber$.next(Math.floor(Math.random() * 7));
    });
  });


const horizontalPosition$ =
  rxjs.merge(
    rotation$.pipe(rxjs.operators.mapTo(0)),
    rxjs.fromEvent(document, 'keydown')
      .pipe(
        rxjs.operators.map(e => ['ArrowLeft', 'ArrowRight'].indexOf(e.code)),
        rxjs.operators.filter(e => e >= 0),
        rxjs.operators.map(e => e === 0 ? -1 : 1)
      ),
    blockNumber$.pipe(
      rxjs.operators.distinctUntilChanged(),
      rxjs.operators.mapTo('reset')
    ),
    rxjs.Observable.create(observer => {
        observer.next(3);
        observer.complete();
      }
    )).pipe(
    rxjs.operators.withLatestFrom(verticalPosition$, blockNumber$, rotation$, boardState$),
    rxjs.operators.scan((acc, [e, y, block, rot, gameState]) => {
      if (e === 'reset') {
        return 3;
      }

      if (e === 0 && acc + rotateBlock(block, rot)[0].length > WIDTH) {
        return WIDTH - rotateBlock(block, rot)[0].length;
      }

      if (checkHorizontalCollision(acc + e, y, block, rot, gameState)) {
        return acc;
      }

      return acc + e;
    }, 0),
  );

verticalPosition$.pipe(
  rxjs.operators.withLatestFrom(horizontalPosition$, blockNumber$, rotation$, boardState$)
).subscribe(([y, x, block, rot, gameState]) => {
  if (checkVerticalCollision(x, y, block, rot, gameState)) {
    collision$.next([x, y, block, rot]);
  }
});

const endGame$ =
  boardState$.pipe(
    rxjs.operators.tap(board => drawBoard(board)),
    rxjs.operators.map(board => board[0].reduce((empty, cell) => empty && cell === 0, true)),
    rxjs.operators.filter(empty => !empty)
  );

const gameLoop =
  rxjs.interval(17).pipe(
    rxjs.operators.takeUntil(endGame$),
    rxjs.operators.withLatestFrom(horizontalPosition$, verticalPosition$, rotation$, blockNumber$, boardState$),
  ).subscribe(([val, x, y, rot, block, board]) => {
      drawGrid();
      drawBoard(board);
      drawBlock(x, y, rotateBlock(block, rot));
  });

rxjs.forkJoin(
  endGame$, boardState$
).pipe(
  rxjs.operators.take(1)
).subscribe(([_, board]) => {
  drawBoard(board);
});

