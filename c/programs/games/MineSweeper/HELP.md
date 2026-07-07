# MineSweeper

## The Basics:

- You are presented with a board of squares, each with a cover. Some squares contain mines (bombs) under the covers. If you open a square containing a bomb, you loose. If you open all squares without bombs, you win.
- Opening a square which doesn't have a bomb reveals the number of neighboring squares contain bombs. Use this information plus some guess work to avoid the bombs.
- To open a square, point at the square and click on it. To mark a square you think is a bomb, point and right click. With a single button mouse use the space bar to mark a bomb.

## The Details:

- A squares "neighbors" are the squares adjacent above, below, left, right, and all 4 diagonals. Squares on the sides of the board or in a corner have fewer neighbors. The board does not wrap around the edges.
- If you open a square with 0 neighboring bombs, all its neighbors will automatically open. This can cause a large area to automatically open.
- To remove a bomb marker from a square, point at it and right-click again.
- The first square you open is never a bomb.
- If you mark a bomb incorrectly, you will have to correct the mistake before you can win. Incorrect bomb marking doesn't kill you, but it can easily lead to mistakes which do.
- You don't have to mark all bombs to win; you just need to open all non-bomb squares.
- Press the yellow face to start a new game.

## The Status Information:

- The upper left corner of the screen contains the number of bombs minus the number of marked squares. At the beginning of a game it is just the number of bombs. The number will update as you mark and unmark squares.
- The yellow face will show a smile face while you play, a clock face when a game board is being built, a dead face when you hit a bomb, a cool face when you win, and a pirate face when you win while cheating.
- The upper right corner of the screen contains a time counter. The timer will max out at 999.
- Click on the time to switch to the number of moves counter. Click again to switch back to the time.
- Press P to pause your game. The board will be covered while paused.

## Options and Enhancements:

- Open Remaining - Once the correct number of bombs have been marked, the bomb counter will turn blue. Click on the blue bomb counter to open all remaining cells. If any bombs are incorrectly marked, this will cause instant death.
