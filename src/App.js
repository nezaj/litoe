import assert from "assert";

import { useState, useEffect } from "react";
import { useInit, useQuery, tx, transact, id } from "@instantdb/react";

import { updateLocation, deleteLocation } from "./utils/location";
import { convertSecondsToMinutesAndSeconds } from "./utils/time";

import randomHandle from "./utils/randomHandle";
import Drawer from "./components/Drawer/drawer";

// Game logic
// --------------------
/** Returns true if a row contains all of the same markers */
function checkRows(board, mark) {
  return board.some((row) => row.every((val) => val === mark));
}

/** Returns true if all entries of a board are full */
function isFull(board) {
  return board.every((row) => row.length && row.every((sq) => sq));
}

/** Returns true if there is a win condition (checks rows, columns, diagonals) */
function isGameWon(board, mark) {
  const inverted = board.map((_, col) => [
    board[0][col],
    board[1][col],
    board[2][col],
  ]);
  const diags = [
    [board[0][0], board[1][1], board[2][2]],
    [board[0][2], board[1][1], board[2][0]],
  ];

  return [board, inverted, diags].some((x) => checkRows(x, mark));
}

/** We consider a game started once there has been at least two moves */
function hasGameStarted(board) {
  return board.flat().filter((x) => x).length > 1;
}

/** Tests our win condition logic
 * (TODO): Move this to a separate file
 */
function _isGameWonTest() {
  let board;

  // columns work
  board = [
    ["x", "o", "x"],
    ["x", "x", "o"],
    ["x", "o", "x"],
  ];
  assert(isGameWon(board, "x"));

  // rows work
  board = [
    ["x", "x", "x"],
    ["x", "o", "o"],
    ["o", "o", "x"],
  ];
  assert(isGameWon(board, "x"));

  // diagnols work
  board = [
    ["x", "o", "x"],
    ["x", "x", "o"],
    ["o", "o", "x"],
  ];
  assert(isGameWon(board, "x"));

  // No false positive
  board = [
    ["o", "x", "o"],
    ["x", "x", "o"],
    ["x", "o", "x"],
  ];
  assert(!isGameWon(board, "x"));
}

/** Return a new array with value replaced at target index */
function updateInArr(arr, target, newVal) {
  return arr.map((val, i) => (i === target ? newVal : val));
}

/** Return a new 2D array with value replaced at target coordinates */
function updateInMatrix(m, [x, y], newVal) {
  return m.map((row, r) => (r === x ? updateInArr(row, y, newVal) : row));
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

/** Returns empty board state */
function emptyBoard() {
  return [
    [undefined, undefined, undefined],
    [undefined, undefined, undefined],
    [undefined, undefined, undefined],
  ];
}

/** Returns initial game state */
function initialState() {
  return {
    board: emptyBoard(),
    turn: 0,
    outcome: null,
    players: [],
    clocks: [60, 60],
    rematchId: null,
  };
}

/** Returns an update to reset game state */
function resetGameState(game, opts = {}) {
  const { players } = game;
  const { reversePlayers } = opts;
  const newGame = initialState();
  return {
    ...newGame,
    players: reversePlayers ? players.slice().reverse() : players,
  };
}

/** Given a game and coordinates for a move, returns an update to alter game state */
function move(game, [r, c]) {
  const { board, turn, players } = game;
  const mark = getMarker(turn);
  const currentPlayer = players[turn];
  const newTurn = turn === 0 ? 1 : 0;
  const newBoard = updateInMatrix(board, [r, c], mark);
  const newOutcome = updateOutcome(newBoard, currentPlayer, mark);
  return { ...game, board: newBoard, turn: newTurn, outcome: newOutcome };
}

/** Returns an update to add a player to a game */
function addPlayer(game, id) {
  const { players } = game;
  const newPlayers = new Set([...players, id]);
  return { ...game, players: [...newPlayers] };
}

/** Returns an update to remove a player from a game */
function removePlayer(game, id) {
  const { players } = game;
  const newPlayers = players.filter((p) => p !== id);
  return { players: [...newPlayers] };
}

/** Returns game data for a roomId */
function findGame(games, roomId) {
  return roomId && games.find((g) => g.id === roomId);
}

/** Returns the opponent player id */
function getOpponentId(players, playerId) {
  if (isObserver(players, playerId)) {
    console.warn(
      "[getOpponet] should only called be called with a valid player"
    );
    return;
  }
  const idx = players.indexOf(playerId);
  return idx === 0 ? players[1] : players[0];
}

/** Return if a player is part of game */
function isPlayer(players, playerId) {
  return players.indexOf(playerId) > -1;
}

/** Return if a player is an observer of game */
function isObserver(players, playerId) {
  return !isPlayer(players, playerId);
}

/** Return if an outcome has been determined */
function isOutcome(game) {
  const { outcome } = game;
  return !!outcome;
}

/** Returns if a rematch has been offerred */
function isRematch(game) {
  const { rematchId } = game;
  return !!rematchId;
}

/** Return if player was offered a rematch */
function isRematchPlayer(game, playerId) {
  const { rematchId } = game;
  return playerId === rematchId;
}

// Actions
// --------------------
/** Reset game state */
function resetGame(game, opts = {}) {
  const { id: roomId } = game;
  transact(tx.games[roomId].update(resetGameState(game, opts)));
}

/** Adds a player to the game if there is space */
function maybeJoin(game, playerId) {
  const { players, id: roomId } = game;
  if (players.length < 2 && !isPlayer(players, PLAYER_ID)) {
    transact(tx.games[roomId].update(addPlayer(game, playerId)));
  }
}

/** Offers rematch to player's opponent */
function offerRematch(game, playerId) {
  const { id: roomId, rematchId, players } = game;
  const newUpdate = rematchId
    ? resetGameState(game, { reversePlayers: true })
    : { rematchId: getOpponentId(players, playerId) };
  transact(tx.games[roomId].update(newUpdate));
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

// Consts
// --------------------
const APP_ID = "e836610f-502f-4caa-92d8-3be67fc6a55a";
const PLAYER_ID = randomHandle();

// When enabled allows a player to move for their opponent
const _DEBUG_TURN = true;

// Components
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

function Button({ onClick, children, disabled }) {
  return (
    <button
      className={`p-4 border border-solid ${
        disabled
          ? "text-gray-300 border-gray-300"
          : "border-black hover:bg-slate-200"
      }`}
      onClick={onClick}
      disabled={disabled}
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
function AdminBar({ setRoomId }) {
  const { games } = useQuery({ games: {} });
  const roomId = getLocationRoom();
  const game = roomId && findGame(games, roomId);

  const deleteAll = () => transact(games.map((g) => tx.games[g.id].delete()));
  return (
    <Drawer defaultOpen={true}>
      <div className="pt-2 px-2">
        <div className="text-center pb-1">Admin bar</div>
        <div className="bg-slate-600 pb-1 mb-1"></div>
        <div className="flex flex-col">
          <div className="text-xs py-1">** Logged in as: {PLAYER_ID} **</div>
          {game && (
            <div className="text-xs py-1">
              <div>Current room</div>
              <div className="mt-1">{roomId}</div>
            </div>
          )}
          <div>Live Rooms: {games.length}</div>
          <AdminButton
            onClick={() => {
              clearLocationRoom();
              setRoomId(null);
              deleteAll();
            }}
          >
            Delete All Games
          </AdminButton>
          {game && (
            <AdminButton onClick={() => resetGame(game)}>
              Reset Game
            </AdminButton>
          )}
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

  const [roomId, setRoomId] = useState(getLocationRoom());
  const game = findGame(games, roomId);

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
        <AdminBar setRoomId={setRoomId} />
        <Button
          onClick={() => {
            const roomId = id();
            const newGame = addPlayer(initialState(), PLAYER_ID);
            transact(tx.games[roomId].update(newGame));
            setLocationRoom(roomId);
            setRoomId(roomId);
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
            setRoomId(roomId);
          }}
        >
          Create Private Game!
        </Button>
        <Button
          onClick={() => {
            const newRoomId = window.prompt("Enter roomId");
            if (newRoomId && findGame(games, newRoomId)) {
              setLocationRoom(newRoomId);
              setRoomId(newRoomId);
            }
          }}
        >
          Join Private Game
        </Button>

        <div>
          <h1 className="text-xl my-2 font-bold">Games</h1>
          {games.length > 0 && (
            <ul>
              {games
                .filter((g) => !g.private)
                .map((g) => (
                  <li
                    onClick={() => {
                      const roomId = g.id;
                      transact(
                        tx.games[roomId].update(addPlayer(g, PLAYER_ID))
                      );
                      setLocationRoom(roomId);
                      setRoomId(roomId);
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

              <div className="flex">
                <Button
                  onClick={() => {
                    players.length === 1
                      ? transact(tx.games[roomId].delete())
                      : transact(
                          tx.games[roomId].update(removePlayer(game, PLAYER_ID))
                        );
                    clearLocationRoom();
                    setRoomId(null);
                  }}
                  disabled={
                    isPlayer(players, PLAYER_ID) &&
                    hasGameStarted(board) &&
                    !isOutcome(game)
                  }
                >
                  Leave game
                </Button>
                <Button
                  onClick={() => {
                    const ok = window.confirm("Are you sure?");
                    if (ok) {
                      const playerIdx = players.indexOf(PLAYER_ID);
                      const winner = playerIdx === 0 ? players[1] : players[0];
                      transact(tx.games[roomId].update({ outcome: winner }));
                    }
                  }}
                  disabled={
                    isObserver(players, PLAYER_ID) ||
                    (isPlayer(players, PLAYER_ID) && !hasGameStarted(board)) ||
                    isOutcome(game)
                  }
                >
                  Forfeit game
                </Button>
              </div>
              <div>
                {isRematchPlayer(game, PLAYER_ID) ? (
                  <Button
                    onClick={() => resetGame(game, { reversePlayers: true })}
                  >
                    Accept rematch
                  </Button>
                ) : (
                  <Button
                    onClick={() => offerRematch(game, PLAYER_ID)}
                    disabled={
                      isObserver(players, PLAYER_ID) ||
                      (isPlayer(players, PLAYER_ID) && !isOutcome(game)) ||
                      isRematch(game)
                    }
                  >
                    {isRematch(game) ? "Rematch offered" : "Offer rematch"}
                  </Button>
                )}
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
          <AdminBar setRoomId={setRoomId} />
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
                      transact(tx.games[roomId].update(move(game, [r, c])))
                    }
                  >
                    <div className="text-7xl">{sq}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
