import assert from "assert";

import { useState } from "react";

import { useInit, useQuery, tx, transact, id } from "@instantdb/react";

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
    outcome: undefined,
  };
}

function checkRows(b, turn) {
  return b.some((row) => row.every((val) => val === turn));
}

function isFull(b) {
  return b.every((row) => row.length && row.every((sq) => sq));
}

function isGameWon(b, turn) {
  const inverted = b.map((_, col) => [b[0][col], b[1][col], b[2][col]]);
  const diags = [
    [b[0][0], b[1][1], b[2][2]],
    [b[0][2], b[1][1], b[2][0]],
  ];

  return [b, inverted, diags].some((x) => checkRows(x, turn));
}

function _isGameWon_test() {
  let b;

  // columns work
  b = [
    ["x", "o", "x"],
    ["x", "x", "o"],
    ["x", "o", "x"],
  ];
  assert(isGameWon(b, "x"));

  // rows work
  b = [
    ["x", "x", "x"],
    ["x", "o", "o"],
    ["o", "o", "x"],
  ];
  assert(isGameWon(b, "x"));

  // diagnols work
  b = [
    ["x", "o", "x"],
    ["x", "x", "o"],
    ["o", "o", "x"],
  ];
  assert(isGameWon(b, "x"));

  // No false positive
  b = [
    ["o", "x", "o"],
    ["x", "x", "o"],
    ["x", "o", "x"],
  ];
  assert(!isGameWon(b, "x"));
}

function update_in_arr(arr, target, newVal) {
  return arr.map((val, i) => (i === target ? newVal : val));
}

function update_in_matrix(m, [x, y], newVal) {
  return m.map((row, r) => (r === x ? update_in_arr(row, y, newVal) : row));
}

function updateOutcome(newBoard, turn) {
  if (isGameWon(newBoard, turn)) {
    return turn;
  }

  if (isFull(newBoard)) {
    return "draw";
  }
}

function move(b, [r, c], turn) {
  const newTurn = turn === "x" ? "o" : "x";
  const newBoard = update_in_matrix(b, [r, c], turn);
  const newOutcome = updateOutcome(newBoard, turn);
  return { board: newBoard, turn: newTurn, outcome: newOutcome };
}

function Button({ onClick, children }) {
  return (
    <button
      className="p-4 border border-solid border-black hover:bg-slate-200"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Main() {
  const { games } = useQuery({ games: {} });
  const label = "new";
  const game = games.find((g) => g.id === label);
  console.log(game);
  if (!game) {
    return (
      <div>
        <Button
          onClick={() => transact(tx.games[label].update(initialState()))}
        >
          New Game!
        </Button>
      </div>
    );
  }

  const { board, turn, outcome } = game;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-center text-2xl font-bold my-2 capitalize">
        {outcome
          ? outcome === "draw"
            ? `Draw!`
            : `${outcome} wins!`
          : `${turn} turn`}
      </h1>
      <div className="m-4 w-72">
        {board.map((row, r) => (
          <div className="flex">
            {row.map((sq, c) => (
              <div
                className={`flex justify-center w-24 h-24 border-black border-solid border text-lg ${
                  !sq ? "hover:cursor-pointer hover:bg-slate-200" : ""
                }`}
                onClick={() =>
                  !outcome &&
                  !board[r][c] &&
                  transact(tx.games[label].update(move(board, [r, c], turn)))
                }
              >
                <div className="text-7xl">{sq}</div>
              </div>
            ))}
          </div>
        ))}
        <div className="m-4 flex justify-between">
          <Button
            onClick={() => transact(tx.games[label].update(initialState()))}
          >
            New Game
          </Button>
          <Button onClick={() => transact(tx.games[label].delete())}>
            Delete Game
          </Button>
        </div>
      </div>
    </div>
  );
}

export default App;
