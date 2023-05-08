import assert from "assert";

import { useState } from "react";
import { useInit, useQuery, tx, transact, id } from "@instantdb/react";

import randomHandle from "./utils/randomHandle";

// Game logic
// --------------------

function checkRows(b, mark) {
  return b.some((row) => row.every((val) => val === mark));
}

function isFull(b) {
  return b.every((row) => row.length && row.every((sq) => sq));
}

function isGameWon(b, mark) {
  const inverted = b.map((_, col) => [b[0][col], b[1][col], b[2][col]]);
  const diags = [
    [b[0][0], b[1][1], b[2][2]],
    [b[0][2], b[1][1], b[2][0]],
  ];

  return [b, inverted, diags].some((x) => checkRows(x, mark));
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

function updateOutcome(newBoard, currentPlayer, mark) {
  if (isGameWon(newBoard, mark)) {
    return currentPlayer;
  }

  if (isFull(newBoard)) {
    return "draw";
  }
}

// State Management
// --------------------
const MARKER = { 0: "x", 1: "o" };
function getMarker(idx) {
  return MARKER[idx];
}

function emptyBoard() {
  return [
    [undefined, undefined, undefined],
    [undefined, undefined, undefined],
    [undefined, undefined, undefined],
  ];
}

function initialState() {
  return {
    board: emptyBoard(),
    turn: 0,
    outcome: undefined,
    players: [],
  };
}

function resetBoard(game) {
  const { players } = game;
  const newGame = initialState();
  return { ...newGame, players };
}

function move(game, [r, c]) {
  const { board, turn, players } = game;
  const mark = getMarker(turn);
  const currentPlayer = players[turn];
  const newTurn = turn === 0 ? 1 : 0;
  const newBoard = update_in_matrix(board, [r, c], mark);
  const newOutcome = updateOutcome(newBoard, currentPlayer, mark);
  return { ...game, board: newBoard, turn: newTurn, outcome: newOutcome };
}

function addPlayer(game, id) {
  const { players } = game;
  const newPlayers = new Set([...players, id]);
  return { ...game, players: [...newPlayers] };
}

// Consts
// --------------------

const APP_ID = "e836610f-502f-4caa-92d8-3be67fc6a55a";
const PLAYER_ID = randomHandle();

// Components
// --------------------

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

function App() {
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

// Screens
// --------------------
function Main() {
  const { games } = useQuery({ games: {} });
  const label = "new";
  const game = games.find((g) => g.id === label);
  console.log(game);
  console.log(PLAYER_ID);
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

  const { board, turn, outcome, players } = game;
  if (players.length !== 2) {
    return (
      <div className="flex flex-col">
        Waiting for players to join!
        <Button
          onClick={() =>
            transact(tx.games[label].update(addPlayer(game, PLAYER_ID)))
          }
        >
          Join Game
        </Button>
        {players.length > 0 && (
          <ul>
            {players.map((p) => (
              <div key={p}>{p}</div>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-center text-2xl font-bold my-2 capitalize">
        {outcome
          ? outcome === "draw"
            ? `Draw!`
            : `${outcome} wins!`
          : `Turn: ${players[turn]}`}
      </h1>
      <div className="m-4 w-72">
        {board.map((row, r) => (
          <div className="flex">
            {row.map((sq, c) => (
              <div
                className={`flex justify-center w-24 h-24 border-black border-solid border text-lg ${
                  !sq && !outcome
                    ? "hover:cursor-pointer hover:bg-slate-200"
                    : ""
                }`}
                onClick={() =>
                  !outcome &&
                  !board[r][c] &&
                  transact(tx.games[label].update(move(game, [r, c])))
                }
              >
                <div className="text-7xl">{sq}</div>
              </div>
            ))}
          </div>
        ))}
        <div className="m-4 flex justify-between">
          <Button
            onClick={() => transact(tx.games[label].update(resetBoard(game)))}
          >
            Reset Game
          </Button>
          <Button onClick={() => transact(tx.games[label].delete())}>
            Delete Game
          </Button>
        </div>
        {players.length > 0 && (
          <ul>
            {players.map((p, idx) => (
              <div key={p} className={p === outcome ? "bg-slate-200" : ""}>
                {p} -- {getMarker(idx)}
              </div>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
