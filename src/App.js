import assert from "assert";

import { useState, useEffect } from "react";
import { useInit, useQuery, tx, transact, id } from "@instantdb/react";

import { updateLocation, deleteLocation } from "./utils/location";
import { convertSecondsToMinutesAndSeconds } from "./utils/time";

import randomHandle from "./utils/randomHandle";
import Drawer from "./components/Drawer/drawer";

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
    clocks: [60, 60],
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

function hasPlayer(players, id) {
  return players.indexOf(id) > -1;
}

function removePlayer(game, id) {
  const { players } = game;
  const newPlayers = players.filter((p) => p !== id);
  return { players: [...newPlayers] };
}

// Actions
// --------------------
function maybeJoin(game, playerId) {
  const { players, id: gid } = game;
  if (players.length < 2 && !hasPlayer(players, PLAYER_ID)) {
    transact(tx.games[gid].update(addPlayer(game, playerId)));
  }
}

// Consts
// --------------------
const APP_ID = "e836610f-502f-4caa-92d8-3be67fc6a55a";
const PLAYER_ID = randomHandle();

// When enabled allows a player to move for their opponent
const _DEBUG_TURN = true;

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

// Navigation
// -----------------
const getLocationRoom = () => {
  return new URLSearchParams(window.location.search).get("roomId");
};

const setLocationRoom = (id) => {
  updateLocation("roomId", id);
};

const clearLocationRoom = () => {
  deleteLocation("roomId");
};

// Screens
// --------------------
function AdminButton({ onClick, children }) {
  return (
    <button
      className="text-sm text-left outline p-2 my-2 hover:bg-slate-400"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function AdminBar() {
  const { games } = useQuery({ games: {} });
  const deleteAll = () => transact(games.map((g) => tx.games[g.id].delete()));
  return (
    <Drawer defaultOpen={true}>
      <div className="pt-2 px-2">
        <div className="text-center pb-1">Admin bar</div>
        <div className="bg-slate-600 pb-1 mb-1"></div>
        <div className="flex flex-col">
          <div className="text-xs py-1">** Logged in as: {PLAYER_ID} **</div>
          <div>Live Rooms: {games.length}</div>
          <AdminButton onClick={deleteAll}>Delete All Games</AdminButton>
        </div>
      </div>
    </Drawer>
  );
}

function gameHeaderText({ players, outcome, turn }) {
  if (players.length < 2) {
    return "Waiting for opponent to join...";
  }

  if (!outcome) {
    return `Turn: ${players[turn]}`;
  }

  return outcome === "draw" ? "Draw!" : `${outcome} wins!`;
}

function Main() {
  const { games } = useQuery({ games: {} });

  const [room, setRoom] = useState(getLocationRoom());
  const game = room && games.find((g) => g.id === room);

  // Clock countdown
  useEffect(() => {
    if (game) {
      const { players, clocks, turn, outcome } = game;
      if (players.length >= 2 && players[turn] === PLAYER_ID && !outcome) {
        // New clock values
        const newClocks =
          turn === 0 ? [clocks[0] - 1, clocks[1]] : [clocks[0], clocks[1] - 1];

        // Account for time over
        let newUpdates;
        const timeOverIdx = newClocks.indexOf(0);
        if (timeOverIdx > -1) {
          const newOutcome = timeOverIdx === 0 ? players[1] : players[0];
          newUpdates = { clocks: newClocks, outcome: newOutcome };
        } else {
          newUpdates = { clocks: newClocks };
        }

        const timerId = setInterval(
          () => transact(tx.games[game.id].update({ ...newUpdates })),
          1000
        );
        return () => clearInterval(timerId);
      }
    }
  }, [game]);

  // Lobby
  if (!game) {
    return (
      <div>
        <AdminBar />
        <Button
          onClick={() => {
            const room = id();
            const newGame = addPlayer(initialState(), PLAYER_ID);
            transact(tx.games[room].update(newGame));
            setLocationRoom(room);
            setRoom(room);
          }}
        >
          Create Game!
        </Button>
        <Button
          onClick={() => {
            const roomId = id();
            const newGame = addPlayer(initialState(), PLAYER_ID);
            transact(tx.games[roomId].update({ ...newGame, private: true }));
            setLocationRoom(roomId);
            setRoom(roomId);
          }}
        >
          Create Private Game!
        </Button>

        <div>
          <h1 className="text-xl my-2 font-bold">Games</h1>
          {games && (
            <ul>
              {games
                .filter((g) => !g.private)
                .map((g) => (
                  <li
                    onClick={() => {
                      const gid = g.id;
                      transact(tx.games[gid].update(addPlayer(g, PLAYER_ID)));
                      setLocationRoom(gid);
                      setRoom(gid);
                    }}
                    key={g.id}
                  >
                    {g.players[0]}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // Game
  const { board, turn, outcome, players, clocks } = game;
  maybeJoin(game, PLAYER_ID);
  return (
    <div className="flex">
      {/* Player list + clocks */}
      <div className="flex-none w-1/4 p-4">
        <div className="min-h-screen flex flex-col justify-center">
          {players.length > 0 && (
            <div className="space-y-16">
              <div>
                <div className="text-2xl">
                  {convertSecondsToMinutesAndSeconds(clocks[0])}
                </div>
                <div
                  className={`w-full border ${
                    turn === 0 && !outcome && "border-green-600"
                  }`}
                ></div>
                <div className={players[0] === outcome ? "bg-slate-200" : ""}>
                  {players[0] && `${players[0]} -- ${getMarker(0)}`}
                </div>
              </div>
              <div>
                <div className={players[1] === outcome ? "bg-slate-200" : ""}>
                  {players[1] && `${players[1]} -- ${getMarker(1)}`}
                </div>
                <div
                  className={`w-full border ${
                    turn === 1 && !outcome && "border-green-600"
                  }`}
                ></div>
                <div className="text-2xl">
                  {convertSecondsToMinutesAndSeconds(clocks[1])}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-none w-1/2 p-4">
        <div className="min-h-screen flex flex-col items-center justify-center">
          <AdminBar />
          <h1 className="text-center text-2xl font-bold my-2 capitalize">
            {gameHeaderText({ players, outcome, turn })}
          </h1>
          <div className="m-4 w-72">
            {board.map((row, r) => (
              <div key={`row-${r}`} className="flex">
                {row.map((sq, c) => (
                  <div
                    key={`idx-${r}-${c}`}
                    className={`flex justify-center w-24 h-24 border-black border-solid border text-lg ${
                      players.length >= 2 &&
                      !sq &&
                      !outcome &&
                      (_DEBUG_TURN || players[turn] === PLAYER_ID)
                        ? "hover:cursor-pointer hover:bg-slate-200"
                        : ""
                    }`}
                    onClick={() =>
                      players.length >= 2 &&
                      !outcome &&
                      !board[r][c] &&
                      (_DEBUG_TURN || players[turn] === PLAYER_ID) &&
                      transact(tx.games[room].update(move(game, [r, c])))
                    }
                  >
                    <div className="text-7xl">{sq}</div>
                  </div>
                ))}
              </div>
            ))}
            <div className="m-4 flex justify-between">
              <Button
                onClick={() =>
                  transact(tx.games[room].update(resetBoard(game)))
                }
              >
                Reset Game
              </Button>
              <Button
                onClick={() => {
                  players.length === 1
                    ? transact(tx.games[room].delete())
                    : transact(
                        tx.games[room].update(removePlayer(game, PLAYER_ID))
                      );
                  clearLocationRoom();
                  setRoom(null);
                }}
              >
                Leave Game
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
