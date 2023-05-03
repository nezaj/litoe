import "./App.css";

import assert from "assert";

import { useState } from "react";

// 1. Import Instant
import { useInit, useQuery, tx, transact, id } from "@instantdb/react";

// 2. Get your app id
const APP_ID = "e836610f-502f-4caa-92d8-3be67fc6a55a";

function App() {
  // 3. Init
  const [isLoading, error, auth] = useInit({
    appId: APP_ID,
    websocketURI: "wss://api.instantdb.com/runtime/sync",
    apiURI: "https://api.instantdb.com",
  });
  if (isLoading) {
    return <div>...</div>;
  }
  if (error) {
    return <div>Oi! {error?.message}</div>;
  }
  return <Main />;
}

function initialState() {
  return {
    board: [
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
    ],
    turn: "x",
    winner: undefined,
  };
}

function checkRows(b, turn) {
  return b.some((row) => row.every((val) => val === turn));
}

function isGameOver(b, turn) {
  const inverted = b.map((_, col) => [b[0][col], b[1][col], b[2][col]]);
  const diags = [
    [b[0][0], b[1][1], b[2][2]],
    [b[0][2], b[1][1], b[2][0]],
  ];

  return [b, inverted, diags].some((x) => checkRows(x, turn));
}

function _isGameOver_test() {
  let b;

  // columns work
  b = [
    ["x", "o", "x"],
    ["x", "x", "o"],
    ["x", "o", "x"],
  ];
  assert(isGameOver(b, "x"));

  // rows work
  b = [
    ["x", "x", "x"],
    ["x", "o", "o"],
    ["o", "o", "x"],
  ];
  assert(isGameOver(b, "x"));

  // diagnols work
  b = [
    ["x", "o", "x"],
    ["x", "x", "o"],
    ["o", "o", "x"],
  ];
  assert(isGameOver(b, "x"));

  // No false positive
  b = [
    ["o", "x", "o"],
    ["x", "x", "o"],
    ["x", "o", "x"],
  ];
  assert(!isGameOver(b, "x"));
}

function update_in_arr(arr, target, newVal) {
  return arr.map((val, i) => (i === target ? newVal : val));
}

function update_in_matrix(m, [x, y], newVal) {
  return m.map((row, r) => (r === x ? update_in_arr(row, y, newVal) : row));
}

function move(b, [r, c], turn) {
  const newTurn = turn === "x" ? "o" : "x";
  const newBoard = update_in_matrix(b, [r, c], turn);
  const newWinner = isGameOver(newBoard, turn) ? turn : undefined;
  return { board: newBoard, turn: newTurn, winner: newWinner };
}

function Main() {
  const { games } = useQuery({ games: {} });
  const label = "new";
  const game = games.find((g) => g.id === label);
  console.log(game);
  if (!game) {
    return (
      <div>
        <button
          onClick={() => transact(tx.games[label].update(initialState()))}
        >
          New Game!
        </button>
      </div>
    );
  }

  const { board, turn, winner } = game;
  return (
    <div>
      {winner ? <h1>{winner} wins!</h1> : <h1>{turn} turn!</h1>}
      {board.map((row, r) => (
        <div style={{ display: "flex" }}>
          {row.map((sq, c) => (
            <div
              className="sq"
              onClick={() =>
                !winner &&
                !board[r][c] &&
                transact(tx.games[label].update(move(board, [r, c], turn)))
              }
            >
              {sq}
            </div>
          ))}
        </div>
      ))}
      <button onClick={() => transact(tx.games[label].update(initialState()))}>
        New Game!
      </button>
      <button onClick={() => transact(tx.games[label].delete())}>
        Delete Game!
      </button>
    </div>
  );
}

export default App;
